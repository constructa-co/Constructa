# Private editorial workflow (A100)

Lightweight **local CLI** for marketing copy drafting, reviewer feedback, explicit editorial approval, and a **handoff file** for human manual publication. It is not a CMS, not a publisher, and does not post anywhere.

## Principles

- **State lives outside git.** Pass an absolute `--dir` that is **not inside this repository**. The tool refuses repo-contained storage. Files created there use mode `0600` and directories `0700`; that is basic filesystem hygiene, not a privacy or encryption guarantee.
- **No default writes.** Every command requires `--dir`.
- **Review ≠ approval.** Recording feedback does not approve a draft.
- **Approval is revision-specific.** Editing title or body clears approval; export fails if approval does not match the current revision.
- **Human publication only.** The handoff file is labelled **NOT PUBLISHED**. Copying or saving it is not external publication.

Approval recorded here means **editorial review only** — not financial release, legal sign-off, or Rob’s production deploy authority.

## Commands

All paths below use a private directory you choose (example: `/Volumes/Private/constructa-editorial`).

```bash
# Create a draft (optional --id must be lowercase alphanumeric + hyphens)
node scripts/editorial-workflow.mjs --dir /absolute/private/dir create \
  --title "Draft title" --content "Draft body text."

# Update content (invalidates prior approval)
node scripts/editorial-workflow.mjs --dir /absolute/private/dir update DRAFT_ID \
  --content "Revised body."

# Record reviewer feedback (does not approve)
node scripts/editorial-workflow.mjs --dir /absolute/private/dir review DRAFT_ID \
  --reviewer "Reviewer name" --feedback "Change the opening sentence."

# Approve the current revision (requires review on that revision)
node scripts/editorial-workflow.mjs --dir /absolute/private/dir approve DRAFT_ID \
  --approver "Approver name"

# Read-only status (single draft or omit id for list)
node scripts/editorial-workflow.mjs --dir /absolute/private/dir status DRAFT_ID

# Write handoff copy for manual publication (--out must be outside the repo)
node scripts/editorial-workflow.mjs --dir /absolute/private/dir export DRAFT_ID \
  --out /absolute/private/dir/handoff-Draft.txt
```

State file name: `constructa-editorial-state.json` inside `--dir`.

## Tests

Synthetic fixtures only, under the process `TMPDIR`:

```bash
node --test scripts/editorial-workflow.test.mjs
```

## Source content

Use factual marketing copy aligned with the in-app **ProductReviewGuide** component when drafting real material. This workflow does not invent business or legal policy text.
