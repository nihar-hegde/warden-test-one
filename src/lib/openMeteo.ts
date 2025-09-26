// src/lib/openMeteo.ts
import axios from "axios";
import NodeCache from "node-cache";
import pLimit from "p-limit";

export type WeatherResult = {
  temperature: number | null;
  weathercode: number | null;
  humidity: number | null;
  fetchedAt: string | null;
};

const CACHE_TTL_SECONDS = Number(process.env.WEATHER_CACHE_TTL ?? 600); // default 10 minutes
const CACHE_ROUND_DIGITS = 4; // round lat/lng to increase cache hits.
const CONCURRENCY = Number(process.env.WEATHER_CONCURRENCY ?? 5);
const REQUEST_TIMEOUT_MS = 8_000;

const cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 60 });
const limit = pLimit(CONCURRENCY);

// create a cache key by rounding lat/lng to reduce number of unique keys (we can round it off as it reduces the accuracy slightly but increases cache hits) and
//  it is highly unlikely that the weather would change drastically within a few meters
function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(CACHE_ROUND_DIGITS)},${lng.toFixed(
    CACHE_ROUND_DIGITS
  )}`;
}

// fetch raw weather data from OpenMeteo API using lat and long
async function fetchWeatherRaw(lat: number, lng: number) {
  const url = "https://api.open-meteo.com/v1/forecast";
  const params = {
    latitude: lat,
    longitude: lng,
    current_weather: true,
    hourly: "relativehumidity_2m",
    timezone: "UTC",
  };

  const resp = await axios.get(url, { params, timeout: REQUEST_TIMEOUT_MS });
  return resp.data;
}

// fetch weather data with caching
export async function fetchWeather(
  lat: number,
  lng: number
): Promise<WeatherResult> {
  // create a cache key and check if we have it in cache if so just return it immediately no need to re fetch
  const key = cacheKey(lat, lng);
  const cached = cache.get<WeatherResult>(key);
  if (cached) return cached;

  // do actual fetching here
  try {
    // fetch raw data
    const data = await fetchWeatherRaw(lat, lng);

    // extract relevant fields from the raw data
    const cw = data?.current_weather;
    let temperature: number | null = null;
    let weathercode: number | null = null;
    let humidity: number | null = null;

    if (cw) {
      temperature = typeof cw.temperature === "number" ? cw.temperature : null;
      weathercode = typeof cw.weathercode === "number" ? cw.weathercode : null;
    }

    // Extract nearest hourly humidity if available
    try {
      const times: string[] = data?.hourly?.time ?? [];
      const hums: number[] = data?.hourly?.relativehumidity_2m ?? [];

      if (times.length && hums.length && times.length === hums.length) {
        const now = Date.now();
        let bestIdx = 0;
        let bestDiff = Infinity;

        for (let i = 0; i < times.length; i++) {
          // try Date.parse; if it returns NaN, try appending 'Z'
          let t = Date.parse(times[i]);
          if (Number.isNaN(t)) t = Date.parse(times[i] + "Z");
          if (Number.isNaN(t)) continue;
          const diff = Math.abs(now - t);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }

        const h = hums[bestIdx];
        humidity = typeof h === "number" ? h : null;
      }
    } catch {
      // ignore errors here, humidity will just be null
    }

    // create the result object
    const result: WeatherResult = {
      temperature,
      weathercode,
      humidity,
      fetchedAt: new Date().toISOString(),
    };
    // cache it before returning
    cache.set(key, result);
    return result;
  } catch (err: any) {
    // bubble up a clear error so callers can decide how to treat failures
    throw new Error(
      `OpenMeteo fetch failed for ${lat},${lng}: ${err?.message ?? err}`
    );
  }
}

/**
 * Bulk fetcher with concurrency limiting.
 * Input: array of { id, lat, lng }
 * Output: array of { id, lat, lng, weather?: WeatherResult, weatherError?: string }
 */
export async function fetchWeatherForProperties(
  props: { id: number; lat: number; lng: number }[]
): Promise<
  {
    id: number;
    lat: number;
    lng: number;
    weather?: WeatherResult | null;
    weatherError?: string | null;
  }[]
> {
  return Promise.all(
    props.map((p) =>
      limit(async () => {
        try {
          const weather = await fetchWeather(p.lat, p.lng);
          return {
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            weather,
            weatherError: null,
          };
        } catch (e: any) {
          return {
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            weather: null,
            weatherError: e?.message ?? String(e),
          };
        }
      })
    )
  );
}
