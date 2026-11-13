/**
 * Charcoal/sage focus and selection classes for ordinary editing controls.
 * Matches workspace-styles and proposal workspace accent tokens — not status/link blues.
 */

export const coreFocusRing =
    "focus:outline-none focus:ring-2 focus:ring-emerald-600";

export const coreFocusVisibleRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";

export const corePrimaryButton =
    "bg-[#c9efcf] hover:bg-[#e0f9e3] text-[#182c1b]";

export const corePrimaryButtonLarge =
    `${corePrimaryButton} min-h-12 px-6 rounded-xl text-base font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed`;

/** Dark profile / settings fields (slate panel, emerald focus — not link blue). */
export const coreProfileFieldBase =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500";

export const coreProfileField = `${coreProfileFieldBase} h-11 ${coreFocusRing}`;

export const coreProfileTextarea = `${coreProfileFieldBase} py-2 ${coreFocusRing}`;

export const coreFormAccent = "accent-emerald-600";

export const coreProfileSecondaryLink =
    `inline-flex items-center min-h-11 px-4 rounded-lg border border-emerald-500/40 text-sm font-semibold text-emerald-200 hover:bg-emerald-950/40 ${coreFocusVisibleRing}`;

export const coreSuggestionPrimary =
    `min-h-11 px-3 rounded-lg text-sm font-semibold ${corePrimaryButton} hover:bg-[#e0f9e3]`;

/** Theme-aware pipeline link colour + hover + focus (typography at call site). */
export function corePipelineLinkColor(isDark: boolean): string {
    return `${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-700 hover:text-emerald-800"} hover:underline ${coreFocusVisibleRing}`;
}

export function corePipelineTextLinkSmThemed(isDark: boolean): string {
    return `text-xs font-semibold ${corePipelineLinkColor(isDark)}`;
}

/** 9px / font-black board micro-links: colour only — do not merge with text-xs/font-semibold. */
export function corePipelineMicroLinkColor(isDark: boolean): string {
    return corePipelineLinkColor(isDark);
}

/** Muted pipeline chrome icon buttons (e.g. Lead column “New lead”) — hover matches link emerald pair. */
export function corePipelineMutedIconButton(isDark: boolean): string {
    const hover = isDark ? "hover:text-emerald-400" : "hover:text-emerald-700";
    const surface = isDark ? "hover:bg-white/10 text-slate-500" : "hover:bg-gray-100 text-gray-400";
    return `inline-flex items-center justify-center transition-colors ${surface} ${hover} ${coreFocusVisibleRing}`;
}

/** Radio/checkbox tile border when the option is selected. */
export const coreProfileSaveSubmit =
    "w-full h-14 rounded-xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

export function coreSelectedChoiceBorder(isDark: boolean, chosen: boolean): string {
    return chosen
        ? "border-emerald-600 ring-1 ring-emerald-600/50"
        : isDark
          ? "border-[#3a3a3a]"
          : "border-gray-300";
}
