"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getListingEventActor, getListingEventLabel, type ListingEvent } from "@/lib/event-labels";
import { getListingStatusLabel, type ListingStatus, type ReadinessItem } from "@/lib/listing-status";

const LISTING_KEY = "seller_ai_listing";
const SESSION_KEY = "seller_ai_session_v2";
const HISTORY_KEY = "seller_ai_history";

type DocStatus = "not_started" | "requested" | "sent" | "signed" | "approved" | "future";

type ListingRecord = {
  address?: string;
  finalPrice?: number | null;
  photosDeferred?: boolean;
  description?: string;
  acknowledgements?: {
    agency?: boolean;
    fairHousing?: boolean;
    mls?: boolean;
  };
  seller?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  paperwork?: {
    consumerNoticeStatus?: "not_sent" | "requested" | "sent" | "signed";
    listingAgreementStatus?: "not_sent" | "sent" | "signed";
    officialOwner?: boolean | null;
    ownerRole?: string;
    leadPaintApplies?: boolean | null;
    leadPaintAcknowledged?: boolean;
    sellerDisclosureStatus?: DocStatus;
  };
  valuation?: {
    average?: number | null;
  };
};

type HistoryItem = {
  id?: string;
  address: string;
  data?: ListingRecord;
  updatedAt?: number;
};

type AgentListing = {
  id: string;
  address: string;
  data: ListingRecord;
  status?: ListingStatus;
  source: "current" | "history" | "server";
  updatedAt: number;
};

type AgentDoc = {
  id: string;
  label: string;
  description: string;
  status: DocStatus;
  action?: "approve-cn" | "approve-listing";
  link?: string;
};

type ServerDocument = {
  id: string;
  kind: string;
  version: number;
  status: string;
  file_name?: string | null;
  signed_at?: string | null;
  has_file: boolean;
};

type PaperworkRecord = NonNullable<ListingRecord["paperwork"]>;

type ReadinessPayload = {
  status: ListingStatus;
  allowedNext: ListingStatus[];
  checklist: ReadinessItem[];
  failing: ReadinessItem[];
};

const readJson = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

const formatCurrency = (value?: number | null) =>
  typeof value === "number"
    ? value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "Not set";

const statusText = (status: DocStatus) => {
  if (status === "approved") return "Approved";
  if (status === "signed") return "Signed, needs Agent approval";
  if (status === "sent") return "Sent / waiting for signature";
  if (status === "requested") return "Requested";
  if (status === "future") return "Future document";
  return "Not started";
};

const statusTone = (status: DocStatus) => {
  if (status === "approved") return { background: "#dcfce7", color: "#166534" };
  if (status === "signed") return { background: "#ffedd5", color: "#9a3412" };
  if (status === "sent" || status === "requested") return { background: "#e0f2fe", color: "#075985" };
  return { background: "#e2e8f0", color: "#475569" };
};

const relativeTime = (timestamp?: string) => {
  if (!timestamp) return "Just now";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const normalizeCnStatus = (status?: PaperworkRecord["consumerNoticeStatus"]): DocStatus => {
  if (status === "signed") return "approved";
  if (status === "sent") return "sent";
  if (status === "requested") return "requested";
  return "not_started";
};

const normalizeListingAgreementStatus = (status?: PaperworkRecord["listingAgreementStatus"]): DocStatus => {
  if (status === "signed") return "approved";
  if (status === "sent") return "sent";
  return "not_started";
};

const buildDocs = (listing: ListingRecord | null): AgentDoc[] => {
  const paperwork = listing?.paperwork ?? {};
  const leadApplies = paperwork.leadPaintApplies;
  return [
    {
      id: "cn",
      label: "Consumer Notice (CN)",
      description: "First disclosure. Seller must eSign before SellerAI continues.",
      status: normalizeCnStatus(paperwork.consumerNoticeStatus),
      action: paperwork.consumerNoticeStatus === "requested" || paperwork.consumerNoticeStatus === "sent" ? "approve-cn" : undefined
    },
    {
      id: "listing-agreement",
      label: "Listing Agreement",
      description: "Brokerage/listing terms, price, commission, and launch authorization.",
      status: normalizeListingAgreementStatus(paperwork.listingAgreementStatus),
      action: paperwork.listingAgreementStatus === "sent" ? "approve-listing" : undefined
    },
    {
      id: "lead-brochure",
      label: "Lead-Based Paint Brochure Link",
      description: "EPA lead brochure link for homes where lead disclosure may apply.",
      status: leadApplies === true ? "sent" : leadApplies === false ? "not_started" : "future",
      link: "https://www.epa.gov/lead/protect-your-family-lead-your-home"
    },
    {
      id: "lead-disclosure",
      label: "Lead-Based Paint Disclosure",
      description: "Lead disclosure and acknowledgement for pre-1978 residential properties.",
      status: paperwork.leadPaintAcknowledged ? "approved" : leadApplies === true ? "requested" : "future"
    },
    {
      id: "seller-disclosure",
      label: "Seller's Disclosure",
      description: "Property condition disclosure completed by the seller.",
      status: paperwork.sellerDisclosureStatus ?? "future"
    },
    {
      id: "hoa-condo-docs",
      label: "HOA / Condo Documents",
      description: "Upload or request association rules, resale docs, fees, and contacts.",
      status: "future"
    },
    {
      id: "photo-permission",
      label: "Photo & Marketing Authorization",
      description: "Permission for photos, video, 3D tours, syndication, and marketing use.",
      status: "future"
    },
    {
      id: "closing-prep",
      label: "Closing Prep Authorization",
      description: "Future checkpoint for title, payoff, access, and settlement coordination.",
      status: "future"
    }
  ];
};

export default function AgentApprovalsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<AgentListing[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [session, setSession] = useState<any>(null);
  const [note, setNote] = useState("");
  const [serverMode, setServerMode] = useState(false);
  const [events, setEvents] = useState<ListingEvent[]>([]);
  const [serverDocuments, setServerDocuments] = useState<ServerDocument[]>([]);
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null);

  // Server-backed portal: list every assigned listing from Supabase.
  // Falls back to the browser-local prototype when Supabase is not
  // configured or the agent is not authenticated.
  const loadFromServer = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/agent/listings");
      if (!res.ok) return false;
      const payload = await res.json();
      if (!payload?.configured || !Array.isArray(payload.listings)) return false;
      const next: AgentListing[] = payload.listings.map((row: any) => ({
        id: String(row.id),
        address: row.address || row.data?.address || "Unknown address",
        data: (row.data ?? {}) as ListingRecord,
        status: row.status as ListingStatus,
        source: "server" as const,
        updatedAt: row.updated_at ? Date.parse(row.updated_at) : 0
      }));
      setListings(next);
      setServerMode(true);
      setSelectedId((currentId) => (next.some((l) => l.id === currentId) ? currentId : next[0]?.id || ""));
      return true;
    } catch {
      return false;
    }
  };

  const loadFromLocal = () => {
    const current = readJson<ListingRecord>(LISTING_KEY);
    const sessionData = readJson<any>(SESSION_KEY);
    const history = readJson<HistoryItem[]>(HISTORY_KEY) ?? [];
    const mapped = new Map<string, AgentListing>();

    if (current?.address) {
      mapped.set(current.address, {
        id: `current-${current.address}`,
        address: current.address,
        data: current,
        source: "current",
        updatedAt: Date.now()
      });
    }

    history.forEach((item, index) => {
      if (!item?.address) return;
      if (mapped.has(item.address)) return;
      mapped.set(item.address, {
        id: item.id || `history-${index}`,
        address: item.address,
        data: item.data ?? { address: item.address },
        source: "history",
        updatedAt: item.updatedAt ?? 0
      });
    });

    const next = Array.from(mapped.values());
    setListings(next);
    setSession(sessionData);
    setSelectedId((currentId) => currentId || next[0]?.id || "");
  };

  const load = async () => {
    const usedServer = await loadFromServer();
    if (!usedServer) loadFromLocal();
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 8000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!serverMode || !selectedId) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    const loadEvents = async () => {
      try {
        const response = await fetch(`/api/listings/events?listingId=${encodeURIComponent(selectedId)}`);
        if (!response.ok || cancelled) return;
        const payload = await response.json();
        setEvents(Array.isArray(payload?.events) ? payload.events : []);
      } catch {
        if (!cancelled) setEvents([]);
      }
    };

    loadEvents();
    const interval = window.setInterval(loadEvents, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedId, serverMode]);

  useEffect(() => {
    if (!serverMode || !selectedId) {
      setServerDocuments([]);
      return;
    }

    let cancelled = false;
    const loadDocuments = async () => {
      try {
        const response = await fetch(`/api/listings/documents?listingId=${encodeURIComponent(selectedId)}`);
        if (!response.ok || cancelled) return;
        const payload = await response.json();
        setServerDocuments(Array.isArray(payload?.documents) ? payload.documents : []);
      } catch {
        if (!cancelled) setServerDocuments([]);
      }
    };

    loadDocuments();
    const interval = window.setInterval(loadDocuments, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedId, serverMode]);

  const loadReadiness = async (listingId = selectedId) => {
    if (!serverMode || !listingId) {
      setReadiness(null);
      return;
    }
    try {
      const response = await fetch(`/api/agent/listings/${encodeURIComponent(listingId)}/readiness`);
      if (!response.ok) {
        setReadiness(null);
        return;
      }
      const payload = await response.json();
      setReadiness(payload?.status && Array.isArray(payload?.checklist) ? payload as ReadinessPayload : null);
    } catch {
      setReadiness(null);
    }
  };

  useEffect(() => {
    if (!serverMode || !selectedId) {
      setReadiness(null);
      return;
    }

    loadReadiness();
    const interval = window.setInterval(loadReadiness, 15000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, serverMode]);

  const selected = listings.find((item) => item.id === selectedId) ?? listings[0] ?? null;
  const docs = buildDocs(selected?.data ?? null);
  const signedConsumerNotice = serverDocuments.find((document) => document.kind === "consumer_notice" && document.status === "signed" && document.has_file);
  const uploadedPhotos = serverDocuments.filter((document) => document.kind === "photo" && document.has_file);
  const pendingCount = listings.reduce((sum, item) => sum + buildDocs(item.data).filter((doc) => doc.status === "requested" || doc.status === "sent" || doc.status === "signed").length, 0);
  const approvedCount = listings.reduce((sum, item) => sum + buildDocs(item.data).filter((doc) => doc.status === "approved").length, 0);

  const updateSelectedListing = (updater: (listing: ListingRecord) => ListingRecord, success: string) => {
    if (!selected) return;
    const nextData = updater(selected.data);
    const nextListings = listings.map((item) => (item.id === selected.id ? { ...item, data: nextData, updatedAt: Date.now() } : item));
    setListings(nextListings);
    setNote(success);

    if (selected.source === "current") {
      writeJson(LISTING_KEY, nextData);
      if (session) {
        const nextStep = nextData.paperwork?.listingAgreementStatus === "signed"
          ? "lead-paint"
          : nextData.paperwork?.consumerNoticeStatus === "signed"
            ? "listing-intro"
            : session.step;
        const nextSession = {
          ...session,
          data: nextData,
          step: nextStep
        };
        writeJson(SESSION_KEY, nextSession);
        setSession(nextSession);
      }
    }

    const existingHistory = readJson<HistoryItem[]>(HISTORY_KEY) ?? [];
    const nextHistory = existingHistory.map((item) => (item.address === selected.address ? { ...item, data: nextData, updatedAt: Date.now() } : item));
    if (nextHistory.length !== existingHistory.length || existingHistory.some((item) => item.address === selected.address)) {
      writeJson(HISTORY_KEY, nextHistory);
    }
  };

  const approveDoc = async (doc: AgentDoc) => {
    // Server transaction: updates the listing and writes an audit event
    // traceable to this agent. The seller app releases via its polling.
    if (serverMode && selected && (doc.action === "approve-cn" || doc.action === "approve-listing")) {
      try {
        const res = await fetch(`/api/agent/listings/${selected.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: doc.action })
        });
        const payload = await res.json();
        if (res.ok && payload?.ok) {
          setNote(
            doc.action === "approve-cn"
              ? "Consumer Notice confirmed. The seller app can now continue."
              : "Listing Agreement marked signed for this address."
          );
          await loadFromServer();
        } else {
          setNote(`Approval failed: ${payload?.error ?? res.status}`);
        }
      } catch {
        setNote("Approval failed: network error.");
      }
      return;
    }

    if (doc.action === "approve-cn") {
      updateSelectedListing(
        (listing) => ({
          ...listing,
          paperwork: {
            ...listing.paperwork,
            consumerNoticeStatus: "signed"
          }
        }),
        "Consumer Notice confirmed. The seller app can now continue."
      );
    }

    if (doc.action === "approve-listing") {
      updateSelectedListing(
        (listing) => ({
          ...listing,
          paperwork: {
            ...listing.paperwork,
            listingAgreementStatus: "signed"
          }
        }),
        "Listing Agreement marked signed for this address."
      );
    }
  };

  const transitionStatus = async (nextStatus: ListingStatus) => {
    if (!serverMode || !selected || !readiness) return;

    const requiresOverride = (nextStatus === "approved" || nextStatus === "published") && readiness.failing.length > 0;
    let override = false;
    let overrideNote = "";
    if (requiresOverride) {
      const confirmed = window.confirm(
        `${readiness.failing.length} readiness item${readiness.failing.length === 1 ? " is" : "s are"} incomplete. Continue with an audited override?`
      );
      if (!confirmed) return;
      const suppliedNote = window.prompt("Enter the reason for this readiness override:");
      if (!suppliedNote?.trim()) {
        setNote("A written override reason is required.");
        return;
      }
      override = true;
      overrideNote = suppliedNote.trim();
    }

    try {
      const response = await fetch(`/api/agent/listings/${selected.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, override, note: overrideNote || undefined })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        if (Array.isArray(payload?.checklist)) {
          setReadiness({
            status: readiness.status,
            allowedNext: Array.isArray(payload?.allowedNext) ? payload.allowedNext : readiness.allowedNext,
            checklist: payload.checklist,
            failing: Array.isArray(payload?.failing) ? payload.failing : payload.checklist.filter((item: ReadinessItem) => !item.ok)
          });
        }
        setNote(`Status update failed: ${payload?.error ?? response.status}`);
        return;
      }
      setReadiness({
        status: payload.status,
        allowedNext: payload.allowedNext,
        checklist: payload.checklist,
        failing: payload.failing
      });
      setNote(`${getListingStatusLabel(payload.status)} recorded${payload.override ? " with an audited override" : ""}.`);
      await loadFromServer();
      await loadReadiness(selected.id);
    } catch {
      setNote("Status update failed: network error.");
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 24 }}>
      <section style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: 18 }}>
          <div>
            <p style={{ margin: 0, color: "#b45309", fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>SellerAI</p>
            <h1 style={{ margin: "6px 0 0", fontSize: 34, letterSpacing: "-0.04em" }}>Agent document dashboard</h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>Each address becomes a listing file. Review eSign checkpoints and future document requirements by property.</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700, color: serverMode ? "#166534" : "#b45309" }}>
              {serverMode ? "Server mode: live listings with audit logging" : "Local prototype mode: browser data only"}
            </p>
          </div>
          <button onClick={() => router.push("/")} style={buttonStyle("ghost")}>Back to seller app</button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 18, marginTop: 22 }}>
          <aside style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Addresses</h2>
              <span style={pillStyle}>{listings.length}</span>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {listings.length === 0 ? <p style={{ color: "#64748b" }}>No seller files yet. Start a listing in the seller app first.</p> : null}
              {listings.map((item) => {
                const itemDocs = buildDocs(item.data);
                const itemPending = itemDocs.filter((doc) => doc.status === "requested" || doc.status === "sent" || doc.status === "signed").length;
                return (
                  <button key={item.id} onClick={() => setSelectedId(item.id)} style={addressButtonStyle(selected?.id === item.id)}>
                    <strong>{item.address}</strong>
                    <span style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>{item.data.seller?.name || "Seller not entered"}</span>
                    {item.source === "server" ? <span style={{ marginTop: 8, color: "#075985", fontSize: 12, fontWeight: 800 }}>{getListingStatusLabel(item.status)}</span> : null}
                    <span style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: itemPending ? "#c2410c" : "#475569" }}>{itemPending} pending doc{itemPending === 1 ? "" : "s"}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section style={{ display: "grid", gap: 18 }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>{selected?.address || "No selected address"}</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>Agent file, seller details, and document status.</p>
                </div>
                <button onClick={load} style={buttonStyle("ghost")}>Refresh files</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 18 }}>
                <Fact label="Seller" value={selected?.data.seller?.name || "Not entered"} />
                <Fact label="Email" value={selected?.data.seller?.email || "Not entered"} />
                <Fact label="Phone" value={selected?.data.seller?.phone || "Not entered"} />
                <Fact label="Working estimate" value={formatCurrency(selected?.data.finalPrice || selected?.data.valuation?.average)} />
              </div>
            </div>

            {serverMode && selected && readiness ? (
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>Publishing readiness</h2>
                    <p style={{ margin: "6px 0 0", color: "#64748b" }}>Current status: <strong style={{ color: "#0f172a" }}>{getListingStatusLabel(readiness.status)}</strong></p>
                  </div>
                  <span style={{ ...pillStyle, background: readiness.failing.length ? "#ffedd5" : "#dcfce7", color: readiness.failing.length ? "#9a3412" : "#166534" }}>
                    {readiness.failing.length ? `${readiness.failing.length} item${readiness.failing.length === 1 ? "" : "s"} to review` : "Ready for the next gate"}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                  {readiness.checklist.map((item) => (
                    <div key={item.key} style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 12, background: item.ok ? "#f0fdf4" : "#fff7ed" }}>
                      <strong>{item.ok ? "Complete" : "Needs attention"}: {item.label}</strong>
                      <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{item.detail}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                  {readiness.allowedNext.map((status) => (
                    <button key={status} type="button" onClick={() => transitionStatus(status)} style={buttonStyle("primary")}>
                      Move to {getListingStatusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>Documents</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>CN starts the file. Listing Agreement, lead paint, Seller Disclosure, and future docs follow.</p>
                </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={pillStyle}>{pendingCount} pending</span>
                <span style={{ ...pillStyle, background: "#dcfce7", color: "#166534" }}>{approvedCount} approved</span>
                {serverMode ? <span style={{ ...pillStyle, background: "#e0f2fe", color: "#075985" }}>{uploadedPhotos.length} photo{uploadedPhotos.length === 1 ? "" : "s"}</span> : null}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                {docs.map((doc) => (
                  <div key={doc.id} style={docRowStyle}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{doc.label}</h3>
                      <p style={{ margin: "5px 0 0", color: "#64748b", lineHeight: 1.45 }}>{doc.description}</p>
                      {doc.link ? <a href={doc.link} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, color: "#b45309", fontWeight: 800 }}>Open brochure link</a> : null}
                      {doc.id === "cn" && signedConsumerNotice ? <a href={`/api/documents/${signedConsumerNotice.id}/download`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, color: "#166534", fontWeight: 800 }}>View signed PDF</a> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={{ ...pillStyle, ...statusTone(doc.status) }}>{statusText(doc.status)}</span>
                      {doc.action ? <button onClick={() => approveDoc(doc)} style={buttonStyle("primary")}>Approve</button> : null}
                    </div>
                  </div>
                ))}
              </div>
              {serverMode && uploadedPhotos.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                  {uploadedPhotos.map((photo) => <a key={photo.id} href={`/api/documents/${photo.id}/download`} target="_blank" rel="noreferrer" style={{ color: "#075985", fontWeight: 800 }}>View {photo.file_name || "listing photo"}</a>)}
                </div>
              ) : null}
              {note ? <p style={{ marginTop: 14, color: "#166534", fontWeight: 700 }}>{note}</p> : null}
            </div>

            {serverMode && selected ? (
              <div style={cardStyle}>
                <h2 style={{ margin: 0, fontSize: 22 }}>Timeline</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b" }}>Server activity for this listing file.</p>
                {events.length === 0 ? <p style={{ color: "#64748b", marginTop: 16 }}>No server activity recorded yet.</p> : null}
                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  {[...events].reverse().map((event) => (
                    <div key={event.id || `${event.event_type}-${event.created_at}`} style={{ display: "flex", justifyContent: "space-between", gap: 14, border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#f8fafc" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800 }}>{getListingEventLabel(event)}</p>
                        <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>{relativeTime(event.created_at)}</p>
                      </div>
                      <span style={pillStyle}>{getListingEventActor(event, "agent")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <p style={{ margin: "5px 0 0", fontWeight: 800, overflowWrap: "anywhere" }}>{value}</p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 26,
  padding: 20,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.06)"
};

const pillStyle: React.CSSProperties = {
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#334155",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
  height: "fit-content"
};

const docRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 14,
  alignItems: "center",
  padding: 14,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#f8fafc"
};

const addressButtonStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  textAlign: "left",
  border: `1px solid ${active ? "#fed7aa" : "#e2e8f0"}`,
  background: active ? "#fff7ed" : "#f8fafc",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  cursor: "pointer",
  color: "#0f172a"
});

const buttonStyle = (tone: "primary" | "ghost", disabled = false): React.CSSProperties => ({
  border: tone === "primary" ? "1px solid #0f172a" : "1px solid #e2e8f0",
  background: disabled ? "#cbd5e1" : tone === "primary" ? "#0f172a" : "#fff",
  color: disabled ? "#64748b" : tone === "primary" ? "#fff" : "#0f172a",
  borderRadius: 999,
  padding: "11px 16px",
  fontWeight: 800,
  cursor: disabled ? "not-allowed" : "pointer"
});
