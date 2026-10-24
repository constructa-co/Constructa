import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const current = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => unknown)[], theme: "dark", query: "", path: "/dashboard/projects/brief", push: vi.fn(), storage: new Map<string, string>() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? next(current.slots[i]) : next; }];
    },
    useRef: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = { current: initial };
        return current.slots[i];
    },
    useEffect: (effect: () => unknown) => { current.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: current.push }), usePathname: () => current.path, useSearchParams: () => new URLSearchParams(current.query) }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme, setTheme: vi.fn() }) }));
import ProjectNavBar from "./project-navbar";
import SidebarNav from "./sidebar-nav";
import { buildPhoneNav } from "@/lib/phone-nav";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element; return [e, ...nodes(e.props.children)];
}
const steps = [
    ["brief", "Job brief", "/dashboard/projects/brief"], ["estimating", "Estimate", "/dashboard/projects/costs"],
    ["programme", "Programme", "/dashboard/projects/schedule"], ["proposal", "Proposal", "/dashboard/projects/proposal"],
] as const;
function sidebar() { current.cursor = 0; current.effects = []; return SidebarNav({ user: {}, projects: [{ id: "job-1", name: "Actual job" }] }); }
function section() { return nodes(sidebar()).find(e => e.props.sectionKey === "pre-construction")!; }
beforeEach(() => {
    current.slots = []; current.effects = []; current.cursor = 0; current.query = "projectId=job-1"; current.theme = "dark"; current.path = steps[0][2]; current.storage.clear(); current.push.mockReset();
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    vi.stubGlobal("localStorage", { getItem: (k: string) => current.storage.get(k) ?? null, setItem: (k: string, v: string) => current.storage.set(k, v), removeItem: (k: string) => current.storage.delete(k) });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("one cohort job hierarchy", () => {
    it.each(steps)("keeps %s context and the real job name without a second module menu", (key, label) => {
        for (const theme of ["dark", "light"]) {
            current.theme = theme;
            // The existing component receives the server-resolved name, not a remembered client label.
            const html = renderToStaticMarkup(<ProjectNavBar projectId="job-1" projectName={'Kitchen <North> & client'} activeTab={key} />);
            expect(html).toContain('aria-label="Job context"'); expect(html).toContain('aria-current="page"');
            expect(html).toContain(label); expect(html).toContain("Kitchen &lt;North&gt; &amp; client");
            expect(html.match(/<a\b/g)).toHaveLength(1); expect(html).toContain('href="/dashboard"');
            expect(html).not.toContain("href=\"/dashboard/projects/"); expect(html).not.toContain("<h1");
            expect(html).toContain("min-h-11"); expect(html).toContain("break-words"); expect(html).not.toContain("blue-");
        }
    });
    it.each([undefined, ""])("does not invent a name when no server name is supplied: %j", projectName => {
        const html = renderToStaticMarkup(<ProjectNavBar projectId="job-1" projectName={projectName} activeTab="brief" />);
        expect(html).toContain("Current job"); expect(html).not.toContain("undefined");
    });
    it.each(steps)("keeps the sole desktop workflow links and current location for %s", (key, label, route) => {
        current.path = route; sidebar(); current.effects.forEach(effect => effect());
        const group = section(); expect(group.props.label).toBe("This job");
        const links = nodes(group.props.children).filter(e => typeof e.props.href === "string");
        expect(links.map(e => e.props.label)).toEqual(steps.map(s => s[1]));
        expect(links.map(e => e.props.href)).toEqual(steps.map(s => s[2] + "?projectId=job-1"));
        const active = links.filter(e => e.props.active); expect(active).toHaveLength(1); expect(active[0].props.label).toBe(label);
        const rendered = (active[0].type as (props: Record<string, unknown>) => Element)(active[0].props);
        expect(rendered.props["aria-current"]).toBe("page"); expect(current.push).not.toHaveBeenCalled();
        expect(key).toBeTruthy();
    });
    it("matches phone-menu workflow labels and URLs without widening capabilities", () => {
        const group = buildPhoneNav("job-1", "cohort").find(g => g.key === "this-job")!;
        expect(group.items.map(i => i.label)).toEqual(steps.map(s => s[1]));
        expect(group.items.map(i => i.href)).toEqual(steps.map(s => s[2] + "?projectId=job-1"));
    });
});
describe("retained full-profile navigation", () => {
    it.each(steps)("retains the original full-profile module links for %s", key => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
        const html = renderToStaticMarkup(<ProjectNavBar projectId="job-1" activeTab={key} />);
        expect(html.match(/<a\b/g)).toHaveLength(8); expect(html).not.toContain('aria-label="Job context"');
        for (const route of ["overview", "brief", "costs", "drawings", "schedule", "contracts", "proposal", "communications"]) expect(html).toContain(`/dashboard/projects/${route}?projectId=job-1`);
        expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    });
    it("retains full-profile desktop and phone wording and special destinations", () => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
        const group = section(); expect(group.props.label).toBe("Pre-Construction");
        expect(nodes(group.props.children).filter(e => typeof e.props.href === "string").map(e => e.props.label)).toEqual(["Briefs", "Estimates", "Programmes", "Contracts", "Proposals"]);
        expect(buildPhoneNav(null, "full").find(g => g.key === "this-job")!.items.map(i => i.label)).toEqual(["Brief", "Estimates", "Programmes", "Proposals"]);
    });
});
