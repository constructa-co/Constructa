import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QuickQuoteClient from "./quick-quote-client";
import type { QuickQuoteTemplate } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Sprint 58 Phase 2 item #10 — Quick Quote entry point.
 *
 * Landing page for the additive "get to a branded PDF in under 5 minutes"
 * flow. Loads the 6 system templates plus any custom templates the
 * contractor has saved, and hands them to the client picker.
 *
 * NOT a replacement for the full 5-step wizard. The "Full Control"
 * button at the bottom of the picker drops the user straight into
 * /dashboard/projects/new so large / bespoke jobs keep the existing path.
 */
export default async function QuickQuotePage() {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) redirect("/login");

    // Fetch templates directly here so the page is a single server render
    // with no client-side loading spinner. RLS already scopes to system +
    // the current user's custom templates.
    const { data: templates } = await supabase
        .from("project_templates")
        .select(
            "id, name, description, icon, project_type, default_scope, default_trade_sections, default_line_items, default_prelims_pct, default_overhead_pct, default_risk_pct, default_profit_pct",
        )
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-8">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <span className="text-2xl">⚡</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Quick Quote</h1>
                        <p className="text-sm text-slate-400">
                            Pick a template and go from click to branded PDF in under 5 minutes.
                            Perfect for smaller domestic jobs where the full 5-step wizard feels
                            heavy.
                        </p>
                    </div>
                </div>
            </header>
            <QuickQuoteClient templates={(templates ?? []) as unknown as QuickQuoteTemplate[]} />
        </div>
    );
}
