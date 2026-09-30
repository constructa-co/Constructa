export interface ProposalTermsClause {
    clause_number: number;
    title: string;
    body: string;
    hidden?: boolean;
    custom?: boolean;
}

export const PROPOSAL_TERMS_PROFILE_VERSION = "phase1-standard-v1";

export const STANDARD_PROPOSAL_TERMS: ReadonlyArray<ProposalTermsClause> = [
    { clause_number: 1, title: "Jurisdiction", body: "The law of Contract is the Law of England and Wales. The Language of this Contract is English." },
    { clause_number: 2, title: "Responsibilities", body: "The Works are detailed within the Scope of Works attached to this Proposal. All Works are to meet Statutory Requirements, including all applicable British and European Standards, and industry best practices." },
    { clause_number: 3, title: "Alternative Dispute Resolution", body: "Should any dispute arise which cannot be resolved by negotiation, escalation shall be via Adjudication. The Adjudicating Nominated Body is the Royal Institute of Chartered Surveyors (RICS), under the RICS Homeowner Adjudication Scheme." },
    { clause_number: 4, title: "Liability", body: "The Defect Liability Period is 12 months from the date of Completion Certificate. Any Defects notified within the Defect Period are to be promptly rectified by the Contractor." },
    { clause_number: 5, title: "Workmanship", body: "All Works are to be performed using reasonable skill and care to that of a competent Contractor with experience on projects of similar size and scope." },
    { clause_number: 6, title: "Insurances", body: "The Contractor shall maintain throughout the Works: Public Liability Insurance; Employers Liability Insurance; Contractors All Risk Insurance. Evidence of current policies available on request." },
    { clause_number: 7, title: "Payments", body: "Payment dates are 21 Calendar days from receipt of Application. Any deductions by the Client must be formally notified as a 'Pay-Less-Notice' no later than 7 days following receipt of Application." },
    { clause_number: 8, title: "Change Management", body: "Any Variations to the Scope must be issued in writing. The Contractor will respond within 7 Calendar days with any Cost and/or Time implications." },
    { clause_number: 9, title: "Health, Safety & CDM", body: "The Client is a Domestic Client under the Construction Design Management (CDM) Regulations 2015. The Contractor shall act as Principal Contractor and comply with all CDM requirements." },
    { clause_number: 10, title: "Materials & Ownership", body: "All materials supplied and fixed by the Contractor shall remain the property of the Contractor until payment in full has been received. Risk in materials passes to the Client on delivery to site." },
    { clause_number: 11, title: "Practical Completion", body: "Practical Completion shall be certified in writing by the Contractor upon substantial completion of the Works. Minor snags shall not prevent Practical Completion being declared, provided they are remedied within the Defect Liability Period." },
    { clause_number: 12, title: "Confidentiality", body: "The terms, pricing, and conditions contained within this Proposal and resulting Contract are confidential between the parties and shall not be disclosed to any third party without the prior written consent of the other party." },
];

export const STANDARD_PROPOSAL_TERMS_MAX_CLAUSE = Math.max(
    ...STANDARD_PROPOSAL_TERMS.map((clause) => clause.clause_number),
);

export function resolveProposalTerms(
    overrides: ProposalTermsClause[] | null | undefined,
): ProposalTermsClause[] {
    const source = overrides ?? STANDARD_PROPOSAL_TERMS;
    return source
        .filter((clause) => !clause.hidden)
        .map((clause) => ({ ...clause }));
}
