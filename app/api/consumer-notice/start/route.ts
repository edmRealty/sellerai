import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { signConsumerNoticeToken } from "@/lib/esign";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getClientId, guardRateLimit, RateLimitError, rateLimitResponse } from "@/lib/api-safety";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    guardRateLimit({ bucket: "consumer-notice-start", id: getClientId(req), maxCalls: 5, windowMs: 60_000, blockMs: 60_000 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      const { retryAfterSeconds, headers } = rateLimitResponse(error);
      return NextResponse.json({ success: false, error: error.message, retryAfterSeconds }, { status: 429, headers });
    }
    throw error;
  }

  try {
    const body = await req.json();
    const signerEmail = String(body?.signerEmail || "").trim();
    const signerName = String(body?.signerName || "Seller").trim();
    const address = String(body?.address || "").trim();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : undefined;

    if (!signerEmail || !address) {
      return NextResponse.json(
        { success: false, error: "Missing signer email or address." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const token = signConsumerNoticeToken({
      name: signerName,
      email: signerEmail,
      address,
      listingId,
      issuedAt: now,
      exp: now + 7 * 24 * 60 * 60 * 1000
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3000";
    const signUrl = `${baseUrl}/consumer-notice/sign?token=${encodeURIComponent(token)}`;

    const smtpHost = process.env.SMTP_HOST || "";
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpSecure = smtpPort === 465;

    const adminEmail =
      process.env.ADMIN_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.SMTP_USER ||
      "";

    const subject = `Please Sign: Consumer Notice for ${address}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Consumer Notice</h2>
        <p>Hi ${signerName},</p>
        <p>Please review and sign the Consumer Notice for <strong>${address}</strong>.</p>
        <p>
          <a href="${signUrl}" style="background: #2563eb; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Sign Consumer Notice
          </a>
        </p>
        <p style="font-size: 12px; color: #6b7280;">If the button doesn’t work, copy and paste this link:</p>
        <p style="font-size: 12px; color: #6b7280;">${signUrl}</p>
      </div>
    `;

    try {
      if (!smtpHost || !smtpUser || !smtpPass) throw new Error("SMTP is not configured for Consumer Notice delivery.");
      const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass } });
      await transporter.sendMail({
        from: smtpUser,
        to: signerEmail,
        subject,
        html
      });

      if (adminEmail) {
        await transporter.sendMail({
          from: smtpUser,
          to: adminEmail,
          subject: `Consumer Notice sent for ${address}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h3>Consumer Notice Sent</h3>
              <p><strong>Seller:</strong> ${signerName} (${signerEmail})</p>
              <p><strong>Property:</strong> ${address}</p>
            </div>
          `
        });
      }
    } catch (err: any) {
      const message = String(err?.message || "Email delivery failed.").slice(0, 300);
      if (listingId) {
        const { error } = await supabaseAdmin.from("listing_events").insert({
          listing_id: listingId,
          actor_role: "admin",
          event_type: "email_failed",
          payload: { recipient: "seller", error: message, context: "consumer_notice_start" }
        });
        if (error) console.warn("Consumer Notice start email failure event insert failed:", error.message);
      }
      return NextResponse.json({ success: false, signUrl, emailSent: false, error: message }, { status: 503 });
    }

    return NextResponse.json({ success: true, signUrl, emailSent: true });
  } catch (error: any) {
    console.error("Consumer Notice Start Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to send consumer notice." },
      { status: 500 }
    );
  }
}
