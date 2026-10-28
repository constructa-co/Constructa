/**
 * Shared horizontal rhythm for dashboard routes inside DashboardShell main.
 * Marketing and empty pipeline states keep their own centred max-w-3xl shells.
 */

/** Pre-construction workflow column — matches wide estimating/programme surfaces. */
export const CORE_ROUTE_MAX_WIDTH_CLASS = "max-w-[1600px]";

export const CORE_ROUTE_HORIZONTAL_PADDING_CLASS = "px-4 sm:px-8";

export const CORE_ROUTE_TOP_PADDING_CLASS = "pt-4 sm:pt-8";

export const CORE_ROUTE_BOTTOM_PADDING_CLASS = "pb-16";

/** Full shell wrapper classes for cohort project workflow pages. */
export function coreRouteShellClassName(): string {
    return [
        "w-full min-w-0 mx-auto",
        CORE_ROUTE_MAX_WIDTH_CLASS,
        CORE_ROUTE_HORIZONTAL_PADDING_CLASS,
        CORE_ROUTE_TOP_PADDING_CLASS,
        CORE_ROUTE_BOTTOM_PADDING_CLASS,
    ].join(" ");
}

/** Operational pipeline (established) shares the same inset as workflow routes. */
export function corePipelineWorkspaceInsetClassName(): string {
    return `${CORE_ROUTE_HORIZONTAL_PADDING_CLASS} ${CORE_ROUTE_TOP_PADDING_CLASS}`;
}
