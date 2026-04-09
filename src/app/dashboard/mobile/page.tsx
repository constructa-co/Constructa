import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MobileHubClient from "./mobile-hub-client";

export const dynamic = "force-dynamic";

export default async function MobileHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Active projects for quick-select
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(10);

  // Recent cost logs
  const { data: recentCosts } = await supabase
    .from("project_expenses")
    .select("id, description, amount, created_at, projects(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Recent variations
  const { data: recentVars } = await supabase
    .from("variations")
    .select("id, title, value, status, created_at, projects(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Supabase returns joins as arrays — flatten to the shape the client expects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatCosts = (recentCosts ?? []).map((r: any) => ({
    ...r,
    projects: Array.isArray(r.projects) ? (r.projects[0] ?? null) : r.projects,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatVars = (recentVars ?? []).map((r: any) => ({
    ...r,
    projects: Array.isArray(r.projects) ? (r.projects[0] ?? null) : r.projects,
  }));

  return (
    <MobileHubClient
      projects={projects ?? []}
      recentCosts={flatCosts}
      recentVars={flatVars}
    />
  );
}
