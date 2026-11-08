# Founding-cohort welcome pack — drafts (cohort starts 7 Dec 2026)

**DRAFT — ROB REVIEW REQUIRED.** Nothing here has been sent, scheduled, wired to email, or shown
to any customer. Pure copy drafts for Rob to review, amend or discard.

## Ground rules used

- Only shipped cohort features are mentioned. The cohort launch profile
  (`src/lib/launch-profile.ts:21-29`) enables exactly: **company profile, pipeline (jobs),
  project setup, brief, estimating, programme, proposal**.
- Support channel is email-only: **hello@constructa.co** (`src/components/marketing/cohort-contact.tsx:5`).
  The cohort contact page promises no response time, so none is promised below.
- The public site describes Constructa as being in a focused **phase-one preview/review**
  (`cohort-contact.tsx:26-28`, `about/page.tsx:153`), so the copy stays honest about that.
- Two published review guides exist and are referenced by title
  (`src/lib/marketing-guides.ts:83-101`): "Review your company profile, brief and price" and
  "Check programme and proposal before sharing".
- No statistics, dates beyond the 7 Dec cohort start, or feature promises beyond the list above.
  Anything uncertain is marked **[verify before send]**.

---

## 1. Welcome email

**Subject options**
1. `Welcome to the Constructa founding cohort`
2. `Your Constructa account is ready — a 10-minute start`
3. `Constructa cohort: week one, kept simple`

**From / reply-to:** Constructa team `<hello@constructa.co>` **[verify sender name/address before send]**

**Body (plain-text-first):**

> Hi {first name},
>
> Welcome to the founding cohort — thank you for joining us at the start.
>
> Constructa is a new tool for small construction businesses to run the work-winning
> side of a job: company profile, brief, estimate, programme and proposal, in one place.
> You are among the first people to use it for real work, and your feedback will shape
> what we build next. That also means we will be straight with you: this is an early,
> focused release. Some things will be rough, and when they are, we want to know.
>
> **This week, if you do three things:**
> 1. Complete your company profile — trade, experience, and the details you want on your proposals.
> 2. Set up your first job and walk it through brief → estimate → programme → proposal.
> 3. Tell us one thing that confused you and one thing you would miss if it disappeared.
>    Reply to this email — a real person reads every message.
>
> **What is in your account today**
> - Company profile and capability statement
> - Job pipeline and project setup
> - Guided brief and estimating (simple and detailed)
> - Programme view and a client-ready proposal PDF
>
> We have kept the first phase deliberately small so it is solid. Features you do not see
> are not hidden behind a plan — they are not built yet. If something you need is missing,
> say so; cohort requests set the roadmap order.
>
> Two short checklists are on the site under Guides if you want a second pair of eyes
> on your profile, brief and price before you share your first proposal.
>
> Questions any time: hello@constructa.co. No forms, no tickets — just email us.
>
> Good work,
> The Constructa team
>
> P.S. Your account is yours: nothing is published anywhere, and nothing is shared with
> anyone until you send a proposal yourself.

**Notes for Rob:** tone matched to phase-one marketing (grounded, no hype). "{first name}"
placeholder — **[verify merge fields available in the sending tool before send]**. The "10-minute
start" subject is only usable if that time claim feels defensible — currently **[unverified]**;
subject 1 is the safe default.

---

## 2. First-week guide (onboarding handout / email part 2)

**Title:** Your first week with Constructa

> **Day 1 — Profile (15 minutes)**
> Fill in your company profile: trade, experience, contact details and the case studies you are
> proud of. This is the information Constructa reuses on every proposal, so it is worth ten
> extra minutes now.
>
> **Day 2 — First job**
> Create a job in your pipeline. Add the site, the client and what the job is. Keep it small —
> a real job you are quoting this month is ideal, but a practice job is fine.
>
> **Day 3 — Brief and estimate**
> Work through the guided brief, then build the estimate. Try the simple estimate first;
> the detailed view is there when a job needs itemised costs.
>
> **Day 4 — Programme**
> Lay the job out on the programme so you can see the shape of it — what starts when, and
> what depends on what.
>
> **Day 5 — Proposal**
> Generate the proposal and read it as if you were the client. Adjust your terms, then
> check the programme and proposal checklist under Guides before you send anything.
>
> **Any day — tell us**
> Confusing screen, wrong wording, a step you did twice: email hello@constructa.co.
> Cohort feedback is read by the people building the tool, not a support queue.
>
> **By the end of week one you should have:** one complete job from brief to proposal, and
> at least one piece of feedback sent to us. That is a successful week one.

**Notes for Rob:** deliberately uses only the shipped stages. Day timings are estimates, not
measured statistics — soften to "a few minutes" if preferred. Reference to capability statement /
case studies matches `COHORT_CAPABILITIES` ("company-profile") and the `/dashboard/settings/case-studies`
route (`launch-profile.ts:45`).

---

## 3. FAQ (cohort-facing)

> **What exactly do I get in the founding cohort?**
> Company profile, job pipeline, project setup, guided brief, estimating (simple and detailed),
> programme view, and client-ready proposal PDFs. If a feature is not in that list, it is not
> in this phase.
>
> **What does it cost?**
> **[Rob to fill — pricing not stated in any copy here; check the current cohort pricing
> decision before send.]**
>
> **Is my data safe? Who can see it?**
> Your account is private. Nothing is listed publicly, and proposals only reach a client when
> you send them yourself. We ask that you do not paste private project or customer details into
> emails to us until we have agreed how to handle them (same rule as our contact page).
>
> **How do I get help?**
> Email hello@constructa.co from the email account you normally use. There is no ticket system;
> messages go to the team directly. We do not quote a response time, but every message is read.
>
> **Something is missing that I need.**
> Tell us. The cohort exists so real jobs decide what gets built next. Requests from cohort
> members carry the most weight in what we prioritise.
>
> **Can I use it for live client work?**
> Yes — that is the point of the cohort. Quotes, programmes and proposals you produce are yours
> to send. The tool itself is in an early phase, so check a document before it goes out, the
> same as you would with anything new.
>
> **What happens after the cohort?**
> **[Rob to fill — post-cohort terms not yet decided; do not imply a price, a discount, or
> grandfathering without a decision.]**
>
> **How do I report a bug?**
> Email hello@constructa.co with what you were doing, what you expected, and what happened
> instead. Screenshots help. You will not be fobbed off with a ticket number.

---

### Verification checklist before anything is sent

- [ ] Sender address and merge-field capability confirmed
- [ ] Cohort pricing line approved and inserted (or cost question left out)
- [ ] Post-cohort answer approved and inserted
- [ ] "Simple and detailed" estimate naming matches the in-app labels at send time
- [ ] Rob has read every section; every claim maps to a shipped cohort capability
