"use client";

import { useEffect } from "react";

export default function PhoneMenuFocus() {
    useEffect(() => {
        const dialog = document.getElementById("phone-menu");
        const navigation = dialog?.querySelector("nav");
        const opener = document.querySelector<HTMLButtonElement>('button[aria-controls="phone-menu"]');
        if (!dialog || !navigation) return;

        const controls = () => Array.from(navigation.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, [tabindex]',
        )).filter(element => element.tabIndex >= 0 && !element.matches(":disabled")
            && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
        const focusFirst = () => controls()[0]?.focus({ preventScroll: true });
        const handleKey = (event: KeyboardEvent) => {
            if (event.key !== "Tab" || dialog.getClientRects().length === 0) return;
            const available = controls();
            const first = available[0];
            const last = available[available.length - 1];
            if (!first || !last) return;
            const outsideNavigation = !navigation.contains(document.activeElement);
            if (event.shiftKey && (document.activeElement === first || outsideNavigation)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || outsideNavigation)) {
                event.preventDefault();
                first.focus();
            }
        };
        const handleFocus = (event: FocusEvent) => {
            if (dialog.getClientRects().length > 0 && event.target instanceof Node && !dialog.contains(event.target)) {
                focusFirst();
            }
        };

        // The helper mounts only after the user opens the existing menu.
        focusFirst();
        document.addEventListener("keydown", handleKey);
        document.addEventListener("focusin", handleFocus);
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.removeEventListener("focusin", handleFocus);
            if (opener?.isConnected && opener.getClientRects().length > 0
                && (dialog.contains(document.activeElement) || document.activeElement === document.body)) {
                opener.focus({ preventScroll: true });
            }
        };
    }, []);

    return null;
}
