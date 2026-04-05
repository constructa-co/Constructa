// Shared constants — NOT a server action file.
// Import from here in both actions.ts (server) and client components.

export const COST_TYPES = [
    "labour",
    "materials",
    "plant",
    "subcontract",
    "overhead",
    "prelims",
    "other",
] as const;

export type CostType = typeof COST_TYPES[number];

export const TRADE_SECTIONS = [
    "Preliminaries",
    "Groundworks",
    "Concrete",
    "Drainage",
    "Utilities",
    "Surfacing",
    "Masonry",
    "Carpentry",
    "Electrical",
    "Plumbing",
    "Finishes",
    "External Works",
    "Subcontract",
    "Provisional Sums",
    "General",
] as const;

export type TradeSection = typeof TRADE_SECTIONS[number];
