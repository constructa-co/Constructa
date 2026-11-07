/**
 * A111: real SidebarNav + phase-one marketing under compiled Tailwind and CSS modules.
 * Synthetic router/path/search only; in-memory storage; no Auth/DB/provider/navigation.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../src/lib/theme-context";
import SidebarNav from "../../src/components/sidebar-nav";
import { MarketingHeader, MarketingFooter, PhaseOneHome } from "../../src/components/marketing/phase-one";

type Theme = "system-c" | "dark";

export interface LocalA111ReadabilityFixture {
    calls: string[];
    router: { push: (href: string) => void; refresh: () => void };
    pathname: string;
    searchParams: Record<string, string>;
}

type FixtureRegion = "both" | "sidebar" | "marketing";

declare global {
    interface Window {
        __a111ReadabilityOptions?: {
            theme: Theme;
            pathname?: string;
            searchParams?: Record<string, string>;
            region?: FixtureRegion;
        };
        __a111ReadabilityLocal: LocalA111ReadabilityFixture;
    }
}

const memoryStorage = (): Storage => {
    const values = new Map<string, string>();
    return {
        get length() { return values.size; },
        clear: () => values.clear(),
        key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(String(key), String(value)); },
        removeItem: (key: string) => { values.delete(key); },
    };
};
Object.defineProperty(window, "localStorage", { value: memoryStorage() });
Object.defineProperty(window, "sessionStorage", { value: memoryStorage() });

const options = window.__a111ReadabilityOptions ?? { theme: "system-c" as Theme, region: "both" as FixtureRegion };
const region = options.region ?? "both";
const fixture: LocalA111ReadabilityFixture = {
    calls: [],
    router: {
        push: href => { fixture.calls.push(`router.push:${href}`); },
        refresh: () => { fixture.calls.push("router.refresh"); },
    },
    pathname: options.pathname ?? "/dashboard",
    searchParams: options.searchParams ?? {},
};
window.__a111ReadabilityLocal = fixture;

document.addEventListener("submit", event => {
    event.preventDefault();
    fixture.calls.push("form.submit:refused");
}, true);

const projects = [{ id: "local-a111-job", name: "Example job", client_name: "Synthetic client" }];

createRoot(document.getElementById("app")!).render(
    <>
        {(region === "both" || region === "sidebar") && (
            <section data-a111-region="sidebar" aria-label="Sidebar fixture" className="relative min-h-[720px] bg-[#0d0d0d]">
                <ThemeProvider initialTheme={options.theme}>
                    <SidebarNav user={{ email: "review@example.invalid" }} projects={projects} />
                </ThemeProvider>
            </section>
        )}
        {(region === "both" || region === "marketing") && (
            <section data-a111-region="marketing" aria-label="Marketing phase-one fixture">
                <MarketingHeader />
                <PhaseOneHome />
                <MarketingFooter />
            </section>
        )}
    </>,
);
