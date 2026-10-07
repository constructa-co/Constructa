/**
 * Phone navigation model for the Phase 1 journey.
 *
 * The desktop sidebar is hidden below `md`, so phones get a short menu that
 * reaches only the Phase 1 routes. Every item is gated on the same launch
 * capability the desktop sidebar and route proxy use, so this menu can never
 * expose more than the active launch profile allows.
 */

import { getLaunchProfile, isCapabilityEnabled, type LaunchCapability, type LaunchProfile } from "@/lib/launch-profile";

export type PhoneNavKey =
    | "pipeline"
    | "new-project"
    | "brief"
    | "estimates"
    | "programmes"
    | "proposals"
    | "profile"
    | "case-studies";

export interface PhoneNavItem {
    key: PhoneNavKey;
    label: string;
    /** Route without query string — used for active-state matching. */
    path: string;
    /** Link target, carrying the active project where the route needs one. */
    href: string;
}

export interface PhoneNavGroup {
    key: "jobs" | "this-job" | "company";
    label: string;
    items: PhoneNavItem[];
}

interface ItemDef {
    key: PhoneNavKey;
    label: string;
    path: string;
    capability: LaunchCapability;
    projectAware?: boolean;
}

const GROUPS: { key: PhoneNavGroup["key"]; label: string; items: ItemDef[] }[] = [
    {
        key: "jobs",
        label: "Jobs",
        items: [
            { key: "pipeline", label: "Pipeline", path: "/dashboard", capability: "pipeline" },
            { key: "new-project", label: "New Project", path: "/dashboard/projects/new", capability: "project-setup" },
        ],
    },
    {
        key: "this-job",
        label: "This job",
        items: [
            { key: "brief", label: "Brief", path: "/dashboard/projects/brief", capability: "brief", projectAware: true },
            { key: "estimates", label: "Estimates", path: "/dashboard/projects/costs", capability: "estimating", projectAware: true },
            { key: "programmes", label: "Programmes", path: "/dashboard/projects/schedule", capability: "programme", projectAware: true },
            { key: "proposals", label: "Proposals", path: "/dashboard/projects/proposal", capability: "proposal", projectAware: true },
        ],
    },
    {
        key: "company",
        label: "Your company",
        items: [
            { key: "profile", label: "Profile", path: "/dashboard/settings/profile", capability: "company-profile" },
            { key: "case-studies", label: "Case Studies", path: "/dashboard/settings/case-studies", capability: "company-profile" },
        ],
    },
];

export function buildPhoneNav(
    projectId: string | null | undefined,
    profile: LaunchProfile = getLaunchProfile(),
): PhoneNavGroup[] {
    return GROUPS
        .map((group) => ({
            key: group.key,
            label: group.label,
            items: group.items
                .filter((item) => isCapabilityEnabled(item.capability, profile))
                .map((item) => ({
                    key: item.key,
                    label: item.label,
                    path: item.path,
                    href: item.projectAware && projectId
                        ? `${item.path}?projectId=${encodeURIComponent(projectId)}`
                        : item.path,
                })),
        }))
        .filter((group) => group.items.length > 0);
}

/** Pipeline matches exactly; every other item also matches its sub-routes. */
export function isPhoneNavItemActive(pathname: string | null | undefined, item: Pick<PhoneNavItem, "path">): boolean {
    if (!pathname) return false;
    if (item.path === "/dashboard") return pathname === "/dashboard";
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

/** Short title for the phone top bar. */
export function getPhoneNavTitle(pathname: string | null | undefined, groups: PhoneNavGroup[]): string {
    for (const group of groups) {
        const match = group.items.find((item) => isPhoneNavItemActive(pathname, item));
        if (match) return match.label;
    }
    return "Constructa";
}
