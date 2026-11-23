# CON-010 — Platform terms expansion (draft)

**Status: PRIVATE REVIEW DRAFT · NOT APPROVED · NOT PUBLISHED · NOT LEGAL ADVICE**
Tracker: CON-010 (P0, Rob-gated — "Approve terms text.")
Finding: "Terms of service are five short paragraphs."

The current page (`src/app/terms-of-service/page.tsx`) has five sections: Using Constructa; Your account and acceptable use; Your project information; Changes to these terms; Contact. This draft expands the structure while keeping every existing sentence that is already true, and marks everything new with `[ROB TO CONFIRM] [...]`. Existing approved sentences are quoted, not rewritten.

---

## Draft — expanded platform terms

Sections 1–3 and 5 keep the current page's wording verbatim (quoted in `src/app/terms-of-service/page.tsx`). New sections are inserted as follows; section numbers to be settled at build time.

> **The service**
> Constructa is provided by [ROB TO CONFIRM] [legal entity name], [ROB TO CONFIRM] [registered office address]. These terms are between you and [ROB TO CONFIRM] [legal entity name]. Questions about these terms: hello@constructa.co.
>
> **Using Constructa** *(current wording, unchanged)*
> Constructa helps UK construction contractors plan work, build estimates and proposals, and manage project information. You decide what goes into the documents you share with clients. The terms you agree with a client govern that work.
>
> **Your account and acceptable use** *(current wording, unchanged)*
> Keep your sign-in details secure. Use the service lawfully, respect other people's rights, and do not attempt to bypass its security or upload unlawful content.
>
> **Your project information** *(current wording, unchanged)*
> Only enter information you have the right to use. Check estimates, programmes and proposals before relying on them or sharing them. Where an AI-assisted feature is available, check its suggestions before using them.
>
> **[NEW] Availability of the service**
> [ROB TO CONFIRM] [service-level position. Until supplied, use: "The phase-one preview is a working review. Features may change, and the service may be unavailable at times. Do not rely on it as your only copy of project information — keep your own records."]
>
> **[NEW] Payments and subscriptions**
> [ROB TO CONFIRM] [this section stays empty — literally omitted from the page — until pricing and payments are real. The preview does not take a payment, and these terms must not imply otherwise.]
>
> **[NEW] Liability**
> [ROB TO CONFIRM] [liability wording from Rob's legal review. Until supplied, the section is omitted rather than guessed.]
>
> **Governing law**
> [ROB TO CONFIRM] [governing law and jurisdiction, e.g. "These terms are governed by the laws of … and the courts of … have exclusive jurisdiction." — supply exact wording.]
>
> **Changes to these terms** *(current wording, unchanged)*
> When the terms change, we will explain what changed and whether you need to accept the new version.
>
> **Contact** *(current wording, unchanged)*
> Send questions about the terms to hello@constructa.co.

## Rules

- The five existing sections are not reworded in this draft; an editor implementing it should move them, not rewrite them.
- Governing law and liability must come from Rob's legal review — this draft refuses to guess them.
- The payments section is deliberately absent, matching the approved statement that the preview does not sell a subscription or take payment.