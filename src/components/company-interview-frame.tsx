"use client";

import { useEffect, useRef, type ReactNode } from "react";
import ui from "./company-interview.module.css";

export default function CompanyInterviewFrame({ children, dark, reviewing, questionIndex }: {
    children: ReactNode;
    dark: boolean;
    reviewing: boolean;
    questionIndex: number;
}) {
    const root = useRef<HTMLDivElement>(null);
    const step = reviewing ? "review" : `question-${questionIndex}`;
    const previousStep = useRef(step);
    const lastFocused = useRef<{ control: HTMLElement; landmark: HTMLElement | null } | null>(null);

    useEffect(() => {
        if (previousStep.current !== step) {
            // Orient keyboard users to the new section, not its editable field.
            root.current?.querySelector<HTMLElement>(reviewing ? "#interview-review" : "#interview-question")?.focus();
        } else if (lastFocused.current && !lastFocused.current.control.isConnected && document.activeElement === document.body) {
            const landmark = lastFocused.current.landmark;
            if (landmark?.isConnected) landmark.focus();
        }
        previousStep.current = step;
    }, [children, reviewing, step]);

    return (
        <div ref={root} className={ui.root} data-theme={dark ? "dark" : "light"} onFocusCapture={(event) => {
            lastFocused.current = {
                control: event.target,
                landmark: event.target.closest("[data-interview-fact]")?.querySelector<HTMLElement>("h3")
                    ?? root.current?.querySelector<HTMLElement>(reviewing ? "#interview-review" : "#interview-question") ?? null,
            };
        }}>
            <header className={ui.header}>
                <p className={ui.eyebrow}>Your company / Your story</p>
                {reviewing ? <p className={ui.title}>Make it sound like you.</p> : <h1 className={ui.title}>Tell your story.</h1>}
                <p>A few optional questions, one at a time. Review your introduction before choosing what to add to your profile.</p>
            </header>
            <div className={ui.layout}>
                <div className={ui.editor}>{children}</div>
                <aside className={ui.aside} aria-label="How the guided company questions work">
                    <p className={ui.eyebrow}>A simple starting point</p>
                    <ol>
                        <li><strong>Your answers</strong><p>Use your own words. Skip any question you do not need.</p></li>
                        <li><strong>Your introduction</strong><p>Read the draft and change the wording before saving it.</p></li>
                        <li><strong>Your choice</strong><p>Review and save each offered detail separately.</p></li>
                    </ol>
                    <p className={ui.note}>This is a guided questionnaire, not a live AI conversation. You can enter your company details by hand instead.</p>
                </aside>
            </div>
        </div>
    );
}
