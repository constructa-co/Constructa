"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { DocSection, ProposalDocument } from "@/lib/proposal-document";
import ProposalDocumentView from "./proposal-document-view";
import ui from "./proposal-document-reader.module.css";

/**
 * Brings the reader's start back into view inside its nearest scrolling box,
 * such as the document dialog. The page itself is never scrolled.
 */
function showReaderStart(reader: HTMLElement) {
    for (let box = reader.parentElement; box && box !== document.body && box !== document.documentElement; box = box.parentElement) {
        const style = getComputedStyle(box);
        if (!/(auto|scroll)/.test(style.overflowY) || box.scrollHeight <= box.clientHeight) continue;
        const hidden = reader.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientTop - parseFloat(style.paddingTop);
        if (hidden < 0) box.scrollTop = Math.max(0, box.scrollTop + hidden);
        return;
    }
}

/** Moves one part of the shown section to just below the sticky reading controls, then focuses it. */
function showPart(reader: HTMLElement, target: HTMLElement, controls: HTMLElement | null) {
    const below = (controls?.offsetHeight ?? 0) + 12;
    target.focus({ preventScroll: true });
    for (let box = reader.parentElement; box && box !== document.body && box !== document.documentElement; box = box.parentElement) {
        const style = getComputedStyle(box);
        if (!/(auto|scroll)/.test(style.overflowY) || box.scrollHeight <= box.clientHeight) continue;
        box.scrollTop = Math.max(0, box.scrollTop + target.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientTop - below);
        return;
    }
    // Modal document view: when the inner scroller fits, do not move the page behind the dialog.
    if (reader.closest("dialog")) return;
    window.scrollBy({ top: target.getBoundingClientRect().top - below });
}

type SectionPart = { label: string; kind: "clause" | "caseStudy" | "subheading"; index: number };

// Where each kind of part already is in the rendered section. The document view is not changed.
const PART_TARGETS: Record<SectionPart["kind"], string> = {
    clause: "[data-doc-terms] > li",
    caseStudy: "[data-doc-case-study]",
    subheading: ":scope > div > h3",
};

/**
 * The named places in one section, in document order: each clause, each past
 * job and each subheading. Nothing is split, hidden or reordered.
 */
export function sectionParts(section: DocSection): SectionPart[] {
    const parts: SectionPart[] = [];
    const counts = { clause: 0, caseStudy: 0, subheading: 0 };
    for (const block of section.blocks) {
        if (block.type === "terms") {
            for (const clause of block.clauses) parts.push({ label: `${clause.number}. ${clause.title}`, kind: "clause", index: counts.clause++ });
        } else if (block.type === "caseStudy") {
            parts.push({ label: block.title, kind: "caseStudy", index: counts.caseStudy++ });
        } else if (block.type === "subheading") {
            parts.push({ label: block.text, kind: "subheading", index: counts.subheading++ });
        }
    }
    return parts;
}

/** Section-based reading pages, not a prediction of PDF page breaks. */
export default function ProposalDocumentReader({ doc, children }: { doc: ProposalDocument; children?: ReactNode }) {
    const pages = [
        { key: "cover", title: "Cover" },
        ...doc.sections.map(section => ({ key: section.id, title: section.title })),
        ...(children ? [{ key: "response", title: doc.response.heading }] : []),
    ];
    const [pageKey, setPageKey] = useState("cover");
    const found = pages.findIndex(page => page.key === pageKey);
    if (found < 0) setPageKey("cover");
    const index = Math.max(0, found);
    const current = pages[index];
    const selectId = useId();
    const noteId = useId();
    const partId = useId();
    const partNoteId = useId();
    const reader = useRef<HTMLDivElement>(null);
    const select = useRef<HTMLSelectElement>(null);
    const navigation = useRef<HTMLElement>(null);
    const shownPage = useRef(current.key);
    // Set when Previous or Next reaches the first or last page and so is disabled.
    const focusChooser = useRef(false);
    const [partChoice, setPartChoice] = useState({ page: "cover", index: 0 });

    // Only a change of page moves the view: a new page starts at its beginning.
    // Other renders of the same page leave scroll and focus where they are.
    useLayoutEffect(() => {
        if (shownPage.current === current.key) return;
        shownPage.current = current.key;
        if (reader.current) showReaderStart(reader.current);
        if (focusChooser.current) {
            focusChooser.current = false;
            select.current?.focus();
        }
    }, [current.key]);

    const goTo = (target: number) => {
        focusChooser.current = target === 0 || target === pages.length - 1;
        setPageKey(pages[target].key);
    };

    // The named places in this page's section. Choosing one moves there; nothing else changes.
    const section = doc.sections.find(item => item.id === current.key);
    const parts = section ? sectionParts(section) : [];
    const partIndex = partChoice.page === current.key ? Math.min(partChoice.index, Math.max(0, parts.length - 1)) : 0;
    const goToPart = () => {
        const part = parts[partIndex];
        const shown = reader.current?.querySelector<HTMLElement>(`[data-doc-section="${current.key}"]`);
        const target = part && shown ? shown.querySelectorAll<HTMLElement>(PART_TARGETS[part.kind])[part.index] : undefined;
        if (!target || !reader.current) return;
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        showPart(reader.current, target, navigation.current);
    };

    return (
        <div ref={reader} className={ui.reader} data-document-reader>
            <nav ref={navigation} className={ui.navigation} aria-label="Document reading pages">
                <div className={ui.controls}>
                    <button type="button" className={ui.button} disabled={index === 0} onClick={() => { if (index > 0) goTo(index - 1); }}>
                        Previous reading page
                    </button>
                    <div className={ui.choice}>
                        <label htmlFor={selectId}>Reading page</label>
                        <select ref={select} id={selectId} value={current.key} aria-describedby={noteId} onChange={event => setPageKey(event.target.value)} className={ui.select}>
                            {pages.map((page, number) => <option key={page.key} value={page.key}>{number + 1}. {page.title}</option>)}
                        </select>
                    </div>
                    <button type="button" className={ui.button} disabled={index === pages.length - 1} onClick={() => { if (index < pages.length - 1) goTo(index + 1); }}>
                        Next reading page
                    </button>
                </div>
                <p className={ui.position} role="status">Web reading page {index + 1} of {pages.length}: {current.title}</p>
                <p id={noteId} className={ui.note}>Reading pages group the document by section. The PDF may use different page breaks. Long sections stay complete and scroll without clipping.</p>
                {parts.length > 1 && (
                    <div className={ui.parts}>
                        <div className={ui.choice}>
                            <label htmlFor={partId}>Part of this reading page</label>
                            <select id={partId} value={partIndex} aria-describedby={partNoteId} onChange={event => setPartChoice({ page: current.key, index: Number(event.target.value) })} className={ui.select}>
                                {parts.map((part, number) => <option key={number} value={number}>{part.label}</option>)}
                            </select>
                        </div>
                        <button type="button" className={ui.button} onClick={goToPart}>Go to part</button>
                        <p id={partNoteId} className={ui.note}>Moves to that place on this page. Nothing is hidden, split or left out.</p>
                    </div>
                )}
            </nav>
            <div className={ui.paper}>
                <ProposalDocumentView doc={doc} readingPage={current.key}>{children}</ProposalDocumentView>
            </div>
        </div>
    );
}
