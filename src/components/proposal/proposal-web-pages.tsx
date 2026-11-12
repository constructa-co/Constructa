"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import css from "./proposal-web-pages.module.css";

type OverflowStyle = { maxHeight: string; overflowY: string };

/** Replaced/indivisible media can scroll locally; long text still fragments across web pages. */
function markOversized(root: HTMLElement, pageHeight: number, previous: Map<HTMLElement, OverflowStyle>) {
    for (const node of root.querySelectorAll<HTMLElement>("figure, svg, video, canvas")) {
        if (node.dataset.webPageOverflow !== undefined || node.offsetHeight <= pageHeight + 1) continue;
        if (!getComputedStyle(node).breakInside.includes("avoid")) continue;
        previous.set(node, { maxHeight: node.style.maxHeight, overflowY: node.style.overflowY });
        node.dataset.webPageOverflow = "";
        node.style.maxHeight = `${pageHeight}px`;
        node.style.overflowY = "auto";
    }
}

function clearOversized(previous: Map<HTMLElement, OverflowStyle>) {
    for (const [node, style] of previous) {
        delete node.dataset.webPageOverflow;
        node.style.maxHeight = style.maxHeight;
        node.style.overflowY = style.overflowY;
    }
    previous.clear();
}

/**
 * CSS-column web pages around the existing document view.
 * Inactive wrappers use display:contents so .paper > article still matches.
 */
export default function ProposalWebPages({
    active,
    documentKey,
    pageIndex,
    paperClassName,
    onPageIndex,
    onPageCount,
    children,
}: {
    active: boolean;
    documentKey: unknown;
    pageIndex: number;
    paperClassName: string;
    onPageIndex: (index: number) => void;
    onPageCount: (count: number) => void;
    children: ReactNode;
}) {
    const viewport = useRef<HTMLDivElement>(null);
    const flow = useRef<HTMLDivElement>(null);
    const pageIndexRef = useRef(pageIndex);
    const onPageIndexRef = useRef(onPageIndex);
    const onPageCountRef = useRef(onPageCount);
    const lastCount = useRef(0);
    useLayoutEffect(() => {
        pageIndexRef.current = pageIndex;
        onPageIndexRef.current = onPageIndex;
        onPageCountRef.current = onPageCount;
    }, [pageIndex, onPageIndex, onPageCount]);

    useLayoutEffect(() => {
        if (viewport.current) viewport.current.scrollTop = 0;
    }, [active, pageIndex]);

    useLayoutEffect(() => {
        if (!active) {
            lastCount.current = 0;
            return;
        }
        const viewportEl = viewport.current;
        const flowEl = flow.current;
        if (!viewportEl || !flowEl) return;
        lastCount.current = 0;

        let raf = 0;
        let cancelled = false;
        let pageWidth = 0;
        let pageHeight = 0;
        const previous = new Map<HTMLElement, OverflowStyle>();

        const measure = () => {
            if (cancelled) return;
            const width = viewportEl.clientWidth;
            const height = viewportEl.clientHeight;
            if (width <= 0 || height <= 0) return;
            if (width !== pageWidth || height !== pageHeight) {
                pageWidth = width;
                pageHeight = height;
                viewportEl.style.setProperty("--web-page-width", `${width}px`);
                viewportEl.style.setProperty("--web-page-height", `${height}px`);
                flowEl.style.height = `${height}px`;
                clearOversized(previous);
            }
            markOversized(flowEl, height, previous);
            const count = Math.max(1, Math.ceil(flowEl.scrollWidth / width - 1e-6));
            if (lastCount.current !== count) {
                lastCount.current = count;
                onPageCountRef.current(count);
            }
        };

        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(measure);
        };

        const resize = new ResizeObserver(schedule);
        resize.observe(viewportEl);

        const mutations = new MutationObserver(schedule);
        mutations.observe(flowEl, { childList: true, subtree: true, characterData: true });

        const images = [...flowEl.querySelectorAll("img")];
        for (const img of images) {
            img.addEventListener("load", schedule);
            img.addEventListener("error", schedule);
        }

        const fonts = document.fonts;
        const onFonts = () => schedule();
        fonts?.addEventListener("loadingdone", onFonts);
        void fonts?.ready.then(() => { if (!cancelled) schedule(); });

        const onFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !flowEl.contains(target)) return;
            const width = viewportEl.clientWidth;
            if (width <= 0) return;
            const delta = Math.floor((target.getBoundingClientRect().left - viewportEl.getBoundingClientRect().left + 0.5) / width);
            if (delta !== 0) onPageIndexRef.current(Math.max(0, pageIndexRef.current + delta));
        };
        flowEl.addEventListener("focusin", onFocusIn);

        schedule();

        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            resize.disconnect();
            mutations.disconnect();
            for (const img of images) {
                img.removeEventListener("load", schedule);
                img.removeEventListener("error", schedule);
            }
            fonts?.removeEventListener("loadingdone", onFonts);
            flowEl.removeEventListener("focusin", onFocusIn);
            clearOversized(previous);
            viewportEl.style.removeProperty("--web-page-width");
            viewportEl.style.removeProperty("--web-page-height");
            flowEl.style.removeProperty("height");
        };
    }, [active, documentKey]);

    const inert = css.inert;
    return (
        <div className={active ? css.frame : inert} data-web-pages data-web-pages-on={active ? "true" : "false"}>
            <div ref={viewport} className={active ? css.viewport : inert} data-web-page-viewport={active ? "" : undefined}>
                <div
                    className={active ? css.shift : inert}
                    style={active ? { transform: `translateX(calc(-${pageIndex} * var(--web-page-width, 100%)))` } : undefined}
                >
                    <div ref={flow} className={active ? css.flow : inert}>
                        <div className={active ? `${paperClassName} ${css.paperHost}` : paperClassName}>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

