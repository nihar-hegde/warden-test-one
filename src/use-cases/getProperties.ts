import { Request, Response } from "express";
import { prisma } from "../database/prisma";
import { getWeatherGroupLabel, matchesWeatherGroup } from "../lib/weather";
import { fetchWeatherForProperties } from "../lib/openMeteo";
import { clamp, parseNumber, parseWeatherGroups } from "../lib/utils";

export const getProperties = async (req: Request, res: Response) => {
  try {
    const searchText =
      typeof req.query.searchText === "string"
        ? req.query.searchText.trim()
        : undefined;

    const tempMinRaw = parseNumber(req.query.tempMin);
    const tempMaxRaw = parseNumber(req.query.tempMax);
    const humMinRaw = parseNumber(req.query.humMin);
    const humMaxRaw = parseNumber(req.query.humMax);
    const takeRaw = parseNumber(req.query.take) ?? 20;
    const pageRaw = parseNumber(req.query.page) ?? 1;

    // clamp values
    const tempMin =
      typeof tempMinRaw === "number" ? clamp(tempMinRaw, -20, 50) : undefined;
    const tempMax =
      typeof tempMaxRaw === "number" ? clamp(tempMaxRaw, -20, 50) : undefined;
    const humMin =
      typeof humMinRaw === "number" ? clamp(humMinRaw, 0, 100) : undefined;
    const humMax =
      typeof humMaxRaw === "number" ? clamp(humMaxRaw, 0, 100) : undefined;

    const take = Math.min(Math.max(1, Math.floor(takeRaw)), 200);
    const page = Math.max(1, pageRaw);

    const weatherGroups = parseWeatherGroups(req.query.weather as any);

    const where: any = {};
    if (searchText) {
      where.OR = [
        { name: { contains: searchText } },
        { city: { contains: searchText } },
        { state: { contains: searchText } },
      ];
    }

    // check if weather filters are applied
    const hasWeatherFilters =
      typeof tempMin !== "undefined" ||
      typeof tempMax !== "undefined" ||
      typeof humMin !== "undefined" ||
      typeof humMax !== "undefined" ||
      (weatherGroups && weatherGroups.length > 0);

    // if no weather filters, do normal DB pagination
    if (!hasWeatherFilters) {
      const total = await prisma.property.count({ where });
      const properties = await prisma.property.findMany({
        where,
        skip: (page - 1) * take,
        take,
      });

      return res.json({
        data: properties,
        page,
        take,
        total,
        hasNextPage: page * take < total,
      });
    }

    // batching if weather filters are present
    const BATCH_SIZE = 200;
    let filtered: any[] = [];
    let totalChecked = 0;
    let hasMore = true;

    while (hasMore && filtered.length < page * take) {
      const dbBatch = await prisma.property.findMany({
        where,
        skip: totalChecked,
        take: BATCH_SIZE,
      });

      if (dbBatch.length === 0) {
        hasMore = false;
        break;
      }

      totalChecked += dbBatch.length;

      const withCoords = dbBatch.filter(
        (p) => typeof p.lat === "number" && typeof p.lng === "number"
      );

      if (withCoords.length === 0) continue;

      const toFetch = withCoords.map((p) => ({
        id: p.id,
        lat: p.lat as number,
        lng: p.lng as number,
      }));

      const propsWithWeather = await fetchWeatherForProperties(toFetch);

      const batchFiltered = propsWithWeather.filter((p) => {
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

      const idToProp = new Map(dbBatch.map((p) => [p.id, p]));
      const mapped = batchFiltered.map((p: any) => {
        const base = idToProp.get(p.id)!;
        return {
          ...base,
          weather: {
            ...p.weather,
            weatherGroup: getWeatherGroupLabel(p.weather?.weathercode ?? null),
          },
          weatherError: p.weatherError ?? null,
        };
      });

      filtered.push(...mapped);

      // stop if fewer than batch size were returned (no more rows)
      if (dbBatch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // paginate filtered results
    const total = filtered.length;
    const start = (page - 1) * take;
    const end = start + take;
    const paginated = filtered.slice(start, end);

    return res.json({
      data: paginated,
      page,
      take,
      total,
      hasNextPage: end < total,
    });
  } catch (error) {
    console.error("Error in getProperties:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
