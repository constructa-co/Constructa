import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    CORE_ROUTE_BOTTOM_PADDING_CLASS,
    CORE_ROUTE_HORIZONTAL_PADDING_CLASS,
    CORE_ROUTE_MAX_WIDTH_CLASS,
    CORE_ROUTE_TOP_PADDING_CLASS,
    corePipelineWorkspaceInsetClassName,
    coreRouteShellClassName,
} from "./dashboard-route-geometry";

const SRC = path.resolve(import.meta.dirname, "..");

describe("dashboard route geometry", () => {
    it("uses one wide desktop column for cohort workflow pages", () => {
        const shell = coreRouteShellClassName();
        expect(shell).toContain(CORE_ROUTE_MAX_WIDTH_CLASS);
        expect(shell).toContain("1600px");
        expect(shell).not.toContain("max-w-5xl");
    });

    it("shares horizontal and top inset between pipeline and workflow routes", () => {
        const inset = corePipelineWorkspaceInsetClassName();
        expect(inset).toContain(CORE_ROUTE_HORIZONTAL_PADDING_CLASS);
        expect(inset).toContain(CORE_ROUTE_TOP_PADDING_CLASS);
        expect(coreRouteShellClassName()).toContain(CORE_ROUTE_HORIZONTAL_PADDING_CLASS);
        expect(coreRouteShellClassName()).toContain(CORE_ROUTE_TOP_PADDING_CLASS);
        expect(coreRouteShellClassName()).toContain(CORE_ROUTE_BOTTOM_PADDING_CLASS);
    });

    it("wires the four cohort workflow pages through DashboardRouteShell", () => {
        for (const file of [
            "app/dashboard/projects/brief/page.tsx",
            "app/dashboard/projects/costs/page.tsx",
            "app/dashboard/projects/schedule/page.tsx",
            "app/dashboard/projects/proposal/page.tsx",
        ]) {
            const source = readFileSync(path.join(SRC, file), "utf8");
            expect(source, file).toContain("DashboardRouteShell");
            expect(source, file).not.toMatch(/max-w-5xl/);
        }
    });

    it("leaves empty pipeline and first-project centres on max-w-3xl", () => {
        for (const file of [
            "app/dashboard/dashboard-client.tsx",
            "app/dashboard/home/home-client.tsx",
        ]) {
            const source = readFileSync(path.join(SRC, file), "utf8");
            expect(source, file).toContain("max-w-3xl mx-auto");
            expect(source, file).toContain('getHomePresentation(projects.length) === "first-project"');
        }
    });
});
