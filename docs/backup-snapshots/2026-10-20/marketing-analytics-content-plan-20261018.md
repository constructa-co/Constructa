# Constructa Analytics Newsletter and Content Plan

18 October 2026. New marketing workstream from Robert's direct request. This supersedes assumptions from the year-old plan through a current-source and current-documentation review, not by discarding existing work.

## Recommended Structure

Build a public Guides and Insights section on Constructa's own marketing domain, with useful articles and practical examples, newsletter signup in relevant places, and a small private editorial workflow. Use LinkedIn, Facebook and selected Medium republication to bring readers back to the original content. Keep this separate from the contractor's private workspaces and the application's resource-management module.

A public content hub and a private publishing back end serve different purposes. The public side earns and converts traffic. The private side manages drafts, review, approved images, publication dates and channel-specific versions. A large new CMS is not a prerequisite for the first few reviewed articles; select the smallest compatible approach after checking deployed source.

## Existing Source Findings

These are local-source observations, not live provider/account/configuration verification. No credentials, environment values, subscriber lists, remote analytics or personal records were read.

| Location | Existing work | Unresolved verification |
| --- | --- | --- |
| constructa/src/app/layout.tsx | Shared Plausible loader/event queue and Clarity loader, selecting between project identifiers by hostname. | No consent or private-route condition is visible in these loader blocks. Audit actual scope and network behaviour before launch; local external-traffic guards remain unchanged. |
| constructa/src/components/marketing/full-landing.tsx | Preserved older landing page has additional Plausible/Clarity declarations and a ConvertKit signup embed. | Check duplication if this full-profile route is used. The old signup event attaches to submit, not verified subscriber confirmation, so it cannot by itself prove a confirmed signup. |
| constructa/src/app/admin/page.tsx | Existing server-side Plausible metrics adapter for the site. | No live credentials or dashboard queried. Availability, source coverage and conversion attribution remain unverified. |
| constructa/src/app/privacy-policy/page.tsx | Existing short privacy statement. | Reconcile actual processors, tracking, newsletter purposes, rights/retention and published claims with the broader privacy/platform-terms workstream. |
| Current phase-one marketing | New marketing presentation exists locally. | No new newsletter provider, analytics instrumentation or social publication was activated in this review. |

A source path scan found no public blog/guides/article route in this checkout; existing dashboard/resources is contractor resource management, not a content library. This is not a claim about the entire separate deployed marketing repository.

## Measurement Choices

| Role | Recommended first step | Current basis |
| --- | --- | --- |
| Website traffic and conversion | Assess and reuse Plausible first rather than install a second overlapping dashboard by default. Define article-to-account and newsletter outcomes. | [Plausible goals](https://plausible.io/docs/goal-conversions) support pageview/custom-event goals and source/conversion analysis. |
| Behavioural diagnosis | Evaluate consent-gated Clarity on public marketing pages only at first; exclude account and private contractor pages. | [Microsoft Clarity data](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data) and [Consent V2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2) describe collection and current consent signals. Microsoft states regional signal enforcement began 31 October 2025; do not reuse an old integration unquestioningly. |
| More complex acquisition needs | Keep GA4 as a considered alternative if the campaign/advertising measurement requirements justify it, not an automatic extra tracker. | [GA4 event measurement](https://support.google.com/analytics/answer/9216061) documents automatically collected interaction events. Provider settings and actual data transmission need separate validation. |
| Search visibility | Add verified search-performance ownership/reporting as a later scoped setup task, rather than mistake visitor analytics for search indexing. | [Search Console](https://support.google.com/webmasters/answer/9128668) reports Google Search visibility, queries, clicks and indexing issues. No ownership/account change made here. |

Measure sources and useful outcomes, not just pageviews. Proposed event vocabulary: article viewed, newsletter form started, newsletter confirmation verified, account entry started, account created, first estimate saved and first proposal draft ready. Each name needs an exact success definition; a click or submitted form is not the same as successful completion.

Public marketing can start separately from private application activation measurement. Any application events require a dedicated data-minimisation design: no client/project names, addresses, salaries, rates, free-text content or raw query strings/identifiers. Do not put replay on cost/programme/profile screens by default. Masking alone is not a sufficient reason to record sensitive pages.

Privacy choices must be checked against actual technology and [current ICO online tracking guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/online-tracking/), which reflects changes to UK rules. Do not infer that every configuration is exempt or lawful from a vendor's cookie-free description. Newsletter opt-in, analytics preferences and platform acceptance remain separate.

## Newsletter

Kit is a practical candidate because related code already exists, not a provider selection or activation. [Kit newsletter feeds](https://help.kit.com/en/articles/5653922-newsletter-feeds-in-kit) can publish selected newsletter content publicly, but I recommend the main guides live under Constructa's own site rather than making a Kit page the primary knowledge library.

Put a clear optional signup on the homepage, article pages and a dedicated subscription page. Explain the subject and cadence. Use confirmation, unsubscribe and suppression handling, and keep account/service emails separate from marketing. Kit [recommends double opt-in](https://help.kit.com/en/articles/2971364-the-all-important-double-opt-in); configuration, sender identity, consent records and the existing account/list must be checked before any live email tests. Never assume old waitlist contacts may be repurposed.

No signup submission, subscriber import, email, sender-domain/DNS change or account operation is authorised by this planning record.

## Content and Distribution

Recommended public structure: Guides and Insights index, individual article pages, newsletter signup, and relevant product links. Article metadata should include author, reviewed/updated date, topic, image and useful next action. Canonical URLs, sitemap/indexability and social link previews should be considered before publication. Do not expose drafts or private application pages.

Start with a few genuinely useful contractor topics: building a labour/material rate, documenting exclusions, planning a kitchen installation with lead times, and explaining payment-stage options without prescribing contracts. Use clearly labelled illustrative examples and reviewed technical/legal content where relevant, not confidential customer data or unsupported benchmark claims.

[Google's current content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) favours useful first-hand expertise over mass-produced search-first pages. AI can help draft or repurpose material, but editorial review and a real contractor audience remain the organising principle.

One approved original guide can produce a newsletter summary and tailored LinkedIn/Facebook excerpts linking back through non-sensitive campaign tags. Treat Medium as an optional secondary channel and retain a link to the original; its [canonical-link tools](https://help.medium.com/hc/en-us/articles/360033930293-Set-a-canonical-link) support source attribution, not a guarantee of ranking.

Begin with human-reviewed manual publishing. Posting APIs, social account connections, scheduling services, paid campaigns and automatic cross-posting require separate scope and access. No assumption that link placement guarantees platform reach or that all channels need the same content.

## Delivery Order

1. Audit current analytics/Kit source and deployed configuration safely; preserve old implementation. Define metrics and data boundaries.
2. Add a small public guides structure and reviewed starter content alongside the marketing integration, without displacing core product work.
3. Prepare newsletter UX and explicit consent/unsubscribe handling. Activate only against an approved exact provider/list/sender scope.
4. Validate permitted measurement, privacy choices and attribution, then publish reviewed content with manual channel distribution.
5. Add editorial tooling and automation only when actual publishing cadence and results justify them.

This is planning and source review, not delivered analytics/newsletter/content functionality. Core estimating, programme consistency, preservation and end-to-end product delivery retain priority.

