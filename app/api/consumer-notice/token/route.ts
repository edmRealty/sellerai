import { NextResponse } from "next/server";
import { verifyConsumerNoticeToken } from "@/lib/esign";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") || "");
  const payload = verifyConsumerNoticeToken(token);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Invalid or expired token." }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    data: {
      name: payload.name,
      email: payload.email,
      address: payload.address,
      issuedAt: payload.issuedAt,
      exp: payload.exp
    }
  });
}
