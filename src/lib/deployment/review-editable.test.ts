import { describe, expect, it, vi } from "vitest";
import { assertEditableReviewFetch, editablePage, REVIEW_JOBS, type ReviewLookup } from "./review-editable";
import { assertReviewFetch, REVIEW_ORIGIN, REVIEW_PROJECT, REVIEW_USER } from "./review-policy";
const job = REVIEW_JOBS[0];
const est = "11111111-1111-4111-8111-111111111111";
const line = "22222222-2222-4222-8222-222222222222";
const component = "33333333-3333-4333-8333-333333333333";
const token = (data: object) => `test.${Buffer.from(JSON.stringify(data)).toString("base64url")}.test`;
const actor = token({ sub: REVIEW_USER, role: "authenticated", iss: `${REVIEW_ORIGIN}/auth/v1` });
const anon = token({ ref: REVIEW_PROJECT, role: "anon" });
const request = (path: string, body: unknown, method = "PATCH") => new Request(REVIEW_ORIGIN + path, {
  method, headers: { apikey: anon, authorization: `Bearer ${actor}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const lookup: ReviewLookup = async (table, id) => {
  if (table === "projects" && id === job) return { id, user_id: REVIEW_USER, status: "Estimating", proposal_status: null };
  if (table === "estimates" && id === est) return { id, project_id: job };
  if (table === "estimate_lines" && id === line) return { id, estimate_id: est };
  if (table === "estimate_line_components" && id === component) return { id, estimate_line_id: line };
  return null;
};
const projectPath = `/rest/v1/projects?id=eq.${job}&user_id=eq.${REVIEW_USER}`;
describe("editable isolated review", () => {
  it.each([
    [projectPath, { programme_phases: [], start_date: "2026-10-19" }, "PATCH"],
    [projectPath, { proposal_introduction: "QA draft", scope_text: "QA", site_photos: [] }, "PATCH"],
    [`/rest/v1/estimates?id=eq.${est}`, { total_cost: 123, version_name: "QA" }, "PATCH"],
    ["/rest/v1/estimates", { project_id: job, version_name: "QA", is_active: false }, "POST"],
    [`/rest/v1/estimates?project_id=eq.${job}`, { is_active: false }, "PATCH"],
    ["/rest/v1/estimate_lines", { estimate_id: est, description: "QA", quantity: 1, unit_rate: 10 }, "POST"],
    [`/rest/v1/estimate_lines?id=eq.${line}&estimate_id=eq.${est}`, { unit_rate: 12 }, "PATCH"],
    ["/rest/v1/estimate_line_components", { estimate_line_id: line, component_type: "labour", quantity: 1, unit_rate: 12 }, "POST"],
    [`/rest/v1/estimate_line_components?id=eq.${component}`, { quantity: 2 }, "PATCH"],
  ] as const)("permits only scoped known save %s", async (path, body, method) => {
    const r = request(path, body, method);
    await expect(assertReviewFetch(r, req => assertEditableReviewFetch(req, lookup))).resolves.toBeUndefined();
    await expect(assertReviewFetch(r)).rejects.toThrow();
  });
  it.each([
    [projectPath, { proposal_sent_at: "now" }], [projectPath, { proposal_status: "sent" }],
    [projectPath, { status: "Active" }], [projectPath, { site_photos: [{ url: "https://example.test/photo" }] }],
    [projectPath, { user_id: "another" }], ["/rest/v1/projects", { name: "New job" }],
    ["/rest/v1/rpc/publish_proposal", {}], ["/rest/v1/rpc/create_phase1_project_graph", {}],
    ["/rest/v1/profiles?id=eq." + REVIEW_USER, { company_name: "QA" }],
    [`/rest/v1/estimates?id=eq.${est}`, { project_id: REVIEW_JOBS[1] }],
    [`/rest/v1/estimate_lines?id=eq.${line}`, { estimate_id: est }],
    [`/rest/v1/estimate_lines?id=eq.${line}&or=(id.eq.other)`, { quantity: 2 }],
    [`/rest/v1/estimate_lines?id=eq.${line}&id=eq.${est}`, { quantity: 2 }],
    ["/rest/v1/estimate_lines?description=eq.QA", { quantity: 2 }],
    ["/auth/v1/user", { password: "must-not-change" }], ["/auth/v1/signup", {}],
    ["/storage/v1/object/bucket", {}], ["/rest/v1/estimates", []],
  ])("refuses unknown or dangerous mutation %s", async (path, body) => {
    await expect(assertReviewFetch(request(path, body), req => assertEditableReviewFetch(req, lookup))).rejects.toThrow();
  });
  it("refuses deletes even for labelled lines", async () => {
    await expect(assertReviewFetch(request(`/rest/v1/estimate_lines?id=eq.${line}`, {}, "DELETE"), req => assertEditableReviewFetch(req, lookup))).rejects.toThrow();
  });
  it.each(["Active", "Completed", "Closed"])("refuses locked project %s", async status => {
    const locked: ReviewLookup = async (table, id) => table === "projects" ? { id, user_id: REVIEW_USER, status } : lookup(table, id);
    await expect(assertEditableReviewFetch(request(`/rest/v1/estimate_lines?id=eq.${line}`, { quantity: 2 }), locked)).rejects.toThrow();
  });
  it("refuses another owner, unlisted job or missing parent", async () => {
    for (const replacement of [{ id: job, user_id: "other", status: "Lead" }, { id: job, user_id: REVIEW_USER, status: "Lead", is_archived: true }, null]) {
      const foreign: ReviewLookup = async (table, id) => table === "projects" ? replacement : lookup(table, id);
      await expect(assertEditableReviewFetch(request(`/rest/v1/estimate_lines?id=eq.${line}`, { quantity: 2 }), foreign)).rejects.toThrow();
    }
    await expect(assertEditableReviewFetch(request("/rest/v1/estimates", { project_id: "44444444-4444-4444-8444-444444444444" }, "POST"), lookup)).rejects.toThrow();
  });
  it("rechecks current membership on every save and fails closed on lookup errors", async () => {
    const probe = vi.fn(lookup);
    const r = request(projectPath, { scope_text: "QA" });
    await assertEditableReviewFetch(r, probe);
    await assertEditableReviewFetch(r, probe);
    expect(probe).toHaveBeenCalledTimes(2);
    await expect(assertEditableReviewFetch(r, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  });
  it("requires the labelled authenticated user, not a service key", async () => {
    const r = request(projectPath, { scope_text: "QA" });
    r.headers.set("authorization", `Bearer ${anon}`);
    await expect(assertReviewFetch(r, req => assertEditableReviewFetch(req, lookup))).rejects.toThrow();
  });
  it("allows incoming POST only on the three reviewed workspace paths", () => {
    for (const path of ["/dashboard/projects/costs", "/dashboard/projects/schedule", "/dashboard/projects/proposal"]) expect(editablePage("POST", path)).toBe(true);
    for (const path of ["/api/send", "/admin", "/onboarding", "/dashboard/projects/new", "/login", "/auth/callback"]) expect(editablePage("POST", path)).toBe(false);
    expect(editablePage("DELETE", "/dashboard/projects/costs")).toBe(false);
  });
});
