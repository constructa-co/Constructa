import { REVIEW_ORIGIN, REVIEW_USER } from "./review-policy";

export const REVIEW_JOBS = ["5e96e56c-8287-4f3a-960d-b6fd1d085884", "de80fa98-8ec2-4e6b-a64e-9c4f0a8a83d1"];
export const editableReview = () => process.env.CONSTRUCTA_REVIEW_EDITABLE === "1";
const routes = new Set(["/dashboard/projects/costs", "/dashboard/projects/schedule", "/dashboard/projects/proposal"]);
export const editablePage = (method: string, pathname: string) => method === "POST" && routes.has(pathname);
type Row = Record<string, unknown>;
export type ReviewLookup = (table: "projects" | "estimates" | "estimate_lines" | "estimate_line_components", id: string) => Promise<Row | null>;
const projectFields = new Set([
  "programme_phases", "start_date", "proposal_introduction", "scope_text", "exclusions_text", "clarifications_text",
  "closing_statement", "validity_days", "site_photos", "selected_case_study_ids", "tc_overrides", "payment_schedule", "status",
]);
const estimateFields = new Set(["project_id", "version_name", "overhead_pct", "profit_pct", "risk_pct", "prelims_pct", "is_active", "total_cost", "manual_duration_days"]);
const lineFields = new Set(["estimate_id", "trade_section", "description", "quantity", "unit", "unit_rate", "line_total", "line_type", "cost_library_item_id", "mom_item_code", "notes"]);
const componentFields = new Set(["estimate_line_id", "component_type", "description", "quantity", "unit", "unit_rate", "manhours_per_unit", "sort_order"]);

// Resolve ownership afresh before every mutation; never trust an incoming
// project/estimate identifier or persist a process-global membership cache.
export async function assertEditableReviewFetch(request: Request, lookup: ReviewLookup) {
  const refuse = (): never => { throw new Error("REVIEW_EDIT_REQUEST_REFUSED"); };
  const url = new URL(request.url);
  if (url.origin !== REVIEW_ORIGIN || !["POST", "PATCH"].includes(request.method)) refuse();
  const body = await request.clone().json().catch(() => null) as Row | null;
  if (!body || Array.isArray(body) || typeof body !== "object" || !Object.keys(body).length) refuse();
  const payload = body as Row;
  const exactId = (key: string) => {
    const values = url.searchParams.getAll(key);
    if (values.length !== 1 || !/^eq\.[0-9a-f-]{36}$/.test(values[0])) return refuse();
    return values[0].slice(3);
  };
  if ([...url.searchParams.keys()].some(k => !["id", "project_id", "estimate_id", "estimate_line_id", "user_id", "select"].includes(k))) refuse();
  const project = async (id: unknown) => {
    if (typeof id !== "string" || !REVIEW_JOBS.includes(id)) refuse();
    const row = await lookup("projects", id as string);
    if (!row || row.id !== id || row.user_id !== REVIEW_USER || row.is_archived || row.proposal_accepted_at ||
      !["Lead", "Estimating", null].includes(row.status as string | null) ||
      ![null, undefined, "draft"].includes(row.proposal_status as string | null | undefined)) refuse();
  };
  const estimate = async (id: unknown) => {
    if (typeof id !== "string") refuse();
    const row = await lookup("estimates", id as string);
    if (!row || row.id !== id) return refuse();
    await project(row.project_id);
    return row;
  };
  const line = async (id: unknown) => {
    if (typeof id !== "string") refuse();
    const row = await lookup("estimate_lines", id as string);
    if (!row || row.id !== id) return refuse();
    await estimate(row.estimate_id);
    return row;
  };
  const table = url.pathname.slice("/rest/v1/".length);
  const allowed = table === "projects" ? projectFields : table === "estimates" ? estimateFields : table === "estimate_lines" ? lineFields : table === "estimate_line_components" ? componentFields : null;
  if (!url.pathname.startsWith("/rest/v1/") || !allowed || Object.keys(payload).some(k => !allowed.has(k))) refuse();
  if (request.method === "PATCH" && ["project_id", "estimate_id", "estimate_line_id", "component_type"].some(k => k in payload)) refuse();
  if (table === "projects") {
    if (request.method !== "PATCH" || url.searchParams.get("user_id") !== `eq.${REVIEW_USER}`) refuse();
    await project(exactId("id"));
    if (("site_photos" in payload && (!Array.isArray(payload.site_photos) || payload.site_photos.length !== 0)) ||
      ("status" in payload && (payload.status !== "Estimating" || Object.keys(payload).length !== 1))) refuse();
  } else if (table === "estimates") {
    if (request.method === "POST") await project(payload.project_id);
    else if (!url.searchParams.has("id") && payload.is_active === false && Object.keys(payload).length === 1) await project(exactId("project_id"));
    else await estimate(exactId("id"));
  } else if (table === "estimate_lines") {
    if (request.method === "POST") await estimate(payload.estimate_id);
    else await line(exactId("id"));
  } else if (table === "estimate_line_components") {
    if (request.method === "POST") await line(payload.estimate_line_id);
    else {
      const id = exactId("id");
      const row = await lookup("estimate_line_components", id);
      if (!row || row.id !== id) refuse();
      await line(row?.estimate_line_id);
    }
  }
}
