"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const LISTING_KEY = "seller_ai_listing";
const SESSION_KEY = "seller_ai_session_v2";
const HISTORY_KEY = "seller_ai_history";

type DocStatus = "not_started" | "requested" | "sent" | "signed" | "approved" | "future";

type ListingRecord = {
  address?: string;
  finalPrice?: number | null;
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

type PaperworkRecord = NonNullable<ListingRecord["paperwork"]>;

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

  const selected = listings.find((item) => item.id === selectedId) ?? listings[0] ?? null;
  const docs = buildDocs(selected?.data ?? null);
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

            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>Documents</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>CN starts the file. Listing Agreement, lead paint, Seller Disclosure, and future docs follow.</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={pillStyle}>{pendingCount} pending</span>
                  <span style={{ ...pillStyle, background: "#dcfce7", color: "#166534" }}>{approvedCount} approved</span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                {docs.map((doc) => (
                  <div key={doc.id} style={docRowStyle}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{doc.label}</h3>
                      <p style={{ margin: "5px 0 0", color: "#64748b", lineHeight: 1.45 }}>{doc.description}</p>
                      {doc.link ? <a href={doc.link} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, color: "#b45309", fontWeight: 800 }}>Open brochure link</a> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={{ ...pillStyle, ...statusTone(doc.status) }}>{statusText(doc.status)}</span>
                      {doc.action ? <button onClick={() => approveDoc(doc)} style={buttonStyle("primary")}>Approve</button> : null}
                    </div>
                  </div>
                ))}
              </div>
              {note ? <p style={{ marginTop: 14, color: "#166534", fontWeight: 700 }}>{note}</p> : null}
            </div>
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
