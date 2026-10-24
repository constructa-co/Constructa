import { draftFromProject, TEXT_LIMITS } from "./proposal-review";
import { splitScope } from "./guided-brief";

export type PricingFullScopeSource = { scope_text: string | null; brief_scope: string | null };

export function pricingFullScopeDraft(source: PricingFullScopeSource): string {
    return draftFromProject({ id: "pricing", name: "", ...source }, () => "unused").scope;
}

export function sameFullScopeSource(a: PricingFullScopeSource, b: PricingFullScopeSource): boolean {
    return a.scope_text === b.scope_text && a.brief_scope === b.brief_scope;
}

export function pricingFullScopeError(source: PricingFullScopeSource, scope: string): string | null {
    if (scope.length > TEXT_LIMITS.scope) return "Keep the scope to 20,000 characters or fewer. Nothing has been shortened.";
    if (!scope.trim() && splitScope(source.brief_scope ?? "").work.trim()) {
        return "The saved brief's work would reappear in the proposal if scope were blank. Review the brief before clearing scope; the brief has not been changed here.";
    }
    return null;
}
