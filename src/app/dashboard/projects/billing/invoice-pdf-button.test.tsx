import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InvoicePdfButton from "./invoice-pdf-button";

const m = vi.hoisted(() => ({
    click: null as null | (() => void), element: {} as HTMLSpanElement,
    capture: vi.fn(), error: vi.fn(), constructed: vi.fn(),
    doc: {
        setFontSize: vi.fn(), setFont: vi.fn(), setTextColor: vi.fn(), text: vi.fn(),
        autoTable: vi.fn(), lastAutoTable: { finalY: 100 }, save: vi.fn(), addImage: vi.fn(),
    },
}));
vi.mock("react", async () => ({ ...await vi.importActual("react"), useRef: () => ({ current: m.element }), useState: () => [null, m.error] }));
vi.mock("jspdf", () => ({ jsPDF: class { constructor() { m.constructed(); Object.assign(this, m.doc); } } }));
vi.mock("jspdf-autotable", () => ({}));
vi.mock("@/lib/pdf/shared-wordmark", () => ({ captureSharedWordmark: m.capture }));
vi.mock("@/components/ui/button", () => ({ Button: ({ onClick, children }: { onClick: () => void; children: ReactNode }) => { m.click = onClick; return <button>{children}</button>; } }));

beforeEach(() => {
    vi.clearAllMocks();
    m.capture.mockReturnValue({ dataUrl: "data:image/png;base64,c3ludGhldGlj", aspectRatio: 4 });
});

describe("invoice uses the shared wordmark (A002)", () => {
    it("adds the shared graphic while retaining the original amounts, VAT branch and filename", () => {
        const props = { invoice: { invoice_number: "TEST-1", amount: 250, type: "Interim" as const, created_at: "2026-10-01T12:00:00Z" }, project: { name: "Synthetic job", client_name: "Synthetic client", is_vat_reverse_charge: true }, originalContractSum: 1000, variations: [{ title: "Extra", amount: 125.5 }, { title: "Credit", amount: -25.5 }] };
        const original = structuredClone(props);
        renderToStaticMarkup(<InvoicePdfButton {...props} />);
        expect(m.capture).not.toHaveBeenCalled();
        m.click!();

        expect(m.capture).toHaveBeenCalledWith(m.element, [15, 23, 42]);
        expect(m.doc.addImage).toHaveBeenCalledWith("data:image/png;base64,c3ludGhldGlj", "PNG", 20, 12, 32, 8);
        expect(m.doc.text.mock.calls.some(([text]) => text === "CONSTRUCTA")).toBe(false);
        expect(m.doc.autoTable.mock.calls[0][0].body).toEqual([
            ["Original Contract Sum", "£1,000.00"], ["Variation: Extra", "£125.50"], ["Variation: Credit", "£-25.50"],
            [{ content: "REVISED CONTRACT VALUE", styles: { fontStyle: "bold" } }, { content: "£1,100.00", styles: { fontStyle: "bold" } }],
        ]);
        expect(m.doc.text).toHaveBeenCalledWith("CURRENT AMOUNT DUE (VAT REVERSE-CHARGED):", 20, 120);
        expect(m.doc.text).toHaveBeenCalledWith("£250.00", 20, 130);
        expect(m.doc.save).toHaveBeenCalledWith("Invoice_TEST-1_Synthetic job.pdf");
        expect(props).toEqual(original);
    });

    it("reports a local brand-preparation failure without generating or saving a partial invoice", () => {
        m.capture.mockImplementation(() => { throw new Error("Synthetic unavailable canvas"); });
        renderToStaticMarkup(<InvoicePdfButton invoice={{ amount: 250 }} project={{ name: "Synthetic job" }} originalContractSum={1000} variations={[]} />);
        m.click!();
        expect(m.constructed).not.toHaveBeenCalled();
        expect(m.doc.save).not.toHaveBeenCalled();
        expect(m.error).toHaveBeenLastCalledWith("The PDF wordmark could not be prepared. Please try again.");
    });

    it("renders the normal non-reverse-charge branch with fallbacks when optional fields are missing", () => {
        const props = { invoice: { amount: 125.5 }, project: { name: "Synthetic job", is_vat_reverse_charge: false }, originalContractSum: 1000, variations: [] };
        const original = structuredClone(props);
        renderToStaticMarkup(<InvoicePdfButton {...props} />);
        expect(m.capture).not.toHaveBeenCalled();
        expect(m.constructed).not.toHaveBeenCalled();
        expect(m.doc.save).not.toHaveBeenCalled();
        m.click!();

        expect(m.capture).toHaveBeenCalledTimes(1);
        expect(m.capture).toHaveBeenCalledWith(m.element, [15, 23, 42]);
        expect(m.doc.addImage).toHaveBeenCalledWith("data:image/png;base64,c3ludGhldGlj", "PNG", 20, 12, 32, 8);
        expect(m.doc.addImage.mock.invocationCallOrder[0]).toBeLessThan(m.doc.autoTable.mock.invocationCallOrder[0]);
        expect(m.doc.text).toHaveBeenCalledWith("Invoice No: ", 120, 27);
        expect(m.doc.text).toHaveBeenCalledWith("Type: Interim Account", 120, 37);
        expect(m.doc.text.mock.calls.some(([text]) => typeof text === "string" && text.startsWith("Date:"))).toBe(false);
        expect(m.doc.text).toHaveBeenCalledWith("Valued Client", 20, 65);
        expect(m.doc.text).toHaveBeenCalledWith("Synthetic job", 120, 65);
        expect(m.doc.autoTable.mock.calls[0][0].body).toEqual([
            ["Original Contract Sum", "£1,000.00"],
            [{ content: "REVISED CONTRACT VALUE", styles: { fontStyle: "bold" } }, { content: "£1,000.00", styles: { fontStyle: "bold" } }],
        ]);
        expect(m.doc.text).toHaveBeenCalledWith("CURRENT AMOUNT DUE FOR THIS VALUATION:", 20, 120);
        expect(m.doc.text).toHaveBeenCalledWith("£125.50", 20, 130);
        expect(m.doc.text.mock.calls.some(([text]) => typeof text === "string" && text.includes("Reverse Charge"))).toBe(false);
        expect(m.doc.text.mock.calls.some(([text]) => text === "CONSTRUCTA")).toBe(false);
        expect(m.doc.save).toHaveBeenCalledTimes(1);
        expect(m.doc.save).toHaveBeenCalledWith("Invoice_draft_Synthetic job.pdf");
        expect(props).toEqual(original);
    });
});
