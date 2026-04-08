"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidate(projectId: string) {
    revalidatePath(`/dashboard/projects/handover-documents?projectId=${projectId}`);
}

// Standard handover checklist seeded on first open
const STANDARD_ITEMS = [
    { category: "O&M Manual",            title: "Mechanical Services O&M Manual",       required: true  },
    { category: "O&M Manual",            title: "Electrical Services O&M Manual",        required: true  },
    { category: "O&M Manual",            title: "Fire Alarm O&M Manual",                 required: true  },
    { category: "Warranty",              title: "Structural Warranty",                   required: true  },
    { category: "Warranty",              title: "Roofing Guarantee",                     required: true  },
    { category: "Warranty",              title: "Waterproofing Guarantee",               required: false },
    { category: "As-Built Drawing",      title: "Architectural As-Built Drawings",       required: true  },
    { category: "As-Built Drawing",      title: "Structural As-Built Drawings",          required: true  },
    { category: "As-Built Drawing",      title: "MEP As-Built Drawings",                 required: false },
    { category: "Test Certificate",      title: "Electrical Installation Certificate",   required: true  },
    { category: "Test Certificate",      title: "Gas Safe Certificate",                  required: false },
    { category: "Test Certificate",      title: "Fire Alarm Commissioning Certificate",  required: true  },
    { category: "Test Certificate",      title: "Lift Commissioning Certificate",        required: false },
    { category: "H&S File",             title: "CDM Health & Safety File",              required: true  },
    { category: "Compliance Certificate",title: "Building Regulations Completion Cert", required: true  },
    { category: "Compliance Certificate",title: "Planning Discharge of Conditions",     required: false },
];

export async function seedHandoverItemsAction(projectId: string) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    // Only seed if table is empty for this project
    const { count } = await supabase
        .from("handover_items")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
    if ((count ?? 0) > 0) return;

    const rows = STANDARD_ITEMS.map((item, i) => ({
        ...item,
        project_id: projectId,
        user_id: userId,
        status: "Pending",
        order_index: i,
    }));

    const { error } = await supabase.from("handover_items").insert(rows);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}

export async function createHandoverItemAction(data: {
    project_id: string;
    category: string;
    title: string;
    description?: string;
    required: boolean;
    order_index: number;
}) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    const { error } = await supabase.from("handover_items").insert([{
        ...data,
        user_id: userId,
        status: "Pending",
    }]);
    if (error) throw new Error(error.message);
    revalidate(data.project_id);
}

export async function updateHandoverItemAction(
    id: string,
    projectId: string,
    data: {
        category?: string;
        title?: string;
        description?: string;
        status?: string;
        required?: boolean;
        date_received?: string | null;
        issued_to?: string;
        notes?: string;
    }
) {
    const supabase = createClient();
    const { error } = await supabase
        .from("handover_items")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}

export async function deleteHandoverItemAction(id: string, projectId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("handover_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}
