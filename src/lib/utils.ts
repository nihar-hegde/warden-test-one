import { WEATHER_GROUP_KEYS, WeatherGroup } from "./weather";

// parse a number from query param, return undefined if invalid/missing
export function parseNumber(q: any): number | undefined {
  if (typeof q === "string" && q.trim() !== "") {
    const n = Number(q);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof q === "number") return Number.isFinite(q) ? q : undefined;
  return undefined;
}

// make sure that the number n is within the given min and max range (inclusive)
export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// parse weather groups from query param (comma-separated string or array of strings)
// make sure the groups are valid keys
export function parseWeatherGroups(
  raw?: string | string[] | null
): WeatherGroup[] {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  // only keep known keys
  return arr.filter((a) =>
    WEATHER_GROUP_KEYS.includes(a as WeatherGroup)
  ) as WeatherGroup[];
}
