# A101 — Newsletter signup design (draft)

**Status: DRAFT — ROB REVIEW REQUIRED. Design only: no provider activation, no import, no email sent, no DNS change, no settings change, no SQL applied.**
Author: Kimi, 2026-11-08, branch `kimi/marketing-drafts-20261108-1020`. All findings below are from offline source inspection of this branch unless marked otherwise.

## 1. Existing source inventory (offline, current branch)

| Area | File(s) | What exists today |
| --- | --- | --- |
| Transactional email | `src/lib/email.ts` | Resend client (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, default `onboarding@resend.dev`); multiple send functions; fails closed when key absent. This is **service mail**, not marketing. |
| Platform signup & terms | `src/lib/platform-signup-action.ts`, `src/lib/platform-terms-actions.ts`, `src/lib/platform-signup-recorder-seam.test.ts`, `src/app/login/page.tsx`, `src/app/login/platform-terms.test.tsx` | Account creation with explicit platform-terms acknowledgement. Separate consent surface already exists here as a pattern to imitate, not to conflate. |
| Signup measurement (disabled) | register notes on A059 / "disabled public acquisition measurement"; `src/lib/deployment/review-policy.test.ts` blocks outbound hosts incl. `api.resend.com` in review | Hosted acquisition/tracking is intentionally off; any newsletter design must not re-enable tracking. |
| Newsletter surface | none | No newsletter form, table, or provider integration exists. A service-worker test references a `/?ref=newsletter` query string, i.e. a campaign-source convention, not a subscription feature. |

Conclusion: newsletter signup would be a **new, separate consent surface**; transactional (service) mail via Resend already exists and must stay independent.

## 2. Design goals and non-goals

Goals:
- Optional marketing-newsletter opt-in that is clearly separate from account/service mail.
- Evidence trail: when, where, and what wording the user consented to.
- Clean unsubscribe and suppression honoured before any send.
Non-goals (this draft): provider account creation, list import, DNS, sending, automation/sequences, paid plan.

## 3. Consent model — separation from service mail

1. **Separate checkbox, separate purpose.** Signup/newsletter consent must be an unchecked-by-default checkbox with its own label, not bundled into account terms acceptance. Unticking it must never block account creation (A101 register wording says "optional newsletter signup").
2. **Service mail stays automatic.** Password resets, onboarding receipts, proposal-share notifications sent via the existing Resend path regardless of marketing consent — these are contractual/service messages, not marketing.
3. **No pre-ticked boxes, no consent-as-condition.** Follows UK PECR/UK GDPR expectations for electronic marketing to individuals (Rob's legal review required — see §9).
4. **Record the consent artefact:** user id (or email hash), timestamp, form version/copy id, source page, IP optional. Store in a new table only via a reviewed migration (not applied here).

## 4. Opt-in evidence & confirmation (double opt-in)

Recommended: **confirmed opt-in (double opt-in)**.
- User checks box → provider records "unconfirmed" subscriber.
- Provider sends confirmation email with one-click confirm link → status becomes "confirmed".
- Only confirmed subscribers ever receive campaigns.
- Evidence retained: consent timestamp + confirmation timestamp + the exact form copy version shown.
- Benefits: protects against typo/forced signups, gives a defensible audit trail, keeps list quality high. Cost: slightly lower top-line subscriber counts — acceptable for a small B2B list.

## 5. Unsubscribe & suppression

- Every campaign email must carry a provider-hosted one-click unsubscribe link plus a mailto fallback.
- Unsubscribe = **immediate suppression at provider level**, honoured before the next send; no "we'll miss you" interstitial that delays it.
- Suppression list is never deleted; re-subscription requires a fresh confirmed opt-in.
- A periodic (manual, at first) suppression audit: any address that hard-bounces or marks spam is suppressed automatically by provider rules.

## 6. Provider choice — rationale only (no activation)

Register wording says "reviewed Kit or equivalent". Comparison for Rob's decision (public knowledge, not re-verified live pricing):

| Provider | Fit notes |
| --- | --- |
| **Kit (ConvertKit)** | Creator/newsletter focus; tags + simple automations; free tier usable at small list sizes; double opt-in built in; unsubscribe/suppression automatic. Weakness: B2B contractor segment templates thin; pricing scales with subscriber count. |
| **Resend** (existing vendor) | Already integrated for transactional. Marketed for transactional/product email; marketing-campaign + unsubscribe-page features are newer and thinner than dedicated newsletter tools. Reusing one vendor is simpler, but mixing service and marketing under one provider weakens the consent separation story unless audiences are strictly segmented. |
| **Mailchimp / Brevo / Buttondown** | Equivalent options; Mailchimp is ubiquitous but pricing/automation gates pushed many small lists elsewhere; Brevo charges by send volume; Buttondown is minimal and cheap for tiny lists. |

**Draft recommendation:** Kit, as the register suggests, in a strictly separate audience/tag from any service mail, **unless** Rob prefers single-vendor simplicity — in which case Resend with hard audience separation is the fallback. Final choice is Rob's; no account was created.

## 7. Failure modes (design-level, pre-implementation)

| Failure mode | Mitigation in design |
| --- | --- |
| Consent bundled into terms → invalid consent | Separate checkbox + separate purpose; no gating |
| Single opt-in typos/forged addresses | Confirmed opt-in; unconfirmed never mailed |
| Unsubscribe not honoured promptly | Provider-level one-click suppression; pre-send suppression check |
| Service mail stops when marketing consent refused | Service mail path independent of marketing flags |
| Tracking/analytics creep re-enabled | Campaign links plain; UTM only if Rob explicitly approves; no pixels beyond provider open-tracking default, which Rob may switch off |
| List export/import leak | No import/export without a reviewed action; access limited to Rob |
| Legal wording wrong | Human legal review gate before any send (§9) |

## 8. Acceptance tests (for the future implementation action — none run now)

1. Form renders with newsletter checkbox unchecked by default; label names the newsletter purpose in plain English.
2. Unchecking/ignoring the checkbox still completes signup; service mail still works.
3. Consent record stores timestamp, copy version, source page.
4. Confirmation email required before status = confirmed; no campaign can target unconfirmed.
5. Unsubscribe link in a test campaign unsubscribes within the provider's stated SLA; suppressed address is excluded from the next send list.
6. Review-runtime guard: no new outbound host is contacted by the app outside the provider send path used at send time (extend `review-policy.test.ts` allowlist only in the implementation action).
7. No newsletter consent state affects any existing app behaviour (unit + existing focused tests still pass).

## 9. Explicit human-review gates (before anything goes live)

- Rob reviews provider choice and creates the account himself (no credential handling by agents).
- Legal wording of consent label + privacy notice section (Rob's solicitor if used).
- DNS (SPF/DKIM/DMARC) changes done by Rob only.
- First campaign content reviewed by Rob; a test send to Rob's own address before any subscriber send.

## 10. Status

A101 remains **Not started** — this is a design draft; no implementation, activation or status change made or implied.
