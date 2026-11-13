# A096 — Marketing copy gap: public privacy notice does not cover measurement or email updates

**Artifact status:** DRAFT · NOT APPROVED · NOT PUBLISHED · NO SOURCE EDIT MADE
**Author:** Kimi (offline pass, 2026-11-13), branch `codex/r1-20261113-a102-a096-copy`
**Purpose:** Draft replacement copy for the public privacy notice, plus the evidence for the gap. This is a documentation draft only — no source file was changed; any landing of this copy in `src/app/privacy-policy/page.tsx` is a separate, human-approved step owned by Codex.
**Packaging:** Codex owns review, grading and draft-PR packaging. This file is saved only; no commit, push or PR by Kimi.

---

## The evidenced gap

The A096 audit (`docs/delivery/2026-11-08/codex-evidence-a079-a089-a096.md`, commit e9b49c1) recorded, for the public site: "provider operation, consent and newsletter suitability are unverified… consent provenance, sender setup, suppression/unsubscribe and retention remain unverified." Since that audit, measurement and newsletter capability has landed on main:

- **#124 (A097, main e16363d):** Vercel Web Analytics page-view measurement on marketing routes only, via `src/components/public-analytics.tsx` from the root layout. Documented in `docs/marketing/public-measurement-spec.md`. Hosted enablement stays with Rob, so collection is not yet active.
- **#125 (A101, main 0d0c89c):** `src/components/marketing/newsletter-signup.tsx` — a signup form posting to the existing ConvertKit form, rendered only when `CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED === '1'`, and not in review mode or Vercel preview. The flag defaults **off**.

The public privacy notice (`src/app/privacy-policy/page.tsx`) says nothing about either: no mention of page-view measurement, and no mention of what the email-updates form collects or where it goes. The notice itself is labelled incomplete ("does not yet explain who is responsible…, who it is shared with, where it is stored…"). That missing description is the one evidenced A096 marketing copy gap addressed here: **the public copy has not caught up with the measurement and newsletter capability the audit covered.**

## Facts the copy must be true to (from source, not memory)

- Analytics: Vercel Web Analytics; cookieless page views; marketing/public routes only; not rendered in review mode (`CONSTRUCTA_REVIEW_ONLY`) or when a sign-in session cookie is present; query strings/fragments dropped before sending; Vercel itself records referrer, country, device and browser and that cannot be stripped client-side (`docs/marketing/public-measurement-spec.md`). Custom events are disabled and forward nothing.
- Status honesty: hosted enablement is with Rob; until enabled "nothing is collected". The copy must not claim collection is live.
- Newsletter: email address only, sent to Constructa's existing email provider (ConvertKit) to deliver updates; flag-gated and off by default; submitting is a request, not a confirmed subscription until the provider confirms it.
- The page already carries a draft, not-legally-approved notice; the new sections must keep that framing and must not present the page as compliance certification.
- Contact route already on the page: hello@constructa.co for access/correction/deletion questions.

---

## Draft copy — two sections to add to the privacy notice

**Status: DRAFT · NOT APPROVED · NOT PUBLISHED**

Suggested placement: after the paragraph beginning "When you sign up for updates or use our platform…" and before the "This notice is incomplete…" paragraph, which should be retained until the notice is completed and reviewed.

### Section A — Measurement on our marketing pages

> **Measurement on our marketing pages**
>
> We use Vercel Web Analytics to understand overall traffic to our public marketing pages — for example, how many people visit and which pages they read. It counts page views without using tracking cookies, and it runs only on our public marketing pages — not on app, account or proposal pages, and not for signed-in users. Links and addresses with identifying details (such as anything after a `?` in a page address) are not included in what we send.
>
> Vercel, as the hosting provider, records some technical details itself as part of serving the pages — such as the referring site, country, device type and browser. We do not add cookies, local storage or personal identifiers of our own on these pages.
>
> This measurement is not yet switched on. Until we enable it in our hosting settings, no page-view data is collected.

### Section B — Email updates

> **Email updates**
>
> If you choose to sign up for Constructa updates, you give us your email address and we pass it to our email provider so they can send the updates you asked for. Signing up is a request — it is not a confirmed subscription until the provider confirms it. You can ask us at hello@constructa.co to stop updates or to delete your address, and we will pass that on.

---

## Pre-approval review checklist

Before any of this copy lands in the source page, confirm each item against current source — not against this document:

- [ ] `src/components/public-analytics.tsx` and `src/app/layout.tsx` still match the measurement description (review-mode omission, session-cookie omission, `beforeSend` URL rewrite, marketing-route guard).
- [ ] `docs/marketing/public-measurement-spec.md` still matches; the "not yet switched on" line is still true (hosted enablement remains with Rob).
- [ ] `src/components/marketing/newsletter-signup.tsx` still posts to the existing ConvertKit form only, and the enable flag is still off by default.
- [ ] The retained "incomplete notice" paragraph and the amber draft banner are not removed by this change.
- [ ] A human approves the final wording; nothing is published or merged by automation.
- [ ] No new legal claims are introduced: no named data controller, no legal basis, no retention period, no certification — those remain for the full notice rewrite.

## Document control

| Field | Value |
| --- | --- |
| Task | A096 — one evidenced marketing copy gap (privacy notice vs measurement/newsletter capability) |
| File | `docs/delivery/2026-11-13/kimi-a096-privacy-measurement-copy.md` |
| Created | 2026-11-13 |
| Sources cited | `docs/delivery/2026-11-08/codex-evidence-a079-a089-a096.md` (e9b49c1); `docs/marketing/public-measurement-spec.md`; `src/app/privacy-policy/page.tsx`; `src/components/marketing/newsletter-signup.tsx`; `src/components/marketing/phase-one.tsx`; main merges #124/#125 |
| Publication / landing | None — draft copy for human review; source edit not made |
| Actions taken | File write only. No builds, installs, deletes, settings, credentials, live SQL, signup, external writes, push or deploy. |
