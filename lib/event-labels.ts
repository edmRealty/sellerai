export type ListingEvent = {
  id?: string;
  actor_id?: string | null;
  actor_role?: string | null;
  event_type: string;
  payload?: Record<string, unknown> | null;
  created_at?: string;
};

const readableStep = (value: unknown) =>
  typeof value === "string" && value.length > 0
    ? value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Next step";

export function getListingEventLabel(event: Pick<ListingEvent, "event_type" | "payload">) {
  const payload = event.payload ?? {};

  switch (event.event_type) {
    case "listing_created":
      return "Listing file created";
    case "step_advanced":
      return `Progress: ${readableStep(payload.from)} to ${readableStep(payload.to)}`;
    case "cn_signed":
      return "You signed the Consumer Notice";
    case "cn_approved":
      return "Agent released the Consumer Notice";
    case "cn_status_changed":
      return `Consumer Notice: ${readableStep(payload.to)}`;
    case "la_status_changed":
      return `Listing Agreement: ${readableStep(payload.to)}`;
    case "la_approved":
      return "Agent released the Listing Agreement";
    case "price_changed":
      return "Working price updated";
    case "status_changed":
      return `Listing status: ${readableStep(payload.from)} → ${readableStep(payload.to)}`;
    default:
      return event.event_type;
  }
}

export function getListingEventActor(event: Pick<ListingEvent, "actor_role">, viewer: "seller" | "agent") {
  if (event.actor_role === "agent") return viewer === "agent" ? "You" : "Agent";
  if (event.actor_role === "seller") return viewer === "seller" ? "You" : "Seller";
  return "System";
}
