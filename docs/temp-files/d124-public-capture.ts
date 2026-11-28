import type { Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import path from "node:path";

export type CaptureDiagnostic = {
    routeId: string;
    viewport: string;
    revealForced: boolean;
    reviewCaptures?: {
        present: boolean;
        images: Array<{
            complete: boolean;
            naturalWidth: number;
            naturalHeight: number;
            displayHeight: number;
            currentSrcTail: string;
        }>;
        heldViewportBoxOnHome: false;
        note: string;
    };
    productScreenshots?: {
        viewportPaddingTopPercent: string;
        programmeZoomTranslateY: string;
        note: string;
    };
    blockers: string[];
};

export async function preparePublicRouteForCapture(
    page: Page,
    routeId: string,
): Promise<CaptureDiagnostic> {
    const blockers: string[] = [];

    await page.evaluate(() => {
        document.documentElement.classList.add("reveal-armed");
        document.querySelectorAll("[data-reveal]").forEach(el => el.classList.add("reveal-in"));
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));

    const diag: CaptureDiagnostic = {
        routeId,
        viewport: "",
        revealForced: true,
        blockers,
    };

    if (routeId === "landing") {
        const section = page.locator("#review-captures");
        if ((await section.count()) === 0) {
            blockers.push("missing #review-captures section");
        } else {
            await section.scrollIntoViewIfNeeded();
            const imgs = section.locator("img");
            const n = await imgs.count();
            for (let i = 0; i < n; i++) {
                await imgs.nth(i).evaluate((img: HTMLImageElement) => {
                    img.loading = "eager";
                });
                await imgs.nth(i).scrollIntoViewIfNeeded();
            }
            try {
                await page.waitForFunction(
                    () => {
                        const imgs = document.querySelectorAll("#review-captures img");
                        return (
                            imgs.length >= 2
                            && [...imgs].every(
                                img =>
                                    (img as HTMLImageElement).complete
                                    && (img as HTMLImageElement).naturalHeight > 0,
                            )
                        );
                    },
                    { timeout: 20_000 },
                );
            } catch {
                blockers.push("review-capture images: not all decoded within 20s (lazy or missing asset)");
            }
            const reviewCaptures = await page.evaluate(() => {
                const section = document.getElementById("review-captures");
                if (!section) return { present: false, images: [], heldViewportBoxOnHome: false as const, note: "" };
                const imgs = [...section.querySelectorAll("img")] as HTMLImageElement[];
                return {
                    present: true,
                    heldViewportBoxOnHome: false as const,
                    note:
                        "Home uses direct <img> in figure (no .viewport padding-top box). Large blanks in uncorrected full-page shots were lazy below-fold decode / unrevealed sections, not product-page 62.5% held spacing.",
                    images: imgs.map(img => ({
                        complete: img.complete,
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                        displayHeight: img.getBoundingClientRect().height,
                        currentSrcTail: img.currentSrc.split("/").slice(-2).join("/"),
                    })),
                };
            });
            diag.reviewCaptures = reviewCaptures;
            for (const img of reviewCaptures.images) {
                if (!img.complete || img.naturalHeight === 0) {
                    blockers.push(`review-capture image not loaded: ${img.currentSrcTail}`);
                }
            }
        }
    }

    if (routeId === "product") {
        const shots = page.locator("#product-screenshots");
        if ((await shots.count()) > 0) {
            await shots.scrollIntoViewIfNeeded();
            await page.locator("#product-screenshots img").first().scrollIntoViewIfNeeded();
            try {
                await page.waitForFunction(
                    () => {
                        const imgs = document.querySelectorAll("#product-screenshots img");
                        return [...imgs].every(
                            img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalHeight > 0,
                        );
                    },
                    { timeout: 20_000 },
                );
            } catch {
                blockers.push("product-screenshots images: not all decoded within 20s");
            }
        }
        diag.productScreenshots = {
            viewportPaddingTopPercent: "62.5% (estimate 70%)",
            programmeZoomTranslateY: "-29%",
            note:
                "Intentional held layout from product-screenshots.module.css (.viewport padding-top + programme zoom). Distinguish from blank lazy-load failures inside the box.",
        };
    }

    return diag;
}

export function writeCaptureNotes(
    notesPath: string,
    records: CaptureDiagnostic[],
    meta: { sourceSha: string; capturedAt: string },
) {
    writeFileSync(
        notesPath,
        JSON.stringify(
            {
                ...meta,
                records,
                interpretation: {
                    heldSpacingCss:
                        "Product page .viewport reserves height via padding-top 62.5–70%; programme crop uses translateY(-29%). This is existing layout, not a D124 spacing fix.",
                    homeReviewCaptures:
                        "Landing #review-captures has no viewport box; uncorrected empties were capture-timing (data-reveal + lazy img), corrected by reveal-all + scroll/wait.",
                },
            },
            null,
            2,
        ),
        "utf8",
    );
}

export const CAPTURE_NOTES_PATH = path.join(
    process.cwd(),
    "docs/evidence/d124-brand-review/capture-notes.json",
);