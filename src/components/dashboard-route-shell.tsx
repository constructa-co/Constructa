import type { ReactNode } from "react";
import { coreRouteShellClassName } from "@/lib/dashboard-route-geometry";
import styles from "./dashboard-route-shell.module.css";

interface Props {
    /** Retained page header (e.g. ProjectNavBar) — divider aligns with route column. */
    header?: ReactNode;
    children: ReactNode;
}

export default function DashboardRouteShell({ header, children }: Props) {
    return (
        <div
            className={`${styles.shell} ${coreRouteShellClassName()}`}
            data-dashboard-route-shell
        >
            {header ? (
                <div className={styles.routeHeader} data-route-header>
                    {header}
                </div>
            ) : null}
            <div className={styles.routeBody} data-route-body>
                {children}
            </div>
        </div>
    );
}
