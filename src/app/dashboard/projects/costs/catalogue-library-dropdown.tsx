"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CostLibraryItem } from "./types";
import { formatGBP } from "@/lib/simple-estimate";

type PanelProps = {
    items: CostLibraryItem[];
    disabled: boolean;
    onPick: (itemId: string) => void;
    onOptionFocus?: () => void;
    className: string;
    style?: React.CSSProperties;
};

/** Catalogue match list — call as a function in the row tree so replay tests see option buttons. */
export function catalogueDropdownPanel({ items, disabled, onPick, onOptionFocus, className, style }: PanelProps) {
    return (
        <div data-library-dropdown role="listbox" className={className} style={style}>
            {items.map((item) => (
                <button
                    type="button"
                    key={item.id}
                    role="option"
                    disabled={disabled}
                    title="Review a catalogue rate for a simple non-BoQ line; quantities are not converted."
                    onMouseDown={(event) => event.preventDefault()}
                    onFocus={() => onOptionFocus?.()}
                    onClick={() => onPick(item.id)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-700/50 disabled:opacity-50"
                >
                    <span className="truncate text-slate-200">
                        <span className="mr-1.5 text-xs text-slate-500">{item.code}</span>
                        {item.description}
                    </span>
                    <span className="ml-2 whitespace-nowrap text-xs text-slate-400">
                        {formatGBP(item.base_rate)}/{item.unit}
                    </span>
                </button>
            ))}
        </div>
    );
}

/** @deprecated Prefer sync-on-focus coords in LineItemRow; kept for layout tests. */
export function useCatalogueDropdownPosition(anchorRef: { current: HTMLElement | null }, open: boolean) {
    const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

    useLayoutEffect(() => {
        if (!open || !anchorRef.current || typeof window === "undefined") {
            setPosition(null);
            return;
        }
        const update = () => {
            const rect = anchorRef.current?.getBoundingClientRect();
            if (!rect) return;
            setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        };
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [open, anchorRef]);

    return position;
}

type PortalProps = Omit<PanelProps, "className" | "style"> & {
    anchorRef: { current: HTMLElement | null };
    open: boolean;
};

/** Fixed body portal — avoids clipping from horizontal scroll containers. */
export function CatalogueDropdownPortal({ anchorRef, open, items, disabled, onPick }: PortalProps) {
    const position = useCatalogueDropdownPosition(anchorRef, open);
    if (!open || !items.length) return null;
    if (!position || typeof document === "undefined") {
        return catalogueDropdownPanel({
            items,
            disabled,
            onPick,
            className: "absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl",
        });
    }
    const panel = catalogueDropdownPanel({
        items,
        disabled,
        onPick,
        className: "fixed z-[60] max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl",
        style: { top: position.top, left: position.left, width: position.width, maxWidth: "min(100vw - 16px, 480px)" },
    });
    return createPortal(panel, document.body);
}