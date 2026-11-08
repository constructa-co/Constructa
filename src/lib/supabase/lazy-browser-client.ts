import { createClient } from "./client"

/** Returns null when public Supabase env is unset (e.g. import-fixture CI build). */
export const tryCreateBrowserClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    if (process.env.VITEST === "true") return createClient()
    return null
  }
  return createClient()
}
