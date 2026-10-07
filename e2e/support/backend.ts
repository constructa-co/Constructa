import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BRIEF_AI_PREREQUISITES, functionArgumentsFromApiDescription, type BudgetInspector, type Read } from "./brief-ai-mode";
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

/**
 * Read-only views of the AI budget in the disposable project, for the check
 * that runs before any synthetic account is created. Table reads are SELECTs.
 * Functions are never called: whether they exist is read from the API's own
 * description of itself. Errors are reduced to a code, so nothing sensitive
 * can reach a log.
 */
export function budgetInspector(env: E2EEnv = readE2EEnv()): BudgetInspector {
    const supabase = admin(env);
    const { tables } = BRIEF_AI_PREREQUISITES;
    const failed = (error: { code?: string } | null): { ok: false; code: string } => ({ ok: false, code: String(error?.code || "unknown") });
    let description: Promise<Read<unknown>> | null = null;
    const apiDescription = () => (description ??= (async (): Promise<Read<unknown>> => {
        const response = await fetch(`${env.supabaseUrl}/rest/v1/`, {
            method: "GET",
            headers: { apikey: env.supabaseServiceRoleKey, authorization: `Bearer ${env.supabaseServiceRoleKey}`, accept: "application/openapi+json" },
        });
        if (!response.ok) return { ok: false, code: `HTTP ${response.status}` };
        return { ok: true, value: await response.json() };
    })());

    return {
        feature: async (name) => {
            const { data, error } = await supabase.from(tables.features).select("enabled").eq("feature", name).maybeSingle();
            return error ? failed(error) : { ok: true, value: data ? { enabled: (data as { enabled: unknown }).enabled } : null };
        },
        limitScopes: async () => {
            const { data, error } = await supabase.from(tables.limits).select("scope");
            return error ? failed(error) : { ok: true, value: (data ?? []).map((row) => String((row as { scope: unknown }).scope)) };
        },
        attemptsReadable: async () => {
            const { error } = await supabase.from(tables.attempts).select("id").limit(1);
            return error ? failed(error) : { ok: true, value: true };
        },
        functionArguments: async (name) => {
            const api = await apiDescription();
            return api.ok ? { ok: true, value: functionArgumentsFromApiDescription(api.value, name) } : api;
        },
    };
}

/** How many budgeted attempts a synthetic account has for the Brief suggestion. A read. */
export async function briefAiAttempts(userId: string, email: string): Promise<number> {
    assertSynthetic(email);
    const { tables, feature } = BRIEF_AI_PREREQUISITES;
    const { count, error } = await admin(readE2EEnv()).from(tables.attempts).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("feature", feature);
    if (error || count === null) throw new Error(`Could not read the AI attempts (${error?.code ?? "no count"}).`);
    return count;
}
