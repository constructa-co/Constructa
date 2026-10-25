"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme-context";
import { PROPOSAL_READINESS_PATH } from "@/lib/first-session";
import { IMPORT_PATH } from "@/lib/company-import/draft";
import { INTERVIEW_PATH } from "@/lib/company-interview/questions";
import ui from "./company-profile.module.css";

export default function CompanyProfilePresentation({ children }: { children: ReactNode }) {
    const { theme } = useTheme();
    return (
        <div className={ui.root} data-theme={theme}>
            <header className={ui.header}>
                <Link href={PROPOSAL_READINESS_PATH} className={ui.back}>Back to your welcome</Link>
                <p className={ui.eyebrow}>Your company / Your voice</p>
                <h1>Introduce your business.</h1>
                <p className={ui.lede}>Start with the basics. Add your work, your people and your story at your own pace.</p>
                <div className={ui.guide}>
                    <span aria-hidden="true">01</span>
                    <div><strong>One profile. More useful proposals.</strong><p>Save applies to the whole profile. Moving between sections does not save anything.</p></div>
                </div>
            </header>
            {/* Section navigation lives in the form, which shows one section at a time. */}
            <div className={ui.layout}>
                <div className={ui.editor}>{children}</div>
                <aside className={ui.aside} aria-labelledby="company-other-ways">
                    <p className={ui.eyebrow}>Make it yours</p>
                    <h2 id="company-other-ways">Prefer a starting point?</h2>
                    <p>You can write directly in the form, or use an existing guided route.</p>
                    <Link href={INTERVIEW_PATH}><strong>Answer a few questions</strong><span>A guided questionnaire for your introduction.</span></Link>
                    <Link href={IMPORT_PATH}><strong>Bring in website details</strong><span>Open the existing website-import flow.</span></Link>
                    <div className={ui.note}><strong>No need to finish everything.</strong><p>You can begin a job before completing your full profile. Each proposal has its own checks before sending.</p></div>
                    <div className={ui.note}><strong>Next: Pipeline or New Project</strong><p>Save your profile changes before leaving. Open them from the main menu (Jobs on phone, Work Winning on desktop).</p></div>
                </aside>
            </div>
        </div>
    );
}
