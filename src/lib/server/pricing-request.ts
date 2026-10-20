import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { MAX_SCOPE_LENGTH } from "@/lib/guided-brief";
import { PRICING_CONVERSATION_OFF } from "@/lib/pricing-conversation";
import { buildPricingReviewContext, PRICING_REVIEW_STALE } from "@/lib/pricing-review";
import { getPrecontractEditLockReason } from "@/lib/project-editability";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { toEstimate } from "@/app/dashboard/projects/costs/estimate-mapping";
import type { Estimate } from "@/app/dashboard/projects/costs/types";

const RequestSchema = z.object({
    projectId: z.string().uuid(),
    estimateId: z.string().uuid().nullable(),
    message: z.string().max(MAX_SCOPE_LENGTH).refine(value => !!value.trim()
        && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)),
    // SHA-256 of the exact existing review revision, including the submitted message.
    // A fingerprint is only a freshness check, never proof of permission or correctness.
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

type PricingRequestResult = { status: "invalid" | "unavailable" | "stale" | "off"; message: string };
const unavailable = (): PricingRequestResult => ({ status: "unavailable", message: "The pricing request could not be checked. Nothing has changed. You can continue pricing manually." });
const stale = (): PricingRequestResult => ({ status: "stale", message: PRICING_REVIEW_STALE });

/** Server-only preflight, deliberately NOT a route or server action. No provider,
 * budget reservation, conversation storage or mutation exists here. A future
 * transport must add its own approved feature/budget/data controls before use.
 */
export async function inspectPricingRequest(input: unknown): Promise<PricingRequestResult> {
    const parsed = RequestSchema.safeParse(input);
    if (!parsed.success) return { status: "invalid", message: "Review the current job and enter a message within the source-text limit. Nothing has changed." };
    const request = parsed.data;
    try {
        const { supabase, user, project: verified } = await requireEditableProjectAccess(request.projectId);
        if (!user.id || verified.id !== request.projectId || verified.user_id !== user.id) return unavailable();

        const { data: project, error: projectError } = await supabase.from("projects")
            .select("id, user_id, brief_scope, status, is_archived, proposal_status, proposal_accepted_at")
            .eq("id", request.projectId).eq("user_id", user.id).single();
        if (projectError || !project || project.id !== request.projectId || project.user_id !== user.id
            || getPrecontractEditLockReason(project) || (project.brief_scope !== null && typeof project.brief_scope !== "string")) return unavailable();

        let estimate: Estimate | null = null;
        if (request.estimateId === null) {
            const { data, error } = await supabase.from("estimates").select("id")
                .eq("project_id", request.projectId).limit(1);
            if (error || !Array.isArray(data)) return unavailable();
            if (data.length) return stale();
        } else {
            const { data, error } = await supabase.from("estimates")
                .select("*, estimate_lines(*, estimate_line_components(*))")
                .eq("id", request.estimateId).eq("project_id", request.projectId).single();
            if (error || !data || data.id !== request.estimateId || data.project_id !== request.projectId
                || data.is_client_boq || !Array.isArray(data.estimate_lines)) return unavailable();
            const selected = toEstimate(data);
            if (selected.estimate_lines.some(line => !line || line.estimate_id !== selected.id
                || !Array.isArray(line.estimate_line_components)
                || line.estimate_line_components.some(component => !component || component.estimate_line_id !== line.id))) return unavailable();
            estimate = selected;
        }

        const context = buildPricingReviewContext({ id: project.id, brief_scope: project.brief_scope ?? "" }, estimate, request.message);
        if (!context.ok) return unavailable();
        const revision = createHash("sha256").update(context.value.revision).digest("hex");
        if (revision !== request.expectedRevision) return stale();

        // There is no approved pricing-chat feature in the existing AI budget.
        // Do not borrow brief.suggest (or any other feature) to bypass that gate.
        return { status: "off", message: PRICING_CONVERSATION_OFF };
    } catch {
        // Do not disclose ownership, saved scope, financial state or raw DB errors.
        return unavailable();
    }
}
