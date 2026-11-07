/**
 * Application switch for case-study text tidy (`case-studies.enhance`).
 * When false, dashboard actions and editors do not reach admin, budget or provider.
 * Does not disable the pure `enhanceCaseStudy` helper used in cohort unit tests.
 */
export const CASE_STUDY_TEXT_ENHANCE_ENABLED = false as const;

export function caseStudyTextEnhanceEnabled(): boolean {
    return CASE_STUDY_TEXT_ENHANCE_ENABLED;
}
