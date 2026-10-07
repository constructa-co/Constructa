import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import FirstProjectStart from "./first-project-start";
import { buildPhoneNav } from "@/lib/phone-nav";

const SRC = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(SRC, file), "utf8");

describe("FirstProjectStart", () => {
    const html = renderToStaticMarkup(createElement(FirstProjectStart, { companyName: "Smith Brickwork" }));

    it("offers exactly one action, and it goes to New Project", () => {
        const links = html.match(/<a [^>]*href="[^"]*"/g) ?? [];
        expect(links).toHaveLength(1);
        expect(links[0]).toContain('href="/dashboard/projects/new"');
        expect(html).toContain("Add your first job");
    });

    it("explains the four-step journey in plain language", () => {
        for (const title of ["Add the job", "Confirm the brief", "Build the price", "Review the proposal"]) {
            expect(html).toContain(title);
        }
    });

    it("shows no KPI, template or Quick Quote content", () => {
        for (const word of ["Quick Quote", "quick-quote", "template", "Pipeline Value", "Win Rate"]) {
            expect(html).not.toContain(word);
        }
    });

    it("greets without a name when none is saved", () => {
        const anonymous = renderToStaticMarkup(createElement(FirstProjectStart, { companyName: null }));
        expect(anonymous).toContain(">Welcome<");
    });
});

describe("project entry points", () => {
    it("no longer link to Quick Quote from Home, Pipeline or the sidebar", () => {
        for (const file of [
            "app/dashboard/home/home-client.tsx",
            "app/dashboard/dashboard-client.tsx",
            "components/sidebar-nav.tsx",
            "components/first-project-start.tsx",
            "app/onboarding/onboarding-client.tsx",
        ]) {
            const source = read(file);
            expect(source, file).not.toContain("quick-quote");
            expect(source, file).not.toContain("Quick Quote");
        }
    });

    it("keep New Project as the only creation link in the phone menu", () => {
        const items = buildPhoneNav(null, "cohort").flatMap((group) => group.items);
        expect(items.some((item) => item.path.includes("quick-quote"))).toBe(false);
        expect(items.filter((item) => item.key === "new-project").map((item) => item.path)).toEqual(["/dashboard/projects/new"]);
    });

    it("Home and Pipeline both switch to the first-project state through the shared rule", () => {
        for (const file of ["app/dashboard/home/home-client.tsx", "app/dashboard/dashboard-client.tsx"]) {
            const source = read(file);
            expect(source, file).toContain('getHomePresentation(projects.length) === "first-project"');
            expect(source, file).toContain("<FirstProjectStart");
        }
    });
});
