# CON-009 — Privacy policy completion (draft)

**Status: PRIVATE REVIEW DRAFT · NOT APPROVED · NOT PUBLISHED · NOT LEGAL ADVICE**
Tracker: CON-009 (P0, Rob-gated — "Approve privacy text.")
Finding: "Privacy policy says it is a draft, incomplete and not legally approved."

The current page (`src/app/privacy-policy/page.tsx`) already says this about itself and asks the reader to email questions. This draft completes the structure using only facts already true in the source, plus `[ROB TO CONFIRM] [...]` tokens for everything Rob must supply. The draft amber notice stays until Rob approves the text.

Verified-from-source facts this draft relies on: email list sends the address to Kit (ConvertKit); Vercel Web Analytics may count signed-out public-page visits with query strings removed (`docs/marketing/public-measurement-spec.md`); the apply form currently cannot be submitted; there is no account sign-up in the preview.

---

## Draft — replacement body for the privacy policy page

> **Privacy Policy**
>
> **Draft, not yet legally approved.** This page is not legal advice and is not presented as compliance certification. [This notice is removed only when Rob approves the text and the bracketed facts below are supplied.]
>
> **Who is responsible for your information**
> [ROB TO CONFIRM] [legal entity name], [ROB TO CONFIRM] [registered office address], is the data controller for the information described on this page. You can contact us about your information at hello@constructa.co.
>
> **What we hold**
> - [ROB TO CONFIRM] [Confirm the categories actually received and held.] Information you give us directly: your name, email address and company details when you contact us or join the updates list.
> - Updates list: if you submit the updates form, your email address is sent to Kit (ConvertKit), the email provider that runs that list. [ROB TO CONFIRM] [confirm Kit is still the provider — missing input #14.]
> - Application interest: if you use the founding-cohort application page, [ROB TO CONFIRM] [destination and handling — the form currently cannot be submitted; state exactly what happens to anything entered].
> - [ROB TO CONFIRM] [Confirm enabled providers and their data collection before approving this paragraph.] Analytics: this site can include Vercel Web Analytics. When it is on, it counts visits to public pages for signed-out visitors. Constructa removes query strings from page addresses before page views are sent. It does not collect your name, email or project details.
> - We do not ask you to create an account in the phase-one preview, and this policy does not describe account data beyond what is listed here.
>
> **How we use it**
> [ROB TO CONFIRM] [purposes and legal bases, e.g. reply to enquiries — legitimate interest; updates list — consent; etc.]
>
> **Who it is shared with**
> [ROB TO CONFIRM] [processor list with what each does — e.g. hosting provider, email provider, analytics provider.]
>
> **Where it is stored and how long we keep it**
> [ROB TO CONFIRM] [storage locations and retention periods per category.]
>
> **Your choices**
> You can contact us at hello@constructa.co to ask for access to, correction of, or deletion of your information, or to ask how personal, company, tax, pricing or salary information is handled. [ROB TO CONFIRM] [any additional rights wording required for the jurisdictions that apply.]
>
> **Changes to this policy**
> [ROB TO CONFIRM] [Confirm the owner and process for publishing policy changes and the change notice.]

## Rules

- Nothing in the draft asserts a legal basis, retention period, processor or transfer that has not been supplied. The incomplete-notice stays until every token is replaced and Rob approves.
- If the measurement or newsletter configuration changes before approval (default-off flags in `public-measurement-spec.md`), the analytics bullet must be re-checked against the shipped state.