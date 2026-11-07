import type { ReactElement } from "react";
import DashboardRouteShell from "@/components/dashboard-route-shell";

type ShellProps = { header?: ReactElement; children: ReactElement };

/** Workflow editor element rendered in DashboardRouteShell's body slot. */
export function dashboardRouteShellBody<P extends ShellProps>(page: ReactElement<P>): P["children"] {
    if (page.type !== DashboardRouteShell) {
        throw new Error(`Expected DashboardRouteShell page root, received ${String(page.type)}`);
    }
    const body = page.props.children;
    if (body == null || typeof body !== "object" || !("type" in body)) {
        throw new Error("DashboardRouteShell must render a single body React element");
    }
    return body;
}

/** Retained header (e.g. ProjectNavBar) passed to DashboardRouteShell. */
export function dashboardRouteShellHeader<P extends ShellProps & { header: ReactElement }>(
    page: ReactElement<P>,
): NonNullable<P["header"]> {
    if (page.type !== DashboardRouteShell) {
        throw new Error(`Expected DashboardRouteShell page root, received ${String(page.type)}`);
    }
    const header = page.props.header;
    if (header == null || typeof header !== "object" || !("type" in header)) {
        throw new Error("DashboardRouteShell must expose a header React element");
    }
    return header;
}
