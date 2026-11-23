import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
    clientProfileIsolationProbe,
    savedProfileFields,
    syntheticUserIdByEmail,
} from "./support/backend";
import { pointerDriver } from "./support/driver";
import {
    D81_PROFILE_ALPHA_EMAIL,
    D81_PROFILE_ALPHA_PASSWORD,
    D81_PROFILE_BETA_EMAIL,
    D81_PROFILE_BETA_PASSWORD,
    readEphemeralReplayEnv,
} from "./support/ephemeral-replay-env";
import { Recorder } from "./support/recorder";

/**
 * CON-012: two seeded synthetic accounts on the disposable replay stack must not
 * prefill or overwrite each other's profile fields through onboarding or settings UI.
 */
const env = readEphemeralReplayEnv();

const IDENTITY_A = {
    email: D81_PROFILE_ALPHA_EMAIL,
    password: D81_PROFILE_ALPHA_PASSWORD,
    trade: "D81 alpha bathroom and tiling",
    company: "D81 Synthetic Alpha Ltd",
    owner: "D81 Alpha Owner",
    phone: "0113 700 0001",
};

const IDENTITY_B = {
    email: D81_PROFILE_BETA_EMAIL,
    password: D81_PROFILE_BETA_PASSWORD,
    trade: "D81 beta roofing and repairs",
    company: "D81 Synthetic Beta Ltd",
    owner: "D81 Beta Owner",
    phone: "0113 700 0002",
};

interface Session {
    userId: string;
    accessToken: string;
}

async function signIn(
    page: Page,
    context: BrowserContext,
    use: ReturnType<typeof pointerDriver>,
    email: string,
    password: string,
): Promise<Session> {
    await context.clearCookies();
    await page.goto("/login");
    await use.fill(page.getByLabel("Email address"), email);
    await use.fill(page.getByLabel("Password", { exact: true }), password);
    const login = page.waitForResponse(
        (response) => response.url().includes("/auth/v1/token") && response.request().method() === "POST",
    );
    await use.activate(page.locator("form").getByRole("button", { name: "Sign in", exact: true }));
    const loginResponse = await login;
    expect(loginResponse.status()).toBe(200);
    const body = (await loginResponse.json()) as { access_token?: string; user?: { id?: string } };
    const userId = String(body.user?.id ?? "");
    const accessToken = String(body.access_token ?? "");
    expect(userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(accessToken.length).toBeGreaterThan(20);
    await expect(page).not.toHaveURL(/\/login$/);
    return { userId, accessToken };
}

async function completeOnboarding(
    page: Page,
    use: ReturnType<typeof pointerDriver>,
    identity: typeof IDENTITY_A,
    forbiddenCompany: string,
) {
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByLabel("What kind of work do you do?")).toHaveValue("");
    await use.fill(page.getByLabel("What kind of work do you do?"), identity.trade);
    await use.activate(page.getByRole("button", { name: /Save and continue|Try again/ }));
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
    await expect(page.locator("#setup-company-name")).toHaveValue("");
    await expect(page.locator("#setup-company-name")).not.toHaveValue(forbiddenCompany);
    await use.fill(page.getByLabel("Business or trading name"), identity.company);
    await use.fill(page.getByLabel(/Your name/), identity.owner);
    await use.activate(page.getByRole("button", { name: /Save and continue|Try again|^Save$/ }));
    await expect(page).toHaveURL(/\/dashboard\/settings\/profile\/readiness$/);
}

test("D81: profile prefill and save stay isolated across two synthetic accounts", async ({ page, context }, testInfo) => {
    const use = pointerDriver(false);
    const recorder = new Recorder(page, testInfo, "pointer", env.evidence);
    const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });

    const allowed = new Set([new URL(env.baseUrl).host, new URL(env.supabaseUrl).host]);
    const blockedHosts = new Set<string>();
    await context.route((url) => /^https?:$/.test(url.protocol) && !allowed.has(url.host), (route) => {
        blockedHosts.add(new URL(route.request().url()).host);
        return route.abort();
    });

    const alphaId = (await syntheticUserIdByEmail(IDENTITY_A.email, env)) ?? "";
    const betaId = (await syntheticUserIdByEmail(IDENTITY_B.email, env)) ?? "";
    expect(alphaId).toMatch(/^[0-9a-f-]{36}$/);
    expect(betaId).toMatch(/^[0-9a-f-]{36}$/);
    expect(alphaId).not.toBe(betaId);

    let sessionA: Session | null = null;
    let sessionB: Session | null = null;

    let completed = false;
    try {
        await test.step("account A: empty onboarding fields, then save distinctive profile", async () => {
            recorder.step("sign in as alpha; onboarding must not show beta data");
            sessionA = await signIn(page, context, use, IDENTITY_A.email, IDENTITY_A.password);
            expect(sessionA.userId).toBe(alphaId);
            await completeOnboarding(page, use, IDENTITY_A, IDENTITY_B.company);
            const stored = await savedProfileFields(sessionA.userId, IDENTITY_A.email, env);
            expect(stored?.companyName).toBe(IDENTITY_A.company);
            expect(stored?.businessType).toBe(IDENTITY_A.trade);
            expect(stored?.fullName).toBe(IDENTITY_A.owner);
        });

        await test.step("account B: unset fields must not prefill from account A", async () => {
            recorder.step("sign in as beta before beta has saved anything");
            sessionB = await signIn(page, context, use, IDENTITY_B.email, IDENTITY_B.password);
            expect(sessionB.userId).toBe(betaId);
            await completeOnboarding(page, use, IDENTITY_B, IDENTITY_A.company);
            const betaStored = await savedProfileFields(sessionB.userId, IDENTITY_B.email, env);
            expect(betaStored?.companyName).toBe(IDENTITY_B.company);
            const alphaStored = await savedProfileFields(sessionA!.userId, IDENTITY_A.email, env);
            expect(alphaStored?.companyName).toBe(IDENTITY_A.company);
        });

        await test.step("account A: profile settings keep alpha values after beta saved", async () => {
            recorder.step("reload alpha profile in the UI and database");
            sessionA = await signIn(page, context, use, IDENTITY_A.email, IDENTITY_A.password);
            await page.goto("/dashboard/settings/profile");
            await expect(page.locator("#company-company_name")).toHaveValue(IDENTITY_A.company);
            await expect(page.locator("#company-company_name")).not.toHaveValue(IDENTITY_B.company);
            await use.activate(page.getByRole("button", { name: "Your people" }));
            await use.fill(page.getByLabel("Phone", { exact: true }), IDENTITY_A.phone);
            await use.activate(page.getByRole("button", { name: "Save Company Profile" }));
            await expect(page.locator("#profile-save-status")).toHaveText("Profile saved.");
            await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
            await page.reload();
            await use.activate(page.getByRole("button", { name: "Your people" }));
            await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(IDENTITY_A.phone);
            const alphaStored = await savedProfileFields(sessionA.userId, IDENTITY_A.email, env);
            expect(alphaStored?.phone).toBe(IDENTITY_A.phone);
            const betaStored = await savedProfileFields(sessionB!.userId, IDENTITY_B.email, env);
            expect(betaStored?.phone ?? "").not.toBe(IDENTITY_A.phone);
        });

        await test.step("RLS: each session reads only its own profile row", async () => {
            recorder.step("client JWT cannot fetch the other synthetic profile");
            const probeA = await clientProfileIsolationProbe(
                sessionA!.accessToken,
                sessionA!.userId,
                sessionB!.userId,
                IDENTITY_A.email,
                env,
            );
            expect(probeA.ownRow?.companyName).toBe(IDENTITY_A.company);
            expect(probeA.otherRow).toBeNull();

            sessionB = await signIn(page, context, use, IDENTITY_B.email, IDENTITY_B.password);
            const probeB = await clientProfileIsolationProbe(
                sessionB.accessToken,
                sessionB.userId,
                sessionA!.userId,
                IDENTITY_B.email,
                env,
            );
            expect(probeB.ownRow?.companyName).toBe(IDENTITY_B.company);
            expect(probeB.otherRow).toBeNull();
        });

        await test.step("account B: profile UI still shows beta-only values", async () => {
            await page.goto("/dashboard/settings/profile");
            await expect(page.locator("#company-company_name")).toHaveValue(IDENTITY_B.company);
            await expect(page.locator("#company-company_name")).not.toHaveValue(IDENTITY_A.company);
            await use.activate(page.getByRole("button", { name: "Your people" }));
            await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(IDENTITY_B.owner);
            await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("");
            await use.fill(page.getByLabel("Phone", { exact: true }), IDENTITY_B.phone);
            await use.activate(page.getByRole("button", { name: "Save Company Profile", exact: true }));
            await expect(page.locator("#profile-save-status")).toHaveText("Profile saved.");
            await page.reload();
            await use.activate(page.getByRole("button", { name: "Your people" }));
            await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(IDENTITY_B.phone);
            const alphaAfter = await savedProfileFields(sessionA!.userId, IDENTITY_A.email, env);
            const betaAfter = await savedProfileFields(sessionB!.userId, IDENTITY_B.email, env);
            expect(alphaAfter).toMatchObject({ companyName: IDENTITY_A.company, fullName: IDENTITY_A.owner, phone: IDENTITY_A.phone });
            expect(betaAfter).toMatchObject({ companyName: IDENTITY_B.company, fullName: IDENTITY_B.owner, phone: IDENTITY_B.phone });
        });
        completed = true;
    } finally {
        recorder.results.blockedThirdPartyHosts = [...blockedHosts].sort();
        recorder.write(completed ? "passed" : "failed");
    }
});
