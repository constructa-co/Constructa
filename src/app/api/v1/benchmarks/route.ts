import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";

// ── Rate limiting ─────────────────────────────────────────────────────────────

async function checkRateLimit(
  supabase: ReturnType<typeof createAdminClient>,
  keyId: string,
  limitPerHour: number
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("api_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyId)
    .gte("created_at", since);
  return (count ?? 0) < limitPerHour;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

// ── GET /api/v1/benchmarks ────────────────────────────────────────────────────
// Query params: project_type, value_band, metric
// Auth: Authorization: Bearer ck_live_xxxxx

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();

  // ── 1. Authenticate ────────────────────────────────────────────────────────
  const rawKey = extractBearerToken(request);
  if (!rawKey) {
    return NextResponse.json(
      { error: "Missing Authorization header. Use: Authorization: Bearer <api_key>" },
      { status: 401 }
    );
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const { data: apiKey } = await supabase
    .from("api_keys")
    .select("id, tier, rate_limit_per_hour, is_active, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (!apiKey || !apiKey.is_active || apiKey.revoked_at) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  // ── 2. Rate limit ──────────────────────────────────────────────────────────
  const allowed = await checkRateLimit(supabase, apiKey.id, apiKey.rate_limit_per_hour);
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Tier '${apiKey.tier}' allows ${apiKey.rate_limit_per_hour} requests/hour.` },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // ── 3. Parse query params ──────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const projectType = searchParams.get("project_type");
  const valueBand   = searchParams.get("value_band");

  // ── 4. Query benchmark data ────────────────────────────────────────────────
  type BenchmarkRow = {
    project_type: string | null;
    contract_value_band: string | null;
    gross_margin_pct: number | null;
    variation_rate_pct: number | null;
    programme_delay_days: number | null;
    subcontract_cost_pct: number | null;
    planned_duration_days: number | null;
    actual_duration_days: number | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("project_benchmarks")
    .select(
      "project_type, contract_value_band, gross_margin_pct, variation_rate_pct, " +
      "programme_delay_days, subcontract_cost_pct, planned_duration_days, actual_duration_days"
    );

  if (projectType) query = query.eq("project_type", projectType);
  if (valueBand)   query = query.eq("contract_value_band", valueBand);

  const { data: rawRows, error } = await query.limit(500);
  const rows = (rawRows ?? []) as BenchmarkRow[];

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // ── 5. Aggregate into summary rows ────────────────────────────────────────
  const bandOrder = ["0-50k", "50k-100k", "100k-250k", "250k-500k", "500k+"];

  type GroupKey = string;
  const groups = new Map<GroupKey, BenchmarkRow[]>();
  for (const r of rows) {
    const key = `${r.project_type ?? "Unknown"}||${r.contract_value_band ?? "Unknown"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const avg = (items: BenchmarkRow[], field: keyof BenchmarkRow) => {
    const vals = items
      .map(i => i[field] as number | null)
      .filter((v): v is number => v != null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const data = Array.from(groups.entries())
    .map(([key, items]) => {
      const [type, band] = key.split("||");
      const onTime = items.filter(i => (i.programme_delay_days ?? 0) <= 0).length;
      return {
        project_type:              type === "Unknown" ? null : type,
        contract_value_band:       band === "Unknown" ? null : band,
        sample_size:               items.length,
        avg_gross_margin_pct:      avg(items, "gross_margin_pct"),
        avg_variation_rate_pct:    avg(items, "variation_rate_pct"),
        avg_programme_delay_days:  avg(items, "programme_delay_days"),
        avg_subcontract_cost_pct:  avg(items, "subcontract_cost_pct"),
        avg_planned_duration_days: avg(items, "planned_duration_days"),
        pct_delivered_on_time:     items.length > 0
          ? Math.round((onTime / items.length) * 100)
          : null,
      };
    })
    .sort((a, b) => {
      const typeCmp = (a.project_type ?? "").localeCompare(b.project_type ?? "");
      if (typeCmp !== 0) return typeCmp;
      return bandOrder.indexOf(a.contract_value_band ?? "") - bandOrder.indexOf(b.contract_value_band ?? "");
    });

  // ── 6. Log usage + update last_used_at ────────────────────────────────────
  await Promise.all([
    supabase.from("api_usage_log").insert({
      api_key_id:      apiKey.id,
      endpoint:        "/api/v1/benchmarks",
      query_params:    Object.fromEntries(searchParams.entries()),
      response_status: 200,
    }),
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id),
    supabase.rpc("increment_api_key_requests", { key_id: apiKey.id }),
  ]);

  return NextResponse.json({
    data,
    meta: {
      total_records:   rows.length,
      result_groups:   data.length,
      filters_applied: { project_type: projectType, value_band: valueBand },
      generated_at:    new Date().toISOString(),
      api_version:     "v1",
      docs:            "https://constructa.co/docs/api",
    },
  }, {
    headers: {
      "Content-Type":                "application/json",
      "X-RateLimit-Limit":           String(apiKey.rate_limit_per_hour),
      "X-RateLimit-Remaining":       "—",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
