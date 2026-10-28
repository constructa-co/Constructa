import { createElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import DashboardRouteShell from "@/components/dashboard-route-shell";
import { dashboardRouteShellBody, dashboardRouteShellHeader } from "./dashboard-route-shell-page";

type FixtureShellPage = ReactElement<{
    header: ReactElement<{ "data-test": string }>;
    children: ReactElement<{ "data-test": string }>;
}>;

describe("dashboard route shell page fixture", () => {
    it("reads header and body from the actual shell composition", () => {
        const page = createElement(
            DashboardRouteShell,
            {
                header: createElement("nav", { "data-test": "header" }),
                children: createElement("main", { "data-test": "editor" }, "Body"),
            },
        ) as FixtureShellPage;
        expect(dashboardRouteShellHeader(page).props["data-test"]).toBe("header");
        expect(dashboardRouteShellBody(page).props["data-test"]).toBe("editor");
    });
});
