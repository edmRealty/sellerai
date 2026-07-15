import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx.configured) return { response: NextResponse.json({ error: "not found" }, { status: 404 }) };
  if (!ctx.auth || ctx.auth.role !== "admin") return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const expected = process.env.ADMIN_ACTION_TOKEN || "";
  const header = req.headers.get("authorization") || "";
  const supplied = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : req.headers.get("x-admin-token") || "";
  if (!expected || supplied !== expected) return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { ctx };
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ("response" in access) return access.response;
  const email = String((await req.json().catch(() => ({})))?.email || "").trim().toLowerCase();
  if (!email.includes("@")) return NextResponse.json({ error: "valid email required" }, { status: 400 });
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true, userId: user.id, email: user.email });
}
