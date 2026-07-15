"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flashlight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  isServerAuthAvailable,
  pullServerPaperworkIntoLocal,
  scheduleListingSync,
  sendAuthOtp,
  verifyAuthOtp
} from "@/lib/listing-sync";

const APP_VERSION = "v41";
const VALUATION_CACHE_VERSION = "v41";

declare global {
  interface Window {
    google?: any;
    initGoogleAutocomplete?: () => void;
  }
}

const RES_FEATURES = [
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

const COMMERCIAL_FEATURES = [
  "Corner lot",
  "High visibility",
  "On-site parking",
  "Loading dock",
  "Freight elevator",
  "ADA compliant",
  "Sprinkler system",
  "Security system",
  "Signage opportunities",
  "Public transit access",
  "Drive-in doors",
  "Outdoor storage",
  "High ceilings",
  "Recently renovated"
];

const INDUSTRIAL_FEATURES = [
  "Dock high doors",
  "Drive-in doors",
  "Clear height 18ft+",
  "Heavy power",
  "Fenced yard",
  "Trailer parking",
  "Rail access",
  "Cold storage",
  "Sprinkler system",
  "Large yard",
  "Outdoor storage",
  "Secured access",
  "Recent roof"
];

const MULTIFAMILY_DOCS = [
  "Rent roll",
  "Current leases",
  "Pro forma",
  "Utility bills",
  "Capital improvements list",
  "HOA or condo docs (if any)"
];

const COMMERCIAL_DOCS = [
  "Rent roll",
  "Current leases",
  "Operating expenses",
  "Utility copies",
  "Pro forma or T-12",
  "Site or floor plan",
  "Environmental reports (if any)"
];

const ADDONS = [
  { id: "pro_photos", name: "Professional Photography", price: 249 },
  { id: "3d_tour", name: "3D Virtual Tour", price: 349 },
  { id: "floorplan", name: "Floor Plan", price: 129 },
  { id: "staging", name: "Virtual Staging", price: 199 },
  { id: "social", name: "Social Media Boost", price: 99 },
  { id: "video", name: "Listing Video", price: 399 }
];

const TASKS = [
  "Install lockbox",
  "Prepare for showings",
  "Yard sign (yes / no)",
  "Offers",
  "Prepare for closing",
  "Walkthrough",
  "Closing day",
  "After closing"
];

const LISTING_KEY = "seller_ai_listing";
const SESSION_KEY = "seller_ai_session_v2";
const HISTORY_KEY = "seller_ai_history";
const THEME_KEY = "seller_ai_theme";
const THEME_MODE_KEY = "seller_ai_theme_mode";
const uid = () => Math.random().toString(36).slice(2, 10);
const hashString = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
};
const VALUATION_COOLDOWN_MS = 45_000;
const MIN_VALUATION_MS = 30_000;
const LOCAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROPERTY_LOOKUP_CACHE_VERSION = "v3-no-fake-facts";

type AddressSuggestion = {
  id: string;
  label: string;
  placeTypes?: string[];
};

type ListingData = {
  address: string;
  propertyLookupVersion?: string;
  propertyPhoto?: {
    url: string;
    source?: string;
    caption?: string;
    capturedAt?: string;
  };
  census?: {
    stateName?: string;
    countyName?: string;
    tractName?: string;
    stateFips?: string;
    countyFips?: string;
    tractCode?: string;
    acs?: {
      median_household_income?: number | null;
      median_home_value?: number | null;
      median_gross_rent?: number | null;
      owner_occupied?: number | null;
      renter_occupied?: number | null;
      employed?: number | null;
      unemployed?: number | null;
    };
  };
  details: {
    propertyType: "residential" | "commercial" | "industrial";
    bedrooms: number;
    bathrooms: number;
    squareFeet: number;
    yearBuilt: number;
    condition: "new" | "great" | "good" | "fair" | "fixer" | "rehab";
    features: string[];
    useType: "retail" | "office" | "industrial" | "mixed" | "flex" | "medical" | "hospitality";
    units: number;
    occupancy: "owner-occupied" | "leased" | "vacant";
    leaseType: "nnn" | "gross" | "modified" | "n/a";
    clearHeight: number;
    dockDoors: number;
  };
  valuation: {
    gemini?: number;
    openai?: number;
    manus?: number;
    free?: number;
    average?: number;
    rangeLow?: number;
    rangeHigh?: number;
    report?: string;
    comps?: {
      address: string;
      price: number;
      sqft?: number;
      soldDate?: string;
      beds?: number;
      baths?: number;
      daysOnMarket?: number;
      distanceMiles?: number;
      condition?: string;
      features?: string[];
      modeled?: boolean;
    }[];
    rentalComps?: {
      address: string;
      rent: number;
      sqft?: number;
      date?: string;
      leaseType?: string;
      occupancy?: string;
      termMonths?: number;
    }[];
    market?: {
      vacancyRate?: number;
      absorptionRate?: number;
      capRateRange?: string;
      avgDom?: number;
      trendNotes?: string;
      submarket?: string;
      inventoryLevel?: string;
    };
    replacementExamples?: {
      address: string;
      cost: number;
      sqft?: number;
      year?: number;
      distanceMiles?: number;
      type?: string;
    }[];
  };
  addons: string[];
  acknowledgements: {
    agency: boolean;
    fairHousing: boolean;
    mls: boolean;
  };
  seller: {
    name: string;
    email: string;
    phone: string;
  };
  finalPrice: number | null;
  photos: string[];
  description: string;
  signed: boolean;
  activated: boolean;
  paperwork: {
    ownerRole: "owner" | "representative" | "";
    officialOwner: boolean | null;
    mailingAddress: string;
    brokerFeeConsent: boolean | null;
    dualAgencyConsent: boolean | null;
    builtBefore1978: "yes" | "no" | "";
    consumerNoticeStatus: "not_sent" | "requested" | "sent" | "signed";
    consumerNoticeUrl?: string;
    listingAgreementStatus: "not_sent" | "sent" | "signed";
    isMultiFamily: boolean;
    extraUploads: string[];
  };
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type ListingHistoryItem = {
  id: string;
  address: string;
  data: ListingData;
  updatedAt: number;
};

type ChatStep =
  | "intro"
  | "confirm"
  | "details"
  | "features"
  | "valuation"
  | "addons"
  | "acknowledgements"
  | "final-price"
  | "activation"
  | "ownership"
  | "consumer-notice"
  | "consumer-wait"
  | "listing-intro"
  | "listing-details"
  | "dual-agency"
  | "lead-paint"
  | "listing-wait"
  | "marketing-intro"
  | "photos"
  | "description"
  | "dashboard";

const DEFAULT_DATA: ListingData = {
  address: "",
  propertyLookupVersion: PROPERTY_LOOKUP_CACHE_VERSION,
  census: undefined,
  details: {
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
  },
  valuation: {},
  addons: [],
  acknowledgements: {
    agency: false,
    fairHousing: false,
    mls: false
  },
  seller: {
    name: "",
    email: "",
    phone: ""
  },
  finalPrice: null,
  photos: [],
  description: "",
  signed: false,
  activated: false,
  paperwork: {
    ownerRole: "",
    officialOwner: null,
    mailingAddress: "",
    brokerFeeConsent: null,
    dualAgencyConsent: null,
    builtBefore1978: "",
    consumerNoticeStatus: "not_sent",
    consumerNoticeUrl: "",
    listingAgreementStatus: "not_sent",
    isMultiFamily: false,
    extraUploads: []
  }
};

const hydrateListingData = (loaded: Partial<ListingData> | null | undefined) => {
  const merged: ListingData = {
    ...DEFAULT_DATA,
    ...(loaded || {}),
    details: {
      ...DEFAULT_DATA.details,
      ...(loaded?.details || {})
    },
    seller: {
      ...DEFAULT_DATA.seller,
      ...(loaded?.seller || {})
    },
    acknowledgements: {
      ...DEFAULT_DATA.acknowledgements,
      ...(loaded?.acknowledgements || {})
    },
    paperwork: {
      ...DEFAULT_DATA.paperwork,
      ...(loaded?.paperwork || {})
    },
    valuation: {
      ...DEFAULT_DATA.valuation,
      ...(loaded?.valuation || {})
    }
  };

  if (merged.propertyLookupVersion !== PROPERTY_LOOKUP_CACHE_VERSION) {
    return {
      ...merged,
      propertyLookupVersion: PROPERTY_LOOKUP_CACHE_VERSION,
      details: {
        ...merged.details,
        bedrooms: 0,
        bathrooms: 0,
        squareFeet: 0,
        yearBuilt: 0,
        features: []
      }
    };
  }

  return merged;
};

const INTRO_TEXT =
  "Thank you for choosing housingPA for your next property sale. By using AI, you save a ton of time, and that helps us bring costs down. You can very quickly list your property on the market with a licensed agent, real marketing, and the compliance that comes with it, while still keeping the fast, direct feeling of FSBO. And you pay only a 1% broker fee. Let’s get started.";

const WORKFLOW_PROGRESS: Record<ChatStep, { label: string; percent: number }> = {
  intro: { label: "Welcome", percent: 5 },
  confirm: { label: "Property check", percent: 12 },
  details: { label: "Property check", percent: 18 },
  features: { label: "Features", percent: 28 },
  valuation: { label: "Estimate", percent: 42 },
  addons: { label: "Seller info", percent: 52 },
  acknowledgements: { label: "Seller info", percent: 56 },
  "final-price": { label: "Agreement estimate", percent: 66 },
  activation: { label: "Verify email", percent: 74 },
  ownership: { label: "Paperwork", percent: 80 },
  "consumer-notice": { label: "Consumer Notice", percent: 84 },
  "consumer-wait": { label: "Consumer Notice", percent: 88 },
  "listing-intro": { label: "Listing Agreement", percent: 90 },
  "listing-details": { label: "Listing Agreement", percent: 92 },
  "dual-agency": { label: "Compliance", percent: 94 },
  "lead-paint": { label: "Compliance", percent: 96 },
  "listing-wait": { label: "Signing", percent: 97 },
  "marketing-intro": { label: "Marketing", percent: 98 },
  photos: { label: "Marketing", percent: 99 },
  description: { label: "Marketing", percent: 99 },
  dashboard: { label: "Ready", percent: 100 }
};

const GAME_MILESTONES: { step: ChatStep; title: string; points: number }[] = [
  { step: "intro", title: "Started", points: 50 },
  { step: "confirm", title: "Address checked", points: 75 },
  { step: "details", title: "Details verified", points: 90 },
  { step: "features", title: "Features added", points: 90 },
  { step: "valuation", title: "Price reviewed", points: 120 },
  { step: "acknowledgements", title: "Seller info ready", points: 100 },
  { step: "final-price", title: "Launch price chosen", points: 120 },
  { step: "activation", title: "Email verified", points: 90 },
  { step: "consumer-notice", title: "Notice started", points: 85 },
  { step: "listing-intro", title: "Agreement started", points: 90 },
  { step: "marketing-intro", title: "Marketing ready", points: 90 },
  { step: "dashboard", title: "Listing command center", points: 100 }
];

const GAME_STEP_ORDER: ChatStep[] = [
  "intro",
  "confirm",
  "details",
  "features",
  "valuation",
  "addons",
  "acknowledgements",
  "final-price",
  "activation",
  "ownership",
  "consumer-notice",
  "consumer-wait",
  "listing-intro",
  "listing-details",
  "dual-agency",
  "lead-paint",
  "listing-wait",
  "marketing-intro",
  "photos",
  "description",
  "dashboard"
];

const GAME_HELPERS = [
  {
    id: "price",
    name: "Price Review",
    role: "Pricing inputs",
    initials: "PR",
    hint: "Add known facts before any price review.",
    body:
      "Add what you know about condition, updates, room count, and property strengths. These details help organize pricing inputs for a property-specific review; they are not a final valuation."
  },
  {
    id: "paperwork",
    name: "Paperwork",
    role: "Compliance steps",
    initials: "PW",
    hint: "Complete each required step once.",
    body:
      "Acknowledgements, notices, and signing checkpoints keep the seller file organized before marketing or listing work moves forward."
  },
  {
    id: "launch",
    name: "Launch Prep",
    role: "Marketing inputs",
    initials: "LP",
    hint: "Photos and notes improve review quality.",
    body:
      "Photos, access notes, updates, and condition details help explain the property story when the listing is reviewed and prepared."
  }
];

const SELLER_GUIDANCE_MVP_ENABLED = true;

const STEP_GUIDANCE: Partial<Record<ChatStep, { next: string; why: string }>> = {
  intro: {
    next: "Start with the property address so SellerAI can organize the file around the correct property.",
    why: "The address anchors the later review: property details, pricing inputs, disclosures, and marketing preparation."
  },
  confirm: {
    next: "Confirm the address and basic property facts before continuing.",
    why: "Accurate basics reduce rework and make the pricing and disclosure steps easier to review."
  },
  details: {
    next: "Review the measurable details: beds, baths, square footage, year built, and condition.",
    why: "These facts help separate known property information from assumptions before a seller review."
  },
  features: {
    next: "Add features, updates, and condition notes that may not appear in public records.",
    why: "More complete details can support a stronger next-step plan without making value promises."
  },
  valuation: {
    next: "Treat the estimate as a working input, then review details or continue to the next step.",
    why: "This is not a valuation or guaranteed sale price. A property-specific review is still required."
  },
  acknowledgements: {
    next: "Confirm seller contact details and required acknowledgements.",
    why: "This keeps the seller file organized before the listing paperwork step."
  },
  "final-price": {
    next: "Enter the intended launch-price direction for document preparation.",
    why: "A clear input helps prepare the next step while still leaving room for broker review."
  },
  activation: {
    next: "Verify the seller email so the dashboard and document workflow can continue.",
    why: "Email verification helps keep the seller file tied to the right contact."
  },
  "consumer-notice": {
    next: "Start the Consumer Notice workflow and wait for the required review/signing step.",
    why: "This required Pennsylvania disclosure step should stay separate from the listing agreement itself."
  },
  "listing-intro": {
    next: "Review the listing agreement path before entering detailed listing terms.",
    why: "This helps clarify the broker-supported process before moving toward signature."
  },
  "marketing-intro": {
    next: "Prepare the marketing inputs that make the listing easier to review and prepare.",
    why: "Photos, access notes, and description quality matter once the paperwork path is ready."
  },
  dashboard: {
    next: "Use the dashboard to track the next operational task.",
    why: "The dashboard keeps next steps organized after the setup flow is complete."
  }
};

const getGameProgress = (step: ChatStep) => {
  const stepIndex = Math.max(0, GAME_STEP_ORDER.indexOf(step));
  const earnedMilestones = GAME_MILESTONES.filter((milestone) => {
    const milestoneIndex = GAME_STEP_ORDER.indexOf(milestone.step);
    return milestoneIndex !== -1 && milestoneIndex <= stepIndex;
  });
  const totalPoints = GAME_MILESTONES.reduce((sum, milestone) => sum + milestone.points, 0);
  const earnedPoints = earnedMilestones.reduce((sum, milestone) => sum + milestone.points, 0);
  const nextMilestone =
    GAME_MILESTONES.find((milestone) => {
      const milestoneIndex = GAME_STEP_ORDER.indexOf(milestone.step);
      return milestoneIndex > stepIndex;
    }) || null;

  return {
    earnedMilestones,
    earnedPoints,
    nextMilestone,
    totalPoints
  };
};

const getStepGuidance = (step: ChatStep, workflowProgress: { label: string; percent: number }) =>
  STEP_GUIDANCE[step] || {
    next: `Continue the ${workflowProgress.label.toLowerCase()} step when the information is accurate.`,
    why: "Each completed step reduces uncertainty and improves the quality of the next review."
  };

const getReadinessLabel = (score: number) => {
  if (score >= 90) return "Strong seller-readiness profile";
  if (score >= 75) return "Review ready";
  if (score >= 50) return "Good progress";
  if (score >= 25) return "Needs key details";
  return "Getting started";
};

const getReadinessExplanation = (score: number, nextMilestone: { title: string } | null) => {
  if (score >= 90) {
    return "This reflects a mostly complete seller-readiness profile. A property-specific review is still required before pricing or listing decisions.";
  }
  if (nextMilestone) {
    return `This reflects profile completeness, not home value. Complete "${nextMilestone.title}" to improve review quality.`;
  }
  return "This score reflects profile completeness. It is not a home valuation or pricing recommendation.";
};

function TypewriterText({
  text,
  onDone
}: {
  text: string;
  onDone?: () => void;
}) {
  const [visibleText, setVisibleText] = useState("");
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    setVisibleText("");
    let idx = 0;
    const timer = setInterval(() => {
      idx += 1;
      setVisibleText(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(timer);
        onDoneRef.current?.();
      }
    }, 18);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <p className="typewriter-text">
      {visibleText}
      {visibleText.length < text.length && <span className="typing-caret" />}
    </p>
  );
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<"landing" | "chat">("landing");
  const [step, setStep] = useState<ChatStep>("confirm");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [postStepMessages, setPostStepMessages] = useState<ChatMessage[]>([]);
  const [data, setData] = useState<ListingData>(DEFAULT_DATA);
  const [addressInput, setAddressInput] = useState("");
  const [listingHistory, setListingHistory] = useState<ListingHistoryItem[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [valuationRunning, setValuationRunning] = useState(false);
  const [valuationLog, setValuationLog] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activationLink, setActivationLink] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [activationInput, setActivationInput] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [activationMocked, setActivationMocked] = useState(false);
  const [supabaseOtpActive, setSupabaseOtpActive] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<{ title: string; body: React.ReactNode } | null>(null);
  const [listingAgreementExplainerOpen, setListingAgreementExplainerOpen] = useState(false);
  const [infoPrompt, setInfoPrompt] = useState<{
    id: string;
    followUp: string;
    moreDetails: string;
  } | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [placeTypes, setPlaceTypes] = useState<string[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeMode, setThemeMode] = useState<"auto" | "manual">("auto");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [valuationSkipped, setValuationSkipped] = useState(false);
  const [lastValuationAt, setLastValuationAt] = useState<number | null>(null);
  const [valuationStage, setValuationStage] = useState<
    "idle" | "running" | "result" | "details" | "custom" | "reason"
  >("idle");
  const [valuationProgress, setValuationProgress] = useState(0);
  const [customPriceInput, setCustomPriceInput] = useState("");
  const [customReasonInput, setCustomReasonInput] = useState("");
  const [customPriceError, setCustomPriceError] = useState<string | null>(null);
  const [customReasonError, setCustomReasonError] = useState<string | null>(null);
  const [introComplete, setIntroComplete] = useState(false);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const valuationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postStepMessagesRef = useRef<ChatMessage[]>([]);
  const previousStepRef = useRef<ChatStep | null>(null);
  const consumerSignedRef = useRef(false);
  const lastPromptSnapshotRef = useRef<{ step: ChatStep; prompt: string } | null>(null);
  const autocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const hasSkippedInitialSessionSaveRef = useRef(false);
  const helpMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = localStorage.getItem(THEME_KEY);
    const storedMode = localStorage.getItem(THEME_MODE_KEY);
    if (storedMode === "manual") {
      setThemeMode("manual");
      if (storedTheme === "dark") {
        setTheme("dark");
        document.body.classList.add("dark");
      }
      return;
    }
    setThemeMode("auto");
    const hour = new Date().getHours();
    const nextTheme = hour >= 19 || hour < 6 ? "dark" : "light";
    setTheme(nextTheme);
    if (nextTheme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, nextTheme);
    localStorage.setItem(THEME_MODE_KEY, "auto");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        const loadedData = hydrateListingData(parsed?.data);
        const isLegacyLookup =
          parsed?.data?.address &&
          parsed?.data?.propertyLookupVersion !== PROPERTY_LOOKUP_CACHE_VERSION &&
          !parsed?.data?.seller?.email &&
          !parsed?.data?.valuation?.average;
        if (parsed?.data) setData(loadedData);
        if (isLegacyLookup) {
          setMessages([]);
          setView("chat");
          setStep("intro");
        } else {
          if (parsed?.messages) setMessages(parsed.messages);
          if (parsed?.view) setView(parsed.view);
          if (parsed?.step) setStep(parsed.step);
        }
        if (parsed?.addressInput) setAddressInput(parsed.addressInput);
      } catch {
        // ignore
      }
    } else {
      const listingRaw = localStorage.getItem(LISTING_KEY);
      if (listingRaw) {
        try {
          setData(hydrateListingData(JSON.parse(listingRaw)));
        } catch {
          // ignore
        }
      }
    }

    const historyRaw = localStorage.getItem(HISTORY_KEY);
    if (historyRaw) {
      try {
        const parsed = JSON.parse(historyRaw);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && typeof parsed[0] === "string") {
            const normalized = parsed
              .filter((item) => typeof item === "string" && item.trim().length > 0)
              .map((address) => ({
                id: uid(),
                address,
                data: { ...DEFAULT_DATA, address },
                updatedAt: Date.now()
              }));
            setListingHistory(normalized);
          } else {
            const normalized = parsed
              .filter((item) => item && typeof item.address === "string")
              .map((item) => ({
                id: item.id || uid(),
                address: item.address,
                data: item.data
                  ? hydrateListingData({ ...item.data, address: item.address })
                  : { ...DEFAULT_DATA, address: item.address },
                updatedAt: item.updatedAt || Date.now()
              }));
            setListingHistory(normalized);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (consumerSignedRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("consumerSigned") !== "1") return;
    consumerSignedRef.current = true;
    setData((prev) => ({
      ...prev,
      paperwork: { ...prev.paperwork, consumerNoticeStatus: "signed" }
    }));
    setView("chat");
    setStep("listing-intro");
    addMessage(
      "assistant",
      "Great! Your CN is received. Now let’s move on to preparing your Listing Agreement."
    );
    window.history.replaceState({}, "", window.location.pathname);
  }, [data.address]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasSkippedInitialSessionSaveRef.current) {
      hasSkippedInitialSessionSaveRef.current = true;
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      data,
      messages,
      view,
      step,
      addressInput
    }));
    localStorage.setItem(LISTING_KEY, JSON.stringify(data));
    // Server persistence (no-op until Supabase is configured and the seller
    // has verified their email; localStorage stays the offline/UI cache).
    scheduleListingSync(step, data);
  }, [data, messages, view, step, addressInput]);

  // While waiting on the agent, also pull released statuses from the server
  // so approvals reach the seller across devices without a refresh. The
  // merge writes into localStorage, which the existing 2s polls pick up.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (step !== "consumer-wait" && step !== "listing-wait") return;
    pullServerPaperworkIntoLocal();
    const interval = window.setInterval(pullServerPaperworkIntoLocal, 4000);
    return () => window.clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(listingHistory));
  }, [listingHistory]);

  useEffect(() => {
    if (typeof window === "undefined" || step !== "consumer-wait") return;

    const releaseIfAgentConfirmed = () => {
      try {
        const raw = localStorage.getItem(LISTING_KEY);
        if (!raw) return;
        const latest = hydrateListingData(JSON.parse(raw));
        if (latest.paperwork.consumerNoticeStatus !== "signed") return;
        if (data.paperwork.consumerNoticeStatus === "signed") return;

        setData(latest);
        setStep("listing-intro");
        addMessage(
          "assistant",
          "Great! Your CN is received. Now let’s move on to preparing your Listing Agreement."
        );
      } catch {
        // ignore local demo sync issues
      }
    };

    releaseIfAgentConfirmed();
    const interval = window.setInterval(releaseIfAgentConfirmed, 2000);
    return () => window.clearInterval(interval);
  }, [data.paperwork.consumerNoticeStatus, step]);

  useEffect(() => {
    if (typeof window === "undefined" || step !== "listing-wait") return;

    const releaseIfListingAgreementSigned = () => {
      try {
        const raw = localStorage.getItem(LISTING_KEY);
        if (!raw) return;
        const latest = hydrateListingData(JSON.parse(raw));
        if (latest.paperwork.listingAgreementStatus !== "signed") return;
        if (data.paperwork.listingAgreementStatus === "signed") return;

        setData(latest);
        setStep("lead-paint");
        addMessage(
          "assistant",
          "Agent released the signed Listing Agreement. Next, we’ll handle required disclosure items."
        );
      } catch {
        // ignore local demo sync issues
      }
    };

    releaseIfListingAgreementSigned();
    const interval = window.setInterval(releaseIfListingAgreementSigned, 2000);
    return () => window.clearInterval(interval);
  }, [data.paperwork.listingAgreementStatus, step]);

  useEffect(() => {
    if (data.seller.email && !reportEmail) {
      setReportEmail(data.seller.email);
    }
  }, [data.seller.email, reportEmail]);

  useEffect(() => {
    if (!helpMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (helpMenuRef.current?.contains(target)) return;
      setHelpMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [helpMenuOpen]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, postStepMessages, step, loading, infoPrompt]);

  useEffect(() => {
    postStepMessagesRef.current = postStepMessages;
  }, [postStepMessages]);

  useEffect(() => {
    if (step === "addons") {
      setStep("acknowledgements");
    }
  }, [step]);

  useEffect(() => {
    if (!previousStepRef.current) {
      previousStepRef.current = step;
      return;
    }
    const previousStep = previousStepRef.current;
    if (previousStep === step) return;
    const snapshot = buildStepSnapshot(previousStep);
    const queued = postStepMessagesRef.current;
    if (snapshot || queued.length > 0) {
      setMessages((prev) => [
        ...prev,
        ...(snapshot ? [{ id: uid(), role: "assistant" as const, content: snapshot }] : []),
        ...queued
      ]);
    }
    setPostStepMessages([]);
    previousStepRef.current = step;
    if (infoPrompt) {
      setInfoPrompt(null);
    }
    lastPromptSnapshotRef.current = null;
  }, [step]);

  useEffect(() => {
    if (view !== "landing") return;
    const query = addressInput.trim();
    if (autocompleteTimerRef.current) {
      clearTimeout(autocompleteTimerRef.current);
    }
    if (query.length < 3) {
      setAddressSuggestions([]);
      setMapsError(null);
      return;
    }

    autocompleteTimerRef.current = setTimeout(async () => {
      setAddressSearching(true);
      setMapsError(null);
      try {
        autocompleteAbortRef.current?.abort();
        const controller = new AbortController();
        autocompleteAbortRef.current = controller;
        const res = await fetch("/api/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: query }),
          signal: controller.signal
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || "Address suggestions unavailable.");
        }
        const nextSuggestions = Array.isArray(payload?.results)
          ? payload.results
              .map((item: any) => ({
                id: String(item?.id || item?.label || ""),
                label: String(item?.label || ""),
                placeTypes: Array.isArray(item?.placeTypes) ? item.placeTypes.map(String).filter(Boolean) : []
              }))
              .filter((item: AddressSuggestion) => item.id && item.label)
          : [];
        setAddressSuggestions(nextSuggestions);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setMapsError("Address suggestions unavailable.");
          setAddressSuggestions([]);
        }
      } finally {
        setAddressSearching(false);
      }
    }, 250);

    return () => {
      if (autocompleteTimerRef.current) {
        clearTimeout(autocompleteTimerRef.current);
      }
    };
  }, [addressInput, view]);

  useEffect(() => {
    if (themeMode !== "auto") return;
    const interval = setInterval(() => {
      const hour = new Date().getHours();
      const nextTheme = hour >= 19 || hour < 6 ? "dark" : "light";
      setTheme((prev) => {
        if (prev === nextTheme) return prev;
        if (nextTheme === "dark") {
          document.body.classList.add("dark");
        } else {
          document.body.classList.remove("dark");
        }
        localStorage.setItem(THEME_KEY, nextTheme);
        return nextTheme;
      });
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [themeMode]);

  useEffect(() => {
    if (step !== "valuation") return;
    if (data.valuation.average) {
      setValuationStage("result");
    } else {
      setValuationStage("idle");
      setValuationProgress(0);
      setValuationLog([]);
    }
  }, [step, data.valuation.average]);

  const addMessage = (role: "assistant" | "user", content: string) => {
    setPostStepMessages((prev) => [...prev, { id: uid(), role, content }]);
  };

  const captureStepPromptSnapshot = () => {
    const prompt = getStepRepeatPrompt(step);
    if (!prompt) return;
    const last = lastPromptSnapshotRef.current;
    if (last && last.step === step && last.prompt === prompt) return;
    setPostStepMessages((prev) => [...prev, { id: uid(), role: "assistant", content: prompt }]);
    lastPromptSnapshotRef.current = { step, prompt };
  };

  const resetSession = () => {
    setView("landing");
    setStep("confirm");
    setMessages([]);
    setPostStepMessages([]);
    setData(DEFAULT_DATA);
    setAddressInput("");
    setPlaceTypes([]);
    setFeedback(null);
    setMapsError(null);
    setActivationLink(null);
    setActivationCode(null);
    setActivationInput("");
    setEmailVerified(false);
    setActivationMocked(false);
    setReportOpen(false);
    setReportMessage("");
    setReportEmail("");
    setReportSending(false);
    setInfoPrompt(null);
    setValuationSkipped(false);
    setLastValuationAt(null);
    setValuationLog([]);
    setValuationRunning(false);
    setValuationStage("idle");
    setValuationProgress(0);
    setCustomPriceInput("");
    setCustomReasonInput("");
    setCustomPriceError(null);
    setCustomReasonError(null);
    setIntroComplete(false);
    if (valuationTimerRef.current) {
      clearInterval(valuationTimerRef.current);
      valuationTimerRef.current = null;
    }
    if (typeof window !== "undefined" && autocompleteRef.current) {
      const google = (window as any).google;
      if (google?.maps?.event?.clearInstanceListeners) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    }
  };

  const handleNewListing = () => {
    resetSession();
    setTimeout(() => {
      addressInputRef.current?.focus();
    }, 50);
  };

  const startChatFlow = (address: string, details?: ListingData["details"]) => {
    setMessages([]);
    setPostStepMessages([]);
    setStep("intro");
    setView("chat");
    setIntroComplete(false);
    setValuationLog([]);
    setValuationRunning(false);
    setValuationSkipped(false);
  };

  const notifyAddressStarted = (address: string) => {
    fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "admin_address_started",
        address,
        pageUrl: typeof window !== "undefined" ? window.location.href : ""
      })
    }).catch(() => null);
  };

  const handleAddressLookup = async (overrideAddress?: string, overridePlaceTypes?: string[]) => {
    const addressToLookup = (overrideAddress ?? addressInput).trim();
    if (!addressToLookup || addressToLookup.length < 5) {
      setFeedback("Please enter a full property address.");
      return;
    }
    const lookupPlaceTypes = overridePlaceTypes ?? placeTypes;
    setLoading(true);
    setFeedback("Finding property details...");
    const lookupKey = `seller_ai_property_${PROPERTY_LOOKUP_CACHE_VERSION}_${hashString(`${addressToLookup}:${lookupPlaceTypes.join(",")}`)}`;
    const cachedLookup = (() => {
      if (typeof window === "undefined") return null;
      try {
        const raw = localStorage.getItem(lookupKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.ts || !parsed?.payload) return null;
        if (Date.now() - parsed.ts > LOCAL_CACHE_TTL_MS) {
          localStorage.removeItem(lookupKey);
          return null;
        }
        return parsed.payload;
      } catch {
        return null;
      }
    })();
    if (cachedLookup?.address && cachedLookup?.details) {
      const resolvedAddress = cachedLookup.address;
      const updatedDetails = { ...data.details, ...cachedLookup.details };
      const nextData = {
        ...data,
        address: resolvedAddress,
        propertyLookupVersion: PROPERTY_LOOKUP_CACHE_VERSION,
        details: updatedDetails,
        census: cachedLookup.census || data.census,
        propertyPhoto: cachedLookup.propertyPhoto
      };
      setData(nextData);
      setAddressInput(resolvedAddress);
      setListingHistory((prev) => {
        const existing = prev.find((item) => item.address === resolvedAddress);
        const filtered = prev.filter((item) => item.address !== resolvedAddress);
        const entry = existing
          ? { ...existing, address: resolvedAddress, data: nextData, updatedAt: Date.now() }
          : { id: uid(), address: resolvedAddress, data: nextData, updatedAt: Date.now() };
        return [entry, ...filtered].slice(0, 8);
      });
      setFeedback(null);
      notifyAddressStarted(resolvedAddress);
      startChatFlow(resolvedAddress, updatedDetails);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addressToLookup, placeTypes: lookupPlaceTypes })
      });
      const payload = await res.json();
      const resolvedAddress = payload?.address || addressInput.trim();
      const updatedDetails = payload?.details ? { ...data.details, ...payload.details } : data.details;
      const census = payload?.census || undefined;
      const propertyPhoto = payload?.propertyPhoto || undefined;
      const nextData = {
        ...data,
        address: resolvedAddress,
        propertyLookupVersion: PROPERTY_LOOKUP_CACHE_VERSION,
        details: updatedDetails,
        census,
        propertyPhoto
      };
      setData(nextData);
      setAddressInput(resolvedAddress);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(lookupKey, JSON.stringify({ ts: Date.now(), payload: { address: resolvedAddress, details: updatedDetails, census, propertyPhoto } }));
        } catch {
          // ignore cache errors
        }
      }
      setListingHistory((prev) => {
        const existing = prev.find((item) => item.address === resolvedAddress);
        const filtered = prev.filter((item) => item.address !== resolvedAddress);
        const entry = existing
          ? { ...existing, address: resolvedAddress, data: nextData, updatedAt: Date.now() }
          : { id: uid(), address: resolvedAddress, data: nextData, updatedAt: Date.now() };
        return [entry, ...filtered].slice(0, 8);
      });
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: resolvedAddress })
      }).catch(() => null);
      setFeedback(null);
      notifyAddressStarted(resolvedAddress);
      startChatFlow(resolvedAddress, updatedDetails);
    } catch {
      setFeedback("Could not fetch details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    const nextAddress = suggestion.label.trim();
    if (!nextAddress) return;
    const nextPlaceTypes = suggestion.placeTypes || [];
    setAddressInput(nextAddress);
    setAddressSuggestions([]);
    setMapsError(null);
    setPlaceTypes(nextPlaceTypes);
    handleAddressLookup(nextAddress, nextPlaceTypes);
  };

  useEffect(() => {
    if (!data.address) return;
    setListingHistory((prev) => {
      const index = prev.findIndex((item) => item.address === data.address);
      if (index === -1) {
        const entry: ListingHistoryItem = {
          id: uid(),
          address: data.address,
          data,
          updatedAt: Date.now()
        };
        return [entry, ...prev].slice(0, 8);
      }
      const next = [...prev];
      next[index] = { ...next[index], data, updatedAt: Date.now() };
      return next;
    });
  }, [data]);

  const openListing = (item: ListingHistoryItem, mode: "view" | "edit" = "view") => {
    const summary = getPropertySummaryText(item.data.details);
    const baseMessages: ChatMessage[] = [
      {
        id: uid(),
        role: "assistant",
        content: "Hi! I’m your SellerAI agent. I’ll guide you through pricing, prep, and launch."
      },
      {
        id: uid(),
        role: "assistant",
        content: `I pulled the basics for ${item.address}. Here’s what I found: ${summary}. Is this correct?`
      }
    ];
    if (mode === "edit") {
      baseMessages.push({
        id: uid(),
        role: "assistant",
        content: "Update the details below — your edits override the findings."
      });
    }
    setData(item.data);
    setAddressInput(item.address);
    setMessages(baseMessages);
    setPostStepMessages([]);
    setStep(mode === "edit" ? "details" : "confirm");
    setView("chat");
    setValuationLog([]);
    setValuationRunning(false);
    setValuationStage(item.data.valuation?.average ? "result" : "idle");
    setValuationProgress(0);
  };

  const deleteListing = (id: string) => {
    setListingHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const runValuation = async (): Promise<number | null> => {
    if (!data.address) return null;
    if (valuationRunning) return null;
    if (lastValuationAt && Date.now() - lastValuationAt < VALUATION_COOLDOWN_MS) {
      setFeedback("Please wait a moment before running another valuation.");
      return null;
    }
    setLoading(true);
    setValuationRunning(true);
    setValuationStage("running");
    setValuationProgress(0);
    setFeedback("Running valuation...");
    let price: number | null = null;
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    try {
      setValuationSkipped(false);
      const valuationCacheKey = `seller_ai_valuation_${VALUATION_CACHE_VERSION}_${hashString(JSON.stringify({ address: data.address, details: data.details, census: data.census }))}`;
      if (typeof window !== "undefined") {
        try {
          const cachedRaw = localStorage.getItem(valuationCacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached?.ts && cached?.payload && Date.now() - cached.ts < LOCAL_CACHE_TTL_MS) {
              const cachedPayload = cached.payload;
              price = Number(cachedPayload.suggested || cachedPayload.price) || null;
      setData((prev) => ({
        ...prev,
        valuation: {
          gemini: cachedPayload.geminiEstimate,
          openai: cachedPayload.openaiEstimate,
          free: cachedPayload.freeEstimate,
          average: price ?? undefined,
          rangeLow: cachedPayload.rangeLow,
          rangeHigh: cachedPayload.rangeHigh,
          report: cachedPayload.report,
          comps: cachedPayload.comps || [],
          rentalComps: cachedPayload.rentalComps || [],
          market: cachedPayload.market || undefined,
          replacementExamples: cachedPayload.replacementExamples || []
        },
        finalPrice: prev.finalPrice ?? price
      }));
              setFeedback(null);
              addMessage("assistant", "Using the most recent valuation on file.");
              setValuationStage("result");
              setLastValuationAt(Date.now());
              return price;
            }
          }
        } catch {
          // ignore cache errors
        }
      }
      const startTime = Date.now();
      if (valuationTimerRef.current) {
        clearInterval(valuationTimerRef.current);
      }
      const dramaLines = buildValuationDrama(data.address, data.details);
      setValuationLog(dramaLines.length ? [dramaLines[0]] : []);
      let lineIndex = 1;
      valuationTimerRef.current = setInterval(() => {
        if (lineIndex < dramaLines.length) {
          setValuationLog((prev) => [...prev, dramaLines[lineIndex]]);
          lineIndex += 1;
        }
      }, 3000);
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, Math.round((elapsed / MIN_VALUATION_MS) * 100));
        setValuationProgress(progress);
        if (progress >= 100) {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        }
      }, 1000);

      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: data.address, details: data.details, census: data.census })
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        setFeedback(errPayload?.error || "Valuation failed. Please retry.");
        return null;
      }
      const payload = await res.json();
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_VALUATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_VALUATION_MS - elapsed));
      }
      price = Number(payload.suggested || payload.price) || null;
      setData((prev) => ({
        ...prev,
        valuation: {
          gemini: payload.geminiEstimate,
          openai: payload.openaiEstimate,
          manus: payload.manusEstimate,
          free: payload.freeEstimate,
          average: price ?? undefined,
          rangeLow: payload.rangeLow,
          rangeHigh: payload.rangeHigh,
          report: payload.report,
          comps: payload.comps || [],
          rentalComps: payload.rentalComps || [],
          market: payload.market || undefined,
          replacementExamples: payload.replacementExamples || []
        },
        finalPrice: prev.finalPrice ?? price
      }));
      setFeedback(null);
      setValuationStage("result");
      if (typeof window !== "undefined") {
        try {
          const cacheKey = `seller_ai_valuation_${VALUATION_CACHE_VERSION}_${hashString(JSON.stringify({ address: data.address, details: data.details, census: data.census }))}`;
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), payload }));
        } catch {
          // ignore cache errors
        }
      }
      setLastValuationAt(Date.now());
      setValuationLog((prev) => [
        ...prev,
        "Finalizing the working pricing range and summary…"
      ]);
    } catch {
      setFeedback("Valuation failed. Please retry.");
    } finally {
      setLoading(false);
      setValuationRunning(false);
      setValuationProgress(100);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (valuationTimerRef.current) {
        clearInterval(valuationTimerRef.current);
        valuationTimerRef.current = null;
      }
    }
    return price;
  };

  const getSuggestedValue = () => data.valuation.average ?? null;

  const handleValuationStart = async () => {
    if (!data.valuation.average) {
      await runValuation();
      return;
    }
    setValuationStage("result");
  };

  const handleValuationAccept = () => {
    const suggested = getSuggestedValue();
    if (!suggested) return;
    setData((prev) => ({ ...prev, finalPrice: suggested }));
    addMessage("user", "Yes! That sounds right.");
    addMessage(
      "assistant",
      "Great. We’ll treat this as an estimate for now. The final Listing Price can be changed later; this number helps us prepare the Listing Agreement and keep the workflow moving."
    );
    setStep("acknowledgements");
  };

  const handleValuationDetails = () => {
    if (valuationStage === "result") {
      setMessages((prev) => {
        const next = [...prev];
        const snapshot = buildValuationSnapshot();
        if (snapshot) {
          next.push({ id: uid(), role: "assistant", content: snapshot });
        }
        next.push({ id: uid(), role: "user", content: "Show me the details." });
        return next;
      });
    }
    setValuationStage("details");
  };

  const handleValuationCustom = () => {
    setCustomPriceInput("");
    setCustomReasonInput("");
    setCustomPriceError(null);
    setCustomReasonError(null);
    if (valuationStage === "result") {
      setMessages((prev) => {
        const next = [...prev];
        const snapshot = buildValuationSnapshot();
        if (snapshot) {
          next.push({ id: uid(), role: "assistant", content: snapshot });
        }
        next.push({ id: uid(), role: "user", content: "This is not the right price. I will set myself." });
        return next;
      });
    }
    setValuationStage("custom");
  };

  const submitCustomPrice = () => {
    const suggested = getSuggestedValue();
    const numeric = Number(customPriceInput.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setCustomPriceError("Enter a valid price.");
      return;
    }
    setCustomPriceError(null);
    if (!suggested) {
      setData((prev) => ({ ...prev, finalPrice: numeric }));
      addMessage("user", `My target price is $${numeric.toLocaleString()}.`);
      addMessage(
        "assistant",
        "Great. We’ll treat this as an estimate for now. The final Listing Price can be changed later; this number helps us prepare the Listing Agreement and keep the workflow moving."
      );
      setStep("acknowledgements");
      return;
    }
    const delta = Math.abs(numeric - suggested) / suggested;
    if (delta <= 0.2) {
      setData((prev) => ({ ...prev, finalPrice: numeric }));
      addMessage("user", `My target price is $${numeric.toLocaleString()}.`);
      addMessage(
        "assistant",
        "Great. We’ll treat this as an estimate for now. The final Listing Price can be changed later; this number helps us prepare the Listing Agreement and keep the workflow moving."
      );
      setStep("acknowledgements");
      return;
    }
    setData((prev) => ({ ...prev, finalPrice: numeric }));
    addMessage("user", `My target price is $${numeric.toLocaleString()}.`);
    addMessage(
      "assistant",
      "That’s quite far from the estimated value. Can I ask what you base your property’s value on? You can share comps, addresses, or your reasoning."
    );
    setValuationStage("reason");
  };

  const isReasoningLogical = (text: string) => {
    const normalized = text.toLowerCase();
    const signals = [
      "comp",
      "sale",
      "sold",
      "address",
      "appraisal",
      "renovation",
      "upgrade",
      "addition",
      "permits",
      "rent",
      "lease",
      "income",
      "cap rate",
      "tax",
      "assessment",
      "zillow",
      "redfin",
      "realtor",
      "agent",
      "market",
      "recent",
      "offer"
    ];
    return signals.some((signal) => normalized.includes(signal));
  };

  const submitCustomReason = () => {
    if (!customReasonInput.trim()) {
      setCustomReasonError("Share a quick explanation or comps to continue.");
      return;
    }
    setCustomReasonError(null);
    const reasoningOk = isReasoningLogical(customReasonInput);
    addMessage("user", customReasonInput);
    if (reasoningOk) {
      addMessage("assistant", "Got it — that’s a solid rationale. We’ll work with your target price.");
    } else {
      addMessage(
        "assistant",
        "Thanks for sharing. Even if the market view is different, we’ll proceed with your target price and can adjust later if needed."
      );
    }
    addMessage("assistant", "We can still adjust later, but we’ll proceed with your target for now.");
    setStep("acknowledgements");
  };

  const submitProblemReport = async () => {
    if (!reportMessage.trim()) {
      setFeedback("Please add a short description of the issue.");
      return;
    }
    setReportSending(true);
    setFeedback(null);
    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : "";
      const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "";
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "admin_problem_report",
          address: data.address,
          name: data.seller.name || "Seller",
          requesterEmail: reportEmail || data.seller.email,
          message: reportMessage,
          step,
          appVersion: APP_VERSION,
          pageUrl,
          userAgent
        })
      });
      addMessage("assistant", "Thanks — your report was sent to the team.");
      setReportMessage("");
      setReportOpen(false);
    } catch {
      setFeedback("Could not send the report. Please try again.");
    } finally {
      setReportSending(false);
    }
  };

  const handleInfoPromptYes = () => {
    captureStepPromptSnapshot();
    addMessage("user", "Yes");
    setInfoPrompt(null);
    addMessage("assistant", getStepRepeatPrompt(step));
  };

  const handleInfoPromptNo = () => {
    if (!infoPrompt) return;
    captureStepPromptSnapshot();
    addMessage("user", "No, please tell me more.");
    addMessage("assistant", infoPrompt.moreDetails);
  };

  const sendActivationEmail = async () => {
    if (!data.seller.email) {
      setFeedback("Please enter your email.");
      return;
    }
    setLoading(true);
    setFeedback("Sending activation code...");

    // Prefer Supabase email OTP when configured: same seller experience,
    // but verification creates a real authenticated session.
    if (isServerAuthAvailable()) {
      const otp = await sendAuthOtp(data.seller.email);
      if (otp.sent) {
        setSupabaseOtpActive(true);
        setActivationCode(null);
        setActivationLink(null);
        setActivationMocked(false);
        setActivationInput("");
        setFeedback("Activation code sent.");
        addMessage("assistant", `Activation code sent to ${data.seller.email}.`);
        setLoading(false);
        return;
      }
      setSupabaseOtpActive(false);
    }

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: data.seller.email,
          type: "activation_code",
          name: data.seller.name || "Seller",
          address: data.address
        })
      });
      const payload = await res.json();
      if (payload?.activationCode) {
        setActivationCode(String(payload.activationCode));
      }
      if (payload?.activationUrl) {
        setActivationLink(payload.activationUrl);
      }
      setActivationMocked(Boolean(payload?.mocked));
      setActivationInput("");
      if (payload?.mocked) {
        setFeedback("Email provider not configured. Showing the code below for now.");
        addMessage(
          "assistant",
          "Email isn’t configured yet, so I’m showing the activation code below for now."
        );
      } else {
        setFeedback("Activation code sent.");
        addMessage("assistant", `Activation code sent to ${data.seller.email}.`);
      }
    } catch {
      setFeedback("Email failed to send. Try again.");
      addMessage("assistant", "That email didn’t go through. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyActivationCode = async () => {
    if (supabaseOtpActive) {
      if (!activationInput.trim()) {
        setFeedback("Enter the code from your email.");
        return;
      }
      setLoading(true);
      const result = await verifyAuthOtp(data.seller.email, activationInput);
      setLoading(false);
      if (!result.verified) {
        setFeedback("That code doesn’t match. Please try again.");
        return;
      }
      setEmailVerified(true);
      setFeedback("Email verified.");
      handleActivationContinue();
      return;
    }
    if (!activationCode) {
      setFeedback("Send the activation code first.");
      return;
    }
    if (activationInput.trim() !== activationCode.trim()) {
      setFeedback("That code doesn’t match. Please try again.");
      return;
    }
    setEmailVerified(true);
    setFeedback("Email verified.");
    handleActivationContinue();
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setThemeMode("manual");
    if (nextTheme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, nextTheme);
    localStorage.setItem(THEME_MODE_KEY, "manual");
  };

  const normalizeBedrooms = (value: string | number) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.floor(num));
  };

  const normalizeBathrooms = (value: string | number) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    const rounded = Math.round(num * 2) / 2;
    return Math.max(0, rounded);
  };

  const isLikelyQuestion = (text: string) => {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return false;
    if (trimmed.includes("?")) return true;
    return /^(what|why|how|can|do|does|is|are|should|could|would|where|when|who)\b/.test(trimmed);
  };

  const updateDetails = (patch: Partial<ListingData["details"]>) => {
    setData((prev) => ({
      ...prev,
      details: { ...prev.details, ...patch }
    }));
  };

  const handlePropertyTypeChange = (nextType: ListingData["details"]["propertyType"]) => {
    const nextFeatures =
      nextType === "industrial"
        ? INDUSTRIAL_FEATURES
        : nextType === "commercial"
        ? COMMERCIAL_FEATURES
        : RES_FEATURES;

    setData((prev) => ({
      ...prev,
      details: {
        ...prev.details,
        propertyType: nextType,
        features: prev.details.features.filter((feature) =>
          nextFeatures.some((item) => item.toLowerCase() === feature.toLowerCase())
        ),
        bedrooms: nextType === "residential" ? prev.details.bedrooms || 0 : 0,
        bathrooms: nextType === "residential" ? prev.details.bathrooms || 0 : 0,
        useType:
          nextType === "industrial"
            ? "industrial"
            : nextType === "commercial"
            ? prev.details.useType || "retail"
            : prev.details.useType,
        units: nextType === "residential" ? 1 : prev.details.units || 1,
        leaseType: nextType === "residential" ? "n/a" : prev.details.leaseType || "gross",
        occupancy: nextType === "residential" ? "owner-occupied" : prev.details.occupancy
      }
    }));
  };

  const formatKnownNumber = (value?: number | null, suffix = "") => {
    if (!value || !Number.isFinite(value) || value <= 0) return "unknown";
    return `${Number(value).toLocaleString()}${suffix}`;
  };

  const getPropertySummaryText = (details: ListingData["details"]) =>
    details.propertyType === "residential"
      ? `${details.propertyType} • ${formatKnownNumber(details.bedrooms)} bd • ${formatKnownNumber(
          details.bathrooms
        )} ba • ${formatKnownNumber(details.squareFeet, " sqft")}`
      : `${details.propertyType} • ${details.useType} • ${formatKnownNumber(details.units)} unit${
          details.units === 1 ? "" : "s"
        } • ${formatKnownNumber(details.squareFeet, " sqft")}`;

  const handleIntroContinue = () => {
    addMessage("user", "Let’s get started.");
    addMessage(
      "assistant",
      `First, I checked what type of property this appears to be and pulled the basic facts that affect pricing. Here’s what I found for ${data.address}: ${getPropertySummaryText(data.details)}.`
    );
    setStep("confirm");
  };

  const handleConfirmYes = () => {
    addMessage("user", "Yes, that looks correct.");
    addMessage(
      "assistant",
      "Great. Next, we’ll add the value signals a data source might miss: condition, parking, air, finishes, loading access, and other features buyers actually care about."
    );
    setStep("features");
  };

  const handleConfirmNo = () => {
    addMessage("user", "No, I need to correct the details.");
    addMessage("assistant", "No problem — update the details below. Your changes will overwrite the findings.");
    setStep("details");
  };

  const handleDetailsConfirm = () => {
    addMessage("user", `Confirmed details for ${data.address}.`);
    addMessage(
      "assistant",
      "Perfect. Now let’s add the features and condition notes that can move value up or down."
    );
    setStep("features");
  };

  const handleFeaturesContinue = () => {
    addMessage("user", `Selected ${data.details.features.length} feature${data.details.features.length === 1 ? "" : "s"}.`);
    addMessage(
      "assistant",
      "Now I’ll run a pricing estimate. This is not the final listing price. It gives us a realistic working number for the next steps and for preparing the Listing Agreement."
    );
    setStep("valuation");
  };

  const handleAddonsContinue = () => {
    const count = data.addons.length;
    addMessage("user", `Add-ons selected: ${count ? count : "none"}.`);
    addMessage("assistant", "Next, please confirm acknowledgements and seller contact details.");
    setStep("acknowledgements");
  };

  const requestConsumerNoticeFromAdmin = async ({
    renotify = false,
    officialOwner = data.paperwork.officialOwner
  }: { renotify?: boolean; officialOwner?: boolean | null } = {}) => {
    const name = data.seller.name.trim();
    const email = data.seller.email.trim();
    const phone = data.seller.phone.trim();

    if (!name) {
      setFeedback("Please add the seller name first.");
      return false;
    }
    if (!email || !email.includes("@")) {
      setFeedback("Please add a valid seller email.");
      return false;
    }
    if (typeof officialOwner !== "boolean") {
      setFeedback("Please confirm whether you are the official owner.");
      return false;
    }

    setLoading(true);
    setFeedback(renotify ? "Notifying agent again..." : "Notifying agent...");
    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : "";
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "admin_consumer_notice",
          address: data.address,
          name,
          requesterEmail: email,
          phone,
          officialOwner,
          ownerRole: officialOwner ? "Official owner" : "Representative / not official owner",
          finalPrice: data.finalPrice || data.valuation.average || null,
          pageUrl
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not notify agent.");
      }
      setData((prev) => ({
        ...prev,
        paperwork: {
          ...prev.paperwork,
          ownerRole: officialOwner ? "owner" : "representative",
          officialOwner,
          consumerNoticeStatus: "requested"
        }
      }));
      if (renotify) {
        addMessage("user", "Please notify agent again.");
      }
      addMessage(
        "assistant",
        payload?.mocked
          ? "Your Consumer Notice request is recorded. The Agent will prepare the eSign package and send it to your email."
          : "Your Consumer Notice request was sent. The Agent will prepare the eSign package and send it to your email."
      );
      setStep("consumer-wait");
      setFeedback("Consumer Notice email request sent.");
      return true;
    } catch {
      setFeedback("Could not notify the agent. Please try again.");
      addMessage("assistant", "I couldn’t notify the agent yet. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgementsContinue = async () => {
    const officialOwner = data.paperwork.officialOwner;
    if (!data.seller.name.trim()) {
      setFeedback("Please add your full name.");
      return;
    }
    if (!data.seller.email.trim() || !data.seller.email.includes("@")) {
      setFeedback("Please add a valid email.");
      return;
    }
    if (typeof officialOwner !== "boolean") {
      setFeedback("Please answer whether you are the official owner.");
      return;
    }

    addMessage(
      "user",
      `Seller info submitted. Official owner: ${officialOwner ? "yes" : "no"}.`
    );
    addMessage(
      "assistant",
      "Next is the Pennsylvania Consumer Notice. It is not a contract; it is a required disclosure step. I’ll ask the agent to send it by DocuSign and keep this file pending until the agent releases it."
    );
    await requestConsumerNoticeFromAdmin({ officialOwner });
  };

  const handleFinalPriceContinue = () => {
    if (!data.finalPrice) {
      setFeedback("Please enter the working estimate for the agreement.");
      return;
    }
    addMessage("user", `Working estimate for agreement: $${data.finalPrice.toLocaleString()}.`);
    addMessage("assistant", "We’re ready to verify your email before paperwork.");
    setStep("activation");
  };

  const handlePhotosContinue = () => {
    addMessage("user", `${data.photos.length} photo${data.photos.length === 1 ? "" : "s"} added.`);
    addMessage("assistant", "Tell me how you want the listing description to read.");
    setStep("description");
  };

  const handleDescriptionContinue = () => {
    addMessage("user", "Description drafted.");
    addMessage("assistant", "Great. Your dashboard is ready with next steps.");
    setStep("dashboard");
  };

  const handleSigningContinue = () => {
    if (!data.seller.name.trim()) {
      setFeedback("Please type your name to sign.");
      return;
    }
    addMessage("user", "Signed and ready to activate.");
    addMessage("assistant", "We’ll send your activation email and then move you to the dashboard.");
    setStep("activation");
  };

  const handleActivationContinue = () => {
    setData((prev) => ({ ...prev, activated: true }));
    addMessage("user", "Listing activated.");
    addMessage("assistant", "Consumer Notice is complete. Now we can prepare the listing agreement details.");
    setStep("listing-intro");
  };

  const pushInfo = (userText: string, assistantText: string) => {
    addMessage("user", userText);
    addMessage("assistant", assistantText);
  };

  const pushInfoPrompt = (userText: string, assistantText: string, followUp?: string, moreDetails?: string) => {
    addMessage("user", userText);
    addMessage("assistant", assistantText);
    setInfoPrompt({
      id: uid(),
      followUp: followUp || "Shall we continue?",
      moreDetails: moreDetails || assistantText
    });
  };

  const skipValuationToFinalPrice = () => {
    addMessage("user", "I already know my target price.");
    addMessage("assistant", "Perfect — enter it below. We can refine after reviewing comps.");
    setValuationSkipped(true);
    setValuationStage("custom");
  };

  const useSuggestedPrice = () => {
    if (!data.valuation.average) {
      addMessage("assistant", "Run valuation first or enter your own price below.");
      return;
    }
    setData((prev) => ({ ...prev, finalPrice: prev.finalPrice ?? data.valuation.average ?? null }));
    addMessage("user", "Use suggested price.");
    addMessage("assistant", "Applied. Adjust if needed, then continue.");
  };

  const skipAddons = () => {
    setData((prev) => ({ ...prev, addons: [] }));
    addMessage("user", "Skip add-ons for now.");
    addMessage("assistant", "No problem — you can add them later.");
    setStep("acknowledgements");
  };

  const generateDescriptionDraft = () => {
    const typeLabel =
      data.details.propertyType === "residential" ? "home" : `${data.details.useType} ${data.details.propertyType}`;
    const bedBath =
      data.details.propertyType === "residential"
        ? `${formatKnownNumber(data.details.bedrooms)} bed, ${formatKnownNumber(data.details.bathrooms)} bath`
        : `${data.details.units} unit${data.details.units === 1 ? "" : "s"}`;
    const highlights = data.details.features.slice(0, 3).join(", ");
    const conditionNote =
      data.details.condition === "new" || data.details.condition === "great"
        ? "Beautifully maintained"
        : data.details.condition === "fixer" || data.details.condition === "rehab"
        ? "Full of potential"
        : "Well cared for";
    const draft = `${conditionNote} ${typeLabel} at ${data.address} offering ${bedBath}${
      data.details.squareFeet ? ` and about ${formatKnownNumber(data.details.squareFeet, " sqft")}` : ""
    }. ${
      highlights ? `Highlights include ${highlights}. ` : ""
    }Perfect for buyers seeking a smart blend of location, condition, and value.`;
    setData((prev) => ({ ...prev, description: draft }));
    addMessage("assistant", "Drafted a starter description below. Edit it to match your voice.");
  };

  const handleOwnerRoleSelect = (role: "owner" | "representative") => {
    const officialOwner = role === "owner";
    setData((prev) => ({
      ...prev,
      paperwork: {
        ...prev.paperwork,
        ownerRole: role,
        officialOwner
      }
    }));
    addMessage("user", role === "owner" ? "I’m the owner." : "I’m a representative.");
    addMessage(
      "assistant",
      "First, I’ll notify the Agent to send the Pennsylvania Consumer Notice through DocuSign."
    );
    requestConsumerNoticeFromAdmin({ officialOwner });
  };

  const sendConsumerNotice = async () => {
    if (!data.seller.email) {
      setFeedback("Please add your email so we can send the Consumer Notice.");
      return;
    }
    setLoading(true);
    setFeedback("Sending consumer notice...");
    try {
      const res = await fetch("/api/consumer-notice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerEmail: data.seller.email,
          signerName: data.seller.name || "Seller",
          address: data.address
        })
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not send consumer notice.");
      }
      setData((prev) => ({
        ...prev,
        paperwork: {
          ...prev.paperwork,
          consumerNoticeStatus: "sent",
          consumerNoticeUrl: payload?.signUrl || prev.paperwork.consumerNoticeUrl
        }
      }));
      if (payload?.emailSent === false) {
        addMessage(
          "assistant",
          "Consumer Notice ready to sign. Email delivery failed, so use the signing link below."
        );
      } else {
        addMessage("assistant", "Consumer Notice sent. Please review and sign.");
      }
      setStep("consumer-wait");
      setFeedback(null);
    } catch {
      setFeedback("Could not send notice. Please retry.");
      addMessage("assistant", "I couldn’t send the Consumer Notice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const markConsumerNoticeSigned = () => {
    setData((prev) => ({
      ...prev,
      paperwork: { ...prev.paperwork, consumerNoticeStatus: "signed" }
    }));
    addMessage(
      "assistant",
      "Great! Your CN is received. Now let’s move on to preparing your Listing Agreement."
    );
    setStep("listing-intro");
  };

  const handleListingIntroContinue = () => {
    addMessage("user", "I’m ready.");
    addMessage("assistant", "Great. Let’s finalize a few items for the listing agreement.");
    setData((prev) => ({
      ...prev,
      paperwork: {
        ...prev.paperwork,
        mailingAddress: prev.paperwork.mailingAddress || prev.address
      }
    }));
    setStep("listing-details");
  };

  const handleListingDetailsContinue = () => {
    if (!data.finalPrice) {
      setFeedback("Please confirm the final list price.");
      return;
    }
    if (!data.paperwork.mailingAddress.trim()) {
      setFeedback("Please add your mailing address.");
      return;
    }
    if (data.paperwork.brokerFeeConsent === null) {
      setFeedback("Please confirm the broker fee.");
      return;
    }
    setFeedback(null);
    setData((prev) => ({
      ...prev,
      paperwork: { ...prev.paperwork, listingAgreementStatus: "sent" }
    }));
    fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "admin_listing_agreement",
        address: data.address,
        name: data.seller.name || "Seller",
        to: "",
        requesterEmail: data.seller.email,
        phone: data.seller.phone,
        finalPrice: data.finalPrice,
        mailingAddress: data.paperwork.mailingAddress,
        brokerFee: "1%"
      })
    }).catch(() => null);
    addMessage(
      "assistant",
      "Great! I sent the Listing Agreement request to your Agent for review. This can take between 5-60 minutes. We will notify you when ready."
    );
    setStep("listing-wait");
  };

  const handleDualAgencyContinue = () => {
    if (data.paperwork.dualAgencyConsent === null) {
      setFeedback("Please acknowledge the dual agency item.");
      return;
    }
    setFeedback(null);
    addMessage("assistant", "One last question about lead-based paint.");
    setStep("lead-paint");
  };

  const handleLeadPaintContinue = (answer: "yes" | "no") => {
    setData((prev) => ({
      ...prev,
      paperwork: { ...prev.paperwork, builtBefore1978: answer }
    }));
    if (answer === "yes") {
      addMessage(
        "assistant",
        "You will receive a lead-based paint brochure and disclosure as mandated by law for homes built before 1978."
      );
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "admin_lead_paint",
          address: data.address,
          name: data.seller.name || "Seller",
          to: "",
          requesterEmail: data.seller.email
        })
      }).catch(() => null);
    }
    addMessage(
      "assistant",
      "Thanks. We’ll send the listing agreement for e-signature and wait for verification."
    );
    setStep("listing-wait");
  };

  const markListingAgreementSigned = () => {
    setData((prev) => ({
      ...prev,
      paperwork: { ...prev.paperwork, listingAgreementStatus: "signed" }
    }));
    addMessage(
      "assistant",
      "Congrats! You’ve completed the major part of listing your property with an agent for much less."
    );
    addMessage(
      "assistant",
      "Now that we’ve established formal agency, it’s time to start marketing the property online and offline."
    );
    setStep("marketing-intro");
  };

  const handleWaitingConversation = (topic: "buying" | "ask1031" | "notSure" | "no") => {
    captureStepPromptSnapshot();
    if (topic === "buying") {
      addMessage("user", "I’m planning to buy another property.");
      addMessage(
        "assistant",
        "Good to know. A 1031 exchange may let you defer capital gains if you reinvest into another investment property within set timelines. Want the quick overview?"
      );
      return;
    }
    if (topic === "ask1031") {
      addMessage("user", "Tell me about a 1031 exchange.");
      addMessage(
        "assistant",
        "A 1031 exchange can defer capital gains taxes when you sell an investment property and buy another qualified property within IRS timelines. We can outline the basics and connect you with a specialist if you want."
      );
      return;
    }
    if (topic === "notSure") {
      addMessage("user", "Not sure yet.");
      addMessage(
        "assistant",
        "No worries. If you decide to buy again, I can walk you through options like 1031 exchanges."
      );
      return;
    }
    addMessage("user", "Not right now.");
    addMessage("assistant", "Got it. If anything comes up while we wait, just ask.");
  };

  const handleUploadFiles = (files: FileList | null) => {
    const names = Array.from(files || []).map((file) => file.name);
    if (!names.length) return;
    setData((prev) => ({
      ...prev,
      paperwork: { ...prev.paperwork, extraUploads: [...prev.paperwork.extraUploads, ...names] }
    }));
    addMessage("assistant", `Noted ${names.length} file${names.length === 1 ? "" : "s"} for review.`);
  };

  const notifyDocumentUpload = async () => {
    if (!data.paperwork.extraUploads.length) {
      setFeedback("Please add files first.");
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "admin_document_upload",
          address: data.address,
          name: data.seller.name || "Seller",
          requesterEmail: data.seller.email,
          documents: data.paperwork.extraUploads,
          propertyType: data.details.propertyType,
          isMultiFamily: data.paperwork.isMultiFamily
        })
      });
      addMessage("assistant", "Thanks — I notified the team about the uploaded documents.");
      setFeedback(null);
    } catch {
      setFeedback("Could not notify the team. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarketingIntroContinue = () => {
    addMessage("user", "Let’s talk photos.");
    addMessage("assistant", "Great. Upload a few photos to get the listing ready.");
    setStep("photos");
  };

  function buildValuationSnapshot() {
    if (!data.valuation.average) return null;
    const rangeLow = data.valuation.rangeLow ?? data.valuation.average ?? 0;
    const rangeHigh = data.valuation.rangeHigh ?? data.valuation.average ?? 0;
    const lines: string[] = [
      "Pricing input & comps",
      `Estimated range: ${formatCurrency(rangeLow)} – ${formatCurrency(rangeHigh)}`,
      `Suggested pricing input: ${formatCurrency(data.valuation.average)}`
    ];

    if (data.valuation.comps && data.valuation.comps.length > 0) {
      lines.push("Comps:");
      data.valuation.comps.slice(0, 6).forEach((comp) => {
        const parts = [
          comp.address,
          formatCurrency(comp.price),
          comp.sqft ? `${comp.sqft} sqft` : "",
          typeof comp.beds === "number" ? `${comp.beds} bd` : "",
          typeof comp.baths === "number" ? `${comp.baths} ba` : "",
          comp.soldDate ? `Sold ${comp.soldDate}` : "",
          typeof comp.daysOnMarket === "number" ? `DOM ${comp.daysOnMarket}` : "",
          typeof comp.distanceMiles === "number" ? `${comp.distanceMiles} mi` : "",
          comp.condition ? `Condition ${comp.condition}` : "",
          comp.features && comp.features.length ? `Features ${comp.features.slice(0, 3).join(", ")}` : ""
        ].filter(Boolean);
        lines.push(`• ${parts.join(" · ")}`);
      });
    }

    if (data.details.propertyType === "commercial" && data.valuation.market) {
      const market = data.valuation.market;
      lines.push("Commercial market snapshot:");
      if (typeof market.vacancyRate === "number") lines.push(`• Vacancy: ${market.vacancyRate}%`);
      if (typeof market.absorptionRate === "number") lines.push(`• Absorption: ${market.absorptionRate}%`);
      if (market.capRateRange) lines.push(`• Cap rate range: ${market.capRateRange}`);
      if (typeof market.avgDom === "number") lines.push(`• Avg DOM: ${market.avgDom} days`);
      if (market.inventoryLevel) lines.push(`• Inventory: ${market.inventoryLevel}`);
      if (market.submarket) lines.push(`• Submarket: ${market.submarket}`);
      if (market.trendNotes) lines.push(`• ${market.trendNotes}`);
    }

    if (data.details.propertyType === "industrial" && data.valuation.replacementExamples?.length) {
      lines.push("Replacement cost examples:");
      data.valuation.replacementExamples.slice(0, 4).forEach((example) => {
        const parts = [
          example.address,
          formatCurrency(example.cost),
          example.sqft ? `${example.sqft} sqft` : "",
          example.year ? `Year ${example.year}` : "",
          typeof example.distanceMiles === "number" ? `${example.distanceMiles} mi` : ""
        ].filter(Boolean);
        lines.push(`• ${parts.join(" · ")}`);
      });
    }

    return lines.join("\n");
  }

  function buildStepSnapshot(stepToCapture: ChatStep) {
    if (stepToCapture === "valuation") {
      return buildValuationSnapshot();
    }
    if (stepToCapture === "final-price" && data.finalPrice) {
      return `Working agreement estimate set: ${formatCurrency(data.finalPrice)}.`;
    }
    if (stepToCapture === "activation") {
      return "Activation step: Send activation email or skip to continue.";
    }
    if (stepToCapture === "ownership" && data.paperwork.ownerRole) {
      return `Ownership role confirmed: ${data.paperwork.ownerRole}.`;
    }
    if (stepToCapture === "acknowledgements" && typeof data.paperwork.officialOwner === "boolean") {
      return `Seller info captured. Official owner: ${data.paperwork.officialOwner ? "yes" : "no"}.`;
    }
    return null;
  }

  function getStepRepeatPrompt(currentStep: ChatStep) {
    switch (currentStep) {
      case "intro":
        return "Start the seller-readiness review when you are ready.";
      case "valuation":
        if (valuationStage === "custom") {
          return "What price did you have in mind? Enter it below.";
        }
        if (valuationStage === "reason") {
          return "Can you share what you’re basing that value on? Use the box below.";
        }
        if (data.valuation.average) {
          return "Valuation is ready. Choose one of the options below to continue.";
        }
        return "Ready to run pricing? Choose one of the options below to continue.";
      case "final-price":
        return "Confirm the working estimate for the agreement below.";
      case "features":
        return "Select standout features and condition notes below.";
      case "confirm":
        return "Is the property summary correct? Choose an option below.";
      case "details":
        return "Review the property details and confirm below.";
      case "acknowledgements":
        return "Complete the seller info, acknowledgements, and official-owner confirmation below.";
      case "activation":
        return "Send the activation email or choose an option below to continue.";
      case "ownership":
        return "Please choose whether you are the owner or representative below.";
      case "consumer-notice":
        return "Please choose an option below for the Consumer Notice.";
      case "consumer-wait":
        return "Pending Agent Consumer Notice approval. The Agent must send the DocuSign Consumer Notice and approve the file before the workflow continues.";
      case "listing-intro":
        return "Ready to prep the listing agreement? Choose below.";
      case "listing-details":
        return "Finalize the listing agreement details below.";
      case "dual-agency":
        return "Please acknowledge dual agency below.";
      case "lead-paint":
        return "Was the home built before 1978? Choose below.";
      case "listing-wait":
        return "Waiting for the listing agreement signature. Use the options below or ask anything while we wait.";
      case "marketing-intro":
        return "Ready to start marketing? Choose below.";
      case "photos":
        return "Upload photos when you’re ready.";
      case "description":
        return "Add a short property description below.";
      default:
        return "Please choose one of the options below to continue.";
    }
  }

  const handleChatSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = chatInput.trim();
    if (!value) return;
    if (chatting) return;
    const lowerValue = value.toLowerCase();
    const cardOnlySteps = new Set([
      "confirm",
      "details",
      "features",
      "valuation",
      "intro",
      "acknowledgements",
      "final-price",
      "activation",
      "ownership",
      "consumer-notice",
      "consumer-wait",
      "listing-intro",
      "listing-details",
      "dual-agency",
      "lead-paint",
      "listing-wait",
      "marketing-intro",
      "photos",
      "description"
    ]);

    if (step === "intro" && /(start|begin|go|ready|yes|continue)/.test(lowerValue)) {
      setChatInput("");
      handleIntroContinue();
      return;
    }
    if (step === "features" && /(continue|next|done|run|pricing)/.test(lowerValue)) {
      setChatInput("");
      handleFeaturesContinue();
      return;
    }
    if (step === "valuation" && /(continue|next|go|run)/.test(lowerValue)) {
      setChatInput("");
      handleValuationStart();
      return;
    }
    if (step === "final-price" && /(suggested|use suggested)/.test(lowerValue)) {
      setChatInput("");
      useSuggestedPrice();
      return;
    }
    if (infoPrompt && /(yes|yep|yeah|sure|ok|okay)/.test(lowerValue)) {
      setChatInput("");
      handleInfoPromptYes();
      return;
    }
    if (infoPrompt && /(no|nope|not yet|tell me more|more)/.test(lowerValue)) {
      setChatInput("");
      handleInfoPromptNo();
      return;
    }
    if (cardOnlySteps.has(step) && !isLikelyQuestion(value)) {
      captureStepPromptSnapshot();
      addMessage("user", value);
      addMessage("assistant", getStepRepeatPrompt(step));
      setChatInput("");
      return;
    }

    const combinedHistory = [...messages, ...postStepMessages];
    const history = [
      ...combinedHistory.slice(-6).map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: value }
    ];
    addMessage("user", value);
    setChatInput("");
    setChatting(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: value,
          history,
          context: {
            step,
            address: data.address,
            details: data.details,
            addons: data.addons,
            finalPrice: data.finalPrice,
            valuation: data.valuation,
            seller: data.seller
          }
        })
      });
      const payload = await res.json();
      const reply = payload?.reply || "Thanks! I captured that. Let me know if you want to continue.";
      addMessage("assistant", reply);
    } catch {
      addMessage(
        "assistant",
        "Thanks! I captured that note. If you have a question, ask away or use the step card to continue."
      );
    } finally {
      setChatting(false);
    }
  };

  const totalAddonCost = data.addons.reduce((sum, id) => {
    const addon = ADDONS.find((item) => item.id === id);
    return sum + (addon?.price || 0);
  }, 0);

  const formatCurrency = (value?: number | null) => {
    if (!value || !Number.isFinite(value)) return "—";
    return `$${Number(value).toLocaleString()}`;
  };

  function buildValuationDrama(address: string, details: ListingData["details"]) {
    const lines: string[] = [
      "Collecting recent closed sales in the area…",
      "Scanning active listings and pending contracts…",
      "Comparing square footage, beds/baths, and condition…",
      "Checking proximity to schools, parks, and transit…",
      "Reviewing price reductions and days-on-market trends…",
      "Normalizing for upgrades and unique features…",
      "Cross-checking public records and tax data…",
      "Reviewing local inventory and listing context…"
    ];

    if (details.condition === "new" || details.condition === "great") {
      lines.push("Condition rating looks strong and should be reviewed in the pricing context.");
    } else if (details.condition === "fixer" || details.condition === "rehab") {
      lines.push("Accounting for needed repairs and renovation costs.");
    }

    if (details.features.includes("Central air")) {
      lines.push("Central air adds a measurable premium in many comps.");
    }
    if (details.features.some((f) => f.toLowerCase().includes("deck") || f.toLowerCase().includes("patio"))) {
      lines.push("Outdoor living space is a strong buyer signal right now.");
    }
    if (details.features.some((f) => f.toLowerCase().includes("garage"))) {
      lines.push("Garage parking typically boosts desirability and pricing.");
    }

    if (/park|trail|green|lake|river|creek/i.test(address)) {
      lines.push("Wow — proximity to green space could be a highlight.");
    } else {
      lines.push("Comparing nearby amenities that could strengthen pricing.");
    }

    if (details.propertyType === "commercial") {
      lines.push("Layering in income and lease comps for a smarter band.");
    }
    if (details.propertyType === "industrial") {
      lines.push("Weighting clear height, dock doors, and replacement cost signals.");
    }

    lines.push("Finalizing the value range and recommendation…");
    return lines;
  }

  const renderStepCard = () => {
    switch (step) {
      case "intro":
        return (
          <div className="message assistant">
            <div className="card-bubble intro-bubble">
              <h3>Welcome to SellerAI</h3>
              <TypewriterText text={INTRO_TEXT} onDone={() => setIntroComplete(true)} />
              <div className="quick-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleIntroContinue}
                  disabled={!introComplete}
                >
                  Let’s get started
                </button>
              </div>
            </div>
          </div>
        );
      case "confirm":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Is this correct?</h3>
              <p className="step-intro">
                First, let’s confirm the basics I pulled. Property type, size, age, and use shape the entire seller workflow.
              </p>
              <div className="step-explainer">
                A clean property profile saves time later: better comps, cleaner paperwork, and fewer back-and-forth corrections before a licensed agent reviews the file.
              </div>
              <div className="summary-text">
                <strong>{data.address}</strong>
                <div style={{ marginTop: 6 }}>
                  {data.details.propertyType} · {formatKnownNumber(data.details.squareFeet, " sqft")} · built {formatKnownNumber(data.details.yearBuilt)}
                  {data.details.propertyType === "residential" && (
                    <> · {formatKnownNumber(data.details.bedrooms)} bd · {formatKnownNumber(data.details.bathrooms)} ba</>
                  )}
                  {data.details.propertyType !== "residential" && (
                    <> · {data.details.useType} · {formatKnownNumber(data.details.units)} units</>
                  )}
                </div>
              </div>
              {data.propertyPhoto?.url && (
                <figure className="property-preview">
                  <img
                    src={data.propertyPhoto.url}
                    alt={`Nearby street-level view for ${data.address}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <figcaption>
                    {data.propertyPhoto.caption || "Nearby street-level property view"}
                    {data.propertyPhoto.source ? ` · ${data.propertyPhoto.source}` : ""}
                  </figcaption>
                </figure>
              )}
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handleConfirmYes}>
                  Looks right — continue
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Why do we confirm this first?",
                      "Property type, size, and condition drive pricing models and comps. A quick confirmation saves time later."
                    )
                  }
                >
                  Why this matters
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleConfirmNo}>
                  Edit details
                </button>
              </div>
            </div>
          </div>
        );
      case "details":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Confirm property details</h3>
              <p className="step-intro">
                Update anything that’s off. This is where you correct the AI before it starts making pricing and paperwork assumptions.
              </p>
              <div className="step-explainer">
                These details feed the estimate and the Listing Agreement draft. If something is unknown, a reasonable estimate is fine for now.
              </div>
              <div className="form-grid form-grid-wide">
                <label>
                  Property Type
                  <select
                    className="select"
                    value={data.details.propertyType}
                    onChange={(e) =>
                      handlePropertyTypeChange(
                        e.target.value as "residential" | "commercial" | "industrial"
                      )
                    }
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                  </select>
                </label>
                <label>
                  Year Built
                  <input
                    className="input"
                    type="number"
                    value={data.details.yearBuilt || ""}
                    placeholder="Unknown"
                    onChange={(e) => updateDetails({ yearBuilt: Number(e.target.value) })}
                  />
                </label>
                {data.details.propertyType === "residential" && (
                  <>
                    <label>
                      Bedrooms
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={data.details.bedrooms || ""}
                        placeholder="Unknown"
                        onChange={(e) => updateDetails({ bedrooms: normalizeBedrooms(e.target.value) })}
                      />
                    </label>
                    <label>
                      Bathrooms
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={0.5}
                        inputMode="decimal"
                        value={data.details.bathrooms || ""}
                        placeholder="Unknown"
                        onChange={(e) => updateDetails({ bathrooms: normalizeBathrooms(e.target.value) })}
                      />
                    </label>
                  </>
                )}
                <label>
                  Square Feet
                  <input
                    className="input"
                    type="number"
                    value={data.details.squareFeet || ""}
                    placeholder="Unknown"
                    onChange={(e) => updateDetails({ squareFeet: Number(e.target.value) })}
                  />
                </label>
                {data.details.propertyType !== "residential" && (
                  <>
                    <label>
                      Use Type
                      <select
                        className="select"
                        value={data.details.useType}
                        onChange={(e) =>
                          updateDetails({
                            useType: e.target.value as ListingData["details"]["useType"]
                          })
                        }
                      >
                        <option value="retail">Retail</option>
                        <option value="office">Office</option>
                        <option value="industrial">Industrial</option>
                        <option value="mixed">Mixed-use</option>
                        <option value="flex">Flex</option>
                        <option value="medical">Medical</option>
                        <option value="hospitality">Hospitality</option>
                      </select>
                    </label>
                    <label>
                      Units / Suites
                      <input
                        className="input"
                        type="number"
                        value={data.details.units}
                        onChange={(e) => updateDetails({ units: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Occupancy
                      <select
                        className="select"
                        value={data.details.occupancy}
                        onChange={(e) =>
                          updateDetails({
                            occupancy: e.target.value as ListingData["details"]["occupancy"]
                          })
                        }
                      >
                        <option value="owner-occupied">Owner-occupied</option>
                        <option value="leased">Leased</option>
                        <option value="vacant">Vacant</option>
                      </select>
                    </label>
                    <label>
                      Lease Type
                      <select
                        className="select"
                        value={data.details.leaseType}
                        onChange={(e) =>
                          updateDetails({
                            leaseType: e.target.value as ListingData["details"]["leaseType"]
                          })
                        }
                      >
                        <option value="n/a">N/A</option>
                        <option value="nnn">NNN</option>
                        <option value="gross">Gross</option>
                        <option value="modified">Modified Gross</option>
                      </select>
                    </label>
                  </>
                )}
                {data.details.propertyType === "industrial" && (
                  <>
                    <label>
                      Clear Height (ft)
                      <input
                        className="input"
                        type="number"
                        value={data.details.clearHeight}
                        onChange={(e) => updateDetails({ clearHeight: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Dock Doors
                      <input
                        className="input"
                        type="number"
                        value={data.details.dockDoors}
                        onChange={(e) => updateDetails({ dockDoors: Number(e.target.value) })}
                      />
                    </label>
                  </>
                )}
                <label>
                  Condition
                  <select
                    className="select"
                    value={data.details.condition}
                    onChange={(e) =>
                      updateDetails({ condition: e.target.value as ListingData["details"]["condition"] })
                    }
                  >
                    <option value="new">New / Renovated</option>
                    <option value="great">Great</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="fixer">Fixer</option>
                    <option value="rehab">Rehab</option>
                  </select>
                </label>
              </div>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handleDetailsConfirm}>
                  Save updates
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Why does property type matter?",
                      "Residential, commercial, and industrial follow different valuation methods and data sources."
                    )
                  }
                >
                  Why property type matters
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    addMessage("user", "No changes for now.");
                    addMessage("assistant", "All set — moving on to features.");
                    setStep("features");
                  }}
                >
                  Skip changes
                </button>
              </div>
            </div>
          </div>
        );
      case "features":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Features & condition highlights</h3>
              <p className="step-intro">
                Pick standout features so we can compare the property more intelligently and later turn the strongest points into marketing.
              </p>
              <div className="step-explainer">
                Some features affect value, some affect buyer confidence, and some just help the listing feel complete. Choose what you know; we can add more later.
              </div>
              <div className="option-grid">
                {(data.details.propertyType === "industrial"
                  ? INDUSTRIAL_FEATURES
                  : data.details.propertyType === "commercial"
                  ? COMMERCIAL_FEATURES
                  : RES_FEATURES
                ).map((feature) => (
                  <label
                    key={feature}
                    className={
                      data.details.features.includes(feature) ? "option-chip active" : "option-chip"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={data.details.features.includes(feature)}
                      onChange={() => {
                        setData((prev) => {
                          const exists = prev.details.features.includes(feature);
                          return {
                            ...prev,
                            details: {
                              ...prev.details,
                              features: exists
                                ? prev.details.features.filter((item) => item !== feature)
                                : [...prev.details.features, feature]
                            }
                          };
                        });
                      }}
                    />
                    {feature}
                  </label>
                ))}
              </div>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handleFeaturesContinue}>
                  Continue to pricing
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Why do features matter?",
                      "Features help explain the property story and support better comp review."
                    )
                  }
                >
                  Why features matter
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleFeaturesContinue}>
                  Not sure yet
                </button>
              </div>
            </div>
          </div>
        );
      case "valuation":
        const valuationSteps = [
          { icon: "🧠", label: "AI sources" },
          { icon: "📊", label: "Feature match" },
          { icon: "📍", label: "Neighborhood demand" },
          { icon: "🏘️", label: "Comps & MLS scan" },
          { icon: "🔍", label: "Outlier checks" },
          { icon: "✅", label: "Finalize range" }
        ];
        const rangeLow = data.valuation.rangeLow ?? data.valuation.average ?? 0;
        const rangeHigh = data.valuation.rangeHigh ?? data.valuation.average ?? 0;
        const progressIndex = Math.min(
          valuationSteps.length - 1,
          Math.floor((valuationProgress / 100) * valuationSteps.length)
        );
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Pricing input & comps</h3>
              <p className="step-intro">
                Next, let’s organize a working pricing input using comps, local market context, and the property details we just confirmed.
              </p>
              <div className="step-explainer">
                This is not a final valuation or sale-price recommendation. It helps prepare the next review step with the licensed agent.
              </div>

              {valuationStage === "idle" && (
                <>
                  <div className="quick-actions">
                    <button type="button" className="btn btn-primary" onClick={handleValuationStart} disabled={loading}>
                      {loading ? "Reviewing..." : "Review pricing input"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        pushInfoPrompt(
                          "How should I use this pricing input?",
                          "Use it as a working input for review. The final listing strategy should still be confirmed with property-specific context and broker guidance."
                        )
                      }
                    >
                      How to use this
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={skipValuationToFinalPrice}>
                      I already know my price
                    </button>
                  </div>
                </>
              )}

              {valuationStage === "running" && (
                <div className="valuation-theater">
                  <div className="valuation-progress">
                    <div className="valuation-progress-bar" style={{ width: `${valuationProgress}%` }} />
                  </div>
                  <div className="valuation-steps">
                    {valuationSteps.map((stepItem, idx) => (
                      <div
                        key={stepItem.label}
                        className={`valuation-step${idx <= progressIndex ? " active" : ""}`}
                      >
                        <span className="valuation-step-icon">{stepItem.icon}</span>
                        <span>{stepItem.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="thinking-row">
                    <span>SellerAI is reviewing the inputs</span>
                    <span className="thinking-dots">
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </span>
                  </div>
                  {valuationLog.length > 0 && (
                    <div className="valuation-log">
                      {valuationLog.map((line, idx) => (
                        <div
                          key={`${line}-${idx}`}
                          className={idx === valuationLog.length - 1 ? "highlight" : undefined}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {valuationStage === "result" && data.valuation.average && (
                <>
                  <div className="valuation-result">
                    <div className="valuation-result-title">
                      Working pricing input for {data.address || "this property"}:
                    </div>
                    <div className="valuation-range">
                      {formatCurrency(rangeLow)} – {formatCurrency(rangeHigh)}
                    </div>
                    <div className="valuation-suggested">
                      Suggested Pricing Input: {formatCurrency(data.valuation.average)}
                    </div>
                  </div>
                  <div className="step-explainer">
                    Treat this as a working input, not a final valuation or final list price. It can support the Listing Agreement draft and later review.
                  </div>
                  <div className="quick-actions">
                    <button type="button" className="btn btn-primary" onClick={handleValuationAccept}>
                      Use this as working input
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={handleValuationDetails}>
                      Show me the details
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={handleValuationCustom}>
                      I want to enter my own price
                    </button>
                  </div>
                </>
              )}

              {valuationStage === "details" && (
                <>
                  <div className="summary-text">
                    {data.valuation.report ? (
                      <div dangerouslySetInnerHTML={{ __html: data.valuation.report }} />
                    ) : (
                      "Here’s the breakdown behind the working pricing input."
                    )}
                  </div>
                  {data.valuation.comps && data.valuation.comps.length > 0 && (
                    <div className="comps-grid">
                      {data.valuation.comps.map((comp) => (
                        <div key={`${comp.address}-${comp.price}`} className="comp-card">
                          <div className="comp-address">{comp.address}</div>
                          <div className="comp-price">{formatCurrency(comp.price)}</div>
                          <div className="comp-meta">
                            {comp.sqft ? `${comp.sqft} sqft` : "Size n/a"}
                            {typeof comp.beds === "number" ? ` · ${comp.beds} bd` : ""}
                            {typeof comp.baths === "number" ? ` · ${comp.baths} ba` : ""}
                          </div>
                          {comp.soldDate && <div className="comp-meta">Sold: {comp.soldDate}</div>}
                          {typeof comp.daysOnMarket === "number" && (
                            <div className="comp-meta">Days on market: {comp.daysOnMarket}</div>
                          )}
                          {typeof comp.distanceMiles === "number" && (
                            <div className="comp-meta">Distance: {comp.distanceMiles} mi</div>
                          )}
                          {comp.modeled && <div className="comp-meta">Source: modeled local spread</div>}
                          {comp.condition && <div className="comp-meta">Condition: {comp.condition}</div>}
                          {comp.features && comp.features.length > 0 && (
                            <div className="comp-meta">Features: {comp.features.slice(0, 4).join(", ")}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {data.details.propertyType === "commercial" && data.valuation.market && (
                    <div className="market-card">
                      <div className="market-title">Commercial market snapshot</div>
                      <div className="market-grid">
                        {typeof data.valuation.market.vacancyRate === "number" && (
                          <div>Vacancy: {data.valuation.market.vacancyRate}%</div>
                        )}
                        {typeof data.valuation.market.absorptionRate === "number" && (
                          <div>Absorption: {data.valuation.market.absorptionRate}%</div>
                        )}
                        {data.valuation.market.capRateRange && (
                          <div>Cap rate range: {data.valuation.market.capRateRange}</div>
                        )}
                        {typeof data.valuation.market.avgDom === "number" && (
                          <div>Avg DOM: {data.valuation.market.avgDom} days</div>
                        )}
                        {data.valuation.market.inventoryLevel && (
                          <div>Inventory: {data.valuation.market.inventoryLevel}</div>
                        )}
                        {data.valuation.market.submarket && (
                          <div>Submarket: {data.valuation.market.submarket}</div>
                        )}
                      </div>
                      {data.valuation.market.trendNotes && (
                        <div className="market-notes">{data.valuation.market.trendNotes}</div>
                      )}
                    </div>
                  )}
                  {data.valuation.rentalComps && data.valuation.rentalComps.length > 0 && (
                    <div className="comps-grid">
                      {data.valuation.rentalComps.map((comp) => (
                        <div key={`${comp.address}-${comp.rent}`} className="comp-card">
                          <div className="comp-address">{comp.address}</div>
                          <div className="comp-price">{formatCurrency(comp.rent)} / mo</div>
                          {comp.sqft && <div className="comp-meta">{comp.sqft} sqft</div>}
                          {comp.date && <div className="comp-meta">{comp.date}</div>}
                          {comp.leaseType && <div className="comp-meta">Lease: {comp.leaseType}</div>}
                          {comp.occupancy && <div className="comp-meta">Occupancy: {comp.occupancy}</div>}
                          {typeof comp.termMonths === "number" && (
                            <div className="comp-meta">Term: {comp.termMonths} months</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {data.details.propertyType === "industrial" &&
                    data.valuation.replacementExamples &&
                    data.valuation.replacementExamples.length > 0 && (
                      <div className="replacement-grid">
                        {data.valuation.replacementExamples.map((example) => (
                          <div key={`${example.address}-${example.cost}`} className="comp-card">
                            <div className="comp-address">{example.address}</div>
                            <div className="comp-price">{formatCurrency(example.cost)}</div>
                            {example.sqft && <div className="comp-meta">{example.sqft} sqft</div>}
                            {example.year && <div className="comp-meta">Year: {example.year}</div>}
                            {typeof example.distanceMiles === "number" && (
                              <div className="comp-meta">Distance: {example.distanceMiles} mi</div>
                            )}
                            {example.type && <div className="comp-meta">Type: {example.type}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  <div className="quick-actions">
                    <button type="button" className="btn btn-primary" onClick={handleValuationAccept}>
                      Looks good — continue
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={handleValuationCustom}>
                      I will set my price
                    </button>
                  </div>
                </>
              )}

              {valuationStage === "custom" && (
                <>
                  <div className="summary-text">What price did you have in mind?</div>
                  <label>
                    Enter your target price
                    <input
                      className="input"
                      value={customPriceInput}
                      onChange={(e) => setCustomPriceInput(e.target.value)}
                      placeholder="$700,000"
                    />
                  </label>
                  {customPriceError && <div className="summary-text">{customPriceError}</div>}
                  <div className="quick-actions">
                    <button type="button" className="btn btn-primary" onClick={submitCustomPrice}>
                      Use this price
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={handleValuationAccept}>
                      Use suggested value instead
                    </button>
                  </div>
                </>
              )}

              {valuationStage === "reason" && (
                <>
                  <div className="summary-text">
                    Can you share what you’re basing that value on? Comps, recent offers, upgrades, or any context is
                    helpful.
                  </div>
                  <label>
                    Your reasoning
                    <textarea
                      className="textarea"
                      value={customReasonInput}
                      onChange={(e) => setCustomReasonInput(e.target.value)}
                      placeholder="Share comps, upgrades, offers, or any reasoning…"
                    />
                  </label>
                  {customReasonError && <div className="summary-text">{customReasonError}</div>}
                  <div className="quick-actions">
                    <button type="button" className="btn btn-primary" onClick={submitCustomReason}>
                      Submit reasoning
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={handleValuationAccept}>
                      Use suggested value instead
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      case "acknowledgements":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Acknowledgements & seller info</h3>
              <p className="step-intro">
                Quick compliance and contact details so the licensed agent has a clean file to review.
              </p>
              <div className="step-explainer">
                This is the part FSBO sellers usually have to chase manually. We collect it early so the listing can move faster without losing the protections of agency and MLS compliance.
              </div>
              <div className="seller-info-panel">
                <div className="seller-info-header">
                  <span className="seller-info-kicker">Seller file</span>
                  <strong>Where should the brokerage team reach you?</strong>
                </div>
                <div className="seller-info-grid">
                  <label className="seller-info-field">
                    Full Name
                    <input
                      className="input"
                      value={data.seller.name}
                      placeholder="Seller name"
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          seller: { ...prev.seller, name: e.target.value }
                        }))
                      }
                    />
                  </label>
                  <label className="seller-info-field">
                    Email
                    <input
                      className="input"
                      type="email"
                      value={data.seller.email}
                      placeholder="name@email.com"
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          seller: { ...prev.seller, email: e.target.value }
                        }))
                      }
                    />
                  </label>
                  <label className="seller-info-field">
                    Phone
                    <input
                      className="input"
                      value={data.seller.phone}
                      placeholder="(555) 555-5555"
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          seller: { ...prev.seller, phone: e.target.value }
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="owner-confirm-panel">
                  <div>
                    <strong>Are you the official owner of the property?</strong>
                    <p>This helps the Agent send the correct DocuSign paperwork and know if authority needs review.</p>
                  </div>
                  <div className="owner-toggle-group" role="group" aria-label="Official owner confirmation">
                    <button
                      type="button"
                      className={data.paperwork.officialOwner === true ? "owner-toggle active" : "owner-toggle"}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          paperwork: { ...prev.paperwork, officialOwner: true, ownerRole: "owner" }
                        }))
                      }
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={data.paperwork.officialOwner === false ? "owner-toggle active" : "owner-toggle"}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          paperwork: {
                            ...prev.paperwork,
                            officialOwner: false,
                            ownerRole: "representative"
                          }
                        }))
                      }
                    >
                      No
                    </button>
                  </div>
                </div>
                <div className="ack-list">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={data.acknowledgements.agency}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          acknowledgements: { ...prev.acknowledgements, agency: e.target.checked }
                        }))
                      }
                    />
                    I acknowledge agency disclosure.
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={data.acknowledgements.fairHousing}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          acknowledgements: { ...prev.acknowledgements, fairHousing: e.target.checked }
                        }))
                      }
                    />
                    I acknowledge fair housing policy.
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={data.acknowledgements.mls}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          acknowledgements: { ...prev.acknowledgements, mls: e.target.checked }
                        }))
                      }
                    />
                    I consent to MLS entry.
                  </label>
                </div>
                <div className="notice-next-step">
                  <span className="notice-badge">Next</span>
                  <div>
                    <strong>Consumer Notice by DocuSign</strong>
                    <p>
                      After you proceed, the Agent will receive an email to send the Consumer Notice for review and eSign. This is not a contract. It is a mandatory Pennsylvania disclosure step.
                    </p>
                  </div>
                </div>
              </div>
              <div className="quick-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAcknowledgementsContinue}
                  disabled={loading}
                >
                  {loading ? "Notifying..." : "Proceed: notify Agent"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Why do we need this?",
                      "Regulations require disclosures and contact info before we can list or activate the property."
                    )
                  }
                >
                  Why do we need this?
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Can I finish this later?",
                      "Yes — but we’ll need these checked before activation."
                    )
                  }
                >
                  Finish later
                </button>
              </div>
            </div>
          </div>
        );
      case "final-price":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Comps & working price estimate</h3>
              <p className="step-intro">
                Confirm the working estimate we’ll carry into the Listing Agreement draft.
              </p>
              <div className="step-explainer">
                This is not the final launch price. The licensed agent can help finalize the actual Listing Price later, after reviewing strategy, market timing, and any additional seller input.
              </div>
              <div className="summary-text">
                {(data.valuation.comps || []).length === 0
                  ? "No comps loaded yet."
                  : data.valuation.comps?.map((comp, idx) => (
                      <div key={`${comp.address}-${idx}`}>
                        {comp.address} — ${comp.price.toLocaleString()}
                      </div>
                    ))}
              </div>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={useSuggestedPrice}>
                  Use suggested price
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "I want to enter my own price.",
                      "Go for it — type the price below and we’ll adjust the strategy around it."
                    )
                  }
                >
                  Enter my own price
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Any pricing strategy tips?",
                      "Pricing slightly below market can drive competition; pricing at market balances speed and value."
                    )
                  }
                >
                  Pricing strategy tips
                </button>
              </div>
              <label>
                Working estimate for agreement
                <input
                  className="input"
                  type="number"
                  value={data.finalPrice || ""}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      finalPrice: Number(e.target.value)
                    }))
                  }
                />
              </label>
              <div className="card-actions">
                <button type="button" className="btn btn-primary" onClick={handleFinalPriceContinue}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        );
      case "photos":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Upload listing photos</h3>
              <p className="step-intro">
                Photos drive clicks — upload now or skip and add them later.
              </p>
              <div className="step-explainer">
                You can move fast and still upgrade the marketing later. Good photos usually make the biggest first impression.
              </div>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).map((file) => file.name);
                  setData((prev) => ({ ...prev, photos: files }));
                }}
              />
              <p className="summary-text">{data.photos.length} files selected</p>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handlePhotosContinue}>
                  Continue
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Any quick photo tips?",
                      "Shoot in daylight, tidy surfaces, and capture wide angles of main rooms."
                    )
                  }
                >
                  Photo tips
                </button>
                <button type="button" className="btn btn-ghost" onClick={handlePhotosContinue}>
                  Upload later
                </button>
              </div>
            </div>
          </div>
        );
      case "description":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Draft the property description</h3>
              <p className="step-intro">
                Tell me the tone or highlights you want — I can draft it for you.
              </p>
              <div className="step-explainer">
                The description should turn facts into buyer motivation: what the property is, why it matters, and what makes it easy to imagine owning.
              </div>
              <textarea
                className="textarea"
                value={data.description}
                onChange={(e) => setData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe highlights, renovations, and neighborhood perks."
              />
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handleDescriptionContinue}>
                  Continue
                </button>
                <button type="button" className="btn btn-ghost" onClick={generateDescriptionDraft}>
                  Generate starter draft
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    addMessage("user", "Let’s draft this later.");
                    addMessage("assistant", "No problem — we can circle back anytime.");
                    setStep("dashboard");
                  }}
                >
                  Draft later
                </button>
              </div>
            </div>
          </div>
        );
      case "activation":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Activate listing</h3>
              <p className="step-intro">
                We’ll verify your email so the listing dashboard and paperwork stay tied to the right seller.
              </p>
              <div className="step-explainer">
                This protects the file and keeps future signatures, updates, and agent communication connected to you.
              </div>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={sendActivationEmail} disabled={loading}>
                  {loading ? "Sending..." : "Send activation email"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleActivationContinue}>
                  Skip email
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Where is this sent?",
                      "We’ll send it to the email you entered in the seller info step."
                    )
                  }
                >
                  Where is this sent?
                </button>
              </div>
              {activationCode && (
                <div className="form-grid" style={{ marginTop: 12 }}>
                  <label>
                    Activation Code
                    <input
                      className="input"
                      value={activationInput}
                      onChange={(e) => setActivationInput(e.target.value)}
                      placeholder="Enter the 6-digit code"
                    />
                  </label>
                </div>
              )}
              {activationMocked && activationCode && (
                <p className="summary-text">
                  Temporary code (email not configured): <strong>{activationCode}</strong>
                </p>
              )}
              {activationCode && (
                <div className="quick-actions">
                  <button type="button" className="btn btn-primary" onClick={verifyActivationCode}>
                    Verify code
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={sendActivationEmail}>
                    Resend code
                  </button>
                </div>
              )}
              {activationLink && (
                <p className="summary-text">Activation link: {activationLink}</p>
              )}
            </div>
          </div>
        );
      case "ownership":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Paperwork kickoff</h3>
              <p className="step-intro">
                Now that we have a working pricing input, it’s time to approve paperwork sent by eSign.
              </p>
              <div className="step-explainer">
                The goal is to keep this feeling simple while still doing the licensed-agent and compliance work correctly behind the scenes.
              </div>
              <p className="summary-text">Are you the owner of the property or a representative?</p>
              <div className="quick-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOwnerRoleSelect("owner")}
                >
                  I’m the owner
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleOwnerRoleSelect("representative")}
                >
                  I’m a representative
                </button>
              </div>
            </div>
          </div>
        );
      case "consumer-notice":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Consumer Notice</h3>
              <p className="step-intro">
                First, request the Consumer Notice by email so the Agent can prepare the eSign package.
              </p>
              <div className="step-explainer">
                This is not a contract. It is a required Pennsylvania disclosure step before the listing agreement workflow continues.
              </div>
              <p className="summary-text">
                The Agent will send it to {data.seller.email ? data.seller.email : "the email on file"} after preparing the eSign package.
              </p>
              <div className="quick-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => requestConsumerNoticeFromAdmin()}
                  disabled={loading}
                >
                  {loading ? "Sending request..." : "Send me the Consumer Notice by email"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "What is the Consumer Notice?",
                      "It’s a required disclosure that outlines the consumer relationship and key rights before we proceed."
                    )
                  }
                >
                  What is it?
                </button>
              </div>
            </div>
          </div>
        );
      case "consumer-wait":
        {
          const isCommercialLike =
            data.details.propertyType === "commercial" || data.details.propertyType === "industrial";
          const showMultiFamilyToggle = data.details.propertyType === "residential";
          const showUploads = data.paperwork.isMultiFamily || isCommercialLike;
          const docList = data.paperwork.isMultiFamily ? MULTIFAMILY_DOCS : COMMERCIAL_DOCS;
          return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Pending Consumer Notice</h3>
              <p className="step-intro">
                The app is paused here until the Agent sends and approves the completed Consumer Notice.
              </p>
              <div className="step-explainer">
                This is not a contract. It is a mandatory Pennsylvania disclosure step that must be reviewed and eSigned before we continue the listing workflow.
              </div>
              <div className="pending-panel">
                <div className="pending-status">
                  <span className="pending-dot" />
                  <div>
                    <strong>Pending Agent approval</strong>
                    <p>The Agent should send the Consumer Notice by DocuSign, then approve this file when the checkpoint is complete.</p>
                  </div>
                </div>
                <dl className="pending-details">
                  <div>
                    <dt>Seller</dt>
                    <dd>{data.seller.name || "Not entered"}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{data.seller.email || "Not entered"}</dd>
                  </div>
                  <div>
                    <dt>Official owner</dt>
                    <dd>
                      {data.paperwork.officialOwner === true
                        ? "Yes"
                        : data.paperwork.officialOwner === false
                        ? "No"
                        : "Not confirmed"}
                    </dd>
                  </div>
                  <div>
                    <dt>Working estimate</dt>
                    <dd>{formatCurrency(data.finalPrice || data.valuation.average)}</dd>
                  </div>
                </dl>
              </div>
              <div className="quick-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => requestConsumerNoticeFromAdmin({ renotify: true })}
                  disabled={loading}
                >
                  {loading ? "Sending request..." : "Send me the Consumer Notice by email"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={markConsumerNoticeSigned}>
                  Agent: approve after CN complete
                </button>
              </div>

              <div style={{ marginTop: 16 }}>
                <p className="summary-text">
                  While we wait, want to share more info or ask anything?
                </p>
                <div className="quick-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => handleWaitingConversation("buying")}>
                    I plan to buy another property
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleWaitingConversation("ask1031")}>
                    Tell me about 1031 exchange
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleWaitingConversation("notSure")}>
                    Not sure yet
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleWaitingConversation("no")}>
                    Not now
                  </button>
                </div>
              </div>

              {showMultiFamilyToggle && (
                <div style={{ marginTop: 18 }}>
                  <p className="summary-text">Is this a multi-family property?</p>
                  <div className="option-grid">
                    <button
                      type="button"
                      className={data.paperwork.isMultiFamily ? "option-chip active" : "option-chip"}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          paperwork: { ...prev.paperwork, isMultiFamily: true }
                        }))
                      }
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={!data.paperwork.isMultiFamily ? "option-chip active" : "option-chip"}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          paperwork: { ...prev.paperwork, isMultiFamily: false }
                        }))
                      }
                    >
                      No
                    </button>
                  </div>
                </div>
              )}

              {showUploads && (
                <div style={{ marginTop: 18 }}>
                  <p className="summary-text">
                    Optional while we wait: upload or email supporting documents (we’ll automate this later).
                  </p>
                  <div className="doc-tags">
                    {docList.map((doc) => (
                      <span key={doc} className="doc-tag">
                        {doc}
                      </span>
                    ))}
                  </div>
                  <input type="file" multiple onChange={(e) => handleUploadFiles(e.target.files)} />
                  {data.paperwork.extraUploads.length > 0 && (
                    <p className="summary-text">Selected: {data.paperwork.extraUploads.join(", ")}</p>
                  )}
                  <div className="quick-actions">
                    <button type="button" className="btn btn-ghost" onClick={notifyDocumentUpload} disabled={loading}>
                      Notify agent
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        }
      case "listing-intro":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Listing agreement prep</h3>
              <p className="step-intro">
                Great! Your CN is received. Now let’s move on to preparing your Listing Agreement.
              </p>
              <div className="step-explainer">
                It is an exclusive agreement for a period of 6 months, with a total broker’s fee of only 1%.
              </div>
              <p className="summary-text">
                We’ll confirm the details, then send it to your Agent for manual review and eSign preparation.
              </p>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handleListingIntroContinue}>
                  Awesome, let’s move on
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setListingAgreementExplainerOpen(true)}
                >
                  How does this work exactly?
                </button>
              </div>
            </div>
          </div>
        );
      case "listing-details":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Finalize listing agreement details</h3>
              <p className="step-intro">
                Great! Please click here and I will generate that for you and send it to your Agent for review.
              </p>
              <div className="step-explainer">
                This can take between 5-60 minutes. We will notify you when ready.
              </div>
              <div className="form-grid">
                <label>
                  Final Listing Price
                  <input
                    className="input"
                    type="number"
                    value={data.finalPrice || ""}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        finalPrice: Number(e.target.value)
                      }))
                    }
                  />
                </label>
                <label>
                  Mailing Address
                  <input
                    className="input"
                    value={data.paperwork.mailingAddress}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        paperwork: { ...prev.paperwork, mailingAddress: e.target.value }
                      }))
                    }
                    placeholder="Street, City, State, Zip"
                  />
                </label>
              </div>
              <div className="summary-text" style={{ marginTop: 12 }}>
                Broker’s fee at settlement: 1%
              </div>
              <div className="option-grid" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={
                    data.paperwork.brokerFeeConsent === true ? "option-chip active" : "option-chip"
                  }
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      paperwork: { ...prev.paperwork, brokerFeeConsent: true }
                    }))
                  }
                >
                  I agree
                </button>
                <button
                  type="button"
                  className={
                    data.paperwork.brokerFeeConsent === false ? "option-chip active" : "option-chip"
                  }
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      paperwork: { ...prev.paperwork, brokerFeeConsent: false }
                    }))
                  }
                >
                  I don’t agree
                </button>
              </div>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handleListingDetailsContinue}>
                  Generate and send to Agent
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "How does the broker fee work?",
                      "The total broker fee for this SellerAI listing path is only 1%. You still receive broker representation while handling a few simple on-site tasks yourself."
                    )
                  }
                >
                  How does this work?
                </button>
              </div>
            </div>
          </div>
        );
      case "dual-agency":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Dual agency acknowledgement</h3>
              <p className="step-intro">
                Dual agency happens if we represent both the seller and the buyer in the same transaction.
              </p>
              <div className="step-explainer">
                This is a disclosure step. It helps keep the transaction transparent before any buyer-side relationship exists.
              </div>
              <div className="option-grid">
                <button
                  type="button"
                  className={
                    data.paperwork.dualAgencyConsent === true ? "option-chip active" : "option-chip"
                  }
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      paperwork: { ...prev.paperwork, dualAgencyConsent: true }
                    }))
                  }
                >
                  I acknowledge
                </button>
                <button
                  type="button"
                  className={
                    data.paperwork.dualAgencyConsent === false ? "option-chip active" : "option-chip"
                  }
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      paperwork: { ...prev.paperwork, dualAgencyConsent: false }
                    }))
                  }
                >
                  I do not agree
                </button>
              </div>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handleDualAgencyContinue}>
                  Continue
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Why do we disclose dual agency?",
                      "State law requires disclosure if the same brokerage represents both sides."
                    )
                  }
                >
                  Why do we disclose this?
                </button>
              </div>
            </div>
          </div>
        );
      case "lead-paint":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Lead-based paint disclosure</h3>
              <p className="step-intro">Was the home built before 1978?</p>
              <div className="step-explainer">
                If the property may be subject to lead-based paint rules, we need to know before marketing and paperwork move forward.
              </div>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={() => handleLeadPaintContinue("yes")}>
                  Yes
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => handleLeadPaintContinue("no")}>
                  No
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Why do we ask?",
                      "Federal law requires lead paint disclosures for homes built before 1978."
                    )
                  }
                >
                  Why do we ask?
                </button>
              </div>
            </div>
          </div>
        );
      case "listing-wait":
        {
          const isCommercialLike =
            data.details.propertyType === "commercial" || data.details.propertyType === "industrial";
          const showMultiFamilyToggle = data.details.propertyType === "residential";
          const showUploads = data.paperwork.isMultiFamily || isCommercialLike;
          const docList = data.paperwork.isMultiFamily ? MULTIFAMILY_DOCS : COMMERCIAL_DOCS;
          return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Waiting for Agent review</h3>
              <p className="step-intro">
                Your Listing Agreement request was sent to your Agent for review and eSign preparation.
              </p>
              <div className="step-explainer">
                This can take between 5-60 minutes. We will notify you when ready.
              </div>
              <p className="summary-text">
                You can leave this page open or come back later. The chat will move forward when the Agent releases this checkpoint.
              </p>
              <div className="thinking-row">
                <span>Waiting for Agent release</span>
                <span className="thinking-dots">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </span>
              </div>
              <div className="quick-actions">
                <button type="button" className="btn btn-ghost" onClick={markListingAgreementSigned}>
                  Mark as signed (Agent)
                </button>
              </div>

              <div style={{ marginTop: 16 }}>
                <p className="summary-text">
                  While we wait, want to share more info or ask anything?
                </p>
                <div className="quick-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => handleWaitingConversation("buying")}>
                    I plan to buy another property
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleWaitingConversation("ask1031")}>
                    Tell me about 1031 exchange
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleWaitingConversation("notSure")}>
                    Not sure yet
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleWaitingConversation("no")}>
                    Not now
                  </button>
                </div>
              </div>

              {showMultiFamilyToggle && (
                <div style={{ marginTop: 18 }}>
                  <p className="summary-text">Is this a multi-family property?</p>
                  <div className="option-grid">
                    <button
                      type="button"
                      className={data.paperwork.isMultiFamily ? "option-chip active" : "option-chip"}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          paperwork: { ...prev.paperwork, isMultiFamily: true }
                        }))
                      }
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={!data.paperwork.isMultiFamily ? "option-chip active" : "option-chip"}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          paperwork: { ...prev.paperwork, isMultiFamily: false }
                        }))
                      }
                    >
                      No
                    </button>
                  </div>
                </div>
              )}

              {showUploads && (
                <div style={{ marginTop: 18 }}>
                  <p className="summary-text">
                    Optional while we wait: upload or email supporting documents (we’ll automate this later).
                  </p>
                  <div className="doc-tags">
                    {docList.map((doc) => (
                      <span key={doc} className="doc-tag">
                        {doc}
                      </span>
                    ))}
                  </div>
                  <input type="file" multiple onChange={(e) => handleUploadFiles(e.target.files)} />
                  {data.paperwork.extraUploads.length > 0 && (
                    <p className="summary-text">Selected: {data.paperwork.extraUploads.join(", ")}</p>
                  )}
                  <div className="quick-actions">
                    <button type="button" className="btn btn-ghost" onClick={notifyDocumentUpload} disabled={loading}>
                      Notify agent
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        }
      case "marketing-intro":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Marketing kickoff</h3>
              <p className="step-intro">
                Now that we’ve established formal agency, it’s time to start marketing online and offline.
              </p>
              <div className="step-explainer">
                This is where the process stops being paperwork and starts becoming a public listing: photos, description, MLS, and buyer-facing presentation.
              </div>
              <p className="summary-text">First, let’s talk about photos.</p>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={handleMarketingIntroContinue}>
                  Let’s go
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    pushInfoPrompt(
                      "Why are photos important?",
                      "Listings with strong photos get more clicks, more showings, and better offers."
                    )
                  }
                >
                  Importance of photos
                </button>
              </div>
            </div>
          </div>
        );
      case "dashboard":
        return (
          <div className="message assistant">
            <div className="card-bubble">
              <h3>Listing dashboard</h3>
              <p className="step-intro">You’re live — here’s what we’ll do next.</p>
              <div className="step-explainer">
                From here, SellerAI becomes the command center for listing tasks, agent follow-up, buyer activity, and next steps.
              </div>
              <p className="summary-text">Next tasks:</p>
              <ul className="summary-text" style={{ paddingLeft: 16 }}>
                {TASKS.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
              <div className="quick-actions">
                <button type="button" className="btn btn-primary" onClick={() => router.push("/dashboard")}>
                  Go to dashboard
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleNewListing}>
                  Start another listing
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const workflowProgress = WORKFLOW_PROGRESS[step] || WORKFLOW_PROGRESS.confirm;
  const gameProgress = getGameProgress(step);
  const recentMilestones = gameProgress.earnedMilestones.slice(-3);
  const stepGuidance = getStepGuidance(step, workflowProgress);
  const readinessScore = Math.round((gameProgress.earnedPoints / gameProgress.totalPoints) * 100);
  const readinessLabel = getReadinessLabel(readinessScore);
  const readinessExplanation = getReadinessExplanation(readinessScore, gameProgress.nextMilestone);
  const openHelpTopic = (title: string, body: React.ReactNode) => {
    setHelpTopic({ title, body });
    setHelpMenuOpen(false);
  };
  const openGameHelper = (helper: (typeof GAME_HELPERS)[number]) => {
    openHelpTopic(`${helper.name} - ${helper.role}`, helper.body);
  };

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <div className="seller-help-menu" ref={helpMenuRef}>
        <button type="button" className="seller-theme-trigger" onClick={toggleTheme}>
          <Flashlight size={15} strokeWidth={2.2} />
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
        <button type="button" className="seller-help-trigger" onClick={() => setHelpMenuOpen((prev) => !prev)}>
          Menu
        </button>
        {helpMenuOpen && (
          <div className="seller-help-popover">
            <div className="seller-help-popover-header">
              <span>Menu</span>
              <button type="button" className="seller-help-close" onClick={() => setHelpMenuOpen(false)} aria-label="Close menu">
                ×
              </button>
            </div>
            <button type="button" onClick={() => openHelpTopic("How does this work?", "SellerAI helps organize property information, disclosures, eSign checkpoints, and listing preparation while a licensed broker remains involved. You handle the seller-side inputs, and the workflow keeps each next step clear.")}>How does this work?</button>
            <button type="button" onClick={() => openHelpTopic("Is it really only 1%?", "Yes. The SellerAI path is designed around a total broker fee of only 1% for this listing workflow, while still keeping broker representation and required compliance steps in place.")}>Is it really only 1%?</button>
            <button type="button" onClick={() => openHelpTopic("About us", "SellerAI is part of housingPA. The goal is to combine licensed brokerage support with an AI-assisted workflow that keeps seller preparation organized and easier to review.")}>About us</button>
            <button type="button" onClick={() => openHelpTopic("Contact us", "Support: ben@housingpa.com")}>Contact us</button>
            <button type="button" onClick={handleNewListing}>Back to homepage</button>
            <button type="button" onClick={() => openHelpTopic("AI Valuator", "The AI Valuator creates a working pricing input from property details, comparable sales, market context, and the information you provide. It is not a final valuation, sale-price promise, or listing recommendation.")}>AI Valuator</button>
            <button type="button" onClick={() => openHelpTopic("Offer", "Offer tools will be added here later for buyer activity, offer review, and negotiation support.")}>Offer</button>
            <a href="https://housingpa.com/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>
            <a href="https://housingpa.com/terms.html" target="_blank" rel="noreferrer">Terms of Use</a>
          </div>
        )}
      </div>
      <aside className="sidebar">
        <div>
          <div className="sidebar-top">
            <div className="brand-logo">
              <span className="brand-word">Seller</span>
              <span className="brand-ai">AI</span>
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <span className="sidebar-toggle-icon" aria-hidden="true" />
              <span className="sr-only">{sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}</span>
            </button>
          </div>
          <div className="sidebar-subtitle">AI listing companion</div>
        </div>
        <button type="button" className="sidebar-action" onClick={handleNewListing}>
          <span className="sidebar-icon">+</span>
          <span className="sidebar-text">New listing</span>
        </button>
        <button type="button" className="sidebar-theme-toggle mobile-theme-toggle" onClick={toggleTheme}>
          <span className="sidebar-icon" aria-hidden="true">
            <Flashlight size={14} strokeWidth={2.2} />
          </span>
          <span className="sidebar-text">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <div className="sidebar-section">
          <div className="sidebar-label">Current listing</div>
          <div className="sidebar-card">{data.address || "No active address"}</div>
        </div>
        <div className="sidebar-section seller-score-card" aria-label="Seller score">
          <div className="seller-score-top">
            <div>
              <div className="sidebar-label">Readiness score</div>
              <strong>{readinessScore}</strong>
            </div>
            <span>{readinessLabel}</span>
          </div>
          <div className="seller-score-track">
            <div
              className="seller-score-bar"
              style={{ width: `${readinessScore}%` }}
            />
          </div>
          <div className="seller-score-next">
            {gameProgress.nextMilestone
              ? `Next: ${gameProgress.nextMilestone.title}`
              : "All milestones complete"}
          </div>
          <p className="seller-score-explain">{readinessExplanation}</p>
          <div className="seller-helper-row">
            {GAME_HELPERS.map((helper) => (
              <button
                key={helper.id}
                type="button"
                className="seller-helper-chip"
                onClick={() => openGameHelper(helper)}
                title={`${helper.name}: ${helper.role}`}
                aria-label={`${helper.name}, ${helper.role}`}
              >
                {helper.initials}
              </button>
            ))}
          </div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-label">Listing history</div>
          <div className="sidebar-list">
            {listingHistory.length === 0 && <div className="summary-text">No previous addresses.</div>}
            {listingHistory.map((item) => (
              <div
                key={item.id}
                className={`sidebar-list-item${item.address === data.address ? " active" : ""}`}
              >
                <button
                  type="button"
                  className="sidebar-list-main"
                  onClick={() => openListing(item, "view")}
                >
                  {item.address}
                </button>
                <div className="sidebar-list-actions">
                  <button
                    type="button"
                    className="sidebar-list-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      openListing(item, "edit");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="sidebar-list-action danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteListing(item.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-report"
            onClick={() => setReportOpen(true)}
          >
            <span className="sidebar-icon">!</span>
            <span className="sidebar-text">Report a problem</span>
          </button>
          <button
            type="button"
            className="sidebar-report mobile-footer-menu"
            onClick={() => setHelpMenuOpen((prev) => !prev)}
          >
            <span className="sidebar-icon">☰</span>
            <span className="sidebar-text">Menu</span>
          </button>
        </div>
      </aside>

      <main className={`main ${view === "landing" ? "landing" : "chat-view"}`}>
        <div className="main-inner">
          {view === "landing" && (
            <section className="hero">
              <h1>Start Your Seller Readiness Review</h1>
              <form
                className="search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddressLookup();
                }}
              >
                <div className="search-bar">
                  <input
                    ref={addressInputRef}
                    value={addressInput}
                    onChange={(e) => {
                      setAddressInput(e.target.value);
                      setPlaceTypes([]);
                    }}
                    placeholder="Enter the property address"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="btn btn-primary search-submit" type="submit" disabled={loading}>
                    {loading ? "Searching..." : "Start review"}
                  </button>
                </div>
                <p className="hero-start-note">
                  Start with an address. SellerAI organizes seller-readiness facts for review; it is not a final valuation.
                </p>
                {addressSuggestions.length > 0 && (
                  <div className="autocomplete-list">
                    {addressSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="autocomplete-item"
                        onClick={() => handleAddressSelect(item)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
                {addressSearching && <p className="summary-text">Finding address suggestions…</p>}
                {mapsError && <p className="summary-text">{mapsError}</p>}
                {feedback && <p className="summary-text">{feedback}</p>}
              </form>
              <div className="landing-game-panel" aria-label="SellerAI readiness progress preview">
                <div className="landing-game-score">
                  <span>Readiness Score</span>
                  <strong>0</strong>
                </div>
                <div className="landing-game-path">
                  <span className="landing-game-bubble active">Start</span>
                  <span className="landing-game-bubble">Address</span>
                  <span className="landing-game-bubble">Pricing Inputs</span>
                  <span className="landing-game-bubble">Next-Step Plan</span>
                </div>
                <div className="landing-helper-row">
                  {GAME_HELPERS.map((helper) => (
                    <button
                      key={helper.id}
                      type="button"
                      className="landing-helper"
                      onClick={() => openGameHelper(helper)}
                      aria-label={`${helper.name}, ${helper.role}`}
                    >
                      <span>{helper.initials}</span>
                      <small>{helper.role}</small>
                    </button>
                  ))}
                </div>
              </div>
              <p className="hero-note">
                An AI-assisted listing workflow for organizing property details, pricing inputs, paperwork, and next
                steps before a seller review.
              </p>
            </section>
          )}

          {view === "chat" && (
            <section>
              <div className="chat-header">
                <div>
                  <h2>{data.address || "Listing chat"}</h2>
                  <div className="summary-text">Live conversation with your SellerAI agent</div>
                </div>
                <div className="chat-actions">
                  <div className="chat-status">Live chat</div>
                </div>
              </div>
              <div className="workflow-progress" aria-label={`SellerAI workflow progress ${workflowProgress.percent}%`}>
                <div className="workflow-progress-top">
                  <span>{workflowProgress.label}</span>
                  <strong>{workflowProgress.percent}%</strong>
                </div>
                <div className="workflow-progress-track">
                  <div
                    className="workflow-progress-bar"
                    style={{ width: `${workflowProgress.percent}%` }}
                  />
                </div>
              </div>
              <div className="game-progress-strip" aria-label="SellerAI readiness milestones">
                <div className="game-progress-score">
                  <span>Readiness Score</span>
                  <strong>{readinessScore}</strong>
                  <small>{readinessLabel}</small>
                </div>
                <div className="game-milestone-bubbles">
                  {recentMilestones.map((milestone) => (
                    <span key={milestone.step} className="game-milestone-bubble">
                      {milestone.title}
                    </span>
                  ))}
                  {gameProgress.nextMilestone && (
                    <span className="game-milestone-bubble next">
                      Next: {gameProgress.nextMilestone.title}
                    </span>
                  )}
                </div>
                <div className="game-helper-bubbles">
                  {GAME_HELPERS.map((helper) => (
                    <button
                      key={helper.id}
                      type="button"
                      className="game-helper-bubble"
                      onClick={() => openGameHelper(helper)}
                      aria-label={`${helper.name}, ${helper.role}`}
                    >
                      <span>{helper.initials}</span>
                      <small>{helper.hint}</small>
                    </button>
                  ))}
                </div>
              </div>
              {SELLER_GUIDANCE_MVP_ENABLED && (
                <p className="game-progress-note">
                  This score reflects how complete your seller-readiness profile is. It is not a home valuation or pricing recommendation.
                </p>
              )}
              {SELLER_GUIDANCE_MVP_ENABLED && (
                <div className="seller-guidance-panel" aria-label="SellerAI next best step">
                  <div>
                    <span className="seller-guidance-kicker">Next best step</span>
                    <p>{stepGuidance.next}</p>
                  </div>
                  <div>
                    <span className="seller-guidance-kicker">Why this matters</span>
                    <p>{stepGuidance.why}</p>
                  </div>
                </div>
              )}
              {feedback && <p className="summary-text chat-feedback">{feedback}</p>}

              <div className="chat-container">
                <div className="messages-area">
                  {messages.map((message) => (
                    <div key={message.id} className={`message ${message.role}`}>
                      <div className="bubble">{message.content}</div>
                    </div>
                  ))}
                  {renderStepCard()}
                  {postStepMessages.map((message) => (
                    <div key={message.id} className={`message ${message.role}`}>
                      <div className="bubble">{message.content}</div>
                    </div>
                  ))}
                  {infoPrompt && (
                    <div className="message assistant">
                      <div className="card-bubble">
                        <p className="step-intro">{infoPrompt.followUp}</p>
                        <div className="quick-actions">
                          <button type="button" className="btn btn-primary" onClick={handleInfoPromptYes}>
                            Yes
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={handleInfoPromptNo}>
                            No, please tell me more
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-input" onSubmit={handleChatSubmit}>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask the agent or leave a note..."
                  />
                  <button className="btn btn-primary" type="submit" disabled={chatting}>
                    {chatting ? "Thinking..." : "Send"}
                  </button>
                </form>
              </div>
            </section>
          )}
        </div>
      </main>
      <Modal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report a problem"
      >
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <label>
            Your email (optional)
            <input
              className="input"
              value={reportEmail}
              onChange={(e) => setReportEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </label>
          <label>
            What went wrong?
            <textarea
              className="textarea"
              rows={4}
              value={reportMessage}
              onChange={(e) => setReportMessage(e.target.value)}
              placeholder="Tell us what happened so we can fix it fast."
            />
          </label>
        </div>
        <div className="quick-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submitProblemReport}
            disabled={reportSending}
          >
            {reportSending ? "Sending..." : "Send report"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setReportOpen(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(helpTopic)}
        onClose={() => setHelpTopic(null)}
        title={helpTopic?.title || ""}
      >
        <p className="summary-text">{helpTopic?.body}</p>
        <div className="quick-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => setHelpTopic(null)}>
            Got it
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={listingAgreementExplainerOpen}
        onClose={() => setListingAgreementExplainerOpen(false)}
        title="How the 1% listing agreement works"
      >
        <p className="summary-text">
          You will take care of a few basic things, such as installing your own lockbox or yard sign if elected, but you will still be represented by our broker. This lets us serve the entire state and save money for our clients.
        </p>
        <div className="quick-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => setListingAgreementExplainerOpen(false)}>
            Got it
          </button>
        </div>
      </Modal>
    </div>
  );
}
