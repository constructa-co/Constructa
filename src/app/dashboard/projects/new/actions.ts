"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import {
    BLANK_PROJECT_CREATE_ERROR,
    buildBlankProjectGraph,
    parseBlankProjectInput,
    resolveBlankProjectCreation,
    type CreateBlankProjectResult,
} from "@/lib/blank-project";

/**
 * Creates a blank project through the atomic, idempotent creation RPC. The
 * client sends the same request id on every retry, so a retry after a lost
 * response returns the project that was already committed.
 */
export async function createBlankProjectAction(
    formData: FormData,
): Promise<CreateBlankProjectResult> {
    const parsed = parseBlankProjectInput(Object.fromEntries(formData.entries()));
    if (!parsed.ok) {
        return { success: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
    }
    const graph = buildBlankProjectGraph(parsed.input);

    try {
        const { supabase } = await requireAuth();
        const { data, error } = await supabase.rpc("create_phase1_project_graph", {
            p_request_id: graph.requestId,
            p_project: graph.project,
            p_estimates: graph.estimates,
        });
        const result = resolveBlankProjectCreation(data, error);
        if (!result.success) {
            console.error("createBlankProjectAction failed", {
                requestId: graph.requestId,
                code: error?.code,
                message: error?.message,
            });
        }
        return result;
    } catch (error) {
        console.error("createBlankProjectAction threw", {
            requestId: graph.requestId,
            message: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: BLANK_PROJECT_CREATE_ERROR };
    }
}
