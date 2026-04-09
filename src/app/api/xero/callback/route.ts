import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirectBase = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://constructa.co"}/dashboard/settings/integrations`;

  if (error) {
    return NextResponse.redirect(`${redirectBase}?xero_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?xero_error=missing_params`);
  }

  // Verify state (user_id stored as state to tie callback to user)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // State is the user_id — verify it matches current session
  if (!user || user.id !== state) {
    return NextResponse.redirect(`${redirectBase}?xero_error=invalid_state`);
  }

  const clientId     = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri  = process.env.XERO_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/xero/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${redirectBase}?xero_error=not_configured`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Xero token exchange failed:", err);
      return NextResponse.redirect(`${redirectBase}?xero_error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get the Xero tenant (organisation) this token gives access to
    const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!connectionsRes.ok) {
      return NextResponse.redirect(`${redirectBase}?xero_error=tenant_fetch_failed`);
    }

    const connections: Array<{ tenantId: string; tenantName: string }> = await connectionsRes.json();
    if (!connections.length) {
      return NextResponse.redirect(`${redirectBase}?xero_error=no_tenant`);
    }

    const tenant = connections[0]; // use the first org (most users have one)

    // Upsert into xero_connections
    const { error: dbError } = await supabase.from("xero_connections").upsert(
      {
        user_id:          user.id,
        tenant_id:        tenant.tenantId,
        tenant_name:      tenant.tenantName,
        access_token:     tokens.access_token,
        refresh_token:    tokens.refresh_token,
        token_expires_at: expiresAt,
        scopes:           tokens.scope ?? null,
        is_active:        true,
        connected_at:     new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      console.error("Xero DB upsert failed:", dbError.message);
      return NextResponse.redirect(`${redirectBase}?xero_error=db_error`);
    }

    return NextResponse.redirect(`${redirectBase}?xero_connected=1`);
  } catch (e) {
    console.error("Xero callback error:", e);
    return NextResponse.redirect(`${redirectBase}?xero_error=unexpected`);
  }
}
