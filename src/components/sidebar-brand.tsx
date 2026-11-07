import type { Ref } from "react";
import ui from "./sidebar-brand.module.css";

type SidebarBrandProps = {
    /** Phone top bar: mark only; full wordmark stays in overlay and desktop sidebar. */
    markOnly?: boolean;
    className?: string;
    wordmarkRef?: Ref<HTMLSpanElement>;
};

export function SidebarBrand({ markOnly = false, className, wordmarkRef }: SidebarBrandProps) {
    return (
        <span className={[ui.brand, className].filter(Boolean).join(" ")}>
            <span className={ui.brandMark} aria-hidden="true">C</span>
            {!markOnly && <span ref={wordmarkRef} className={ui.wordmark}>constructa</span>}
        </span>
    );
}
