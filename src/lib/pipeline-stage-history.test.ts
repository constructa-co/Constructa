import { describe, expect, it, vi } from "vitest";
import { PIPELINE_STAGE_HISTORY_TABLE, appendPipelineStageHistory } from "./pipeline-stage-history";

describe("appendPipelineStageHistory", () => {
    it("records when the history table accepts the row", async () => {
        const from = vi.fn(() => ({
            insert: vi.fn(async () => ({ error: null })),
        }));
        const supabase = { from } as never;
        await expect(
            appendPipelineStageHistory(supabase, {
                projectId: "job",
                userId: "user",
                fromStatus: "Lead",
                toStatus: "Estimating",
            }),
        ).resolves.toEqual({ recorded: true });
        expect(from).toHaveBeenCalledWith(PIPELINE_STAGE_HISTORY_TABLE);
    });

    it("writes exactly the columns and table the migration defines", async () => {
        const insert = vi.fn(async () => ({ error: null }));
        const supabase = { from: vi.fn(() => ({ insert })) } as never;
        await appendPipelineStageHistory(supabase, {
            projectId: "job",
            userId: "user",
            fromStatus: "Lead",
            toStatus: "Estimating",
        });
        expect(PIPELINE_STAGE_HISTORY_TABLE).toBe("project_pipeline_stage_events");
        expect(insert).toHaveBeenCalledWith({
            project_id: "job",
            user_id: "user",
            from_status: "Lead",
            to_status: "Estimating",
        });
    });

    it("reports an RLS or constraint rejection as unrecorded, not a schema gate", async () => {
        const from = vi.fn(() => ({
            insert: vi.fn(async () => ({ error: { code: "42501", message: "new row violates row-level security policy" } })),
        }));
        const supabase = { from } as never;
        await expect(
            appendPipelineStageHistory(supabase, {
                projectId: "job",
                userId: "user",
                fromStatus: "Lead",
                toStatus: "Estimating",
            }),
        ).resolves.toEqual({ recorded: false, schemaGate: false });
    });

    it("returns recorded:false without throwing when insert throws", async () => {
        const from = vi.fn(() => ({
            insert: vi.fn(async () => {
                throw new Error("throwOnError");
            }),
        }));
        const supabase = { from } as never;
        await expect(
            appendPipelineStageHistory(supabase, {
                projectId: "job",
                userId: "user",
                fromStatus: "Lead",
                toStatus: "Estimating",
            }),
        ).resolves.toEqual({ recorded: false, schemaGate: false });
    });

    it("schema-gates when the history relation is absent", async () => {
        const from = vi.fn(() => ({
            insert: vi.fn(async () => ({ error: { code: "42P01", message: "relation does not exist" } })),
        }));
        const supabase = { from } as never;
        await expect(
            appendPipelineStageHistory(supabase, {
                projectId: "job",
                userId: "user",
                fromStatus: "Lead",
                toStatus: "Estimating",
            }),
        ).resolves.toEqual({ recorded: false, schemaGate: true });
    });
});