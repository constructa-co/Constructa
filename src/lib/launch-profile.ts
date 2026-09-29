export const LAUNCH_PROFILES = ["cohort", "full"] as const;

export type LaunchProfile = (typeof LAUNCH_PROFILES)[number];

export type LaunchCapability =
  | "home"
  | "company-profile"
  | "pipeline"
  | "project-setup"
  | "brief"
  | "estimating"
  | "programme"
  | "proposal"
  | "client-boq-import"
  | "drawing-takeoff"
  | "video-walkthrough"
  | "contract-shield"
  | "benchmark-api"
  | "extended-modules";

const COHORT_CAPABILITIES = new Set<LaunchCapability>([
  "company-profile",
  "pipeline",
  "project-setup",
  "brief",
  "estimating",
  "programme",
  "proposal",
]);

const COHORT_EXACT_DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/projects",
] as const;

const COHORT_DASHBOARD_PREFIXES = [
  "/dashboard/projects/new",
  "/dashboard/projects/quick-quote",
  "/dashboard/projects/brief",
  "/dashboard/projects/costs",
  "/dashboard/projects/schedule",
  "/dashboard/projects/proposal",
  "/dashboard/projects/settings",
  "/dashboard/settings/profile",
  "/dashboard/settings/case-studies",
] as const;

export function getLaunchProfile(
  value = process.env.NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE,
): LaunchProfile {
  return value === "full" ? "full" : "cohort";
}

export function isCapabilityEnabled(
  capability: LaunchCapability,
  profile = getLaunchProfile(),
): boolean {
  return profile === "full" || COHORT_CAPABILITIES.has(capability);
}

export function requireLaunchCapability(
  capability: LaunchCapability,
  profile = getLaunchProfile(),
): void {
  if (!isCapabilityEnabled(capability, profile)) {
    throw new Error("This feature is not available in the current launch profile.");
  }
}

export function isDashboardPathAllowed(
  pathname: string,
  profile = getLaunchProfile(),
): boolean {
  if (profile === "full") return pathname.startsWith("/dashboard");

  return COHORT_EXACT_DASHBOARD_ROUTES.includes(
    pathname as (typeof COHORT_EXACT_DASHBOARD_ROUTES)[number],
  ) || COHORT_DASHBOARD_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function getLaunchRedirectPath(): string {
  return "/dashboard";
}

export function getLaunchLandingPath(
  profile = getLaunchProfile(),
): "/dashboard" | "/dashboard/home" {
  return profile === "full" ? "/dashboard/home" : "/dashboard";
}
