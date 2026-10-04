import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** The product target for anything a contractor or client has to press. */
export const TOUCH_TARGET_PX = 44;

/**
 * Optional workspaces the product itself describes as laid out for a wide
 * screen. Their controls are measured and reported, but they are not the
 * primary Phase 1 controls.
 */
export const ADVANCED_WORKSPACES = ["Advanced estimating", "Detailed programme planner"];

export interface SizedControl {
    control: string;
    width: number;
    height: number;
}

export interface LayoutReport {
    viewportWidth: number;
    documentWidth: number;
    /** Page-level scrollers that can be dragged sideways. Always a defect. */
    sidewaysPageScrollers: string[];
    /** Visible elements that poke out past the viewport outside any strip of their own. */
    elementsPastViewport: string[];
    controlsMeasured: number;
    /** Controls on the Phase 1 path smaller than the target. */
    undersized: SizedControl[];
    /** Small controls inside the optional advanced workspaces, reported separately. */
    undersizedAdvanced: SizedControl[];
    /** Small controls in the persistent side navigation, which is pointer-operated on a desktop. */
    undersizedSideNavigation: SizedControl[];
}

/**
 * Measures the page as it is rendered now: sideways overflow and the size
 * of every visible control. Runs in the browser.
 */
export function measureLayout(page: Page): Promise<LayoutReport> {
    return page.evaluate(({ target, advancedNames }) => {
        // The optional advanced workspaces are regions named by their own heading.
        const advancedRoots = Array.from(document.querySelectorAll("[aria-labelledby]")).filter((region) => {
            const name = document.getElementById(region.getAttribute("aria-labelledby") ?? "")?.textContent ?? "";
            return advancedNames.some((advanced) => name.includes(advanced));
        });
        const viewportWidth = document.documentElement.clientWidth;
        const label = (element: Element): string => {
            const text = element.getAttribute("aria-label")
                || (element as HTMLInputElement).labels?.[0]?.textContent
                || element.textContent
                || element.getAttribute("placeholder")
                || element.getAttribute("title")
                || "";
            return `${element.tagName.toLowerCase()}: ${text.replace(/\s+/g, " ").trim().slice(0, 70) || "(no name)"}`;
        };
        const visible = (element: Element): boolean => {
            const style = getComputedStyle(element);
            if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
            const box = element.getBoundingClientRect();
            return box.width > 1 && box.height > 1;
        };
        const clipsSideways = (element: Element): boolean => {
            for (let node = element.parentElement; node && node !== document.documentElement; node = node.parentElement) {
                if (node === document.body) continue;
                if (getComputedStyle(node).overflowX !== "visible") return true;
            }
            return false;
        };

        const sidewaysPageScrollers: string[] = [];
        const elementsPastViewport: string[] = [];
        for (const element of Array.from(document.querySelectorAll("body *"))) {
            if (!visible(element)) continue;
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            // A page scroller scrolls down the page; a strip of tabs does not.
            const scrollsDown = ["auto", "scroll"].includes(style.overflowY)
                && box.height >= window.innerHeight / 2
                && element.scrollHeight > element.clientHeight + 1;
            if (scrollsDown && element.scrollWidth > element.clientWidth + 1) {
                // Name what is too wide, not just the scroller.
                const edge = box.left + element.clientWidth;
                const culprits = Array.from(element.querySelectorAll("*"))
                    .filter((child) => visible(child) && child.getBoundingClientRect().right > edge + 1 && child.children.length === 0)
                    .slice(0, 3)
                    .map(label);
                sidewaysPageScrollers.push(`${element.tagName.toLowerCase()} scrolls sideways because of: ${culprits.join(" | ") || "unknown content"}`);
            }
            if ((box.right > viewportWidth + 1 || box.left < -1) && !clipsSideways(element) && style.position !== "fixed") {
                elementsPastViewport.push(label(element));
            }
        }

        const undersized: Array<{ control: string; width: number; height: number }> = [];
        const undersizedAdvanced: typeof undersized = [];
        const undersizedSideNavigation: typeof undersized = [];
        let controlsMeasured = 0;
        const controls = document.querySelectorAll(
            'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="switch"]',
        );
        for (const control of Array.from(controls)) {
            if ((control as HTMLButtonElement).disabled || control.getAttribute("aria-hidden") === "true") continue;
            // Tick boxes and radios are pressed by their whole labelled row.
            const input = control as HTMLInputElement;
            const pressed = control.tagName === "INPUT" && ["checkbox", "radio"].includes(input.type)
                ? control.closest("label") ?? control
                : control;
            if (!visible(pressed)) continue;
            // A link inside a sentence is sized by its line of text (WCAG 2.5.8 inline exception).
            if (control.tagName === "A" && getComputedStyle(control).display === "inline") continue;
            controlsMeasured += 1;
            const box = pressed.getBoundingClientRect();
            if (box.width >= target - 0.5 && box.height >= target - 0.5) continue;
            const entry = { control: label(control), width: Math.round(box.width), height: Math.round(box.height) };
            if (advancedRoots.some((root) => root.contains(control))) undersizedAdvanced.push(entry);
            else if (control.closest("aside")) undersizedSideNavigation.push(entry);
            else undersized.push(entry);
        }

        return {
            viewportWidth,
            documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            sidewaysPageScrollers,
            elementsPastViewport: Array.from(new Set(elementsPastViewport)).slice(0, 20),
            controlsMeasured,
            undersized,
            undersizedAdvanced,
            undersizedSideNavigation,
        };
    }, { target: TOUCH_TARGET_PX, advancedNames: ADVANCED_WORKSPACES });
}

export interface ObscuredControl {
    control: string;
    coveredBy: string;
}

/**
 * Brings every field and button in the content to the middle of the screen
 * and reports any that still sit underneath something else. A control that
 * cannot be scrolled clear of a pinned bar is one the contractor cannot press.
 */
export function findObscuredControls(page: Page, scope: string): Promise<ObscuredControl[]> {
    return page.evaluate((selector) => {
        const root = document.querySelector(selector) ?? document.body;
        const name = (element: Element) =>
            (element.getAttribute("aria-label") || (element as HTMLInputElement).labels?.[0]?.textContent || element.textContent || element.tagName)
                .replace(/\s+/g, " ").trim().slice(0, 60);
        // Remember where every scroller was, so the page is left as it was found.
        const scrollers = [document.scrollingElement as Element, ...Array.from(document.querySelectorAll("*")).filter((element) => element.scrollTop > 0)]
            .map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }));

        const obscured: Array<{ control: string; coveredBy: string }> = [];
        for (const control of Array.from(root.querySelectorAll("input:not([type=hidden]), textarea, select, button"))) {
            if ((control as HTMLButtonElement).disabled) continue;
            const pressed = control.closest("label") ?? control;
            if (pressed.getBoundingClientRect().width < 2 || pressed.getBoundingClientRect().height < 2) continue;
            pressed.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
            const box = pressed.getBoundingClientRect();
            const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            if (hit !== null && (pressed.contains(hit) || hit.contains(pressed))) continue;
            const cover = hit?.closest("header, footer, nav, [class*='sticky'], [class*='fixed']") ?? hit;
            obscured.push({
                control: name(control),
                coveredBy: cover ? `${cover.tagName.toLowerCase()}.${String(cover.getAttribute("class") ?? "").split(/\s+/).slice(0, 4).join(".")} "${name(cover).slice(0, 30)}"` : "outside the viewport",
            });
        }
        for (const { element, top, left } of scrollers) element.scrollTo(left, top);
        return obscured;
    }, scope);
}

export interface AxeFinding {
    id: string;
    impact: string;
    help: string;
    nodes: number;
    /** Where it was found, with the measured contrast where that is the rule. */
    targets: string[];
}

/** WCAG 2.2 A and AA rules. A floor, not a substitute for the keyboard run. */
export async function scanAccessibility(page: Page): Promise<AxeFinding[]> {
    const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
    return results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? "unknown",
        help: violation.help,
        nodes: violation.nodes.length,
        targets: violation.nodes.slice(0, 12).map((node) => {
            const data = node.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string } | undefined;
            const contrast = data?.contrastRatio ? ` [${data.contrastRatio}:1 ${data.fgColor} on ${data.bgColor}]` : "";
            return `${String(node.target[0]).slice(0, 110)}${contrast}`;
        }),
    }));
}

/** Relative luminance of a CSS rgb()/rgba() colour, 0 (black) to 1 (white). */
export function luminance(cssColour: string): number | null {
    const parts = cssColour.match(/[\d.]+/g)?.map(Number);
    if (!parts || parts.length < 3) return null;
    const [r, g, b] = parts.slice(0, 3).map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
