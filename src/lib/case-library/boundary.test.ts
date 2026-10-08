import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CASE_LIBRARY_VARIABLE, caseLibraryEnabled } from "./gate";
import { buildCompanyReadiness } from "@/lib/company-readiness";
import { isDashboardPathAllowed } from "@/lib/launch-profile";

/**
 * Where the case-study library is allowed to be reached from. The foundation
 * used to be unreachable because nothing called it. It is now wired, so what
 * keeps it contained is checked here instead.
 */
const SRC = path.resolve(import.meta.dirname, "../..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "node_modules" ? [] : files(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
});
const code = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const rel = (file: string) => file.slice(SRC.length + 1);
const all = files(SRC).filter((file) => !/\.test\.tsx?$/.test(file) && !file.includes("__fixtures__"));
const LIB = "lib/case-library/";

describe("the switch", () => {
    it("is on only for exactly '1'", () => {
        expect(caseLibraryEnabled({})).toBe(false);
        for (const value of ["", "0", "true", "TRUE", "on", "yes", " 1", "1 ", "01"]) expect(caseLibraryEnabled({ [CASE_LIBRARY_VARIABLE]: value }), JSON.stringify(value)).toBe(false);
        expect(caseLibraryEnabled({ [CASE_LIBRARY_VARIABLE]: "1" })).toBe(true);
    });

    it("is read in one place, on the server, and is never sent to the browser", () => {
        const readers = all.filter((file) => code(file).includes(CASE_LIBRARY_VARIABLE)).map(rel);
        expect(readers).toEqual(["lib/case-library/gate.ts"]);
        for (const file of all) expect(code(file), rel(file)).not.toContain(`NEXT_PUBLIC_${CASE_LIBRARY_VARIABLE.replace("CONSTRUCTA_", "")}`);
        // Nothing marked for the browser asks whether it is on.
        for (const file of all.filter((entry) => /^\s*["']use client["']/.test(readFileSync(entry, "utf8")))) expect(code(file), rel(file)).not.toContain("caseLibraryEnabled");
    });
});

describe("new pages", () => {
    const pages = all.filter((file) => rel(file).startsWith("app/dashboard/settings/case-studies/library/") && file.endsWith("page.tsx"));

    it("check who is signed in, then the switch, before reading anything", () => {
        expect(pages.map(rel).sort()).toEqual(["app/dashboard/settings/case-studies/library/[id]/page.tsx", "app/dashboard/settings/case-studies/library/new/page.tsx"]);
        for (const page of pages) {
            const text = code(page);
            const auth = text.indexOf('if (!user) redirect("/login")');
            const gate = text.indexOf("if (!caseLibraryEnabled()) redirect(CASE_STUDIES_PATH)");
            const read = text.indexOf("sessionReader(");
            expect(auth, rel(page)).toBeGreaterThan(0);
            expect(gate, rel(page)).toBeGreaterThan(auth);
            expect(read, rel(page)).toBeGreaterThan(gate);
            expect(text, rel(page)).not.toMatch(/createAdminClient|\.rpc\(/);
        }
    });

    it("sit inside a route the cohort profile already allows, so the switch, not the link, is what closes them", () => {
        expect(isDashboardPathAllowed("/dashboard/settings/case-studies/library/new", "cohort")).toBe(true);
        expect(isDashboardPathAllowed("/dashboard/settings/case-studies/library/00000000-0000-4000-8000-000000000001", "cohort")).toBe(true);
    });

    it("the existing pages read the library only behind the switch, with the contractor's own session", () => {
        for (const page of ["app/dashboard/settings/case-studies/page.tsx", "app/dashboard/projects/proposal/page.tsx", "app/dashboard/settings/profile/readiness/page.tsx"]) {
            const text = code(path.join(SRC, page));
            expect(text, page).toMatch(/caseLibraryEnabled\(\)\s*\?\s*await\s+(sessionReader|readProposalLibrary)/);
            expect(text, page).not.toMatch(/createAdminClient/);
        }
    });
});

describe("writes", () => {
    it("the library's database functions are named in one module, and called only with the session's contractor", () => {
        const namers = all.filter((file) => /case_study_(create|save_draft|set_disciplines|approve|archive)|case_library_discipline_/.test(code(file))).map(rel);
        expect(namers).toEqual(["lib/case-library/service.ts"]);
        const service = code(path.join(SRC, "lib/case-library/service.ts"));
        expect(service.match(/\.rpc\(/g)).toHaveLength(1);
        expect(service).toContain("rpc(name, { p_user_id: context.userId, ...args })");
        expect(service).not.toMatch(/createAdminClient|process\.env/);
    });

    it("only the action file makes the privileged client for the library, and every action goes through the same gate", () => {
        const actions = code(path.join(SRC, "app/dashboard/settings/case-studies/library-actions.ts"));
        const exported = Array.from(actions.matchAll(/export async function (\w+)\(/g)).map((match) => match[1]);
        expect(exported.sort()).toEqual(["approveCaseStudyAction", "archiveCaseStudyAction", "archiveDisciplineAction", "checkCaseStudyAction", "createCaseStudyAction", "saveCaseStudyAction", "saveDisciplineAction", "startFromOlderCaseStudyAction"]);
        for (const body of actions.split(/export async function /).slice(1)) expect(body, body.slice(0, 30)).toMatch(/run\(|libraryContext\(\)/);
        // Sign-in, then the switch, then the context that can make the privileged client.
        const context = actions.slice(actions.indexOf("async function libraryContext"), actions.indexOf("async function run"));
        expect(context.indexOf("requireAuth()")).toBeLessThan(context.indexOf("caseLibraryEnabled()"));
        expect(context.indexOf("caseLibraryEnabled()")).toBeLessThan(context.indexOf("createAdminClient()"));
        // No action takes a contractor's id.
        expect(actions).not.toMatch(/userId\s*:\s*(unknown|string)|user_id/);
        const others = all.filter((file) => rel(file).startsWith(LIB) || rel(file).includes("case-studies/library/") || rel(file).endsWith("library-panel.tsx")).filter((file) => /createAdminClient/.test(code(file))).map(rel);
        expect(others).toEqual([]);
    });

    it("nothing reads the library with a privileged client", () => {
        const store = code(path.join(SRC, "lib/case-library/store.ts"));
        expect(store).not.toMatch(/createAdminClient|\.rpc\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
        for (const file of all.filter((entry) => /from\(\s*["'](case_studies|contractor_disciplines|case_study_disciplines)["']\s*\)/.test(code(entry)))) expect(rel(file)).toBe("lib/case-library/store.ts");
    });

    it("the rules themselves reach no database, network or environment", () => {
        for (const name of ["content", "labels", "legacy", "resolve", "status", "past-jobs", "editor-state", "messages"]) {
            expect(code(path.join(SRC, LIB, `${name}.ts`)), name).not.toMatch(/supabase|createAdminClient|fetch\(|"use server"|process\.env/);
        }
    });

    it("a proposal reads approved copies only: the draft column is never asked for", () => {
        const store = code(path.join(SRC, "lib/case-library/store.ts"));
        const forProposal = store.slice(store.indexOf("forProposal: async"), store.indexOf("counts: async"));
        expect(forProposal).not.toMatch(/\bdraft\b/);
        expect(forProposal).toContain('.not("approved", "is", null)');
        expect(forProposal).toContain('.is("archived_at", null)');
        const counts = store.slice(store.indexOf("counts: async"), store.indexOf("olderEntry: async"));
        expect(counts.match(/head: true/g)).toHaveLength(2);
    });

    it("the older editor and its save are not touched", () => {
        const client = readFileSync(path.join(SRC, "app/dashboard/settings/case-studies/case-studies-client.tsx"), "utf8");
        const actions = readFileSync(path.join(SRC, "app/dashboard/settings/case-studies/actions.ts"), "utf8");
        expect(client).toContain("saveCaseStudiesAction(caseStudies)");
        expect(actions).toContain(".update({ case_studies: caseStudies })");
        expect(client).not.toMatch(/case-library|library-actions/);
        expect(actions).not.toMatch(/case-library/);
    });
});

describe("readiness counts only what can be used", () => {
    const profile = { company_name: "Example", phone: "0113", case_studies: [] };
    const item = (library?: { approved: number; unapproved: number } | null, stored: unknown[] = []) => buildCompanyReadiness({ ...profile, case_studies: stored }, library).items.find((entry) => entry.key === "case-studies")!;

    it("is exactly as before when the library is not in use", () => {
        expect(item(undefined, [{ projectName: "Older" }])).toMatchObject({ status: "ready", detail: "1 case study saved." });
        expect(item(null)).toMatchObject({ status: "todo", detail: "None yet. Add past jobs you are happy to show clients." });
    });

    it("a draft never makes it ready", () => {
        expect(item({ approved: 0, unapproved: 2 })).toMatchObject({ status: "started", detail: "2 case studies are not approved yet. Approve one so proposals can use it." });
        expect(item({ approved: 0, unapproved: 1 }).detail).toBe("1 case study is not approved yet. Approve it so proposals can use it.");
        expect(item({ approved: 0, unapproved: 0 }).status).toBe("todo");
    });

    it("approved library case studies count, with older ones, and drafts are mentioned but not counted", () => {
        expect(item({ approved: 1, unapproved: 1 }, [{ projectName: "Older" }])).toMatchObject({ status: "ready", detail: "2 case studies ready to use. 1 more is not approved yet, so it can't be used." });
        expect(item({ approved: 2, unapproved: 0 }).detail).toBe("2 case studies ready to use.");
    });
});
