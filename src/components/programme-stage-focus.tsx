"use client";

import { useEffect, useRef } from "react";

export default function ProgrammeStageFocus({ revision }: { revision: unknown }) {
    const marker = useRef<HTMLSpanElement>(null);
    const lastFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const root = marker.current?.parentElement;
        const rememberFocus = (event: FocusEvent) => {
            lastFocused.current = event.target instanceof HTMLElement && root?.contains(event.target)
                ? event.target
                : null;
        };
        document.addEventListener("focusin", rememberFocus);
        return () => document.removeEventListener("focusin", rememberFocus);
    }, []);

    useEffect(() => {
        if (lastFocused.current && !lastFocused.current.isConnected && document.activeElement === document.body) {
            const root = marker.current?.parentElement;
            const target = root?.querySelector<HTMLElement>('[data-programme-stage] input:not(:disabled)')
                ?? root?.querySelector<HTMLElement>("#programme-duration:not(:disabled)")
                ?? root?.querySelector<HTMLElement>("#programme-start:not(:disabled)");
            target?.focus({ preventScroll: true });
        }
    }, [revision]);

    return <span ref={marker} hidden />;
}
