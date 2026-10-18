export type WelcomeFocus = "company" | "experience" | "pricing" | "proposal" | "defaults";

export interface WelcomeStep {
    id: WelcomeFocus;
    number: string;
    category: string;
    title: string;
    detail: string;
    action: string;
    href: string;
}

export const companyStartingPaths = [
    { href: "/dashboard/settings/profile/interview", title: "Answer a few questions", detail: "Optional guided questions help you write an introduction. Review it before adding it to your profile; this is not a live AI chat." },
    { href: "/dashboard/settings/profile", title: "Fill it in yourself", detail: "Use the company form to add or edit your details in your own words." },
    { href: "/dashboard/settings/profile/import", title: "Bring in details from your own website", detail: "Choose whether to check your website, then review any suggestions before applying them. Opening this page does not fetch your site." },
] as const;


export const proposalDefaultPaths = [
    { href: "/dashboard/settings/profile#company-style", title: "Proposal style", detail: "Choose the existing PDF colour scheme in your company profile." },
    { href: "/dashboard/settings/profile#company-director", title: "Director message", detail: "Add your name and personal message in the existing profile form." },
] as const;

export function welcomeSteps(hasProjects: boolean): WelcomeStep[] {
    const projectPath = hasProjects ? "/dashboard/projects" : "/dashboard/projects/new";
    return [
        { id: "company", number: "01", category: "Your business", title: "Introduce your company", detail: "Your business, your people and the work you want to be known for.", action: "Choose how to start", href: "/dashboard/settings/profile" },
        { id: "experience", number: "02", category: "Your track record", title: "Show what you've built", detail: "Add past work you are happy to show clients. Make your experience part of your proposal.", action: "Add past work", href: "/dashboard/settings/case-studies" },
        { id: "defaults", number: "03", category: "Your presentation", title: "Shape your proposals", detail: "Start with your look and personal message. See which preferences are available today.", action: "View available preferences", href: "/dashboard/settings/profile#company-style" },
        { id: "proposal", number: "04", category: "Your next client", title: hasProjects ? "Build your next proposal" : "Build your first proposal", detail: "Start with a job and estimate. Bring the story, scope, price and programme together before review.", action: hasProjects ? "Choose a project" : "Start with a job", href: projectPath },
    ];
}

/** Presentation only: never a saved preference, new permission or completion status. */
export function orderWelcomeSteps(steps: readonly WelcomeStep[], focus: WelcomeFocus | null): WelcomeStep[] {
    return focus ? [...steps.filter((step) => step.id === focus), ...steps.filter((step) => step.id !== focus)] : [...steps];
}
