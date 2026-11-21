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