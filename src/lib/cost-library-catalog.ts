import type { CostLibraryItem } from "@/app/dashboard/projects/costs/types";

type MomCategoryRow = { id: string; name?: string | null };
type MomItemRow = {
    id: string;
    code?: string | null;
    description?: string | null;
    unit?: string | null;
    base_rate?: number | string | null;
    category_id?: string | null;
};
type MomOverrideRow = { mom_item_id: string; custom_rate?: number | string | null };

/** Stored catalogue money: only finite numbers; never substitute invented defaults. */
export function parseStoredCatalogueRate(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string" && !raw.trim()) return null;
    const value = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
    return Number.isFinite(value) ? value : null;
}

export function effectiveCatalogueRate(item: MomItemRow, override?: MomOverrideRow | null): number | null {
    if (override) {
        const custom = parseStoredCatalogueRate(override.custom_rate);
        if (custom !== null) return custom;
    }
    return parseStoredCatalogueRate(item.base_rate);
}

export function mapMomRowsToCostLibrary(
    items: MomItemRow[],
    categories: MomCategoryRow[],
    overrides: MomOverrideRow[],
): CostLibraryItem[] {
    const categoryName = Object.fromEntries(categories.map(c => [c.id, (c.name?.trim() || "General")]));
    const overrideByItem = Object.fromEntries(overrides.map(o => [o.mom_item_id, o]));
    return items.flatMap(item => {
        const rate = effectiveCatalogueRate(item, overrideByItem[item.id]);
        if (rate === null) return [];
        return [{
            id: item.id,
            code: item.code?.trim() || "",
            description: item.description?.trim() || "",
            unit: item.unit?.trim() || "nr",
            base_rate: rate,
            category: categoryName[item.category_id ?? ""] || "General",
        }];
    });
}

/** Legacy cost_library_items row mapping when MoM catalogue is unavailable. */
export function mapLegacyCostLibraryRow(row: Record<string, unknown>): CostLibraryItem | null {
    const rate = parseStoredCatalogueRate(row.base_rate);
    if (rate === null) return null;
    return {
        id: String(row.id),
        code: String(row.code ?? "").trim(),
        description: String(row.description ?? "").trim(),
        unit: String(row.unit ?? "nr").trim() || "nr",
        base_rate: rate,
        category: String(row.category ?? "General").trim() || "General",
    };
}