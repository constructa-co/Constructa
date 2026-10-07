import { expect, type Locator, type Page } from "@playwright/test";

/**
 * How the journey operates the page. The same journey runs with a pointer
 * (mouse or touch) and, on desktop, with the keyboard alone, so the
 * keyboard run proves the path can be completed without a pointer rather
 * than testing a different path.
 */
export interface Driver {
    readonly kind: "pointer" | "keyboard";
    /** Press a button or follow a link. */
    activate(target: Locator): Promise<void>;
    /** Replace the contents of a text field. */
    fill(target: Locator, value: string): Promise<void>;
    /** Set a date field from an ISO date (yyyy-mm-dd). */
    fillDate(target: Locator, isoDate: string): Promise<void>;
    /** Tick a checkbox or choose a radio button. */
    check(target: Locator): Promise<void>;
    /** Choose an option of a native select by its visible label. */
    select(target: Locator, label: string): Promise<void>;
}

export interface FocusRecord {
    control: string;
    visibleFocus: boolean;
    tabPresses: number;
}

export function pointerDriver(hasTouch: boolean): Driver {
    return {
        kind: "pointer",
        activate: (target) => (hasTouch ? target.tap() : target.click()),
        fill: (target, value) => target.fill(value),
        fillDate: (target, isoDate) => target.fill(isoDate),
        check: (target) => target.check(),
        select: async (target, label) => { await target.selectOption({ label }); },
    };
}

const MAX_TAB_PRESSES = 400;

/**
 * Keyboard-only operation. Every control is reached with Tab or Shift+Tab
 * from wherever focus already is, never by a scripted focus call, and each
 * control reached is checked for a visible focus indicator.
 */
export function keyboardDriver(page: Page, focusLog: FocusRecord[]): Driver {
    const modifier = process.platform === "darwin" ? "Meta" : "Control";

    const isFocused = (target: Locator) =>
        target.evaluate((element) => element === document.activeElement).catch(() => false);

    const describe = (target: Locator) =>
        target.evaluate((element) => {
            const name = element.getAttribute("aria-label")
                || (element as HTMLInputElement).labels?.[0]?.textContent
                || element.textContent
                || element.getAttribute("placeholder")
                || element.tagName;
            return `${element.tagName.toLowerCase()}: ${String(name).replace(/\s+/g, " ").trim().slice(0, 60)}`;
        });

    /** True when the focused element shows an outline or a focus ring. */
    const hasVisibleFocus = (target: Locator) =>
        target.evaluate((element) => {
            const shows = (node: Element | null): boolean => {
                if (!node) return false;
                const style = getComputedStyle(node);
                const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
                const ring = style.boxShadow !== "none";
                return outline || ring;
            };
            // A radio or tick box may show focus on the row that wraps it.
            return shows(element) || shows(element.closest("label"));
        });

    const tabTo = async (target: Locator) => {
        await expect(target).toBeVisible();
        await expect(target).toBeEnabled();
        let presses = 0;
        if (!(await isFocused(target))) {
            // Go backwards when the control sits before the current focus.
            const backwards = await target.evaluate((element) => {
                const active = document.activeElement;
                if (!active || active === document.body) return false;
                return Boolean(active.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING);
            });
            const key = backwards ? "Shift+Tab" : "Tab";
            while (!(await isFocused(target))) {
                if (presses >= MAX_TAB_PRESSES) {
                    throw new Error(`Keyboard: could not reach "${await describe(target)}" with ${key} in ${MAX_TAB_PRESSES} presses.`);
                }
                await page.keyboard.press(key);
                presses += 1;
            }
        }
        focusLog.push({ control: await describe(target), visibleFocus: await hasVisibleFocus(target), tabPresses: presses });
    };

    const type = async (target: Locator, value: string) => {
        await tabTo(target);
        await page.keyboard.press(`${modifier}+A`);
        await page.keyboard.press("Backspace");
        if (value) await page.keyboard.type(value);
        await expect(target).toHaveValue(value);
    };

    return {
        kind: "keyboard",
        activate: async (target) => {
            await tabTo(target);
            await page.keyboard.press("Enter");
        },
        fill: type,
        fillDate: async (target, isoDate) => {
            const [year, month, day] = isoDate.split("-");
            await tabTo(target);
            // en-GB date fields take day, month, year in that order.
            await page.keyboard.type(`${day}${month}${year}`);
            await expect(target).toHaveValue(isoDate);
        },
        check: async (target) => {
            const isRadio = (await target.getAttribute("type")) === "radio";
            if (!isRadio) {
                await tabTo(target);
                if (!(await target.isChecked())) await page.keyboard.press("Space");
                await expect(target).toBeChecked();
                return;
            }
            // Tab lands on the chosen radio of a group; arrows move within it.
            const name = await target.getAttribute("name");
            const chosen = page.locator(`input[type="radio"][name="${name}"]:checked`);
            await tabTo((await chosen.count()) > 0 ? chosen : target);
            for (let presses = 0; presses < 10 && !(await target.isChecked()); presses += 1) {
                await page.keyboard.press("ArrowDown");
            }
            await expect(target).toBeChecked();
        },
        select: async (target, label) => {
            await tabTo(target);
            // Typing the option's name chooses it without opening the list.
            await page.keyboard.type(label);
            await expect(target.locator("option:checked")).toHaveText(label);
        },
    };
}
