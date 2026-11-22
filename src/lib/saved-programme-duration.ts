import { programmeCalendarForProject } from "@/lib/job-working-pattern";
import { computeProgrammePlan, planCoversEveryPhase } from "@/lib/programme-plan";
import { computeRelativeProgramme, hasRelativeProgramme, RELATIVE_PROGRAMME_BASIS } from "@/lib/relative-programme";
import { readProgrammeInclusion } from "@/lib/programme-inclusion";

/**
 * The saved programme's duration wording ("15 working days (3 weeks)") from the
 * Programme tab's own calculation, which uses the job's working pattern and bank
 * holidays and counts overlapping stages once. Null, never a guess, when there is
 * no saved programme, it is left out of the proposal, or a saved stage cannot be
 * dated or counted. Read-only: nothing here changes a price.
 */
export function savedProgrammeDuration(project: {
    start_date?: string | null; programme_phases?: unknown; programme_working_pattern?: unknown; region?: string | null;
}): string | null {
    const inclusion = readProgrammeInclusion(project.programme_phases);
    if (inclusion.intent !== "include" || inclusion.phases.length === 0) return null;
    const calendar = programmeCalendarForProject(project, project.programme_working_pattern);
    if (!calendar) return null;
    const plan = hasRelativeProgramme(inclusion.phases)
        ? computeRelativeProgramme(inclusion.phases, calendar.pattern, calendar.bankHolidayDivision)
        : computeProgrammePlan(project.start_date, inclusion.phases, calendar, calendar.bankHolidayDivision);
    if (!plan) return null;
    if (plan.basis !== RELATIVE_PROGRAMME_BASIS && !planCoversEveryPhase(plan, inclusion.phases)) return null;
    return plan.duration_label || null;
}

