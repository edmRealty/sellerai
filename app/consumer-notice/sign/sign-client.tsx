"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type TokenPayload = {
  name: string;
  email: string;
  address: string;
  issuedAt: number;
  exp: number;
};

const LICENSE_NUMBER = "AB069631";

export default function ConsumerNoticeSignClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [payload, setPayload] = useState<TokenPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [signed, setSigned] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      setError("Missing or invalid signing link.");
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/consumer-notice/token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Invalid signing link.");
        }
        if (!cancelled) {
          setPayload(data.data);
          setSignerName(data.data.name || "");
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to load signing details.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!payload) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const width = rect.width || 420;
    const height = rect.height || 140;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";
    ctx.lineCap = "round";
    ctxRef.current = ctx;
  }, [payload]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ctxRef.current) return;
    setIsDrawing(true);
    const { x, y } = getPoint(event);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctxRef.current) return;
    const { x, y } = getPoint(event);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
    setHasSignature(true);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctxRef.current) return;
    setIsDrawing(true);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctxRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
    setHasSignature(true);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!ctxRef.current) return;
    const touch = event.touches[0];
    if (!touch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctxRef.current) return;
    const touch = event.touches[0];
    if (!touch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
    setHasSignature(true);
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async () => {
    if (!token || !payload) return;
    if (!signerName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!hasSignature) {
      setError("Please sign in the box above.");
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const signatureDataUrl = canvasRef.current?.toDataURL("image/png") || "";
      const res = await fetch("/api/consumer-notice/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signerName,
          signatureDataUrl
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to sign.");
      }
      setSigned(true);
      setRedirecting(true);
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = returnUrl;
        }
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Signing failed.");
    } finally {
      setSigning(false);
    }
  };

  const today = new Date().toLocaleDateString("en-US");
  const returnUrl = "/?consumerSigned=1";

  return (
    <div className="sign-shell">
      <div className="sign-card">
        <div className="sign-header">
          <h1>Consumer Notice Signature</h1>
          <p>Review the notice and sign below to continue.</p>
        </div>

        <div className="sign-grid">
          <div className="sign-preview">
            <iframe
              title="Consumer Notice"
              src="/docs/consumer-notice.pdf"
              className="sign-pdf"
            />
            <div className="quick-actions" style={{ marginTop: 12 }}>
              <a
                className="btn btn-ghost"
                href="/docs/consumer-notice.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Open full-size PDF
              </a>
            </div>
          </div>
          <div className="sign-form">
            {loading && <p>Loading signing details...</p>}
            {!loading && error && <p className="sign-error">{error}</p>}
            {!loading && payload && (
              <>
                <div className="sign-field">
                  <label>Property Address</label>
                  <div className="sign-value">{payload.address}</div>
                </div>
                <div className="sign-field">
                  <label>Today’s Date</label>
                  <div className="sign-value">{today}</div>
                </div>
                <div className="sign-field">
                  <label>License Number</label>
                  <div className="sign-value">{LICENSE_NUMBER}</div>
                </div>
                <div className="sign-field">
                  <label>Your Full Name</label>
                  <input
                    className="input"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Type your full legal name"
                  />
                </div>
                <div className="sign-field">
                  <label>Signature</label>
                  <canvas
                    ref={canvasRef}
                    className="signature-pad"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  />
                  <button type="button" className="btn btn-ghost" onClick={clearSignature}>
                    Clear signature
                  </button>
                </div>
                <div className="sign-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSign}
                    disabled={signing || signed}
                  >
                    {signing
                      ? "Signing..."
                      : signed
                        ? redirecting
                          ? "Signed — returning..."
                          : "Signed"
                        : "Sign Consumer Notice"}
                  </button>
                  {signed && (
                    <a className="btn btn-ghost" href={returnUrl}>
                      Return to SellerAI
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
