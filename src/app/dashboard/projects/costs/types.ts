export interface EstimateLineComponent {
    id: string;
    estimate_line_id: string;
    component_type: "labour" | "plant" | "material" | "consumable" | "temp_works" | "subcontract";
    description: string;
    quantity: number;
    unit: string;
    unit_rate: number;
    line_total: number;
    manhours_per_unit: number;
    total_manhours: number;
    sort_order: number;
}

export interface EstimateLine {
    id: string;
    estimate_id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_rate: number;
    line_total: number;
    trade_section: string;
    line_type: string;
    cost_library_item_id?: string | null;
    mom_item_code?: string | null;
    notes?: string | null;
    pricing_mode: "simple" | "buildup";
    estimate_line_components: EstimateLineComponent[];
}

export interface Estimate {
    id: string;
    project_id: string;
    version_name: string;
    overhead_pct: number;
    profit_pct: number;
    risk_pct: number;
    prelims_pct: number;
    total_cost: number;
    is_active: boolean;
    estimate_lines: EstimateLine[];
}

export interface CostLibraryItem {
    id: string;
    code: string;
    description: string;
    unit: string;
    base_rate: number;
    category: string;
}

export interface LabourRate {
    id: string;
    trade: string;
    role: string;
    day_rate: number;
    hourly_rate: number;
    region: string;
    organization_id: string | null;
    is_system_default: boolean;
}

export interface RateBuildup {
    id: string;
    name: string;
    unit: string;
    built_up_rate: number;
    trade_section: string;
    components: { type: string; description: string; quantity: number; unit: string; unit_rate: number; manhours_per_unit: number }[];
    total_manhours_per_unit: number;
}
