import { redirect } from "next/navigation";

/**
 * Business Intelligence module — GATED FOR BETA (19 April 2026).
 *
 * Two of the backing tables this page was wired to (`project_pl_snapshots`,
 * `project_schedules`) do not exist in the current migration tree. The page
 * was selecting `projects.contract_value` which also does not exist. Per the
 * 2026-04-19 hardening brief the intelligence surface is being gated for the
 * contractor beta rather than shipped with silently-empty or wrong data.
 *
 * Direct navigation is redirected to the home dashboard so the route cannot
 * be reached out of band. The sidebar nav entry has been removed.
 *
 * When this module is rebuilt, restore the real page from
 * `intelligence-client.tsx` (still present) and repoint it at live sources.
 */
export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
    redirect("/dashboard/home");
}
