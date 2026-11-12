"use server";

/**
 * Fixture harness for the Company Profile form. TEST ONLY.
 *
 * Like the harnesses beside it, these files are copied into the app only for
 * a fixture browser run and removed afterwards, and every entry point refuses
 * to work unless CONSTRUCTA_IMPORT_FIXTURE is "1".
 *
 * The real form posts to a stand-in for the save. The stand-in builds what
 * would be saved with the application's own `profileUpdateFromForm`, the same
 * function the real action uses, and applies it to an in-memory profile row
 * the way an upsert applies it to a stored one: columns that are sent are
 * replaced, columns that are not sent are left alone. No Supabase, no
 * network, no provider. The real action's authentication and error handling
 * are covered by its unit tests, not here.
 */

import { notFound } from "next/navigation";
import { profileUpdateFromForm } from "@/lib/profile-update";

type Row = Record<string, unknown>;
interface Run { row: Row; posted: string[][]; failNext: boolean }
const store = globalThis as unknown as { __constructaProfileFixture?: Record<string, Run> };

function guard() {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
}

const study = (id: string, projectName: string) => ({ id, projectName, projectType: "Refurbishment", contractValue: "", programmeDuration: "", client: "", location: "", whatWeDelivered: `${projectName}: work delivered.`, valueAdded: "", photos: ["", "", ""] });

function runFor(run: string): Run {
    store.__constructaProfileFixture ??= {};
    store.__constructaProfileFixture[run] ??= {
        row: { id: "fixture-user", company_name: "Example Builders Ltd", full_name: "Sam Example", business_type: "Kitchens and bathrooms", phone: "0113 496 0000", pdf_theme: "slate", case_studies: [study("cs-1", "Kitchen at Example Road"), study("cs-2", "Loft at Sample Street")] },
        posted: [],
        failNext: false,
    };
    return store.__constructaProfileFixture[run];
}

export async function fixtureProfile(run: string) {
    guard();
    return structuredClone(runFor(run).row);
}

export async function fixtureSaveProfile(run: string, formData: FormData) {
    guard();
    const state = runFor(run);
    state.posted.push(Array.from(new Set(formData.keys())).sort());
    if (state.failNext) {
        state.failNext = false;
        return { success: false, error: "The profile could not be saved." };
    }
    Object.assign(state.row, profileUpdateFromForm(String(state.row.id), formData));
    return { success: true };
}

/** What the spec reads back, and the things it makes happen "somewhere else": a case study added on its own page, a failing save. */
export async function fixtureProfileControl(run: string, op: { addCaseStudyElsewhere?: string; failNext?: boolean }) {
    guard();
    const state = runFor(run);
    if (op.addCaseStudyElsewhere) (state.row.case_studies as unknown[]).push(study(`cs-${(state.row.case_studies as unknown[]).length + 1}`, op.addCaseStudyElsewhere));
    if (op.failNext) state.failNext = true;
    return {
        companyName: state.row.company_name,
        phone: state.row.phone,
        caseStudies: (state.row.case_studies as Array<{ projectName: string }>).map((entry) => entry.projectName),
        saves: state.posted.length,
        postedFields: state.posted.at(-1) ?? [],
    };
}
