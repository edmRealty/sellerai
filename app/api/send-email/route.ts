import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = "nodejs";

export async function POST(req: Request) {
    // No auth gate for activation emails. Keep endpoint lightweight.

    try {
        const body = await req.json();
        let to = String(body?.to || "").trim();
        const requesterEmail = String(body?.requesterEmail || body?.to || "").trim();
        const { name, address, propertyData, type, subject } = body;

        console.log("📨 Attempting to send email to:", to, "Type:", type);

        // Helper for simple HTML escaping
        const escapeHtml = (unsafe: string) => {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        const safeName = escapeHtml(name || 'Customer');
        const safeAddress = escapeHtml(address || 'Property Details');
        const adminFallback =
            process.env.ADMIN_EMAIL ||
            process.env.RESEND_FROM_EMAIL ||
            process.env.SMTP_USER ||
            '';

        if (!to && typeof type === 'string' && type.startsWith('admin_') && adminFallback) {
            to = adminFallback;
        }

        let emailSubject = subject || `Action Required: Activate your Listing for ${safeAddress}`;
        let emailHtml = '';
        const activationCode = Math.floor(100000 + Math.random() * 900000).toString();


        // Determine Base URL dynamically to support AWS/Production/Localhost without
        // SECURITY FIX: Prevent Host Header Injection
        // Use strict environment variable base URL instead of trusting client headers
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'http://localhost:3000'; // Fallback to localhost
        const activationUrl = `${baseUrl}/?activated=true&email=${encodeURIComponent(to)}&next=8`;

        if (!baseUrl) {
            console.warn("⚠️ Missing NEXT_PUBLIC_BASE_URL, using default.");
        }

        console.log("🔗 Computed Base URL:", baseUrl);

        if (type === 'admin_address_started') {
            const pageUrl = escapeHtml(String(body?.pageUrl || "Not provided"));
            emailSubject = subject || `New SellerAI address entered: ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>🏠 New SellerAI Address</h2>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p><strong>SellerAI page:</strong> ${pageUrl}</p>
                    <p>A user entered this address and clicked Go. Seller info may be collected in later steps.</p>
                </div>
            `;
        } else if (type === 'admin_notification') {
            emailSubject = subject || `New User Signup: ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>🚀 New User Started</h2>
                    <p><strong>Email:</strong> ${requesterEmail || "Unknown"}</p>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p>The user has entered Step 1 (Auth).</p>
                </div>
            `;
        } else if (type === 'admin_prep_package') {
            emailSubject = subject || `Action Required: Prepare Listing for ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>📄 Prepare Listing Documents</h2>
                    <p><strong>User:</strong> ${safeName} (${requesterEmail || "Unknown"})</p>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p><strong>Price:</strong> $${propertyData?.price?.toLocaleString() || 'N/A'}</p>
                    <p>The user has completed the flow. Please review and prepare the official listing agreement.</p>
                </div>
            `;
        } else if (type === 'admin_consumer_notice') {
            const phone = escapeHtml(String(body?.phone || "Not provided"));
            const officialOwner =
                typeof body?.officialOwner === "boolean"
                    ? body.officialOwner
                        ? "Yes"
                        : "No"
                    : "Not confirmed";
            const ownerRole = escapeHtml(String(body?.ownerRole || "Not provided"));
            const pageUrl = escapeHtml(String(body?.pageUrl || "Not provided"));
            const finalPrice = Number(body?.finalPrice);
            const priceText = Number.isFinite(finalPrice) && finalPrice > 0
                ? `$${finalPrice.toLocaleString()}`
                : "Not set";
            emailSubject = subject || `Send a CN: ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>📝 Consumer Notice Requested</h2>
                    <p><strong>User:</strong> ${safeName} (${requesterEmail || "seller email"})</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p><strong>Official owner:</strong> ${officialOwner}</p>
                    <p><strong>Owner role:</strong> ${ownerRole}</p>
                    <p><strong>Working estimate:</strong> ${priceText}</p>
                    <p><strong>SellerAI page:</strong> ${pageUrl}</p>
                    <p>Please prepare and send the Pennsylvania Consumer Notice eSign package. This is not a contract; it is a mandatory disclosure step.</p>
                    <p>After the Consumer Notice is completed, approve the file in SellerAI so the seller can continue.</p>
                </div>
            `;
        } else if (type === 'admin_listing_agreement') {
            const phone = escapeHtml(String(body?.phone || "Not provided"));
            const finalPrice = Number(body?.finalPrice);
            const priceText = Number.isFinite(finalPrice) && finalPrice > 0
                ? `$${finalPrice.toLocaleString()}`
                : "Not set";
            const mailingAddress = escapeHtml(String(body?.mailingAddress || "Not provided"));
            const brokerFee = escapeHtml(String(body?.brokerFee || "1%"));
            emailSubject = subject || `Prepare Listing Agreement: ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>📄 Listing Agreement Prep</h2>
                    <p><strong>User:</strong> ${safeName} (${requesterEmail || "seller email"})</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p><strong>Working list price:</strong> ${priceText}</p>
                    <p><strong>Mailing address:</strong> ${mailingAddress}</p>
                    <p><strong>Broker fee:</strong> ${brokerFee}</p>
                    <p>The seller requested the exclusive 6-month Listing Agreement. Please prepare manually for now, send for eSign, then release the file in SellerAI once complete.</p>
                </div>
            `;
        } else if (type === 'admin_document_upload') {
            const documents = Array.isArray(body?.documents) ? body.documents : [];
            const propertyType = String(body?.propertyType || "property");
            const isMultiFamily = Boolean(body?.isMultiFamily);
            emailSubject = subject || `Docs uploaded for ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>📎 Supporting Docs Uploaded</h2>
                    <p><strong>User:</strong> ${safeName} (${requesterEmail || "seller email"})</p>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p><strong>Type:</strong> ${isMultiFamily ? "Multi-family" : propertyType}</p>
                    <p><strong>Files:</strong> ${documents.length ? documents.join(", ") : "N/A"}</p>
                    <p>Please review and attach to the listing workflow.</p>
                </div>
            `;
        } else if (type === 'admin_lead_paint') {
            emailSubject = subject || `Lead paint disclosure required for ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>⚠️ Lead Paint Disclosure</h2>
                    <p><strong>User:</strong> ${safeName} (${requesterEmail || "seller email"})</p>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p>Home built before 1978. Include the lead-based paint brochure and disclosure with the agreement.</p>
                </div>
            `;
        } else if (type === 'admin_problem_report') {
            const message = escapeHtml(String(body?.message || "No message provided."));
            const step = escapeHtml(String(body?.step || "unknown"));
            const appVersion = escapeHtml(String(body?.appVersion || "unknown"));
            const userAgent = escapeHtml(String(body?.userAgent || "unknown"));
            const pageUrl = escapeHtml(String(body?.pageUrl || "unknown"));
            emailSubject = subject || `Problem report: ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>🐞 SellerAI Problem Report</h2>
                    <p><strong>User:</strong> ${safeName} (${requesterEmail || "unknown"})</p>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p><strong>Step:</strong> ${step}</p>
                    <p><strong>App version:</strong> ${appVersion}</p>
                    <p><strong>Page:</strong> ${pageUrl}</p>
                    <p><strong>User agent:</strong> ${userAgent}</p>
                    <hr />
                    <p><strong>Message:</strong></p>
                    <p style="white-space: pre-wrap;">${message}</p>
                </div>
            `;
        } else if (type === 'consumer_notice') {
            emailSubject = subject || `Consumer Notice for ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Consumer Notice</h2>
                    <p>Hi ${safeName},</p>
                    <p>Please review and endorse the Consumer Notice for ${safeAddress}. We’ll verify it before moving to the listing agreement.</p>
                    <p>If you have questions, reply to this email and we’ll help.</p>
                </div>
            `;
        } else if (type === 'submission') {
            emailSubject = subject || `📦 New Package Submitted: ${safeAddress}`;
            emailHtml = `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd;">
                    <h2 style="color: #10a37f;">Listing Package Ready</h2>
                    <p><strong>User:</strong> ${safeName} (${to})</p>
                    <p><strong>Property:</strong> ${safeAddress}</p>
                    <p><strong>Price:</strong> $${propertyData?.price?.toLocaleString() || 'N/A'}</p>
                    <br/>
                    <a href="${baseUrl}/dashboard" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a>
                </div>
            `;
        } else if (type === 'activation_code') {
            emailSubject = subject || `Your SellerAI activation code`;
            emailHtml = `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background: #2563eb; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 22px;">SellerAI</h1>
                    </div>
                    <div style="padding: 28px; background: white;">
                        <h2 style="color: #334155; margin-top: 0;">Confirm your email</h2>
                        <p style="color: #64748b; font-size: 15px; line-height: 1.5;">Hi ${safeName},</p>
                        <p style="color: #64748b; font-size: 15px; line-height: 1.5;">Use this activation code to confirm your email and continue your listing for <strong>${safeAddress}</strong>.</p>
                        <div style="text-align: center; margin: 24px 0;">
                            <div style="display: inline-block; font-size: 24px; letter-spacing: 4px; padding: 12px 18px; border: 1px dashed #2563eb; border-radius: 10px; color: #1d4ed8; font-weight: 700;">
                                ${activationCode}
                            </div>
                        </div>
                        <p style="color: #94a3b8; font-size: 12px; text-align: center;">If you didn’t request this, ignore this email.</p>
                    </div>
                </div>
            `;
        } else {
            // Default: Activation Email
            emailHtml = `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background: #10a37f; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">housingPA AI</h1>
                    </div>
                    <div style="padding: 30px; background: white;">
                        <h2 style="color: #334155; margin-top: 0;">Activate Your Listing</h2>
                        <p style="color: #64748b; font-size: 16px; line-height: 1.5;">Hi ${safeName},</p>
                        <p style="color: #64748b; font-size: 16px; line-height: 1.5;">You are one step away from listing your property at <strong>${safeAddress}</strong>.</p>
                        <p style="color: #64748b; font-size: 16px; line-height: 1.5;">Please click the button below to verify your email and activate your dashboard.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${activationUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate Now</a>
                        </div>

                        <p style="color: #94a3b8; font-size: 12px; text-align: center;">If you didn't request this, please ignore this email.</p>
                    </div>
                </div>
            `;
        }
        const resendKey = process.env.RESEND_API_KEY || '';
        const hasResend = resendKey.startsWith('re_');
        const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

        if (!hasResend && !hasSmtp) {
            console.warn("⚠️ No email provider configured. Returning activation link for manual testing.");
            return NextResponse.json({
                success: true,
                mocked: true,
                activationUrl,
                activationCode,
                message: 'Email provider not configured'
            });
        }

        if (hasResend) {
            const fromAddress = process.env.RESEND_FROM_EMAIL || process.env.ADMIN_EMAIL || 'no-reply@housingpa.com';
            const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: fromAddress,
                    to,
                    subject: emailSubject,
                    html: emailHtml
                })
            });

            if (!resendRes.ok) {
                const errorText = await resendRes.text();
                throw new Error(`Resend failed: ${errorText}`);
            }

            return NextResponse.json({ success: true, provider: 'resend', activationUrl, activationCode });
        }

        // SMTP (fallback)
        const isSecure = process.env.SMTP_PORT === '465';
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: isSecure, // true for 465, false for 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Zoho and others require the 'from' address to match the authenticated user
        const fromAddress = `"housingPA AI" <${process.env.SMTP_USER}>`;

        const info = await transporter.sendMail({
            from: fromAddress,
            to: to,
            subject: emailSubject,
            html: emailHtml,
        });

        console.log("✅ Email sent: %s", info.messageId);
        return NextResponse.json({ success: true, messageId: info.messageId, provider: 'smtp', activationUrl, activationCode });

    } catch (error: any) {
        console.error("❌ Email sending failed:", error);
        // Return actual error for debugging
        return NextResponse.json({ success: false, error: error.message || 'Unknown error' }, { status: 500 });
    }
}
