import { pipelineStageDisplayLabel } from "@/app/dashboard/pipeline-stage-display";

export function pipelineStageMoveSummary(fromStatus: string, toStatus: string): string {
    return `${pipelineStageDisplayLabel(fromStatus)} → ${pipelineStageDisplayLabel(toStatus)}`;
}

export const PIPELINE_STAGE_MOVE_TITLE = "Confirm pipeline stage change";
export const PIPELINE_STAGE_MARK_WON_TITLE = "Confirm Mark as Won";

export function pipelineStageMoveBody(fromStatus: string, toStatus: string, projectName: string): string {
    return `Move “${projectName}” on the board from ${pipelineStageDisplayLabel(fromStatus)} to ${pipelineStageDisplayLabel(toStatus)}? This updates operational tracking only — it does not send, publish, or email the proposal.`;
}

export function pipelineStageMarkWonBody(projectName: string): string {
    return `Record “${projectName}” as won and keep it on Active? This records client acceptance on the job — it does not send or publish the proposal document.`;
}