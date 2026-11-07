import { Fragment, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A036: an optional challenge and how it was resolved. On both editors it is
// typed into two boxes and added, only by an explicit press, to the end of the
// one existing "what we delivered" text, in the contractor's words. The real
// editors are driven through their real inputs and real saves over stand-ins
// for storage; what is stored is read back into the editors and into what a
// proposal carries. No new stored field or key. Synthetic data only.
type Instance = { slots: unknown[]; cursor: number };

const hook = vi.hoisted(() => ({
    instances: new Map<string, { slots: unknown[]; cursor: number }>(),
    current: null as { slots: unknown[]; cursor: number } | null,
}));
const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), guard: vi.fn(), upload: vi.fn() }));

vi.mock("react", async original => {
    const slot = (initial: () => unknown) => {
        const instance = hook.current!;
        const index = instance.cursor++;
        if (!(index in instance.slots)) instance.slots[index] = initial();
        return { instance, index };
    };
    return {
        ...await original<typeof import("react")>(),
        useState: (initial: unknown) => {
            const { instance, index } = slot(() => (typeof initial === "function" ? (initial as () => unknown)() : initial));
            return [instance.slots[index], (next: unknown) => {
                instance.slots[index] = typeof next === "function" ? (next as (value: unknown) => unknown)(instance.slots[index]) : next;
            }];
        },
        useReducer: (reducer: (state: unknown, action: unknown) => unknown, argument: unknown, init: (value: unknown) => unknown) => {
            const { instance, index } = slot(() => init(argument));
            return [instance.slots[index], (action: unknown) => { instance.slots[index] = reducer(instance.slots[index], action); }];
        },
        useRef: (initial: unknown) => {
            const { instance, index } = slot(() => ({ current: initial }));
            return instance.slots[index];
        },
        useId: () => "story-test",
        // Effects run as each component renders. Node has no window or document, so an effect that
        // reaches for them (focus, the browser's leave warning) stops there; nothing else is skipped.
        useEffect: (run: () => unknown) => {
            try { run(); } catch (error) { if (!(error instanceof ReferenceError)) throw error; }
        },
    };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("a save must never make the privileged client"); } }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: mocks.guard }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: mocks.upload }));
vi.mock("./library-actions", () => ({
    approveCaseStudyAction: vi.fn(), archiveCaseStudyAction: vi.fn(), archiveDisciplineAction: vi.fn(), checkCaseStudyAction: vi.fn(),
    createCaseStudyAction: vi.fn(), saveCaseStudyAction: vi.fn(), saveDisciplineAction: vi.fn(), startFromOlderCaseStudyAction: vi.fn(),
}));

import { fakeLibrary } from "@/lib/case-library/__fixtures__/fake-library";
import { newDraft, type CaseStudyContent } from "@/lib/case-library/content";
import { libraryTick, resolveSelectedCaseStudies } from "@/lib/case-library/resolve";
import { approveStudy, createStudy, loadForApproval, saveDiscipline, saveStudy, viewOf, type LibraryContext, type StudyView } from "@/lib/case-library/service";
import { readStudyAtOneRevision } from "@/lib/case-library/store";
import { selectCaseStudies } from "@/lib/proposal-publication";
import CaseStudiesClient from "./case-studies-client";
import CaseStudyEditor, { type EditorServer } from "./library/case-study-editor";

type Host = ReactElement<Record<string, unknown>>;
type Study = Parameters<typeof CaseStudiesClient>[0]["initialCaseStudies"][number];

/** Runs every component in the tree with its own hooks, keyed as React would key it, and returns the plain elements. */
function expand(value: unknown, path: string): Host[] {
    if (Array.isArray(value)) return value.flatMap((entry, index) => expand(entry, `${path}.${index}`));
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Host;
    const type: unknown = element.type;
    if (typeof type === "function") {
        const id = `${path}/${element.key ?? "-"}`;
        const instance: Instance = hook.instances.get(id) ?? { slots: [], cursor: 0 };
        hook.instances.set(id, instance);
        instance.cursor = 0;
        hook.current = instance;
        return expand((type as (props: unknown) => unknown)(element.props), id);
    }
    // Icons and links are objects: they hold nothing this test reads.
    if (typeof type === "object") return [];
    const own = type === Fragment ? [] : [element];
    return [...own, ...expand(element.props.children, path)];
}

const textOf = (element: Host): string => ([element.props.children] as unknown[]).flat(Infinity).filter((part) => typeof part === "string").join("");
const all = (tree: Host[], test: (element: Host) => boolean, what: string) => {
    const found = tree.filter(test);
    if (found.length === 0) throw new Error(`Nothing found: ${what}`);
    return found;
};
const labelled = (tree: Host[], label: string) => all(tree, (element) => element.props["aria-label"] === label, label);
const byId = (tree: Host[], id: string) => all(tree, (element) => element.props.id === id, id)[0];
const buttons = (tree: Host[], text: string) => all(tree, (element) => element.type === "button" && textOf(element) === text, text);
const typeInto = (element: Host, value: string) => (element.props.onChange as (event: unknown) => void)({ target: { value } });
const press = (element: Host) => (element.props.onClick as () => unknown)();
const marked = (tree: Host[], attribute: string) => tree.some((element) => attribute in element.props);
const notices = (tree: Host[]) => tree.filter((element) => "data-challenge-notice" in element.props).map(textOf);
const held = <T,>(test: (slot: Record<string, unknown>) => boolean) =>
    [...hook.instances.values()].flatMap((instance) => instance.slots).find((slot) => typeof slot === "object" && slot !== null && test(slot as Record<string, unknown>)) as T;

const CHALLENGE = "Asbestos found behind the old units.";
const RESOLVED = "Stopped work, had a licensed firm remove it, then carried on.";
const story = (before: string) => `${before}\n\nThe tricky part: ${CHALLENGE}\n\nWhat we did about it: ${RESOLVED}`;
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// The older list: a stand-in for the contractor's own session writing `profiles.case_studies`.
let profile: { case_studies: unknown };
const session = {
    from: (table: string) => ({
        update: (payload: Record<string, unknown>) => {
            const query = {
                eq: () => query,
                select: () => query,
                then: (resolve: (value: unknown) => unknown) => {
                    if (table === "profiles") Object.assign(profile, structuredClone(payload));
                    return Promise.resolve({ data: [{ id: ME }], error: null }).then(resolve);
                },
            };
            return query;
        },
    }),
};
const older = (id: string, projectName: string, extra: Partial<Study> = {}): Study => ({
    id, projectName, projectType: "", contractValue: "", programmeDuration: "", client: "", location: "",
    whatWeDelivered: "", valueAdded: "", photos: ["", "", ""], ...extra,
});
let initial: Study[];
const renderOlder = () => expand(<CaseStudiesClient userId="synthetic" initialCaseStudies={initial} />, "older");
const olderDraft = () => held<{ draft: Study[] }>((slot) => Array.isArray(slot.draft)).draft;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function saveOlder() {
    press(buttons(renderOlder(), "Save all past work")[0]);
    renderOlder();
    await settle();
    renderOlder();
}

// The library: the real service over the in-memory stand-in for its tables.
let db: ReturnType<typeof fakeLibrary>;
let me: LibraryContext;
let view: StudyView;
const server = (): EditorServer => ({
    create: (input) => createStudy(me, input),
    save: (input) => saveStudy(me, input),
    check: (id) => loadForApproval(me, id),
    approve: (input) => approveStudy(me, input),
    addDiscipline: (input) => saveDiscipline(me, input),
});
async function readBack(id: string): Promise<StudyView> {
    const read = await readStudyAtOneRevision(db.reader, ME, id);
    if (read.state !== "ok" || !read.study) throw new Error("could not read");
    return viewOf(read.study, read.disciplines);
}
async function opened(content: CaseStudyContent) {
    const created = await createStudy(me, { content, disciplineIds: [] });
    return { id: created.id!, view: await readBack(created.id!) };
}
const renderLibrary = () => expand(<CaseStudyEditor initial={view} disciplines={[]} listHref="/list" server={server()} />, "library");
const libraryDraft = () => held<{ draft: { content: CaseStudyContent } }>((slot) => "nextToken" in slot && "draft" in slot).draft.content;
const stored = (id: string) => db.studies.find((row) => row.id === id)!;

beforeEach(() => {
    hook.instances.clear();
    hook.current = null;
    for (const mock of [mocks.guard, mocks.upload, mocks.requireAuth]) mock.mockReset();
    mocks.requireAuth.mockImplementation(async () => ({ user: { id: ME }, supabase: session }));
    db = fakeLibrary();
    me = { userId: ME, reader: db.reader, admin: () => db.admin };
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("older case studies: a challenge and how it was resolved", () => {
    it("is added to What We Delivered by the press, saved in that one string, and read back and into a proposal unchanged", async () => {
        const before = "Stripped out; refitted — as agreed (phase 1).";
        initial = [older("a", "Alpha", { whatWeDelivered: before, valueAdded: "Own value, kept." })];
        profile = { case_studies: structuredClone(initial) };
        typeInto(labelled(renderOlder(), "What was the challenge or problem?")[0], CHALLENGE);
        typeInto(labelled(renderOlder(), "How did you resolve it?")[0], RESOLVED);
        let tree = renderOlder();
        // Typed but not added: the text is untouched, the screen says so, and leaving warns.
        expect(olderDraft()[0].whatWeDelivered).toBe(before);
        expect(marked(tree, "data-challenge-unadded")).toBe(true);
        expect(mocks.guard).toHaveBeenLastCalledWith(true, expect.any(String));

        press(buttons(tree, "Add to ‘What We Delivered’")[0]);
        tree = renderOlder();
        expect(olderDraft()[0].whatWeDelivered).toBe(story(before));
        expect(olderDraft()[0].valueAdded).toBe("Own value, kept.");
        expect(labelled(tree, "What We Delivered")[0].props.value).toBe(story(before));
        expect(marked(tree, "data-challenge-unadded")).toBe(false);
        expect(marked(tree, "data-challenge-present")).toBe(true);

        await saveOlder();
        const list = profile.case_studies as Record<string, unknown>[];
        expect(list).toHaveLength(1);
        expect(Object.keys(list[0]).sort()).toEqual(Object.keys(initial[0]).sort());
        expect(list[0]).toEqual({ ...initial[0], whatWeDelivered: story(before) });

        // Read back: the editor opens on the stored words, in the same box.
        hook.instances.clear();
        initial = list as unknown as Study[];
        expect(labelled(renderOlder(), "What We Delivered")[0].props.value).toBe(story(before));
        // A proposal carries exactly that text as what was delivered.
        const [shown] = selectCaseStudies(list, ["a"]);
        expect(shown.delivered).toBe(story(before));
        expect(shown.value_added).toBe("Own value, kept.");
    });

    it("is optional: untouched and blank entries save exactly as stored, with no key added, and nothing is added without a challenge", async () => {
        const odd = "  Older words, kept exactly…\r\nSecond line;  ";
        const legacyEntry = { ...older("b", "Bravo"), legacyExtra: "kept" } as Study;
        initial = [older("a", "Alpha", { whatWeDelivered: odd }), legacyEntry];
        profile = { case_studies: structuredClone(initial) };
        let tree = renderOlder();
        expect(labelled(tree, "What We Delivered").map((element) => element.props.value)).toEqual([odd, ""]);

        press(buttons(tree, "Add to ‘What We Delivered’")[0]);
        tree = renderOlder();
        expect(notices(tree)[0]).toBe("Type the challenge first. Nothing was added.");
        typeInto(labelled(tree, "How did you resolve it?")[1], RESOLVED);
        press(buttons(renderOlder(), "Add to ‘What We Delivered’")[1]);
        tree = renderOlder();
        expect(notices(tree)[1]).toBe("Say what the challenge was first, then how you resolved it. Nothing was added.");
        expect(labelled(tree, "How did you resolve it?")[1].props.value).toBe(RESOLVED);
        expect(olderDraft().map((row) => row.whatWeDelivered)).toEqual([odd, ""]);

        typeInto(labelled(tree, "How did you resolve it?")[1], "");
        typeInto(labelled(renderOlder(), "Value Added")[0], "Changed value.");
        renderOlder();
        expect(mocks.guard).toHaveBeenLastCalledWith(true, expect.any(String));
        await saveOlder();
        const list = profile.case_studies as Record<string, unknown>[];
        expect(list[0]).toEqual({ ...initial[0], valueAdded: "Changed value." });
        expect(list[0].whatWeDelivered).toBe(odd);
        expect(list[1]).toEqual(legacyEntry);
        expect(selectCaseStudies(list, ["b"])[0].delivered).toBeNull();
    });
});

describe("library case studies: a challenge and how it was resolved", () => {
    it("is added to What you did by the press, saved by Save draft, read back, approved and carried into a proposal unchanged", async () => {
        const opening = await opened({ ...newDraft("Kitchen at Example Road"), delivered: "We refitted it.", value_added: "More room." });
        const keys = Object.keys(stored(opening.id).draft).sort();
        view = opening.view;
        typeInto(labelled(renderLibrary(), "What was the challenge or problem?")[0], CHALLENGE);
        typeInto(labelled(renderLibrary(), "How did you resolve it?")[0], RESOLVED);
        let tree = renderLibrary();
        expect(libraryDraft().delivered).toBe("We refitted it.");

        press(buttons(tree, "Add to ‘What you did’")[0]);
        tree = renderLibrary();
        expect(byId(tree, "cs-delivered").props.value).toBe(story("We refitted it."));
        await press(buttons(tree, "Save draft")[0]);
        renderLibrary();
        expect(stored(opening.id).draft.delivered).toBe(story("We refitted it."));
        expect(stored(opening.id).draft.value_added).toBe("More room.");
        expect(Object.keys(stored(opening.id).draft).sort()).toEqual(keys);

        hook.instances.clear();
        view = await readBack(opening.id);
        tree = renderLibrary();
        expect(byId(tree, "cs-delivered").props.value).toBe(story("We refitted it."));
        expect(marked(tree, "data-challenge-present")).toBe(true);

        const check = await loadForApproval(me, opening.id);
        if (check.status !== "ok") throw new Error("could not check");
        expect((await approveStudy(me, { id: opening.id, revision: check.check.study.revision, confirmed: true, shown: check.check.wouldApprove })).status).toBe("approved");
        const read = await db.reader.forProposal(ME, [opening.id]);
        if (read.state !== "ok") throw new Error("could not read for a proposal");
        const resolution = resolveSelectedCaseStudies({ userId: ME, olderStored: [], libraryRows: read.value.rows, selected: [libraryTick(opening.id)] });
        expect(resolution.sendable).toBe(true);
        expect(resolution.studies[0].delivered).toBe(story("We refitted it."));
        expect(resolution.studies[0].value_added).toBe("More room.");
    });

    it("never cuts or passes the limit, and follows a challenge already in the text", async () => {
        const full = "x".repeat(4990);
        view = (await opened({ ...newDraft("Tight job"), delivered: full })).view;
        typeInto(labelled(renderLibrary(), "What was the challenge or problem?")[0], "Tight access.");
        press(buttons(renderLibrary(), "Add to ‘What you did’")[0]);
        let tree = renderLibrary();
        expect(libraryDraft().delivered).toBe(full);
        expect(notices(tree)[0]).toBe("That would make ‘What you did’ longer than 5,000 characters. Nothing was added or cut.");
        expect(labelled(tree, "What was the challenge or problem?")[0].props.value).toBe("Tight access.");

        hook.instances.clear();
        const guided = "Dug out.\n\nThe tricky part: Wet ground.";
        view = (await opened({ ...newDraft("Footings"), delivered: guided })).view;
        tree = renderLibrary();
        expect(tree.some((element) => element.props["aria-label"] === "What was the challenge or problem?")).toBe(false);
        typeInto(labelled(tree, "How did you resolve it?")[0], "Pumped it and dug deeper.");
        press(buttons(renderLibrary(), "Add to ‘What you did’")[0]);
        renderLibrary();
        expect(libraryDraft().delivered).toBe(`${guided}\n\nWhat we did about it: Pumped it and dug deeper.`);
    });

    it("is optional: typed but not added, the saved text stays as it was and leaving warns", async () => {
        const listen = vi.fn();
        vi.stubGlobal("window", { addEventListener: listen, removeEventListener: vi.fn() });
        const kept = "Kept, exactly; as typed…\nSecond line.";
        const opening = await opened({ ...newDraft("Bathroom"), delivered: kept });
        view = opening.view;
        let tree = renderLibrary();
        expect(listen).not.toHaveBeenCalled();
        typeInto(labelled(tree, "What was the challenge or problem?")[0], CHALLENGE);
        tree = renderLibrary();
        expect(listen).toHaveBeenCalledWith("beforeunload", expect.any(Function));
        expect(libraryDraft().delivered).toBe(kept);
        typeInto(byId(tree, "cs-place"), "Leeds");
        tree = renderLibrary();
        await press(buttons(tree, "Save draft")[0]);
        expect(stored(opening.id).draft.delivered).toBe(kept);
        expect(stored(opening.id).draft.value_added).toBe("");
        expect(stored(opening.id).draft.place).toBe("Leeds");
    });
});
