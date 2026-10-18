"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme-context";
import { PROPOSAL_READINESS_PATH } from "@/lib/first-session";
import ui from "./past-work.module.css";

export default function PastWorkFrame({ children }: { children: ReactNode }) {
    const { theme } = useTheme();
    return (
        <div className={ui.root} data-theme={theme === "dark" ? "dark" : "light"}>
            <header className={ui.header}>
                <p className={ui.eyebrow}>Your company / Your track record</p>
                <h1>Show what you&apos;ve built.</h1>
                <p>Bring your experience to life with past projects you are happy to share with clients. Saved examples can be used in proposals.</p>
                <Link href={PROPOSAL_READINESS_PATH}>See what your proposals can use so far</Link>
            </header>
            <div className={ui.layout}>
                <div className={ui.content}>{children}</div>
                <aside className={ui.guide} aria-label="Adding past work">
                    <p className={ui.eyebrow}>One example is a start</p>
                    <h2>The job. The work. The difference.</h2>
                    <p>Give the project a name, describe what you delivered, then explain what made your work stand out.</p>
                    <p>Use examples and details you have permission to share. You can keep working on the wording before saving.</p>
                    <p className={ui.note}>Save all past work saves this whole list. A save from another tab can overwrite newer changes, so work in one tab at a time.</p>
                </aside>
            </div>
        </div>
    );
}
