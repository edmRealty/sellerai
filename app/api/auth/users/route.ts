import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const ctx = await getAuthContext();
  if (!ctx.configured) return { response: NextResponse.json({ error: "not found" }, { status: 404 }) };
  if (!ctx.auth || ctx.auth.role !== "admin") return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { ctx };
}

export async function GET(req: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  return NextResponse.json(user ? [{ email: user.email, exists: true, id: user.id }] : []);
}

export async function POST(req: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("already registered") ? 409 : 500 });
  return NextResponse.json({ success: true, user: { email: data.user.email, id: data.user.id } });
}

export async function DELETE(req: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const id = String((await req.json().catch(() => ({})))?.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
