"use client";

import { useId, useState, type ReactNode } from "react";
import type { ProposalDocument } from "@/lib/proposal-document";
import ProposalDocumentView from "./proposal-document-view";
import ui from "./proposal-document-reader.module.css";

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

    return (
        <div className={ui.reader} data-document-reader>
            <nav className={ui.navigation} aria-label="Document reading pages">
                <div className={ui.controls}>
                    <button type="button" className={ui.button} disabled={index === 0} onClick={() => { if (index > 0) setPageKey(pages[index - 1].key); }}>
                        Previous reading page
                    </button>
                    <div className={ui.choice}>
                        <label htmlFor={selectId}>Reading page</label>
                        <select id={selectId} value={current.key} aria-describedby={noteId} onChange={event => setPageKey(event.target.value)} className={ui.select}>
                            {pages.map((page, number) => <option key={page.key} value={page.key}>{number + 1}. {page.title}</option>)}
                        </select>
                    </div>
                    <button type="button" className={ui.button} disabled={index === pages.length - 1} onClick={() => { if (index < pages.length - 1) setPageKey(pages[index + 1].key); }}>
                        Next reading page
                    </button>
                </div>
                <p className={ui.position} role="status">Web reading page {index + 1} of {pages.length}: {current.title}</p>
                <p id={noteId} className={ui.note}>Reading pages group the document by section. The PDF may use different page breaks. Long sections stay complete and scroll without clipping.</p>
            </nav>
            <div className={ui.paper}>
                <ProposalDocumentView doc={doc} readingPage={current.key}>{children}</ProposalDocumentView>
            </div>
        </div>
    );
}
