"use client";

import { useEffect, useRef } from "react";

export default function PricingFocus({ revision }: { revision: unknown }) {
    const marker = useRef<HTMLSpanElement>(null);
    const lastFocused = useRef<HTMLElement | null>(null);
    const submitted = useRef<HTMLFormElement | null>(null);

    useEffect(() => {
        const root = marker.current?.parentElement;
        const rememberFocus = (event: FocusEvent) => {
            lastFocused.current = event.target instanceof HTMLElement && root?.contains(event.target)
                ? event.target
                : null;
        };
        const rememberSubmit = (event: SubmitEvent) => {
            if (event.target instanceof HTMLFormElement) submitted.current = event.target;
        };
        document.addEventListener("focusin", rememberFocus);
        root?.addEventListener("submit", rememberSubmit, true);
        return () => {
            document.removeEventListener("focusin", rememberFocus);
            root?.removeEventListener("submit", rememberSubmit, true);
        };
    }, []);

    useEffect(() => {
        const root = marker.current?.parentElement;
        const invalid = submitted.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        submitted.current = null;
        if (invalid) {
            invalid.focus();
            return;
        }
        if (lastFocused.current && !lastFocused.current.isConnected && document.activeElement === document.body) {
            const target = root?.querySelector<HTMLElement>('form[aria-label] input:not(:disabled)')
                ?? root?.querySelector<HTMLElement>("#price-lines-title");
            target?.focus({ preventScroll: true });
        }
    }, [revision]);

    return <span ref={marker} hidden />;
}
