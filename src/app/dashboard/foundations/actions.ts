"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import { Parser } from "expr-eval";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// --- SERVER ACTION: CALCULATE (Generates the DRAFT) ---
export async function calculateAction(formData: FormData) {
    const assemblyId = formData.get("assemblyId") as string;
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    // 1. Fetch Data (scoped to org)
    const { data: assembly } = await supabase
        .from("assemblies")
        .select("*")
        .eq("id", assemblyId)
        .eq("organization_id", orgId)
        .single();

    const { data: items } = await supabase
        .from("assembly_items")
        .select("*, cost_item:mom_items(*)")
        .eq("assembly_id", assemblyId)
        .eq("organization_id", orgId);

    const { data: options } = await supabase
        .from("assembly_options")
        .select("*, cost_item:mom_items(*)")
        .eq("assembly_id", assemblyId)
        .eq("organization_id", orgId);

    if (!assembly || !items) throw new Error("Assembly missing or unauthorized.");

    // 2. Parse Inputs
    const inputs: Record<string, number> = {};
    const requiredFields = (assembly.required_inputs as string[]) || [];
    for (const field of requiredFields) {
        const raw = formData.get(field);
        inputs[field] = raw ? parseFloat(raw as string) || 0 : 0;
    }
    const overhead = parseFloat(formData.get("overhead_pct") as string) || 0;
    const risk = parseFloat(formData.get("risk_pct") as string) || 0;
    const profit = parseFloat(formData.get("profit_pct") as string) || 0;

    // 3. Draft Generation Engine
    const parser = new Parser();
    const draftLines: any[] = [];

    const addLine = (item: any, isOption: boolean) => {
        let qty = 0;
        try {
            qty = parser.parse(item.quantity_formula).evaluate(inputs);
        } catch (e) {
            qty = 0;
        }

        if (!isFinite(qty)) qty = 0;

        const rate = parseFloat(item.cost_item?.base_rate || 0);
        const costItemId = item.cost_item?.id;
        const desc = isOption ? item.label : item.cost_item?.description;
        const unit = item.cost_item?.unit || "Each";

        draftLines.push({ costItemId, desc, unit, qty, rate, total: qty * rate });
    };

    items.forEach(i => addLine(i, false));

    if (options) {
        for (const opt of options) {
            if (formData.get(`opt_${opt.id}`) === "on") addLine(opt, true);
        }
    }

    return {
        assemblyId,
        assemblyName: assembly.name,
        draftLines,
        markups: { overhead, risk, profit }
    };
}

// --- SERVER ACTION: SAVE (Saves the EDITED Table) ---
export async function saveToProjectAction(formData: FormData) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    // Parse fields
    const assemblyId = formData.get("assemblyId") as string;
    const assemblyName = formData.get("assemblyName") as string;
    const oh = parseFloat(formData.get("overhead") as string) || 0;
    const risk = parseFloat(formData.get("risk") as string) || 0;
    const profit = parseFloat(formData.get("profit") as string) || 0;

    // Extract Lines (Arrays)
    const descriptions = formData.getAll("desc");
    const quantities = formData.getAll("qty");
    const rates = formData.getAll("rate");
    const units = formData.getAll("unit");

    let netTotal = 0;
    const linesToSave = descriptions.map((desc, i) => {
        const qty = parseFloat(quantities[i] as string) || 0;
        const rate = parseFloat(rates[i] as string) || 0;
        const total = qty * rate;
        netTotal += total;
        return {
            description: desc as string,
            quantity: qty,
            unit_rate: rate,
            unit: units[i] as string,
            line_total: total,
            sort_order: i + 1
        };
    });

    const totalCost = netTotal * (1 + (oh + risk + profit) / 100);

    // DB Operations: Get or Create current Project for the Org
    let { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!project) {
        const { data: newProj } = await supabase.from("projects").insert({
            organization_id: orgId,
            name: "Draft Quote #1",
            status: "draft"
        }).select().single();
        project = newProj;
    }

    const { data: est, error: estError } = await supabase.from("estimates").insert({
        project_id: project!.id,
        organization_id: orgId,
        version_name: assemblyName,
        total_cost: totalCost,
        overhead_pct: oh,
        profit_pct: profit,
        risk_pct: risk
    }).select().single();

    if (estError) throw new Error(estError.message);

    const lines = linesToSave.map(l => ({
        ...l,
        estimate_id: est.id,
        organization_id: orgId,
        assembly_id: assemblyId,
        mom_item_id: null
    }));

    const { error: lineError } = await supabase.from("estimate_lines").insert(lines);
    if (lineError) throw new Error(lineError.message);

    revalidatePath("/dashboard/foundations");
    redirect("/dashboard/foundations");
}
