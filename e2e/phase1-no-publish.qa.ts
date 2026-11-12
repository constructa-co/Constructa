import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { publicationRecords } from "./support/backend";
import { pointerDriver } from "./support/driver";
import { APPROVED_DISPOSABLE_PROJECT } from "./support/env";
import { PROPOSAL_READINESS_PATH } from "../src/lib/first-session";
import {
    COMPANY,
    JOB,
    PAYMENT_STAGES,
    PRICE,
    STAGES,
    expectedPrice,
    expectedProgramme,
} from "./support/journey-data";
import {
    isForbiddenHostedPublishRequest,
    isForbiddenProposalServerActionPost,
    readNoPublishEnv,
    SYNTHETIC_QA_EMAIL_VAR,
    SYNTHETIC_QA_PASSWORD_VAR,
} from "./support/no-publish-guard";
import { Recorder } from "./support/recorder";

const env = readNoPublishEnv();
const money = expectedPrice();
const programme = expectedProgramme();

/** Wording from `src/lib/proposal-response.ts` for unsent draft preview (acknowledgement default). */
const RESPONSE_ACK = {
    option: "Ask the client to confirm they have received it",
    heading: "Confirm you have received this proposal",
    pdfSignatureLine: "Client: confirm receipt",
};

const REVIEW_DOCUMENT = "2. Review document";

const BINDING_ACCEPTANCE_CONTROL = /^(accept|accept (the |this )?proposal|i accept|sign and accept|agree and sign)/i;

const EXPECTED_THIRD_PARTIES = ["plausible.io", "www.clarity.ms", "api.postcodes.io"];
const BRIEF_ACTIVITIES = [PRICE.onePrice.description, PRICE.measured.description];
const programmePath = (id: string) => `/dashboard/projects/schedule?projectId=${encodeURIComponent(id)}`;
const proposalPath = (id: string) => `/dashboard/projects/proposal?projectId=${encodeURIComponent(id)}`;

async function guardNetwork(context: BrowserContext, blocked: Set<string>) {
    const allowed = new Set([new URL(env.baseUrl).host, new URL(env.supabaseUrl).host]);
    await context.route(
        (url) => /^https?:$/.test(url.protocol) && !allowed.has(url.host),
        async (route) => {
            blocked.add(new URL(route.request().url()).host);
            await route.abort();
        },
    );
}

async function guardNoPublish(
    context: BrowserContext,
    publishBlocked: string[],
    proposalActionBlocked: string[],
    signupBlocked: string[],
) {
    await context.route("**/*", async (route) => {
        const request = route.request();
        const url = request.url();
        const method = request.method();
        const headers = request.headers();
        if (url.includes("/auth/v1/signup")) {
            signupBlocked.push(url);
            await route.abort("blockedbyclient");
            return;
        }
        if (isForbiddenProposalServerActionPost(url, method, headers)) {
            proposalActionBlocked.push(url);
            await route.abort("blockedbyclient");
            return;
        }
        if (isForbiddenHostedPublishRequest(url, method)) {
            publishBlocked.push(url);
            await route.abort("blockedbyclient");
            return;
        }
        await route.fallback();
    });
}

async function pdfText(file: string): Promise<{ pages: number; text: string }> {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return { pages: totalPages, text: text.replace(/\s+/g, " ") };
}

async function stubControl(body: Record<string, unknown>) {
    await fetch(`${env.stubUrl}/__control`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("Phase 1 no-publish: labelled QA sign-in through draft PDF without publication", async ({ page, context }, testInfo) => {
    const use = pointerDriver(false);
    const recorder = new Recorder(page, testInfo, "pointer", env.evidence);
    const blockedHosts = new Set<string>();
    const publishBlocked: string[] = [];
    const proposalActionBlocked: string[] = [];
    const signupBlocked: string[] = [];
    await guardNetwork(context, blockedHosts);
    await guardNoPublish(context, publishBlocked, proposalActionBlocked, signupBlocked);
    await stubControl({ reset: true });

    const main = page.locator("main main");
    const jobContext = page.getByRole("navigation", { name: "Job context" });
    const button = (name: string | RegExp, scope: Page | typeof main = page) =>
        scope.getByRole("button", { name, exact: typeof name === "string" });
    let projectId = "";
    let checkCode = "";
    const documentFacts = [
        money.beforeVat, money.vat, money.includingVat,
        programme.stagedFinish,
        ...programme.stages.flatMap((stage) => [stage.name, stage.dates]),
        ...PAYMENT_STAGES.map((stage) => stage.name), money.deposit, money.balance,
    ];

    try {
        await test.step("sign in with the labelled synthetic QA account (no sign-up)", async () => {
            recorder.step("login only: no auth/v1/signup");
            await page.goto("/login");
            await use.fill(page.getByLabel("Email address"), env.qaEmail);
            await use.fill(page.getByLabel("Password", { exact: true }), env.qaPassword);
            await use.activate(button("Sign in"));
            await expect(page).not.toHaveURL(/\/login$/);
            expect(signupBlocked, "this variant must not create accounts").toEqual([]);
        });

        await test.step("company setup when the QA account still needs it", async () => {
            if (!page.url().includes("/onboarding")) {
                await page.goto("/dashboard/projects/new");
                return;
            }
            recorder.step("company setup: work description, then business name, then readiness");
            await use.fill(page.getByLabel("What kind of work do you do?", { exact: true }), COMPANY.trade);
            await use.activate(button(/Save and continue|Try again/));
            await use.fill(page.getByLabel("Business or trading name"), COMPANY.name);
            await use.fill(page.getByLabel(/Your name/), COMPANY.owner);
            await use.activate(button(/Save and continue|Try again/));
            await expect(page).toHaveURL(new RegExp(`${PROPOSAL_READINESS_PATH.replace(/\//g, "\\/")}$`));
            await expect(page.getByRole("heading", { name: COMPANY.name, exact: true })).toBeVisible();
            await page.locator('[data-welcome-step="proposal"]').click();
            await expect(page).toHaveURL(/\/dashboard\/projects\/new$/);
        });

        await test.step("one blank project", async () => {
            await expect(page.getByRole("heading", { level: 1, name: /Add your (first )?job/ })).toBeVisible();
            await use.fill(page.getByLabel("Job name"), JOB.name);
            await use.fill(page.getByLabel("Client name"), JOB.client);
            await use.activate(button(/Add more details/));
            await use.fill(page.getByLabel("Client email"), JOB.clientEmail);
            await use.fill(page.getByLabel("Where is the job?"), JOB.site);
            await use.activate(button("Create project and start the brief"));
            await expect(page).toHaveURL(/\/dashboard\/projects\/brief\?projectId=/);
            projectId = new URL(page.url()).searchParams.get("projectId") ?? "";
            expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
        });

        await test.step("guided brief without app AI", async () => {
            const description = page.getByLabel("Describe the job in your own words");
            await use.fill(description, JOB.description);
            await use.activate(button("Next", main));
            const entry = page.getByLabel("Activity to add");
            for (const activity of BRIEF_ACTIVITIES) {
                await entry.fill(activity);
                await use.activate(button("Add activity", main));
            }
            await use.activate(button("Next", main));
            await use.fill(page.getByLabel("Access, restrictions and assumptions"), JOB.siteNotes);
            await use.activate(button("Save and build the price", main));
            await expect(page).toHaveURL(/\/dashboard\/projects\/costs\?projectId=/);
            await expect(jobContext).toContainText("Estimate");
        });

        await test.step("simple estimate with explicit preliminaries and risk 7.5%", async () => {
            const total = page.getByRole("region", { name: "Running total" });
            await use.activate(button("Add the first price line"));
            await use.fill(page.getByLabel("What is this price for?"), PRICE.onePrice.description);
            await use.fill(page.getByLabel("Price (£)"), String(PRICE.onePrice.amount));
            await use.activate(button("Save line"));
            await use.activate(button("Add a price line"));
            await use.fill(page.getByLabel("What is this price for?"), PRICE.measured.description);
            await use.activate(button("Quantity and rate"));
            await use.fill(page.getByLabel("Quantity"), String(PRICE.measured.quantity));
            await use.select(page.getByLabel("Unit"), PRICE.measured.unit);
            await use.fill(page.getByLabel("Rate (£)"), String(PRICE.measured.rate));
            await use.activate(button("Save line"));
            const advanced = page.getByRole("region", { name: "Advanced estimating" });
            await use.activate(button(/^Advanced estimating/, advanced));
            await use.activate(button("+ Preliminaries", advanced));
            const prelims = advanced.getByRole("group", { name: "Preliminaries" });
            await use.fill(prelims.getByLabel("Description"), PRICE.preliminaries.description);
            await use.fill(prelims.getByLabel("Rate (£)"), String(PRICE.preliminaries.amount));
            await use.activate(button(/^Advanced estimating/, advanced));
            await use.activate(button(/^Price adjustments/));
            await use.fill(page.getByLabel("Risk (%)"), String(PRICE.riskPct));
            await use.activate(button("Save adjustments"));
            for (const figure of [money.beforeVat, money.vat, money.includingVat]) await expect(total).toContainText(figure);
        });

        await test.step("programme saved with contractor stages", async () => {
            await use.activate(page.getByRole("link", { name: /Next: Programme/ }));
            await expect(page).toHaveURL(new RegExp(programmePath(projectId).replace(/\?/, "\\?")));
            await expect(jobContext).toContainText("Programme");
            await use.fillDate(page.getByLabel("Start on site"), programme.startIso);
            await use.activate(button("Break the job into stages"));
            const rows = page.getByRole("region", { name: "Stages" }).getByRole("listitem");
            for (const [index, stage] of STAGES.entries()) {
                const row = rows.nth(index);
                await use.fill(row.getByRole("textbox").first(), stage.name);
                await use.fill(row.getByLabel("How long"), stage.length);
                await use.select(row.getByRole("combobox"), stage.unit);
            }
            await use.activate(button("Save programme"));
            await expect(main.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
            await use.activate(button("Next: Proposal"));
            await expect(page).toHaveURL(new RegExp(proposalPath(projectId).replace(/\?/, "\\?")));
            await expect(jobContext).toContainText("Proposal");
        });

        await test.step("review, payment preset and client-side pre-send draft PDF only", async () => {
            const preparation = page.locator("#proposal-preparation");
            const payments = preparation.locator("[data-review-payments]");
            await expect(page.getByRole("button", { name: REVIEW_DOCUMENT, exact: true })).toBeVisible();
            await expect(page.locator("#proposal-final-review")).toBeHidden();
            await use.check(payments.getByRole("radio", { name: /Deposit and balance/ }));
            await expect(payments.getByRole("radio", { name: /Deposit and balance/ })).toBeChecked();
            await expect(page.getByRole("heading", { level: 2, name: "Everything needed is in place" })).toBeVisible();

            await use.activate(page.getByRole("button", { name: REVIEW_DOCUMENT, exact: true }));
            await expect(page.locator("#proposal-final-review")).toBeVisible();
            await expect(page.getByRole("region", { name: "Send to your client" })).toBeVisible();

            const preview = page.getByRole("region", { name: "What your client will see" }).getByRole("article");
            for (const figure of [money.beforeVat, money.vat, money.includingVat]) {
                await expect(preview).toContainText(figure);
            }
            await expect(preview.getByRole("heading", { name: RESPONSE_ACK.heading })).toBeVisible();
            await expect(page.getByRole("button", { name: BINDING_ACCEPTANCE_CONTROL })).toHaveCount(0);

            const send = page.getByRole("region", { name: "Send to your client" });
            const presend = page.locator("[data-presend-pdf]");
            const draftDownload = page.waitForEvent("download");
            await use.activate(button("Download this draft as a PDF", presend));
            const draftFile = await draftDownload;
            const draftPdf = await pdfText(await draftFile.path());
            checkCode = (await presend.locator("[data-check-code]").innerText()).trim();
            expect(draftPdf.text).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");
            expect(draftPdf.text).toContain(`Check code ${checkCode}.`);
            for (const fact of documentFacts) expect(draftPdf.text, `the pre-send PDF states ${fact}`).toContain(fact);
            expect(draftPdf.text).toContain(RESPONSE_ACK.pdfSignatureLine);
            expect(draftPdf.text).not.toContain("Receipt confirmed");
            expect(await publicationRecords(projectId), "draft PDF must not create publications").toEqual([]);

            await expect(send.getByRole("checkbox", { name: /I have read the preview/ })).toBeEnabled();
            await expect(button(/^Send version 1/, send)).toBeEnabled();
            await expect(send).toContainText("Neither option is acceptance.");
        });

        expect(proposalActionBlocked, "proposal server actions must not be posted (draft PDF is client-side only)").toEqual([]);
        expect(publishBlocked, "publish RPCs must not be attempted in this variant").toEqual([]);
        expect([...blockedHosts].sort()).toEqual([...EXPECTED_THIRD_PARTIES].sort());

        await testInfo.attach("scope", {
            body: JSON.stringify({
                variant: "phase1-no-publish",
                disposableProject: APPROVED_DISPOSABLE_PROJECT.name,
                qaIdentityVars: [SYNTHETIC_QA_EMAIL_VAR, SYNTHETIC_QA_PASSWORD_VAR],
                endBoundary: "client-side-draft-pdf-download",
                proposalDraftSave: "NOT_EXERCISED",
                proposalServerActions: "ALL_NEXT_ACTION_POSTS_ON_PROPOSAL_ROUTE_ABORTED_BEFORE_TRANSPORT",
                draftPdf: "CLIENT_ONLY_buildPreviewSnapshot_downloadProposalPdf",
                publication: "NOT_EXERCISED",
                clientPortal: "NOT_RUN",
                won: "NOT_RUN",
                publishBlockedCount: publishBlocked.length,
                proposalActionBlockedCount: proposalActionBlocked.length,
                briefAiStubBudget: "NOT_APPLICABLE_VARIANT_DOES_NOT_CALL_BRIEF_AI",
                globalSetup: "e2e/support/no-publish-global-setup.ts",
                jobContextNav: "cohort Pipeline breadcrumb + current stage label",
                checkCode,
            }),
            contentType: "application/json",
        });
    } catch (error) {
        recorder.results.blockedThirdPartyHosts = [...blockedHosts].sort();
        recorder.write("failed");
        throw error;
    }
    recorder.results.blockedThirdPartyHosts = [...blockedHosts].sort();
    recorder.write("passed");
});
