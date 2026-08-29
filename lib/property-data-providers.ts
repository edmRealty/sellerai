type PropertyType = "residential" | "commercial" | "industrial";

export type TrustedPropertyDetails = {
  propertyType?: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  features?: string[];
  units?: number;
};

export type PropertySourceResult = {
  source: string;
  status: "available" | "not_found" | "unconfigured" | "unavailable";
  details?: TrustedPropertyDetails;
  identifiers?: Record<string, string>;
  permitSummary?: {
    count: number;
    recent: Array<{ description?: string; date?: string; status?: string }>;
  };
};

export type PropertyEnrichment = {
  details: TrustedPropertyDetails;
  sources: PropertySourceResult[];
};

type AddressParts = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
};

const timeoutMs = Number(process.env.PROPERTY_DATA_TIMEOUT_MS) || 8_000;

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function parseAddress(address: string): AddressParts {
  const commaParts = address.split(",").map((part) => part.trim()).filter(Boolean);
  let stateIndex = -1;
  for (let index = commaParts.length - 1; index >= 0; index -= 1) {
    if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(commaParts[index])) {
      stateIndex = index;
      break;
    }
  }
  const stateZip = stateIndex >= 0
    ? commaParts[stateIndex].match(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/i)
    : null;
  return {
    street: commaParts[0] || address,
    city: stateIndex > 0 ? commaParts[stateIndex - 1] : "",
    state: stateZip?.[1]?.toUpperCase() || "",
    postalCode: stateZip?.[2] || ""
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function inferPropertyType(value: unknown, residential?: boolean): PropertyType | undefined {
  const text = String(value || "").toLowerCase();
  if (residential === true || /single|condo|town|residential|apartment|multi-family/.test(text)) return "residential";
  if (/warehouse|industrial|manufactur/.test(text)) return "industrial";
  if (/commercial|office|retail|hospitality|hotel/.test(text)) return "commercial";
  return undefined;
}

function rentCastFeatures(record: any) {
  const features: string[] = [];
  const add = (condition: boolean, label: string) => {
    if (condition && !features.includes(label)) features.push(label);
  };
  add(Boolean(record?.features?.garage || record?.garage || record?.garageSpaces), "Attached garage");
  add(Boolean(record?.features?.pool || record?.pool || record?.poolType), "Pool");
  add(/central/i.test(String(record?.features?.cooling || record?.cooling || "")), "Central air");
  add(Boolean(record?.features?.fireplace || record?.fireplace), "Fireplace");
  return features;
}

async function fetchRentCast(address: string): Promise<PropertySourceResult> {
  const apiKey = process.env.RENTCAST_API_KEY || "";
  if (!apiKey) return { source: "RentCast", status: "unconfigured" };
  try {
    const baseUrl = (process.env.RENTCAST_API_BASE_URL || "https://api.rentcast.io/v1").replace(/\/$/, "");
    const params = new URLSearchParams({ address, limit: "1" });
    const response = await fetchWithTimeout(`${baseUrl}/properties?${params}`, {
      headers: { Accept: "application/json", "X-Api-Key": apiKey }
    });
    if (!response.ok) return { source: "RentCast", status: "unavailable" };
    const payload = await response.json();
    const record = Array.isArray(payload) ? payload[0] : payload?.properties?.[0] || payload?.data?.[0];
    if (!record) return { source: "RentCast", status: "not_found" };
    return {
      source: "RentCast",
      status: "available",
      details: {
        propertyType: inferPropertyType(record.propertyType),
        bedrooms: positiveNumber(record.bedrooms),
        bathrooms: positiveNumber(record.bathrooms),
        squareFeet: positiveNumber(record.squareFootage || record.livingArea || record.buildingArea),
        yearBuilt: positiveNumber(record.yearBuilt),
        features: rentCastFeatures(record)
      },
      identifiers: record.id ? { rentcastId: String(record.id) } : undefined
    };
  } catch {
    return { source: "RentCast", status: "unavailable" };
  }
}

async function fetchRealie(address: string, parts: AddressParts): Promise<PropertySourceResult> {
  const apiKey = process.env.REALIE_API_KEY || "";
  if (!apiKey) return { source: "Realie", status: "unconfigured" };
  if (!parts.state || !parts.street) return { source: "Realie", status: "not_found" };
  try {
    const baseUrl = (process.env.REALIE_API_BASE_URL || "https://app.realie.ai/api").replace(/\/$/, "");
    const params = new URLSearchParams({ state: parts.state, address: parts.street });
    const response = await fetchWithTimeout(`${baseUrl}/public/property/address/?${params}`, {
      headers: { Accept: "application/json", Authorization: apiKey }
    });
    if (!response.ok) return { source: "Realie", status: "unavailable" };
    const payload = await response.json();
    const record = payload?.property || payload?.data?.[0] || payload?.properties?.[0];
    if (!record) return { source: "Realie", status: "not_found" };
    const features = [
      record.garage ? "Attached garage" : "",
      record.pool ? "Pool" : "",
      record.fireplace ? "Fireplace" : ""
    ].filter(Boolean);
    return {
      source: "Realie",
      status: "available",
      details: {
        propertyType: inferPropertyType(record.useCode, record.residential),
        bedrooms: positiveNumber(record.totalBedrooms),
        bathrooms: positiveNumber(record.totalBathrooms),
        squareFeet: positiveNumber(record.buildingArea),
        yearBuilt: positiveNumber(record.yearBuilt),
        units: positiveNumber(record.unitCount),
        features
      },
      identifiers: {
        ...(record.parcelId ? { parcelId: String(record.parcelId) } : {}),
        ...(record.siteId ? { realieSiteId: String(record.siteId) } : {})
      }
    };
  } catch {
    return { source: "Realie", status: "unavailable" };
  }
}

async function fetchPlacekey(parts: AddressParts, lat?: number, lon?: number): Promise<PropertySourceResult> {
  const apiKey = process.env.PLACEKEY_API_KEY || "";
  if (!apiKey) return { source: "Placekey", status: "unconfigured" };
  if ((!parts.street || !parts.state) && (!lat || !lon)) return { source: "Placekey", status: "not_found" };
  try {
    const response = await fetchWithTimeout(process.env.PLACEKEY_API_URL || "https://api.placekey.io/v1/placekey", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        query: {
          street_address: parts.street || undefined,
          city: parts.city || undefined,
          region: parts.state || undefined,
          postal_code: parts.postalCode || undefined,
          iso_country_code: "US",
          latitude: lat,
          longitude: lon
        },
        options: { fields: ["address_placekey", "building_placekey", "confidence_score", "normalized_address", "parcel", "upi"] }
      })
    });
    if (!response.ok) return { source: "Placekey", status: "unavailable" };
    const payload = await response.json();
    if (!payload?.placekey) return { source: "Placekey", status: "not_found" };
    return {
      source: "Placekey",
      status: "available",
      identifiers: {
        placekey: String(payload.placekey),
        ...(payload.address_placekey ? { addressPlacekey: String(payload.address_placekey) } : {}),
        ...(payload.building_placekey ? { buildingPlacekey: String(payload.building_placekey) } : {}),
        ...(payload.parcel ? { parcelId: String(payload.parcel) } : {}),
        ...(payload.upi ? { upi: String(payload.upi) } : {})
      }
    };
  } catch {
    return { source: "Placekey", status: "unavailable" };
  }
}

async function fetchShovels(address: string): Promise<PropertySourceResult> {
  const apiKey = process.env.SHOVELS_API_KEY || "";
  if (!apiKey) return { source: "Shovels", status: "unconfigured" };
  try {
    const baseUrl = (process.env.SHOVELS_API_BASE_URL || "https://api.shovels.ai/v2").replace(/\/$/, "");
    const addressResponse = await fetchWithTimeout(`${baseUrl}/addresses/search?${new URLSearchParams({ address, size: "1" })}`, {
      headers: { Accept: "application/json", "X-API-Key": apiKey }
    });
    if (!addressResponse.ok) return { source: "Shovels", status: "unavailable" };
    const addressPayload = await addressResponse.json();
    const match = addressPayload?.items?.[0];
    const geoId = match?.geo_id || match?.id;
    if (!geoId) return { source: "Shovels", status: "not_found" };
    const from = new Date();
    from.setFullYear(from.getFullYear() - 15);
    const params = new URLSearchParams({
      geo_id: String(geoId),
      permit_from: from.toISOString().slice(0, 10),
      permit_to: new Date().toISOString().slice(0, 10),
      size: "10"
    });
    const permitsResponse = await fetchWithTimeout(`${baseUrl}/permits/search?${params}`, {
      headers: { Accept: "application/json", "X-API-Key": apiKey }
    });
    if (!permitsResponse.ok) return { source: "Shovels", status: "unavailable" };
    const permitsPayload = await permitsResponse.json();
    const permits = Array.isArray(permitsPayload?.items) ? permitsPayload.items : [];
    const property = permits[0] || {};
    return {
      source: "Shovels",
      status: permits.length ? "available" : "not_found",
      details: permits.length ? {
        propertyType: inferPropertyType(property.property_type),
        squareFeet: positiveNumber(property.property_building_area),
        yearBuilt: positiveNumber(property.property_year_built),
        units: positiveNumber(property.property_unit_count)
      } : undefined,
      identifiers: { shovelsGeoId: String(geoId) },
      permitSummary: {
        count: permits.length,
        recent: permits.slice(0, 5).map((permit: any) => ({
          description: permit.description || permit.type,
          date: permit.file_date || permit.start_date || permit.end_date,
          status: permit.status
        }))
      }
    };
  } catch {
    return { source: "Shovels", status: "unavailable" };
  }
}

export async function enrichPropertyFromTrustedSources(address: string, lat?: number, lon?: number): Promise<PropertyEnrichment> {
  const parts = parseAddress(address);
  const sources = await Promise.all([
    fetchRentCast(address),
    fetchRealie(address, parts),
    fetchPlacekey(parts, lat, lon),
    fetchShovels(address)
  ]);
  const details = sources.reduce<TrustedPropertyDetails>((merged, source) => {
    if (source.status !== "available" || !source.details) return merged;
    const features = Array.from(new Set([...(merged.features || []), ...(source.details.features || [])]));
    return {
      propertyType: merged.propertyType || source.details.propertyType,
      bedrooms: merged.bedrooms || source.details.bedrooms,
      bathrooms: merged.bathrooms || source.details.bathrooms,
      squareFeet: merged.squareFeet || source.details.squareFeet,
      yearBuilt: merged.yearBuilt || source.details.yearBuilt,
      units: merged.units || source.details.units,
      features
    };
  }, {});
  return { details, sources };
}
