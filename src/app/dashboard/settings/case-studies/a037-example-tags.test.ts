import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveCaseStudiesAction } from "./actions";

describe("A037 legacy example discipline/sector tags", () => {
    it("exposes tag chips on the older past-work editor", () => {
        const clientSource = readFileSync(path.join(process.cwd(), "src/app/dashboard/settings/case-studies/case-studies-client.tsx"), "utf8");
        const tagsSource = readFileSync(path.join(process.cwd(), "src/app/dashboard/settings/case-studies/example-tags-section.tsx"), "utf8");
        expect(clientSource).toContain("ExampleTagsSection");
        expect(clientSource).toContain("disciplineTags");
        expect(clientSource).toContain("sectorTags");
        expect(tagsSource).toContain("data-example-tag-section");
    });

    it("persists disciplineTags and sectorTags on save", async () => {
        const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        type Row = Record<string, unknown>;
        const rows = new Map<string, Row>([[ME, { case_studies: [] }]]);
        const client = {
            from() {
                return {
                    update(payload: Row) {
                        const filters: Array<[string, unknown]> = [];
                        let selected: string | null = null;
                        const query = {
                            eq(column: string, value: unknown) {
                                filters.push([column, value]);
                                return query;
                            },
                            select(columns: string) {
                                selected = columns;
                                return query;
                            },
                            then(resolve: (value: unknown) => unknown) {
                                const row = rows.get(ME);
                                if (row) Object.assign(row, structuredClone(payload));
                                return Promise.resolve({ data: selected ? [{ id: ME }] : null, error: null }).then(resolve);
                            },
                        };
                        return query;
                    },
                };
            },
        };
        mocks.requireAuth.mockResolvedValue({ user: { id: ME }, supabase: client });
        mocks.createAdminClient.mockImplementation(() => {
            throw new Error("unexpected");
        });

        const list = [{
            id: "s1",
            projectName: "Tagged job",
            projectType: "Extension",
            contractValue: "",
            programmeDuration: "",
            client: "",
            location: "",
            whatWeDelivered: "",
            valueAdded: "",
            photos: ["", "", ""],
            disciplineTags: ["General building"],
            sectorTags: ["domestic"],
        }];
        expect(await saveCaseStudiesAction(list)).toMatchObject({ status: "saved" });
        const stored = (rows.get(ME)?.case_studies as Row[])[0];
        expect(stored.disciplineTags).toEqual(["General building"]);
        expect(stored.sectorTags).toEqual(["domestic"]);
    });

    beforeEach(() => {
        for (const mock of [mocks.requireAuth, mocks.createAdminClient, mocks.revalidatePath]) mock.mockReset();
    });
});