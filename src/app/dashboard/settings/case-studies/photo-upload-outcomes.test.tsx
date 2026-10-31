import { Fragment, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A038: what happens to a photo while its upload is on its way. The real editor
// is driven through its real inputs and real save rules; only the upload is a
// controlled promise. No file, storage request, session or database is touched.
type Instance = { slots: unknown[]; cursor: number };

const hook = vi.hoisted(() => {
    const state = {
        instances: new Map<string, { slots: unknown[]; cursor: number }>(),
        current: null as { slots: unknown[]; cursor: number } | null,
    };
    const next = () => {
        const instance = state.current!;
        return { instance, index: instance.cursor++ };
    };
    return { state, next };
});
const actions = vi.hoisted(() => ({ save: vi.fn(), enhance: vi.fn(), upload: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const { instance, index } = hook.next();
        if (!(index in instance.slots)) instance.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [instance.slots[index], (next: unknown) => {
            instance.slots[index] = typeof next === "function" ? (next as (value: unknown) => unknown)(instance.slots[index]) : next;
        }];
    },
    useReducer: (reducer: (state: unknown, action: unknown) => unknown, argument: unknown, init: (value: unknown) => unknown) => {
        const { instance, index } = hook.next();
        if (!(index in instance.slots)) instance.slots[index] = init(argument);
        return [instance.slots[index], (action: unknown) => { instance.slots[index] = reducer(instance.slots[index], action); }];
    },
    useRef: (initial: unknown) => {
        const { instance, index } = hook.next();
        if (!(index in instance.slots)) instance.slots[index] = { current: initial };
        return instance.slots[index];
    },
    useId: () => "photo-test",
    useEffect: () => {},
}));
vi.mock("sonner", () => ({ toast: toasts }));
vi.mock("./actions", () => ({ saveCaseStudiesAction: actions.save, enhanceCaseStudyAction: actions.enhance }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: actions.upload }));

import { CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE } from "@/lib/case-library/content";
import { caseStudyTextEnhanceEnabled } from "@/lib/cohort-ai/case-study-enhance-enabled";
import CaseStudiesClient from "./case-studies-client";
import { statusLine, SAVE_MESSAGES, type SaveState } from "./save-state";

type Study = Parameters<typeof CaseStudiesClient>[0]["initialCaseStudies"][number];
type Host = ReactElement<Record<string, unknown>>;
type UploadReply = { url?: string; error?: string };

const study = (id: string, projectName: string, extra: Partial<Study> = {}): Study => ({
    id, projectName, projectType: "", contractValue: "", programmeDuration: "", client: "", location: "",
    whatWeDelivered: `${projectName} work`, valueAdded: "", photos: ["", "", ""], ...extra,
});

/** Runs every component in the tree with its own hooks, keyed as React would key it, and returns the plain elements. */
function expand(value: unknown, path: string): Host[] {
    if (Array.isArray(value)) return value.flatMap((entry, index) => expand(entry, `${path}.${index}`));
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Host;
    const type: unknown = element.type;
    if (typeof type === "function") {
        const id = `${path}/${element.key ?? "-"}`;
        const instance: Instance = hook.state.instances.get(id) ?? { slots: [], cursor: 0 };
        hook.state.instances.set(id, instance);
        instance.cursor = 0;
        hook.state.current = instance;
        return expand((type as (props: unknown) => unknown)(element.props), id);
    }
    // Icons are forwardRef objects: they hold nothing this test reads.
    if (typeof type === "object") return [];
    const own = type === Fragment ? [] : [element];
    return [...own, ...expand(element.props.children, path)];
}

let initial: Study[];
const render = () => expand(<CaseStudiesClient userId="synthetic" initialCaseStudies={initial} />, "root");

function editorState() {
    const held = [...hook.state.instances.values()].flatMap(instance => instance.slots);
    return held.find((slot): slot is SaveState<Study> => typeof slot === "object" && slot !== null && "draft" in slot)!;
}
const photosOf = () => editorState().draft.map(row => row.photos);

const labelled = (tree: Host[], label: string) => {
    const found = tree.find(element => element.props["aria-label"] === label);
    if (!found) throw new Error(`Nothing labelled "${label}"`);
    return found;
};

function pick(label: string) {
    const change = labelled(render(), label).props.onChange as (event: unknown) => unknown;
    return Promise.resolve(change({ target: { files: [new File(["synthetic"], "photo.png", { type: "image/png" })] } }));
}
const remove = (position: number) => (labelled(render(), `Remove past work ${position}`).props.onClick as () => void)();
const typeInto = (tree: Host[], label: string, value: string) => (labelled(tree, label).props.onChange as (event: unknown) => void)({ target: { value } });

/** One held upload for each call, settled by the test in whatever order it needs. */
function heldUploads() {
    const held: { resolve: (reply: UploadReply) => void; reject: (error: Error) => void }[] = [];
    actions.upload.mockImplementation(() => new Promise<UploadReply>((resolve, reject) => { held.push({ resolve, reject }); }));
    return held;
}

beforeEach(() => {
    hook.state.instances.clear();
    hook.state.current = null;
    for (const mock of [actions.save, actions.enhance, actions.upload, toasts.success, toasts.error]) mock.mockReset();
    initial = [study("a", "Alpha"), study("b", "Bravo"), study("c", "Charlie")];
});

describe("a photo reply lands on the example it was picked for", () => {
    it("follows its example when an earlier one is removed while it uploads", async () => {
        const held = heldUploads();
        const upload = pick("Upload photo 1 for past work 2");
        remove(1);
        held[0].resolve({ url: "/bravo.png" });
        await upload;
        expect(editorState().draft.map(row => row.projectName)).toEqual(["Bravo", "Charlie"]);
        expect(photosOf()).toEqual([["/bravo.png", "", ""], ["", "", ""]]);
        const images = render().filter(element => element.type === "img");
        expect(images.map(element => element.props.src)).toEqual(["/bravo.png"]);
        expect(toasts.success).toHaveBeenCalledTimes(1);
        expect(toasts.error).not.toHaveBeenCalled();
    });

    it("is discarded, and says so, when its example was removed", async () => {
        const held = heldUploads();
        const upload = pick("Upload photo 2 for past work 1");
        remove(1);
        held[0].resolve({ url: "/alpha.png" });
        await upload;
        expect(editorState().draft.map(row => row.projectName)).toEqual(["Bravo", "Charlie"]);
        expect(photosOf()).toEqual([["", "", ""], ["", "", ""]]);
        expect(toasts.success).not.toHaveBeenCalled();
        expect(toasts.error).toHaveBeenCalledTimes(1);
        expect(toasts.error.mock.calls[0][0]).toMatch(/removed/i);
    });

    it("tells apart stored examples that have no id or share one", async () => {
        initial = [
            study("twin", "First twin"),
            study("twin", "Second twin"),
            study(undefined as unknown as string, "No id one"),
            study(undefined as unknown as string, "No id two"),
        ];
        const held = heldUploads();
        const secondTwin = pick("Upload photo 1 for past work 2");
        const secondNoId = pick("Upload photo 1 for past work 4");
        const firstNoId = pick("Upload photo 3 for past work 3");
        remove(3);
        remove(1);
        held[0].resolve({ url: "/twin.png" });
        held[1].resolve({ url: "/no-id.png" });
        held[2].resolve({ url: "/gone.png" });
        await Promise.all([secondTwin, secondNoId, firstNoId]);
        expect(editorState().draft.map(row => row.projectName)).toEqual(["Second twin", "No id two"]);
        expect(photosOf()).toEqual([["/twin.png", "", ""], ["/no-id.png", "", ""]]);
        expect(toasts.success).toHaveBeenCalledTimes(2);
        expect(toasts.error).toHaveBeenCalledTimes(1);
    });

    it("keeps its place for an example added after the page loaded", async () => {
        const held = heldUploads();
        const addAnother = render().find(element => element.props["data-add-example"] !== undefined)!;
        (addAnother.props.onClick as () => void)();
        const upload = pick("Upload photo 1 for past work 4");
        remove(2);
        held[0].resolve({ url: "/added.png" });
        await upload;
        expect(photosOf()).toEqual([["", "", ""], ["", "", ""], ["/added.png", "", ""]]);
    });
});

describe("photos and text changed while an upload runs", () => {
    it.each([[0, 1], [1, 0]])("keeps both of two slots however they return (first back: %i)", async (first, second) => {
        const held = heldUploads();
        const uploads = [pick("Upload photo 1 for past work 1"), pick("Upload photo 3 for past work 1")];
        const urls = ["/one.png", "/three.png"];
        held[first].resolve({ url: urls[first] });
        await uploads[first];
        held[second].resolve({ url: urls[second] });
        await uploads[second];
        expect(photosOf()[0]).toEqual(["/one.png", "", "/three.png"]);
        expect(toasts.success).toHaveBeenCalledTimes(2);
    });

    it("keeps a photo already on the example and the latest text", async () => {
        initial = [study("a", "Alpha", { photos: ["/kept.png", "", ""] })];
        const held = heldUploads();
        const upload = pick("Upload photo 2 for past work 1");
        typeInto(render(), "What We Delivered", "Typed while it uploaded");
        held[0].resolve({ url: "/new.png" });
        await upload;
        expect(editorState().draft[0].whatWeDelivered).toBe("Typed while it uploaded");
        expect(photosOf()[0]).toEqual(["/kept.png", "/new.png", ""]);
    });

    it("lets the latest pick for one slot stand when the older reply comes last", async () => {
        const held = heldUploads();
        const older = pick("Upload photo 1 for past work 1");
        const newer = pick("Upload photo 1 for past work 1");
        held[1].resolve({ url: "/newer.png" });
        await newer;
        held[0].resolve({ url: "/older.png" });
        await older;
        expect(photosOf()[0]).toEqual(["/newer.png", "", ""]);
        expect(toasts.success).toHaveBeenCalledTimes(1);
    });

    it("does not fill a slot from an older pick when the latest pick failed", async () => {
        const held = heldUploads();
        const older = pick("Upload photo 1 for past work 1");
        const newer = pick("Upload photo 1 for past work 1");
        held[1].resolve({ error: "That image is too large." });
        await newer;
        held[0].resolve({ url: "/older.png" });
        await older;
        expect(photosOf()[0]).toEqual(["", "", ""]);
        expect(toasts.success).not.toHaveBeenCalled();
        expect(toasts.error.mock.calls).toEqual([["That image is too large."]]);
    });
});

describe("an upload that fails", () => {
    it("settles and reports a thrown transport failure, changing nothing and sending once", async () => {
        const held = heldUploads();
        const upload = pick("Upload photo 1 for past work 1");
        held[0].reject(new Error("transport lost"));
        await expect(upload).resolves.toBeUndefined();
        expect(photosOf()[0]).toEqual(["", "", ""]);
        expect(toasts.success).not.toHaveBeenCalled();
        expect(toasts.error).toHaveBeenCalledTimes(1);
        expect(toasts.error.mock.calls[0][0]).not.toContain("transport lost");
        expect(actions.upload).toHaveBeenCalledTimes(1);
    });

    it.each([
        [{ error: "That image is too large." }, "That image is too large."],
        [{}, "Upload failed"],
    ])("reports a returned failure and sends once: %j", async (reply, message) => {
        const held = heldUploads();
        const upload = pick("Upload photo 1 for past work 1");
        held[0].resolve(reply);
        await upload;
        expect(photosOf()[0]).toEqual(["", "", ""]);
        expect(toasts.error.mock.calls).toEqual([[message]]);
        expect(toasts.success).not.toHaveBeenCalled();
        expect(actions.upload).toHaveBeenCalledTimes(1);
    });

    it("still reports a thrown failure on a removed example without touching the others", async () => {
        const held = heldUploads();
        const upload = pick("Upload photo 1 for past work 1");
        remove(1);
        held[0].reject(new Error("transport lost"));
        await expect(upload).resolves.toBeUndefined();
        expect(photosOf()).toEqual([["", "", ""], ["", "", ""]]);
        expect(toasts.error).toHaveBeenCalledTimes(1);
    });
});

describe("what stays as it was", () => {
    it("leaves the save rules alone: a save already sent keeps its copy, and a late photo is unsaved", async () => {
        const held = heldUploads();
        const upload = pick("Upload photo 1 for past work 1");
        const save = render().find(element => element.type === "button" && element.props.children === "Save all past work")!;
        typeInto(render(), "What We Delivered", "Changed");
        (save.props.onClick as () => void)();
        held[0].resolve({ url: "/late.png" });
        await upload;
        const state = editorState();
        expect(state.saving?.sent[0].photos).toEqual(["", "", ""]);
        expect(state.draft[0].photos).toEqual(["/late.png", "", ""]);
        expect(state.saved[0].photos).toEqual(["", "", ""]);
        expect(statusLine({ ...state, saving: null })).toBe(SAVE_MESSAGES.unsaved);
    });

    it("keeps the held paths switched off", () => {
        expect(CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE).toBe(false);
        expect(caseStudyTextEnhanceEnabled()).toBe(false);
    });
});
