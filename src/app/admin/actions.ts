"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const VALID_CATEGORIES = [
  "Supabase",
  "Vercel",
  "OpenAI",
  "Stripe Fees",
  "Marketing",
  "Tools",
  "Other",
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

// ─── saveCostEntryAction ───────────────────────────────────────────────────────

export async function saveCostEntryAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const monthRaw = (formData.get("month") as string | null)?.trim();
    const category = (formData.get("category") as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const amountRaw = formData.get("amount_gbp");

    // Validate month
    if (!monthRaw || !/^\d{4}-\d{2}$/.test(monthRaw)) {
      return { success: false, error: "Invalid month format (expected YYYY-MM)" };
    }
    const month = `${monthRaw}-01`; // Convert YYYY-MM → YYYY-MM-01

    // Validate category
    if (!category || !(VALID_CATEGORIES as readonly string[]).includes(category)) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
      };
    }

    // Validate amount
    const amount_gbp = Number(amountRaw);
    if (isNaN(amount_gbp) || amount_gbp < 0) {
      return { success: false, error: "Amount must be a number >= 0" };
    }

    const supabase = createAdminClient();

    const { error } = await supabase.from("admin_costs").insert({
      month,
      category: category as ValidCategory,
      description,
      amount_gbp,
    });

    if (error) {
      console.error("[saveCostEntryAction] Supabase error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[saveCostEntryAction] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─── sendReportEmailAction ────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function sendReportEmailAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const toRaw = (formData.get("to") as string | null)?.trim();
    const subject = (formData.get("subject") as string | null)?.trim();
    const body = (formData.get("body") as string | null)?.trim();

    if (!toRaw) {
      return { success: false, error: "At least one recipient email is required" };
    }

    // Parse and validate emails
    const emails = toRaw
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const invalidEmails = emails.filter((e) => !isValidEmail(e));
    if (invalidEmails.length > 0) {
      return {
        success: false,
        error: `Invalid email address(es): ${invalidEmails.join(", ")}`,
      };
    }
    if (emails.length === 0) {
      return { success: false, error: "At least one valid email is required" };
    }

    if (!subject) {
      return { success: false, error: "Subject is required" };
    }
    if (!body) {
      return { success: false, error: "Report body is empty" };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[sendReportEmailAction] RESEND_API_KEY is not set");
      return { success: false, error: "Email service is not configured" };
    }

    // Use Resend API directly via fetch
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Constructa Admin <admin@constructa.co>",
        to: emails,
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        detail = json?.message ?? detail;
      } catch {
        // ignore parse error
      }
      console.error("[sendReportEmailAction] Resend API error:", detail);
      return { success: false, error: `Failed to send email: ${detail}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[sendReportEmailAction] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
