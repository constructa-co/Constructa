/**
 * A023 platform consent: operator-assisted QA runner (headed, operator-only).
 *
 * Run only under playwright.platform-consent.config.ts, which stays held in
 * source until an explicitly authorised run. A human performs every
 * consequential step in the browser window: typing the labelled identity and
 * its credentials, reading and ticking the platform terms, creating the
 * account, confirming email in their own mail client, signing in and
 * accepting on the completion page. The harness never ticks a legal box,
 * never submits signup or acceptance, never opens an email link and never
 * holds a password. It observes non-secret state, then requires one exact
 * persisted consent record. Traces, screenshots, video and request bodies are
 * never recorded, and errors are redacted before they leave this file.
 *
 * Session access, stated plainly: for the readback the harness reads this
 * app's cookies once, after the human has signed in, and keeps the current
 * session's access token in memory. Supabase Auth must confirm that token
 * belongs to the labelled identity before the consent table is read, and the
 * read runs as that session, so row-level security returns only its own rows.
 * The token is never printed, stored or attached, and is redacted from errors.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
    PLATFORM_TERMS_COMPLETION_MESSAGES,
    PLATFORM_TERMS_COMPLETION_PATH,
    PLATFORM_TERMS_COMPLETION_SIGN_IN,
} from "../src/lib/platform-terms-completion";
import {
    accessTokenFromSessionCookies,
    consentHandoffPlan,
    isForbiddenHostedPublishRequest,
    isSignupServerActionPost,
    readConsentReadback,
    readPlatformConsentEnv,
    redactedError,
    type ConsentReadbackClient,
    type ConsentReadbackFilter,
    type ConsentStep,
} from "./support/platform-consent-guard";

const env = readPlatformConsentEnv();
const HUMAN_WAIT = 15 * 60_000;
const EXPECTED_THIRD_PARTIES = new Set(["plausible.io", "www.clarity.ms", "api.postcodes.io"]);

// Copy shown by src/app/login/page.tsx for each account-creating outcome.
const SIGNUP_OUTCOMES = {
    "created-and-recorded": "Account created and your acceptance of the platform terms is recorded.",
    "confirmation-required": "Account created. Check your email for the confirmation link",
    "consent-not-stored": "Your account was created, but we couldn't record your terms acceptance.",
} as const;

function handoff(message: string) {
    // Fixed operator prompts only: never a value from the page, the environment or the network.
    console.log(`\n[A023 HUMAN STEP] ${message}\n`);
}

async function guardNetwork(context: BrowserContext, blockedHosts: Set<string>, publishBlocked: string[]) {
    const allowed = new Set([new URL(env.baseUrl).host, new URL(env.supabaseUrl).host]);
    await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (/^https?:$/.test(url.protocol) && !allowed.has(url.host)) {
            blockedHosts.add(url.host);
            await route.abort();
            return;
        }
        if (isForbiddenHostedPublishRequest(request.url(), request.method())) {
            publishBlocked.push(url.pathname);
            await route.abort("blockedbyclient");
            return;
        }
        await route.fallback();
    });
}

async function observedSignupOutcome(page: Page): Promise<keyof typeof SIGNUP_OUTCOMES> {
    const [first, ...rest] = Object.values(SIGNUP_OUTCOMES).map((text) => page.getByText(text));
    await expect(rest.reduce((any, next) => any.or(next), first).first()).toBeVisible();
    for (const [outcome, text] of Object.entries(SIGNUP_OUTCOMES)) {
        if (await page.getByText(text).isVisible()) return outcome as keyof typeof SIGNUP_OUTCOMES;
    }
    throw new Error("No account-creating signup outcome is shown.");
}

async function runStep(page: Page, step: ConsentStep) {
    switch (step) {
        case "human-first-sign-in":
            handoff("Sign in in this window with the same labelled identity. The harness will not type it for you.");
            await page.waitForURL((url) => url.pathname !== "/login", { timeout: HUMAN_WAIT });
            return;
        case "human-email-confirmation":
            handoff(
                "Confirm the account from the confirmation email in your own mail client. The harness does not open, read or follow " +
                    "email links. Then return to this window and sign in.",
            );
            return;
        case "human-sign-in-to-completion":
            await page.goto(PLATFORM_TERMS_COMPLETION_SIGN_IN);
            handoff("Sign in in this window. You will be returned to the platform terms page.");
            await page.waitForURL((url) => url.pathname === PLATFORM_TERMS_COMPLETION_PATH, { timeout: HUMAN_WAIT });
            return;
        case "human-accept-completion": {
            const box = page.locator("#platform-terms-completion");
            await expect(box).not.toBeChecked();
            await expect(box).toHaveAttribute("required", "");
            handoff("Read the platform terms. If you accept them, tick the box yourself and submit. The harness will not.");
            const recorded = page.getByText(PLATFORM_TERMS_COMPLETION_MESSAGES.recorded)
                .or(page.getByText(PLATFORM_TERMS_COMPLETION_MESSAGES["already-recorded"]));
            await expect(recorded.first()).toBeVisible({ timeout: HUMAN_WAIT });
            return;
        }
        case "consent-readback":
            return;
    }
}

/**
 * An anon-key client acting as the human's own signed-in session, so the
 * consent table's row-level security returns only that user's rows. No
 * service-role or admin access is used for the readback.
 */
function sessionReadbackClient(accessToken: string): ConsentReadbackClient {
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    return {
        auth: { getUser: (jwt) => supabase.auth.getUser(jwt) },
        from: (table) => ({ select: (columns) => sessionFilter(supabase.from(table).select(columns)) }),
    };
}

type PostgrestFilter = ReturnType<ReturnType<ReturnType<typeof createClient>["from"]>["select"]>;

function sessionFilter(query: PostgrestFilter): ConsentReadbackFilter {
    return { eq: (column, value) => sessionFilter(query.eq(column, value)), limit: (count) => query.limit(count) };
}

test("A023 platform consent: human signup and acceptance, exact persisted readback", async ({ page, context }) => {
    const secrets = [env.supabaseServiceRoleKey, env.supabaseAnonKey, env.signupEmail];
    const blockedHosts = new Set<string>();
    const publishBlocked: string[] = [];
    const windowStart = new Date();

    try {
        await guardNetwork(context, blockedHosts, publishBlocked);

        await test.step("signup form: terms unticked and required before the human acts", async () => {
            await page.goto("/login");
            await page.getByRole("button", { name: "Get started", exact: true }).first().click();
            const box = page.locator("#platform-terms");
            await expect(box).not.toBeChecked();
            await expect(box).toHaveAttribute("required", "");
            await expect(page.locator("#platform-terms-link")).toHaveAttribute("href", "/terms-of-service");
        });

        let outcome: keyof typeof SIGNUP_OUTCOMES | undefined;
        await test.step("human signup through the server action", async () => {
            const action = page.waitForResponse(
                (response) => isSignupServerActionPost(
                    { url: response.url(), method: response.request().method(), headers: response.request().headers() },
                    env.baseUrl,
                ),
                { timeout: HUMAN_WAIT },
            );
            handoff(
                "Enter the labelled identity and choose its credentials yourself, read the platform terms, tick the box only if you " +
                    "accept them, then press the account creation button once. Do not retry if it fails.",
            );
            expect((await action).status()).toBe(200);
            outcome = await observedSignupOutcome(page);
        });

        // Throws for anything but an account-creating outcome; every plan ends in the readback.
        for (const step of consentHandoffPlan(outcome)) {
            await test.step(step, async () => runStep(page, step));
        }

        await test.step("consent-readback: bind the signed-in labelled identity, then its one exact record", async () => {
            // The one narrow session read. The token stays in memory and is redacted from any error.
            const accessToken = accessTokenFromSessionCookies(await context.cookies(env.baseUrl), env.projectRef);
            secrets.push(accessToken);
            const record = await readConsentReadback({
                client: sessionReadbackClient(accessToken),
                accessToken,
                expectedEmail: env.signupEmail,
                windowStart,
                windowEnd: new Date(),
            });
            console.log(`[A023 RESULT] outcome=${outcome} revision=${record.acceptedRevision} acceptedAt=${record.acceptedAt}`);
        });

        expect(publishBlocked, "publication requests must stay blocked").toEqual([]);
        expect([...blockedHosts].filter((host) => !EXPECTED_THIRD_PARTIES.has(host)), "unexpected outbound hosts").toEqual([]);
    } catch (error) {
        throw redactedError(error, secrets);
    }
});
