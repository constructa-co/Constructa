"use client";

import Link from "next/link";
// import { Button } from "@/components/ui/button"; // Missing
// Actually, earlier I found that Button component `src/components/ui/button.tsx` was missing and I used <button> HTML element in pdf-generator.
// But the user's provided code imports `Button`.
// If I use the user's code directly, it might fail if Button component is missing.
// I should check if `src/components/ui/button.tsx` exists now? 
// The user might have added it or expects me to create it?
// The instructions "Create Component: src/components/project-navbar.tsx" didn't say create Button.
// However, the user says "Input - Code Blocks" and includes imports.
// If I look at `client-page.tsx`, it has a local `Button` component defined inline.
// I should probably define a local Button or use standard HTML button styled with classes if the component is missing.
// Or I can create the Button component if it's missing to standardise.
// But the user prompt says "EXECUTE VERTICAL SLICE 21.0".
// Let's check if `src/components/ui/button.tsx` exists again. I checked in step 1243 and it verified 0 results.
// So I should probably use the inline button styles or create the component.
// Given strict instructions to "Create Component..." and "Input - Code Blocks", usually I should follow the code.
// But if dependencies are missing, I must fix.
// I'll create a simple `src/components/ui/button.tsx` first to make life easier for all these files importing it, OR I will modify the Navbar to use HTML button.
// Modifying to use HTML button is safer and less intrusive than creating new shared components that might conflict with user's plan.
// I will use HTML button with the classes from the inline examples I've seen.

// Wait, the user provided code imports `Button` from `@/components/ui/button`.
// If I create `src/components/project-navbar.tsx` with that import, it will fail build.
// I will rewrite the `ProjectNavBar` to use a local `Button` or HTML button.

// Actually, maybe I should create `@/components/ui/button.tsx`?
// The user seems to assume it exists.
// Let's try to just use HTML button in the Navbar for now to avoid side tracking.

interface Props {
    projectId: string;
    activeTab: "overview" | "costing" | "proposal" | "billing" | "contracts" | "variations";
}

export default function ProjectNavBar({ projectId, activeTab }: Props) {
    const getVariant = (tab: string) => activeTab === tab ? "default" : "ghost";
    const getClass = (tab: string) => {
        const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3";
        const active = "bg-slate-900 text-white hover:bg-slate-800";
        const inactive = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
        return `${base} ${activeTab === tab ? active : inactive}`;
    };

    return (
        <div className="border-b mb-6 pb-1 flex flex-wrap gap-2">
            <Link href={`/dashboard/foundations?projectId=${projectId}`}>
                <button className={getClass("overview")}>
                    📊 Overview
                </button>
            </Link>
            <Link href={`/dashboard/projects/costs?projectId=${projectId}`}>
                <button className={getClass("costing")}>
                    💰 Estimating
                </button>
            </Link>
            <Link href={`/dashboard/projects/proposal?projectId=${projectId}`}>
                <button className={getClass("proposal")}>
                    📝 Proposal
                </button>
            </Link>
            <Link href={`/dashboard/projects/billing?projectId=${projectId}`}>
                <button className={getClass("billing")}>
                    💸 Billing
                </button>
            </Link>
            <Link href={`/dashboard/projects/contracts?projectId=${projectId}`}>
                <button className={getClass("contracts")}>
                    ⚖️ Contracts
                </button>
            </Link>
            <Link href={`/dashboard/projects/variations?projectId=${projectId}`}>
                <button className={getClass("variations")}>
                    🚧 Variations
                </button>
            </Link>
        </div>
    );
}
