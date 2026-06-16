import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RateLimitError, getCache, getClientId, guardRateLimit, hashString, setCache, withInFlight } from "@/lib/api-safety";
import {
  MAINTENANCE_MESSAGE,
  isAiServiceDownError,
  isMaintenanceError,
  notifyAndThrowMaintenance
} from "@/lib/ai-service-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const openaiApiKey = process.env.OPENAI_API_KEY || "";
const manusApiKey = process.env.MANUS_API_KEY || "";
const manusBaseUrl = process.env.MANUS_API_BASE_URL || "";
const manusApiUrl =
  process.env.MANUS_API_URL ||
  (manusBaseUrl ? `${manusBaseUrl.replace(/\/$/, "")}/chat/completions` : "");
const manusModel = process.env.MANUS_MODEL || "manus-1";
const manusLiteModel = process.env.MANUS_LITE_MODEL || manusModel;
const grokApiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || "";
const grokApiUrl = process.env.XAI_API_URL || process.env.GROK_API_URL || "https://api.x.ai/v1/chat/completions";
const grokModel = process.env.XAI_MODEL || process.env.GROK_MODEL || "";
const geoapifyKey = process.env.GEOAPIFY_API_KEY || "";
const CENSUS_API_KEY = process.env.CENSUS_API_KEY || "";
const MAPILLARY_ACCESS_TOKEN = process.env.MAPILLARY_ACCESS_TOKEN || "";
const AI_FREE_MODE = String(process.env.AI_FREE_MODE || "").toLowerCase() === "true";
const RATE_WINDOW_MS = Number(process.env.AI_RATE_WINDOW_MS) || 60_000;
const RATE_BLOCK_MS = Number(process.env.AI_RATE_BLOCK_MS) || 5 * 60_000;
const PROPERTY_MAX = Number(process.env.AI_PROPERTY_MAX_CALLS) || 10;
const OPENAI_MAX = Number(process.env.AI_OPENAI_MAX_CALLS) || 6;
const GEMINI_MAX = Number(process.env.AI_GEMINI_MAX_CALLS) || 6;
const MANUS_MAX = Number(process.env.AI_MANUS_MAX_CALLS) || 6;
const CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const PROPERTY_CACHE_VERSION = "v3-no-fake-facts";

const FEATURE_OPTIONS = [
  "Backyard",
  "Finished basement",
  "Central air",
  "Attached garage",
  "Detached garage",
  "Driveway / Parking",
  "Deck",
  "Patio / Porch",
  "Fireplace",
  "Walk-in closets",
  "Laundry room (in-unit)",
  "Pool",
  "Hot tub / spa",
  "Sunroom",
  "Mudroom",
  "Shed",
  "Smart home features",
  "Gated community",
  "EV Car Charger",
  "Solar panels"
];

const FEATURE_SET = new Set(FEATURE_OPTIONS.map((f) => f.toLowerCase()));

const COMMERCIAL_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "store",
  "shopping_mall",
  "restaurant",
  "food",
  "cafe",
  "bar",
  "night_club",
  "office",
  "real_estate_agency",
  "school",
  "university",
  "hospital",
  "doctor",
  "bank",
  "gym",
  "spa",
  "lodging",
  "car_dealer",
  "car_repair",
  "insurance_agency",
  "pharmacy",
  "warehouse",
  "storage",
  "storage_facility",
  "industrial"
]);

const RESIDENTIAL_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route"
]);

const INDUSTRIAL_TYPES = new Set([
  "industrial",
  "warehouse",
  "storage",
  "storage_facility",
  "factory"
]);

type PropertyDetails = {
  propertyType: "residential" | "commercial" | "industrial";
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  yearBuilt: number;
  condition: "new" | "great" | "good" | "fair" | "fixer" | "rehab";
  features: string[];
  useType?: "retail" | "office" | "industrial" | "mixed" | "flex" | "medical" | "hospitality";
  units?: number;
  occupancy?: "owner-occupied" | "leased" | "vacant";
  leaseType?: "nnn" | "gross" | "modified" | "n/a";
  clearHeight?: number;
  dockDoors?: number;
};

type PropertyPhoto = {
  url: string;
  source: string;
  caption: string;
  capturedAt?: string;
};

const DEFAULT_DETAILS: PropertyDetails = {
  propertyType: "residential",
  bedrooms: 0,
  bathrooms: 0,
  squareFeet: 0,
  yearBuilt: 0,
  condition: "good",
  features: [],
  useType: "retail",
  units: 1,
  occupancy: "owner-occupied",
  leaseType: "n/a",
  clearHeight: 0,
  dockDoors: 0
};

function fallbackDetails(address: string, placeTypes: string[] = []): PropertyDetails {
  const normalized = (address || "").toLowerCase();
  const placeCommercial = placeTypes.length
    ? placeTypes.some((t) => COMMERCIAL_TYPES.has(t.toLowerCase()))
    : false;
  const placeIndustrial = placeTypes.length
    ? placeTypes.some((t) => INDUSTRIAL_TYPES.has(t.toLowerCase()))
    : false;
  const placeResidential = placeTypes.length
    ? placeTypes.some((t) => RESIDENTIAL_TYPES.has(t.toLowerCase()))
    : false;
  const keywordCommercial =
    normalized.includes("suite") ||
    normalized.includes("office") ||
    normalized.includes("retail") ||
    normalized.includes("plaza");
  const keywordIndustrial =
    normalized.includes("warehouse") ||
    normalized.includes("industrial") ||
    normalized.includes("distribution");
  const isIndustrial = placeIndustrial || keywordIndustrial;
  const isCommercial = !isIndustrial && (placeCommercial || (!placeResidential && keywordCommercial));

  return {
    propertyType: isIndustrial ? "industrial" : isCommercial ? "commercial" : "residential",
    yearBuilt: 0,
    squareFeet: 0,
    bedrooms: 0,
    bathrooms: 0,
    condition: "good",
    features: [],
    useType: isIndustrial ? "industrial" : "retail",
    units: isCommercial || isIndustrial ? 1 : 1,
    occupancy: isCommercial || isIndustrial ? "vacant" : "owner-occupied",
    leaseType: "n/a",
    clearHeight: 0,
    dockDoors: 0
  };
}

function safeNumber(value: any, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeWholeNumber(value: any, fallback: number) {
  const num = safeNumber(value, fallback);
  return Math.max(0, Math.floor(num));
}

function normalizeHalfNumber(value: any, fallback: number) {
  const num = safeNumber(value, fallback);
  const rounded = Math.round(num * 2) / 2;
  return Math.max(0, rounded);
}

function normalizeDetails(raw: any, fallback: PropertyDetails): PropertyDetails {
  const condition = String(raw?.condition || fallback.condition).toLowerCase() as PropertyDetails["condition"];
  const validCondition: PropertyDetails["condition"] =
    ["new", "great", "good", "fair", "fixer", "rehab"].includes(condition) ? condition : fallback.condition;

  const rawFeatures = Array.isArray(raw?.features) ? raw.features : [];
  const normalizedFeatures = rawFeatures
    .map((f: any) => String(f || "").trim())
    .filter((f: string) => FEATURE_SET.has(f.toLowerCase()));

  let propertyType: PropertyDetails["propertyType"] = "residential";
  if (raw?.propertyType === "industrial") propertyType = "industrial";
  if (raw?.propertyType === "commercial") propertyType = "commercial";

  return {
    propertyType,
    bedrooms: fallback.bedrooms,
    bathrooms: fallback.bathrooms,
    squareFeet: fallback.squareFeet,
    yearBuilt: fallback.yearBuilt,
    condition: validCondition,
    features: normalizedFeatures.length ? normalizedFeatures : fallback.features,
    useType: raw?.useType || fallback.useType,
    units: safeNumber(raw?.units, fallback.units || 1),
    occupancy: raw?.occupancy || fallback.occupancy,
    leaseType: raw?.leaseType || fallback.leaseType,
    clearHeight: safeNumber(raw?.clearHeight, fallback.clearHeight || 0),
    dockDoors: safeNumber(raw?.dockDoors, fallback.dockDoors || 0)
  };
}

function extractJson(text: string) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : text;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function fetchJson(url: string, params: Record<string, string>, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const query = new URLSearchParams(params);
  const res = await fetch(`${url}?${query.toString()}`, { signal: controller.signal });
  clearTimeout(timer);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

async function geocodeAddress(address: string) {
  if (!geoapifyKey) return null;
  const url =
    "https://api.geoapify.com/v1/geocode/search?" +
    new URLSearchParams({
      text: address,
      format: "json",
      limit: "1",
      filter: "countrycode:us",
      apiKey: geoapifyKey
    });
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.results?.length) return null;
  const top = data.results[0];
  return {
    formattedAddress: top.formatted || address,
    types: Array.isArray(top?.category) ? top.category : top?.category ? [top.category] : undefined,
    lat: typeof top?.lat === "number" ? top.lat : undefined,
    lon: typeof top?.lon === "number" ? top.lon : undefined
  };
}

async function censusGeocodeAddress(address: string) {
  try {
    const data = await fetchJson(
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
      {
        address,
        benchmark: "Public_AR_Current",
        format: "json"
      }
    );
    const match = data?.result?.addressMatches?.[0];
    const coords = match?.coordinates;
    if (!coords) return null;
    return {
      lat: typeof coords?.y === "number" ? coords.y : undefined,
      lon: typeof coords?.x === "number" ? coords.x : undefined
    };
  } catch {
    return null;
  }
}

async function censusGeographies(lat: number, lon: number) {
  const data = await fetchJson(
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates",
    {
      x: String(lon),
      y: String(lat),
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      format: "json"
    }
  );
  const geos = data?.result?.geographies || {};
  const tract = (geos["Census Tracts"] || [])[0] || {};
  const county = (geos["Counties"] || [])[0] || {};
  const state = (geos["States"] || [])[0] || {};
  return {
    stateFips: tract.STATE || county.STATE || state.STATE,
    countyFips: tract.COUNTY || county.COUNTY,
    tractCode: tract.TRACT,
    stateName: state.NAME,
    countyName: county.NAME,
    tractName: tract.NAME
  };
}

async function censusAcsTract(stateFips: string, countyFips: string, tractCode: string) {
  const fields = [
    "B19013_001E",
    "B25077_001E",
    "B25064_001E",
    "B25003_002E",
    "B25003_003E",
    "B23025_004E",
    "B23025_005E"
  ];
  const params: Record<string, string> = {
    get: fields.join(","),
    for: `tract:${tractCode}`,
    in: `state:${stateFips}+county:${countyFips}`
  };
  if (CENSUS_API_KEY) {
    params.key = CENSUS_API_KEY;
  }
  const data = await fetchJson("https://api.census.gov/data/2022/acs/acs5", params);
  if (!Array.isArray(data) || data.length < 2) return null;
  const header = data[0];
  const row = data[1];
  const record: Record<string, string> = {};
  header.forEach((key: string, idx: number) => {
    record[key] = row[idx];
  });
  return {
    median_household_income: Number(record.B19013_001E) || null,
    median_home_value: Number(record.B25077_001E) || null,
    median_gross_rent: Number(record.B25064_001E) || null,
    owner_occupied: Number(record.B25003_002E) || null,
    renter_occupied: Number(record.B25003_003E) || null,
    employed: Number(record.B23025_004E) || null,
    unemployed: Number(record.B23025_005E) || null
  };
}

async function buildCensusSnapshot(address: string, lat?: number, lon?: number) {
  try {
    let coords = lat && lon ? { lat, lon } : null;
    if (!coords) {
      coords = await censusGeocodeAddress(address);
    }
    if (!coords?.lat || !coords?.lon) return null;
    const geos = await censusGeographies(coords.lat, coords.lon);
    if (!geos?.stateFips || !geos?.countyFips || !geos?.tractCode) {
      return { ...geos };
    }
    const acs = await censusAcsTract(geos.stateFips, geos.countyFips, geos.tractCode);
    return { ...geos, acs };
  } catch {
    return null;
  }
}

async function fetchMapillaryPhoto(lat?: number, lon?: number): Promise<PropertyPhoto | null> {
  if (!MAPILLARY_ACCESS_TOKEN || typeof lat !== "number" || typeof lon !== "number") return null;
  try {
    const data = await fetchJson(
      "https://graph.mapillary.com/images",
      {
        access_token: MAPILLARY_ACCESS_TOKEN,
        fields: "id,thumb_1024_url,thumb_2048_url,captured_at",
        closeto: `${lon},${lat}`,
        limit: "1"
      },
      6500
    );
    const image = Array.isArray(data?.data) ? data.data[0] : null;
    const url = image?.thumb_1024_url || image?.thumb_2048_url;
    if (!url) return null;
    return {
      url,
      source: "Mapillary",
      caption: "Nearby street-level photo",
      capturedAt: image?.captured_at ? new Date(image.captured_at).toISOString() : undefined
    };
  } catch {
    return null;
  }
}

async function fetchManusPropertyDetails(prompt: string, clientId?: string) {
  if (!manusApiKey || !manusApiUrl) return null;
  try {
    if (clientId) {
      guardRateLimit({
        bucket: "manus",
        id: clientId,
        maxCalls: MANUS_MAX,
        windowMs: RATE_WINDOW_MS,
        blockMs: RATE_BLOCK_MS
      });
    }
    const response = await fetch(manusApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${manusApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: manusLiteModel,
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON matching the schema. Be fast and concise." },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content ||
      data?.output ||
      data?.content ||
      "";
    return extractJson(content);
  } catch (error) {
    console.error("Manus lite property lookup failed:", error);
    if (isAiServiceDownError(error)) {
      await notifyAndThrowMaintenance({
        provider: "Manus",
        route: "POST /api/property",
        error
      });
    }
    return null;
  }
}

async function fetchGrokPropertyDetails(prompt: string) {
  if (!grokApiKey || !grokModel) return null;
  try {
    const response = await fetch(grokApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${grokApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: grokModel,
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON matching the schema. Be fast and concise." },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || data?.output || data?.content || "";
    return extractJson(content);
  } catch (error) {
    console.error("Grok property lookup failed:", error);
    if (isAiServiceDownError(error)) {
      await notifyAndThrowMaintenance({
        provider: "Grok",
        route: "POST /api/property",
        error
      });
    }
    return null;
  }
}

async function fetchDetailsFromAI(address: string, placeTypes: string[] = [], clientId?: string) {
  const prompt = `
You are a real estate property intelligence assistant. Quickly answer:
What type of property is this, and what are its basic value-relevant features?

Property:
"${address}"

Google Place types (if available):
${placeTypes.length ? placeTypes.join(", ") : "N/A"}

Use public property signals, parcel/listing context, street-level clues, and the address pattern when available.
Do not invent measurements, bedrooms, bathrooms, year built, or features.
If a fact is not found from a credible source, return 0 for numeric fields and [] for features.
Do not invent luxury features. Prefer a small accurate feature list over a long speculative one.
Return ONLY JSON in this schema:
{
  "propertyType": "residential" | "commercial" | "industrial",
  "bedrooms": number,
  "bathrooms": number,
  "squareFeet": number,
  "yearBuilt": number,
  "condition": "new" | "great" | "good" | "fair" | "fixer" | "rehab",
  "features": string[],
  "useType": "retail" | "office" | "industrial" | "mixed" | "flex" | "medical" | "hospitality",
  "units": number,
  "occupancy": "owner-occupied" | "leased" | "vacant",
  "leaseType": "nnn" | "gross" | "modified" | "n/a",
  "clearHeight": number,
  "dockDoors": number
}

Use only these features if relevant:
${FEATURE_OPTIONS.map((f) => `"${f}"`).join(", ")}
`;

  const manusDetails = await fetchManusPropertyDetails(prompt, clientId);
  if (manusDetails) return manusDetails;

  const grokDetails = await fetchGrokPropertyDetails(prompt);
  if (grokDetails) return grokDetails;

  if (geminiApiKey) {
    try {
      if (clientId) {
        guardRateLimit({
          bucket: "gemini",
          id: clientId,
          maxCalls: GEMINI_MAX,
          windowMs: RATE_WINDOW_MS,
          blockMs: RATE_BLOCK_MS
        });
      }
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: geminiModel });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const json = extractJson(text);
      if (json) return json;
    } catch (error) {
      console.error("Gemini property lookup failed:", error);
      if (isAiServiceDownError(error)) {
        await notifyAndThrowMaintenance({
          provider: "Gemini",
          route: "POST /api/property",
          address,
          error
        });
      }
    }
  }

  if (openaiApiKey) {
    try {
      if (clientId) {
        guardRateLimit({
          bucket: "openai",
          id: clientId,
          maxCalls: OPENAI_MAX,
          windowMs: RATE_WINDOW_MS,
          blockMs: RATE_BLOCK_MS
        });
      }
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return only valid JSON matching the schema." },
            { role: "user", content: prompt }
          ]
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || "";
      return extractJson(content);
    } catch (error) {
      console.error("OpenAI property lookup failed:", error);
      if (isAiServiceDownError(error)) {
        await notifyAndThrowMaintenance({
          provider: "OpenAI",
          route: "POST /api/property",
          address,
          error
        });
      }
    }
  }

  return null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address = String(body?.address || "").trim();
  const placeTypes = Array.isArray(body?.placeTypes) ? body.placeTypes : [];
  if (!address) {
    return NextResponse.json({ error: "Address required." }, { status: 400 });
  }

  const clientId = getClientId(req);
  try {
    guardRateLimit({
      bucket: "property",
      id: clientId,
      maxCalls: PROPERTY_MAX,
      windowMs: RATE_WINDOW_MS,
      blockMs: RATE_BLOCK_MS
    });
  } catch (error) {
    const retryAfterMs = error instanceof RateLimitError ? error.retryAfterMs : RATE_BLOCK_MS;
    return NextResponse.json(
      { error: "Property lookup temporarily paused due to high usage. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const cacheKey = `property:${PROPERTY_CACHE_VERSION}:${hashString(`${address}:${placeTypes.join(",")}`)}`;
  const cached = getCache<any>(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  try {
    const payload = await withInFlight(cacheKey, async () => {
    const geocode = await geocodeAddress(address);
    const formattedAddress = geocode?.formattedAddress || address;
    const fallbackCoords =
      typeof geocode?.lat === "number" && typeof geocode?.lon === "number"
        ? null
        : await censusGeocodeAddress(formattedAddress);
    const coords = {
      lat: typeof geocode?.lat === "number" ? geocode.lat : fallbackCoords?.lat,
      lon: typeof geocode?.lon === "number" ? geocode.lon : fallbackCoords?.lon
    };
    const inferredTypes = [
      ...placeTypes,
      ...(Array.isArray(geocode?.types) ? geocode?.types : [])
    ].filter(Boolean);

    const [census, propertyPhoto] = await Promise.all([
      buildCensusSnapshot(formattedAddress, coords.lat, coords.lon),
      fetchMapillaryPhoto(coords.lat, coords.lon)
    ]);
    let aiDetails = null;
    if (!AI_FREE_MODE) {
      aiDetails = await fetchDetailsFromAI(formattedAddress, inferredTypes, clientId);
    }
    const fallback = fallbackDetails(formattedAddress, inferredTypes);
    const details = normalizeDetails(aiDetails, fallback);

    if (inferredTypes.length) {
      const placeIndustrial = inferredTypes.some((t: string) => INDUSTRIAL_TYPES.has(String(t).toLowerCase()));
      const placeCommercial = inferredTypes.some((t: string) => COMMERCIAL_TYPES.has(String(t).toLowerCase()));
      if (placeIndustrial) {
        details.propertyType = "industrial";
      } else if (placeCommercial && details.propertyType !== "industrial") {
        details.propertyType = "commercial";
      }
    }

    const responsePayload = {
      address: formattedAddress,
      details,
      census,
      propertyPhoto
    };
    setCache(cacheKey, responsePayload, CACHE_TTL_MS);
    return responsePayload;
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (isMaintenanceError(error)) {
      return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 });
    }
    console.error("Property lookup failed:", error);
    return NextResponse.json({ error: "Property lookup failed. Please retry shortly." }, { status: 500 });
  }
}
