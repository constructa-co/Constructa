import { requireLaunchCapability } from "@/lib/launch-profile";
import {
  getActiveOrganizationId as getBaseActiveOrganizationId,
  requireAuth as requireBaseAuth,
  requireProjectAccess as requireBaseProjectAccess,
} from "./auth-utils";

/**
 * Auth adapters for modules retained in the codebase but excluded from the
 * Phase 1 cohort. Keeping the launch check beside authentication means every
 * exported Server Action in those modules fails closed even if its Next-Action
 * identifier is replayed through an otherwise allowed route.
 */
export async function requireAuth() {
  requireLaunchCapability("extended-modules");
  return requireBaseAuth();
}

export async function requireProjectAccess(projectId: string) {
  requireLaunchCapability("extended-modules");
  return requireBaseProjectAccess(projectId);
}

export async function getActiveOrganizationId() {
  requireLaunchCapability("extended-modules");
  return getBaseActiveOrganizationId();
}
