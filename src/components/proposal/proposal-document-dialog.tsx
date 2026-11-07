"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import ui from "./proposal-document-dialog.module.css";

/**
 * The finished proposal on its own, apart from editing and Send.
 *
 * A native modal dialog: the page behind it is inert, focus stays inside and
 * Escape closes it. It shows the preview it is given and nothing else. There
 * is no Save, Send or download here, and closing it changes nothing.
 *
 * Mount it only while the document view is wanted; unmounting closes it.
 */
export default function ProposalDocumentDialog({ children, onClose, title }: {
    children: ReactNode;
    onClose: () => void;
    title: string;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const back = useRef<HTMLButtonElement>(null);
    // Only a close the contractor chose is reported. A close made by this
    // component's own cleanup (unmount, or Strict Mode's remount) is not.
    const active = useRef(false);
    const labelId = useId();
    const titleId = useId();
    const noticeId = useId();

    // A layout effect so the cleanup closes the dialog while it is still in
    // the page, and the browser can return focus to the button that opened it.
    useLayoutEffect(() => {
        const element = dialog.current;
        if (!element) return;
        active.current = true;
        if (!element.open) element.showModal();
        back.current?.focus();
        return () => {
            active.current = false;
            if (element.open) element.close();
        };
    }, []);

    return (
        <dialog
            ref={dialog}
            className={ui.dialog}
            aria-labelledby={`${labelId} ${titleId}`}
            aria-describedby={noticeId}
            data-proposal-document-dialog
            onClose={() => {
                if (active.current && !dialog.current?.open) onClose();
            }}
        >
            <div className={ui.frame}>
                <header className={ui.header}>
                    <div className={ui.heading}>
                        <p id={labelId} className={ui.eyebrow}>Document view</p>
                        <h2 id={titleId} className={ui.title}>{title}</h2>
                        <p id={noticeId} className={ui.notice}>Read-only draft. Nothing is saved or sent here.</p>
                    </div>
                    <button ref={back} type="button" className={ui.back} onClick={() => dialog.current?.close()}>
                        Back to drafting
                    </button>
                </header>
                <div className={ui.document} role="region" aria-labelledby={titleId} tabIndex={0} data-document-view-scroll>
                    {children}
                </div>
            </div>
        </dialog>
    );
}
