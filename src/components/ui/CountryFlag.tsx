const COUNTRY_TO_ISO: Record<string, string> = {
  USA: "us",
  "D.R.": "do",
  Venezuela: "ve",
  Cuba: "cu",
  "P.R.": "pr",
  Japan: "jp",
  Korea: "kr",
  Mexico: "mx",
  Canada: "ca",
  Panama: "pa",
  Colombia: "co",
  Nicaragua: "ni",
  Curacao: "cw",
  Taiwan: "tw",
  Australia: "au",
  Netherlands: "nl",
  Brazil: "br",
  Germany: "de",
  "U.S. Virgin Islands": "vi",
  "V.I.": "vi",
  Honduras: "hn",
  Bahamas: "bs",
  Italy: "it",
  England: "gb",
  "United Kingdom": "gb",
  Jamaica: "jm",
  Aruba: "aw",
  Spain: "es",
  Ireland: "ie",
  France: "fr",
  "Costa Rica": "cr",
  Guatemala: "gt",
  "El Salvador": "sv",
  "Dominican Republic": "do",
  "Puerto Rico": "pr",
  "South Korea": "kr",
  CAN: "ca",
};

interface CountryFlagProps {
  country: string | null | undefined;
  className?: string;
}

export function CountryFlag({ country, className = "" }: CountryFlagProps) {
  if (!country) return null;
  const iso = COUNTRY_TO_ISO[country];
  if (!iso) return null;

  return (
    <img
      src={`/flags/4x3/${iso}.svg`}
      alt={country}
      title={country}
      className={`inline-block rounded-sm align-middle ${className}`}
      style={{ width: "1.4em", height: "1em" }}
    />
  );
}
