import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    listQuery: vi.fn(async () => ({ data: [] as unknown[] | null, error: null as { message?: string } | null })),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/link", () => ({
    default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) =>
        createElement("a", { href, className }, children),
}));
vi.mock("@/components/ui/card", () => {
    const box = ({ children, className }: { children?: ReactNode; className?: string }) =>
        createElement("div", { className }, children);
    return { Card: box, CardHeader: box, CardTitle: box, CardDescription: box, CardContent: box };
});
vi.mock("@/components/ui/button", () => ({
    Button: (props: Record<string, unknown> & { children?: ReactNode }) => createElement("button", props, props.children),
}));
vi.mock("lucide-react", () => ({
    Plus: () => null, LayoutGrid: () => null, Trash2: () => null, ArrowRight: () => null,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../templates-actions", () => ({ createTemplateAction: vi.fn() }));
vi.mock("./create-kit-form", () => ({
    default: () =>
        createElement("form", { "data-create-kit-form": "stub" },
            createElement("input", { name: "name" }),
            createElement("button", { type: "submit" }, "Create"),
        ),
}));

import TemplatesPage from "./page";

function wireSupabase() {
    mocks.createClient.mockResolvedValue({
        from: (table: string) => {
            if (table !== "templates") throw new Error(`unexpected table ${table}`);
            const query = {
                select: () => query,
                order: mocks.listQuery,
            };
            return query;
        },
    });
}

async function renderListPage() {
    wireSupabase();
    return renderToStaticMarkup(await TemplatesPage());
}

describe("TemplatesPage kit list read outcomes (ROB1736)", () => {
    beforeEach(() => {
        mocks.createClient.mockReset();
        mocks.listQuery.mockReset();
        mocks.listQuery.mockResolvedValue({ data: [], error: null });
    });

    it("shows an accessible unavailable state when the templates query returns an error (null data)", async () => {
        mocks.listQuery.mockResolvedValueOnce({ data: null, error: { message: "connection failure" } });
        const markup = await renderListPage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).toMatch(/could not load your saved kits/i);
        expect(markup).not.toMatch(/no kits|none created|nothing saved/i);
        expect(markup).not.toMatch(/Edit Recipe/);
        expect(markup).toMatch(/data-create-kit-form="stub"/);
    });

    it("does not render partial kit cards when the query returns an error alongside data", async () => {
        mocks.listQuery.mockResolvedValueOnce({
            data: [{ id: "hidden-1", name: "Should Not Show", description: "partial" }],
            error: { message: "permission denied for table templates" },
        });
        const markup = await renderListPage();
        expect(markup).toMatch(/could not load your saved kits/i);
        expect(markup).not.toMatch(/Should Not Show/);
        expect(markup).not.toMatch(/\.\/templates\/hidden-1/);
        expect(markup).toMatch(/data-create-kit-form="stub"/);
    });

    it("shows unavailable when the templates query throws", async () => {
        mocks.listQuery.mockRejectedValueOnce(new Error("query transport failed"));
        const markup = await renderListPage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).toMatch(/could not load your saved kits/i);
        expect(markup).toMatch(/query transport failed/);
        expect(markup).not.toMatch(/Edit Recipe/);
        expect(markup).toMatch(/data-create-kit-form="stub"/);
    });

    it("renders only the create entry when the list is confirmed empty (no fake unavailable state)", async () => {
        mocks.listQuery.mockResolvedValueOnce({ data: [], error: null });
        const markup = await renderListPage();
        expect(markup).not.toMatch(/could not load your saved kits/i);
        expect(markup).not.toMatch(/Edit Recipe/);
        expect(markup).toMatch(/Create New Kit/);
        expect(markup).toMatch(/data-create-kit-form="stub"/);
    });

    it("renders populated kit cards and edit links on a successful read", async () => {
        mocks.listQuery.mockResolvedValueOnce({
            data: [{ id: "tpl-a", name: "Groundworks Kit", description: "Standard dig" }],
            error: null,
        });
        const markup = await renderListPage();
        expect(markup).not.toMatch(/could not load your saved kits/i);
        expect(markup).toMatch(/Groundworks Kit/);
        expect(markup).toMatch(/\.\/templates\/tpl-a/);
        expect(markup).toMatch(/Edit Recipe/);
        expect(markup).toMatch(/data-create-kit-form="stub"/);
    });
});
