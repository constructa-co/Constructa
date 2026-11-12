"use client";

import { useEffect, useRef, type ReactNode } from "react";
import ui from "./company-import.module.css";

export default function CompanyImportFrame({ children, dark, draftId }: {
    children: ReactNode;
    dark: boolean;
    draftId: string | null;
}) {
    const root = useRef<HTMLDivElement>(null);
    const previousDraft = useRef(draftId);
    const lastFocused = useRef<{ control: HTMLElement; heading: HTMLElement | null } | null>(null);
    useEffect(() => {
        if (draftId && previousDraft.current !== draftId) {
            root.current?.querySelector<HTMLElement>("#import-results-heading")?.focus();
        } else if (lastFocused.current && !lastFocused.current.control.isConnected && document.activeElement === document.body) {
            const heading = lastFocused.current.heading;
            if (heading?.isConnected) heading.focus();
        }
        previousDraft.current = draftId;
    }, [children, draftId]);

    return (
        <div ref={root} className={ui.root} data-theme={dark ? "dark" : "light"} onFocusCapture={(event) => {
            lastFocused.current = {
                control: event.target,
                heading: event.target.closest("[data-import-field]")?.querySelector<HTMLElement>("h3")
                    ?? root.current?.querySelector<HTMLElement>("#import-results-heading") ?? null,
            };
        }}>
            <header className={ui.header}>
                <p className={ui.eyebrow}>Your company / Your website</p>
                <h1 id="import-heading">Your company, brought into focus.</h1>
                <p>An optional starting point for your company profile. Review each suggestion before deciding what to save.</p>
            </header>
            <div className={ui.layout}>
                <div className={ui.editor}>{children}</div>
                <aside className={ui.guide} aria-label="How website import works">
                    <p className={ui.eyebrow}>Review before you save</p>
                    <ol>
                        <li><strong>Use your own website</strong><p>Confirm permission before choosing to check it.</p></li>
                        <li><strong>Compare the details</strong><p>See each suggestion beside what is saved, with its source.</p></li>
                        <li><strong>Choose the changes</strong><p>Nothing is ticked for you. Approve only the details you want.</p></li>
                    </ol>
                    <p className={ui.note}>A preview is not your profile. You can enter your details by hand instead.</p>
                </aside>
            </div>
        </div>
    );
}
