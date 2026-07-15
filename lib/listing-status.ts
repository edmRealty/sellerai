export const LISTING_STATUSES = [
  "draft",
  "agent_review",
  "approved",
  "published",
  "off_market",
  "under_contract",
  "sold",
  "archived"
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ALLOWED_STATUS_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ["agent_review"],
  agent_review: ["approved", "draft"],
  approved: ["published", "agent_review"],
  published: ["off_market", "under_contract"],
  off_market: ["published", "archived"],
  under_contract: ["sold", "published"],
  sold: ["archived"],
  archived: []
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  agent_review: "In agent review",
  approved: "Approved - preparing to publish",
  published: "Live on the market",
  off_market: "Temporarily off market",
  under_contract: "Under contract",
  sold: "Sold",
  archived: "Archived"
};

export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

type ListingForReadiness = {
  address?: string | null;
  working_price?: number | null;
  consumer_notice_status?: string | null;
  listing_agreement_status?: string | null;
  data?: Record<string, any> | null;
};

type DocumentForReadiness = {
  kind?: string | null;
  status?: string | null;
};

export const isListingStatus = (value: unknown): value is ListingStatus =>
  typeof value === "string" && (LISTING_STATUSES as readonly string[]).includes(value);

export const getAllowedStatusTransitions = (status: unknown): ListingStatus[] =>
  isListingStatus(status) ? ALLOWED_STATUS_TRANSITIONS[status] : [];

export const getListingStatusLabel = (status: unknown) =>
  isListingStatus(status) ? LISTING_STATUS_LABELS[status] : "Draft";

export function computeReadiness(
  listing: ListingForReadiness,
  documents: DocumentForReadiness[]
): ReadinessItem[] {
  const data = listing.data ?? {};
  const acknowledgements = data.acknowledgements ?? {};
  const paperwork = data.paperwork ?? {};
  const photosDeferred = data.photosDeferred === true;
  const uploadedPhoto = documents.some((document) => document.kind === "photo" && document.status === "uploaded");
  const price = Number(listing.working_price ?? data.finalPrice);

  return [
    {
      key: "address",
      label: "Property address",
      ok: typeof listing.address === "string" && listing.address.trim().length > 0,
      detail: "A complete service address is required."
    },
    {
      key: "working_price",
      label: "Working list price",
      ok: Number.isFinite(price) && price > 0,
      detail: "Set a positive working list price before agent approval."
    },
    {
      key: "acknowledgements",
      label: "Required acknowledgements",
      ok: acknowledgements.agency === true && acknowledgements.fairHousing === true && acknowledgements.mls === true,
      detail: "Agency, fair housing, and MLS acknowledgements must be complete."
    },
    {
      key: "consumer_notice",
      label: "Consumer Notice",
      ok: (listing.consumer_notice_status ?? paperwork.consumerNoticeStatus) === "signed",
      detail: "The Consumer Notice must be signed."
    },
    {
      key: "listing_agreement",
      label: "Listing Agreement",
      ok: (listing.listing_agreement_status ?? paperwork.listingAgreementStatus) === "signed",
      detail: "The Listing Agreement must be signed."
    },
    {
      key: "photos",
      label: "Listing photos",
      ok: uploadedPhoto || photosDeferred,
      detail: photosDeferred
        ? "Seller chose to add photos later."
        : "Upload at least one listing photo or mark photos for later."
    },
    {
      key: "description",
      label: "Listing description",
      ok: typeof data.description === "string" && data.description.trim().length > 0,
      detail: "Add a listing description before publication."
    }
  ];
}
