import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const geoapifyKey = process.env.GEOAPIFY_API_KEY || "";
const NOMINATIM_USER_AGENT = "SellerAI/1.0 (ben@housingpa.com)";
const PHILLY_VIEWBOX = "-75.65,40.45,-74.65,39.45";

type Suggestion = {
  id: string;
  label: string;
  placeTypes?: string[];
};

const STATE_ABBR: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY"
};

function stateAbbr(value: any) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^[A-Z]{2}$/i.test(text)) return text.toUpperCase();
  if (/^US-[A-Z]{2}$/i.test(text)) return text.slice(-2).toUpperCase();
  return STATE_ABBR[text.toLowerCase()] || text;
}

function requestedState(text: string) {
  const normalized = String(text || "").toLowerCase();
  for (const abbr of Object.values(STATE_ABBR)) {
    if (new RegExp(`\\b${abbr}\\b`, "i").test(text)) return abbr;
  }
  for (const [stateName, abbr] of Object.entries(STATE_ABBR)) {
    if (normalized.includes(stateName)) return abbr;
  }
  return "";
}

function cleanCity(value: any) {
  return String(value || "")
    .replace(/\s+(Township|Borough|City)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLabel(value: any) {
  let label = String(value || "")
    .replace(/\bUnited States(?: of America)?\b/gi, "")
    .replace(/\bUSA\b/gi, "")
    .replace(/\bPennsylvania\b/gi, "PA")
    .replace(/\s+/g, " ")
    .trim();

  label = label
    .replace(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*,\s*\1\s+\2(?:-\d{4})?/gi, "$1 $2")
    .replace(/\b([A-Z]{2})\s*,\s*\1\b/gi, "$1")
    .replace(/,\s*,+/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return label;
}

function extractHouseNumber(text: string) {
  return text.match(/^\s*(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)/)?.[1] || "";
}

function extractZip(text: string) {
  const normalized = String(text || "").trim();
  const matches: RegExpExecArray[] = [];
  const zipRegex = /\b\d{5}(?:-\d{4})?\b/g;
  let nextMatch = zipRegex.exec(normalized);
  while (nextMatch) {
    matches.push(nextMatch);
    nextMatch = zipRegex.exec(normalized);
  }
  if (!matches.length) return "";

  for (let idx = matches.length - 1; idx >= 0; idx -= 1) {
    const match = matches[idx];
    const zip = match[0];
    const matchIndex = typeof match.index === "number" ? match.index : 0;
    const before = normalized.slice(Math.max(0, matchIndex - 24), matchIndex).trim();
    if (/\b[A-Z]{2}\s*$/i.test(before) || /(pennsylvania|new jersey|delaware|maryland)\s*$/i.test(before)) {
      return zip;
    }
  }

  const last = matches[matches.length - 1];
  const lastIndex = typeof last.index === "number" ? last.index : 0;
  if (lastIndex > 0 && normalized.endsWith(last[0])) {
    return last[0];
  }

  return "";
}

function looksLikeCompleteAddress(text: string) {
  return Boolean(
    extractHouseNumber(text) &&
      /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|pl|place|pike|way|ter|terrace)\b/i.test(
        text
      ) &&
      (extractZip(text) || /\b[A-Z]{2}\b/.test(text))
  );
}

function responseSuggestion(item: Suggestion): Suggestion {
  return {
    id: item.id,
    label: cleanLabel(item.label),
    placeTypes: Array.isArray(item.placeTypes) ? item.placeTypes.filter(Boolean) : undefined
  };
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function geoapifySuggestions(text: string): Promise<Suggestion[]> {
  if (!geoapifyKey) return [];
  const url =
    "https://api.geoapify.com/v1/geocode/autocomplete?" +
    new URLSearchParams({
      text,
      format: "json",
      limit: "8",
      filter: "countrycode:us",
      bias: "proximity:-75.1652,39.9526",
      apiKey: geoapifyKey
    });

  const data = await fetchJson(url);
  if (!Array.isArray(data?.results)) return [];

  return data.results
    .map((item: any) => {
      const placeTypes = [
        ...(Array.isArray(item?.category) ? item.category : item?.category ? [item.category] : []),
        item?.result_type,
        item?.address_line1 ? "street_address" : ""
      ].filter(Boolean);

      return responseSuggestion({
        id: String(item.place_id || item.osm_id || item.formatted || item.address_line1 || ""),
        label: item.formatted || [item.address_line1, item.address_line2].filter(Boolean).join(", "),
        placeTypes
      });
    })
    .filter((item: Suggestion) => item.id && item.label);
}

function formatPhotonFeature(feature: any, text: string): Suggestion | null {
  const props = feature?.properties || {};
  const canCarryTypedHouseNumber = props.type === "street" || props.osm_key === "highway";
  const houseNumber = props.housenumber || (canCarryTypedHouseNumber ? extractHouseNumber(text) : "");
  const road = props.street || props.name || "";
  const city = cleanCity(props.city || props.locality || props.district || props.county);
  const state = stateAbbr(props.state);
  const postcode = props.postcode || extractZip(text);
  const street = [houseNumber, road].filter(Boolean).join(" ");
  const label = cleanLabel([street || road, city, [state, postcode].filter(Boolean).join(" ")].filter(Boolean).join(", "));
  if (!label) return null;

  return responseSuggestion({
    id: `photon:${props.osm_type || ""}:${props.osm_id || label}`,
    label,
    placeTypes: [props.osm_key, props.osm_value, props.type].filter(Boolean)
  });
}

async function photonSuggestions(text: string): Promise<Suggestion[]> {
  const url =
    "https://photon.komoot.io/api/?" +
    new URLSearchParams({
      q: text,
      limit: "8",
      lat: "39.9526",
      lon: "-75.1652",
      lang: "en"
    });

  const data = await fetchJson(url);
  if (!Array.isArray(data?.features)) return [];
  const requested = requestedState(text);
  const zip = extractZip(text).slice(0, 5);
  return data.features
    .filter((feature: any) => !requested || stateAbbr(feature?.properties?.state) === requested)
    .filter((feature: any) => !zip || !feature?.properties?.postcode || String(feature.properties.postcode).slice(0, 5) === zip)
    .map((feature: any) => formatPhotonFeature(feature, text))
    .filter(Boolean) as Suggestion[];
}

function formatNominatimRow(row: any, text: string): Suggestion | null {
  const address = row?.address || {};
  const road =
    address.road ||
    address.pedestrian ||
    address.footway ||
    address.path ||
    address.cycleway ||
    row?.name ||
    "";
  const houseNumber = address.house_number || extractHouseNumber(text);
  const city = cleanCity(address.city || address.town || address.village || address.hamlet || address.municipality || address.county);
  const isoState = address["ISO3166-2-lvl4"];
  const state = stateAbbr(isoState || address.state);
  const postcode = address.postcode || extractZip(text);
  const street = [houseNumber, road].filter(Boolean).join(" ");
  const compact = [street || row?.name, city, [state, postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const label = cleanLabel(compact || row?.display_name);
  if (!label) return null;

  return responseSuggestion({
    id: `osm:${row?.place_id || row?.osm_id || label}`,
    label,
    placeTypes: [row?.class, row?.type, row?.addresstype].filter(Boolean)
  });
}

async function nominatimSuggestions(text: string, bounded: boolean): Promise<Suggestion[]> {
  const params: Record<string, string> = {
    format: "json",
    addressdetails: "1",
    limit: "8",
    countrycodes: "us",
    q: text
  };
  if (bounded) {
    params.viewbox = PHILLY_VIEWBOX;
    params.bounded = "1";
  }

  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams(params);
  const data = await fetchJson(
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_USER_AGENT
      }
    },
    5500
  );
  if (!Array.isArray(data)) return [];
  const requested = requestedState(text);
  const zip = extractZip(text).slice(0, 5);
  return data
    .filter((row: any) => !requested || stateAbbr(row?.address?.["ISO3166-2-lvl4"] || row?.address?.state) === requested)
    .filter((row: any) => !zip || !row?.address?.postcode || String(row.address.postcode).slice(0, 5) === zip)
    .map((row: any) => formatNominatimRow(row, text))
    .filter(Boolean) as Suggestion[];
}

function typedFallback(text: string): Suggestion {
  return responseSuggestion({
    id: `typed:${cleanLabel(text).toLowerCase()}`,
    label: cleanLabel(text),
    placeTypes: ["street_address"]
  });
}

function mergeSuggestions(text: string, groups: Suggestion[][]) {
  const merged: Suggestion[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const item of group) {
      const suggestion = responseSuggestion(item);
      const key = suggestion.label.toLowerCase();
      if (!suggestion.label || seen.has(key)) continue;
      seen.add(key);
      merged.push(suggestion);
      if (merged.length >= 6) return merged;
    }
  }

  if (!merged.length && text.length >= 5) {
    merged.push(typedFallback(text));
  } else if (looksLikeCompleteAddress(text) && merged.length < 6) {
    const fallback = typedFallback(text);
    if (!seen.has(fallback.label.toLowerCase())) {
      merged.push(fallback);
    }
  }

  return merged.slice(0, 6);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = cleanLabel(body?.text || body?.query || body?.address || "");
    if (!text || text.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const geoapify = await geoapifySuggestions(text);
    const preferExactAddressSearch = looksLikeCompleteAddress(text);
    const boundedNominatim =
      preferExactAddressSearch && geoapify.length < 4 ? await nominatimSuggestions(text, true) : [];
    const photon =
      geoapify.length + boundedNominatim.length >= 4 ? [] : await photonSuggestions(text);
    const openNominatim =
      geoapify.length + photon.length + boundedNominatim.length >= 4 ? [] : await nominatimSuggestions(text, false);

    return NextResponse.json({
      results: preferExactAddressSearch
        ? mergeSuggestions(text, [geoapify, boundedNominatim, openNominatim, photon])
        : mergeSuggestions(text, [geoapify, photon, boundedNominatim, openNominatim])
    });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
