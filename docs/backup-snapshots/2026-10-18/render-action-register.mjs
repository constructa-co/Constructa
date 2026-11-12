import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(root, "walkthrough-action-register.json");
const mdPath = join(root, "walkthrough-action-register.md");
const register = JSON.parse(readFileSync(jsonPath, "utf8"));
const mode = process.argv[2] ?? "--check";
assert(["--write", "--check"].includes(mode), "Use --write or --check.");
const statuses = Object.keys(register.reporting.statuses);
const ids = new Set();
const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
const referencedSources = new Set();
let evidenceReferences = 0;
function localReference(value) {
  const file = value.split("#")[0];
  const path = resolve(root, file);
  assert(path.startsWith(root + "/"), "Reference must remain inside verification: " + file);
  assert(existsSync(path), "Missing evidence/source: " + file);
  return path;
}
for (const action of register.actions) {
  assert(/^A\d{3}$/.test(action.id) && !ids.has(action.id), "Invalid/duplicate ID: " + action.id);
  ids.add(action.id);
  assert(statuses.includes(action.status), "Unknown status: " + action.id);
  assert(["P1-Jan2027", "Later"].includes(action.phase), "Unknown/missing phase: " + action.id);
  assert(action.evidence.length <= 3, "More than three evidence files: " + action.id);
  assert(action.requested && action.remaining && action.sources.length, "Incomplete action: " + action.id);
  assert(action.status !== "Complete" || (action.delivered && action.evidence.length), "Missing completion evidence: " + action.id);
  counts[action.status]++;
  for (const ref of action.sources) {
    if (!ref.startsWith("direct-")) localReference(ref);
    else assert(register.directRequests.some((request) => request.id === ref), "Missing direct request: " + ref);
    referencedSources.add(ref);
  }
  for (const ref of action.evidence) {
    localReference(ref);
    evidenceReferences++;
  }
}
for (const ref of register.sources) {
  localReference(ref);
  assert(referencedSources.has(ref), "Source has no mapped action: " + ref);
}
for (const id of register.nextPriority) assert(ids.has(id), "Unknown next ID: " + id);
const esc = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const link = (ref) => {
  const file = ref.split("#")[0];
  return "[" + file + "](<" + join(root, file) + ">)";
};
const date = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long", timeStyle: "short", timeZone: register.timezone
}).format(new Date(register.updatedAt));
const lines = [
  "# " + register.title,
  "",
  "Updated " + date + " Dubai. " + register.actions.length + " stable numbered actions.",
  "",
  register.scope,
  "",
  "This is the full register, not a claim that the product is complete. Actions differ greatly in size, so the counts are not a completion percentage. Local delivery does not mean a hosted release.",
  "",
  "## Status",
  "",
  "| Status | Actions | Meaning |",
  "| --- | ---: | --- |",
  ...statuses.map((status) => "| " + status + " | " + counts[status] + " | " + esc(register.reporting.statuses[status]) + " |"),
  "",
  "## Phase One",
  "",
  register.phasePlan.countClarification,
  "",
  register.phasePlan.basis,
  "",
  "| Status | P1-Jan2027 | Later |",
  "| --- | ---: | ---: |",
  ...statuses.map((status) => "| " + status + " | " + register.actions.filter((action) => action.phase === "P1-Jan2027" && action.status === status).length + " | " + register.actions.filter((action) => action.phase === "Later" && action.status === status).length + " |"),
  "",
  "## P1 Not Started",
  "",
  "Dependency-first order, not a serial schedule or a new hold on independent work. Partial and blocked P1 work remains in the full table.",
  "",
  ...register.phasePlan.notStartedDependencyOrder.flatMap((group) => [
    "### " + group.stage, "",
    ...group.ids.map((id) => {
      const action = register.actions.find((item) => item.id === id);
      assert(action?.phase === "P1-Jan2027" && action.status === "Not started", "Invalid P1 queue: " + id);
      return "- " + id + ": " + action.requested;
    }), ""
  ]),
  "## Calls For Rob",
  "",
  ...register.phasePlan.decisionsForRob.map((decision) => "- " + decision.ids.join(", ") + " (" + decision.tag + "): " + decision.question),
  "",
  "## Next Actions",
  "",
  ...register.nextPriority.map((id) => {
    const action = register.actions.find((item) => item.id === id);
    return "- " + id + ": " + action.requested;
  }),
  "",
  "Independent safe local work can proceed while preservation/build/release prerequisites remain unresolved.",
  "",
  "## Action Table",
  "",
  "Each update uses these fixed IDs and the same columns. Complete rows stay visible. Evidence and earlier failures are retained.",
  ""
];
for (const area of [...new Set(register.actions.map((action) => action.area))]) {
  lines.push("### " + area, "", "| Action | Phase | Requested | Status | Delivered or Remaining | Evidence |", "| --- | --- | --- | --- | --- | --- |");
  for (const action of register.actions.filter((item) => item.area === area)) {
    const detail = action.status === "Complete" ? action.delivered : action.remaining;
    const refs = action.evidence.length ? action.evidence.map(link).join("; ") : "Request: " + action.sources.map((ref) => ref.startsWith("direct-") ? "Robert's direct request" : link(ref)).join("; ");
    lines.push("| " + action.id + " | " + action.phase + " | " + esc(action.requested) + " | " + action.status + " | " + esc(detail) + " | " + refs + " |");
  }
  lines.push("");
}
lines.push("## Retained Preferences", "", ...register.retainedPreferences.map((value) => "- " + value), "", "## Clarified Decisions", "", ...register.supersededInterpretations.map((value) => "- " + value), "", "## Current Verification", "", "| Area | Current Result |", "| --- | --- |", ...Object.entries(register.currentVerification).map(([key, value]) => "| " + key + " | " + esc(value) + " |"), "", "## Reporting Rules", "", ...register.reporting.rules.map((value) => "- " + value), "", "## Source Records", "", ...register.sources.map((ref) => "- " + link(ref)), "", "The machine-readable source is " + link("walkthrough-action-register.json") + ". Regenerate the table using render-action-register.mjs --write; verify it with --check.", "");
const markdown = lines.join("\n");
assert.equal((markdown.match(/^\| A\d{3} \|/gm) ?? []).length, register.actions.length, "Table/action count mismatch.");
if (mode === "--write") writeFileSync(mdPath, markdown);
else assert.equal(readFileSync(mdPath, "utf8"), markdown, "Readable table is stale; regenerate it.");
console.log(JSON.stringify({
  actions: register.actions.length, counts, sourceRecords: register.sources.length,
  allSourcesMapped: true, evidenceReferences, uniqueStableIds: true,
  tableRows: register.actions.length, mode, applicationChecksRun: false
}, null, 2));

