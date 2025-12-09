export const countries = [
  { code: "DRC", name: "Democratic Republic of Congo" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "Mexico" },
  { code: "AU", name: "Australia" },
  { code: "CH", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "GB", name: "United Kingdom" },
];

export const flagFromCode = (code: string): string => {
  const codeMap: Record<string, string> = {
    DRC: "🇨🇩",
    US: "🇺🇸",
    CA: "🇨🇦",
    FR: "🇫🇷",
    ES: "🇪🇸",
    DE: "🇩🇪",
    IT: "🇮🇹",
    BR: "🇧🇷",
    AR: "🇦🇷",
    MX: "🇲🇽",
    AU: "🇦🇺",
    CH: "🇨🇳",
    JP: "🇯🇵",
    KR: "🇰🇷",
    GB: "🇬🇧",
  };
  return codeMap[code] || "🏳️";
};

export const codeForCountryName = (name: string): string | undefined => {
  const normalizedName = name.toLowerCase().trim();
  const country = countries.find(
    (c) => c.name.toLowerCase() === normalizedName
  );
  return country?.code;
};
