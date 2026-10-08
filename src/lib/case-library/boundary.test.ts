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
        expect(pages.map(rel).sort()).toEqual([
            "app/dashboard/settings/case-studies/library/[id]/guided/page.tsx", "app/dashboard/settings/case-studies/library/[id]/page.tsx",
            "app/dashboard/settings/case-studies/library/new/guided/page.tsx", "app/dashboard/settings/case-studies/library/new/page.tsx",
        ]);
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
        expect(isDashboardPathAllowed("/dashboard/settings/case-studies/library/new/guided", "cohort")).toBe(true);
        expect(isDashboardPathAllowed("/dashboard/settings/case-studies/library/00000000-0000-4000-8000-000000000001/guided", "cohort")).toBe(true);
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

    it("anything that relies on a case study's revision reads it at one revision, never side by side", () => {
        const service = code(path.join(SRC, "lib/case-library/service.ts"));
        // The one place the service reads a case study for comparison or display.
        expect(service.match(/readStudyAtOneRevision\(/g)).toHaveLength(1);
        expect(service).not.toMatch(/reader\.study\(/);
        expect(service).not.toMatch(/Promise\.all\(\[[^\]]*reader\.(study|disciplines)/);
        // The edit page starts the editor from the same kind of read.
        for (const route of ["[id]/page.tsx", "[id]/guided/page.tsx"]) {
            const page = code(path.join(SRC, "app/dashboard/settings/case-studies/library", route));
            expect(page, route).toContain("readStudyAtOneRevision(sessionReader(supabase), user.id, id)");
            expect(page, route).not.toMatch(/reader\.study\(|\.study\(user\.id/);
        }
        // In the bracket itself: revision, then the rest, then revision again, each awaited before the next begins.
        const store = code(path.join(SRC, "lib/case-library/store.ts"));
        const bracket = store.slice(store.indexOf("export async function readStudyAtOneRevision"));
        const first = bracket.indexOf("const before = await reader.revision(");
        const middle = bracket.indexOf("await Promise.all([reader.study(userId, id), reader.disciplines(userId)])");
        const last = bracket.indexOf("const after = await reader.revision(");
        expect(first).toBeGreaterThan(0);
        expect(middle).toBeGreaterThan(first);
        expect(last).toBeGreaterThan(middle);
        expect(bracket).toContain("for (let attempt = 0; attempt < COHERENT_READ_ATTEMPTS; attempt += 1)");
    });

    it("an approval must send back what was shown, and the action passes it through", () => {
        const service = code(path.join(SRC, "lib/case-library/service.ts"));
        const approve = service.slice(service.indexOf("export async function approveStudy"), service.indexOf("export async function archiveStudy"));
        // Read and compared before the database is asked.
        expect(approve.indexOf("sameApprovedCopy(approvedValue(saved.content, labels), shown)")).toBeGreaterThan(0);
        expect(approve.indexOf("sameApprovedCopy(approvedValue(saved.content, labels), shown)")).toBeLessThan(approve.indexOf('"case_study_approve"'));
        const editor = code(path.join(SRC, "app/dashboard/settings/case-studies/library/case-study-editor.tsx"));
        expect(editor).toContain("shown: check.wouldApprove");
    });

    it("the older editor and its save stay separate from the library, and its save is still one write of the whole list to the contractor's own profile", () => {
        const folder = "app/dashboard/settings/case-studies";
        const client = readFileSync(path.join(SRC, folder, "case-studies-client.tsx"), "utf8");
        const actions = readFileSync(path.join(SRC, folder, "actions.ts"), "utf8");
        const rules = readFileSync(path.join(SRC, folder, "save-state.ts"), "utf8");
        // Separation, as before: nothing of the older editor reaches the library, in either direction of this folder.
        for (const text of [client, actions, rules]) expect(text).not.toMatch(/case-library|library-actions/);
        // The save is still the same single write, with the contractor's own session: the whole list, one column, their own row.
        // It now also asks for the changed row's id back. It has gained no condition on what it replaces.
        const save = code(path.join(SRC, folder, "actions.ts"));
        const body = save.slice(save.indexOf("export async function saveCaseStudiesAction"), save.indexOf("export async function enhanceCaseStudyAction"));
        expect(body).toContain(".update({ case_studies: caseStudies })");
        expect(body).toContain('.eq("id", user.id)');
        expect(body).toContain('.select("id")');
        expect(body.match(/\.from\(/g)).toHaveLength(1);
        expect(body.match(/\.eq\(/g)).toHaveLength(1);
        expect(body).not.toMatch(/createAdminClient|\.rpc\(|\.insert\(|\.upsert\(|\.delete\(|\.single\(|\.maybeSingle\(/);
        // The editor sends only the copy its rules recorded, through the injected save (the real action by default).
        expect(client).toContain("save = saveCaseStudiesAction");
        expect(client.match(/await save\(request\.sent\)/g)).toHaveLength(1);
        expect(client.match(/saveCaseStudiesAction/g)).toHaveLength(2);
        // Its rules are pure: no database, network, storage or framework.
        expect(code(path.join(SRC, folder, "save-state.ts"))).not.toMatch(/supabase|fetch\(|process\.env|"use server"|"use client"|localStorage|sessionStorage|from "react"|from "next/);
    });
});

describe("the guided questions", () => {
    const screen = code(path.join(SRC, "app/dashboard/settings/case-studies/library/guided-capture.tsx"));
    const rules = ["guided.ts", "guided-state.ts"].map((name) => code(path.join(SRC, LIB, name)));

    it("can add a case study, save it and add a kind of work, and nothing else: no approval, archive, older-version or proposal action", () => {
        const imported = Array.from(screen.matchAll(/import \{([^}]*)\} from "\.\.\/library-actions"/g)).flatMap((match) => match[1].split(",").map((name) => name.trim()).filter(Boolean));
        expect(imported.sort()).toEqual(["createCaseStudyAction", "saveCaseStudyAction", "saveDisciplineAction"]);
        expect(screen.match(/library-actions/g)).toHaveLength(1);
        for (const text of [screen, ...rules]) {
            expect(text).not.toMatch(/approveCaseStudyAction|checkCaseStudyAction|archiveCaseStudyAction|archiveDisciplineAction|startFromOlder|approveStudy|loadForApproval|archiveStudy/);
            expect(text).not.toMatch(/selected_case_study_ids|caseStudyIds|proposal-review|proposal-publication/);
            expect(text).not.toMatch(/createAdminClient|supabase|\.rpc\(|fetch\(|process\.env|"use server"/);
        }
        const server = screen.slice(screen.indexOf("export interface GuidedServer"), screen.indexOf("const realServer"));
        expect(Array.from(server.matchAll(/^\s+(\w+):/gm)).map((match) => match[1])).toEqual(["create", "save", "addDiscipline"]);
    });

    it("keep nothing in the browser between visits, and reach no model or provider", () => {
        for (const text of [screen, ...rules]) {
            expect(text).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
            expect(text).not.toMatch(/cohort-ai|company-interview|ai-budget|@\/lib\/ai|openai/i);
        }
    });

    it("do no joining, splitting or inferring of text: an answer is a draft field, as typed", () => {
        for (const text of rules) {
            expect(text).not.toMatch(/\.split\(|\.replace\(|\.slice\(|\.normalize\(|lead-?in|The tricky part|What we did about it/i);
        }
        // The screen writes a box's value straight into its field.
        expect(screen.match(/content: \{ \[question\.field!\]: event\.target\.value \}/g)).toHaveLength(2);
        expect(screen).not.toMatch(/maxLength/);
        expect(screen).not.toMatch(/\.trim\(\)\s*\}\s*\)/);
    });

    it("use the existing switch and no other, and are behind it on both routes", () => {
        const gate = code(path.join(SRC, LIB, "gate.ts"));
        expect(gate.match(/CONSTRUCTA_[A-Z_]+/g)).toEqual(["CONSTRUCTA_CASE_LIBRARY"]);
        expect(all.filter((file) => /CONSTRUCTA_CASE_LIBRARY_/.test(code(file)))).toEqual([]);
    });

    it("the screen itself leaves only through the one check, and takes no input once it is going", () => {
        // One place navigates after a save, and it asks the rules first.
        expect(screen).toContain("const leaveNow = mayLeave(state) ? state.leave : null;");
        expect(screen).not.toMatch(/if \(state\.leave\) router\.push/);
        const effect = screen.slice(screen.indexOf("const leaveNow"), screen.indexOf("const leavePanel"));
        expect(effect).toContain("if (!leaveNow || going.current) return;");
        expect(effect.match(/router\.push\(/g)).toHaveLength(1);
        // The only other navigation is the contractor's own explicit "go without saving".
        expect(screen.match(/router\.push\(/g)).toHaveLength(2);
        expect(screen).toContain(">Go without saving</button>");
        expect(screen).toContain("inert={state.leave !== null}");
        const rules = code(path.join(SRC, LIB, "guided-state.ts"));
        // A confirmed save moves on, or leaves, only from the one line that has first found nothing unsaved.
        // and, for leaving, no note waiting; for moving on, no note typed while the save ran.
        expect(rules).toContain('if (then.kind === "leave") return isDirty(editor) || anyNote(state.notes) ? { ...next, leaveHeld: then.to } : { ...next, leave: then.to };');
        expect(rules).toContain("return isDirty(editor) || !sameNotes(notesAtStart, state.notes) ? { ...next, moveHeld: true } : { ...next, screen: then };");
        const reply = rules.slice(rules.indexOf('case "save/reply"'), rules.indexOf('case "leave/stay"'));
        expect(reply.match(/screen: then/g)).toHaveLength(1);
        expect(reply.match(/leave: then\.to/g)).toHaveLength(1);
        expect(rules).toContain("if (state.leave !== null) return state;");
        // Everywhere "leave" can be set, a note has already been ruled out: the reply above, and the start of a save.
        const start = rules.slice(rules.indexOf("export function planSave"), rules.indexOf("const CONFIRMED"));
        expect(start.indexOf('if (then?.kind === "leave" && anyNote(state.notes)) return { plan: null')).toBeGreaterThan(0);
        expect(start.indexOf('if (then?.kind === "leave" && anyNote(state.notes))')).toBeLessThan(start.indexOf('refusal: "nothing"'));
        expect(rules.match(/leave: (action\.)?then\.to/g)).toHaveLength(2);
        expect(rules).toContain("return state.leave !== null && !unsavedOrUnapplied(state) && state.editor.saving === null;");
    });

    it("the screen plans no save of its own: it sends only the save the rules started, as the state records it", () => {
        expect(screen).not.toMatch(/planSave/);
        expect(screen).toContain('const save = (then: AfterSave, again = false) => dispatch({ type: "save/start", then, again });');
        expect(screen.match(/requestOf\(state\)/g)).toHaveLength(1);
        expect(screen).toContain("if (!request || sentToken.current === request.token) return;");
        // The only calls to the server's save and create are inside that one place, with the request's own contents.
        expect(screen.match(/server\.save\(/g)).toHaveLength(1);
        expect(screen.match(/server\.create\(/g)).toHaveLength(1);
        expect(screen).toContain("server.save({ id: request.id, revision: request.revision, content: request.content, disciplineIds: request.disciplineIds })");
        expect(screen).toContain("server.create({ content: request.content, disciplineIds: request.disciplineIds })");
        // A request is built from what the rules recorded as sent. Notes are not in it.
        const rules = code(path.join(SRC, LIB, "guided-state.ts"));
        const request = rules.slice(rules.indexOf("export function requestOf"), rules.indexOf("export function guidedReducer"));
        expect(request).toContain("content: saving.sent.content, disciplineIds: saving.sent.disciplineIds");
        expect(request).not.toMatch(/notes/);
    });

    it("the depth questions add words and nothing else: no parser, no pattern over text, no rewriting, no model", () => {
        const depth = code(path.join(SRC, LIB, "guided-depth.ts"));
        expect(depth).not.toMatch(/RegExp|\.split\(|\.replace\(|\.replaceAll\(|\.normalize\(|\.slice\(|\.substring\(|\.match\(|\.toLowerCase\(|\.toUpperCase\(/);
        expect(depth).not.toMatch(/\/[^/\n]+\/[gimsuy]*\.test\(/);
        expect(depth).not.toMatch(/supabase|fetch\(|process\.env|"use server"|localStorage|sessionStorage|cohort-ai|company-interview|ai-budget|openai/i);
        // The only use of trim is to ask whether a note is nothing but white space. Nothing trimmed is ever kept.
        expect(depth.match(/\.trim\(\)/g)).toHaveLength(1);
        expect(depth).toContain('if (note.trim() === "") return "nothing";');
        expect(depth).toContain("return text + separator(text) + LEAD_IN[key] + note;");
        // A note changes in the rules in exactly three ways: typed, cleared by typing nothing, emptied by its own Add.
        const rules = code(path.join(SRC, LIB, "guided-state.ts"));
        expect(rules.match(/notes: \{ \.\.\.state\.notes, \[action\.key\]:/g)).toHaveLength(2);
        expect(rules.match(/notes:/g)!.length).toBe(rules.match(/notes: \{ \.\.\.state\.notes, \[action\.key\]:/g)!.length + rules.match(/notes: \{ \.\.\.(NO_NOTES|state\.notes) \}/g)!.length + rules.match(/notes: Notes/g)!.length);
        // The screen types a note in exactly as it is.
        expect(screen).toContain('dispatch({ type: "note/type", key: depthKey, text: event.target.value })');
    });

    it("warn before leaving by reload, by any link, and by the browser's Back button", () => {
        // Both guards are given the one combined fact: something unsaved, or a note not yet added.
        expect(screen).toContain("const guard = dirty || unapplied;");
        expect(screen).toContain("useUnsavedGuard(guard, GUIDED_MESSAGES.leaveConfirm)");
        expect(screen).toContain("useBackGuard(guard)");
        expect(screen).toContain("(guard || saving");
        expect(screen).toContain('window.addEventListener("popstate", onBack)');
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
