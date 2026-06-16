import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RateLimitError, getClientId, guardRateLimit } from "@/lib/api-safety";
import {
  MAINTENANCE_MESSAGE,
  isAiServiceDownError,
  notifyAdminAiIssue
} from "@/lib/ai-service-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openaiApiKey = process.env.OPENAI_API_KEY || "";
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const manusApiKey = process.env.MANUS_API_KEY || "";
const manusBaseUrl = process.env.MANUS_API_BASE_URL || "";
const manusApiUrl =
  process.env.MANUS_API_URL ||
  (manusBaseUrl ? `${manusBaseUrl.replace(/\/$/, "")}/chat/completions` : "");
const manusModel = process.env.MANUS_MODEL || "manus-1";
const genAI = new GoogleGenerativeAI(geminiApiKey);
const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const AI_FREE_MODE = String(process.env.AI_FREE_MODE || "").toLowerCase() === "true";
const RATE_WINDOW_MS = Number(process.env.AI_RATE_WINDOW_MS) || 60_000;
const RATE_BLOCK_MS = Number(process.env.AI_RATE_BLOCK_MS) || 5 * 60_000;
const CHAT_MAX = Number(process.env.AI_CHAT_MAX_CALLS) || 12;
const OPENAI_MAX = Number(process.env.AI_OPENAI_MAX_CALLS) || 6;
const GEMINI_MAX = Number(process.env.AI_GEMINI_MAX_CALLS) || 6;
const MANUS_MAX = Number(process.env.AI_MANUS_MAX_CALLS) || 6;

const STEP_GUIDE = [
  "Confirm property details",
  "Select features and condition",
  "Run valuation and comps",
  "Choose add-ons",
  "Acknowledgements + seller info",
  "Set final list price",
  "Activate listing",
  "Ownership check",
  "Consumer Notice",
  "Listing agreement prep",
  "Dual agency acknowledgement",
  "Lead paint disclosure",
  "Listing agreement signature",
  "Marketing kickoff",
  "Upload photos",
  "Write description",
  "Dashboard tasks"
];

function buildSystemPrompt(context: any) {
  const address = context?.address || "(no address yet)";
  const details = context?.details || {};
  const step = context?.step || "details";
  const summary = `Address: ${address}\nCurrent step: ${step}\nDetails: ${JSON.stringify(details)}`;

  return `You are SellerAI, a helpful real-estate listing assistant. Stay focused on seller workflow, pricing, prep, and listing process. Answer questions concisely in short sentences. Avoid markdown, bullets, or numbered lists. No bold text. Do not ask follow-up questions or request additional information. Remind the user they can continue using the step card when appropriate, especially for forms or selections. Do not claim to browse the web. If asked for legal or financial advice, provide a brief disclaimer and suggest consulting a professional.\n\nWorkflow steps: ${STEP_GUIDE.join(" → ")}\n\nContext:\n${summary}`;
}

function cleanReply(raw: string) {
  let text = raw || "";
  text = text.replace(/\*\*/g, "");
  text = text.replace(/^\s*\d+[.)]\s+/gm, "");
  text = text.replace(/^\s*[-*]\s+/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function sanitizeHistory(history: any) {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "")
    }))
    .filter((item) => item.content.trim().length > 0)
    .slice(-8);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body?.message || "").trim();
    const history = sanitizeHistory(body?.history);
    const context = body?.context || {};
    const clientId = getClientId(request);

    try {
      guardRateLimit({
        bucket: "chat",
        id: clientId,
        maxCalls: CHAT_MAX,
        windowMs: RATE_WINDOW_MS,
        blockMs: RATE_BLOCK_MS
      });
    } catch (error) {
      const retryAfterMs = error instanceof RateLimitError ? error.retryAfterMs : RATE_BLOCK_MS;
      return NextResponse.json(
        { reply: "Chat is temporarily rate-limited. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const systemPrompt = buildSystemPrompt(context);
    const chatMessages = history.length
      ? history
      : message
      ? [{ role: "user", content: message }]
      : [];

    if (!chatMessages.length) {
      return NextResponse.json({ reply: "What would you like help with?" });
    }

    if (openaiApiKey && !AI_FREE_MODE) {
      try {
        guardRateLimit({
          bucket: "openai",
          id: clientId,
          maxCalls: OPENAI_MAX,
          windowMs: RATE_WINDOW_MS,
          blockMs: RATE_BLOCK_MS
        });
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.4,
            max_tokens: 220,
            messages: [
              { role: "system", content: systemPrompt },
              ...chatMessages
            ]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const reply = cleanReply(data?.choices?.[0]?.message?.content?.trim() || "");
          if (reply) {
            return NextResponse.json({ reply });
          }
        }
      } catch (err) {
        console.error("OpenAI chat error", err);
        if (isAiServiceDownError(err)) {
          await notifyAdminAiIssue({
            provider: "OpenAI",
            route: "POST /api/chat",
            address: context?.address,
            error: err
          });
          return NextResponse.json({ reply: MAINTENANCE_MESSAGE, error: MAINTENANCE_MESSAGE }, { status: 503 });
        }
      }
    }

    if (geminiApiKey && !AI_FREE_MODE) {
      try {
        guardRateLimit({
          bucket: "gemini",
          id: clientId,
          maxCalls: GEMINI_MAX,
          windowMs: RATE_WINDOW_MS,
          blockMs: RATE_BLOCK_MS
        });
        const model = genAI.getGenerativeModel({ model: geminiModel });
        const historyText = chatMessages
          .map((item) => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`)
          .join("\n");
        const prompt = `${systemPrompt}\n\nConversation:\n${historyText}\n\nAssistant:`;
        const result = await model.generateContent(prompt);
        const reply = cleanReply(result.response.text().trim());
        if (reply) {
          return NextResponse.json({ reply });
        }
      } catch (err) {
        console.error("Gemini chat error", err);
        if (isAiServiceDownError(err)) {
          await notifyAdminAiIssue({
            provider: "Gemini",
            route: "POST /api/chat",
            address: context?.address,
            error: err
          });
          return NextResponse.json({ reply: MAINTENANCE_MESSAGE, error: MAINTENANCE_MESSAGE }, { status: 503 });
        }
      }
    }

    if (manusApiKey && manusApiUrl && !AI_FREE_MODE) {
      try {
        guardRateLimit({
          bucket: "manus",
          id: clientId,
          maxCalls: MANUS_MAX,
          windowMs: RATE_WINDOW_MS,
          blockMs: RATE_BLOCK_MS
        });
        const response = await fetch(manusApiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${manusApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: manusModel,
            temperature: 0.4,
            max_tokens: 220,
            messages: [
              { role: "system", content: systemPrompt },
              ...chatMessages
            ]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || `Manus chat error (${response.status})`);
        }

        const data = await response.json();
        const raw =
          data?.choices?.[0]?.message?.content ||
          data?.output ||
          data?.content ||
          "";
        const reply = cleanReply(String(raw).trim());
        if (reply) {
          return NextResponse.json({ reply });
        }
      } catch (err) {
        console.error("Manus chat error", err);
        if (isAiServiceDownError(err)) {
          await notifyAdminAiIssue({
            provider: "Manus",
            route: "POST /api/chat",
            address: context?.address,
            error: err
          });
          return NextResponse.json({ reply: MAINTENANCE_MESSAGE, error: MAINTENANCE_MESSAGE }, { status: 503 });
        }
      }
    }

    return NextResponse.json({
      reply: "Thanks! I captured that. If you want to move forward, use the step card below to continue."
    });
  } catch (err) {
    console.error("Chat route error", err);
    return NextResponse.json({ reply: "I’m here to help—try your question again." });
  }
}
