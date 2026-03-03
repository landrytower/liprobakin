export const normalizeTeamName = (name: string): string => {
  const withFixedTypo = name
    .replace(/\bsepoir\b/gi, "Espoir")
    .replace(/\bfukas\b|\bfukash\b/gi, "Fukash")
    .trim();
  return withFixedTypo.replace(/^espoir\s+espoir\s+/i, "Espoir ").trim();
};

export const formatTeamDisplayName = (
  city?: string | null,
  name?: string | null,
  fallback = ""
): string => {
  const normalizedCity = normalizeTeamName(city ?? "");
  const normalizedName = normalizeTeamName(name ?? "");

  if (!normalizedCity) return normalizedName || fallback;
  if (!normalizedName) return normalizedCity;

  const cityLower = normalizedCity.toLowerCase();
  const nameLower = normalizedName.toLowerCase();

  if (nameLower === cityLower || nameLower.startsWith(`${cityLower} `)) {
    return normalizedName;
  }

  return normalizeTeamName(`${normalizedCity} ${normalizedName}`.trim());
};