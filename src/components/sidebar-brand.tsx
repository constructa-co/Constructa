import ui from "./sidebar-brand.module.css";

type SidebarBrandProps = {
    /** Phone top bar: mark only; full wordmark stays in overlay and desktop sidebar. */
    markOnly?: boolean;
    className?: string;
};

export function SidebarBrand({ markOnly = false, className }: SidebarBrandProps) {
    return (
        <span className={[ui.brand, className].filter(Boolean).join(" ")}>
            <span className={ui.brandMark} aria-hidden="true">C</span>
            {!markOnly && <span className={ui.wordmark}>constructa</span>}
        </span>
    );
}
