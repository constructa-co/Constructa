// ─── Constructa Contract Administration Engine ────────────────────────────────
// Config-driven rules for NEC / JCT / FIDIC contract suites.
// Rules live here (immutable per contract type); DB holds project-specific instances.

export type ContractSuite = "NEC" | "JCT" | "FIDIC" | "BESPOKE";

export type ContractType =
  | "NEC4_ECC"
  | "NEC3_ECC"
  | "NEC4_PSC"
  | "NEC3_PSC"
  | "JCT_SBC"
  | "JCT_DB"
  | "JCT_IC"
  | "JCT_MW"
  | "FIDIC_RED_1999"
  | "FIDIC_YELLOW_1999"
  | "FIDIC_SILVER_1999"
  | "FIDIC_RED_2017"
  | "FIDIC_YELLOW_2017"
  | "BESPOKE";

export type ObligationParty = "contractor" | "employer" | "supervisor";

export interface ObligationTemplate {
  type: string;
  label: string;
  clauseRef: string;
  party: ObligationParty;
  daysFromAward?: number;            // one-off, triggered at contract award
  recurring?: "monthly" | "weekly";  // ongoing cycle
}

export interface EventStep {
  step: string;
  label: string;
  party: ObligationParty;
  daysFromPrevious: number;
  clauseRef: string;
  actionType: "notify" | "respond" | "submit" | "assess" | "certify" | "pay";
  // if true, no response = deemed acceptance by other party
  deemedAcceptance?: boolean;
}

export interface EventConfig {
  label: string;           // "Compensation Event" | "Variation" | "Claim" | "Extension of Time"
  shortLabel: string;      // "CE" | "Var" | "Claim" | "EoT"
  // Time bar: contractor must notify within N days of becoming aware. null = no hard bar.
  contractorTimeBarDays: number | null;
  timeBarClause: string | null;
  // Ordered response chain created when event is raised
  chain: EventStep[];
  // Sprint 59 P3 — clause-specific guidance fed to the AI when drafting a
  // notice for this event. Each suite has its own conventions about what
  // a notice MUST contain (e.g. NEC 61.3 needs explicit date-aware wording,
  // FIDIC 20.1 needs a "fully detailed claim" submission within 42 days).
  // The drafter prepends this to the system prompt so the output is sharper.
  // Optional — events without specific guidance fall back to the generic
  // contract-suite system prompt.
  aiGuidance?: string;
}

export interface PaymentCycle {
  frequency: "monthly" | "fortnightly" | "on_application";
  certificationDays: number;
  paymentDays: number;        // from certification / assessment date
  clauseRef: string;
  applicationLabel: string;   // "Payment Application" | "Interim Application" | "Monthly Statement"
}

export interface ContractConfig {
  label: string;
  shortLabel: string;
  suite: ContractSuite;
  // Human-readable terminology mapped to a universal key
  terminology: {
    supervisor: string;        // "Project Manager" | "Architect" | "Engineer"
    mainEvent: string;         // "Compensation Event" | "Variation" | "Claim"
    earlyWarning: string;      // "Early Warning" | "Notice" | "Notice"
    programme: string;
    paymentApp: string;
    employer: string;          // "Client" | "Employer"
  };
  options: { value: string; label: string }[];   // NEC Option A–F, JCT flavours
  // Obligations auto-created when contract is set up
  onAward: ObligationTemplate[];
  // Events that can be raised on this contract type
  events: Record<string, EventConfig>;
  payment: PaymentCycle;
}

// ─── NEC4 ECC ─────────────────────────────────────────────────────────────────

const NEC4_ECC: ContractConfig = {
  label: "NEC4 Engineering and Construction Contract",
  shortLabel: "NEC4 ECC",
  suite: "NEC",
  terminology: {
    supervisor:  "Project Manager",
    mainEvent:   "Compensation Event",
    earlyWarning: "Early Warning",
    programme:   "Programme",
    paymentApp:  "Payment Application",
    employer:    "Client",
  },
  options: [
    { value: "A", label: "Option A — Priced contract with activity schedule" },
    { value: "B", label: "Option B — Priced contract with bill of quantities" },
    { value: "C", label: "Option C — Target contract with activity schedule" },
    { value: "D", label: "Option D — Target contract with bill of quantities" },
    { value: "E", label: "Option E — Cost reimbursable contract" },
    { value: "F", label: "Option F — Management contract" },
  ],
  onAward: [
    {
      type: "programme_submission",
      label: "Submit first programme to Project Manager",
      clauseRef: "31.3",
      party: "contractor",
      daysFromAward: 14,
    },
    {
      type: "insurance_certificates",
      label: "Provide insurance certificates",
      clauseRef: "84.2",
      party: "contractor",
      daysFromAward: 14,
    },
    {
      type: "monthly_progress_report",
      label: "Monthly progress report to Project Manager",
      clauseRef: "32.1",
      party: "contractor",
      recurring: "monthly",
    },
    {
      type: "monthly_payment_application",
      label: "Payment application (assessment date)",
      clauseRef: "50.1",
      party: "contractor",
      recurring: "monthly",
    },
  ],
  events: {
    compensation_event: {
      label: "Compensation Event",
      shortLabel: "CE",
      contractorTimeBarDays: 56,   // 8 weeks cl. 61.3
      timeBarClause: "61.3",
      aiGuidance: `NEC4 cl. 61.3 — the Contractor must notify the Project Manager of a compensation event within EIGHT WEEKS of becoming aware of it. If the Contractor fails to notify within this period, they are NOT entitled to a change in the Prices, Completion Date, or Key Date for that event.

The notice MUST:
- Be in writing, separately from any other communication (cl. 13.1, 13.7)
- Identify the event by reference to the relevant cl. 60.1 sub-clause where applicable
- State the date the Contractor became aware of the event (this triggers the 8-week clock)
- Briefly describe the event and its likely effect on Prices, Completion Date, or Key Date
- Be addressed to the Project Manager (NOT the Client)

After notification, the Contractor will be required to submit a quotation under cl. 62. Do not include the quotation in the notice itself.

Use NEC4 terminology only: "Contractor", "Project Manager", "Client", "Compensation Event", "Defined Cost", "Working Areas". Do not use legal jargon or external contract terms.`,
      chain: [
        {
          step: "contractor_notifies_ce",
          label: "Contractor notifies CE",
          party: "contractor",
          daysFromPrevious: 0,
          clauseRef: "61.3",
          actionType: "notify",
        },
        {
          step: "pm_decides_ce",
          label: "PM decides: CE or not a CE",
          party: "supervisor",
          daysFromPrevious: 7,
          clauseRef: "61.4",
          actionType: "respond",
          deemedAcceptance: true,
        },
        {
          step: "contractor_submits_quotation",
          label: "Contractor submits quotation",
          party: "contractor",
          daysFromPrevious: 21,
          clauseRef: "62.3",
          actionType: "submit",
        },
        {
          step: "pm_replies_quotation",
          label: "PM accepts, instructs revision, or makes own assessment",
          party: "supervisor",
          daysFromPrevious: 14,
          clauseRef: "62.4",
          actionType: "assess",
          deemedAcceptance: true,   // cl. 62.6 — contractor notifies after 2 weeks silence
        },
      ],
    },
    pm_notifies_ce: {
      label: "CE Notified by PM",
      shortLabel: "CE (PM)",
      contractorTimeBarDays: null,
      timeBarClause: null,
      chain: [
        {
          step: "pm_notifies_ce",
          label: "PM notifies compensation event",
          party: "supervisor",
          daysFromPrevious: 0,
          clauseRef: "61.1",
          actionType: "notify",
        },
        {
          step: "contractor_submits_quotation",
          label: "Contractor submits quotation",
          party: "contractor",
          daysFromPrevious: 21,
          clauseRef: "62.3",
          actionType: "submit",
        },
        {
          step: "pm_replies_quotation",
          label: "PM accepts, instructs revision, or makes own assessment",
          party: "supervisor",
          daysFromPrevious: 14,
          clauseRef: "62.4",
          actionType: "assess",
          deemedAcceptance: true,
        },
      ],
    },
    early_warning: {
      label: "Early Warning",
      shortLabel: "EW",
      contractorTimeBarDays: null,
      timeBarClause: null,
      aiGuidance: `NEC4 cl. 15.1 — both parties have a duty to give an Early Warning Notice as soon as either becomes aware of any matter which could:
- Increase the total of the Prices
- Delay Completion or a Key Date
- Impair the performance of the works in use
- Increase the Contractor's total cost

This is NOT a claim — it is a notice triggering a Risk Reduction Meeting (cl. 15.4) where both parties cooperate on mitigation. Failure to notify can be reflected when the PM later assesses any related compensation event (cl. 61.5).

The notice MUST:
- Be in writing
- Briefly describe the matter and its likely effect
- Be entered in the Early Warning Register (cl. 15.3)
- Propose a date for a Risk Reduction Meeting

Tone: collaborative, not adversarial. The whole point of NEC's early warning regime is to surface problems early so they can be solved jointly.`,
      chain: [
        {
          step: "ew_raised",
          label: "Early Warning raised",
          party: "contractor",
          daysFromPrevious: 0,
          clauseRef: "15.1",
          actionType: "notify",
        },
        {
          step: "risk_reduction_meeting",
          label: "Risk Reduction Meeting",
          party: "supervisor",
          daysFromPrevious: 14,
          clauseRef: "15.4",
          actionType: "respond",
        },
      ],
    },
    programme_submission: {
      label: "Programme Submission",
      shortLabel: "Prog",
      contractorTimeBarDays: null,
      timeBarClause: null,
      chain: [
        {
          step: "contractor_submits_programme",
          label: "Contractor submits revised programme",
          party: "contractor",
          daysFromPrevious: 0,
          clauseRef: "32.2",
          actionType: "submit",
        },
        {
          step: "pm_accepts_programme",
          label: "PM accepts or notifies reasons for not accepting",
          party: "supervisor",
          daysFromPrevious: 14,
          clauseRef: "31.3",
          actionType: "respond",
        },
      ],
    },
  },
  payment: {
    frequency: "monthly",
    certificationDays: 7,    // cl. 50.1 — within 1 week of assessment date
    paymentDays: 21,         // cl. 51.2 — 3 weeks from assessment date
    clauseRef: "50–51",
    applicationLabel: "Payment Application",
  },
};

// ─── NEC3 ECC — same structure, slightly different clauses ───────────────────

const NEC3_ECC: ContractConfig = {
  ...NEC4_ECC,
  label: "NEC3 Engineering and Construction Contract",
  shortLabel: "NEC3 ECC",
  events: {
    ...NEC4_ECC.events,
    compensation_event: {
      ...NEC4_ECC.events.compensation_event,
      // NEC3 uses the same 8-week time bar at cl. 61.3 as NEC4. The
      // guidance text below mirrors the NEC4 version but renames the
      // contract throughout so the AI doesn't accidentally cite NEC4
      // wording when drafting an NEC3 notice.
      aiGuidance: NEC4_ECC.events.compensation_event.aiGuidance?.replace(/NEC4/g, "NEC3"),
      chain: NEC4_ECC.events.compensation_event.chain.map(s =>
        s.step === "pm_decides_ce" ? { ...s, clauseRef: "61.4", daysFromPrevious: 7 } : s
      ),
    },
  },
};

// ─── JCT SBC 2016 ─────────────────────────────────────────────────────────────

const JCT_SBC: ContractConfig = {
  label: "JCT Standard Building Contract 2016",
  shortLabel: "JCT SBC",
  suite: "JCT",
  terminology: {
    supervisor:  "Architect / Contract Administrator",
    mainEvent:   "Variation",
    earlyWarning: "Notice",
    programme:   "Master Programme",
    paymentApp:  "Interim Application",
    employer:    "Employer",
  },
  options: [
    { value: "SBC_Q", label: "SBC/Q — With Quantities" },
    { value: "SBC_XQ", label: "SBC/XQ — Without Quantities" },
    { value: "SBC_AQ", label: "SBC/AQ — Approximate Quantities" },
  ],
  onAward: [
    {
      type: "master_programme",
      label: "Provide Master Programme",
      clauseRef: "2.9.1",
      party: "contractor",
      daysFromAward: 14,
    },
    {
      type: "insurance_policies",
      label: "Provide evidence of insurance policies",
      clauseRef: "6.1",
      party: "contractor",
      daysFromAward: 14,
    },
    {
      type: "monthly_interim_application",
      label: "Monthly interim valuation / application",
      clauseRef: "4.8",
      party: "contractor",
      recurring: "monthly",
    },
  ],
  events: {
    variation: {
      label: "Architect's Instruction / Variation",
      shortLabel: "Var",
      contractorTimeBarDays: null,
      timeBarClause: null,
      aiGuidance: `JCT SBC 2016 cl. 3.10 — the Architect / Contract Administrator may issue instructions in writing requiring a Variation. The Contractor must comply unless the variation involves:
- Work the Contractor cannot reasonably carry out
- A change to the obligations or restrictions imposed by the Employer
in which case the Contractor may make reasonable objection in writing to the Architect under cl. 3.10.1.

Any Variation that affects regular progress will be valued under section 5 (Variations and Provisional Sums) and may give rise to a Relevant Event under cl. 2.29 (Extension of Time) and / or a matter under cl. 4.22 (Loss and Expense).

The notice MUST:
- Be addressed to the Architect / Contract Administrator
- Reference the AI/Variation number if known
- Confirm receipt and either acceptance or reasonable objection
- State whether the Contractor considers the Variation will affect time or money
- If time or money is affected, signpost an EoT notice (cl. 2.27) and L&E application (cl. 4.20) to follow

Use JCT terminology only: "Contractor", "Architect / Contract Administrator", "Employer", "Variation", "Relevant Event", "Loss and Expense".`,
      chain: [
        {
          step: "architect_issues_instruction",
          label: "Architect issues instruction",
          party: "supervisor",
          daysFromPrevious: 0,
          clauseRef: "3.10",
          actionType: "notify",
        },
        {
          step: "contractor_objection_window",
          label: "Contractor may object (reasonable objection)",
          party: "contractor",
          daysFromPrevious: 7,
          clauseRef: "3.10",
          actionType: "respond",
        },
        {
          step: "variation_valuation",
          label: "Variation valued and included in interim",
          party: "supervisor",
          daysFromPrevious: 28,
          clauseRef: "5.2",
          actionType: "assess",
        },
      ],
    },
    extension_of_time: {
      label: "Extension of Time",
      shortLabel: "EoT",
      contractorTimeBarDays: null,   // JCT: "forthwith" — not a hard bar in days
      timeBarClause: "2.27.1",
      aiGuidance: `JCT SBC 2016 cl. 2.27.1 — when it becomes reasonably apparent that progress is being or is likely to be delayed, the Contractor must FORTHWITH give written notice to the Architect / Contract Administrator of the material circumstances, including the cause(s) of the delay, and identify any Relevant Event.

This is NOT a hard time bar in days, but the case law (Walter Lilly v Mackay) makes clear that "forthwith" means "as soon as reasonably practicable" — typically within days, not weeks. Failure to notify forthwith may not extinguish the right to an extension but it weakens the contractor's position.

The notice MUST:
- Be in writing, addressed to the Architect / CA
- Identify each Relevant Event under cl. 2.29 (e.g. cl. 2.29.6 Variations, cl. 2.29.7 instructions, cl. 2.29.13 specified perils, cl. 2.29.14 force majeure)
- State the date(s) of the Relevant Event(s) and when they became apparent
- Describe the material circumstances and cause of delay
- Estimate the expected delay to the Completion Date (an estimate is fine — a precise figure follows in the cl. 2.27.2 particulars)
- Reserve the right to provide further particulars under cl. 2.27.2

The Architect must then make a fair and reasonable extension under cl. 2.28.1 within 12 weeks of receipt of the cl. 2.27.2 particulars. Without the initial notice, this clock never starts.

Use JCT terminology only: "Contractor", "Architect / Contract Administrator", "Employer", "Relevant Event", "Completion Date", "Date for Completion".`,
      chain: [
        {
          step: "contractor_notifies_relevant_event",
          label: "Contractor notifies Relevant Event forthwith",
          party: "contractor",
          daysFromPrevious: 0,
          clauseRef: "2.27.1",
          actionType: "notify",
        },
        {
          step: "contractor_provides_particulars",
          label: "Contractor provides further particulars and estimate",
          party: "contractor",
          daysFromPrevious: 14,
          clauseRef: "2.27.2",
          actionType: "submit",
        },
        {
          step: "architect_fixes_new_date",
          label: "Architect fixes new Completion Date",
          party: "supervisor",
          daysFromPrevious: 84,    // 12 weeks cl. 2.28.1
          clauseRef: "2.28.1",
          actionType: "assess",
        },
      ],
    },
    loss_and_expense: {
      label: "Loss and Expense",
      shortLabel: "L&E",
      contractorTimeBarDays: null,
      timeBarClause: "4.20",
      aiGuidance: `JCT SBC 2016 cl. 4.20 — the Contractor may apply to the Architect / Contract Administrator for ascertainment of any direct loss and/or expense incurred (or likely to be incurred) for which the Contractor would not be reimbursed under any other provision of the Contract, where regular progress has been or is likely to be materially affected by a Relevant Matter (cl. 4.22).

The application MUST:
- Be in writing
- Be made as SOON as the loss/expense has become or is likely to become apparent (cl. 4.20.1) — the post-2016 amendments require contemporaneous notice
- Identify each Relevant Matter under cl. 4.22 (e.g. cl. 4.22.1 Variations, cl. 4.22.5 instructions, cl. 4.22.6 employer's failure to give possession)
- State the basis on which the Contractor considers the matter has materially affected regular progress
- Where reasonably practicable, contain such information as is necessary to enable the Architect / QS to ascertain the loss / expense (cl. 4.20.2)

Common heads of claim include:
- Site preliminaries / time-related on-costs
- Head office overheads (e.g. Hudson, Emden, or Eichleay formula)
- Loss of profit / contribution
- Increased subcontractor costs
- Disruption costs (productivity loss)
- Finance charges on additional working capital

Do NOT speculate about quantum in the initial application — the Architect / QS will ascertain it. The contractor's job here is to (1) identify the Relevant Matter, (2) demonstrate material effect on regular progress, and (3) commit to providing further information on request.

Use JCT terminology only: "Contractor", "Architect / Contract Administrator", "Quantity Surveyor", "Employer", "Relevant Matter", "ascertainment", "regular progress".`,
      chain: [
        {
          step: "contractor_makes_application",
          label: "Contractor makes application for L&E",
          party: "contractor",
          daysFromPrevious: 0,
          clauseRef: "4.20.1",
          actionType: "notify",
        },
        {
          step: "contractor_provides_information",
          label: "Contractor provides further information on request",
          party: "contractor",
          daysFromPrevious: 14,
          clauseRef: "4.20.2",
          actionType: "submit",
        },
        {
          step: "architect_ascertains_amount",
          label: "Architect / QS ascertains amount",
          party: "supervisor",
          daysFromPrevious: 28,
          clauseRef: "4.20.3",
          actionType: "assess",
        },
      ],
    },
  },
  payment: {
    frequency: "monthly",
    certificationDays: 5,    // cl. 4.9 — 5 working days
    paymentDays: 14,         // cl. 4.13.1 — 14 days from cert
    clauseRef: "4.8–4.15",
    applicationLabel: "Interim Application",
  },
};

const JCT_DB: ContractConfig = {
  ...JCT_SBC,
  label: "JCT Design and Build Contract 2016",
  shortLabel: "JCT D&B",
  options: [{ value: "DB_2016", label: "Design and Build 2016" }],
  terminology: {
    ...JCT_SBC.terminology,
    supervisor: "Employer's Agent",
  },
};

const JCT_IC: ContractConfig = {
  ...JCT_SBC,
  label: "JCT Intermediate Building Contract 2016",
  shortLabel: "JCT IC",
  options: [
    { value: "IC_2016", label: "IC/2016 — Without Contractor's Design" },
    { value: "ICD_2016", label: "ICD/2016 — With Contractor's Design" },
  ],
};

const JCT_MW: ContractConfig = {
  ...JCT_SBC,
  label: "JCT Minor Works Building Contract 2016",
  shortLabel: "JCT MW",
  options: [
    { value: "MW_2016", label: "MW/2016" },
    { value: "MWD_2016", label: "MWD/2016 — With Contractor's Design" },
  ],
};

// ─── FIDIC Red Book 1999 ──────────────────────────────────────────────────────

const FIDIC_RED_1999: ContractConfig = {
  label: "FIDIC Conditions of Contract for Construction (Red Book) 1999",
  shortLabel: "FIDIC Red",
  suite: "FIDIC",
  terminology: {
    supervisor:  "Engineer",
    mainEvent:   "Claim",
    earlyWarning: "Notice",
    programme:   "Programme",
    paymentApp:  "Monthly Statement",
    employer:    "Employer",
  },
  options: [
    { value: "RED_1999", label: "Red Book 1999 (Employer-designed)" },
  ],
  onAward: [
    {
      type: "programme_submission",
      label: "Submit detailed programme",
      clauseRef: "8.3",
      party: "contractor",
      daysFromAward: 28,
    },
    {
      type: "cash_flow_forecast",
      label: "Submit cash flow forecast",
      clauseRef: "14.4",
      party: "contractor",
      daysFromAward: 28,
    },
    {
      type: "monthly_statement",
      label: "Monthly statement to Engineer",
      clauseRef: "14.3",
      party: "contractor",
      recurring: "monthly",
    },
  ],
  events: {
    claim: {
      label: "Contractor's Claim",
      shortLabel: "Claim",
      contractorTimeBarDays: 28,   // cl. 20.1 — 28 days of becoming aware
      timeBarClause: "20.1",
      aiGuidance: `FIDIC Red Book 1999 cl. 20.1 — the Contractor must give notice to the Engineer describing the event or circumstance giving rise to the claim within TWENTY-EIGHT DAYS after the Contractor became aware (or should have become aware) of the event. If the Contractor fails to give notice within this period:
- The Time for Completion shall not be extended
- The Contractor shall not be entitled to additional payment
- The Employer is discharged from all liability in connection with the claim
This is a HARD CONDITION PRECEDENT — the courts (Obrascon v Attorney General of Gibraltar) have confirmed FIDIC 20.1 is a true time bar.

The notice MUST:
- Be in writing, addressed to the Engineer
- Describe the event or circumstance giving rise to the claim
- State the date of the event AND the date the Contractor became aware
- Reference cl. 20.1 (and the substantive Sub-Clause supporting the claim — e.g. cl. 8.4 EOT, cl. 13.7 changes in legislation)
- Be kept brief — the FULLY DETAILED claim follows under the same clause within 42 days

After notice, the Contractor MUST:
- Keep contemporary records (cl. 20.1 second paragraph)
- Submit the fully detailed claim within 42 days of becoming aware (or such other period as the Engineer may approve)
- Submit further interim claims at monthly intervals if the event has continuing effect
- Submit a final claim within 28 days after the end of the effects

Use FIDIC terminology only: "Contractor", "Engineer", "Employer", "Time for Completion", "Variation", "Sub-Clause", "Cost", "reasonable profit". Do NOT use NEC or JCT terminology.`,
      chain: [
        {
          step: "contractor_notices_claim",
          label: "Contractor gives notice of claim",
          party: "contractor",
          daysFromPrevious: 0,
          clauseRef: "20.1",
          actionType: "notify",
        },
        {
          step: "contractor_submits_detailed_claim",
          label: "Contractor submits fully detailed claim",
          party: "contractor",
          daysFromPrevious: 42,
          clauseRef: "20.1",
          actionType: "submit",
        },
        {
          step: "engineer_responds",
          label: "Engineer responds to claim",
          party: "supervisor",
          daysFromPrevious: 42,
          clauseRef: "20.1",
          actionType: "respond",
        },
      ],
    },
    engineer_instruction: {
      label: "Engineer's Instruction / Variation",
      shortLabel: "EI",
      contractorTimeBarDays: null,
      timeBarClause: null,
      aiGuidance: `FIDIC 1999 Sub-Clause 13.1 — Right to Vary. The Engineer may at any time issue an instruction which may include a Variation to the Works. The Contractor shall comply unless the Contractor cannot readily obtain the Goods required for the Variation, or unless the instruction would adversely affect the safety or suitability of the Works.

Under Sub-Clause 13.3 (Variation Procedure), if the Engineer requests a proposal, the Contractor must respond as soon as practicable with:
1. A description of the proposed work and a programme for its execution
2. Any necessary modifications to the programme under Sub-Clause 8.3
3. A proposal for adjustment to the Contract Price

CRITICAL: If the Engineer's instruction constitutes a Variation that causes additional Cost or delay to the Time for Completion, the Contractor MUST give notice under Sub-Clause 20.1 within TWENTY-EIGHT (28) DAYS of becoming aware of the event or circumstance. Failure to notify within 28 days is a hard time bar — the Contractor loses entitlement to any additional payment or extension of time.

The notice must:
- Be in writing, addressed to the Engineer
- Reference the Engineer's instruction number and date of issue
- State that the instruction constitutes or gives rise to a claim under Sub-Clause 20.1
- Describe the anticipated effect on the Time for Completion and/or Cost
- Reserve the Contractor's right to submit a fully detailed claim within 42 days per Sub-Clause 20.1

Subsequent to the notice, the Contractor shall submit full particulars within 42 days including: the contractual basis of the claim (identifying the specific Sub-Clause), detailed time impact on the programme, and a breakdown of additional Cost incurred or to be incurred.

Use FIDIC terminology: "Contractor", "Engineer", "Employer", "Variation", "Time for Completion", "Cost", "Sub-Clause". Do not use NEC or JCT terminology.`,
      chain: [
        {
          step: "engineer_issues_instruction",
          label: "Engineer issues instruction",
          party: "supervisor",
          daysFromPrevious: 0,
          clauseRef: "13.1",
          actionType: "notify",
        },
        {
          step: "contractor_gives_notice",
          label: "Contractor gives notice if instruction causes delay/cost",
          party: "contractor",
          daysFromPrevious: 28,
          clauseRef: "20.1",
          actionType: "notify",
        },
        {
          step: "engineer_agrees_adjustment",
          label: "Engineer agrees Time/Cost adjustment",
          party: "supervisor",
          daysFromPrevious: 42,
          clauseRef: "13.3",
          actionType: "assess",
        },
      ],
    },
  },
  payment: {
    frequency: "monthly",
    certificationDays: 28,   // cl. 14.6 — Engineer certifies within 28 days
    paymentDays: 56,         // cl. 14.7 — payment within 56 days of statement
    clauseRef: "14.3–14.7",
    applicationLabel: "Monthly Statement",
  },
};

const FIDIC_YELLOW_1999: ContractConfig = {
  ...FIDIC_RED_1999,
  label: "FIDIC Conditions of Contract for Plant and Design-Build (Yellow Book) 1999",
  shortLabel: "FIDIC Yellow",
  options: [{ value: "YELLOW_1999", label: "Yellow Book 1999 (Contractor-designed)" }],
  terminology: {
    ...FIDIC_RED_1999.terminology,
    supervisor: "Engineer",
  },
};

const FIDIC_SILVER_1999: ContractConfig = {
  ...FIDIC_RED_1999,
  label: "FIDIC Conditions of Contract for EPC/Turnkey Projects (Silver Book) 1999",
  shortLabel: "FIDIC Silver",
  options: [{ value: "SILVER_1999", label: "Silver Book 1999 (EPC/Turnkey)" }],
};

const FIDIC_RED_2017: ContractConfig = {
  ...FIDIC_RED_1999,
  label: "FIDIC Conditions of Contract for Construction (Red Book) 2017",
  shortLabel: "FIDIC Red 2017",
  options: [{ value: "RED_2017", label: "Red Book 2017 (Employer-designed)" }],
  events: {
    ...FIDIC_RED_1999.events,
    claim: {
      ...FIDIC_RED_1999.events.claim,
      // 2017 edition: 28 days still applies cl. 20.2.1
      chain: FIDIC_RED_1999.events.claim.chain.map(s =>
        s.step === "engineer_responds" ? { ...s, daysFromPrevious: 84 } : s // 2017: 84 days to agree/determine
      ),
    },
    engineer_instruction: {
      ...FIDIC_RED_1999.events.engineer_instruction,
      aiGuidance: (FIDIC_RED_1999.events.engineer_instruction.aiGuidance ?? "")
        .replace(/Sub-Clause 20\.1/g, "Sub-Clause 20.2.1")
        .replace(/under Sub-Clause 20\.1/g, "under Sub-Clause 20.2.1")
        .replace(/per Sub-Clause 20\.1/g, "per Sub-Clause 20.2.1")
        .replace(/FIDIC 1999/g, "FIDIC 2017"),
      chain: [
        ...FIDIC_RED_1999.events.engineer_instruction.chain.map(s =>
          s.clauseRef === "20.1" ? { ...s, clauseRef: "20.2.1" } : s,
        ),
      ],
    },
  },
};

const FIDIC_YELLOW_2017: ContractConfig = {
  ...FIDIC_RED_2017,
  label: "FIDIC Conditions of Contract for Plant and Design-Build (Yellow Book) 2017",
  shortLabel: "FIDIC Yellow 2017",
  options: [{ value: "YELLOW_2017", label: "Yellow Book 2017 (Contractor-designed)" }],
};

const BESPOKE: ContractConfig = {
  label: "Bespoke / Other Contract",
  shortLabel: "Bespoke",
  suite: "BESPOKE",
  terminology: {
    supervisor:  "Contract Administrator",
    mainEvent:   "Variation / Claim",
    earlyWarning: "Notice",
    programme:   "Programme",
    paymentApp:  "Payment Application",
    employer:    "Employer",
  },
  options: [{ value: "BESPOKE", label: "Bespoke" }],
  onAward: [],
  events: {
    event: {
      label: "Event / Notice",
      shortLabel: "Event",
      contractorTimeBarDays: null,
      timeBarClause: null,
      chain: [
        {
          step: "event_raised",
          label: "Event / Notice raised",
          party: "contractor",
          daysFromPrevious: 0,
          clauseRef: "—",
          actionType: "notify",
        },
        {
          step: "response_due",
          label: "Response due",
          party: "supervisor",
          daysFromPrevious: 28,
          clauseRef: "—",
          actionType: "respond",
        },
      ],
    },
  },
  payment: {
    frequency: "monthly",
    certificationDays: 14,
    paymentDays: 30,
    clauseRef: "—",
    applicationLabel: "Payment Application",
  },
};

// ─── Master config map ────────────────────────────────────────────────────────

export const CONTRACTS_CONFIG: Record<ContractType, ContractConfig> = {
  NEC4_ECC,
  NEC3_ECC,
  NEC4_PSC: { ...NEC4_ECC, label: "NEC4 Professional Services Contract", shortLabel: "NEC4 PSC" },
  NEC3_PSC: { ...NEC3_ECC, label: "NEC3 Professional Services Contract", shortLabel: "NEC3 PSC" },
  JCT_SBC,
  JCT_DB,
  JCT_IC,
  JCT_MW,
  FIDIC_RED_1999,
  FIDIC_YELLOW_1999,
  FIDIC_SILVER_1999,
  FIDIC_RED_2017,
  FIDIC_YELLOW_2017,
  BESPOKE,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All contract types grouped by suite for UI selectors */
export const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string; suite: ContractSuite }[] = [
  { value: "NEC4_ECC",         label: "NEC4 Engineering and Construction Contract",  suite: "NEC" },
  { value: "NEC3_ECC",         label: "NEC3 Engineering and Construction Contract",  suite: "NEC" },
  { value: "NEC4_PSC",         label: "NEC4 Professional Services Contract",         suite: "NEC" },
  { value: "NEC3_PSC",         label: "NEC3 Professional Services Contract",         suite: "NEC" },
  { value: "JCT_SBC",          label: "JCT Standard Building Contract 2016",         suite: "JCT" },
  { value: "JCT_DB",           label: "JCT Design and Build Contract 2016",          suite: "JCT" },
  { value: "JCT_IC",           label: "JCT Intermediate Building Contract 2016",     suite: "JCT" },
  { value: "JCT_MW",           label: "JCT Minor Works Building Contract 2016",      suite: "JCT" },
  { value: "FIDIC_RED_1999",   label: "FIDIC Red Book 1999",                         suite: "FIDIC" },
  { value: "FIDIC_YELLOW_1999",label: "FIDIC Yellow Book 1999",                      suite: "FIDIC" },
  { value: "FIDIC_SILVER_1999",label: "FIDIC Silver Book 1999 (EPC/Turnkey)",        suite: "FIDIC" },
  { value: "FIDIC_RED_2017",   label: "FIDIC Red Book 2017",                         suite: "FIDIC" },
  { value: "FIDIC_YELLOW_2017",label: "FIDIC Yellow Book 2017",                      suite: "FIDIC" },
  { value: "BESPOKE",          label: "Bespoke / Other Contract",                   suite: "BESPOKE" },
];

/** Add N calendar days to a date string (YYYY-MM-DD) */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Days remaining until a due date (negative = overdue) */
export function daysUntil(dueDateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

/** RAG status for an obligation */
export function obligationRag(dueDateStr: string, status: string): "red" | "amber" | "green" | "done" {
  if (status === "complete") return "done";
  const d = daysUntil(dueDateStr);
  if (d < 0) return "red";
  if (d <= 7) return "amber";
  return "green";
}
