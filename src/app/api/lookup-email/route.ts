import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side admin client — never exposed to the browser.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role key is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * GET /api/lookup-email?username=xxx
 *
 * Returns the Supabase auth email for a given ERP username.
 * Used by the login page so users can sign in with their username
 * instead of typing their full email address.
 *
 * Always returns a generic 404 for missing users (no user enumeration).
 */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username")?.trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  try {
    const { data, error } = await adminClient()
      .from("app_users")
      .select("email")
      .eq("username", username)
      .maybeSingle();

    if (error || !data?.email) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ email: data.email as string });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
