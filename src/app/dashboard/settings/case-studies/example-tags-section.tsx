"use client";

import {
    CASE_STUDY_DISCIPLINE_TAGS,
    CASE_STUDY_SECTOR_TAGS,
    toggleDisciplineTag,
    toggleSectorTag,
    type CaseStudySectorId,
} from "@/lib/case-study-example-tags";
import { coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";

const chip = (on: boolean) =>
    `min-h-9 px-3 rounded-full border text-xs font-semibold ${coreFocusVisibleRing} ${
        on ? `${corePrimaryButton} border-emerald-600 text-[#182c1b]` : "border-slate-400 text-slate-700 bg-white hover:bg-slate-50"
    }`;

export default function ExampleTagsSection({
    disciplineTags,
    sectorTags,
    onDisciplines,
    onSectors,
    idPrefix,
    labelCls,
}: {
    disciplineTags: string[];
    sectorTags: CaseStudySectorId[];
    onDisciplines: (next: string[]) => void;
    onSectors: (next: CaseStudySectorId[]) => void;
    idPrefix: string;
    labelCls: string;
}) {
    return (
        <div className="space-y-4" data-example-tag-section>
            <div>
                <p id={`${idPrefix}-disciplines`} className={labelCls}>
                    Work performed (disciplines)
                </p>
                <p className="text-xs text-slate-500 mb-2">Tag the trades on this job. These are the same setup suggestions, not your whole company list.</p>
                <div role="group" aria-labelledby={`${idPrefix}-disciplines`} className="flex flex-wrap gap-2">
                    {CASE_STUDY_DISCIPLINE_TAGS.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            data-discipline-tag={tag}
                            aria-pressed={disciplineTags.includes(tag)}
                            className={chip(disciplineTags.includes(tag))}
                            onClick={() => onDisciplines(toggleDisciplineTag(disciplineTags, tag))}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <p id={`${idPrefix}-sectors`} className={labelCls}>
                    Customer sector
                </p>
                <p className="text-xs text-slate-500 mb-2">Who the client was — separate from the work type.</p>
                <div role="group" aria-labelledby={`${idPrefix}-sectors`} className="flex flex-wrap gap-2">
                    {CASE_STUDY_SECTOR_TAGS.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            data-sector-tag={entry.id}
                            aria-pressed={sectorTags.includes(entry.id)}
                            className={chip(sectorTags.includes(entry.id))}
                            onClick={() => onSectors(toggleSectorTag(sectorTags, entry.id))}
                        >
                            {entry.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}