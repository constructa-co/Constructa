import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const PATHS = {
    projectPicker: "src/components/project-picker.tsx",
    postcodeLookup: "src/components/postcode-lookup.tsx",
    installBanner: "src/components/install-banner.tsx",
    offlinePage: "src/app/offline/page.tsx",
    libraryTable: "src/app/dashboard/data/library-table.tsx",
    projectLiveClient: "src/app/dashboard/live/project-live-client.tsx",
    drawingViewer: "src/app/dashboard/projects/drawings/drawing-viewer.tsx",
    supervisorPortal: "src/app/supervisor/[token]/supervisor-portal-client.tsx",
} as const;

function read(rel: string): string {
    return readFileSync(path.join(ROOT, rel), "utf8");
}

function primaryClassNear(source: string, anchor: string): string {
    const idx = source.indexOf(anchor);
    expect(idx, `anchor ${anchor}`).toBeGreaterThan(-1);
    const window = source.slice(Math.max(0, idx - 500), idx + 500);
    const line = window.split("\n").find(l => l.includes("className") && l.includes("corePrimaryButton"));
    expect(line, `corePrimaryButton className near ${anchor}`).toBeTruthy();
    return line!;
}

function classLineNear(source: string, anchor: string): string {
    const idx = source.indexOf(anchor);
    expect(idx, `anchor ${anchor}`).toBeGreaterThan(-1);
    const fromAnchor = source.slice(idx, idx + 600);
    const ahead = fromAnchor.split("\n").find(l => l.includes("className"));
    if (ahead) return ahead;
    const before = source.slice(Math.max(0, idx - 600), idx);
    const behind = [...before.split("\n")].reverse().find(l => l.includes("className"));
    expect(behind, `className near ${anchor}`).toContain("className");
    return behind ?? "";
}

function expectSagePrimaryClassLine(line: string) {
    expect(line).toContain("corePrimaryButton");
    expect(line).toContain("coreFocusVisibleRing");
    expect(line).not.toMatch(/bg-blue-[567]00/);
    expect(line).not.toMatch(/hover:bg-blue-/);
}

describe("A001 workflow standalone controls brand primary (cq-2224)", () => {
    it("project-picker: empty-state New Project CTA + search focus use core palette; status/link blues preserved", () => {
        const source = read(PATHS.projectPicker);
        expect(source).toContain("core-editing-palette");
        const emptyCta = source.split("No projects yet")[1]?.split("No projects match")[0] ?? "";
        expectSagePrimaryClassLine(primaryClassNear(emptyCta, 'href="/dashboard/projects/new"'));
        expect(classLineNear(source, "Search projects or clients")).toContain("coreFocusRing");
        expect(source).toMatch(/text-blue-500 hover:text-blue-400/);
        expect(source).toMatch(/bg-blue-500\/15 text-blue-400/);
    });

    it("postcode-lookup (legacyFind): Find Address + field focus use core palette", () => {
        const source = read(PATHS.postcodeLookup);
        expect(source).toContain("core-editing-palette");
        expectSagePrimaryClassLine(primaryClassNear(source, "onClick={handleLookup}"));
        expect(source).toContain("coreFocusRing");
        expect(source).not.toMatch(/focus:ring-blue-/);
    });

    it("install-banner: Install action uses core primary", () => {
        const source = read(PATHS.installBanner);
        expectSagePrimaryClassLine(primaryClassNear(source, "onClick={handleInstall}"));
        expect(source).not.toMatch(/bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium/);
    });

    it("offline page: Back to Hub uses core primary", () => {
        const source = read(PATHS.offlinePage);
        const hubChunk = source.slice(source.indexOf("Back to Hub") - 250, source.indexOf("Back to Hub") + 40);
        expect(hubChunk).toContain("corePrimaryButton");
        expect(hubChunk).toContain("coreFocusVisibleRing");
        expect(hubChunk).not.toMatch(/bg-blue-600 hover:bg-blue-700/);
    });

    it("library-table: Add Item default button variant uses core primary", () => {
        const source = read(PATHS.libraryTable);
        expect(source).toContain("core-editing-palette");
        const defaultVariant = source.match(/default: `([^`]+)`/)?.[1] ?? "";
        expect(defaultVariant).toContain("corePrimaryButton");
        expect(defaultVariant).not.toMatch(/bg-blue-600/);
    });

    it("project-live-client: Log Cost submit + form fields use core palette; chart/status blues preserved", () => {
        const source = read(PATHS.projectLiveClient);
        expectSagePrimaryClassLine(primaryClassNear(source, "disabled={isPending}"));
        expect(classLineNear(source, 'placeholder="Description"')).toContain("coreFocusRing");
        expect(source).toMatch(/bg-blue-400\/15 text-blue-400/);
        expect(source).toMatch(/color="bg-blue-500"/);
    });

    it("drawing-viewer: estimate modal primaries + annotation/calib focus use core palette; tool/selection blues preserved", () => {
        const source = read(PATHS.drawingViewer);
        expect(source.match(/setAddToEstModal\(true\)[\s\S]{0,160}corePrimaryButton/)?.[0]).toBeTruthy();
        expectSagePrimaryClassLine(primaryClassNear(source, "onClick={confirmCalibration}"));
        expectSagePrimaryClassLine(primaryClassNear(source, "onClick={handleAddToEstimate}"));
        const placeWindow = source.slice(Math.max(0, source.indexOf("Place") - 400), source.indexOf("Place") + 20);
        expect(placeWindow).toContain("corePrimaryButton");
        expect(placeWindow).toContain("coreFocusVisibleRing");
        expect(classLineNear(source, 'placeholder="Type annotation')).toContain("coreFocusRing");
        expect(classLineNear(source, 'placeholder="e.g. 5.0"')).toContain("coreFocusRing");
        expect(source).toMatch(/tool === t \? "bg-blue-600 text-white"/);
        expect(source).toMatch(/text-blue-400 font-mono/);
    });

    it("supervisor portal: Acknowledge primary + name field focus use core palette; icon/link blues preserved", () => {
        const source = read(PATHS.supervisorPortal);
        expectSagePrimaryClassLine(primaryClassNear(source, "disabled={acknowledging === ob.id}"));
        expect(classLineNear(source, "value={ackName}")).toContain("coreFocusRing");
        expect(source).toMatch(/text-blue-400/);
        expect(source).not.toMatch(/focus:ring-blue-/);
    });
});
