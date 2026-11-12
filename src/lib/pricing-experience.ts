import { buildPastJobs, type ProposalLibrary } from "./case-library/past-jobs";
import { legacyCaseStudies } from "./case-library/legacy";
import { resolveSelectedCaseStudies } from "./case-library/resolve";

export type PricingExperienceSource = {
    catalogKey: string;
    selected: string[] | null;
    options: Array<{ tick: string; title: string; detail: string }>;
    retained: string[];
    notes: string[];
};

export function pricingExperienceSource(catalogKey: string, older: unknown[] | null, selected: string[] | null, library?: ProposalLibrary): PricingExperienceSource {
    const jobs = buildPastJobs({ olderStored: older, selected, library });
    const entries = legacyCaseStudies(older);
    const ticks = new Set([...entries.map(entry => entry.selectionId), ...(selected ?? []), ...jobs.library.map(entry => entry.tick)]);
    const options: PricingExperienceSource["options"] = [];
    for (const tick of ticks) {
        const resolution = resolveSelectedCaseStudies({ userId: library?.userId ?? "", olderStored: older, selected: [tick], libraryRows: library?.rows ?? [] });
        if (!resolution.sendable || resolution.studies.length === 0) continue;
        const matched = entries.filter(entry => entry.matchedBy.includes(tick));
        const option = jobs.library.find(entry => entry.tick === tick);
        options.push({ tick, title: resolution.studies.map(study => study.title).join(" / "),
            detail: matched.length > 1 ? `This saved choice matches ${matched.length} older entries; existing first-six display rules still apply.`
                : option ? option.labels.join(", ") : matched[0]?.workType ?? "" });
    }
    const known = new Set(options.map(option => option.tick));
    return { catalogKey, selected, options, retained: (selected ?? []).filter(tick => !known.has(tick)),
        notes: [...jobs.notes, ...(jobs.blocked ? [jobs.blocked] : []), ...jobs.cannotSend.map(item => item.message),
            "These are saved selection checks, not approval to send. Existing proposal limits and readiness checks still apply."] };
}

export function pricingExperienceChangeError(source: PricingExperienceSource, selected: string[]): string | null {
    if (selected.length > 50 || selected.some(tick => !tick || tick.length > 100)) return "Keep the existing limit of 50 choices, each with a valid saved identity. Nothing has been shortened.";
    const available = new Set(source.options.map(option => option.tick));
    if (selected.some(tick => !available.has(tick) && !(source.selected ?? []).includes(tick))) return "A choice is no longer available. Keep your draft and reload to review the saved sources.";
    if (source.retained.some(tick => selected.filter(value => value === tick).length !== (source.selected ?? []).filter(value => value === tick).length)) return "Unavailable saved choices must stay unchanged here. Review them on the proposal page; none has been dropped.";
    return null;
}

export const sameExperienceSource = (a: PricingExperienceSource, b: PricingExperienceSource) =>
    a.catalogKey === b.catalogKey && JSON.stringify(a.selected) === JSON.stringify(b.selected);
