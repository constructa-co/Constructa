import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
    states: [] as unknown[], refs: [] as Array<{ current: unknown }>, stateIndex: 0, refIndex: 0,
    guard: vi.fn(), push: vi.fn(), create: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.stateIndex++;
        if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? initial() : initial;
        return [hooks.states[index], (value: unknown) => {
            hooks.states[index] = typeof value === "function" ? value(hooks.states[index]) : value;
        }];
    },
    useRef: (initial: unknown) => {
        const index = hooks.refIndex++;
        return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
    },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: hooks.push }) }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: hooks.guard }));
vi.mock("./actions", () => ({ createBlankProjectAction: hooks.create }));

import NewProjectForm from "./new-project-form";
import { PROJECT_NAME_MAX_LENGTH } from "@/lib/blank-project";

type Node = ReactElement<{
    children?: ReactNode; id?: string; role?: string; maxLength?: number;
    "aria-describedby"?: string; "data-job-name-limit"?: string;
    onChange?: (event: { target: { value: string } }) => void;
}>;

function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}
function render() {
    hooks.stateIndex = 0; hooks.refIndex = 0;
    return NewProjectForm({ isFirstProject: true });
}
const byId = (id: string) => nodes(render()).find(n => n.props.id === id)!;
const typeName = (value: string) => byId("new-project-name").props.onChange!({ target: { value } });
const limitText = () => renderToStaticMarkup(byId("new-project-name-limit")).replace(/<[^>]+>/g, "");

beforeEach(() => {
    hooks.states = []; hooks.refs = [];
    for (const mock of [hooks.guard, hooks.push, hooks.create]) mock.mockReset();
});

describe("new job name limit feedback", () => {
    it("keeps one announced place for the limit, silent for an ordinary name", () => {
        typeName("14 Oak Road rear extension");
        const limit = byId("new-project-name-limit");
        expect(limit.props.role).toBe("status");
        expect(limit.props["data-job-name-limit"]).toBeUndefined();
        expect(limitText()).toBe("");
        expect(byId("new-project-name").props["aria-describedby"]).toBeUndefined();
        expect(byId("new-project-name").props.maxLength).toBe(PROJECT_NAME_MAX_LENGTH);
    });

    it("counts down as the name nears the limit and ties the count to the field", () => {
        typeName("x".repeat(PROJECT_NAME_MAX_LENGTH - 5));
        expect(byId("new-project-name-limit").props["data-job-name-limit"]).toBe("near");
        expect(limitText()).toBe("5 characters left for the job name.");
        expect(byId("new-project-name").props["aria-describedby"]).toBe("new-project-name-limit");
    });

    it("says the limit is reached instead of silently dropping what is typed or pasted", () => {
        // The browser cuts a longer paste to the field's maxLength, so this is what the form receives.
        typeName("x".repeat(PROJECT_NAME_MAX_LENGTH));
        expect(byId("new-project-name-limit").props["data-job-name-limit"]).toBe("reached");
        expect(limitText()).toContain("200-character limit for a job name");
        expect(limitText()).toContain("check the end hasn&#x27;t been cut off");
    });

    it("clears again once the name is shortened", () => {
        typeName("x".repeat(PROJECT_NAME_MAX_LENGTH));
        typeName("Shorter job name");
        expect(limitText()).toBe("");
        expect(byId("new-project-name").props["aria-describedby"]).toBeUndefined();
    });

    it("keeps a validation message and the limit both described on the field", () => {
        typeName("x".repeat(PROJECT_NAME_MAX_LENGTH));
        const form = nodes(render()).find(n => n.type === "form") as unknown as ReactElement<{ onSubmit: (event: { preventDefault: () => void }) => void }>;
        form.props.onSubmit({ preventDefault: vi.fn() });
        // The client name is missing, so nothing is sent; the job name itself is valid at the limit.
        expect(hooks.create).not.toHaveBeenCalled();
        expect(byId("new-project-name").props["aria-describedby"]).toBe("new-project-name-limit");
        expect(byId("new-project-client").props["aria-describedby"]).toBe("new-project-client-error");
    });
});