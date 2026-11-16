import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const cssPath = new URL("./phase-one.module.css", import.meta.url);
const css = postcss.parse(readFileSync(cssPath, "utf8"));
const headerSource = readFileSync(new URL("./phase-one.tsx", import.meta.url), "utf8");

function baseDeclarations(selector: string) {
  const values: Record<string, string> = {};
  css.walkRules(rule => {
    if (rule.selector !== selector) return;
    if (rule.parent?.type === "atrule") return;
    rule.walkDecls(decl => {
      values[decl.prop] = decl.value;
    });
  });
  return values;
}

function mediaDeclarations(selector: string, mediaParams: string) {
  const values: Record<string, string> = {};
  css.walkAtRules("media", atRule => {
    if (atRule.params !== mediaParams) return;
    atRule.walkRules(rule => {
      if (rule.selector !== selector) return;
      rule.walkDecls(decl => {
        values[decl.prop] = decl.value;
      });
    });
  });
  return values;
}

function reducedMotionAnimation(selectorPart: string) {
  let animation: string | undefined;
  css.walkAtRules("media", atRule => {
    if (atRule.params !== "(prefers-reduced-motion: reduce)") return;
    atRule.walkRules(rule => {
      if (!rule.selector.includes(selectorPart)) return;
      rule.walkDecls(decl => {
        if (decl.prop === "animation") animation = decl.value;
      });
    });
  });
  return animation;
}

describe("declared phase-one responsive rules, not computed layout or browser proof", () => {
  it("keeps four real main-nav destinations in source without hiding or removing links", () => {
    const navBlock = headerSource.match(/aria-label="Main navigation"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(navBlock).toContain('href="/features"');
    expect(navBlock).toContain('href="/pricing"');
    expect(navBlock).toContain('href="/about"');
    expect(navBlock).toContain('href="/guides"');
    expect((navBlock.match(/<Link\b/g) ?? []).length).toBe(4);
    expect(navBlock).not.toMatch(/display:\s*none|visibility:\s*hidden|aria-hidden="true"/i);
  });

  it("preserves desktop nav as a single centered flex row without a wrap rule in the base stylesheet", () => {
    const nav = baseDeclarations(".nav");
    expect(nav.display).toBe("flex");
    expect(nav["justify-content"]).toBe("center");
    expect(nav["flex-wrap"]).toBeUndefined();
    expect(mediaDeclarations(".nav", "(min-width: 801px)")["flex-wrap"]).toBeUndefined();
  });

  it("swaps the row nav for a real mobile menu at 800px instead of wrapping it", () => {
    expect(baseDeclarations(".mobileMenu").display).toBe("none");
    const menuSummary = baseDeclarations(".mobileMenu summary");
    expect(menuSummary["min-height"]).toBe("46px");
    expect(menuSummary["cursor"]).toBe("pointer");
    const menuLink = baseDeclarations(".mobileMenu nav a");
    expect(menuLink["min-height"]).toBe("44px");

    const narrowNav = mediaDeclarations(".nav", "(max-width: 800px)");
    const narrowMenu = mediaDeclarations(".mobileMenu", "(max-width: 800px)");
    const narrowHeader = mediaDeclarations(".headerInner", "(max-width: 800px)");

    expect(narrowNav.display).toBe("none");
    expect(narrowMenu.display).toBe("block");
    expect(narrowHeader["flex-wrap"]).toBe("nowrap");
  });

  it("keeps hero actions and footer stacks wrapping on narrow layouts without changing the sage focus palette", () => {
    expect(baseDeclarations(".actions")["flex-wrap"]).toBe("wrap");
    expect(mediaDeclarations(".footerTop", "(max-width: 800px)")["flex-wrap"]).toBe("wrap");
    expect(baseDeclarations(".footerTop nav")["flex-wrap"]).toBe("wrap");
    expect(mediaDeclarations(".footerTop nav", "(max-width: 450px)").gap).toBe("12px 16px");

    const focus = baseDeclarations(".theme :is(a, summary):focus-visible");
    expect(focus.outline).toContain("var(--accent)");
    expect(baseDeclarations(".theme")["--accent"]).toBe("#c9efcf");
    expect(baseDeclarations(".primary").background).toBe("var(--accent)");
  });

  it("preserves the reduced-motion override for marketing motion", () => {
    expect(reducedMotionAnimation(".heroCopy")).toBe("none");
    expect(reducedMotionAnimation(".visual")).toBe("none");
  });

  it("documents overflow clipping on the marketing root as a static declaration only", () => {
    expect(baseDeclarations(".root").overflow).toBe("clip");
  });
});
