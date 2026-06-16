import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const address = body?.address || "";

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
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY2;
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || (!serviceKey && !anonKey)) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const supabase = createClient(supabaseUrl, serviceKey || anonKey || "");
    const { error } = await supabase.from('seller_leads').insert({
      address,
      source: 'SellerAI'
    });

    if (error) {
      return NextResponse.json({ success: true, warning: error.message });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: true, skipped: true });
  }
}
