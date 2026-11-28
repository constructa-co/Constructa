# D125 — mocked regression pack (packaging-only commit)

Evidence path: `docs/evidence/d125-mocked-regression/`

This commit is **packaging only** of **10 existing PNGs** (+ provenance, contact sheets, ZIP, fingerprints). No app `src/` changes, no executable harness committed, no new worktrees or captures.

**Not returned:** `admin_revenue` 375/1440. **Not claimed:** integrated main, admin auth, whole-app PASS.

**Copy breach:** 4 full source trees (primary + 3 worktrees) vs max 3 — halted, not waived. See pack `README.md` / `manifest.json`.

Gitleaks **8.30.1** (checksum-pinned tarball) PASS on bounded export + `4c887d89..6b7bda7e` — see `gitleaks-receipt-8.30.1.json`. Prior `gitleaks-receipt.json` (rg-only) remains in packaging commit history.

R1: authorise a single normal `git push` after review. No amend, no force-push.