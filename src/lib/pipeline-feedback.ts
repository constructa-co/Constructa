export const PIPELINE_CHANGE_UNCONFIRMED = "The stage change could not be confirmed. It may have saved. Reload the pipeline to check before trying again.";
export const PIPELINE_REFRESH_UNCONFIRMED = "The stage was saved, but the view could not refresh. Reload the pipeline to see the latest status.";
export type PipelineMutationResult = { success: true; warning?: string } | { success: false; error: string };
