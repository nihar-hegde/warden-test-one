export const WeatherGroups = {
  clear: new Set([0]),
  cloudy: new Set([1, 2, 3]),
  drizzle: new Set([51, 52, 53, 54, 55, 56, 57]),
  rainy: new Set([61, 62, 63, 64, 65, 66, 67, 80, 81, 82]),
  snow: new Set([71, 72, 73, 74, 75, 76, 77, 85, 86]),
} as const;

export type WeatherGroup = keyof typeof WeatherGroups;

// list of allowed group keys (the options for users to select like clear, cloudy,rainy etc...)
export const WEATHER_GROUP_KEYS = Object.keys(WeatherGroups) as WeatherGroup[];

/**
 * Checks if a weather code belongs to one of the given weather groups.
 * If no groups are provided, it matches all codes.
 */
export function matchesWeatherGroup(
  code: number | null | undefined,
  groups?: (WeatherGroup | string)[]
): boolean {
  // If caller didn't pass groups (or passed empty), don't filter by group
  if (!groups || groups.length === 0) return true;

  // reject invalid/unknown groups early and only use known ones
  const validGroups = (groups as WeatherGroup[]).filter((g) =>
    WEATHER_GROUP_KEYS.includes(g as WeatherGroup)
  ) as WeatherGroup[];

  if (validGroups.length === 0) return true; // no valid groups so don't filter by groups

  // if code is null/undefined/invalid can't match any group
  if (typeof code !== "number") return false;

  return validGroups.some((g) => WeatherGroups[g].has(code));
}

// Map a weathercode → one of your group keys ("clear", "cloudy", etc.)
export function getWeatherGroupLabel(code: number | null): WeatherGroup | null {
  if (typeof code !== "number") return null;

  for (const group of WEATHER_GROUP_KEYS) {
    if (WeatherGroups[group].has(code)) {
      return group;
    }
  }

  return null;
}
