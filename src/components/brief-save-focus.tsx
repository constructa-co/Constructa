"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { BriefSaveStatus } from "@/lib/guided-brief";

export default function BriefSaveFocus({ status, heading }: {
    status: BriefSaveStatus;
    heading: RefObject<HTMLHeadingElement | null>;
}) {
    const lastFocused = useRef<HTMLElement | null>(null);
    const previousStatus = useRef(status);

    useEffect(() => {
        const root = heading.current?.closest("[data-brief-root]");
        const rememberFocus = (event: FocusEvent) => {
            lastFocused.current = event.target instanceof HTMLElement && root?.contains(event.target)
                ? event.target
                : null;
        };
        document.addEventListener("focusin", rememberFocus);
        return () => document.removeEventListener("focusin", rememberFocus);
    }, [heading]);

    useEffect(() => {
        const settled = previousStatus.current === "saving" && (status === "saved" || status === "unsaved");
        const removedControl = lastFocused.current && !lastFocused.current.isConnected;
        if (settled && removedControl && document.activeElement === document.body) {
            heading.current?.focus({ preventScroll: true });
        }
        previousStatus.current = status;
    }, [status, heading]);

    return null;
}
