"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PROPOSAL_READINESS_PATH } from "@/lib/first-session";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import ui from "./new-job.module.css";

export default function NewJobFrame({ children, first, dark, creating, errorKey }: {
    children: ReactNode;
    first: boolean;
    dark: boolean;
    creating: boolean;
    errorKey: string;
}) {
    const root = useRef<HTMLDivElement>(null);
    const submitRequested = useRef(false);
    const wasCreating = useRef(creating);
    useEffect(() => {
        const afterSubmit = submitRequested.current && !creating;
        const returnedWithError = wasCreating.current && !creating && Boolean(errorKey);
        if ((afterSubmit || returnedWithError) && errorKey) {
            root.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-job-create-error]')?.focus();
        }
        if (creating || afterSubmit || returnedWithError) submitRequested.current = false;
        wasCreating.current = creating;
    }, [children, creating, errorKey]);

    return (
        <div ref={root} className={ui.root} data-theme={dark ? "dark" : "light"} onSubmitCapture={() => {
            if (!creating) submitRequested.current = true;
        }}>
            <Link href={first ? PROPOSAL_READINESS_PATH : getLaunchLandingPath()} className={ui.back}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                {first ? "Back to company setup" : "Back to your workspace"}
            </Link>
            <header className={ui.header}>
                <p className={ui.eyebrow}>Your next job / A blank starting point</p>
                <h1>{first ? "Add your first job" : "New project"}</h1>
                <p>Just a name for the job and who it&apos;s for. It starts blank, and you describe the work on the next screen.</p>
            </header>
            <div className={ui.layout}>
                <div className={ui.editor}>{children}</div>
                <aside className={ui.guide} aria-label="Starting a job">
                    <p className={ui.eyebrow}>Keep the start simple</p>
                    <h2>A name. A client. Then the work.</h2>
                    <p>Start with the two essentials. The optional details are here if you already know them.</p>
                    <p className={ui.note}>The next screen is the brief, where you describe the work. This form does not choose an estimate, scope or programme for you.</p>
                </aside>
            </div>
        </div>
    );
}
