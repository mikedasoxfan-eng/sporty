// Maps Lahman birthCountry values to ISO 3166-1 alpha-2 codes
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
  "American Samoa": "as",
  Spain: "es",
  Scotland: "gb-sct",
  Ireland: "ie",
  France: "fr",
  Belgium: "be",
  Norway: "no",
  Sweden: "se",
  Finland: "fi",
  Austria: "at",
  Switzerland: "ch",
  Peru: "pe",
  Chile: "cl",
  "Costa Rica": "cr",
  Guatemala: "gt",
  "El Salvador": "sv",
  Ecuador: "ec",
  Bolivia: "bo",
  China: "cn",
  Philippines: "ph",
  Indonesia: "id",
  Vietnam: "vn",
  Lithuania: "lt",
  Poland: "pl",
  "Czech Republic": "cz",
  Russia: "ru",
  Ukraine: "ua",
  "South Africa": "za",
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
  if (!iso) return <span className="text-xs text-muted">{country}</span>;

  return (
    <span
      className={`fi fi-${iso} fis inline-block rounded-sm ${className}`}
      style={{ width: "1.2em", height: "0.9em", lineHeight: "0.9em" }}
      title={country}
    />
  );
}
