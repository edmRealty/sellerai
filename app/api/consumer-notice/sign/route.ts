import { NextResponse } from "next/server";
import { sendNoticeToAgent, NOTICE_AGENT_SENT, NOTICE_AGENT_FAILED } from "@/lib/consumer-notice-delivery";
import path from "path";
import fs from "fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { verifyConsumerNoticeToken } from "@/lib/esign";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getClientId, guardRateLimit, RateLimitError, rateLimitResponse } from "@/lib/api-safety";

export const runtime = "nodejs";


const parseSignature = (dataUrl: string) => {
  if (!dataUrl?.startsWith("data:image")) return null;
  const match = dataUrl.match(/^data:image\/\w+;base64,(.*)$/);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
};

async function persistConsumerNoticeSignature(params: {
  listingId?: string;
  name: string;
  email: string;
  fileName: string;
  pdfBytes: Uint8Array;
}) {
  if (!params.listingId) return;

  try {
    const { data: listing, error: listingError } = await supabaseAdmin
      .from("listings")
      .select("id, data")
      .eq("id", params.listingId)
      .maybeSingle();
    if (listingError || !listing) {
      if (listingError) console.warn("Consumer Notice listing lookup failed:", listingError.message);
      return;
    }

    const { data: latestDocument, error: documentLookupError } = await supabaseAdmin
      .from("listing_documents")
      .select("version")
      .eq("listing_id", params.listingId)
      .eq("kind", "consumer_notice")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (documentLookupError) {
      console.warn("Consumer Notice document lookup failed:", documentLookupError.message);
    }
    const version = Number(latestDocument?.version || 0) + 1;
    let storagePath: string | null = null;
    const destination = `listings/${params.listingId}/consumer-notice-v${version}.pdf`;
    const { data: upload, error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(destination, params.pdfBytes, {
        contentType: "application/pdf",
        upsert: false
      });
    if (uploadError) {
      console.warn("Consumer Notice storage upload failed:", uploadError.message);
    } else {
      storagePath = upload?.path ?? null;
    }

    let signedBy: string | null = null;
    try {
      const users = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      signedBy = users.data.users.find((user) => user.email?.toLowerCase() === params.email.toLowerCase())?.id ?? null;
    } catch (error: any) {
      console.warn("Consumer Notice signer lookup failed:", error?.message || "unknown error");
    }

    const signedAt = new Date().toISOString();
    const { error: documentError } = await supabaseAdmin.from("listing_documents").insert({
      listing_id: params.listingId,
      kind: "consumer_notice",
      version,
      status: "signed",
      file_name: params.fileName,
      storage_path: storagePath,
      signed_by: signedBy,
      signed_at: signedAt
    });
    if (documentError) {
      console.warn("Consumer Notice document insert failed:", documentError.message);
      return;
    }

    const listingData = (listing.data ?? {}) as Record<string, any>;
    const paperwork = { ...(listingData.paperwork ?? {}), consumerNoticeStatus: "signed", consumerNoticeAgentStatus: "awaiting_manual_signature" };
    const { error: listingUpdateError } = await supabaseAdmin
      .from("listings")
      .update({
        consumer_notice_status: "signed",
        data: { ...listingData, paperwork }
      })
      .eq("id", params.listingId);
    if (listingUpdateError) {
      console.warn("Consumer Notice listing status update failed:", listingUpdateError.message);
    }

    const { error: eventError } = await supabaseAdmin.from("listing_events").insert({
      listing_id: params.listingId,
      actor_id: signedBy,
      actor_role: "seller",
      event_type: "cn_signed",
      payload: {
        via: "hmac_esign",
        fileName: params.fileName,
        signerEmail: params.email,
        signerName: params.name,
        signedAt,
        documentVersion: version
      }
    });
    if (eventError) console.warn("Consumer Notice signature event insert failed:", eventError.message);
  } catch (error: any) {
    console.warn("Consumer Notice signature persistence failed:", error?.message || "unknown error");
  }
}

export async function POST(req: Request) {
  try {
    guardRateLimit({ bucket: "consumer-notice-sign", id: getClientId(req), maxCalls: 5, windowMs: 60_000, blockMs: 60_000 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      const { headers } = rateLimitResponse(error);
      return NextResponse.json({ success: false, error: "Please wait a minute before trying again." }, { status: 429, headers });
    }
    throw error;
  }
  try {
    const body = await req.json();
    const token = String(body?.token || "");
    const signerName = String(body?.signerName || "").trim();
    const signatureDataUrl = String(body?.signatureDataUrl || "");

    const payload = verifyConsumerNoticeToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid or expired token." }, { status: 400 });
    }

    const name = signerName || payload.name || "Seller";
    const address = payload.address;
    const email = payload.email;
    const listingId = payload.listingId;
    const signedDate = new Date().toLocaleDateString("en-US");

    const pdfPath = path.join(process.cwd(), "public", "docs", "consumer-notice.pdf");
    const pdfBytes = await fs.readFile(pdfPath);
    // The approved PA template declares encryption restrictions even though it
    // is readable. We only annotate a server-controlled local copy.
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const page = pages[pages.length - 1];
    const form = pdfDoc.getForm();

    let filledForm = false;
    try {
      const fields = form.getFields();
      const fieldName = (field: any) => String(field.getName?.() || "").toLowerCase();
      const findField = (patterns: string[]) =>
        fields.find((field: any) => patterns.some((pattern) => fieldName(field).includes(pattern)));

      const nameField = findField(["name", "seller"]);
      const addressField = findField(["address", "property"]);
      const dateField = findField(["date", "today"]);
      const signatureField = findField(["signature", "sign"]);

      if (nameField) {
        (nameField as any).setText?.(name);
        filledForm = true;
      }
      if (addressField) {
        (addressField as any).setText?.(address);
        filledForm = true;
      }
      if (dateField) {
        (dateField as any).setText?.(signedDate);
        filledForm = true;
      }
      if (signatureField) {
        (signatureField as any).setText?.(name);
        filledForm = true;
      }
    } catch {
      filledForm = false;
    }

    if (filledForm) {
      try {
        form.flatten();
      } catch {
        // ignore
      }
    } else {
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      // The checked-in two-page notice has printed acknowledgment lines, not fields.
      const printableName = name.replace(/[^\x20-\x7e]/g, "?");
      const nameSize = Math.min(10, 156 / Math.max(1, font.widthOfTextAtSize(printableName, 1)));
      page.drawText(printableName, {
        x: 236,
        y: 215,
        size: nameSize,
        font,
        color: rgb(0, 0, 0)
      });
      page.drawText(signedDate, {
        x: 72,
        y: 215,
        size: 10,
        font,
        color: rgb(0, 0, 0)
      });
    }

    const signatureBytes = parseSignature(signatureDataUrl);
    if (signatureBytes) {
      try {
        const signatureImage = await pdfDoc.embedPng(signatureBytes);
        const { width, height } = signatureImage.scaleToFit(156, 24);
        page.drawImage(signatureImage, {
          x: 415,
          y: 214,
          width,
          height
        });
      } catch {
        return NextResponse.json({ success: false, error: "The signature image could not be read. Please sign again." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ success: false, error: "Please provide your signature." }, { status: 400 });
    }

    const signedPdf = await pdfDoc.save();
    const signedFileName = "Consumer-Notice-Signed.pdf";

    // A signed disclosure is the source of truth. Save it before attempting
    // notifications so a mail-provider outage cannot undo the signature.
    await persistConsumerNoticeSignature({
      listingId,
      name,
      email,
      fileName: signedFileName,
      pdfBytes: signedPdf
    });

    let emailDelivered = true;
    let emailError = "";
    try {
      const delivery = await sendNoticeToAgent({ name, email, address, pdfBytes: signedPdf });
      if (listingId) {
        const { error } = await supabaseAdmin.from("listing_events").insert({
          listing_id: listingId, actor_role: "admin", event_type: "cn_agent_email_sent",
          payload: { messageId: delivery.messageId, recipient: delivery.recipient, agentSignatureStatus: "awaiting_manual_signature", sellerCopySent: false }
        });
        if (error) console.warn("Consumer Notice email receipt persistence failed");
      }
    } catch (error: any) {
      emailDelivered = false;
      emailError = String(error?.message || "Email delivery failed.").slice(0, 300);
      console.warn("Signed Consumer Notice email delivery failed:", emailError);
      if (listingId) {
        const { error: eventError } = await supabaseAdmin.from("listing_events").insert({
          listing_id: listingId,
          actor_role: "admin",
          event_type: "email_failed",
          payload: { recipient: "agent", error: emailError, context: "consumer_notice_signed" }
        });
        if (eventError) console.warn("Consumer Notice email failure event insert failed:", eventError.message);
      }
    }

    return NextResponse.json({
      success: true, signed: true, emailDelivered, agentEmailSent: emailDelivered, sellerCopySent: false,
      agentSignatureStatus: "awaiting_manual_signature",
      message: emailDelivered ? NOTICE_AGENT_SENT : NOTICE_AGENT_FAILED,
      signedPdfBase64: Buffer.from(signedPdf).toString("base64")
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("Consumer Notice Sign Error:", error);
    return NextResponse.json(
      { success: false, error: "Could not complete signing. Please try again." },
      { status: 500 }
    );
  }
}
