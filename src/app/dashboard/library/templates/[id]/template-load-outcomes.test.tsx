import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    editorProps: null as null | { templateId: string; libraryItems: unknown[] },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/link", () => ({
    default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) =>
        createElement("a", { href, className }, children),
}));
vi.mock("@/components/ui/card", () => ({
    Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    CardHeader: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    CardTitle: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    CardDescription: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    CardContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@/components/ui/button", () => ({
    Button: (props: Record<string, unknown> & { children?: ReactNode }) => createElement("button", props, props.children),
}));
vi.mock("lucide-react", () => ({
    Trash2: () => null, Plus: () => null, ArrowLeft: () => null, MoreHorizontal: () => null, PackageOpen: () => null,
}));
vi.mock("./template-kit-item-remove", () => ({
    TemplateKitItemRemove: () => createElement("button", { "data-kit-remove": "stub", "aria-label": "Remove kit item" }, "remove"),
}));
vi.mock("./template-item-editor", () => ({
    default: (props: { templateId: string; libraryItems: unknown[] }) => {
        mocks.editorProps = props;
        return createElement("div", { "data-kit-picker": "ready" }, "picker");
    },
}));

import TemplateDetailsPage from "./page";

const template = { id: "tpl-1", name: "Kitchen kit", user_id: "u1" };
const kitItem = {
    id: "line-1", template_id: "tpl-1", category: "Electrical", description: "Cable run",
    unit: "m", unit_cost: 4, quantity: 2, created_at: "2026-10-01T00:00:00Z",
};
const libraryRow = { id: "lib-1", category: "Electrical", description: "Cable run", unit: "m", unit_cost: 4 };

type TableResult = { data?: unknown; error?: { code?: string; message?: string } | null };

function mockSupabase(handlers: Record<string, () => TableResult | Promise<TableResult>>) {
    mocks.createClient.mockResolvedValue({
        from: (table: string) => {
            const filters: Record<string, string> = {};
            const query = {
                select: () => query,
                eq: (key: string, value: string) => { filters[key] = value; return query; },
                single: async () => handlers[table]?.() ?? { data: null, error: { code: "PGRST116" } },
                order: async () => handlers[table]?.() ?? { data: [], error: null },
            };
            return query;
        },
    });
}

async function renderPage() {
    mocks.editorProps = null;
    const tree = await TemplateDetailsPage({ params: Promise.resolve({ id: "tpl-1" }) });
    return renderToStaticMarkup(tree);
}

describe("TemplateDetailsPage load outcomes (ROB1415)", () => {
    beforeEach(() => {
        mocks.createClient.mockReset();
        mocks.editorProps = null;
    });

    it("shows unavailable — not “not found” — when the template read fails unexpectedly", async () => {
        mockSupabase({
            templates: () => ({ data: null, error: { code: "08006", message: "connection failure" } }),
        });
        const markup = await renderPage();
        expect(markup).toMatch(/Could not load this kit/i);
        expect(markup).not.toMatch(/Template not found/i);
        expect(mocks.editorProps).toBeNull();
    });

    it("shows confirmed not found only for a successful empty template lookup", async () => {
        mockSupabase({
            templates: () => ({ data: null, error: { code: "PGRST116", message: "no rows" } }),
        });
        const markup = await renderPage();
        expect(markup).toMatch(/Template not found/i);
        expect(markup).not.toMatch(/Could not load this kit/i);
    });

    it("does not show an empty kit when template_items failed; shows confirmed empty only on success", async () => {
        mockSupabase({
            templates: () => ({ data: template, error: null }),
            template_items: () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
            library_items: () => ({ data: [libraryRow], error: null }),
        });
        const failed = await renderPage();
        expect(failed).not.toMatch(/This kit is empty/i);
        expect(failed).toMatch(/Could not load kit items/i);

        mockSupabase({
            templates: () => ({ data: template, error: null }),
            template_items: () => ({ data: [], error: null }),
            library_items: () => ({ data: [libraryRow], error: null }),
        });
        const empty = await renderPage();
        expect(empty).toMatch(/This kit is empty/i);
        expect(empty).toMatch(/0 Items/i);
    });

    it("renders populated kit rows when template_items succeed", async () => {
        mockSupabase({
            templates: () => ({ data: template, error: null }),
            template_items: () => ({ data: [kitItem], error: null }),
            library_items: () => ({ data: [libraryRow], error: null }),
        });
        const markup = await renderPage();
        expect(markup).toMatch(/Cable run/);
        expect(markup).toMatch(/1 Items/i);
        expect(markup).not.toMatch(/This kit is empty/i);
    });

    it("keeps the picker unavailable when library_items failed instead of an empty list", async () => {
        mockSupabase({
            templates: () => ({ data: template, error: null }),
            template_items: () => ({ data: [], error: null }),
            library_items: () => ({ data: null, error: { code: "08006", message: "timeout" } }),
        });
        const markup = await renderPage();
        expect(markup).not.toContain('data-kit-picker="ready"');
        expect(markup).toMatch(/library registry could not be loaded/i);
        expect(mocks.editorProps).toBeNull();
    });
});
