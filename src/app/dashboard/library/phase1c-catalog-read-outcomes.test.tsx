import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; ops: unknown[][] };

const db = vi.hoisted(() => ({
    calls: [] as Call[],
    // Per table: the { data, error } the query resolves with, or an Error it rejects with.
    results: {} as Record<string, unknown>,
}));

/** Records each from(...).select(...).is/eq/order(...) chain and settles it with the table's queued result. */
function fakeClient() {
    return {
        from(table: string) {
            const call: Call = { table, ops: [] };
            db.calls.push(call);
            const op = (name: string) => (...args: unknown[]) => { call.ops.push([name, ...args]); return chain; };
            const chain = {
                select: op("select"),
                is: op("is"),
                eq: op("eq"),
                order: op("order"),
                then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
                    const result = db.results[table];
                    return (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(resolve, reject);
                },
            };
            return chain;
        },
    };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ getActiveOrganizationId: vi.fn() }));

import { redirect } from "next/navigation";
import LibraryPage from "./page";
import LibraryPageClient from "./library-page-client";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";

type Element = ReactElement<Record<string, unknown>>;

/** Renders server-side function components down to host elements, keeping the client component as an element. */
function expand(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== "object" || !("props" in value)) return value;
    const el = value as Element;
    if (el.type === LibraryPageClient) return el;
    if (typeof el.type === "function") return expand((el.type as (p: unknown) => unknown)(el.props));
    return { ...el, props: { ...el.props, children: expand(el.props.children) } };
}

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...(el.type === LibraryPageClient ? [] : nodes(el.props.children))];
}

function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    if (!value || typeof value !== "object" || !("props" in value)) return "";
    const el = value as Element;
    return el.type === LibraryPageClient ? "" : text(el.props.children);
}

async function render() {
    const tree = expand(await LibraryPage());
    const all = nodes(tree);
    return {
        client: all.find(e => e.type === LibraryPageClient),
        alert: all.find(e => e.props.role === "alert"),
        pageText: text(tree),
    };
}

const categories = [
    { id: "c1", code: "GW", name: "Groundworks", sort_order: 1 },
    { id: "c2", code: "BR", name: "Brickwork", sort_order: 2 },
];
const items = [
    { id: "i1", code: "BR-01", category_id: "c2", description: "Facing brick", unit: "m2", base_rate: 85, is_featured: true },
    { id: "i2", code: "GW-01", category_id: "c1", description: "Excavate trench", unit: "m3", base_rate: 30, is_featured: false },
    { id: "i3", code: "GW-02", category_id: "c1", description: "Cart away", unit: "m3", base_rate: 12.5, is_featured: false },
];
const overrides = [
    { id: "o1", organization_id: "org-1", mom_item_id: "i2", custom_rate: 0, notes: null },
    { id: "o2", organization_id: "org-1", mom_item_id: "i3", custom_rate: 45, notes: "Own haulier" },
];
const ok = (data: unknown) => ({ data, error: null });

beforeEach(() => {
    db.calls = [];
    db.results = { mom_categories: ok(categories), mom_items: ok(items), mom_item_overrides: ok(overrides) };
    vi.mocked(getActiveOrganizationId).mockReset();
    vi.mocked(getActiveOrganizationId).mockResolvedValue("org-1");
});

describe("Cost Library catalog read outcomes", () => {
    it("merges the org-filtered custom rates, including a zero custom rate, using the exact queries", async () => {
        const { client, alert } = await render();
        expect(alert).toBeUndefined();
        expect(db.calls).toEqual([
            { table: "mom_categories", ops: [["select", "*"], ["is", "organization_id", null], ["order", "sort_order", { ascending: true }]] },
            { table: "mom_items", ops: [["select", "*"], ["is", "organization_id", null], ["order", "code", { ascending: true }]] },
            { table: "mom_item_overrides", ops: [["select", "*"], ["eq", "organization_id", "org-1"]] },
        ]);
        expect(client?.props).toEqual({
            categoriesWithItems: [
                { ...categories[0], items: [{ ...items[1], override: overrides[0] }, { ...items[2], override: overrides[1] }] },
                { ...categories[1], items: [{ ...items[0], override: null }] },
            ],
        });
    });

    it("a confirmed empty catalog with no custom rates still renders the library", async () => {
        db.results = { mom_categories: ok([]), mom_items: ok([]), mom_item_overrides: ok([]) };
        const { client, alert, pageText } = await render();
        expect(alert).toBeUndefined();
        expect(client?.props).toEqual({ categoriesWithItems: [] });
        expect(pageText).toMatch(/across 0 trade categories/);
    });

    it("confirmed catalog rows with no custom rates show benchmarks without overrides", async () => {
        db.results.mom_item_overrides = ok([]);
        const { client } = await render();
        const merged = (client?.props.categoriesWithItems as Array<{ items: Array<{ override: unknown }> }>).flatMap(c => c.items);
        expect(merged).toHaveLength(3);
        expect(merged.every(i => i.override === null)).toBe(true);
    });

    it("an organisation lookup failure does not render rate controls or benchmarks as if there were no custom rates", async () => {
        vi.mocked(getActiveOrganizationId).mockRejectedValue(new Error("No organization found for this user."));
        const { client, alert, pageText } = await render();
        expect(client).toBeUndefined();
        expect(alert).toBeDefined();
        expect(text(alert)).toMatch(/couldn.t confirm your organisation/i);
        expect(pageText).not.toMatch(/across 0 trade categories/);
        expect(db.calls.some(c => c.table === "mom_item_overrides")).toBe(false);
    });

    it("Next navigation control flow from the organisation lookup is not swallowed", async () => {
        vi.mocked(getActiveOrganizationId).mockImplementation(async () => redirect("/login"));
        await expect(LibraryPage()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    });

    it.each([
        ["mom_categories", { data: [categories[0]], error: { message: "permission denied for table mom_categories" } }],
        ["mom_items", { data: [items[0]], error: { message: "canceling statement due to statement timeout" } }],
    ])("a %s returned error (even with partial data) shows the catalog as unavailable, not as empty", async (table, result) => {
        db.results[table] = result;
        const { client, alert, pageText } = await render();
        expect(client).toBeUndefined();
        expect(text(alert)).toMatch(/cost library couldn.t be loaded/i);
        expect(pageText).not.toMatch(/across \d+ trade categories/);
    });

    it("a returned override error (even with partial data) does not show benchmarks as if there were no custom rates", async () => {
        db.results.mom_item_overrides = { data: [overrides[1]], error: { message: "TypeError: fetch failed" } };
        const { client, alert } = await render();
        expect(client).toBeUndefined();
        expect(text(alert)).toMatch(/your own rates couldn.t be loaded/i);
    });

    it.each(["mom_categories", "mom_items", "mom_item_overrides"])("a thrown %s read shows an unavailable state instead of escaping", async table => {
        db.results[table] = new Error("fetch failed");
        const { client, alert } = await render();
        expect(client).toBeUndefined();
        expect(alert).toBeDefined();
        expect(text(alert)).toMatch(/reload the page/i);
    });
});
