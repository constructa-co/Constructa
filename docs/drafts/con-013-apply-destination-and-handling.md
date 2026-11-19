# CON-013 — Apply destination and data handling (draft variants)

**Status: PRIVATE REVIEW DRAFT · NOT APPROVED · NOT PUBLISHED**
Tracker: CON-013 (P0, Rob-gated — "Choose the application destination and data handling.")
Finding: "Apply-to-founding-cohort form cannot be submitted."

Current state: the apply page and form exist (`src/components/marketing/founding-cohort-apply-page.tsx`, `founding-cohort-apply-form.tsx`, `founding-cohort-apply-storage-notice.tsx`); approved copy already says the application form is a preview that cannot accept submissions yet. This draft supplies the copy variants for each destination decision, so the notice can be updated the moment Rob chooses. No variant ships until the decision lands.

---

## Variant 1 — Destination approved, submissions open

Storage notice copy (replaces the preview notice):

> When you send this application, the details you enter are stored by [ROB TO CONFIRM] [destination — name the system and who operates it] so the Constructa team can review your application. [ROB TO CONFIRM] [retention sentence, e.g. "We keep applications for … and delete them if you are not offered a place."] [ROB TO CONFIRM] [access sentence, e.g. "You can ask us to see or delete your application at hello@constructa.co."]

Form success copy:

> **Application received.** Thank you — [ROB TO CONFIRM] [Confirm who reviews applications and whether every application is reviewed.] [ROB TO CONFIRM] [truthful next step and timing, e.g. "We reply to every applicant by email."]

## Variant 2 — Staying a non-submitting preview (no destination chosen)

Keep the current approved framing; optional tightening only:

> This application form is a preview of the founding-cohort process. It cannot accept submissions yet. [ROB TO CONFIRM] [Confirm the exact browser, logging and storage behaviour before making a no-send/no-storage claim.] If you would like to register interest, email hello@constructa.co.

Rules for variant 2:

- "Nothing you type here is sent or stored" must remain exactly true; if any analytics or logging could observe the page, re-verify before keeping the sentence (see `docs/marketing/public-measurement-spec.md` — page views for signed-out visitors may be counted when analytics is on).
- Do not add a "notify me" or email-capture field here without a destination decision; that would silently create the missing destination.

## Rules (both variants)

- The approved facts "Apply is separate from sign-in" and "the preview does not take a payment" stay on the page in all variants.
- The founding cohort date stays exactly "7 December 2026".
- Whichever variant is chosen, the privacy policy draft (`con-009-privacy-policy-completion.md`) gets the same destination facts in its "Application interest" bullet — one source of truth.
