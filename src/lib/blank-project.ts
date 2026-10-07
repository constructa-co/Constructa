/**
 * Blank project creation.
 *
 * A new project carries only what the contractor typed. No estimate, scope,
 * programme or proposal wording is seeded from any template: the payload for
 * the atomic `create_phase1_project_graph` RPC is built here so that promise
 * can be tested without a database.
 */

import { z } from "zod";

/**
 * The creation RPC falls back to "Extension" when no project type is sent.
 * A blank project must not claim a type nobody chose, so an unanswered type
 * is stored as this neutral value instead.
 */
export const UNSPECIFIED_PROJECT_TYPE = "Other";

export const PROJECT_TYPE_OPTIONS: readonly string[] = [
    "Residential Extension", "Loft Conversion", "New Build Residential",
    "Domestic Renovation", "Driveway & External Works", "Groundworks & Civils",
    "Drainage & Utilities", "Commercial Fit-Out", "Commercial New Build",
    "Industrial Works", "Landscaping", "Roofing",
    "Electrical Installation", "Plumbing & Heating", "General Building Works", "Other",
];

export interface BlankProjectForm {
    name: string;
    client: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    siteAddress: string;
    projectType: string;
    startDate: string;
    potentialValue: string;
}

export const EMPTY_BLANK_PROJECT_FORM: BlankProjectForm = {
    name: "",
    client: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    siteAddress: "",
    projectType: "",
    startDate: "",
    potentialValue: "",
};

export type BlankProjectField = keyof BlankProjectForm;

const optionalText = (max: number, message: string) => z.string().trim().max(max, message);

const BlankProjectSchema = z.object({
    requestId: z.string().uuid("Something went wrong preparing this form. Refresh the page and try again."),
    name: z.string().trim().min(1, "Give the job a name.").max(200, "Keep the job name under 200 characters."),
    client: z.string().trim().min(1, "Add the client's name.").max(200, "Keep the client name under 200 characters."),
    clientEmail: z.union([
        z.literal(""),
        z.string().trim().max(200, "That email address is too long.").email("That email address doesn't look right."),
    ]),
    clientPhone: optionalText(50, "That phone number is too long."),
    clientAddress: optionalText(500, "Keep the client address under 500 characters."),
    siteAddress: optionalText(500, "Keep the site address under 500 characters."),
    projectType: optionalText(100, "That job type is too long."),
    startDate: z.union([
        z.literal(""),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the start date from the calendar."),
    ]),
    potentialValue: z.union([
        z.null(),
        z.number({ message: "Enter the rough value as a number." })
            .min(0, "The rough value can't be negative.")
            .max(100_000_000, "That value is too large."),
    ]),
});

export type BlankProjectInput = z.infer<typeof BlankProjectSchema>;

export type BlankProjectParseResult =
    | { ok: true; input: BlankProjectInput }
    | { ok: false; error: string; fieldErrors: Partial<Record<BlankProjectField, string>> };

const text = (value: unknown): string => (typeof value === "string" ? value : "");

function parsePotentialValue(value: unknown): number | null {
    const raw = text(value).trim().replace(/[£,\s]/g, "");
    if (!raw) return null;
    return Number(raw); // NaN is rejected by the schema with a plain message.
}

export function parseBlankProjectInput(raw: Record<string, unknown>): BlankProjectParseResult {
    const result = BlankProjectSchema.safeParse({
        requestId: text(raw.requestId),
        name: text(raw.name),
        client: text(raw.client),
        clientEmail: text(raw.clientEmail).trim(),
        clientPhone: text(raw.clientPhone),
        clientAddress: text(raw.clientAddress),
        siteAddress: text(raw.siteAddress),
        projectType: text(raw.projectType),
        startDate: text(raw.startDate).trim(),
        potentialValue: parsePotentialValue(raw.potentialValue),
    });

    if (result.success) return { ok: true, input: result.data };

    const fieldErrors: Partial<Record<BlankProjectField, string>> = {};
    let first = "";
    for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (!first) first = issue.message;
        if (key && key !== "requestId" && !(key in fieldErrors)) {
            fieldErrors[key as BlankProjectField] = issue.message;
        }
    }
    return { ok: false, error: first || "Check the details and try again.", fieldErrors };
}

/** What the browser can check before it calls the server. */
export function validateBlankProjectForm(form: BlankProjectForm, requestId: string) {
    return parseBlankProjectInput({ ...form, requestId });
}

export interface BlankProjectGraph {
    requestId: string;
    project: {
        name: string;
        client_name: string;
        client_email: string | null;
        client_phone: string | null;
        client_address: string | null;
        site_address: string | null;
        project_type: string;
        start_date: string | null;
        potential_value: number | null;
        status: "Lead";
        proposal_complexity: "full";
    };
    estimates: [];
}

/**
 * The project row holds the contractor's own inputs and nothing else. There
 * are no estimates, so there are no estimate lines either, and the keys that
 * would carry seeded scope, introduction, trade sections or programme are
 * left out entirely. "Lead" is the honest status for a job with no estimate.
 */
export function buildBlankProjectGraph(input: BlankProjectInput): BlankProjectGraph {
    return {
        requestId: input.requestId,
        project: {
            name: input.name,
            client_name: input.client,
            client_email: input.clientEmail || null,
            client_phone: input.clientPhone || null,
            client_address: input.clientAddress || null,
            site_address: input.siteAddress || null,
            project_type: input.projectType || UNSPECIFIED_PROJECT_TYPE,
            start_date: input.startDate || null,
            potential_value: input.potentialValue,
            status: "Lead",
            proposal_complexity: "full",
        },
        estimates: [],
    };
}

export const BLANK_PROJECT_CREATE_ERROR =
    "We couldn't create the project. Nothing you typed has been lost. Check your connection and try again.";

export type CreateBlankProjectResult =
    | { success: true; projectId: string }
    | { success: false; error: string; fieldErrors?: Partial<Record<BlankProjectField, string>> };

/** Maps the RPC response onto a result the form can act on. */
export function resolveBlankProjectCreation(
    data: unknown,
    error: unknown,
): CreateBlankProjectResult {
    const created = Array.isArray(data) ? data[0] : data;
    const projectId = created && typeof created === "object"
        ? (created as { project_id?: unknown }).project_id
        : null;
    if (error || typeof projectId !== "string" || !projectId) {
        return { success: false, error: BLANK_PROJECT_CREATE_ERROR };
    }
    return { success: true, projectId };
}

export function briefPathForProject(projectId: string): string {
    return `/dashboard/projects/brief?projectId=${encodeURIComponent(projectId)}`;
}
