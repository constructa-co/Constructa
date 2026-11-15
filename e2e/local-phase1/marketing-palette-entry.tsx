/**
 * A001 D28: phase-one cohort marketing surfaces under compiled Tailwind + CSS modules.
 * Synthetic pathname only; no Auth/DB/navigation/hosted journey.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import CustomersPage from "../../src/app/customers/page";
import {
    MarketingFooter,
    MarketingHeader,
    PhaseOneFeatures,
    PhaseOneHome,
    PhaseOnePricing,
} from "../../src/components/marketing/phase-one";
import { PhaseOneAbout } from "../../src/components/marketing/cohort-about";
import { PhaseOneContact } from "../../src/components/marketing/cohort-contact";
import { PhaseOneFoundingCohortApply } from "../../src/components/marketing/founding-cohort-apply-page";
import { GuideArticleView } from "../../src/components/marketing/guide-article-view";
import { GuidesHub } from "../../src/components/marketing/guides-hub";
import { GUIDE_ARTICLES } from "../../src/lib/marketing-guides";

export type MarketingPalettePage =
    | "home"
    | "features"
    | "pricing"
    | "about"
    | "contact"
    | "apply"
    | "guides"
    | "guide-article"
    | "customers";

declare global {
    interface Window {
        __marketingPaletteOptions?: { page: MarketingPalettePage };
        __marketingPaletteLocal: { pathname: string; calls: string[]; router: { push: () => void } };
    }
}

const ROUTE_BY_PAGE: Record<MarketingPalettePage, string> = {
    home: "/",
    features: "/features",
    pricing: "/pricing",
    about: "/about",
    contact: "/contact",
    apply: "/apply",
    guides: "/guides",
    "guide-article": `/guides/${GUIDE_ARTICLES[0]?.slug ?? "company-profile"}`,
    customers: "/customers",
};

const BodyByPage: Record<MarketingPalettePage, React.ComponentType> = {
    home: PhaseOneHome,
    features: PhaseOneFeatures,
    pricing: PhaseOnePricing,
    about: PhaseOneAbout,
    contact: PhaseOneContact,
    apply: PhaseOneFoundingCohortApply,
    guides: GuidesHub,
    "guide-article": () => <GuideArticleView article={GUIDE_ARTICLES[0]!} />,
    customers: CustomersPage,
};

const options = window.__marketingPaletteOptions ?? { page: "home" as MarketingPalettePage };
const page = options.page in BodyByPage ? options.page : "home";
const Body = BodyByPage[page];
const fixture = {
    pathname: ROUTE_BY_PAGE[page],
    calls: [] as string[],
    router: { push: () => fixture.calls.push("router.push:refused") },
};
window.__marketingPaletteLocal = fixture;

document.addEventListener(
    "submit",
    event => {
        event.preventDefault();
        fixture.calls.push("form.submit:refused");
    },
    true,
);

createRoot(document.getElementById("app")!).render(
    <div data-marketing-palette-page={page}>
        <MarketingHeader />
        <main id="public-marketing-content">
            <Body />
        </main>
        <MarketingFooter />
    </div>,
);