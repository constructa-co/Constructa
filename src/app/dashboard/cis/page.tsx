import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CisClient from "./cis-client";

export default async function CisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: subcontractors },
    { data: payments },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("company_name, cis_registered, cis_contractor_utr, cis_paye_reference, cis_accounts_office_ref")
      .eq("id", user.id)
      .single(),
    supabase
      .from("cis_subcontractors")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("cis_payments")
      .select("*, cis_subcontractors(name)")
      .eq("user_id", user.id)
      .order("payment_date", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("name", { ascending: true }),
  ]);

  return (
    <CisClient
      profile={profile ?? { company_name: null, cis_registered: false, cis_contractor_utr: null, cis_paye_reference: null, cis_accounts_office_ref: null }}
      subcontractors={subcontractors ?? []}
      payments={payments ?? []}
      projects={projects ?? []}
    />
  );
}
