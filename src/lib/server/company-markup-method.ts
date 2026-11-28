import { markupMethodForNewEstimate, type MarkupMethod } from "@/lib/financial";

interface ProfileReader {
    from: (table: "profiles") => {
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                maybeSingle: () => PromiseLike<{ data: { markup_method?: unknown } | null }>;
            };
        };
    };
}

/**
 * The markup method a NEW estimate takes from the company's choice. Read once
 * when the estimate is created and stored on it, so a later change to the
 * company setting never re-prices an estimate or a proposal already sent.
 * A missing profile, missing value or failed read gives the default (on net).
 */
export async function companyMarkupMethod(supabase: unknown, userId: string): Promise<MarkupMethod> {
    try {
        const { data } = await (supabase as ProfileReader)
            .from("profiles")
            .select("markup_method")
            .eq("id", userId)
            .maybeSingle();
        return markupMethodForNewEstimate(data?.markup_method);
    } catch {
        return markupMethodForNewEstimate(null);
    }
}
