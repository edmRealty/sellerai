"use client";

import { getSupabaseBrowserClient } from "./supabase/browser";

const LISTING_KEY = "seller_ai_listing";
const LISTING_SERVER_ID_KEY = "seller_ai_listing_server_id";

/** True when the browser can authenticate against Supabase (env configured). */
export function isServerAuthAvailable(): boolean {
    return Boolean(getSupabaseBrowserClient());
}

/** Send a Supabase email OTP (6-digit code) for the existing activation step. */
export async function sendAuthOtp(email: string): Promise<{ sent: boolean; error?: string }> {
    const client = getSupabaseBrowserClient();
    if (!client) return { sent: false, error: "not_configured" };
    const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true }
    });
    return error ? { sent: false, error: error.message } : { sent: true };
}

/** Verify the emailed OTP code; on success the browser holds a real session. */
export async function verifyAuthOtp(email: string, token: string): Promise<{ verified: boolean; error?: string }> {
    const client = getSupabaseBrowserClient();
    if (!client) return { verified: false, error: "not_configured" };
    const { error } = await client.auth.verifyOtp({ email, token: token.trim(), type: "email" });
    return error ? { verified: false, error: error.message } : { verified: true };
}

export async function hasActiveSession(): Promise<boolean> {
    const client = getSupabaseBrowserClient();
    if (!client) return false;
    const { data } = await client.auth.getSession();
    return Boolean(data?.session);
}

/** Best-effort photo backup after the existing browser preview is created. */
export async function uploadListingPhoto(file: File): Promise<{ uploaded: boolean; error?: string }> {
    if (typeof window === "undefined" || !isServerAuthAvailable()) return { uploaded: false, error: "not_configured" };
    if (!(await hasActiveSession())) return { uploaded: false, error: "unauthenticated" };
    const listingId = getStoredListingId();
    if (!listingId) return { uploaded: false, error: "listing_missing" };

    try {
        const form = new FormData();
        form.append("listingId", listingId);
        form.append("file", file);
        const response = await fetch("/api/listings/photos", { method: "POST", body: form });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            return { uploaded: false, error: payload?.error || `http_${response.status}` };
        }
        return { uploaded: true };
    } catch {
        return { uploaded: false, error: "network_error" };
    }
}

const getStoredListingId = (): string | null => {
    try {
        return window.localStorage.getItem(LISTING_SERVER_ID_KEY);
    } catch {
        return null;
    }
};

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced server persistence of the seller's listing state. No-op unless
 * Supabase is configured and the seller has authenticated (post-activation),
 * so the pre-auth experience is unchanged.
 */
export function scheduleListingSync(step: string, data: unknown, clientSessionId?: string) {
    if (typeof window === "undefined") return;
    if (!isServerAuthAvailable()) return;
    if (!data || typeof data !== "object" || !(data as { address?: unknown }).address) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        try {
            if (!(await hasActiveSession())) return;
            const res = await fetch("/api/listings/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    listingId: getStoredListingId() || undefined,
                    clientSessionId,
                    step,
                    data
                })
            });
            if (!res.ok) return;
            const payload = await res.json();
            if (payload?.listingId) {
                window.localStorage.setItem(LISTING_SERVER_ID_KEY, payload.listingId);
            }
        } catch {
            // Offline or unconfigured: localStorage remains the working copy.
        }
    }, 1500);
}

/**
 * Pull agent-released paperwork statuses from the server and merge only
 * those statuses into the local listing copy. The existing wait-step
 * localStorage polling then releases the seller without a refresh.
 */
export async function pullServerPaperworkIntoLocal(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!isServerAuthAvailable()) return;
    try {
        if (!(await hasActiveSession())) return;
        const listingId = getStoredListingId();
        const res = await fetch(`/api/listings/current${listingId ? `?listingId=${listingId}` : ""}`);
        if (!res.ok) return;
        const payload = await res.json();
        const serverPaperwork = payload?.listing?.data?.paperwork;
        if (!serverPaperwork) return;
        if (payload?.listing?.id) {
            window.localStorage.setItem(LISTING_SERVER_ID_KEY, payload.listing.id);
        }

        const raw = window.localStorage.getItem(LISTING_KEY);
        if (!raw) return;
        const local = JSON.parse(raw);
        if (!local?.paperwork) return;

        let changed = false;
        if (
            serverPaperwork.consumerNoticeStatus === "signed" &&
            local.paperwork.consumerNoticeStatus !== "signed"
        ) {
            local.paperwork.consumerNoticeStatus = "signed";
            changed = true;
        }
        if (
            serverPaperwork.listingAgreementStatus === "signed" &&
            local.paperwork.listingAgreementStatus !== "signed"
        ) {
            local.paperwork.listingAgreementStatus = "signed";
            changed = true;
        }
        if (changed) {
            window.localStorage.setItem(LISTING_KEY, JSON.stringify(local));
        }
    } catch {
        // Best-effort; local polling continues to work in prototype mode.
    }
}
