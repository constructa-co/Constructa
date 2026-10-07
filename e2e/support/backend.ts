import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { functionSignatureFromApiDescription } from "./api-description";
import { BRIEF_AI_PREREQUISITES, type BudgetInspector, type Read } from "./brief-ai-mode";
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

/** How long any one read in the check before the journey may take. */
export const PREFLIGHT_TIMEOUT_MS = 10_000;
/** The API's description of itself is not read past this size. */
export const API_DESCRIPTION_MAX_BYTES = 8_000_000;

const timedOut = (error: unknown) => /abort|timeout|timed out/i.test(`${(error as { name?: unknown } | null)?.name ?? ""} ${(error as { message?: unknown } | null)?.message ?? ""}`);

/**
 * Read-only views of the AI budget in the disposable project, for the check
 * that runs before any synthetic account is created. Table reads are SELECTs.
 * Functions are never called: whether they exist is read from the API's own
 * description of itself, with one GET. Every read has a time limit. Errors
 * are reduced to a short code, so no message, address or key can reach a log.
 */
export function budgetInspector(env: E2EEnv = readE2EEnv(), options: { timeoutMs?: number } = {}): BudgetInspector {
    const supabase = admin(env);
    const timeoutMs = options.timeoutMs ?? PREFLIGHT_TIMEOUT_MS;
    const limit = () => AbortSignal.timeout(timeoutMs);
    const { tables } = BRIEF_AI_PREREQUISITES;
    const failed = (error: { code?: string; message?: string; name?: string } | null): { ok: false; code: string } => {
        if (timedOut(error)) return { ok: false, code: "timeout" };
        // A database or API error code is a short fixed token. Anything else is not repeated.
        return { ok: false, code: /^[A-Za-z0-9]{1,12}$/.test(String(error?.code ?? "")) ? String(error?.code) : "unknown" };
    };

    let description: Promise<Read<unknown>> | null = null;
    const apiDescription = () => (description ??= (async (): Promise<Read<unknown>> => {
        try {
            const response = await fetch(`${env.supabaseUrl}/rest/v1/`, {
                method: "GET",
                redirect: "error",
                signal: limit(),
                headers: { apikey: env.supabaseServiceRoleKey, authorization: `Bearer ${env.supabaseServiceRoleKey}`, accept: "application/openapi+json" },
            });
            if (!response.ok) return { ok: false, code: `http-${response.status}` };
            const text = await response.text();
            if (text.length > API_DESCRIPTION_MAX_BYTES) return { ok: false, code: "api-description-too-large" };
            try {
                return { ok: true, value: JSON.parse(text) };
            } catch {
                return { ok: false, code: "api-description-not-json" };
            }
        } catch (error) {
            return { ok: false, code: timedOut(error) ? "timeout" : "network" };
        }
    })());

    return {
        feature: async (name) => {
            const { data, error } = await supabase.from(tables.features).select("enabled").eq("feature", name).abortSignal(limit()).maybeSingle();
            return error ? failed(error) : { ok: true, value: data ? { enabled: (data as { enabled: unknown }).enabled } : null };
        },
        limitScopes: async () => {
            const { data, error } = await supabase.from(tables.limits).select("scope").abortSignal(limit());
            return error ? failed(error) : { ok: true, value: (data ?? []).map((row) => String((row as { scope: unknown }).scope)) };
        },
        attemptsReadable: async () => {
            const { error } = await supabase.from(tables.attempts).select("id").limit(1).abortSignal(limit());
            return error ? failed(error) : { ok: true, value: true };
        },
        functionArguments: async (name) => {
            const api = await apiDescription();
            if (!api.ok) return api;
            const signature = functionSignatureFromApiDescription(api.value, name);
            if (signature.kind === "absent") return { ok: true, value: null };
            if (signature.kind === "arguments") return { ok: true, value: signature.names };
            // Not understood is not the same as "takes no arguments".
            return { ok: false, code: `api-description-unreadable:${signature.code}` };
        },
    };
}

/** How many budgeted attempts a synthetic account has for the Brief suggestion. A read. */
export async function briefAiAttempts(userId: string, email: string): Promise<number> {
    assertSynthetic(email);
    const { tables, feature } = BRIEF_AI_PREREQUISITES;
    const { count, error } = await admin(readE2EEnv()).from(tables.attempts).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("feature", feature).abortSignal(AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS));
    if (error || count === null) throw new Error(`Could not read the AI attempts (${timedOut(error) ? "timeout" : /^[A-Za-z0-9]{1,12}$/.test(String(error?.code ?? "")) ? error?.code : "no count"}).`);
    return count;
}
