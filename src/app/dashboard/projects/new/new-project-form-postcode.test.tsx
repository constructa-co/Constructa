import type { ComponentProps, FormEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobAddressField from "@/components/job-address-field";
import ManualAddressEntry from "@/components/manual-address-entry";
import PostcodeAddressPicker from "@/components/postcode-address-picker";

const hooks = vi.hoisted(() => ({
    states: [] as unknown[],
    refs: [] as Array<{ current: unknown }>,
    stateIndex: 0,
    refIndex: 0,
    guard: vi.fn(),
    push: vi.fn(),
    create: vi.fn(),
}));

vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.stateIndex++;
        if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [
            hooks.states[index],
            (value: unknown) => {
                hooks.states[index] = typeof value === "function" ? (value as (prev: unknown) => unknown)(hooks.states[index]) : value;
            },
        ];
    },
    useRef: (initial: unknown) => {
        const index = hooks.refIndex++;
        return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
    },
    useEffect: (fn: () => void | (() => void)) => {
        fn();
    },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: hooks.push }) }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: hooks.guard }));
vi.mock("./actions", () => ({ createBlankProjectAction: hooks.create }));

import type { PostcodeLookupFn } from "@/lib/postcode-address";
import NewProjectForm from "./new-project-form";

type Node = ReactElement<{
    children?: ReactNode;
    id?: string;
    disabled?: boolean;
    value?: string;
    hidden?: boolean;
    "aria-controls"?: string;
    "data-unusual-site-fallback"?: string;
    onClick?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
    onSubmit?: (event: FormEvent) => void;
}>;

function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as ReactElement<{ children?: ReactNode }>;
    if (node.type === JobAddressField) {
        return nodes(JobAddressField(node.props as ComponentProps<typeof JobAddressField>));
    }
    if (node.type === PostcodeAddressPicker) {
        return nodes(PostcodeAddressPicker(node.props as ComponentProps<typeof PostcodeAddressPicker>));
    }
    if (node.type === ManualAddressEntry) {
        return nodes(ManualAddressEntry(node.props as ComponentProps<typeof ManualAddressEntry>));
    }
    return [node as Node, ...nodes(node.props.children)];
}

function render(lookup?: PostcodeLookupFn) {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    return NewProjectForm({ isFirstProject: true, postcodeLookup: lookup });
}

function openMore() {
    nodes(render()).find(n => n.type === "button" && n.props["aria-controls"] === "new-project-more")!.props.onClick!();
}

beforeEach(() => {
    vi.stubGlobal("window", { setTimeout: vi.fn() });
    hooks.states = [];
    hooks.refs = [];
    hooks.guard.mockClear();
    hooks.create.mockReset();
    hooks.push.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("new project postcode-first addresses", () => {
    it("keeps site and client separate when only client is chosen from injected lookup", async () => {
        const lookup = vi.fn().mockResolvedValue({
            kind: "ok",
            candidates: [{ id: "c1", label: "Billing House\nNE1 1AA" }],
        });
        const unusualSite = "Plot π rear\n(courtyard access only)";
        openMore();
        nodes(render(lookup)).find(n => n.props.id === "new-project-siteAddress")!.props.onChange!({ target: { value: unusualSite } });
        nodes(render(lookup)).find(n => n.props.id === "new-project-client-picker-postcode")!.props.onChange!({ target: { value: "NE1 1AA" } });
        nodes(render(lookup)).find(n => n.props.id === "new-project-client-picker-find")!.props.onClick!();
        await vi.waitFor(() => expect(lookup).toHaveBeenCalledWith("NE11AA"));
        await vi.waitFor(() =>
            expect(nodes(render(lookup)).some(n => n.props.id === "new-project-client-picker-candidate-c1")).toBe(true),
        );
        nodes(render(lookup)).find(n => n.props.id === "new-project-client-picker-candidate-c1")!.props.onClick!();
        expect(nodes(render(lookup)).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe(unusualSite);
        expect(nodes(render(lookup)).find(n => n.props.id === "new-project-clientAddress")!.props.value).toBe("Billing House\nNE1 1AA");
    });

    it("shows unusual-site guidance on site only, not client", () => {
        openMore();
        const tree = nodes(render());
        expect(tree.some(n => n.props["data-unusual-site-fallback"] === "new-project-site")).toBe(true);
        expect(tree.some(n => n.props["data-unusual-site-fallback"] === "new-project-client")).toBe(false);
    });
});
