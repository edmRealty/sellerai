import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { verifyConsumerNoticeToken } from "@/lib/esign";

export const runtime = "nodejs";

const AGENT_LICENSE = process.env.AGENT_LICENSE || "AB069631";

const parseSignature = (dataUrl: string) => {
  if (!dataUrl?.startsWith("data:image")) return null;
  const match = dataUrl.match(/^data:image\/\w+;base64,(.*)$/);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
};

export async function POST(req: Request) {
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
    const signedDate = new Date().toLocaleDateString("en-US");

    const pdfPath = path.join(process.cwd(), "public", "docs", "consumer-notice.pdf");
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
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
      const licenseField = findField(["license", "lic", "broker"]);
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
      if (licenseField) {
        (licenseField as any).setText?.(AGENT_LICENSE);
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
      const { height } = page.getSize();
      const baseY = Math.max(72, height * 0.12);
      page.drawText(`Seller: ${name}`, {
        x: 72,
        y: baseY + 40,
        size: 11,
        font,
        color: rgb(0, 0, 0)
      });
      page.drawText(`Property: ${address}`, {
        x: 72,
        y: baseY + 24,
        size: 11,
        font,
        color: rgb(0, 0, 0)
      });
      page.drawText(`Date: ${signedDate}`, {
        x: 72,
        y: baseY + 8,
        size: 11,
        font,
        color: rgb(0, 0, 0)
      });
      page.drawText(`License: ${AGENT_LICENSE}`, {
        x: 300,
        y: baseY + 8,
        size: 11,
        font,
        color: rgb(0, 0, 0)
      });
    }

    const signatureBytes = parseSignature(signatureDataUrl);
    if (signatureBytes) {
      try {
        const signatureImage = await pdfDoc.embedPng(signatureBytes);
        const { width, height } = signatureImage.scale(0.3);
        page.drawImage(signatureImage, {
          x: 72,
          y: 140,
          width,
          height
        });
      } catch {
        // ignore signature if decode fails
      }
    }

    const signedPdf = await pdfDoc.save();

    const smtpHost = process.env.SMTP_HOST || "";
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpSecure = smtpPort === 465;
    const resendKey = process.env.RESEND_API_KEY || "";
    const resendFrom = process.env.RESEND_FROM_EMAIL || "";

    if (!smtpHost || !smtpUser || !smtpPass) {
      if (!resendKey || !resendFrom) {
        return NextResponse.json(
          { success: false, error: "SMTP not configured for signed notice delivery." },
          { status: 500 }
        );
      }
    }

    const adminEmail =
      process.env.ADMIN_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.SMTP_USER ||
      "";

    const recipients = [email, adminEmail].filter(Boolean).join(",");

    const emailSubject = `Signed Consumer Notice: ${address}`;
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h3>Consumer Notice Signed</h3>
          <p><strong>Seller:</strong> ${name}</p>
          <p><strong>Property:</strong> ${address}</p>
          <p><strong>Date:</strong> ${signedDate}</p>
          <p>The signed Consumer Notice is attached.</p>
        </div>
      `;

    if (resendKey && resendFrom) {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: resendFrom,
          to: recipients.split(",").filter(Boolean),
          subject: emailSubject,
          html: emailHtml,
          attachments: [
            {
              filename: "Consumer-Notice-Signed.pdf",
              content: Buffer.from(signedPdf).toString("base64")
            }
          ]
        })
      });
      if (!resendResponse.ok) {
        const resendError = await resendResponse.text();
        throw new Error(`Resend failed: ${resendError}`);
      }
    } else {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
      });
      await transporter.sendMail({
        from: smtpUser,
        to: recipients,
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: "Consumer-Notice-Signed.pdf",
            content: Buffer.from(signedPdf)
          }
        ]
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Consumer Notice Sign Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to sign consumer notice." },
      { status: 500 }
    );
  }
}
