"use client";

import React, { useEffect, useState } from "react";
import { getListingEventActor, getListingEventLabel, type ListingEvent } from "@/lib/event-labels";

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

const STORAGE_KEY = "seller_ai_listing";
const TASKS_KEY = "seller_ai_tasks";
const SERVER_LISTING_KEY = "seller_ai_listing_server_id";

type ServerListing = {
  id: string;
  address?: string;
  step?: string;
  working_price?: number | null;
  consumer_notice_status?: string | null;
  listing_agreement_status?: string | null;
};

type ServerDocument = {
  id: string;
  kind: string;
  status: string;
  has_file: boolean;
};

const formatCurrency = (value?: number | null) =>
  typeof value === "number"
    ? value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "Not set";

const titleCase = (value?: string | null) =>
  value ? value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not started";

const relativeTime = (timestamp?: string) => {
  if (!timestamp) return "Just now";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const documentStatus = (status?: string | null) => {
  if (status === "signed") return { label: "Complete", color: "#166534", background: "#dcfce7" };
  if (status === "sent" || status === "requested") return { label: "Waiting on agent", color: "#075985", background: "#e0f2fe" };
  return { label: "Action needed", color: "#9a3412", background: "#ffedd5" };
};

export default function DashboardPage() {
  const [listing, setListing] = useState<any>(null);
  const [tasks, setTasks] = useState<Record<string, "todo" | "done">>({});
  const [serverListing, setServerListing] = useState<ServerListing | null>(null);
  const [events, setEvents] = useState<ListingEvent[]>([]);
  const [serverReady, setServerReady] = useState(false);
  const [serverDocuments, setServerDocuments] = useState<ServerDocument[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setListing(JSON.parse(raw));
    const t = localStorage.getItem(TASKS_KEY);
    if (t) setTasks(JSON.parse(t));
  }, []);

  useEffect(() => {
    const listingId = window.localStorage.getItem(SERVER_LISTING_KEY);
    if (!listingId) return;

    let cancelled = false;
    const loadServerTruth = async () => {
      try {
        const [listingResponse, eventsResponse, documentsResponse] = await Promise.all([
          fetch(`/api/listings/current?listingId=${encodeURIComponent(listingId)}`),
          fetch(`/api/listings/events?listingId=${encodeURIComponent(listingId)}`),
          fetch(`/api/listings/documents?listingId=${encodeURIComponent(listingId)}`)
        ]);
        if (cancelled || !listingResponse.ok || !eventsResponse.ok || !documentsResponse.ok) return;
        const [listingPayload, eventsPayload, documentsPayload] = await Promise.all([listingResponse.json(), eventsResponse.json(), documentsResponse.json()]);
        if (!listingPayload?.configured || !listingPayload?.listing) return;
        setServerListing(listingPayload.listing as ServerListing);
        setEvents(Array.isArray(eventsPayload?.events) ? eventsPayload.events : []);
        setServerDocuments(Array.isArray(documentsPayload?.documents) ? documentsPayload.documents : []);
        setServerReady(true);
      } catch {
        // The local dashboard remains usable when the server is unavailable.
      }
    };

    loadServerTruth();
    const interval = window.setInterval(loadServerTruth, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const toggleTask = (task: string) => {
    setTasks((prev) => {
      const next: Record<string, "todo" | "done"> = {
        ...prev,
        [task]: prev[task] === "done" ? "todo" : "done"
      };
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const nextTask = TASKS.find((task) => tasks[task] !== "done");
  const signedConsumerNotice = serverDocuments.find((document) => document.kind === "consumer_notice" && document.status === "signed" && document.has_file);

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1>Seller Dashboard</h1>
      <p style={{ color: "#64748b" }}>
        {serverListing?.address || listing?.address || "No active listing"}
      </p>

      {serverReady && serverListing ? <ServerStatusStrip listing={serverListing} /> : null}

      <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", marginTop: 20 }}>
        <h2>Next Task</h2>
        <p style={{ fontWeight: 600 }}>{nextTask || "All tasks complete"}</p>
      </div>

      <div style={{ marginTop: 24, background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <h2>Task List</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {TASKS.map((task) => (
            <label key={task} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={tasks[task] === "done"} onChange={() => toggleTask(task)} />
              <span style={{ textDecoration: tasks[task] === "done" ? "line-through" : "none" }}>{task}</span>
            </label>
          ))}
        </div>
      </div>

      {serverReady && events.length > 0 ? (
        <div style={{ marginTop: 24, background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: 0 }}>Activity</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {[...events].reverse().map((event) => (
              <div key={event.id || `${event.event_type}-${event.created_at}`} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{getListingEventLabel(event)}</p>
                  <span style={{ color: "#64748b", fontSize: 13 }}>{relativeTime(event.created_at)}</span>
                </div>
                <span style={{ alignSelf: "start", background: "#f1f5f9", color: "#334155", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 700 }}>{getListingEventActor(event, "seller")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {serverReady && signedConsumerNotice ? (
        <p style={{ marginTop: 18 }}>
          <a href={`/api/documents/${signedConsumerNotice.id}/download`} target="_blank" rel="noreferrer" style={{ color: "#166534", fontWeight: 800 }}>
            Download your signed Consumer Notice
          </a>
        </p>
      ) : null}
    </div>
  );
}

function ServerStatusStrip({ listing }: { listing: ServerListing }) {
  const consumerNotice = documentStatus(listing.consumer_notice_status);
  const listingAgreement = documentStatus(listing.listing_agreement_status);
  const facts = [
    { label: "Current step", value: titleCase(listing.step), state: { label: "In progress", color: "#075985", background: "#e0f2fe" } },
    { label: "Consumer Notice", value: consumerNotice.label, state: consumerNotice },
    { label: "Listing Agreement", value: listingAgreement.label, state: listingAgreement },
    { label: "Working price", value: formatCurrency(listing.working_price), state: { label: "Current", color: "#166534", background: "#dcfce7" } }
  ];

  return (
    <section style={{ marginTop: 20, background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <p style={{ margin: 0, color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Live listing status</p>
      <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>{listing.address || "Your listing"}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
        {facts.map((fact) => (
          <div key={fact.label} style={{ padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>{fact.label}</p>
            <p style={{ margin: "5px 0 8px", fontWeight: 800 }}>{fact.value}</p>
            <span style={{ background: fact.state.background, color: fact.state.color, borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 800 }}>{fact.state.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
