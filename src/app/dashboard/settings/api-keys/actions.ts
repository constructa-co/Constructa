"use server";

import { createClient } from "@/lib/supabase/server";
import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

function generateApiKey(): string {
  return "ck_live_" + randomBytes(24).toString("hex");
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKeyAction(
  name: string
): Promise<{ key?: string; prefix?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Limit to 5 active keys per user
  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if ((count ?? 0) >= 5) {
    return { error: "Maximum 5 active API keys. Revoke an existing key first." };
  }

  const rawKey  = generateApiKey();
  const keyHash = hashKey(rawKey);
  const prefix  = rawKey.slice(0, 16) + "...";

  const { error } = await supabase.from("api_keys").insert({
    user_id:   user.id,
    key_hash:  keyHash,
    key_prefix: prefix,
    name:      name.trim() || "Default",
    tier:      "free",
    rate_limit_per_hour: 100,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings/api-keys");
  // Return the raw key ONCE — it won't be retrievable again
  return { key: rawKey, prefix };
}

export async function revokeApiKeyAction(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings/api-keys");
  return {};
}
