/**
 * How the journey treats the Brief's AI suggestion, and the read-only check
 * that the disposable project is really in the state that mode needs.
 *
 * There are two modes and the choice is explicit. Nothing here falls back
 * from one to the other because of what the application happened to say.
 *
 *   disabled            The feature is switched off, as this candidate ships
 *                       it. The journey asserts the deliberate "not switched
 *                       on" message, proves nothing was asked of the provider
 *                       or the budget, and completes the brief by hand.
 *                       AI SUGGESTIONS ARE NOT TESTED IN THIS MODE.
 *   enabled-with-stub   The feature is switched on in the disposable project
 *                       by an owner-approved change made elsewhere. The
 *                       journey asserts a pending suggestion from the stub.
 *
 * The check below only reads. It never switches anything on or off, and a
 * project that is missing the budget's tables or functions is a blocked
 * prerequisite, never a pass: a missing function makes the application say
 * "not available", which is a different message from "not switched on".
 */

import { COHORT_AI_OFF } from "../../src/lib/cohort-ai/shared";
import { E2EConfigurationError } from "./env";

export const BRIEF_AI_MODES = ["disabled", "enabled-with-stub"] as const;
export type BriefAiMode = (typeof BRIEF_AI_MODES)[number];

/** This candidate ships the feature switched off, so that is what the journey expects unless told otherwise. */
export const DEFAULT_BRIEF_AI_MODE: BriefAiMode = "disabled";
export const BRIEF_AI_MODE_VARIABLE = "E2E_BRIEF_AI_MODE";

/** The exact words the Brief shows when the feature is deliberately off. Read from the application, not copied. */
export const BRIEF_AI_OFF_MESSAGE = COHORT_AI_OFF;

/** What the Brief's action needs from the database: the names it uses, as the application and its migrations spell them. */
export const BRIEF_AI_PREREQUISITES = {
    feature: "brief.suggest",
    tables: { features: "ai_generation_features", limits: "ai_generation_limits", attempts: "ai_generation_attempts" },
    limitScopes: ["contractor", "global"],
    functions: {
        ai_generation_reserve: ["p_user_id", "p_feature", "p_reserve_output_tokens", "p_source_fingerprint"],
        ai_generation_finish: ["p_user_id", "p_attempt_id", "p_outcome", "p_prompt_tokens", "p_completion_tokens", "p_model", "p_prompt_version"],
    },
    migrations: ["20261009090000_ai_generation_budget.sql", "20261010090000_company_narrative_ai_attempt.sql", "20261011090000_cohort_ai_features.sql"],
} as const;

export function readBriefAiMode(source: NodeJS.ProcessEnv = process.env): BriefAiMode {
    const value = source[BRIEF_AI_MODE_VARIABLE]?.trim() ?? "";
    if (!value) return DEFAULT_BRIEF_AI_MODE;
    if ((BRIEF_AI_MODES as readonly string[]).includes(value)) return value as BriefAiMode;
    throw new E2EConfigurationError([`${BRIEF_AI_MODE_VARIABLE} must be one of: ${BRIEF_AI_MODES.join(", ")}. It is not a switch for the feature; it says which state the disposable project has been put in.`]);
}

/** A read that either found something or could not be made. `code` is the database's error code only: never a message, URL or key. */
export type Read<T> = { ok: true; value: T } | { ok: false; code: string };

/** Read-only views of the disposable project. Every method reads; none writes. */
export interface BudgetInspector {
    /** The feature's row, or null if there is none. */
    feature(name: string): Promise<Read<{ enabled: unknown } | null>>;
    /** Which allowance scopes have a row. */
    limitScopes(): Promise<Read<string[]>>;
    /** Whether the attempts table can be read. */
    attemptsReadable(): Promise<Read<true>>;
    /** The argument names of a database function as the API describes it, or null if the API does not offer it. */
    functionArguments(name: string): Promise<Read<string[] | null>>;
}

const REMEDY = `This needs an owner-approved application of the budget migrations to the disposable project (${BRIEF_AI_PREREQUISITES.migrations.join(", ")}). The harness will not apply them and will not change any setting.`;

/** Everything wrong with the disposable project for this mode. Empty means the journey may run. */
export async function briefAiPrerequisiteProblems(inspector: BudgetInspector, mode: BriefAiMode): Promise<string[]> {
    const { feature, tables, limitScopes, functions } = BRIEF_AI_PREREQUISITES;
    const problems: string[] = [];
    const blocked = (what: string) => problems.push(`PREREQUISITE BLOCKED: ${what}`);

    // Every read is attempted, so one run lists everything that is missing. A read that throws is a failed read.
    const attempt = async <T>(read: () => Promise<Read<T>>): Promise<Read<T>> => {
        try {
            return await read();
        } catch {
            return { ok: false, code: "unreadable" };
        }
    };

    const attempts = await attempt(() => inspector.attemptsReadable());
    if (!attempts.ok) blocked(`the table ${tables.attempts} could not be read (${attempts.code}).`);

    const scopes = await attempt(() => inspector.limitScopes());
    if (!scopes.ok) blocked(`the table ${tables.limits} could not be read (${scopes.code}).`);
    else for (const scope of limitScopes) if (!scopes.value.includes(scope)) blocked(`${tables.limits} has no '${scope}' allowance row.`);

    for (const [name, expected] of Object.entries(functions)) {
        const described = await attempt(() => inspector.functionArguments(name));
        if (!described.ok) blocked(`the database function ${name} could not be checked (${described.code}).`);
        else if (described.value === null) blocked(`the database function ${name} does not exist. Without it the Brief says the assistant is not available, which is not the same as switched off.`);
        else {
            const missing = expected.filter((argument) => !described.value!.includes(argument));
            if (missing.length > 0) blocked(`the database function ${name} does not take ${missing.join(", ")}: it is not the version the application calls.`);
        }
    }

    const row = await attempt(() => inspector.feature(feature));
    if (!row.ok) blocked(`the table ${tables.features} could not be read (${row.code}).`);
    else if (row.value === null) blocked(`${tables.features} has no row for ${feature}.`);
    else if (typeof row.value.enabled !== "boolean") blocked(`${feature} is neither switched on nor off in ${tables.features}; its state is not recognised.`);
    else if (mode === "disabled" && row.value.enabled) {
        problems.push(`WRONG STATE: ${feature} is switched ON in the disposable project, but this run is in '${mode}' mode. Do not switch it off to make this pass: if it was switched on deliberately, run with ${BRIEF_AI_MODE_VARIABLE}=enabled-with-stub.`);
    } else if (mode === "enabled-with-stub" && !row.value.enabled) {
        problems.push(`WRONG STATE: ${feature} is switched OFF in the disposable project, but this run is in '${mode}' mode. The harness will not switch it on. Switching it on is an owner-approved change; without it, run in 'disabled' mode.`);
    }

    if (problems.some((problem) => problem.startsWith("PREREQUISITE BLOCKED"))) problems.push(REMEDY);
    return problems;
}

/** Stops the run, as a configuration failure, unless the disposable project is in the state this mode needs. */
export async function assertBriefAiPrerequisites(inspector: BudgetInspector, mode: BriefAiMode): Promise<void> {
    const problems = await briefAiPrerequisiteProblems(inspector, mode);
    if (problems.length > 0) throw new E2EConfigurationError([`Brief AI mode: ${mode}.`, ...problems]);
}

/** The argument names PostgREST's description of the API gives for a function, or null if the function is not offered. */
export function functionArgumentsFromApiDescription(description: unknown, name: string): string[] | null {
    const paths = (description as { paths?: Record<string, unknown> } | null)?.paths;
    const entry = paths && typeof paths === "object" ? (paths[`/rpc/${name}`] as { post?: { parameters?: unknown } } | undefined) : undefined;
    if (!entry?.post) return null;
    const names = new Set<string>();
    for (const parameter of Array.isArray(entry.post.parameters) ? entry.post.parameters : []) {
        const properties = (parameter as { schema?: { properties?: Record<string, unknown> } } | null)?.schema?.properties;
        if (properties && typeof properties === "object") for (const key of Object.keys(properties)) names.add(key);
    }
    return [...names];
}

/** What the journey must find, and may go on to do, in each mode. */
export function briefAiExpectation(mode: BriefAiMode) {
    return mode === "disabled"
        ? { mode, suggestionTested: false, message: BRIEF_AI_OFF_MESSAGE, providerRequests: 0, budgetAttempts: 0, tradesChosen: "by hand" as const, appliesSuggestion: false }
        : { mode, suggestionTested: true, message: null, providerRequests: 1, budgetAttempts: 1, tradesChosen: "from the suggestion" as const, appliesSuggestion: true };
}
