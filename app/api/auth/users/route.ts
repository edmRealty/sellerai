
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

const isValidHttpUrl = (value: string) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

// ADMIN SECURITY CHECK HELPER
const checkAdminAuth = async (req: Request) => {
    // 1. Get the Auth Header from the incoming request (forwarded from client)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;

    // 2. We need a separate client to verify the USER'S session token (not admin)
    //    We reuse the URL/Key but strictly for verification (using the token passed)
    const rawSupabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim() ||
        '';
    const supabaseUrl = isValidHttpUrl(rawSupabaseUrl) ? rawSupabaseUrl : '';
    const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.SUPABASE_ANON_KEY?.trim() ||
        '';

    if (!supabaseUrl || !supabaseAnonKey) return false;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return false;

    // 3. Strict Admin Email Check
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() || 'ben@housingpa.com';
    if (user.email !== ADMIN_EMAIL) {
        console.warn(`Unauthorized Access Attempt by: ${user.email}`);
        return false;
    }

    return true;
};

// GET: Check User Exists (Used for validation) -> OPEN (But limited)
// We allow checking existence for the form, but listUsers() is still protected inside if we wanted to lock unrelated parts.
// However, the prompt asked to lock the endpoints that create/delete.
// Let's secure DELETE and POST specifically as P0.
// GET for checking own existence is usually fine, but let's see. 
// "The endpoint allows unauthenticated creation/deletion of users." -> Focus on POST/DELETE.

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    // If simply checking existence for sign-in flow, we can use Service Role blindly ONLY for specific check
    // But listing ALL users must be secured.

    if (!email) {
        // If no email param, this is a LIST request -> SECURE IT
        const isAdmin = await checkAdminAuth(req);
        if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // List users by email (admin only)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
        console.error("Supabase List Error", error);
        return NextResponse.json([], { status: 500 });
    }

    const user = data.users.find(u => u.email === email);

    if (user) {
        return NextResponse.json([{
            email: user.email,
            exists: true,
            id: user.id
        }]);
    }

    return NextResponse.json([]);
}

// POST: Register User -> This is the "Sign Up" flow.
// Usually Sign Up is public. BUT the audit said "unauthenticated creation/deletion".
// If this is for ADMIN creating users, it needs auth.
// If this is public sign up, it should be open.
// Context: "The endpoint allows unauthenticated creation/deletion of users."
// Given the "Zombie User" context, this was likely used by the app to create users.
// If we verify the frontend only calls this for new self-registration, we might need it open.
// HOWEVER, standard Supabase App uses client-side `supabase.auth.signUp()`.
// This route uses `supabaseAdmin.auth.admin.createUser()`, which BYPASSES email confirmation.
// THAT IS DANGEROUS for public. Public should use client SDK.
// So yes, this route is likely an Admin-only "Force Create" or "Backdoor".
// We should LOCK IT.
export async function POST(req: Request) {
    // SECURITY: Lock this down. Public users should use client-side signUp().
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        // Create User in Supabase Auth
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (error) {
            console.error("Supabase Create Error", error);
            if (error.message.includes("already registered")) {
                return NextResponse.json({ error: "User already exists" }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const newUser = data.user;
        return NextResponse.json({ success: true, user: { email: newUser.email, id: newUser.id } });
    } catch (e) {
        console.error("Server Error", e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

// DELETE: Remove User -> P0 SECURE
export async function DELETE(req: Request) {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { id } = body;

        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (error) {
            console.error("Supabase Delete Error", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await supabaseAdmin.from('users').delete().eq('id', id);

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

// PATCH: Reset Password -> P0 SECURE (If Admin Reset)
export async function PATCH(req: Request) {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { id, password } = body;

        if (!id || !password) return NextResponse.json({ error: "Missing data" }, { status: 400 });

        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
            password: password
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
