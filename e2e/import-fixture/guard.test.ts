import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HARNESS_ROUTE, refusal } from "./prepare.mjs";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return name === HARNESS_ROUTE ? [] : sources(full);
        return /\.(ts|tsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
}

describe("website-import fixture harness", () => {
    it("is not part of the application: nothing under src/app uses test fixtures or names the harness", () => {
        for (const file of sources(path.join(root, "src/app"))) {
            const text = readFileSync(file, "utf8");
            expect(text, file).not.toContain("__fixtures__");
            expect(text, file).not.toContain(HARNESS_ROUTE);
            expect(text, file).not.toContain("CONSTRUCTA_IMPORT_FIXTURE");
        }
    });

    it("is kept out of Git where it is copied to, and is not tracked there", () => {
        expect(read(".gitignore")).toContain(`/src/app/${HARNESS_ROUTE}/`);
        const tracked = execFileSync("git", ["ls-files", `src/app/${HARNESS_ROUTE}`], { cwd: root, encoding: "utf8" });
        expect(tracked.trim()).toBe("");
    });

    it("refuses to work unless explicitly switched on, at every entry point", () => {
        for (const file of ["page.tsx", "actions.ts", "state/route.ts", "interview/page.tsx", "interview/actions.ts", "interview/state/route.ts", "case-study/page.tsx", "case-study/actions.ts", "case-study/state/route.ts", "profile/page.tsx", "profile/actions.ts", "profile/state/route.ts", "case-library/actions.ts", "case-library/[run]/page.tsx", "case-library/[run]/study/[id]/page.tsx", "case-library/[run]/study/[id]/guided/page.tsx", "case-library/[run]/review/page.tsx", "case-library/[run]/state/route.ts"]) {
            expect(read(`e2e/import-fixture/app/${file}`), file).toContain('process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1"');
        }
        const actions = read("e2e/import-fixture/app/actions.ts");
        const exported = Array.from(actions.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n\s+(\w+)\(\);/g));
        expect(exported.map((match) => match[1]).sort()).toEqual(["fixtureApply", "fixtureDraft", "fixturePreview", "fixtureState"]);
        expect(exported.every((match) => match[2] === "guard")).toBe(true);

        const interview = read("e2e/import-fixture/app/interview/actions.ts");
        const interviewExports = Array.from(interview.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n\s+(\w+)\(\);/g));
        expect(interviewExports.map((match) => match[1]).sort()).toEqual(["fixtureAiOffered", "fixtureApprove", "fixtureBuild", "fixtureControl", "fixtureInterview", "fixtureReword", "fixtureSave"]);
        expect(interviewExports.every((match) => match[2] === "guard")).toBe(true);
        expect(Array.from(interview.matchAll(/export async function/g))).toHaveLength(7);
        const caseStudy = read("e2e/import-fixture/app/case-study/actions.ts");
        const caseStudyExports = Array.from(caseStudy.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n\s+(\w+)\(\);/g));
        expect(caseStudyExports.map((match) => match[1]).sort()).toEqual(["fixtureCaseStudies", "fixtureCaseStudyControl", "fixtureEnhance", "fixtureSaveCaseStudies"]);
        expect(caseStudyExports.every((match) => match[2] === "guard")).toBe(true);
        expect(Array.from(caseStudy.matchAll(/export async function/g))).toHaveLength(4);
        // The case-study harness uses a canned generator and an in-memory budget, and can show the feature switched off as shipped.
        expect(caseStudy).toContain('cohortRig({ enabled: !run.startsWith("off-") })');
        expect(caseStudy).not.toMatch(/createAdminClient|@\/lib\/supabase|from ["']openai["']/);

        const profile = read("e2e/import-fixture/app/profile/actions.ts");
        const profileExports = Array.from(profile.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n\s+(\w+)\(\);/g));
        expect(profileExports.map((match) => match[1]).sort()).toEqual(["fixtureProfile", "fixtureProfileControl", "fixtureSaveProfile"]);
        expect(profileExports.every((match) => match[2] === "guard")).toBe(true);
        expect(Array.from(profile.matchAll(/export async function/g))).toHaveLength(3);
        // The profile harness saves through the application's own payload builder, to memory only.
        expect(profile).toContain("profileUpdateFromForm(String(state.row.id), formData)");
        expect(profile).not.toMatch(/createAdminClient|@\/lib\/supabase|from ["']openai["']/);

        const library = read("e2e/import-fixture/app/case-library/actions.ts");
        const libraryExports = Array.from(library.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n\s+(\w+)\(\);/g));
        expect(libraryExports.map((match) => match[1]).sort()).toEqual([
            "fixtureApprove", "fixtureArchiveDiscipline", "fixtureArchiveStudy", "fixtureCheck", "fixtureCreate", "fixtureLibrary", "fixtureLibraryControl", "fixturePublish",
            "fixtureReview", "fixtureSave", "fixtureSaveDiscipline", "fixtureSaveDraft", "fixtureStartFromOlder", "fixtureStudy",
        ]);
        expect(libraryExports.every((match) => match[2] === "guard")).toBe(true);
        expect(Array.from(library.matchAll(/export async function/g))).toHaveLength(14);
        // The library harness runs the real service over an in-memory library. It has no database, sign-in or privileged client, and says it is not hosted proof.
        expect(library).toContain("fakeLibrary(");
        expect(library).toContain("NOT evidence of an authenticated");
        expect(library).not.toMatch(/createAdminClient|@\/lib\/supabase|requireAuth|from ["']openai["']/);

        // AI wording is off in the harness unless a run asks for it by name; the harness cannot change the application's setting.
        expect(interview).toContain('wordingRig({ enabled: run.startsWith("ai-") })');
    });

    it("will not be installed on a deployment, or anywhere a database or provider is configured", () => {
        expect(refusal({})).toMatch(/CONSTRUCTA_IMPORT_FIXTURE/);
        expect(refusal({ CONSTRUCTA_IMPORT_FIXTURE: "1" })).toBeNull();
        for (const name of ["VERCEL", "VERCEL_ENV", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "RESEND_API_KEY"]) {
            expect(refusal({ CONSTRUCTA_IMPORT_FIXTURE: "1", [name]: "x" }), name).toContain(name);
        }
    });

    it("the install script itself exits without copying when refused", () => {
        let status = 0;
        try {
            execFileSync("node", ["e2e/import-fixture/prepare.mjs"], { cwd: root, env: { PATH: process.env.PATH ?? "", VERCEL: "1", CONSTRUCTA_IMPORT_FIXTURE: "1" } as unknown as NodeJS.ProcessEnv, stdio: "pipe" });
        } catch (error) {
            status = (error as { status?: number }).status ?? -1;
        }
        expect(status).toBe(2);
        expect(existsSync(path.join(root, "src/app", HARNESS_ROUTE))).toBe(false);
    });
});
