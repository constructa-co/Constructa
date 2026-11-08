# A109 — Founding-cohort applicant destination: two options for Rob

**DRAFT — ROB REVIEW REQUIRED.** Copy and field drafts only. No form, inbox, DNS,
email flow, page or activation was built or changed. Nothing was sent.

## 1. Where the CTA points today (read-only source check, branch head 4901eb5)

- The primary marketing CTA is `AccountLink`, which points at `/login`
  (`src/components/marketing/phase-one.tsx:48-50`). It is used as "Open Constructa"
  (hero, `phase-one.tsx:124`), "Start with your business" (`:133`), the Invitation
  section (`:114`) and "Sign in with your review account" on the pricing page
  (`phase-one.tsx:153`).
- The pricing page copy is explicit that this is for existing review accounts only:
  "This preview is for people using an existing review account. Sign in with the
  details you were given" (`phase-one.tsx:151`), and routes everyone else to
  "Neutral preview-access questions" at `/contact` (`phase-one.tsx:156`).
- `/contact` (`src/components/marketing/cohort-contact.tsx`) has **no form and sends
  nothing** — it is a `mailto:hello@constructa.co` link that opens the visitor's own
  email client (stated on the page at `cohort-contact.tsx:8`).
- The `full-*` marketing pages (only rendered under the `full` launch profile) have
  placeholder `href="#"` CTAs (`full-home.tsx:148,282,328,424,633`), one `/login`
  CTA (`full-features.tsx:254`) and a `mailto:hello@constructa.co` contact
  (`full-home.tsx:674`).
- The RC branch `cursor/rc-integration-20261108` (tip f690204, Cursor-owned) adds an
  `/apply` route (A097). **This draft deliberately does not design that route's
  implementation** — the decision below is about what the applicant destination
  should *be*, which the `/apply` work (or the phase-one CTA) then points at.

So today a founding-cohort applicant has no clear destination: the main CTA asks for
review-account credentials they do not have, and `/contact` is a generic mailto with
no application framing. A109 is the decision that fixes that.

## 2. Option A — a simple application form

A single page (e.g. `/apply`) with a short form. Submission is stored and Rob gets a
notification. The applicant sees a confirmation screen immediately.

### Minimum fields (proposed)

| Field | Required? | Why |
|---|---|---|
| Full name | Required | To address the applicant |
| Business name | Required | Cohort is for trade businesses |
| Trade / role | Required | One line, e.g. "Kitchen fitter, 6 staff" |
| Email | Required | Reply address; also the future account email |
| Phone | Optional | Some trades prefer a call |
| Where the business is based | Optional | Town/county only — cohort logistics |
| One line: what would make this useful to you | Optional | Qualitative signal |
| Consent checkbox | Required | Links to the notice below |

No payment details, no project data, no CV uploads. Deliberately less than a
customer-onboarding form — this is a cohort application, not an account.

### Plain-English data-handling and privacy notice (draft copy, for under the form)

> **How we use what you tell us**
>
> We ask for your details only so we can consider your application to the
> founding cohort and reply to you. We will not add you to a marketing list, sell
> your details, or share them outside the small Constructa team. If you are not
> invited to join, we will delete your application details. You can ask us at any
> time what we hold about you, or ask us to correct or delete it, by writing to
> hello@constructa.co.

(Final legal wording needs review against the — currently incomplete — privacy
policy; see `src/app/privacy-policy/page.tsx:30-32`, which itself says the notice
must be completed before it can be relied on. Do not publish the form with this
placeholder as the final notice.)

### Confirmation copy an applicant sees (draft)

> **Thank you — your application is in.**
>
> We read every application ourselves. If it looks like a good fit for the
> founding cohort, we will reply from hello@constructa.co within a few working
> days. There is nothing else you need to do, and we will only contact you about
> your application.

### What Rob must decide for Option A

1. **Storage**: new Supabase table (needs a migration — a live-DB decision, out of
   scope here) versus a form-to-email relay (no DB, but applications land in a
   mailbox and storage/retention is whatever the mailbox does).
2. **Consent record**: whether the consent tick is stored with a timestamp (it should
   be, at minimum as a stored field, before this is real).
3. **Who reviews and how fast**: named reviewer and a truthful SLA for the
   confirmation copy above.
4. **Notification**: how Rob hears about a new application (email ping vs a review
   screen vs both).
5. **What happens to non-selected applicants**: deletion promise above needs an
   actual process before the copy is used.

## 3. Option B — a monitored inbox

Keep the existing no-form pattern from `/contact` and give applicants a dedicated
"Apply" page whose button opens their own email client with a pre-filled template
(`mailto:` with `subject=`/`body=`), still to `hello@constructa.co` (or a dedicated
alias like `cohort@constructa.co` — a DNS/mailbox decision for Rob, not made here).

### Minimum fields (proposed — asked for in the pre-filled template)

Same list as Option A: full name, business name, trade/role, email (their own
address is the sender), phone (optional), town/county (optional), one line on what
would make it useful (optional). Consent is handled in the notice text rather than a
checkbox, because a mailto cannot record a tick.

### Plain-English data-handling and privacy notice (draft copy, for the page)

> **What happens when you press send**
>
> Pressing the button opens a draft email in *your* email app. Nothing is sent to us
> until you press send, and you can change or delete anything before you do. Your
> message goes to a monitored Constructa inbox and is read by the team. We use it
> only to consider your application and reply. We will not add you to a marketing
> list or share your details outside the team. Please do not include private project
> or customer details — we do not need them to consider your application.

(Extends the existing page facts at `cohort-contact.tsx:7-11` in the same voice.)

### Confirmation copy an applicant sees (draft — the page, after the button)

> **Your email app should now be open with your application ready to send.**
>
> Check it, then press send in your email app. We read every application and reply
> from the same address within a few working days. If nothing opened, write to
> hello@constructa.co with your name, business and trade.

### What Rob must decide for Option B

1. **Address**: keep `hello@constructa.co` or create a monitored alias (DNS/mailbox
   work — not done here).
2. **Monitoring rota and SLA**: who checks the inbox, how often, so the "few working
   days" promise is real.
3. **Tracking**: a private spreadsheet/log of applicants, and what retention it has —
   a spreadsheet is a store of personal data too and needs the same deletion habit.
4. **Spam/deliverability**: a public mailto on a marketing page will attract spam;
   decide the filtering approach before publishing.

## 4. Comparison and recommendation (for Rob's choice, not decided here)

- **Option A (form)** is the better applicant experience (clear destination, instant
  confirmation, consent recordable) but carries real build work: storage, a
  migration/relay decision, consent recording, and the incomplete privacy policy
  must be finished first (it says so itself).
- **Option B (monitored inbox)** ships with near-zero build — it reuses the
  pattern already on `/contact` and the existing mailbox — and is honest about
  sending nothing until the applicant acts. Its weaknesses: no consent record, a
  weaker confirmation experience, spam exposure, and tracking discipline resting on
  a person rather than the software.
- A defensible sequence is **B now, A later**: publish the apply-page-with-mailto
  copy (Option B) as soon as the monitoring rota exists, and build the form (Option
  A) once the privacy policy is complete and storage is decided.

## 5. Explicit non-actions

No form, page, route, mailbox, alias, DNS record, email, Supabase migration, CTA
rewire or launch-profile change was made. The RC branch and its `/apply` work were
read about only from inbox evidence and left untouched. All copy above is draft for
Rob's review and legal/retention checks before any use.
