/**
 * Supabase Admin Client — service role only.
 * ⚠️  NEVER import this in client components or expose to the browser.
 * ⚠️  Requires SUPABASE_SERVICE_ROLE_KEY in .env.local and Vercel environment variables.
 *
 * Usage: const supabase = createAdminClient();
 * This bypasses Row Level Security — use only in server-only admin routes.
 */
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error(
            "Missing SUPABASE_SERVICE_ROLE_KEY — add to .env.local and Vercel environment variables"
        );
    }

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
