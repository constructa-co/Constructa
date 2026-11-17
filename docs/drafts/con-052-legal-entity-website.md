# CON-052 — Legal entity on the website (drafts)

**Status: PRIVATE REVIEW DRAFT · NOT APPROVED · NOT PUBLISHED**
Tracker: CON-052 (P1, Rob-gated — "Confirm legal entity details.")
Finding: "No legal entity details on the website."

No legal identity exists in any approved source. These drafts use placeholders only and must not ship until the entity facts are supplied and legally reviewed.

---

## Draft A — Footer legal line

Placement: site footer, small print, all public pages.

> © [OWNER INPUT: year range, e.g. 2026] [OWNER INPUT: legal entity name]. All rights reserved.
> [OWNER INPUT: legal entity name] is [OWNER INPUT: registered in England and Wales / Scotland / other] · Company number [OWNER INPUT: company registration number] · Registered office: [OWNER INPUT: registered office address][OWNER INPUT: optional " · VAT number GB[…]" if registered]

If the trading name "Constructa" differs from the legal entity name, add one line: "Constructa is the trading name of [OWNER INPUT: legal entity name]."

## Draft B — About page "The company" paragraph

Placement: end of `full-about.tsx` / the About page, after the existing provenance-reviewed imagery content (`docs/marketing/about-image-provenance-2026-11-17.md` governs imagery; this is text only).

> **The company behind Constructa**
>
> Constructa is built by [OWNER INPUT: legal entity name], [OWNER INPUT: one plain sentence about the company — where it is based and what it does, e.g. "a UK company building software for domestic and commercial contractors."]. You can reach the team at hello@constructa.co.

## Rules

- Do not imply registration, certification or membership that has not been confirmed (e.g. do not say "registered in England and Wales" until that is true and supplied).
- The email hello@constructa.co appears in existing approved copy; keep using it until Rob names a different contact address.
- Entity details must match exactly what Rob supplies for the privacy policy and platform terms drafts (`con-009`, `con-010`) — one source of truth, one spelling.
