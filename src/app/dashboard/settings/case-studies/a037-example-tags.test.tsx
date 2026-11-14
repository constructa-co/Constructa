import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExampleTagsSection from "./example-tags-section";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveCaseStudiesAction } from "./actions";
import { legacyCaseStudyForSave } from "@/lib/case-study-example-tags";

describe("A037 legacy example discipline/sector tags", () => {
    it("exposes tag chips on the older past-work editor", () => {
        const clientSource = readFileSync(path.join(process.cwd(), "src/app/dashboard/settings/case-studies/case-studies-client.tsx"), "utf8");
        const tagsSource = readFileSync(path.join(process.cwd(), "src/app/dashboard/settings/case-studies/example-tags-section.tsx"), "utf8");
        expect(clientSource).toContain("ExampleTagsSection");
        expect(clientSource).toContain("legacyCaseStudyForSave");
        expect(clientSource).not.toContain("hintsWhenExampleFieldsChange");
        expect(tagsSource).toContain("data-example-tag-section");
        expect(tagsSource).toContain('data-tag-state');
    });

    it("renders suggestions without marking them selected", () => {
        const html = renderToStaticMarkup(
            <ExampleTagsSection
                idPrefix="test"
                labelCls="label"
                disciplineTags={[]}
                sectorTags={[]}
                suggestedDisciplines={["Roofing"]}
                suggestedSectors={["domestic"]}
                onDisciplines={() => undefined}
                onSectors={() => undefined}
            />,
        );
        expect(html).toContain('data-discipline-tag="Roofing"');
        expect(html).toContain('data-tag-state="suggested"');
        expect(html).not.toContain('data-discipline-tag="Roofing" data-tag-state="selected"');
        expect(html).toContain('aria-pressed="false"');
    });

    it("renders stored selections as pressed", () => {
        const html = renderToStaticMarkup(
            <ExampleTagsSection
                idPrefix="test"
                labelCls="label"
                disciplineTags={["Roofing"]}
                sectorTags={["commercial"]}
                suggestedDisciplines={["General building"]}
                suggestedSectors={["domestic"]}
                onDisciplines={() => undefined}
                onSectors={() => undefined}
            />,
        );
        expect(html).toContain('data-discipline-tag="Roofing"');
        expect(html).toMatch(/data-discipline-tag="Roofing"[^>]*data-tag-state="selected"/);
        expect(html).toContain('data-sector-tag="commercial"');
        expect(html).toMatch(/data-sector-tag="commercial"[^>]*data-tag-state="selected"/);
    });

    it("persists disciplineTags and sectorTags on save only when explicit", async () => {
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

        const withTags = legacyCaseStudyForSave({
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
            disciplineTagsExplicit: true,
            sectorTags: ["domestic"],
            sectorTagsExplicit: true,
        });
        expect(await saveCaseStudiesAction([withTags])).toMatchObject({ status: "saved" });
        const stored = (rows.get(ME)?.case_studies as Row[])[0];
        expect(stored.disciplineTags).toEqual(["General building"]);
        expect(stored.sectorTags).toEqual(["domestic"]);
        expect(stored.disciplineTagsExplicit).toBe(true);

        const inferredOnly = legacyCaseStudyForSave({
            id: "s2",
            projectName: "Hints only",
            projectType: "Extension",
            client: "Private homeowner",
            disciplineTags: ["General building"],
            sectorTags: ["domestic"],
        });
        expect(inferredOnly).not.toHaveProperty("disciplineTags");
        expect(inferredOnly).not.toHaveProperty("sectorTags");
    });

    beforeEach(() => {
        for (const mock of [mocks.requireAuth, mocks.createAdminClient, mocks.revalidatePath]) mock.mockReset();
    });
});