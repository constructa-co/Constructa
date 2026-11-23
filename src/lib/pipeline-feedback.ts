export const PIPELINE_CHANGE_UNCONFIRMED = "The stage change could not be confirmed. It may have saved. Reload the pipeline to check before trying again.";
export const PIPELINE_REFRESH_UNCONFIRMED = "The stage was saved, but the view could not refresh. Reload the pipeline to see the latest status.";
export const PIPELINE_HISTORY_UNRECORDED = "The stage was saved, but we could not confirm this move in pipeline history.";
export type PipelineMutationResult = { success: true; warning?: string } | { success: false; error: string };
