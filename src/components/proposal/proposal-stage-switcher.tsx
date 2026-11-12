"use client";

import ui from "./proposal-stage-switcher.module.css";

export default function ProposalStageSwitcher({ stage, onStageChange, disabled }: {
    stage: "prepare" | "review";
    onStageChange: (stage: "prepare" | "review") => void;
    disabled: boolean;
}) {
    return (
        <div className={ui.stages} role="group" aria-label="Proposal stages">
            <div className={ui.controls}>
                <button type="button" disabled={disabled} aria-pressed={stage === "prepare"} aria-controls="proposal-preparation" onClick={() => onStageChange("prepare")} className={`${ui.step} min-h-11`}>
                    1. Prepare proposal
                </button>
                <button type="button" disabled={disabled} aria-pressed={stage === "review"} aria-controls="proposal-final-review" onClick={() => onStageChange("review")} className={`${ui.step} min-h-11`}>
                    2. Review document
                </button>
            </div>
            <p className={ui.guide}>
                Prepare and save your draft, then check the document before using the Send controls. Switching views does not save or send anything.
            </p>
        </div>
    );
}
