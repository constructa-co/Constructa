import { Fragment, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A038: when a save is refused for pictures on older past work, the editor must
 * say so in the save status, offer to try again, and keep what was on screen.
 * Synthetic fixtures only; save and upload are stand-ins.
 */
type Instance = { slots: unknown[]; cursor: number };

const hook = vi.hoisted(() => ({
    instances: new Map<string, { slots: unknown[]; cursor: number }>(),
    current: null as { slots: unknown[]; cursor: number } | null,
}));
const actions = vi.hoisted(() => ({ save: vi.fn(), enhance: vi.fn(), upload: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

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
        useId: () => "legacy-photo-save",
        useEffect: (run: () => unknown) => {
            try { run(); } catch (error) { if (!(error instanceof ReferenceError)) throw error; }
        },
    };
});
vi.mock("sonner", () => ({ toast: toasts }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: vi.fn() }));
vi.mock("./actions", () => ({ saveCaseStudiesAction: actions.save, enhanceCaseStudyAction: actions.enhance }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: actions.upload }));

import { LEGACY_CASE_STUDY_PHOTOS_MESSAGE } from "@/lib/case-library/legacy-photos";
import CaseStudiesClient from "./case-studies-client";
import type { SaveState } from "./save-state";

type Study = Parameters<typeof CaseStudiesClient>[0]["initialCaseStudies"][number];
type Host = ReactElement<Record<string, unknown>>;

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
    if (typeof type === "object") return [];
    const own = type === Fragment ? [] : [element];
    return [...own, ...expand(element.props.children, path)];
}

const labelled = (tree: Host[], label: string) => {
    const found = tree.find(element => element.props["aria-label"] === label);
    if (!found) throw new Error(`Nothing labelled "${label}"`);
    return found;
};
const saveButton = (tree: Host[]) => {
    const found = tree.find(element => element.type === "button" && (element.props.children === "Save all past work" || element.props.children === "Try again"));
    if (!found) throw new Error("Save button not found");
    return found;
};
const heldSave = () =>
    [...hook.instances.values()].flatMap(instance => instance.slots).find(
        (slot): slot is SaveState<Study> => typeof slot === "object" && slot !== null && "draft" in slot && "saved" in slot,
    )!;

const study = (extra: Partial<Study> = {}): Study => ({
    id: "example",
    projectName: "Kitchen refit",
    projectType: "Renovation",
    contractValue: "",
    programmeDuration: "",
    client: "",
    location: "",
    whatWeDelivered: "Work done.",
    valueAdded: "",
    photos: ["", "", ""],
    ...extra,
});

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

let initial: Study[];
const render = () => expand(<CaseStudiesClient userId="synthetic" initialCaseStudies={initial} save={actions.save} />, "older");

beforeEach(() => {
    hook.instances.clear();
    hook.current = null;
    for (const mock of [actions.save, actions.enhance, actions.upload, toasts.success, toasts.error]) mock.mockReset();
    initial = [study()];
});

describe("when pictures stop a save on older past work", () => {
    it("shows the refusal in the save status, keeps the draft, and does not call it saved", async () => {
        actions.upload.mockResolvedValue({ url: "http://not-https.example.test/bad.png" });
        actions.save.mockResolvedValue({ status: "refused", message: LEGACY_CASE_STUDY_PHOTOS_MESSAGE });

        const upload = labelled(render(), "Upload photo 1 for past work 1");
        await Promise.resolve((upload.props.onChange as (event: unknown) => unknown)({ target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } }));
        await settle();
        render();

        (saveButton(render()).props.onClick as () => void)();
        render();
        await settle();
        const tree = render();

        const status = tree.find(element => element.props["data-case-studies-save-status"] !== undefined);
        expect(status?.props.children).toBe(LEGACY_CASE_STUDY_PHOTOS_MESSAGE);
        expect(status?.props["data-trouble"]).toBe(true);
        expect(saveButton(tree).props.children).toBe("Try again");
        expect(toasts.success.mock.calls).toEqual([["Photo uploaded"]]);        expect(actions.save).toHaveBeenCalledTimes(1);
        expect(actions.save.mock.calls[0][0]).toEqual([
            expect.objectContaining({
                photos: ["http://not-https.example.test/bad.png", "", ""],
            }),
        ]);
    });

    it("does not move the saved baseline when the refusal is only about pictures", async () => {
        actions.upload.mockResolvedValue({ url: "http://not-https.example.test/bad.png" });
        actions.save.mockResolvedValue({ status: "refused", message: LEGACY_CASE_STUDY_PHOTOS_MESSAGE });
        initial = [study({ location: "Leeds" })];

        const upload = labelled(render(), "Upload photo 1 for past work 1");
        await Promise.resolve((upload.props.onChange as (event: unknown) => unknown)({ target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } }));
        await settle();
        (saveButton(render()).props.onClick as () => void)();
        render();
        await settle();

        const state = heldSave();
        expect(state.draft[0].photos).toEqual(["http://not-https.example.test/bad.png", "", ""]);
        expect(state.draft[0].location).toBe("Leeds");
        expect(state.saved[0].photos).toEqual(["", "", ""]);
        expect(state.saved[0].location).toBe("Leeds");
    });
});

describe("when older past work already holds more than three pictures", () => {
    const four = ["https://images.example.test/1.jpg", "https://images.example.test/2.jpg", "https://images.example.test/3.jpg", "https://images.example.test/4.jpg"];
    const notice = (tree: Host[]) => tree.find(element => element.props["data-extra-photos"] !== undefined);

    it("says so and changes nothing on its own: no trim on load, no save, no upload", () => {
        initial = [study({ photos: four })];
        const tree = render();

        expect(notice(tree)).toBeDefined();
        expect(heldSave().draft[0].photos).toEqual(four);
        expect(heldSave().saved[0].photos).toEqual(four);
        expect(actions.save).not.toHaveBeenCalled();
        expect(actions.upload).not.toHaveBeenCalled();
        expect(actions.enhance).not.toHaveBeenCalled();
    });

    it("keeps the first three only when the contractor chooses, and nothing else in the entry changes", () => {
        initial = [study({ photos: four, location: "Leeds" })];

        (labelled(render(), "Keep the first three pictures for past work 1").props.onClick as () => void)();
        const tree = render();

        expect(heldSave().draft[0].photos).toEqual(four.slice(0, 3));
        expect(heldSave().draft[0].location).toBe("Leeds");
        // The stored copy is untouched until a save is confirmed.
        expect(heldSave().saved[0].photos).toEqual(four);
        expect(notice(tree)).toBeUndefined();
        expect(actions.save).not.toHaveBeenCalled();
    });

    it("shows no notice for three pictures, or fewer", () => {
        initial = [study({ photos: ["https://images.example.test/1.jpg", "", ""] }), study({ id: "other", photos: [] })];
        expect(notice(render())).toBeUndefined();
    });
});
