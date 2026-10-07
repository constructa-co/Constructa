import type { BrowserContext, Page } from "@playwright/test";
import { readE2EEnv } from "./env";

const env = readE2EEnv();

/**
 * Lets the page reach only the application under test and the approved
 * disposable project. Anything else is stopped and recorded, so a run can
 * never talk to production from the browser.
 */
export async function guardNetwork(context: BrowserContext, blocked: Set<string>) {
    const allowed = new Set([new URL(env.baseUrl).host, new URL(env.supabaseUrl).host]);
    await context.route(
        (url) => /^https?:$/.test(url.protocol) && !allowed.has(url.host),
        async (route) => {
            blocked.add(new URL(route.request().url()).host);
            await route.abort();
        },
    );
}

/** Drops the connection for the next server action only, as a lost network would. */
export async function failNextServerAction(page: Page) {
    let failed = false;
    await page.route("**/*", async (route) => {
        const request = route.request();
        if (!failed && request.method() === "POST" && request.headers()["next-action"]) {
            failed = true;
            await route.abort("connectionfailed");
            return;
        }
        await route.fallback();
    });
}

export async function stubControl(body: Record<string, unknown>) {
    await fetch(`${env.stubUrl}/__control`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export async function stubLog(): Promise<{ ai: unknown[]; emails: Array<{ to: string[]; subject: string; delivered: boolean }>; violations: unknown[] }> {
    return (await fetch(`${env.stubUrl}/__log`)).json();
}
