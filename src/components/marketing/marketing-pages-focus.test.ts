import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

function declarations(cssPath: URL, selector: string, { exact = false }: { exact?: boolean } = {}) {
  const css = postcss.parse(readFileSync(cssPath, "utf8"));
  const values: Record<string, string> = {};
  css.walkRules((rule) => {
    if (rule.parent?.type === "atrule") return;
    const matches = exact
      ? rule.selector === selector
      : rule.selector.split(",").map((part) => part.trim()).includes(selector);
    if (!matches) return;
    rule.walkDecls((decl) => {
      values[decl.prop] = decl.value;
    });
  });
  return values;
}

describe("declared marketing guides and cohort apply focus styles, not browser certification", () => {
  it("gives hub cards the same border cue as hover with an accent outline", () => {
    const focus = declarations(
      new URL("./guides.module.css", import.meta.url),
      ".card:focus-visible",
    );
    expect(focus["border-color"]).toBe("#526455");
    expect(focus.outline).toContain("var(--accent)");
  });

  it("highlights cohort application fields and submit on focus-visible", () => {
    const cssPath = new URL("./founding-cohort-apply.module.css", import.meta.url);
    for (const selector of [".input:focus-visible", ".select:focus-visible", ".textarea:focus-visible"]) {
      expect(declarations(cssPath, selector)["border-color"]).toBe("var(--accent)");
    }
    expect(declarations(cssPath, ".submit:focus-visible").background).toBe("#e0f9e3");
    const themeFocus = declarations(
      cssPath,
      ".theme :is(a, button, input, select, textarea):focus-visible",
      { exact: true },
    );
    expect(themeFocus.outline).toContain("var(--accent)");
  });

  it("styles the skip-to-content main landmark when it receives focus", () => {
    const focus = declarations(
      new URL("./phase-one.module.css", import.meta.url),
      ".marketingMain:focus-visible",
    );
    expect(focus.outline).toContain("var(--accent)");
    expect(focus["outline-offset"]).toBe("4px");
  });
});
