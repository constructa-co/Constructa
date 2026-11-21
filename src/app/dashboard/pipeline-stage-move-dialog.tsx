"use client";

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    PIPELINE_STAGE_MARK_WON_TITLE,
    PIPELINE_STAGE_MOVE_TITLE,
    pipelineStageMarkWonBody,
    pipelineStageMoveBody,
    pipelineStageMoveSummary,
} from "@/lib/pipeline-stage-move-copy";

export type PipelineStageMovePrompt = {
    projectName: string;
    fromStatus: string;
    toStatus: string;
    intent: "default" | "recordWin";
};

export function PipelineStageMoveDialog({
    open,
    pending,
    isDark,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    pending: PipelineStageMovePrompt | null;
    isDark: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!pending) return null;
    const isWon = pending.intent === "recordWin";
    const title = isWon ? PIPELINE_STAGE_MARK_WON_TITLE : PIPELINE_STAGE_MOVE_TITLE;
    const body = isWon
        ? pipelineStageMarkWonBody(pending.projectName)
        : pipelineStageMoveBody(pending.fromStatus, pending.toStatus, pending.projectName);
    const summary = isWon
        ? pipelineStageMoveSummary(pending.fromStatus, pending.toStatus)
        : pipelineStageMoveSummary(pending.fromStatus, pending.toStatus);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent
                className={`max-w-md text-left ${
                    isDark ? "border-[#2a2a2a] bg-[#1a1a1a] text-white" : "border-gray-200 bg-white text-gray-900"
                }`}
                data-board-stage-confirm
            >
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 text-sm leading-relaxed">
                    <p className={`font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}>{summary}</p>
                    <p className={isDark ? "text-[#a0a0a0]" : "text-gray-600"}>{body}</p>
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                            isDark
                                ? "border border-[#2a2a2a] bg-[#0d0d0d] text-slate-200 hover:bg-[#141414]"
                                : "border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
                        }`}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                            isDark ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                    >
                        Confirm move
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}