import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { findObscuredControls, measureLayout, scanAccessibility, type AxeFinding, type LayoutReport, type ObscuredControl } from "./checks";
import type { FocusRecord } from "./driver";

/** Committed evidence lives here; a smoke run writes to test-results instead. */
export const EVIDENCE_DIR = path.resolve("docs/evidence/stage2-tranche-2f");

export interface Checkpoint {
    name: string;
    path: string;
    layout: LayoutReport;
    obscured: ObscuredControl[];
    accessibility: AxeFinding[];
    screenshot: string | null;
}

export interface JourneyResults {
    project: string;
    viewport: { width: number; height: number };
    input: "pointer" | "touch" | "keyboard";
    startedAt: string;
    finishedAt: string | null;
    outcome: "passed" | "failed";
    steps: string[];
    checkpoints: Checkpoint[];
    parity: Record<string, unknown>;
    keyboard: { controlsReached: number; withoutVisibleFocus: string[] } | null;
    blockedThirdPartyHosts: string[];
    provider: Record<string, unknown>;
    database: Record<string, unknown>;
}

export interface CheckpointOptions {
    /** CSS selector of the content whose controls must not sit under anything. */
    scope?: string;
    /** Capture a screenshot in evidence mode. */
    capture?: boolean;
    /** Scroll this into view before the screenshot. */
    focusOn?: import("@playwright/test").Locator;
    /**
     * The pipeline board keeps its compact, mouse-sized controls on a wide
     * pointer screen. There its control sizes are recorded, not enforced.
     * On a touch screen they are enforced like everything else.
     */
    compactOnPointerDesktop?: boolean;
}

/**
 * Collects the machine-readable result of one journey and, in evidence mode,
 * the small set of screenshots that go with it.
 */
export class Recorder {
    readonly results: JourneyResults;
    private readonly dir: string;
    private readonly evidence: boolean;
    private shot = 0;

    constructor(private readonly page: Page, private readonly info: TestInfo, input: JourneyResults["input"], evidence: boolean) {
        this.evidence = evidence;
        this.dir = evidence ? EVIDENCE_DIR : path.resolve("test-results/phase1");
        const viewport = page.viewportSize() ?? { width: 0, height: 0 };
        this.results = {
            project: info.project.name,
            viewport,
            input,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            outcome: "failed",
            steps: [],
            checkpoints: [],
            parity: {},
            keyboard: null,
            blockedThirdPartyHosts: [],
            provider: {},
            database: {},
        };
    }

    /** Screenshots are kept for the desktop and phone runs only. */
    private get captures(): boolean {
        return this.evidence && ["desktop", "phone"].includes(this.info.project.name);
    }

    step(name: string) {
        this.results.steps.push(name);
    }

    async screenshot(name: string, page: Page = this.page): Promise<string | null> {
        if (!this.captures) return null;
        this.shot += 1;
        const viewport = page.viewportSize() ?? this.results.viewport;
        const file = `${String(this.shot).padStart(2, "0")}-${name}-${viewport.width}x${viewport.height}.jpg`;
        mkdirSync(this.dir, { recursive: true });
        await page.screenshot({
            path: path.join(this.dir, file),
            type: "jpeg",
            quality: 55,
            scale: "css",
            animations: "disabled",
            // The private link is an access token. It is never written into evidence.
            mask: [page.locator("#published-link")],
            maskColor: "#d4d4d8",
        });
        return file;
    }

    /**
     * Measures the current screen and fails the journey on any layout or
     * accessibility finding that is a release blocker.
     */
    async checkpoint(name: string, options: CheckpointOptions = {}, page: Page = this.page): Promise<Checkpoint> {
        // Let colour and layout transitions finish, so a half-way state is never measured.
        await page.evaluate(() => Promise.all(
            document.getAnimations()
                .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
                .map((animation) => animation.finished.catch(() => undefined)),
        ));
        const layout = await measureLayout(page);
        const touchViewport = this.results.input === "touch";
        const obscured = touchViewport ? await findObscuredControls(page, options.scope ?? "body") : [];
        const accessibility = await scanAccessibility(page);
        if (options.focusOn) await options.focusOn.scrollIntoViewIfNeeded();
        const screenshot = options.capture === false ? null : await this.screenshot(name, page);

        const checkpoint: Checkpoint = {
            name,
            path: new URL(page.url()).pathname.replace(/[a-f0-9]{64}/, "<token>"),
            layout,
            obscured,
            accessibility,
            screenshot,
        };
        this.results.checkpoints.push(checkpoint);

        // Soft: the journey carries on, so one run lists every finding.
        expect.soft(layout.documentWidth, `${name}: the page must not scroll sideways`).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect.soft(layout.sidewaysPageScrollers, `${name}: no page-level scroller may scroll sideways`).toEqual([]);
        expect.soft(layout.elementsPastViewport, `${name}: nothing may extend past the viewport`).toEqual([]);
        if (touchViewport || !options.compactOnPointerDesktop) {
            expect.soft(layout.undersized, `${name}: every primary control must be at least 44 by 44 px`).toEqual([]);
        }
        // The side navigation is pressed with a finger only where the screen is a touch screen.
        if (touchViewport) expect.soft(layout.undersizedSideNavigation, `${name}: navigation controls must be at least 44 by 44 px on a touch screen`).toEqual([]);
        expect.soft(obscured, `${name}: no field or button may sit under a pinned control`).toEqual([]);
        const blocking = accessibility.filter((finding) => ["critical", "serious"].includes(finding.impact));
        expect.soft(blocking, `${name}: no critical or serious accessibility violation`).toEqual([]);
        return checkpoint;
    }

    keyboard(log: FocusRecord[]) {
        this.results.keyboard = {
            controlsReached: log.length,
            withoutVisibleFocus: Array.from(new Set(log.filter((entry) => !entry.visibleFocus).map((entry) => entry.control))),
        };
    }

    write(outcome: JourneyResults["outcome"]) {
        this.results.outcome = outcome;
        this.results.finishedAt = new Date().toISOString();
        mkdirSync(this.dir, { recursive: true });
        writeFileSync(path.join(this.dir, `results-${this.results.project}.json`), `${JSON.stringify(this.results, null, 2)}\n`);
    }
}
