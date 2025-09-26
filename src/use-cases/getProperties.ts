import { Request, Response } from "express";
import { prisma } from "../database/prisma";
import { matchesWeatherGroup } from "../lib/weather";
import { fetchWeatherForProperties } from "../lib/openMeteo";
import { clamp, parseNumber, parseWeatherGroups } from "../lib/utils";

export const getProperties = async (req: Request, res: Response) => {
  try {
    // get and validate query search text
    const searchText =
      typeof req.query.searchText === "string"
        ? req.query.searchText.trim()
        : undefined;

    // get and validate other query params
    // tempMin, tempMax in -20 to 50
    // humMin, humMax in 0 to 100
    // take: number of results to return (1 to 200, default 20)
    // page: page number (1-based, default 1)
    // weather: comma-separated weather groups (clear, cloudy, rainy, snow, drizzle)
    const tempMinRaw = parseNumber(req.query.tempMin);
    const tempMaxRaw = parseNumber(req.query.tempMax);
    const humMinRaw = parseNumber(req.query.humMin);
    const humMaxRaw = parseNumber(req.query.humMax);
    const takeRaw = parseNumber(req.query.take) ?? 20;
    const pageRaw = parseNumber(req.query.page) ?? 1;

    // implement chat gpt suggested clamping of values so that they stay within the required filter range
    const tempMin =
      typeof tempMinRaw === "number" ? clamp(tempMinRaw, -20, 50) : undefined;
    const tempMax =
      typeof tempMaxRaw === "number" ? clamp(tempMaxRaw, -20, 50) : undefined;
    const humMin =
      typeof humMinRaw === "number" ? clamp(humMinRaw, 0, 100) : undefined;
    const humMax =
      typeof humMaxRaw === "number" ? clamp(humMaxRaw, 0, 100) : undefined;

    // for pagination
    const take = Math.min(Math.max(1, Math.floor(takeRaw)), 200);
    const page = Math.max(1, pageRaw);
    const skip = (page - 1) * take;

    // parse weather groups -> check if the weather groups provided are valid or not.
    const weatherGroups = parseWeatherGroups(req.query.weather as any);

    // build the where prisma clause for text search (take from original code)
    const where: any = {};
    if (searchText) {
      where.OR = [
        { name: { contains: searchText } },
        { city: { contains: searchText } },
        { state: { contains: searchText } },
      ];
    }

    // fetch properties from db (without weather filtering)
    const properties = await prisma.property.findMany({
      take,
      skip,
      where,
    });

    // if no weather filters, return properties as is
    const hasWeatherFilters =
      typeof tempMin !== "undefined" ||
      typeof tempMax !== "undefined" ||
      typeof humMin !== "undefined" ||
      typeof humMax !== "undefined" ||
      (weatherGroups && weatherGroups.length > 0);

    if (!hasWeatherFilters) {
      return res.json(properties);
    }

    // filter all properties with valid lat and long in them
    const withCoords = properties.filter(
      (p) => typeof p.lat === "number" && typeof p.lng === "number"
    );

    // log if some properties were skipped due to missing lat or long
    const skipped = properties.length - withCoords.length;
    if (skipped > 0) {
      console.warn(
        `[getProperties] Skipping ${skipped} properties with missing lat/lng`
      );
    }

    // if weather filters are applied and no properties with coords, return empty array as weather can't be fetched
    if (withCoords.length === 0) {
      return res.json([]);
    }

    // filter properties and only take their id , lat and long as that is all that is needed to fetch weather
    const toFetch = withCoords.map((p) => ({
      id: p.id,
      lat: p.lat as number,
      lng: p.lng as number,
    }));

    // call weather fetcher for all properties concurrently (with limit)
    const propsWithWeather = await fetchWeatherForProperties(toFetch);

    // now filter the properties based on weather conditions
    // note: if weather fetch failed for a property, it won't be included in final results
    const filtered = propsWithWeather.filter((p) => {
      const w = p.weather;
      if (!w) return false;

      if (
        typeof tempMin === "number" &&
        (typeof w.temperature !== "number" || w.temperature < tempMin)
      )
        return false;
      if (
        typeof tempMax === "number" &&
        (typeof w.temperature !== "number" || w.temperature > tempMax)
      )
        return false;

      if (
        typeof humMin === "number" &&
        (typeof w.humidity !== "number" || w.humidity < humMin)
      )
        return false;
      if (
        typeof humMax === "number" &&
        (typeof w.humidity !== "number" || w.humidity > humMax)
      )
        return false;

      if (weatherGroups.length > 0) {
        if (typeof w.weathercode !== "number") return false;
        if (!matchesWeatherGroup(w.weathercode, weatherGroups)) return false;
      }

      return true;
    });

    // map back to original property details
    const idToProp = new Map(properties.map((p) => [p.id, p]));
    const final = filtered.map((p: any) => {
      const base = idToProp.get(p.id)!;
      return {
        ...base,
        weather: p.weather,
        weatherError: p.weatherError ?? null,
      };
    });

    return res.json(final);
  } catch (error) {
    console.error("Error in getProperties:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
