import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";

describe("deferred document parser dependencies", () => {
  it("opens a valid PDF and rejects a malformed PDF", async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const source = new jsPDF();
    source.text("Constructa parser smoke test", 10, 10);

    const validPdf = new Uint8Array(source.output("arraybuffer"));
    const document = await getDocument({ data: validPdf }).promise;
    expect(document.numPages).toBe(1);

    const malformedPdf = new TextEncoder().encode("%PDF-malformed");
    await expect(
      getDocument({ data: malformedPdf }).promise,
    ).rejects.toThrow();
  });

  it("round-trips a valid workbook and rejects a malformed ZIP workbook", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Item", "Value"], ["Smoke", 42]]),
      "Test",
    );

    const validWorkbook = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const parsed = XLSX.read(validWorkbook, { type: "array" });
    expect(XLSX.utils.sheet_to_json(parsed.Sheets.Test, { header: 1 })).toEqual([
      ["Item", "Value"],
      ["Smoke", 42],
    ]);

    const malformedWorkbook = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01]);
    expect(() => XLSX.read(malformedWorkbook, { type: "array" })).toThrow(
      "Unsupported ZIP file",
    );
  });
});
