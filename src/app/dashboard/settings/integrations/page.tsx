import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import IntegrationsClient from "./integrations-client";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: xeroConn },
    { data: syncLog },
  ] = await Promise.all([
    supabase
      .from("xero_connections")
      .select("tenant_name, connected_at, last_sync_at, is_active, token_expires_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("xero_sync_log")
      .select("id, sync_type, status, items_synced, items_failed, error_message, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <IntegrationsClient
      xeroConnection={xeroConn ?? null}
      syncLog={syncLog ?? []}
    />
  );
}
