// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getAdminClient = () => {
    const isValidHttpUrl = (value: string) => {
        try {
            const parsed = new URL(value);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const rawSupabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        '';
    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY2 ||
        '';

    const supabaseUrl = isValidHttpUrl(rawSupabaseUrl) ? rawSupabaseUrl : '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing or invalid Supabase admin credentials.");
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

const requireAdminToken = (req: Request) => {
    const expected = process.env.ADMIN_ACTION_TOKEN || '';
    const header = req.headers.get('authorization') || '';
    const token = header.toLowerCase().startsWith('bearer ')
        ? header.slice(7).trim()
        : req.headers.get('x-admin-token') || '';

    if (!expected) {
        throw new Error("Missing ADMIN_ACTION_TOKEN.");
    }

    if (!token || token !== expected) {
        return false;
    }

    return true;
};

const findUserByEmail = async (adminClient: any, email: string) => {
    const target = email.trim().toLowerCase();
    const perPage = 1000;
    let page = 1;

    while (page <= 20) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const match = data.users.find((user) => (user.email || '').toLowerCase() === target);
        if (match) return match;

        if (data.users.length < perPage) break;
        page += 1;
    }

    return null;
};

export async function POST(req: Request) {
    try {
        const authorized = requireAdminToken(req);
        if (!authorized) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const email = (body?.email || '').trim();

        if (!email || !email.includes('@')) {
            return NextResponse.json({ success: false, error: "Valid email required" }, { status: 400 });
        }

        const adminClient = getAdminClient();
        const user = await findUserByEmail(adminClient, email);

        if (!user) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
        if (deleteError) throw deleteError;

        // Best-effort cleanup for a profiles table (ignore if it doesn't exist)
        try {
            await adminClient.from('profiles').delete().eq('id', user.id);
        } catch (err) {
            // Ignore
        }

        return NextResponse.json({
            success: true,
            userId: user.id,
            email: user.email
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || "Unknown error" },
            { status: 500 }
        );
    }
}
