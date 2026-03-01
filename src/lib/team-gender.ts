export type TeamGender = "men" | "women";

const WOMEN_VALUES = new Set([
  "women",
  "woman",
  "womens",
  "women's",
  "female",
  "females",
  "ladies",
  "lady",
  "femme",
  "femmes",
  "dames",
  "girls",
]);

const MEN_VALUES = new Set([
  "men",
  "man",
  "mens",
  "men's",
  "male",
  "males",
  "homme",
  "hommes",
  "boys",
]);

const asNormalizedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.toLowerCase().trim();
};

export const normalizeTeamGender = (
  rawGender: unknown,
  rawLogo: unknown,
  fallback: TeamGender = "men"
): TeamGender => {
  const normalized = asNormalizedString(rawGender);
  if (WOMEN_VALUES.has(normalized)) return "women";
  if (MEN_VALUES.has(normalized)) return "men";

  const logo = asNormalizedString(rawLogo);
  if (logo.includes("/females/") || logo.includes("\\females\\") || logo.includes("/female/") || logo.includes("\\female\\")) {
    return "women";
  }

  if (logo.includes("/males/") || logo.includes("\\males\\") || logo.includes("/male/") || logo.includes("\\male\\")) {
    return "men";
  }

  return fallback;
};
