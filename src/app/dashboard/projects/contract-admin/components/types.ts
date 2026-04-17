/**
 * P2-6 — shared types for the Contract Administration suite.
 *
 * Previously all of these interfaces lived inline at the top of the
 * 1,598-line contract-admin-client.tsx. Extracting them lets the
 * per-tab components (SetupForm, DelayAnalysisTab, SupervisorInvite,
 * and future EventList / ObligationTimeline) import only what they
 * need without pulling in the whole monolith.
 */

export interface Project {
    id: string;
    name: string;
    client_name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    potential_value?: number | null;
}

export interface ContractSettings {
    id: string;
    project_id: string;
    contract_type: string;
    contract_option?: string | null;
    award_date: string;
    start_date?: string | null;
    completion_date?: string | null;
    parties: Record<string, string>;
    contract_value?: number | null;
    notes?: string | null;
}

export interface Obligation {
    id: string;
    event_id?: string | null;
    obligation_type: string;
    label: string;
    clause_ref?: string | null;
    party: string;
    due_date: string;
    status: string;
    notes?: string | null;
}

export interface ContractEvent {
    id: string;
    event_type: string;
    reference?: string | null;
    raised_by: string;
    date_raised: string;
    date_aware?: string | null;
    time_bar_date?: string | null;
    status: string;
    title: string;
    description?: string | null;
    assessed_time?: number | null;
    assessed_cost?: number | null;
    agreed_time?: number | null;
    agreed_cost?: number | null;
    drafted_notice?: string | null;
}

export interface Communication {
    id: string;
    event_id?: string | null;
    direction: string;
    comm_date: string;
    reference?: string | null;
    subject: string;
    body?: string | null;
    from_party?: string | null;
    to_party?: string | null;
}

export interface Claim {
    id: string;
    event_id?: string | null;
    claim_type: string;
    reference?: string | null;
    title: string;
    status: string;
    time_claimed?: number | null;
    cost_claimed?: number | null;
    time_agreed?: number | null;
    cost_agreed?: number | null;
    ai_narrative?: string | null;
    notes?: string | null;
    created_at: string;
}

export interface Variation {
    id: string;
    description: string;
    status: string;
    amount?: number | null;
    created_at: string;
}

export interface ScheduleItem {
    id: string;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    progress?: number | null;
}

export interface Expense {
    id: string;
    category?: string | null;
    amount: number;
    date?: string | null;
}
