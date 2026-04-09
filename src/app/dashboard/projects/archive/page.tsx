import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getArchivedProjectsAction } from "./actions";
import ArchiveClient from "./archive-client";

export default async function ArchivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const archivedProjects = await getArchivedProjectsAction();

  return <ArchiveClient projects={archivedProjects} />;
}
