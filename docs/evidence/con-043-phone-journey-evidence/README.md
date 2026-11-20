# CON-043 phone estimate and proposal evidence

Synthetic offline only — not hosted Constructa acceptance.

## Compile (outside checkout)

```sh
node e2e/local-phase1/build-brief-price.mjs /tmp/con043-estimate existing-estimate-add
node e2e/local-phase1/build-brief-price.mjs /tmp/con043-proposal proposal-view
```

## Run (Edge Playwright)

```sh
cd <worktree-root>
CONSTRUCTA_LOCAL_ESTIMATE_OUTPUT=/tmp/con043-estimate \
CONSTRUCTA_LOCAL_PROPOSAL_OUTPUT=/tmp/con043-proposal \
node node_modules/@playwright/test/cli.js test \
  --config=playwright.local-phone-journey-estimate-proposal.config.ts
```

## Scope delivered here

- Estimate: add line (MOCK refuse/ack), working total strip and sticky dock visibility at 360/390/430.
- Proposal: Prepare vs Review document stage controls reachable at 360/390/430.
- Programme phone date list: **not** re-run (shipped at `611d767` / PR #216).

## Artifacts

- `con043-phone-{360,390,430}-estimate-total.png`
- `con043-phone-{360,390,430}-proposal-review.png`
- `con043-phone-journey-evidence.json` — branch, head, source hashes, limitations
The package retains the CON074 compiler scenario. Extra installed-package resolution and unused Node built-in adapters are confined to the two phone fixture scenarios. Set `CONSTRUCTA_PHONE_EVIDENCE_DIR` to retain a verification run outside the checked-in evidence directory.

The retained six-test receipt is `playwright-final-result.json`, extracted after the reporter completed at capture head `b766075`; the capture manifest references its separate final reporter rather than embedding an earlier result.
