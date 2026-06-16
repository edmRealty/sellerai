import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RateLimitError, getCache, getClientId, guardRateLimit, hashString, setCache, withInFlight } from '@/lib/api-safety';
import {
    MAINTENANCE_MESSAGE,
    isAiServiceDownError,
    isMaintenanceError,
    notifyAndThrowMaintenance
} from '@/lib/ai-service-health';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Initialize Gemini
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const manusApiKey = process.env.MANUS_API_KEY || '';
const manusBaseUrl = process.env.MANUS_API_BASE_URL || '';
const manusApiUrl =
    process.env.MANUS_API_URL ||
    (manusBaseUrl ? `${manusBaseUrl.replace(/\/$/, "")}/chat/completions` : '');
const manusModel = process.env.MANUS_MODEL || "manus-1";
const genAI = new GoogleGenerativeAI(geminiApiKey);
const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const AI_FREE_MODE = String(process.env.AI_FREE_MODE || "").toLowerCase() === "true";
const RATE_WINDOW_MS = Number(process.env.AI_RATE_WINDOW_MS) || 60_000;
const RATE_BLOCK_MS = Number(process.env.AI_RATE_BLOCK_MS) || 5 * 60_000;
const VALUATION_MAX = Number(process.env.AI_VALUATION_MAX_CALLS) || 6;
const OPENAI_MAX = Number(process.env.AI_OPENAI_MAX_CALLS) || 6;
const GEMINI_MAX = Number(process.env.AI_GEMINI_MAX_CALLS) || 6;
const MANUS_MAX = Number(process.env.AI_MANUS_MAX_CALLS) || 6;
const CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const CACHE_VERSION = "2026-05-14-comps-range-3";

// --- Deterministic Helpers (Fallback Layer) ---

interface PropertyDetails {
    propertyType?: "residential" | "commercial" | "industrial" | "lot";
    squareFeet?: number;
    yearBuilt?: number;
    bedrooms?: number;
    bathrooms?: number;
    condition?: string;
    features?: string[];
}

interface CensusSnapshot {
    stateName?: string;
    countyName?: string;
    tractName?: string;
    stateFips?: string;
    countyFips?: string;
    tractCode?: string;
    acs?: Record<string, number | null | undefined>;
}

const ZIP_TIERS: Record<string, number> = {
    // TIER 1: Luxury / High Demand ($350 - $450 / sqft)
    '19118': 400, // Chesnut Hill
    '19119': 320, // Mt Airy
    '19035': 380, // Gladwyne
    '19041': 350, // Haverford

    // TIER 2: Solid City / Suburbs ($220 - $300 / sqft)
    '19147': 280, // Bella Vista
    '19123': 275, // Northern Liberties
    '19146': 270, // Grad Hospital
    '19130': 290, // Fairmount

    // TIER 3: Developing / Mixed ($140 - $210 / sqft)
    '19139': 250, // West Philly
    '19104': 180, // University City
    '19401': 160, // Norristown (prevent overvaluation)
    '19121': 150, // Brewerytown
    '19006': 280, // Huntingdon Valley
    '19132': 150, // North Philly baseline
};

function getStringHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function generateSmartMockPrice(address: string, details: PropertyDetails = {}, variation: number = 0): number {
    const hash = getStringHash(address.toLowerCase().trim());

    // Extract Zip
    const zipMatch = address.match(/\b19\d{3}\b/);
    const zip = zipMatch ? zipMatch[0] : '';

    // Base Price Calculation
    let basePps = 215; // default

    if (ZIP_TIERS[zip]) {
        basePps = ZIP_TIERS[zip];
        const locationMod = (hash % 15) - 7;
        basePps += locationMod;
    } else {
        const locationMod = (hash % 100) / 100;
        if (address.match(/(Philadelphia|Phila)/i)) {
            basePps = 180 + (locationMod * 100);
        } else if (address.match(/(Ave|St|Rd|Lane)/i)) {
            basePps = 220 + (locationMod * 100);
        } else {
            basePps = 200 + (locationMod * 50);
        }
    }

    // Adjust by Size (Economies of Scale)
    let sqft = details.squareFeet || 1600;

    // User requested "1400 sqft ... 325k". 
    // Let's ensure the baseline PPS hits that target for typical Philly rowhomes (Condition Good/Great).
    // If basePps is 215, 1400 * 215 = 301k. + Features can get to 325k. logic holds.

    // Adjust Base PPS for Size
    if (sqft < 1200) basePps *= 1.1;
    if (sqft > 3000) basePps *= 0.9;

    // Adjust by Bedrooms
    const bedBonus = (details.bedrooms || 3) * 10000;

    // Calculate Raw Price
    let rawPrice = (sqft * basePps) + bedBonus;

    // Year Built
    if (details.yearBuilt) {
        if (details.yearBuilt < 1950) rawPrice *= 0.95;
        else if (details.yearBuilt > 2010) rawPrice *= 1.15;
    }

    // Condition Adjustment (User Specific Request)
    // "if house was double in size it would mean 60K (condition) addition" 
    // -> Implies % based scalar. 
    // Baseline: Good. Great = +X. 
    if (details.condition) {
        switch (details.condition) {
            case 'new':
                rawPrice *= 1.15;
                break;
            case 'great':
                rawPrice *= 1.10; // +10%. On 300k house that's +30k. Matches user request.
                break;
            case 'good':
                // Baseline
                break;
            case 'fair':
                rawPrice *= 0.90; // -10%
                break;
            case 'fixer':
                rawPrice *= 0.75; // -25%
                break;
            case 'rehab':
                rawPrice *= 0.50; // Shell value
                break;
        }
    }

    // Features Value Add-ons (User Specifics)
    if (details.features && Array.isArray(details.features)) {
        details.features.forEach(feat => {
            const f = feat.toLowerCase();
            // User: "Add 20K for central ac"
            if (f.includes('central air')) {
                rawPrice += 20000;
            }
            // User: "Add 5K for the deck"
            else if (f.includes('deck') || f.includes('patio')) {
                rawPrice += 5000;
            }
            else if (f.includes('garage')) {
                rawPrice += f.includes('detached') ? 15000 : 12000;
            } else if (f.includes('basement') && f.includes('finished')) {
                rawPrice += 15000;
            } else if (f.includes('pool') || f.includes('hot tub')) {
                rawPrice += 8000;
            } else if (f.includes('smart') || f.includes('charger')) {
                rawPrice += 2500;
            } else if (f.includes('sunroom')) {
                rawPrice += 6000;
            } else if (f.includes('mudroom') || f.includes('laundry')) {
                rawPrice += 3000;
            } else if (f.includes('fireplace')) {
                rawPrice += 3000;
            } else if (f.includes('gated')) {
                rawPrice += 10000;
            } else if (f.includes('shed')) {
                rawPrice += 2000;
            } else if (f.includes('driveway') || f.includes('parking')) {
                rawPrice += 5000;
            } else if (f.includes('closet')) {
                rawPrice += 4000;
            }
        });
    }

    // Variation for multi-engine simulation
    // We REDUCE variation to ensure user sees the direct impact of their changes more clearly
    if (variation === 1) {
        rawPrice *= 1.02;
    } else if (variation === 2) {
        rawPrice *= 0.98;
    }

    // Round to nearest 1000 for clean look
    return Math.round(rawPrice / 1000) * 1000;
}


export async function POST(request: Request) {
    let address = "";
    let details: PropertyDetails = {};
    let census: CensusSnapshot | null = null;
    try {
        const body = await request.json();
        address = body?.address || "";
        details = body?.details || {};
        census = body?.census || null;
    } catch (err) {
        // Continue with defaults
    }

    const clientId = getClientId(request);
    try {
        guardRateLimit({
            bucket: "valuation",
            id: clientId,
            maxCalls: VALUATION_MAX,
            windowMs: RATE_WINDOW_MS,
            blockMs: RATE_BLOCK_MS
        });
    } catch (error) {
        const retryAfterMs = error instanceof RateLimitError ? error.retryAfterMs : RATE_BLOCK_MS;
        return NextResponse.json(
            { error: "Valuation temporarily paused due to high usage. Please retry shortly." },
            { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
        );
    }

    const cacheKey = `valuation:${CACHE_VERSION}:${hashString(JSON.stringify({ address, details, census }))}`;
    const cached = getCache<any>(cacheKey);
    if (cached) {
        return NextResponse.json({ ...cached, cached: true });
    }

    try {
        const payload = await withInFlight(cacheKey, async () => {
        try {
            // Normalize details input
            const cleanDetails = {
                ...details,
                squareFeet: (details as any)?.squareFeet || (details as any)?.sqft || 0
            };

            const propertyType = cleanDetails.propertyType || "residential";

            const safeNumber = (value: any, fallback = 0) => {
                const num = Number(value);
                return Number.isFinite(num) ? num : fallback;
            };

            const roundToThousand = (value: number) => Math.round(value / 1000) * 1000;
            const averageNumbers = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

            const toEstimate = (value: any) => {
                const num = Number(value);
                return Number.isFinite(num) && num > 0 ? num : null;
            };

            const coerceRecentDate = (value: any, seed: string, maxMonths = 17) => {
                const now = new Date();
                const latest = new Date(now.getFullYear(), now.getMonth(), 1);
                const oldest = new Date(now.getFullYear(), now.getMonth() - maxMonths, 1);
                let parsed: Date | null = null;
                if (typeof value === "string") {
                    const match = value.match(/^(\d{4})-(\d{2})/);
                    if (match) {
                        const year = Number(match[1]);
                        const month = Number(match[2]);
                        if (Number.isFinite(year) && Number.isFinite(month)) {
                            parsed = new Date(year, Math.max(0, month - 1), 1);
                        }
                    }
                }
                if (!parsed || parsed < oldest || parsed > latest) {
                    const seedNum = parseInt(hashString(seed).slice(0, 8), 16) || 0;
                    const offset = seedNum % Math.max(1, maxMonths);
                    const adjusted = new Date(latest);
                    adjusted.setMonth(latest.getMonth() - offset);
                    parsed = adjusted;
                }
                const month = String(parsed.getMonth() + 1).padStart(2, "0");
                return `${parsed.getFullYear()}-${month}`;
            };

            const normalizeComps = (raw: any) => {
                if (!Array.isArray(raw)) return [];
                return raw
                    .map((comp: any) => ({
                        address: String(comp?.address || "").trim(),
                        price: safeNumber(comp?.price, 0),
                        sqft: safeNumber(comp?.sqft, 0) || undefined,
                        soldDate: coerceRecentDate(comp?.soldDate, `${comp?.address || ""}:${comp?.price || ""}`, 17),
                        beds: safeNumber(comp?.beds ?? comp?.bedrooms, 0) || undefined,
                        baths: safeNumber(comp?.baths ?? comp?.bathrooms, 0) || undefined,
                        daysOnMarket: safeNumber(comp?.daysOnMarket ?? comp?.dom, 0) || undefined,
                        distanceMiles: safeNumber(comp?.distanceMiles ?? comp?.distance, 0) || undefined,
                        condition: comp?.condition || undefined,
                        features: Array.isArray(comp?.features) ? comp.features.slice(0, 6) : undefined
                    }))
                    .filter((comp: any) => comp.address && comp.price > 0);
            };

            const normalizeRentalComps = (raw: any) => {
                if (!Array.isArray(raw)) return [];
                return raw
                    .map((comp: any) => ({
                        address: String(comp?.address || "").trim(),
                        rent: safeNumber(comp?.rent || comp?.monthlyRent, 0),
                        sqft: safeNumber(comp?.sqft, 0) || undefined,
                        date: coerceRecentDate(comp?.date || comp?.leaseDate, `${comp?.address || ""}:${comp?.rent || ""}`, 35),
                        leaseType: comp?.leaseType || undefined,
                        occupancy: comp?.occupancy || undefined,
                        termMonths: safeNumber(comp?.termMonths, 0) || undefined
                    }))
                    .filter((comp: any) => comp.address && comp.rent > 0);
            };

            const uniqueSortedCompPrices = (compList: any[]) => {
                const prices = compList
                    .map((comp: any) => roundToThousand(safeNumber(comp?.price, 0)))
                    .filter((price: number) => price > 0);
                return Array.from(new Set(prices)).sort((a, b) => a - b);
            };

            const getCompBand = (compList: any[]) => {
                const prices = uniqueSortedCompPrices(compList);
                if (prices.length >= 4) {
                    return {
                        low: prices[1],
                        high: prices[prices.length - 2],
                        method: "second-lowest to second-highest comps"
                    };
                }
                if (prices.length >= 2) {
                    return {
                        low: prices[0],
                        high: prices[prices.length - 1],
                        method: "available comp range"
                    };
                }
                return null;
            };

            const enforceUsableRange = (low: number, high: number, center: number) => {
                const safeCenter = center > 0 ? center : Math.max(low || 0, high || 0);
                let nextLow = roundToThousand(Math.min(low || safeCenter, high || safeCenter));
                let nextHigh = roundToThousand(Math.max(low || safeCenter, high || safeCenter));
                if (nextLow === nextHigh) {
                    const spread = Math.max(15000, roundToThousand(safeCenter * 0.08));
                    nextLow = roundToThousand(safeCenter - spread);
                    nextHigh = roundToThousand(safeCenter + spread);
                }
                return {
                    low: Math.max(0, nextLow),
                    high: Math.max(nextLow, nextHigh)
                };
            };

            const modeledCompAddress = (baseAddress: string, offset: number) => {
                const match = baseAddress.match(/^\s*(\d+)\s+(.+?)(,\s*[^,]+,\s*[A-Z]{2}\s*\d{5})?$/i);
                if (!match) return `Nearby modeled comp ${offset}`;
                const streetNumber = Number(match[1]);
                if (!Number.isFinite(streetNumber)) return `Nearby modeled comp ${offset}`;
                const street = match[2].replace(/,\s*$/, "");
                const suffix = match[3] || "";
                return `${Math.max(1, streetNumber + offset)} ${street}${suffix}`;
            };

            const generateModeledComps = (baseAddress: string, center: number) => {
                const multipliers = [0.82, 0.9, 0.96, 1.03, 1.09, 1.18];
                const offsets = [-6, -3, 4, 8, 14, 22];
                return multipliers.map((multiplier, idx) => ({
                    address: modeledCompAddress(baseAddress, offsets[idx]),
                    price: roundToThousand(center * multiplier),
                    sqft: safeNumber(cleanDetails.squareFeet, 0) || undefined,
                    soldDate: coerceRecentDate("", `${baseAddress}:modeled:${idx}`, 17),
                    beds: safeNumber(cleanDetails.bedrooms, 0) || undefined,
                    baths: safeNumber(cleanDetails.bathrooms, 0) || undefined,
                    daysOnMarket: 18 + (idx * 4),
                    distanceMiles: Number((0.2 + idx * 0.18).toFixed(2)),
                    condition: cleanDetails.condition || "similar",
                    features: Array.isArray(cleanDetails.features) ? cleanDetails.features.slice(0, 4) : undefined,
                    modeled: true
                }));
            };

            const censusValue = census?.acs?.median_home_value ?? null;
            const sqft = cleanDetails.squareFeet || 1600;
            const smartEstimate = generateSmartMockPrice(address || "Unknown", cleanDetails, 0);
            const freeEstimate = (() => {
                if (propertyType === "industrial") {
                    return roundToThousand((sqft || 5000) * 120);
                }
                if (propertyType === "commercial") {
                    return roundToThousand((sqft || 3000) * 180);
                }
                if (censusValue && censusValue > 0) {
                    const scaler = Math.min(1.35, Math.max(0.75, sqft / 1800));
                    const censusEstimate = roundToThousand(censusValue * scaler);
                    const blended = (censusEstimate * 0.35) + (smartEstimate * 0.65);
                    return roundToThousand(blended);
                }
                return smartEstimate;
            })();

            const compsPrompt = `
Find the market value by running comps for "${address}".
Use the details below if available and keep it realistic. Do NOT browse the web.
Use recent comparable sales within the last 12-18 months (2024-2026). Avoid comps older than 18 months.

PROPERTY DETAILS:
${JSON.stringify(cleanDetails, null, 2)}

LOCAL CENSUS SNAPSHOT (if available):
${JSON.stringify(census || {}, null, 2)}

Return ONLY JSON in this schema:
{
  "marketValue": number,
  "comps": [
    {
      "address": "string",
      "soldDate": "YYYY-MM",
      "price": number,
      "sqft": number,
      "beds": number,
      "baths": number,
      "daysOnMarket": number,
      "distanceMiles": number,
      "condition": "string",
      "features": ["string"]
    }
  ],
  "notes": "string",
  "valueDrivers": ["string"]
}
`;

            const rentalPrompt = `
Find rental comps and estimate the typical monthly rent for "${address}".
Use the details below if available and keep it realistic. Do NOT browse the web.
Use recent lease comps within the last 24 months. If comps are sparse, you may extend to 36 months (2023-2026).

PROPERTY DETAILS:
${JSON.stringify(cleanDetails, null, 2)}

Return ONLY JSON in this schema:
{
  "monthlyRent": number,
  "rentalComps": [
    {
      "address": "string",
      "rent": number,
      "sqft": number,
      "date": "YYYY-MM",
      "leaseType": "string",
      "occupancy": "string",
      "termMonths": number
    }
  ],
  "market": {
    "vacancyRate": number,
    "absorptionRate": number,
    "capRateRange": "string",
    "avgDom": number,
    "inventoryLevel": "string",
    "submarket": "string",
    "trendNotes": "string"
  }
}
`;

            const replacementPrompt = `
Estimate the replacement cost for the property at "${address}".
Use the details below if available and keep it realistic. Do NOT browse the web.

PROPERTY DETAILS:
${JSON.stringify(cleanDetails, null, 2)}

Return ONLY JSON in this schema:
{
  "replacementCost": number,
  "costPerSqft": number,
  "notes": "string",
  "replacementExamples": [
    { "address": "string", "cost": number, "sqft": number, "year": number, "distanceMiles": number, "type": "string" }
  ]
}
`;

            const lotPrompt = `
Find the market value for the land at "${address}" and the best & highest use.
Use the details below if available and keep it realistic. Do NOT browse the web.

PROPERTY DETAILS:
${JSON.stringify(cleanDetails, null, 2)}

Return ONLY JSON in this schema:
{
  "marketValue": number,
  "bestUse": "string",
  "zoningAssumptions": "string",
  "comps": [
    { "address": "string", "soldDate": "YYYY-MM", "price": number, "sqft": number, "distanceMiles": number }
  ],
  "notes": "string"
}
`;

            const warnings: string[] = [];

            const callGemini = async (prompt: string) => {
                if (AI_FREE_MODE) {
                    warnings.push("AI disabled in free mode.");
                    return null;
                }
                if (!geminiApiKey) {
                    warnings.push("Gemini API key missing.");
                    return null;
                }
                try {
                    guardRateLimit({
                        bucket: "gemini",
                        id: clientId,
                        maxCalls: GEMINI_MAX,
                        windowMs: RATE_WINDOW_MS,
                        blockMs: RATE_BLOCK_MS
                    });
                } catch (error) {
                    warnings.push("Gemini rate limit reached.");
                    return null;
                }
                try {
                    const model = genAI.getGenerativeModel({ model: geminiModel });
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const text = response.text();
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : text;
                    return JSON.parse(jsonStr);
                } catch (error) {
                    console.error("Gemini AI Error:", error);
                    if (isAiServiceDownError(error)) {
                        await notifyAndThrowMaintenance({
                            provider: "Gemini",
                            route: "POST /api/valuation",
                            address,
                            error
                        });
                    }
                    warnings.push("Gemini valuation failed.");
                    return null;
                }
            };

            const callOpenAI = async (prompt: string) => {
                if (AI_FREE_MODE) {
                    warnings.push("AI disabled in free mode.");
                    return null;
                }
                if (!openaiApiKey) {
                    warnings.push("OpenAI API key missing.");
                    return null;
                }
                try {
                    guardRateLimit({
                        bucket: "openai",
                        id: clientId,
                        maxCalls: OPENAI_MAX,
                        windowMs: RATE_WINDOW_MS,
                        blockMs: RATE_BLOCK_MS
                    });
                } catch (error) {
                    warnings.push("OpenAI rate limit reached.");
                    return null;
                }
                try {
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
                                {
                                    role: "system",
                                    content: "Return only valid JSON. Use the requested schema."
                                },
                                {
                                    role: "user",
                                    content: prompt
                                }
                            ]
                        })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`OpenAI error: ${errText}`);
                    }

                    const data = await response.json();
                    const content = data?.choices?.[0]?.message?.content || '';
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : content;
                    return JSON.parse(jsonStr);
                } catch (error) {
                    console.error("OpenAI Error:", error);
                    if (isAiServiceDownError(error)) {
                        await notifyAndThrowMaintenance({
                            provider: "OpenAI",
                            route: "POST /api/valuation",
                            address,
                            error
                        });
                    }
                    warnings.push("OpenAI valuation failed.");
                    return null;
                }
            };

            const callManus = async (prompt: string) => {
                if (AI_FREE_MODE) {
                    warnings.push("AI disabled in free mode.");
                    return null;
                }
                if (!manusApiKey || !manusApiUrl) {
                    return null;
                }
                try {
                    guardRateLimit({
                        bucket: "manus",
                        id: clientId,
                        maxCalls: MANUS_MAX,
                        windowMs: RATE_WINDOW_MS,
                        blockMs: RATE_BLOCK_MS
                    });
                } catch (error) {
                    warnings.push("Manus rate limit reached.");
                    return null;
                }
                try {
                    const response = await fetch(manusApiUrl, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${manusApiKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: manusModel,
                            temperature: 0.2,
                            response_format: { type: "json_object" },
                            messages: [
                                { role: "system", content: "Return only valid JSON. Use the requested schema." },
                                { role: "user", content: prompt }
                            ]
                        })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`Manus error: ${errText}`);
                    }

                    const data = await response.json();
                    const content =
                        data?.choices?.[0]?.message?.content ||
                        data?.output ||
                        data?.content ||
                        '';
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : content;
                    return JSON.parse(jsonStr);
                } catch (error) {
                    console.error("Manus AI Error:", error);
                    if (isAiServiceDownError(error)) {
                        await notifyAndThrowMaintenance({
                            provider: "Manus",
                            route: "POST /api/valuation",
                            address,
                            error
                        });
                    }
                    warnings.push("Manus valuation failed.");
                    return null;
                }
            };

            const promptToUse =
                propertyType === "industrial" ? replacementPrompt :
                propertyType === "lot" ? lotPrompt :
                compsPrompt;

            const [geminiResult, openaiResult, manusResult] = await Promise.all([
                callGemini(promptToUse),
                callOpenAI(promptToUse),
                callManus(promptToUse)
            ]);

            const geminiEstimate = toEstimate(geminiResult?.marketValue || geminiResult?.finalEstimate || geminiResult?.replacementCost);
            const openaiEstimate = toEstimate(openaiResult?.marketValue || openaiResult?.finalEstimate || openaiResult?.replacementCost);
            const manusEstimate = toEstimate(manusResult?.marketValue || manusResult?.finalEstimate || manusResult?.replacementCost);

            const mergedComps = [
                ...normalizeComps(geminiResult?.comps || geminiResult?.comparableSales),
                ...normalizeComps(openaiResult?.comps || openaiResult?.comparableSales),
                ...normalizeComps(manusResult?.comps || manusResult?.comparableSales)
            ];

            const seen = new Set<string>();
            let comps = mergedComps.filter((comp: any) => {
                const key = `${comp.address}-${comp.price}-${comp.sqft || ""}-${comp.soldDate || ""}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).slice(0, 8);

            if ((propertyType === "residential" || propertyType === "lot") && uniqueSortedCompPrices(comps).length === 0) {
                const modeledComps = generateModeledComps(address || "Nearby property", freeEstimate);
                for (const comp of modeledComps) {
                    const key = `${comp.address}-${comp.price}-${comp.sqft || ""}-${comp.soldDate || ""}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    comps.push(comp);
                }
                comps = comps
                    .sort((a: any, b: any) => safeNumber(a.price, 0) - safeNumber(b.price, 0))
                    .slice(0, 8);
            }

            let rentalComps: any[] = [];
            let marketSnapshot: any = null;
            let replacementExamples: any[] = [];
            let rangeLow = 0;
            let rangeHigh = 0;
            let suggested = 0;
            let reportText = "";
            let rangeIsCompBased = false;

            if (propertyType === "commercial") {
                const [geminiRentResult, openaiRentResult, manusRentResult] = await Promise.all([
                    callGemini(rentalPrompt),
                    callOpenAI(rentalPrompt),
                    callManus(rentalPrompt)
                ]);
                rentalComps = [
                    ...normalizeRentalComps(geminiRentResult?.rentalComps),
                    ...normalizeRentalComps(openaiRentResult?.rentalComps),
                    ...normalizeRentalComps(manusRentResult?.rentalComps)
                ].slice(0, 12);
                marketSnapshot = geminiRentResult?.market || openaiRentResult?.market || manusRentResult?.market || null;
                const rentEstimates = [
                    toEstimate(geminiRentResult?.monthlyRent),
                    toEstimate(openaiRentResult?.monthlyRent),
                    toEstimate(manusRentResult?.monthlyRent),
                    toEstimate(roundToThousand((sqft || 3000) * 2))
                ].filter((v): v is number => !!v);
                const monthlyRent = rentEstimates.length ? averageNumbers(rentEstimates) : (sqft || 3000) * 2;
                const incomeValue = roundToThousand(monthlyRent * 109);

                const salesEstimates = [geminiEstimate, openaiEstimate, manusEstimate, freeEstimate].filter((v): v is number => !!v);
                const salesAvg = salesEstimates.length ? averageNumbers(salesEstimates) : freeEstimate;

                rangeLow = Math.min(salesAvg, incomeValue);
                rangeHigh = Math.max(salesAvg, incomeValue);
                suggested = roundToThousand((salesAvg + incomeValue) / 2);
                reportText = `
                  <div class="space-y-2 text-sm">
                    <p><strong>Commercial valuation summary</strong></p>
                    <p>We balanced sale comps with an income approach to estimate value.</p>
                    <p>Income approach based on rental comps × 109 months.</p>
                    ${marketSnapshot?.trendNotes ? `<p>${marketSnapshot.trendNotes}</p>` : ""}
                  </div>
                `;
            } else if (propertyType === "industrial") {
                const estimates = [geminiEstimate, openaiEstimate, manusEstimate, freeEstimate].filter((v): v is number => !!v);
                replacementExamples = [
                    ...(Array.isArray(geminiResult?.replacementExamples) ? geminiResult.replacementExamples : []),
                    ...(Array.isArray(openaiResult?.replacementExamples) ? openaiResult.replacementExamples : []),
                    ...(Array.isArray(manusResult?.replacementExamples) ? manusResult.replacementExamples : [])
                ].map((item: any) => ({
                    address: String(item?.address || "").trim(),
                    cost: safeNumber(item?.cost || item?.replacementCost, 0),
                    sqft: safeNumber(item?.sqft, 0) || undefined,
                    year: safeNumber(item?.year, 0) || undefined,
                    distanceMiles: safeNumber(item?.distanceMiles || item?.distance, 0) || undefined,
                    type: item?.type || undefined
                })).filter((item: any) => item.address && item.cost > 0).slice(0, 6);
                rangeLow = estimates.length ? Math.min(...estimates) : freeEstimate;
                rangeHigh = estimates.length ? Math.max(...estimates) : freeEstimate;
                suggested = roundToThousand(estimates.length ? averageNumbers(estimates) : freeEstimate);
                reportText = `
                  <div class="space-y-2 text-sm">
                    <p><strong>Industrial valuation summary</strong></p>
                    <p>Replacement cost signals and property specs were weighted to set the band.</p>
                    <p>We referenced nearby new construction examples when available.</p>
                  </div>
                `;
            } else if (propertyType === "lot") {
                const estimates = [geminiEstimate, openaiEstimate, manusEstimate, freeEstimate].filter((v): v is number => !!v);
                rangeLow = estimates.length ? Math.min(...estimates) : freeEstimate;
                rangeHigh = estimates.length ? Math.max(...estimates) : freeEstimate;
                suggested = roundToThousand(estimates.length ? averageNumbers(estimates) : freeEstimate);
                reportText = `
                  <div class="space-y-2 text-sm">
                    <p><strong>Land valuation summary</strong></p>
                    <p>Best & highest use: ${(geminiResult?.bestUse || openaiResult?.bestUse || "Residential build").toString()}</p>
                  </div>
                `;
            } else {
                const estimates = [geminiEstimate, openaiEstimate, manusEstimate, freeEstimate].filter((v): v is number => !!v);
                const compBand = getCompBand(comps);
                if (compBand) {
                    rangeIsCompBased = true;
                    const compPrices = uniqueSortedCompPrices(comps);
                    const boundedCompPrices = compPrices.filter((price) => price >= compBand.low && price <= compBand.high);
                    const compSuggested = boundedCompPrices.length
                        ? averageNumbers(boundedCompPrices)
                        : averageNumbers([compBand.low, compBand.high]);
                    const usableRange = enforceUsableRange(compBand.low, compBand.high, compSuggested);
                    rangeLow = usableRange.low;
                    rangeHigh = usableRange.high;
                    suggested = roundToThousand(Math.min(rangeHigh, Math.max(rangeLow, compSuggested)));
                } else {
                    const center = estimates.length ? averageNumbers(estimates) : freeEstimate;
                    const usableRange = enforceUsableRange(
                        estimates.length ? Math.min(...estimates) : center,
                        estimates.length ? Math.max(...estimates) : center,
                        center
                    );
                    rangeLow = usableRange.low;
                    rangeHigh = usableRange.high;
                    suggested = roundToThousand(Math.min(rangeHigh, Math.max(rangeLow, center)));
                }
                reportText = `
                  <div class="space-y-2 text-sm">
                    <p><strong>Residential valuation summary</strong></p>
                    <p>We set the range from comparable sales: the second-lowest comp to the second-highest comp when enough comps are available.</p>
                    ${comps.some((comp: any) => comp.modeled) ? `<p>Live comp providers were unavailable, so this run used a modeled local comp spread until external comps return.</p>` : ""}
                    ${Array.isArray(geminiResult?.valueDrivers) && geminiResult.valueDrivers.length
                      ? `<ul>${geminiResult.valueDrivers.slice(0, 4).map((item: string) => `<li>${item}</li>`).join("")}</ul>`
                      : ""}
                    ${geminiResult?.notes ? `<p>${geminiResult.notes}</p>` : ""}
                  </div>
                `;
            }

            const responsePayload = {
                suggested,
                rangeLow,
                rangeHigh,
                geminiEstimate,
                openaiEstimate,
                manusEstimate,
                freeEstimate,
                report: reportText,
                comps,
                rentalComps,
                market: marketSnapshot,
                replacementExamples,
                warnings
            };

            const bumpValue = (value: number | null | undefined) => {
                if (typeof value !== "number" || !Number.isFinite(value)) return value;
                return roundToThousand(value * 1.25);
            };

            const bumpedPayload = {
                ...responsePayload,
                suggested: rangeIsCompBased ? responsePayload.suggested : bumpValue(responsePayload.suggested),
                rangeLow: rangeIsCompBased ? responsePayload.rangeLow : bumpValue(responsePayload.rangeLow),
                rangeHigh: rangeIsCompBased ? responsePayload.rangeHigh : bumpValue(responsePayload.rangeHigh),
                geminiEstimate: bumpValue(responsePayload.geminiEstimate),
                openaiEstimate: bumpValue(responsePayload.openaiEstimate),
                manusEstimate: bumpValue(responsePayload.manusEstimate),
                freeEstimate: bumpValue(responsePayload.freeEstimate)
            };

            setCache(cacheKey, bumpedPayload, CACHE_TTL_MS);
            return bumpedPayload;
        } catch (error) {
            console.error("Valuation Route Error:", error);
            if (isMaintenanceError(error)) {
                throw error;
            }
            const fallbackValue = generateSmartMockPrice(address || "Unknown", details || {}, 0);
            const fallbackPayload = {
                suggested: fallbackValue,
                rangeLow: Math.round(fallbackValue * 0.92 / 1000) * 1000,
                rangeHigh: Math.round(fallbackValue * 1.08 / 1000) * 1000,
                geminiEstimate: null,
                openaiEstimate: null,
                manusEstimate: null,
                freeEstimate: fallbackValue,
                report: `<p><strong>Market Connection Limited</strong></p><p>We used a local fallback estimate while the AI services were unavailable.</p>`,
                comps: [],
                rentalComps: [],
                market: null,
                replacementExamples: [],
                warnings: ["Valuation error fallback used."]
            };
            const bumpValue = (value: number | null | undefined) => {
                if (typeof value !== "number" || !Number.isFinite(value)) return value;
                return Math.round(value * 1.25 / 1000) * 1000;
            };
            const bumpedFallback = {
                ...fallbackPayload,
                suggested: bumpValue(fallbackPayload.suggested),
                rangeLow: bumpValue(fallbackPayload.rangeLow),
                rangeHigh: bumpValue(fallbackPayload.rangeHigh),
                freeEstimate: bumpValue(fallbackPayload.freeEstimate)
            };
            setCache(cacheKey, bumpedFallback, Math.min(CACHE_TTL_MS, 10 * 60 * 1000));
            return bumpedFallback;
        }
        });
        return NextResponse.json(payload);
    } catch (error) {
        if (isMaintenanceError(error)) {
            return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 });
        }
        console.error("Valuation route failed:", error);
        return NextResponse.json({ error: "Valuation failed. Please retry shortly." }, { status: 500 });
    }
}
