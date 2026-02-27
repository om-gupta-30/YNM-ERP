import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const urlValid = /^https?:\/\/.+/.test(supabaseUrl);

  const healthy = urlValid && hasAnonKey;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      service: "ynm-erp",
      checks: {
        supabase_url: urlValid ? "ok" : "missing_or_invalid",
        anon_key: hasAnonKey ? "ok" : "missing",
        service_role_key: hasServiceKey ? "ok" : "missing",
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
