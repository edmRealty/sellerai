import nodemailer from "nodemailer";

export const MAINTENANCE_MESSAGE =
  "System is down for maintenance, we apologize for the inconvenience. Please try again soon.";

const alerted = new Set<string>();

export function isAiServiceDownError(error: unknown) {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : JSON.stringify(error ?? "");
  const text = raw.toLowerCase();
  return [
    "credit limit",
    "out of credits",
    "insufficient credits",
    "insufficient_quota",
    "quota exceeded",
    "billing",
    "payment required",
    "api key has been deleted",
    "api key does not exist",
    "invalid api key",
    "unauthorized",
    "401",
    "402"
  ].some((needle) => text.includes(needle));
}

export function isMaintenanceError(error: unknown) {
  return error instanceof Error && error.message === MAINTENANCE_MESSAGE;
}

export async function notifyAdminAiIssue(input: {
  provider: string;
  route: string;
  address?: string;
  error: unknown;
}) {
  const key = `${input.provider}:${input.route}`;
  if (alerted.has(key)) return;
  alerted.add(key);

  const adminTo =
    process.env.ADMIN_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.SMTP_USER ||
    "ben@housingpa.com";

  const rawError =
    typeof input.error === "string"
      ? input.error
      : input.error instanceof Error
        ? input.error.message
        : JSON.stringify(input.error ?? {});

  const subject = `SellerAI: AI key/credits issue (${input.provider})`;
  const text = [
    "SellerAI AI provider needs attention.",
    "",
    `Provider: ${input.provider}`,
    `Route: ${input.route}`,
    `Address/context: ${input.address || "(not provided)"}`,
    `Time: ${new Date().toISOString()}`,
    "",
    "Provider error:",
    rawError
  ].join("\n");

  try {
    const resendKey = process.env.RESEND_API_KEY || "";
    if (resendKey.startsWith("re_")) {
      const from = process.env.RESEND_FROM_EMAIL || process.env.ADMIN_EMAIL || "no-reply@housingpa.com";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ from, to: adminTo, subject, text })
      });
      if (!res.ok) console.warn("AI service alert Resend failed:", await res.text());
      return;
    }

    if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
      console.warn("AI service issue alert skipped; email is not configured.", input);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "465", 10),
      secure: process.env.SMTP_PORT !== "587",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"housingPA AI" <${process.env.SMTP_USER}>`,
      to: adminTo,
      subject,
      text
    });
  } catch (error) {
    console.warn("AI service issue alert failed:", error);
  }
}

export async function notifyAndThrowMaintenance(input: {
  provider: string;
  route: string;
  address?: string;
  error: unknown;
}) {
  await notifyAdminAiIssue(input);
  throw new Error(MAINTENANCE_MESSAGE);
}
