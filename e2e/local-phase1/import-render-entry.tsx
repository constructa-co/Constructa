import React from "react";
import { createRoot } from "react-dom/client";
import ImportClient from "@/app/dashboard/settings/profile/import/import-client";

/**
 * C16 A021 rendered import balance: actual ImportClient + CompanyImportFrame +
 * actual company-import CSS module (via offline compiler). Synthetic empty
 * profile state only; server preview/apply are refused in the compiler stub.
 */

export interface ImportRenderFixture {
    theme: "system-c" | "dark";
    calls: string[];
    router: { push: (href: string) => void };
}

declare global {
    interface Window {
        __importRenderOptions?: { theme?: "system-c" | "dark" };
        __importRenderLocal: ImportRenderFixture;
    }
}

window.__importRenderLocal = {
    theme: window.__importRenderOptions?.theme ?? "system-c",
    calls: [],
    router: { push: () => { window.__importRenderLocal.calls.push("REFUSED.router.push"); } },
};

createRoot(document.getElementById("app")!).render(
    <ImportClient initialDraft={null} savedWebsite="" />,
);
