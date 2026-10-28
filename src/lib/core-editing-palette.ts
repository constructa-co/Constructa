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

/** Radio/checkbox tile border when the option is selected. */
export function coreSelectedChoiceBorder(isDark: boolean, chosen: boolean): string {
    return chosen
        ? "border-emerald-600 ring-1 ring-emerald-600/50"
        : isDark
          ? "border-[#3a3a3a]"
          : "border-gray-300";
}
