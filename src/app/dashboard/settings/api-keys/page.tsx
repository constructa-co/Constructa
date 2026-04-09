import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ApiKeysClient from "./api-keys-client";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, tier, rate_limit_per_hour, requests_total, last_used_at, created_at, is_active, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <ApiKeysClient keys={keys ?? []} />;
}
