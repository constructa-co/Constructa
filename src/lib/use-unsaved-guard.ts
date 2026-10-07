"use client";

import { useEffect } from "react";

/**
 * Unsaved typing is never thrown away silently: while `dirty` is true a
 * reload or tab close asks first, and so does any link that leaves the page.
 * Buttons that save before they navigate are not links, so they are not
 * affected.
 */
export function useUnsavedGuard(dirty: boolean, message: string) {
    useEffect(() => {
        if (!dirty) return;
        const warnOnUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        const confirmOnLink = (event: MouseEvent) => {
            const link = (event.target as HTMLElement | null)?.closest?.("a[href]");
            if (!link || link.getAttribute("target") === "_blank" || link.getAttribute("href")?.startsWith("#")) return;
            if (!window.confirm(message)) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        window.addEventListener("beforeunload", warnOnUnload);
        document.addEventListener("click", confirmOnLink, true);
        return () => {
            window.removeEventListener("beforeunload", warnOnUnload);
            document.removeEventListener("click", confirmOnLink, true);
        };
    }, [dirty, message]);
}
