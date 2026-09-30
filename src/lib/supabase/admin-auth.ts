import { createClient } from "./server";

const ADMIN_ERROR = "Unauthorized admin access.";

/**
 * Authorizes privileged server operations independently of route/layout guards.
 * Fails closed when the configured identity or authenticated user is absent.
 */
export async function requireAdmin() {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredEmail) {
    throw new Error(ADMIN_ERROR);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const userEmail = user?.email?.trim().toLowerCase();

  if (error || !user || !userEmail || userEmail !== configuredEmail) {
    throw new Error(ADMIN_ERROR);
  }

  return {
    user: { id: user.id, email: user.email ?? configuredEmail },
    supabase,
  };
}
