import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { APPROVED_DISPOSABLE_PROJECT, SYNTHETIC_EMAIL_DOMAIN, readE2EEnv, type E2EEnv } from "./env";

/**
 * Direct access to the disposable project, used only to prove where the
 * journey's data went. It writes nothing and deletes nothing: published
 * proposals are immutable records, so a run's synthetic account stays in the
 * disposable project until that project is deleted. The journey itself goes
 * through the browser like a contractor would.
 */
function admin(env: E2EEnv): SupabaseClient {
    // Checked again at the point of use: nothing below can run against any
    // project other than the approved disposable one.
    if (new URL(env.supabaseUrl).hostname !== `${APPROVED_DISPOSABLE_PROJECT.ref}.supabase.co` || env.projectRef !== APPROVED_DISPOSABLE_PROJECT.ref) {
        throw new Error("Refusing to use the admin client: the target is not the approved disposable project.");
    }
    return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

function assertSynthetic(email: string) {
    if (!email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) {
        throw new Error("Refusing to act on a non-synthetic identity.");
    }
}

/** The account the browser just created exists in the disposable project. */
export async function syntheticUserExists(userId: string, email: string): Promise<boolean> {
    assertSynthetic(email);
    const { data, error } = await admin(readE2EEnv()).auth.admin.getUserById(userId);
    return !error && data.user?.email?.toLowerCase() === email.toLowerCase();
}

/** The setup answers saved for a synthetic account. */
export async function savedSetup(userId: string, email: string): Promise<{ companyName: string | null; businessType: string | null; fullName: string | null }> {
    assertSynthetic(email);
    const { data, error } = await admin(readE2EEnv())
        .from("profiles")
        .select("company_name, business_type, full_name")
        .eq("id", userId)
        .maybeSingle();
    if (error) throw new Error(`Could not read the profile: ${error.message}`);
    return { companyName: data?.company_name ?? null, businessType: data?.business_type ?? null, fullName: data?.full_name ?? null };
}

export interface PublicationRecord {
    version: number;
    status: string;
    responseKind: string | null;
    events: string[];
}

/** What the database recorded for each sent version, oldest first. */
export async function publicationRecords(projectId: string): Promise<PublicationRecord[]> {
    const supabase = admin(readE2EEnv());
    const { data: publications, error } = await supabase
        .from("proposal_publications")
        .select("id, version_number, status, snapshot")
        .eq("project_id", projectId)
        .order("version_number");
    if (error) throw new Error(`Could not read publications: ${error.message}`);

    const records: PublicationRecord[] = [];
    for (const publication of publications ?? []) {
        const { data: events } = await supabase
            .from("proposal_publication_events")
            .select("event_type")
            .eq("publication_id", publication.id)
            .order("occurred_at")
            .order("id");
        records.push({
            version: publication.version_number,
            status: publication.status,
            responseKind: (publication.snapshot as { response?: { kind?: string } } | null)?.response?.kind ?? null,
            events: (events ?? []).map((event) => String(event.event_type)),
        });
    }
    return records;
}
