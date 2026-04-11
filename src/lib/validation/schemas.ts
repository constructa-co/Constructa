/**
 * Shared Zod schemas for server action input validation.
 *
 * Sprint 58 Phase 1 item #3. Perplexity audit flagged that the codebase had
 * zero schema validation library — actions like `schedule/actions.ts`
 * `updateDependencyAction` read raw `FormData` without any checks, and
 * `library/actions.ts` `bulkAddMoMItemsAction` accepted `any[]` with no
 * shape validation at all. Classic server-action attack surface.
 *
 * Strategy:
 * - Define schemas for the 8 highest-risk mutating actions (financial
 *   writes + bulk imports + programme edits).
 * - Export a `parseInput<T>(schema, data)` helper that throws a clean
 *   "Invalid input: ..." error, caught by the error.tsx boundary.
 * - Schemas live alongside their actions' imports — each action module
 *   imports the schema it needs.
 *
 * Intentionally excluded: read-only actions (already safe), onboarding
 * (unique profile shape, validated inline), AI prompts (validated via
 * generateJSON's own JSON-schema), and entry points that only accept
 * opaque IDs (.delete() + .eq() on a UUID).
 */

import { z } from "zod";

// ── Shared primitives ────────────────────────────────────────────────────────

/** Positive money amount with max of £100m to cap absurd inputs. */
export const MoneyAmount = z.number().min(0).max(100_000_000);

/** Quantity that can legitimately be zero (e.g. placeholder items) but not negative. */
export const Quantity = z.number().min(0).max(1_000_000);

/** Unit rate up to £1m — covers plant day rates through specialist kit. */
export const UnitRate = z.number().min(0).max(1_000_000);

/** Percentage 0–100 inclusive. Used for margin, risk, overhead, prelims. */
export const Percentage = z.number().min(0).max(100);

/** ISO YYYY-MM-DD. Lenient — Supabase will reject malformed dates at the DB layer too. */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

/** UUID v4 / v5. Used as the primary key on nearly every table. */
export const Uuid = z.string().uuid();

/** Non-empty trimmed string with max length. Default 1000 chars. */
export const NonEmptyString = (max = 1000) =>
    z.string().trim().min(1, "Required").max(max);

// ── 1. Cost logging (p-and-l/actions.ts logCostAction) ───────────────────────
// The most-hit financial write in the app. Every cost entry logged from site
// goes through this. Negative amounts and garbage trade sections would corrupt
// burn calculations and variance reports.

export const LogCostSchema = z.object({
    projectId:        Uuid,
    description:      NonEmptyString(500),
    amount:           MoneyAmount,
    cost_type:        z.enum(["labour", "materials", "plant", "subcontract", "overhead", "prelims", "other"]),
    trade_section:    NonEmptyString(100),
    expense_date:     IsoDate,
    supplier:         z.string().max(200).optional(),
    estimate_line_id: Uuid.optional(),
    receipt_url:      z.string().url().max(2000).optional(),
    cost_status:      z.enum(["actual", "committed"]).optional(),
});

// ── 2. Section forecast override (p-and-l/actions.ts) ────────────────────────
// Drives the "Forecast Final" column on the P&L dashboard. Null = clear override.

export const SectionForecastSchema = z.object({
    projectId:    Uuid,
    tradeSection: NonEmptyString(100),
    forecastCost: MoneyAmount.nullable(),
});

// ── 3. Billing: Application for Payment (billing/actions.ts createAfpAction) ─
// Core AfP record. Period numbers must be positive, retention % capped,
// dates validated. Also the input to invoice PDF generation.

export const CreateAfpSchema = z.object({
    project_id:      Uuid,
    invoice_number:  NonEmptyString(50),
    type:            z.enum(["Interim", "Final"]),
    period_number:   z.number().int().min(1).max(100),
    gross_valuation: MoneyAmount,
    previous_cert:   MoneyAmount,
    retention_pct:   z.number().min(0).max(10), // UK practice is 3–5%; 10% hard cap
    due_date:        IsoDate.optional(),
});

// ── 4. Variations (variations/actions.ts createVariationAction) ──────────────
// VAR-001 workflow. Amount can be negative (omissions).

export const CreateVariationSchema = z.object({
    project_id:       Uuid,
    title:            NonEmptyString(200),
    description:      z.string().max(5000).optional().default(""),
    amount:           z.number().min(-100_000_000).max(100_000_000),
    instruction_type: z.string().max(100).optional(),
    trade_section:    z.string().max(100).optional(),
    instructed_by:    z.string().max(200).optional(),
    date_instructed:  IsoDate.optional(),
});

// ── 5. Programme phases (schedule/actions.ts updatePhasesAction) ─────────────
// The action that silently lost data for weeks before Sprint 57. Each phase
// object needs tight validation — this is the one place `any[]` was causing
// real production bugs.

export const ProgrammePhaseSchema = z.object({
    name:            NonEmptyString(200),
    calculatedDays:  z.number().int().min(0).max(3650),
    manualDays:      z.number().int().min(0).max(3650).nullable(),
    manhours:        z.number().min(0).max(1_000_000),
    startOffset:     z.number().int().min(0).max(3650),
    color:           z.string().max(50).optional(),
    dependsOn:       z.array(z.number().int().min(0).max(1000)).optional(),
    // Optional live-tracking fields added later in the sprint cycle
    pct_complete:       z.number().min(0).max(100).optional(),
    actual_start_date:  IsoDate.optional().nullable(),
    actual_finish_date: IsoDate.optional().nullable(),
    delay_reason:       z.string().max(500).optional(),
    delay_category:     z.string().max(100).optional(),
});

export const UpdatePhasesSchema = z.object({
    projectId: Uuid,
    phases:    z.array(ProgrammePhaseSchema).max(200),
    startDate: IsoDate.optional(),
});

// ── 6. Change events (change-management/actions.ts createChangeEventAction) ──
// NEC/JCT CE register entry. Values and days tracked separately.

export const CreateChangeEventSchema = z.object({
    project_id:         Uuid,
    title:              NonEmptyString(200),
    description:        z.string().max(5000).optional(),
    type:               NonEmptyString(100),
    issued_by:          NonEmptyString(200),
    clause_reference:   z.string().max(100).optional(),
    value_claimed:      MoneyAmount.optional(),
    time_claimed_days:  z.number().int().min(0).max(3650).optional(),
    date_notified:      IsoDate.optional(),
    notes:              z.string().max(5000).optional(),
});

// ── 7. Proposal save (proposal/actions.ts saveProposalAction) ────────────────
// The proposal editor serialises its state into FormData — schema validates
// the extracted fields before the DB write. String bounds kept generous to
// match the full proposal editor's textareas.

export const SaveProposalSchema = z.object({
    projectId:              Uuid,
    scope:                  z.string().max(20000).optional(),
    exclusions:             z.string().max(10000).optional(),
    clarifications:         z.string().max(10000).optional(),
    proposal_introduction:  z.string().max(20000).optional(),
    // Everything else is accepted as-is but the above cover the most
    // user-editable text-heavy fields.
});

// ── 8. Client BoQ import (costs/boq-import-action.ts createBoQEstimateAction) ─
// Bulk insert from Excel/PDF parsing. This is the `any[]` Perplexity flagged.
// Matches the flat `ParsedClientBoQ` shape emitted by the PDF / Excel parsers.

export const BoQLineSchema = z.object({
    client_ref:  z.string().max(50),
    section:     z.string().max(200),
    description: z.string().max(1000),
    quantity:    z.number().nullable(),
    unit:        z.string().max(20),
    unit_rate:   UnitRate,
    line_total:  MoneyAmount,
});

export const CreateBoQEstimateSchema = z.object({
    projectId: Uuid,
    boq: z.object({
        filename:   NonEmptyString(500),
        sections:   z.array(z.string().max(200)).max(100),
        lines:      z.array(BoQLineSchema).min(1).max(2000),
        totalLines: z.number().int().min(0),
    }),
});

// ── Helper: parse + throw a clean error ──────────────────────────────────────

/**
 * Parse `data` against `schema`. On success returns the typed, sanitised
 * object. On failure throws a single-line error with the first message from
 * each failing field — surfaced by the error.tsx boundary.
 */
export function parseInput<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown,
    label = "input"
): z.infer<T> {
    const result = schema.safeParse(data);
    if (!result.success) {
        const messages = result.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .slice(0, 5) // cap error message so we don't dump a wall of text
            .join("; ");
        throw new Error(`Invalid ${label}: ${messages}`);
    }
    return result.data;
}
