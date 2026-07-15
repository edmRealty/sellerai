"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isServerAuthAvailable, sendAuthOtp, verifyAuthOtp } from "@/lib/listing-sync";

function AgentLoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const denied = searchParams.get("denied") === "1";

    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [stage, setStage] = useState<"email" | "code">("email");
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const configured = isServerAuthAvailable();

    const handleSend = async () => {
        if (!email.trim()) return;
        setBusy(true);
        setStatus(null);
        const result = await sendAuthOtp(email.trim());
        setBusy(false);
        if (result.sent) {
            setStage("code");
            setStatus("Check your email for a 6-digit sign-in code.");
        } else {
            setStatus(result.error === "not_configured"
                ? "Server login is not configured yet."
                : `Could not send code: ${result.error}`);
        }
    };

    const handleVerify = async () => {
        if (!code.trim()) return;
        setBusy(true);
        setStatus(null);
        const result = await verifyAuthOtp(email.trim(), code);
        setBusy(false);
        if (result.verified) {
            router.push("/agent");
            router.refresh();
        } else {
            setStatus(`Verification failed: ${result.error}`);
        }
    };

    return (
        <main style={{ maxWidth: 420, margin: "80px auto", padding: 24, fontFamily: "inherit" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Agent sign in</h1>
            <p style={{ color: "#64748b", marginBottom: 24 }}>
                Licensed HousingPA agents and admins only. Sign in with your email to access the listing portal.
            </p>
            {denied && (
                <p style={{ color: "#b91c1c", marginBottom: 16 }}>
                    Your account does not have agent access. Contact the broker to have your role updated.
                </p>
            )}
            {!configured && (
                <p style={{ color: "#b45309", marginBottom: 16 }}>
                    Supabase is not configured, so the portal is running in local prototype mode.
                </p>
            )}
            {stage === "email" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="agent@housingpa.com"
                        style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={busy || !configured}
                        style={{ padding: "10px 12px", borderRadius: 8, background: "#0f172a", color: "#fff", opacity: busy || !configured ? 0.6 : 1 }}
                    >
                        {busy ? "Sending…" : "Email me a sign-in code"}
                    </button>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <input
                        inputMode="numeric"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="6-digit code"
                        style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                    />
                    <button
                        onClick={handleVerify}
                        disabled={busy}
                        style={{ padding: "10px 12px", borderRadius: 8, background: "#0f172a", color: "#fff", opacity: busy ? 0.6 : 1 }}
                    >
                        {busy ? "Verifying…" : "Sign in"}
                    </button>
                    <button onClick={() => setStage("email")} style={{ color: "#64748b" }}>
                        Use a different email
                    </button>
                </div>
            )}
            {status && <p style={{ marginTop: 16, color: "#334155" }}>{status}</p>}
        </main>
    );
}

export default function AgentLoginPage() {
    return (
        <Suspense fallback={null}>
            <AgentLoginForm />
        </Suspense>
    );
}
