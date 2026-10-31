import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A001 commercial-controls seam (accounting / cis / contract-admin / p-and-l
// log cost sheet): the real primary actions now use the approved sage
// corePrimaryButton + coreFocusVisibleRing tokens, not brand blue. Geometry,
// disabled rules, handlers, copy, type="submit" semantics and semantic blues
// (mode pills, status badges, info banners, money figures, field focus) are
// retained. Source-level check, not computed contrast.
const ROOT = path.join(process.cwd(), "src/app/dashboard");

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// Literal source template used by the corrected buttons (not the evaluated value).
const BRAND_PRIMARY_SOURCE = "${corePrimaryButton} hover:bg-[#e0f9e3] ${coreFocusVisibleRing}";

function forbiddenActionHoverBlue(source: string): string[] {
  return source.match(/hover:bg-blue-[57]00\b(?!\/)/g) ?? [];
}

describe("A001 commercial-controls primary palette", () => {
  it.each([
    ["accounting/accounting-client.tsx", 7],
    ["cis/cis-client.tsx", 5],
    ["projects/contract-admin/contract-admin-client.tsx", 9],
    ["projects/p-and-l/log-cost-sheet.tsx", 6],
  ] as const)("%s: primary actions use the core sage palette + focus ring, no brand-blue hover", (rel, count) => {
    const source = read(rel);
    expect(source).toContain("core-editing-palette");
    expect(source.split(BRAND_PRIMARY_SOURCE).length - 1).toBe(count);
    const forbidden = forbiddenActionHoverBlue(source);
    expect(forbidden, `brand blue hover remnants: ${forbidden.join(", ")}`).toEqual([]);
  });

  it("accounting: reconcile/VAT/overhead submits keep type + disabled + handlers; segmented/match/tab blues stay", () => {
    const source = read("accounting/accounting-client.tsx");
    // Save semantics retained on all three modal saves.
    expect(source).toContain('type="submit"');
    expect(source).toContain("disabled={saving || (mode === \"invoice\" && !invoiceId) || (mode === \"overhead\" && !category)}");
    expect(source).toContain("disabled={importing}");
    expect(source).toContain("reconcileTransactionAction");
    expect(source).toContain("upsertVatPeriodAction");
    expect(source).toContain("upsertOverheadCostAction");
    expect(source).toContain("confirmImport");
    // Geometry retained on the small import-confirm button.
    expect(source).toContain("px-4 py-1.5 rounded-lg text-sm font-medium transition-all");
    // Copies retained.
    expect(source).toContain("Import CSV");
    expect(source).toContain("Auto-Match");
    expect(source).toContain("New Period");
    expect(source).toContain("Add Cost");
    // Semantic blues are not actions: segmented mode selector, auto-match badge, active tab.
    expect(source).toContain('mode === m ? "bg-blue-600 text-white"');
    expect(source).toContain("bg-blue-500/15 text-blue-400");
    expect(source).toContain('? "border-blue-500 text-blue-400"');
    // Secondary/destructive table actions untouched.
    expect(source).toContain("hover:bg-red-500/20");
    expect(source).toContain("unreconcileTransactionAction(txn.id)");
    // Ordinary field focus stays as-is (separate seam from primary actions).
    expect(source).toContain("focus:border-blue-500");
  });

  it("cis: form saves and toolbar adds keep disabled + handlers; status badge, tab and emerald action stay", () => {
    const source = read("cis/cis-client.tsx");
    // Disabled rules retained on saves and the gated Record Payment toolbar button.
    expect(source).toContain("disabled={saving}");
    expect(source).toContain("disabled={savingSettings}");
    expect(source).toContain("disabled={subcontractors.filter(s => s.is_active).length === 0}");
    // Handlers retained.
    expect(source).toContain("addSubcontractorAction");
    expect(source).toContain("updateSubcontractorAction");
    expect(source).toContain("recordPaymentAction");
    expect(source).toContain("saveCisSettingsAction");
    // Copies retained.
    expect(source).toContain("Add Subcontractor");
    expect(source).toContain("Record Payment");
    expect(source).toContain("Save Settings");
    // Semantic blues are not actions: CIS status badge and active tab underline.
    expect(source).toContain("bg-blue-900/50 text-blue-300 border border-blue-800");
    expect(source).toContain("text-white border-blue-500 bg-slate-800/50");
    // The scoped emerald "Mark statements sent" action is not brand blue — untouched.
    expect(source).toContain("bg-emerald-700 hover:bg-emerald-600");
    // Cancel stays the outline secondary.
    expect(source).toContain("border border-slate-700");
  });

  it("contract-admin: setup/modal primaries keep disabled + handlers; badge, tab, purple scoped actions stay", () => {
    const source = read("projects/contract-admin/contract-admin-client.tsx");
    // Disabled rules retained on setup and the three modal primaries.
    expect(source).toContain("disabled={saving || !form.awardDate}");
    expect(source).toContain("disabled={saving || !eventForm.title}");
    expect(source).toContain("disabled={saving || !commForm.subject}");
    expect(source).toContain("disabled={saving || !claimForm.title}");
    // Handlers retained.
    expect(source).toContain("setupContractAction");
    expect(source).toContain("raiseEventAction");
    expect(source).toContain("logCommunicationAction");
    expect(source).toContain("raiseClaimAction");
    // Geometry retained on the full-width modal primaries.
    expect(source).toContain("w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors");
    // Copies retained.
    expect(source).toContain("Set Up Contract & Seed Obligations");
    expect(source).toContain("Raise Event & Create Obligation Chain");
    expect(source).toContain("Log Communication");
    expect(source).toContain("Create Claim");
    // Semantic / scoped colours are not brand-blue primaries: open-events count
    // badge, active tab underline, direction badge, purple AI-draft actions.
    expect(source).toContain("bg-blue-600 rounded-full text-[9px]");
    expect(source).toContain('? "border-blue-500 text-blue-400"');
    expect(source).toContain("bg-blue-600/20 text-blue-400");
    expect(source).toContain("bg-purple-600/15 hover:bg-purple-600/25");
    // Copy-to-clipboard stays the neutral secondary; field focus stays as-is.
    expect(source).toContain("bg-white/5 hover:bg-white/10 text-slate-300");
    expect(source).toContain("focus:border-blue-500");
  });

  it("log-cost-sheet: six log-cost submits keep handler + pending disabled; pills, status toggle, summaries stay blue", () => {
    const source = read("projects/p-and-l/log-cost-sheet.tsx");
    // All six submits keep the same handler and pending disabled rule.
    expect(source.match(/onClick=\{handleSubmit\}/g)?.length).toBe(6);
    expect(source.match(/disabled=\{isPending\}/g)?.length).toBe(6);
    expect(source.match(/<Button onClick=\{handleSubmit\} disabled=\{isPending\} className=\{`w-full \$\{corePrimaryButton\}/g)?.length).toBe(6);
    expect(source).toContain("logCostAction");
    // Copies retained.
    expect(source).toContain("Log Labour Cost");
    expect(source).toContain("Log Owned Plant Cost");
    expect(source).toContain("Log Hired Plant Cost");
    expect(source).toContain("Log Materials Cost");
    expect(source).toContain("Log Overhead / Other Cost");
    expect(source).toContain("Log Subcontract Cost");
    // Semantic blues are not actions: catalogue/manual mode pills, hire-rate
    // pills, overhead amount-type pills, subcontract committed/actual toggle.
    expect(source).toContain('? "bg-blue-600 border-blue-600 text-white"');
    expect(source).toContain(': "bg-blue-600 text-white"');
    // Summary cards and money figures stay blue.
    expect(source).toContain("bg-blue-500/10 border border-blue-500/30");
    expect(source).toContain("text-2xl font-bold text-blue-400");
    // Ordinary field focus stays as-is (separate seam from primary actions).
    expect(source).toContain("focus-visible:ring-blue-500");
  });
});
