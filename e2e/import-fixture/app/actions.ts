"use server";

/**
 * Fixture harness for the website import. TEST ONLY.
 *
 * These files are not part of the application. `prepare.mjs` copies them
 * into `src/app/admin-e2e-import-fixture/` for a fixture browser run and the
 * run's teardown removes them again; that folder is ignored by Git. Even if
 * a copy were ever built by mistake, every entry point here refuses to work
 * unless CONSTRUCTA_IMPORT_FIXTURE is "1".
 *
 * The real preview and approval code runs behind the real screen, against an
 * in-memory database and a made-up website. No network and no Supabase.
 */

import { notFound } from "next/navigation";
import { fakeDb } from "@/lib/company-import/__fixtures__/fake-db";
import { SITE, fakeNetwork, html } from "@/lib/company-import/__fixtures__/site";
import { applyImport, latestImportDraft, previewImport } from "@/lib/company-import/service";

const ALPHA = "aaaaaaaa-0000-4000-8000-000000000001";
const HOUR = 60 * 60 * 1000;

type State = { db: ReturnType<typeof fakeDb>; previews: number; applies: number };
const store = globalThis as unknown as { __constructaImportFixture?: Record<string, State> };

function guard() {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
}

/** A network on the fixture database's clock, so expiry is consistent on both sides. */
function network(state: State, routes = SITE) {
    const net = fakeNetwork(routes).network;
    net.now = () => state.db.now();
    return net;
}

async function stateFor(run: string): Promise<State> {
    store.__constructaImportFixture ??= {};
    const existing = store.__constructaImportFixture[run];
    if (existing) return existing;

    const state: State = {
        db: fakeDb({ profiles: [{ id: ALPHA, company_name: "Smith Builders", phone: "0113 000 0000", website: null, specialisms: "", sales_email: null, address: null, company_number: null, vat_number: null }] }),
        previews: 0,
        applies: 0,
    };
    store.__constructaImportFixture[run] = state;
    // The "expired" scenario starts with a preview made more than a day ago.
    if (run.startsWith("expired")) {
        await previewImport({ supabase: state.db.user, admin: state.db.admin, userId: ALPHA, network: network(state) }, { url: "www.smithbuilders.co.uk", permissionConfirmed: true });
        state.db.advance(25 * HOUR);
    }
    return state;
}

export async function fixtureState(run: string) {
    guard();
    const state = await stateFor(run);
    return {
        profile: state.db.profile(ALPHA),
        drafts: state.db.tables.company_import_drafts.length,
        attempts: state.db.tables.company_import_attempts.map((row) => row.outcome),
        previews: state.previews,
        applies: state.applies,
    };
}

export async function fixtureDraft(run: string) {
    guard();
    const state = await stateFor(run);
    return latestImportDraft({ supabase: state.db.user, userId: ALPHA, network: network(state) });
}

export async function fixturePreview(run: string, input: { url: string; permissionConfirmed: boolean }) {
    guard();
    const state = await stateFor(run);
    state.previews += 1;
    // In the main scenario the website is down the first time it is asked.
    const down = !run.startsWith("expired") && state.previews === 1;
    const routes = down ? { ...SITE, "https://www.smithbuilders.co.uk/": html("down", 503) } : SITE;
    return previewImport({ supabase: state.db.user, admin: state.db.admin, userId: ALPHA, network: network(state, routes) }, input);
}

export async function fixtureApply(run: string, input: { draftId: string; approvals: { field: string; expectedExisting: string | null }[] }) {
    guard();
    const state = await stateFor(run);
    state.applies += 1;
    // First save: the phone was edited by hand elsewhere after the preview.
    if (state.applies === 1) state.db.profile(ALPHA).phone = "0113 222 2222";
    // Second save: the approval cannot be recorded, once.
    if (state.applies === 2) state.db.fail("record-approval");
    return applyImport({ supabase: state.db.user, admin: state.db.admin, userId: ALPHA, network: network(state) }, input);
}
