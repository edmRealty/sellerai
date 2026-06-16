import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin Route to "Nuke" a user for testing purposes
// Requires SUPABASE_SERVICE_ROLE_KEY to be set in .env
export async function POST(req: NextRequest) {
    // 1. Security Check: Only allow if service key exists
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY2) {
        return NextResponse.json(
            { error: "Server Configuration Error: Missing Service Role Key" },
            { status: 500 }
        );
    }

    // 2. Init Admin Client
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
    const supabaseUrl = isValidHttpUrl(rawSupabaseUrl) ? rawSupabaseUrl : '';

    if (!supabaseUrl) {
        return NextResponse.json(
            { error: "Server Configuration Error: Invalid Supabase URL" },
            { status: 500 }
        );
    }

    const supabaseAdmin = createClient(
        supabaseUrl,
        (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY2)!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // 3. Find User ID
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) throw listError;

        const targetUser = users.find(u => u.email === email);

        if (!targetUser) {
            return NextResponse.json({ message: "User not found, nothing to delete" }, { status: 200 });
        }

        // 4. Delete User
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);

        if (deleteError) throw deleteError;

        return NextResponse.json({ message: `Successfully deleted user ${email}` });

    } catch (error: any) {
        console.error("Nuke User Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
