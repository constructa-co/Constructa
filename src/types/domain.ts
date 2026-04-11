/**
 * Constructa — Core domain type interfaces.
 *
 * Sprint 58 Phase 3 item #2. Perplexity audit flagged 357+ `any` types
 * across 64 files, with the worst offenders being:
 *
 *   proposal-pdf-button.tsx           39 anys
 *   p-and-l/page.tsx                  26
 *   contracts/client-contract-editor  21
 *   overview/page.tsx                 20
 *   live/page.tsx                     19
 *   log-cost-sheet.tsx                15+
 *
 * All of these files passed `any` around because there was no canonical
 * type to reach for. This module is that canonical type source. It
 * describes the DB row shapes (close-to-Supabase but with the slight
 * narrowing we want at the app layer — e.g. enum-narrowed statuses,
 * explicit null vs optional).
 *
 * Adoption strategy:
 *   1. This file introduces the types and exports them from a stable
 *      @/types/domain path.
 *   2. Callers migrate incrementally by replacing `any` with the
 *      interface. Every file converted removes a chunk from the 357
 *      total.
 *   3. Nothing breaks if a file stays on `any` — both can coexist.
 *
 * Intentional design choices:
 *   - Numeric columns (prices, percentages) are typed as `number` here
 *     even though Supabase returns them as strings, because every caller
 *     passes them through `Number(...)` or `toNumber(...)` from
 *     src/lib/financial.ts. Using `string | number` on every numeric
 *     field would burden callers with coercion boilerplate. The
 *     canonical financial helpers in src/lib/financial.ts already
 *     accept `number | string | null | undefined`.
 *   - JSONB fields are typed by structural interface where possible
 *     (programme_phases, payment_schedule) and Record<string, unknown>
 *     where shape genuinely varies (tc_overrides, risk_register).
 *   - Optional fields use `?:` + `null` because Supabase selects
 *     return null for un-set fields — not undefined.
 */

// ── Shared primitives ───────────────────────────────────────────────────────

export type Uuid = string;
export type IsoDate = string;        // "YYYY-MM-DD"
export type IsoDateTime = string;    // "YYYY-MM-DDTHH:mm:ssZ"

export type ProjectStatus =
    | "Lead"
    | "Estimating"
    | "Proposal Sent"
    | "Active"
    | "Won"
    | "Completed"
    | "Lost"
    | "Draft"
    | "active"; // legacy lowercase — still in the DB for some rows

export type ProposalStatus =
    | "draft"
    | "sent"
    | "viewed"
    | "accepted"
    | "declined"
    | null;

export type TcTier = "domestic" | "commercial" | "specialist" | null;

export type CostType =
    | "labour"
    | "materials"
    | "plant"
    | "subcontract"
    | "overhead"
    | "prelims"
    | "other";

export type CostStatus = "actual" | "committed";

export type PricingMode = "simple" | "buildup";

export type RateMode = "simple" | "full";

export type InvoiceStatus = "Draft" | "Sent" | "Paid";

export type InvoiceType = "Interim" | "Final";

// ── projects ────────────────────────────────────────────────────────────────

export interface ProgrammePhase {
    id?: string;
    name: string;
    calculatedDays: number;
    manualDays: number | null;
    manhours: number;
    startOffset: number;
    color?: string;
    dependsOn?: number[];
    // Live tracking (Sprint 31)
    pct_complete?: number;
    actual_start_date?: IsoDate | null;
    actual_finish_date?: IsoDate | null;
    delay_reason?: string;
    delay_category?: string;
    // Legacy fields present on some older rows
    duration_days?: number;
    duration_unit?: "Hours" | "Days" | "Weeks";
    start_date?: IsoDate;
}

export interface PaymentScheduleRow {
    id: string;
    stage: string;
    description?: string;
    percentage: number;
    amount?: number;
}

export interface SitePhoto {
    url: string;
    caption: string;
}

export interface RiskItem {
    type: string;
    description: string;
    likelihood?: "Low" | "Medium" | "High";
    impact?: "Low" | "Medium" | "High";
    mitigation?: string;
}

export interface TcOverride {
    clause_number: number;
    title: string;
    body: string;
    hidden?: boolean;
    custom?: boolean;
}

export interface ContractReviewFlag {
    clause: string;
    severity: "Red" | "Amber" | "Green";
    description?: string;
    recommendation?: string;
    dismissed?: boolean;
}

export interface Project {
    id: Uuid;
    user_id: Uuid;
    tenant_id?: Uuid | null;
    organization_id?: Uuid | null;

    // Core
    name: string;
    status?: ProjectStatus | string | null;
    project_type?: string | null;
    client_type?: string | null;
    created_at: IsoDateTime;
    start_date?: IsoDate | null;

    // Client + site
    client_name?: string | null;
    client_email?: string | null;
    client_phone?: string | null;
    client_address?: string | null;
    site_address?: string | null;
    postcode?: string | null;
    lat?: number | null;
    lng?: number | null;
    region?: string | null;

    // Brief
    brief_scope?: string | null;
    brief_trade_sections?: string[] | null;
    brief_completed?: boolean | null;

    // Proposal
    proposal_introduction?: string | null;
    scope_text?: string | null;
    exclusions?: string | null;
    exclusions_text?: string | null;
    clarifications?: string | null;
    clarifications_text?: string | null;
    contract_exclusions?: string | null;
    contract_clarifications?: string | null;
    closing_statement?: string | null;
    discount_pct?: number | null;
    discount_reason?: string | null;
    selected_case_study_ids?: (number | string)[] | null;
    proposal_capability?: string | null;
    proposal_company_name?: string | null;
    proposal_token?: string | null;
    proposal_status?: ProposalStatus;
    proposal_sent_at?: IsoDateTime | null;
    proposal_accepted_at?: IsoDateTime | null;
    proposal_accepted_by?: string | null;
    proposal_accepted_ip?: string | null;
    current_version_number?: number | null;
    proposal_complexity?: "quick" | "full" | null;
    template_id?: Uuid | null;

    // Contracts
    tc_tier?: TcTier;
    tc_overrides?: TcOverride[] | null;
    risk_register?: RiskItem[] | null;
    contract_review_flags?: ContractReviewFlag[] | null;
    uploaded_contract_text?: string | null;
    client_contract_clauses?: Record<string, unknown> | null;

    // Programme
    programme_phases?: ProgrammePhase[] | null;
    gantt_phases?: ProgrammePhase[] | null;

    // Payment schedule
    payment_schedule?: PaymentScheduleRow[] | null;
    payment_schedule_type?: "percentage" | "milestone" | null;
    payment_terms?: string | null;

    // Photos
    site_photos?: SitePhoto[] | null;

    // Commercials
    potential_value?: number | null;
    retention_percent?: number | null;

    // Archive
    is_archived?: boolean | null;
    archived_at?: IsoDateTime | null;
    archived_by?: Uuid | null;
    archive_reason?: string | null;
}

// ── estimates ───────────────────────────────────────────────────────────────

export interface EstimateLine {
    id: Uuid;
    estimate_id: Uuid;
    organization_id?: Uuid | null;
    trade_section?: string | null;
    description?: string | null;
    unit?: string | null;
    quantity?: number | null;
    unit_rate?: number | null;
    line_total?: number | null;
    total_hours?: number | null;
    sort_order?: number | null;
    pricing_mode?: PricingMode | null;
    line_type?: string | null;
    cost_library_item_id?: Uuid | null;
    mom_item_id?: Uuid | null;
    mom_item_code?: string | null;
    client_ref?: string | null;
    notes?: string | null;
    assembly_id?: Uuid | null;
    created_at?: IsoDateTime;
    // Build-up components loaded via nested select
    estimate_line_components?: EstimateLineComponent[];
}

export type ComponentType =
    | "labour"
    | "plant"
    | "material"
    | "consumable"
    | "temp_works"
    | "subcontract";

export interface EstimateLineComponent {
    id: Uuid;
    estimate_line_id: Uuid;
    component_type: ComponentType;
    description?: string | null;
    quantity?: number | null;
    unit?: string | null;
    unit_rate?: number | null;
    manhours_per_unit?: number | null;
    total_manhours?: number | null;
    line_total?: number | null;
    sort_order?: number | null;
}

export interface Estimate {
    id: Uuid;
    project_id: Uuid;
    organization_id?: Uuid | null;
    version_name?: string | null;
    is_active?: boolean | null;
    total_cost?: number | null;
    prelims_pct?: number | null;
    overhead_pct?: number | null;
    risk_pct?: number | null;
    profit_pct?: number | null;
    discount_pct?: number | null;
    discount_reason?: string | null;
    is_client_boq: boolean;
    client_boq_filename?: string | null;
    manual_duration_days?: number | null;
    start_delay_days?: number | null;
    created_at?: IsoDateTime;
    // Nested select
    estimate_lines?: EstimateLine[];
}

// ── profiles ────────────────────────────────────────────────────────────────

export type PdfTheme = "slate" | "navy" | "forest";

export interface CaseStudy {
    id?: string;
    projectName?: string;
    projectType?: string;
    contractValue?: string;
    programmeDuration?: string;
    client?: string;
    location?: string;
    whatWeDelivered?: string;
    valueAdded?: string;
    photos?: string[];
}

export interface Profile {
    id: Uuid;
    company_name?: string | null;
    logo_url?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    website?: string | null;
    company_number?: string | null;
    vat_number?: string | null;
    years_trading?: number | null;
    business_type?: string | null;
    specialisms?: string | null;
    preferred_trades?: string[] | null;
    capability_statement?: string | null;
    insurance_details?: string | null;
    accreditations?: string | null;
    md_name?: string | null;
    md_message?: string | null;
    pdf_theme?: PdfTheme | null;
    case_studies?: CaseStudy[] | null;
    financial_year_start_month?: number | null;
    country?: string | null;
    signup_source?: string | null;
    data_consent?: boolean | null;
    data_consent_at?: IsoDateTime | null;
    active_organization_id?: Uuid | null;
    theme_preference?: string | null;
    sales_email?: string | null;
    sales_phone?: string | null;
    accounts_email?: string | null;
}

// ── variations ──────────────────────────────────────────────────────────────

export type VariationStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected";

export interface Variation {
    id: Uuid;
    project_id: Uuid;
    user_id?: Uuid | null;
    title: string;
    description?: string | null;
    amount: number;
    status: VariationStatus;
    variation_number?: string | null;
    instruction_type?: string | null;
    trade_section?: string | null;
    instructed_by?: string | null;
    date_instructed?: IsoDate | null;
    approval_date?: IsoDate | null;
    approval_reference?: string | null;
    rejection_reason?: string | null;
    created_at?: IsoDateTime;
}

// ── invoices (AfP) ──────────────────────────────────────────────────────────

export interface Invoice {
    id: Uuid;
    project_id: Uuid;
    invoice_number?: string | null;
    type?: InvoiceType | null;
    status: InvoiceStatus;
    amount: number;
    net_due?: number | null;
    gross_valuation?: number | null;
    previous_cert?: number | null;
    retention_pct?: number | null;
    retention_held?: number | null;
    period_number?: number | null;
    is_retention_release?: boolean | null;
    due_date?: IsoDate | null;
    paid_date?: IsoDate | null;
    created_at?: IsoDateTime;
    description?: string | null;
}

// ── project_expenses (cost logs) ────────────────────────────────────────────

export interface ProjectExpense {
    id: Uuid;
    project_id: Uuid;
    description?: string | null;
    supplier?: string | null;
    amount: number;
    expense_date: IsoDate;
    cost_type?: CostType | null;
    trade_section?: string | null;
    estimate_line_id?: Uuid | null;
    receipt_url?: string | null;
    cost_status?: CostStatus | null;
    created_at?: IsoDateTime;
}

// ── resources ───────────────────────────────────────────────────────────────

export interface StaffResource {
    id: Uuid;
    user_id: Uuid;
    name: string;
    title?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    job_title?: string | null;
    role?: string | null;
    is_active?: boolean | null;
    rate_mode: RateMode;
    // Simple mode
    hourly_chargeout_rate?: number | null;
    overtime_chargeout_rate?: number | null;
    // Full buildup
    annual_salary?: number | null;
    employer_ni_pct?: number | null;
    employer_pension_pct?: number | null;
    company_car_annual?: number | null;
    car_allowance_annual?: number | null;
    mobile_phone_annual?: number | null;
    it_costs_annual?: number | null;
    life_insurance_annual?: number | null;
    other_benefits_annual?: number | null;
    annual_working_days?: number | null;
    holiday_days?: number | null;
    public_holiday_days?: number | null;
    overhead_absorption_pct?: number | null;
    profit_uplift_pct?: number | null;
    staff_type?: "direct_labour" | "overhead" | null;
}

export type PlantCategory =
    | "heavy_plant"
    | "light_plant"
    | "lifting"
    | "temp_works"
    | "light_tools"
    | "specialist_tools"
    | "other";

export interface PlantResource {
    id: Uuid;
    user_id: Uuid;
    name: string;
    category: PlantCategory | string;
    description?: string | null;
    is_active?: boolean | null;
    rate_mode: RateMode;
    daily_chargeout_rate?: number | null;
    purchase_price?: number | null;
    depreciation_years?: number | null;
    residual_value?: number | null;
    finance_cost_annual?: number | null;
    maintenance_annual?: number | null;
    insurance_annual?: number | null;
    other_annual_costs?: number | null;
    utilisation_months?: number | null;
    working_days_per_month?: number | null;
    profit_uplift_pct?: number | null;
}
