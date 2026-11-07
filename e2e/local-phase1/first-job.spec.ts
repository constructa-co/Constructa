import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalFirstJobFixture } from "./first-job-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    newJob: "REAL_COMPONENT over MOCK_CREATE (existing parse/build/resolve modules; RPC reply mocked with the form requestId)",
    brief: "REAL_COMPONENT over MOCK_PAGE_PROJECTION and MOCK_SAVE",
    estimate: "REAL_COMPONENT over MOCK_ROUTING; price persistence REFUSED_BY_FIXTURE",
    sessionStorage: "EPHEMERAL_IN_MEMORY_STAND_IN",
    randomUUID: "FIXTURE_GET_RANDOM_VALUES_V4_ADAPTER; native secure-origin API NOT_RUN",
    serverActions: "NOT_RUN",
    auth: "NOT_RUN",
    database: "NOT_RUN",
    nextRoutingAndReloadDurability: "NOT_RUN",
    postcodeExtraction: "NOT_RUN",
    programme: "NOT_RUN",
    termsAndPdf: "NOT_RUN",
    clientResponse: "NOT_RUN",
    won: "NOT_RUN",
    advancedEstimating: "NOT_RUN",
    ai: "NOT_RUN",
    videoWalkthrough: "NOT_RUN",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const briefPath = (id: string) => `/dashboard/projects/brief?projectId=${encodeURIComponent(id)}`;
const pricingPath = (id: string) => `/dashboard/projects/costs?projectId=${encodeURIComponent(id)}`;
const CREATE = "Create project and start the brief";
const CREATE_ERROR = "We couldn't create the project. Nothing you typed has been lost. Check your connection and try again.";

const JOB = "Offline first job: rear roof slope";
const CLIENT = "Synthetic first client";
const SITE = "Synthetic site, rear of the terrace";
const TYPE = "Roof repair";
const START = "2026-11-16";
const START_SHOWN = "16 November 2026";
const WORK = "Strip and renew the rear roof slope, renew the gutters and repoint the chimney stack.";
const ACTIVITIES = ["Strip existing coverings and battens", "Re-felt, batten and re-tile the slope"];
const CUSTOM_ACTIVITY = "Scaffold loading bay for tile deliveries";

interface FixtureSnapshot {
    view: LocalFirstJobFixture["view"];
    attempts: LocalFirstJobFixture["attempts"];
    rpcCalls: LocalFirstJobFixture["rpcCalls"];
    results: LocalFirstJobFixture["results"];
    jobId: string | null;
    project: LocalFirstJobFixture["project"];
    lockReason: string | null;
    briefSaves: LocalFirstJobFixture["briefSaves"];
    navigation: string[];
    unexpected: string[];
    priceWrites: string[];
}

const snapshot = (page: Page): Promise<FixtureSnapshot> => page.evaluate(() => {
    const f = window.__firstJobLocal;
    return {
        view: f.view, attempts: f.attempts, rpcCalls: f.rpcCalls, results: f.results, jobId: f.jobId,
        project: f.project, lockReason: f.lockReason, briefSaves: f.briefSaves,
        navigation: f.navigation, unexpected: f.unexpected, priceWrites: f.priceWrites,
    };
});

const fillNewJob = async (page: Page, answers: { job: string; client: string; site: string; type: string; start: string }) => {
    await page.getByLabel("Job name", { exact: true }).fill(answers.job);
    await page.getByLabel("Client name", { exact: true }).fill(answers.client);
    const more = page.getByRole("button", { name: /^Add more details/ });
    if (await more.getAttribute("aria-expanded") !== "true") await more.click();
    await page.getByLabel("Where is the job?", { exact: true }).fill(answers.site);
    await page.getByLabel("Type of job", { exact: true }).fill(answers.type);
    await page.getByLabel("Likely start date", { exact: true }).fill(answers.start);
};

const expectedRaw = (requestId: string, answers: { job: string; client: string; site: string; type: string; start: string }) => ({
    name: answers.job, client: answers.client, clientEmail: "", clientPhone: "", clientAddress: "",
    siteAddress: answers.site, projectType: answers.type, startDate: answers.start, potentialValue: "", requestId,
});

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local first job to brief and price fixture - simulated creation and saves</title></head><body><p>LOCAL FIXTURE: job creation, brief saves, routing and pricing persistence are simulated. No account, server or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test("a new job starts blank, opens its own Brief, and the saved Brief reaches same-job pricing without a price write", async ({ page }, info) => {
    await expect(page.getByRole("heading", { name: "Add your first job", exact: true })).toBeVisible();

    // Required answers are checked in the browser before any create call.
    await page.getByRole("button", { name: CREATE, exact: true }).click();
    await expect(page.getByText("Give the job a name.", { exact: true })).toBeVisible();
    await expect(page.getByText("Add the client's name.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Job name", { exact: true })).toHaveAttribute("aria-invalid", "true");
    const blocked = await snapshot(page);
    expect(blocked.attempts).toEqual([]);
    expect(blocked.rpcCalls).toEqual([]);
    expect(blocked.navigation).toEqual([]);

    const answers = { job: JOB, client: CLIENT, site: SITE, type: TYPE, start: START };
    await fillNewJob(page, answers);
    await page.getByRole("button", { name: CREATE, exact: true }).click();
    await expect(page.getByText(`${JOB} for ${CLIENT}`, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Describe the job in your own words")).toHaveValue("");

    const created = await snapshot(page);
    expect(created.attempts).toHaveLength(1);
    const requestId = created.attempts[0].requestId;
    expect(requestId).toMatch(UUID);
    expect(created.attempts[0]).toEqual(expectedRaw(requestId, answers));
    expect(created.rpcCalls).toEqual([{ outcome: "created", graph: {
        requestId,
        project: {
            name: JOB, client_name: CLIENT, client_email: null, client_phone: null, client_address: null,
            site_address: SITE, project_type: TYPE, start_date: START, potential_value: null,
            status: "Lead", proposal_complexity: "full",
        },
        estimates: [],
    } }]);
    expect(created.results).toEqual([{ success: true, projectId: requestId }]);
    expect(created.jobId).toBe(requestId);
    expect(created.navigation).toEqual([briefPath(requestId)]);
    expect(created.view).toBe("brief");
    expect(created.lockReason).toBeNull();
    // Nothing reaches the Brief that the contractor did not type.
    expect(created.project).toEqual({
        id: requestId, name: JOB, client_name: CLIENT, site_address: SITE, postcode: "",
        potential_value: null, start_date: START, brief_scope: "", brief_trade_sections: [],
        client_type: "domestic", lat: null, lng: null, region: "", brief_completed: false,
    });

    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const entry = page.getByLabel("Activity to add");
    await entry.fill(ACTIVITIES[0]);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    await entry.fill(ACTIVITIES[1]);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    await expect(page.getByRole("button", { name: `Remove ${ACTIVITIES[0]}`, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Remove ${ACTIVITIES[1]}`, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // The new job's own site and start date reach the Brief's site stage.
    await expect(page.getByText(SITE, { exact: true })).toBeVisible();
    await expect(page.locator("[data-brief-site-context]")).toContainText(START_SHOWN);
    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Build the price", exact: true })).toBeVisible();
    await expect(page.getByText(`${JOB} for ${CLIENT}`, { exact: true })).toBeVisible();
    await expect(page.locator("[aria-labelledby='pricing-context-title']")).toContainText(WORK);

    const priced = await snapshot(page);
    expect(priced.briefSaves).toHaveLength(1);
    expect(priced.briefSaves[0].projectId).toBe(requestId);
    expect(priced.briefSaves[0].payload.brief_completed).toBe(true);
    expect(priced.briefSaves[0].payload.brief_scope).toBe(WORK);
    expect(priced.briefSaves[0].payload.brief_trade_sections).toEqual(ACTIVITIES);
    expect(priced.briefSaves[0].payload.start_date).toBe(START);
    expect("potential_value" in priced.briefSaves[0].payload).toBe(false);
    expect(priced.project?.id).toBe(requestId);
    expect(priced.project?.brief_scope).toBe(WORK);
    expect(priced.project?.brief_trade_sections).toEqual(ACTIVITIES);
    expect(priced.navigation).toEqual([briefPath(requestId), pricingPath(requestId)]);
    expect(priced.view).toBe("pricing");
    expect(priced.rpcCalls).toHaveLength(1);

    await page.getByRole("button", { name: "Add the first price line", exact: true }).click();
    expect((await snapshot(page)).priceWrites).toEqual([]);

    await page.locator("[data-new-price-activity] summary").click();
    const options = await page.locator("#new-line-activity-names option")
        .evaluateAll(opts => opts.map(option => option.getAttribute("value")));
    expect(options).toEqual(ACTIVITIES);

    const activityInput = page.getByLabel("Activity for this new line");
    await activityInput.fill(ACTIVITIES[0]);
    await expect(activityInput).toHaveValue(ACTIVITIES[0]);
    await activityInput.fill(CUSTOM_ACTIVITY);
    await expect(activityInput).toHaveValue(CUSTOM_ACTIVITY);

    const finished = await snapshot(page);
    expect(finished.priceWrites).toEqual([]);
    expect(finished.unexpected).toEqual([]);
    expect(await page.locator("[data-price-line]").count()).toBe(0);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requestId, requests }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "first-job.png"), fullPage: true });
});

test("a refused creation keeps the exact answers and request until the deliberate retry opens one new job", async ({ page }, info) => {
    await expect(page.getByRole("heading", { name: "Add your first job", exact: true })).toBeVisible();
    // Typed exactly, including the trailing space the parser later trims.
    const answers = { job: `${JOB} `, client: CLIENT, site: SITE, type: TYPE, start: START };
    await fillNewJob(page, answers);
    await page.evaluate(() => { window.__firstJobLocal.nextCreate = "refused"; });
    await page.getByRole("button", { name: CREATE, exact: true }).click();

    await expect(page.getByRole("alert")).toContainText("Project creation wasn't confirmed");
    await expect(page.locator("[data-job-retry-help]")).toBeVisible();
    await expect(page.getByLabel("Job name", { exact: true })).toHaveValue(answers.job);
    await expect(page.getByLabel("Client name", { exact: true })).toHaveValue(answers.client);
    await expect(page.getByLabel("Where is the job?", { exact: true })).toHaveValue(answers.site);
    await expect(page.getByLabel("Type of job", { exact: true })).toHaveValue(answers.type);
    await expect(page.getByLabel("Likely start date", { exact: true })).toHaveValue(answers.start);

    const refused = await snapshot(page);
    expect(refused.attempts).toHaveLength(1);
    const requestId = refused.attempts[0].requestId;
    expect(requestId).toMatch(UUID);
    expect(refused.attempts[0]).toEqual(expectedRaw(requestId, answers));
    expect(refused.rpcCalls).toHaveLength(1);
    expect(refused.rpcCalls[0].outcome).toBe("refused");
    expect(refused.rpcCalls[0].graph.requestId).toBe(requestId);
    expect(refused.rpcCalls[0].graph.project.name).toBe(JOB);
    expect(refused.results).toEqual([{ success: false, error: CREATE_ERROR }]);
    expect(refused.jobId).toBeNull();
    expect(refused.navigation).toEqual([]);
    expect(refused.view).toBe("new-job");

    // Nothing retries on its own; the contractor chooses Try again.
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByText(`${JOB} for ${CLIENT}`, { exact: true })).toBeVisible();

    const retried = await snapshot(page);
    expect(retried.attempts).toHaveLength(2);
    expect(retried.attempts[1]).toEqual(retried.attempts[0]);
    expect(retried.rpcCalls.map(call => call.outcome)).toEqual(["refused", "created"]);
    expect(retried.rpcCalls[1].graph).toEqual(retried.rpcCalls[0].graph);
    expect(retried.results[1]).toEqual({ success: true, projectId: requestId });
    expect(retried.jobId).toBe(requestId);
    expect(retried.navigation).toEqual([briefPath(requestId)]);
    expect(retried.view).toBe("brief");
    expect(retried.project?.id).toBe(requestId);
    expect(retried.project?.name).toBe(JOB);
    expect(retried.project?.brief_scope).toBe("");
    expect(retried.project?.brief_trade_sections).toEqual([]);
    expect(retried.briefSaves).toEqual([]);
    expect(retried.priceWrites).toEqual([]);
    expect(retried.unexpected).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requestId, requests }), contentType: "application/json" });
});
