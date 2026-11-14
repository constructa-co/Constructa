"use client";

import {
    CASE_STUDY_DISCIPLINE_TAGS,
    CASE_STUDY_SECTOR_TAGS,
    suggestedDisciplineChips,
    suggestedSectorChips,
    toggleDisciplineTag,
    toggleSectorTag,
    type CaseStudySectorId,
} from "@/lib/case-study-example-tags";
import { coreFocusVisibleRing, corePrimaryButton, coreSuggestionPrimary } from "@/lib/core-editing-palette";

const selectedChip = (on: boolean) =>
    `min-h-9 px-3 rounded-full border text-xs font-semibold ${coreFocusVisibleRing} ${
        on ? `${corePrimaryButton} border-emerald-600 text-[#182c1b]` : "border-slate-400 text-slate-700 bg-white hover:bg-slate-50"
    }`;

const suggestedChip = `${coreSuggestionPrimary} min-h-9 px-3 rounded-full border border-dashed text-xs font-semibold ${coreFocusVisibleRing}`;

export default function ExampleTagsSection({
    disciplineTags,
    sectorTags,
    suggestedDisciplines,
    suggestedSectors,
    onDisciplines,
    onSectors,
    idPrefix,
    labelCls,
}: {
    disciplineTags: string[];
    sectorTags: CaseStudySectorId[];
    suggestedDisciplines: string[];
    suggestedSectors: CaseStudySectorId[];
    onDisciplines: (next: string[]) => void;
    onSectors: (next: CaseStudySectorId[]) => void;
    idPrefix: string;
    labelCls: string;
}) {
    const disciplineSuggestions = suggestedDisciplineChips(disciplineTags, suggestedDisciplines);
    const sectorSuggestions = suggestedSectorChips(sectorTags, suggestedSectors);

    return (
        <div className="space-y-4" data-example-tag-section>
            <div>
                <p id={`${idPrefix}-disciplines`} className={labelCls}>
                    Work performed (disciplines)
                </p>
                <p className="text-xs text-slate-500 mb-2">Tag the trades on this job. These are the same setup suggestions, not your whole company list.</p>
                <div role="group" aria-labelledby={`${idPrefix}-disciplines`} className="flex flex-wrap gap-2">
                    {CASE_STUDY_DISCIPLINE_TAGS.map((tag) => {
                        const selected = disciplineTags.includes(tag);
                        const suggested = !selected && disciplineSuggestions.includes(tag);
                        return (
                            <button
                                key={tag}
                                type="button"
                                data-discipline-tag={tag}
                                data-tag-state={selected ? "selected" : suggested ? "suggested" : "available"}
                                aria-pressed={selected}
                                className={selected ? selectedChip(true) : suggested ? suggestedChip : selectedChip(false)}
                                onClick={() => onDisciplines(toggleDisciplineTag(disciplineTags, tag))}
                            >
                                {tag}
                                {suggested ? " (suggested)" : ""}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div>
                <p id={`${idPrefix}-sectors`} className={labelCls}>
                    Customer sector
                </p>
                <p className="text-xs text-slate-500 mb-2">Who the client was — separate from the work type.</p>
                <div role="group" aria-labelledby={`${idPrefix}-sectors`} className="flex flex-wrap gap-2">
                    {CASE_STUDY_SECTOR_TAGS.map((entry) => {
                        const selected = sectorTags.includes(entry.id);
                        const suggested = !selected && sectorSuggestions.includes(entry.id);
                        return (
                            <button
                                key={entry.id}
                                type="button"
                                data-sector-tag={entry.id}
                                data-tag-state={selected ? "selected" : suggested ? "suggested" : "available"}
                                aria-pressed={selected}
                                className={selected ? selectedChip(true) : suggested ? suggestedChip : selectedChip(false)}
                                onClick={() => onSectors(toggleSectorTag(sectorTags, entry.id))}
                            >
                                {entry.label}
                                {suggested ? " (suggested)" : ""}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}