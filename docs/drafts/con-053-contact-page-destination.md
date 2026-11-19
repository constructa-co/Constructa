# CON-053 — Contact page destination (drafts)

**Status: PRIVATE REVIEW DRAFT · NOT APPROVED · NOT PUBLISHED**
Tracker: CON-053 (P1, Rob-gated — "Confirm contact form scope and destination.")
Finding: "Contact page is mailto-only."

Current state: `src/components/marketing/cohort-contact.tsx` honestly states the page has no form and sends nothing. The Home page (`full-home.tsx`) has a "Get in Touch" section with a form and a "Within 1 working day" response-time claim — that claim is unverified and flagged below.

Blocked on: contact destination and data handling (missing inputs #3–#4).

---

## Draft A — Expanded contact page copy (mailto-first, no form claims)

Use now or later; contains no unapproved facts beyond what the current page already says.

> **Talk to the team behind phase one.**
>
> The simplest way to reach us is by email — the link opens your own email client, and you stay in control of what is sent and when.
>
> [EMAIL button: hello@constructa.co]
>
> - This page has no form and sends nothing.
> - Please do not paste private project or customer details into your message until we have agreed how to handle them.
> - Questions about the phase-one scope are welcome.

## Draft B — If a real contact form is approved later

Do not ship until the destination exists. Intro copy above the form:

> **Send us a message**
>
> This form sends your message to [ROB TO CONFIRM] [destination — e.g. the Constructa team inbox, name the system if there is one]. [ROB TO CONFIRM] [one plain sentence on handling and retention, e.g. "We use it only to reply to you and delete it within …"]. [ROB TO CONFIRM] [Confirm that the implemented form creates no subscription.]

Success copy:

> **Message sent.** Thank you — [ROB TO CONFIRM] [truthful next step, e.g. "we read every message and reply from hello@constructa.co."]. If you do not hear back, email us directly at hello@constructa.co.

## Draft C — Response-time line (needs the #3 decision)

Two variants, pick only after Rob confirms:

1. Commitment confirmed: "We reply within [ROB TO CONFIRM] [period, e.g. 1 working day]."
2. No response time promised: "[ROB TO CONFIRM] [Confirm who reads and replies before stating that messages are read and answered.]"

## Flag for review (not a draft change)

The Home "Get in Touch" section currently promises "Within 1 working day" and includes a form. Until the destination decision lands, that claim should either be confirmed by Rob or softened with variant 2. Codex may route this as a tracked edit; no edit was made here.
