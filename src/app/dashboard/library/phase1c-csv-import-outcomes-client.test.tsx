import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const current = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    parse: null as null | { complete: (results: { data: unknown[] }) => Promise<void>; error: (e: Error) => void },
    refresh: vi.fn(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = next; }];
    },
}));
vi.mock("papaparse", () => ({
    default: { parse: vi.fn((_file: unknown, config: typeof current.parse) => { current.parse = config; }) },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: current.refresh }) }));
vi.mock("./actions", () => ({ bulkAddMoMItemsAction: vi.fn() }));

import CSVImporter from "./csv-importer";
import { bulkAddMoMItemsAction } from "./actions";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...nodes(el.props.children)];
}

// useState slots: 0 isOpen, 1 isUploading, 2 result.
const rows = [
    { "Level 1 Category": "Groundworks", "Level 2 Category": "Excavation general", "Item Code": " GW-01 ", Description: " Excavate trench ", Unit: "m3", Rate: "30" },
    { "Level 1 Category": "Groundworks", "Item Code": "GW-02", Description: "Cart away", Rate: "x" },
    { "Level 1 Category": "", Description: "No category" },
];

/** Selects a file through the real input handler, then delivers the parser's real completion callback. */
async function importRows(data: unknown[]) {
    current.cursor = 0;
    const input = nodes((CSVImporter as () => unknown)()).find(e => e.props.type === "file")!;
    (input.props.onChange as (e: unknown) => void)({ target: { files: [new Blob(["csv"])] } });
    expect(current.slots[1]).toBe(true);
    await current.parse!.complete({ data });
}

const outcome = () => ({ uploading: current.slots[1], result: current.slots[2] as { success: boolean; message: string; count?: number } });

beforeEach(() => {
    current.slots = [];
    current.parse = null;
    current.refresh.mockReset();
    vi.mocked(bulkAddMoMItemsAction).mockReset();
});

describe("CSVImporter outcomes", () => {
    it("a refused import shows the server's error, not success, and does not refresh", async () => {
        vi.mocked(bulkAddMoMItemsAction).mockResolvedValue({ error: "Category save failed: permission denied." } as never);
        await importRows(rows);
        expect(outcome()).toEqual({ uploading: false, result: { success: false, message: "Category save failed: permission denied." } });
        expect(current.refresh).not.toHaveBeenCalled();
    });

    it("a thrown import is reported as unconfirmed, settles pending and does not retry", async () => {
        vi.mocked(bulkAddMoMItemsAction).mockRejectedValue(new Error("fetch failed"));
        await importRows(rows);
        const { uploading, result } = outcome();
        expect(uploading).toBe(false);
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/couldn.t confirm/i);
        expect(result.message).toMatch(/may already have been saved/i);
        expect(bulkAddMoMItemsAction).toHaveBeenCalledTimes(1);
        expect(current.refresh).not.toHaveBeenCalled();
    });

    it("a refresh failure after a confirmed import keeps the success", async () => {
        vi.mocked(bulkAddMoMItemsAction).mockResolvedValue({ count: 2 });
        current.refresh.mockImplementation(() => { throw new Error("refresh failed"); });
        await importRows(rows);
        const { uploading, result } = outcome();
        expect(uploading).toBe(false);
        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        expect(result.message).toMatch(/Successfully imported 2 items/);
    });

    it("a confirmed import keeps the exact mapped payload, message and refresh (unchanged)", async () => {
        vi.mocked(bulkAddMoMItemsAction).mockResolvedValue({ count: 2 });
        await importRows(rows);
        expect(bulkAddMoMItemsAction).toHaveBeenCalledWith([
            { levels: ["Groundworks", "Excavation general"], code: "GW-01", description: "Excavate trench", unit: "m3", rate: 30 },
            { levels: ["Groundworks"], code: "GW-02", description: "Cart away", unit: undefined, rate: 0 },
        ]);
        expect(outcome()).toEqual({ uploading: false, result: { success: true, message: "Successfully imported 2 items", count: 2 } });
        expect(current.refresh).toHaveBeenCalledTimes(1);
    });

    it("parse errors and files with no valid rows keep their existing messages (unchanged)", async () => {
        await importRows([{ Description: "No levels" }]);
        expect(outcome().result.message).toMatch(/^No valid items found/);
        expect(bulkAddMoMItemsAction).not.toHaveBeenCalled();

        current.slots = [];
        current.cursor = 0;
        const input = nodes((CSVImporter as () => unknown)()).find(e => e.props.type === "file")!;
        (input.props.onChange as (e: unknown) => void)({ target: { files: [new Blob(["csv"])] } });
        current.parse!.error(new Error("Unexpected quote"));
        expect(outcome()).toEqual({ uploading: false, result: { success: false, message: "Failed to parse CSV: Unexpected quote" } });
    });
});
