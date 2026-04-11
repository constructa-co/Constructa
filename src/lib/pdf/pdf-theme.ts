/**
 * Constructa — PDF brand themes.
 *
 * Sprint 58 Phase 3 item #3. Previously every PDF generator had its
 * own copy of the theme palette (navy/forest/slate). Seven generators,
 * three copies of each palette. Any rebrand meant touching 21 places.
 *
 * This module is the single source of truth for PDF colours and layout
 * constants. All new PDFs should import from here. The proposal PDF
 * (1,935 lines) will migrate to it in a follow-up — it currently
 * duplicates this logic but the migration is gated on a visual-regression
 * pass to make sure the PDF output is byte-identical, which is too much
 * risk for this commit.
 */

// ── RGB tuple helper ────────────────────────────────────────────────────────

export type RgbTuple = [number, number, number];

// ── Page geometry (A4 portrait, mm) ─────────────────────────────────────────

export const PAGE_GEOMETRY = {
    width: 210,
    height: 297,
    marginLeft: 14,
    marginRight: 196,
    contentWidth: 182,
    headerHeight: 12,
    footerHeight: 10,
    contentTop: 20,  // headerHeight + 8
    contentBottom: 281, // pageH - footerHeight - 6
} as const;

// ── Theme palette shape ─────────────────────────────────────────────────────

export interface PdfThemePalette {
    /** Primary brand colour — used for header bars, section markers, tables. */
    primary:      RgbTuple;
    /** Slightly lighter shade of primary — used for cover overlays. */
    primaryLight: RgbTuple;
    /** Mid-primary used for inner table rows and feature blocks. */
    primaryMid:   RgbTuple;
    /** Accent colour — used for header text on primary backgrounds, stat highlights. */
    accent:       RgbTuple;
    accentText:   RgbTuple;
    white:        RgbTuple;
    /** Light background for alternating rows and side cards. */
    surface:      RgbTuple;
    surfaceMid:   RgbTuple;
    /** Light dividing lines. */
    borderLight:  RgbTuple;
    /** Primary body text colour. */
    textDark:     RgbTuple;
    textMid:      RgbTuple;
    textLight:    RgbTuple;
    /** Muted labels e.g. "PROPOSAL & FEE PROPOSAL". */
    muted:        RgbTuple;
}

export type PdfThemeName = "slate" | "navy" | "forest";

// ── Theme definitions ──────────────────────────────────────────────────────

const SLATE: PdfThemePalette = {
    primary:      [13,  13,  13],
    primaryLight: [26,  26,  26],
    primaryMid:   [42,  42,  42],
    accent:       [255, 255, 255],
    accentText:   [255, 255, 255],
    white:        [255, 255, 255],
    surface:      [248, 248, 248],
    surfaceMid:   [240, 240, 240],
    borderLight:  [220, 220, 220],
    textDark:     [20,  20,  20],
    textMid:      [80,  80,  80],
    textLight:    [130, 130, 130],
    muted:        [160, 160, 160],
};

const NAVY: PdfThemePalette = {
    primary:      [10,  22,  40],
    primaryLight: [18,  38,  68],
    primaryMid:   [30,  55,  95],
    accent:       [201, 168, 76],
    accentText:   [201, 168, 76],
    white:        [255, 255, 255],
    surface:      [248, 248, 248],
    surfaceMid:   [240, 240, 240],
    borderLight:  [220, 220, 220],
    textDark:     [20,  20,  20],
    textMid:      [80,  80,  80],
    textLight:    [130, 130, 130],
    muted:        [160, 155, 140],
};

const FOREST: PdfThemePalette = {
    primary:      [26,  58,  42],
    primaryLight: [38,  78,  58],
    primaryMid:   [55,  105, 80],
    accent:       [232, 224, 208],
    accentText:   [232, 224, 208],
    white:        [255, 255, 255],
    surface:      [250, 249, 246],
    surfaceMid:   [242, 238, 230],
    borderLight:  [218, 212, 198],
    textDark:     [20,  20,  15],
    textMid:      [75,  72,  60],
    textLight:    [128, 122, 108],
    muted:        [180, 174, 158],
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Return the palette for a theme name. Falls back to slate on unknown input
 * so a corrupt profile row can never crash a PDF build.
 */
export function getPdfTheme(themeName?: string | null): PdfThemePalette {
    switch (themeName) {
        case "navy":   return NAVY;
        case "forest": return FOREST;
        case "slate":  return SLATE;
        default:       return SLATE;
    }
}

// ── Gantt colour palette ────────────────────────────────────────────────────
// Proposal PDF, final account PDF and the programme sheet all need the same
// phase-colour lookup for their Gantt renders. Single source of truth here.

export const GANTT_COLORS: Record<string, RgbTuple> = {
    blue:   [59,  130, 246],
    green:  [34,  197, 94],
    orange: [249, 115, 22],
    purple: [168, 85,  247],
    slate:  [100, 116, 139],
    red:    [239, 68,  68],
    teal:   [20,  184, 166],
    pink:   [236, 72,  153],
    amber:  [245, 158, 11],
};
