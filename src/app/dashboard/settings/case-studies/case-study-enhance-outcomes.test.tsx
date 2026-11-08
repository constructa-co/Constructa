import { Fragment, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A038: text tidy is optional and off by default; a failed request must not
 * replace the contractor's own wording. Synthetic fixtures only; enhance is mocked.
 */
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
const enhanceEnabled = vi.hoisted(() => ({ on: false }));

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
    useId: () => "enhance-test",
    useEffect: () => {},
}));

vi.mock("./actions", () => ({ saveCaseStudiesAction: actions.save, enhanceCaseStudyAction: actions.enhance }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: actions.upload }));
vi.mock("@/lib/cohort-ai/case-study-enhance-enabled", () => ({
    CASE_STUDY_TEXT_ENHANCE_ENABLED: false,
    caseStudyTextEnhanceEnabled: () => enhanceEnabled.on,
}));

import { COHORT_AI_OFF } from "@/lib/cohort-ai/shared";
import CaseStudiesClient from "./case-studies-client";
import type { SaveState } from "./save-state";

type Study = Parameters<typeof CaseStudiesClient>[0]["initialCaseStudies"][number];
type Host = ReactElement<Record<string, unknown>>;

const study = (extra: Partial<Study> = {}): Study => ({
    id: "example",
    projectName: "Example renovation",
    projectType: "Renovation",
    contractValue: "",
    programmeDuration: "",
    client: "",
    location: "",
    whatWeDelivered: "Original delivered text.",
    valueAdded: "Original value text.",
    photos: ["", "", ""],
    ...extra,
});

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
    if (typeof type === "object") return [];
    const own = type === Fragment ? [] : [element];
    return [...own, ...expand(element.props.children, path)];
}

function editorState() {
    const held = [...hook.state.instances.values()].flatMap(instance => instance.slots);
    return held.find((slot): slot is SaveState<Study> => typeof slot === "object" && slot !== null && "draft" in slot)!;
}

const enhanceButton = (tree: Host[]) => {
    const button = tree.find(element => element.type === "button" && String(element.props.children).includes("AI Enhance"));
    if (!button) throw new Error("No AI Enhance control");
    return button;
};

beforeEach(() => {
    hook.state.instances.clear();
    hook.state.current = null;
    enhanceEnabled.on = false;
    for (const mock of Object.values(actions)) mock.mockReset();
});

describe("case study text enhance stays optional and never overwrites by itself", () => {
    it("does not call the server while the application switch is off", () => {
        const tree = expand(<CaseStudiesClient userId="synthetic" initialCaseStudies={[study()]} />, "root");
        (enhanceButton(tree).props.onClick as () => void)();
        expect(actions.enhance).not.toHaveBeenCalled();
        expect(editorState().draft[0].whatWeDelivered).toBe("Original delivered text.");
        expect(editorState().draft[0].valueAdded).toBe("Original value text.");
    });

    it("leaves the contractor's text when enhance returns a failure", async () => {
        enhanceEnabled.on = true;
        actions.enhance.mockResolvedValue({
            whatWeDelivered: "Rewritten delivered.",
            valueAdded: "Rewritten value.",
            suggested: false,
            message: "The assistant had nothing to change.",
        });
        const tree = expand(<CaseStudiesClient userId="synthetic" initialCaseStudies={[study()]} />, "root");
        await (enhanceButton(tree).props.onClick as () => Promise<void>)();
        expect(actions.enhance).toHaveBeenCalledTimes(1);
        expect(editorState().draft[0].whatWeDelivered).toBe("Original delivered text.");
        expect(editorState().draft[0].valueAdded).toBe("Original value text.");
    });

    it("leaves the contractor's text when enhance throws", async () => {
        enhanceEnabled.on = true;
        actions.enhance.mockRejectedValue(new Error("provider down"));
        const tree = expand(<CaseStudiesClient userId="synthetic" initialCaseStudies={[study()]} />, "root");
        await (enhanceButton(tree).props.onClick as () => Promise<void>)();
        expect(editorState().draft[0].whatWeDelivered).toBe("Original delivered text.");
        expect(editorState().draft[0].valueAdded).toBe("Original value text.");
    });

    it("surfaces OFF copy without calling enhance when the switch is off", () => {
        const render = () => expand(<CaseStudiesClient userId="synthetic" initialCaseStudies={[study()]} />, "root");
        (enhanceButton(render()).props.onClick as () => void)();
        const notice = render().find(element => element.props["data-case-study-notice"] !== undefined);
        expect(notice?.props.children).toBe(COHORT_AI_OFF);
    });
});
