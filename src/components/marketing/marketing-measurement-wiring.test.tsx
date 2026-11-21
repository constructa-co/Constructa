import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_MEASUREMENT_EVENT_NAMES,
  __setPublicMeasurementTestSink,
} from "@/lib/public-measurement";

const fetchMock = vi.hoisted(() => vi.fn());
const hookState = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
}));

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@/app/components/FAQ", () => ({ default: () => null }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hookState.cursor++;
      if (!(index in hookState.slots)) {
        hookState.slots[index] =
          typeof initial === "function" ? (initial as () => unknown)() : initial;
      }
      return [
        hookState.slots[index],
        (next: unknown) => {
          hookState.slots[index] =
            typeof next === "function"
              ? (next as (value: unknown) => unknown)(hookState.slots[index])
              : next;
        },
      ];
    },
    useEffect: () => {},
  };
});

import Home from "./full-home";
import FullLandingPage from "./full-landing";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...nodes(element.props.children)];
}

function findById(tree: Element[], id: string) {
  return tree.find((element) => element.props.id === id);
}

function contactForm(tree: Element[]) {
  return tree.find(
    (element) =>
      element.type === "form" && typeof element.props.onSubmit === "function",
  );
}

function renderHome() {
  hookState.cursor = 0;
  return nodes(Home());
}

function renderLanding() {
  hookState.cursor = 0;
  return nodes(FullLandingPage());
}

beforeEach(() => {
  hookState.slots = [];
  hookState.cursor = 0;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FormData", class FormDataMock {
    constructor(_form: unknown) {}
  });
  vi.stubGlobal("window", {
    location: { pathname: "/" },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    scrollY: 0,
    innerHeight: 800,
    requestAnimationFrame: vi.fn(),
  });
  vi.stubGlobal("document", {
    getElementById: vi.fn(() => null),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: (tag: string) => ({
      tagName: tag.toUpperCase(),
      innerHTML: "",
      reset: vi.fn(),
    }),
  });
  vi.stubGlobal("console", { ...console, error: vi.fn() });
});

afterEach(() => {
  __setPublicMeasurementTestSink(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("marketing measurement handler wiring", () => {
  it("does not fetch or record ContactFormSubmit while home contact collection stays off", async () => {
    const events: string[] = [];
    __setPublicMeasurementTestSink((event) => {
      events.push(event);
    });

    const markup = renderToStaticMarkup(Home());
    expect(markup).toContain("Submission unavailable");
    expect(markup).toMatch(/<fieldset[^>]*disabled/);
    expect(markup).not.toMatch(/action="https?:/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("does not dispatch contact acceptance when the browser is off a public route", async () => {
    const events: string[] = [];
    __setPublicMeasurementTestSink((event) => {
      events.push(event);
    });
    vi.stubGlobal("window", {
      location: { pathname: "/dashboard" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const markup = renderToStaticMarkup(Home());
    expect(markup).toContain("Submission unavailable");
    expect(markup).toMatch(/<fieldset[^>]*disabled/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("fires TryConstructaClick from wired home CTA onClick handlers", () => {
    const events: Array<{ event: string; props: Record<string, string> }> =
      [];
    __setPublicMeasurementTestSink((event, props) => {
      events.push({ event, props });
    });

    const cta = findById(renderHome(), "try-constructa-solution")!;
    (cta.props.onClick as () => void)();

    expect(events).toEqual([
      { event: "TryConstructaClick", props: { location: "solution" } },
    ]);
  });

  it("landing has no second intake form; its only CTA is the cohort apply link", () => {
    const tree = renderLanding();

    expect(findById(tree, "waitlist-form")).toBeUndefined();
    expect(tree.filter((element) => element.type === "form")).toEqual([]);
    const cta = findById(tree, "landing-apply-cta")!;
    expect(cta.props.href).toBe("/apply");
  });

  it("keeps the WaitlistSubmitAttempt event name registered for the separate newsletter scope", () => {
    expect(PUBLIC_MEASUREMENT_EVENT_NAMES).toEqual([
      "ContactFormSubmit",
      "TryConstructaClick",
      "WaitlistSubmitAttempt",
    ]);
  });
});
