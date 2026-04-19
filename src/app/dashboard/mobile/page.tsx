import { redirect } from "next/navigation";

/**
 * On-site mobile hub — GATED FOR BETA (19 April 2026).
 *
 * The previous implementation filtered `project_expenses` and `variations`
 * by `user_id`, a column that does not exist on either table (RLS is
 * enforced through `projects.user_id`). Lists silently returned empty in
 * production, and the active-projects filter used lowercase `"active"`
 * which drifts from the canonical status helpers.
 *
 * Per the 2026-04-19 hardening brief the mobile hub is not part of the
 * first contractor beta path. Direct navigation redirects to the home
 * dashboard so the route cannot be reached out of band, and the sidebar
 * entry has been removed.
 *
 * The client component `mobile-hub-client.tsx` is retained so the surface
 * can be restored later once its data sources are rewired to join through
 * `projects.user_id` and the canonical status helpers.
 */
export const dynamic = "force-dynamic";

export default async function MobileHubPage() {
    redirect("/dashboard/home");
}
