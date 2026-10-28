/**
 * Fail-closed hold for the legacy full Phase 1 hosted write journey
 * (`playwright.config.ts` → `phase1-journey.spec.ts`: signup, customer writes,
 * publication, client portal, Send). Separate variants (`playwright.phase1-no-publish.config.ts`,
 * `playwright.platform-consent.config.ts`, local-phase1 configs) are unchanged.
 *
 * Importing this module has no side effects: it starts no browser or server and
 * contacts no auth or database until an explicit lift of the source hold.
 */

import { E2EConfigurationError, readE2EEnv, type E2EEnv } from "./env";

/**
 * Hosted legacy write journey stays held until an explicitly authorised code change.
 * It is not lifted by workflow_dispatch, repository secrets or environment toggles.
 */
export function isLegacyHostedPhase1WriteHeld(): boolean {
    return true;
}

export const LEGACY_HOSTED_PHASE1_WRITE_HELD_MESSAGE =
    "Legacy hosted Phase 1 write journey: NOT_RUN. Signup, customer data writes, " +
    "publication, Send and automated legal acceptance remain held under Preview HOLD " +
    "and current source policy. Lift this hold only with an explicit code change in " +
    "legacy-hosted-phase1-guard.ts after authorised review. Bounded paths remain " +
    "playwright.phase1-no-publish.config.ts and local-phase1 configs.";

/** Disposable-project checks only; does not lift the hosted write hold. */
export function readLegacyHostedPhase1Prerequisites(source: NodeJS.ProcessEnv = process.env): E2EEnv {
    return readE2EEnv(source);
}

export function readLegacyHostedPhase1Env(source: NodeJS.ProcessEnv = process.env): E2EEnv {
    if (isLegacyHostedPhase1WriteHeld()) {
        throw new E2EConfigurationError([LEGACY_HOSTED_PHASE1_WRITE_HELD_MESSAGE]);
    }
    return readLegacyHostedPhase1Prerequisites(source);
}
