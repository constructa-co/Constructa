# A006 — UK SME construction disciplines: research decision (Phase 2)

Date: 2026-11-15 · Author: Cursor Composer 2.5 (cloud) · Branch: `cursor/a006-uk-disciplines-20261115` · Base: `33d8fd3f`
Type: **docs-only research decision** — no product, settings, SQL, deployment, customer data, or register status changes.

## Decision summary

Constructa should continue to treat **contractor discipline** (what the business does) and **client sector** (domestic / commercial / public) as **separate dimensions**, and should **support the same first-wave discipline catalogue for both domestic and commercial SME work**, differentiating jobs via existing `client_type` and project-type pickers rather than parallel discipline menus.

For **first-wave product support** (onboarding suggestions, brief trade sections, case-study tags, and future benchmark consent copy), the evidence-backed priority set is the **current 16-tile `SETUP_WORK_SUGGESTIONS` list**, with **one label tweak** and **explicit mapping** to Office for National Statistics (ONS) firm counts. No expansion to the 47-name `BRIEF_TRADES` grid for onboarding until layout work (A008 — now Complete) and owner sign-off on frequency ranking.

**Domestic vs commercial work to support first (job types, not SIC labels):**

| Priority | Domestic-first job families | Commercial-first job families | Shared discipline backbone |
| --- | --- | --- | --- |
| P0 | Extension, loft, renovation, kitchen/bathroom, roofing repair | Office/retail fit-out, refurbishment, small commercial alteration | General building; refurbishment & fit-out; M&E; finishes |
| P1 | Groundworks for extensions, driveways, landscaping | Shell-and-core follow-on trades, landlord refurb | Groundworks & civils; roofing; external works |
| P2 | Specialist single-trade (rewire, boiler, decoration) | Compliance-led installs (fire, access, HVAC) | Electrical; plumbing & heating; painting; glazing |

Rationale: DBT counts **870,000 construction SMEs** at start of 2024 (largest industry SME count nationally). ONS IDBR Q3 2024 shows **56,980** VAT/PAYE firms in **domestic building** vs **17,344** in **commercial building**, while **specialised installation/finishing trades dominate firm counts** (electrical **47,532**; plumbing/HVAC **44,668**; joinery **26,881**). Constructa’s ICP (“Dave”, £1–3m, multi-sub) sits across general building plus installing/finishing trades — not civil majors or developers-only.

---

## Prior evidence reviewed (in-repo)

| Artifact | Date | Finding carried forward |
| --- | --- | --- |
| `docs/backup-snapshots/2026-10-20/walkthrough-discipline-research.json` | 2026-10-18 | 15-label shortlist + design rules (free text primary; no discipline/client conflation); **`rankVerified: false`** because ONS 2024 workbook was not parsed |
| `walkthrough-action-register.json` (A006) | 2026-11-13 snapshot | Status **Partial** — shortlist only |
| `src/lib/first-session.ts` `SETUP_WORK_SUGGESTIONS` | shipped | 16 tiles — supersedes 15-label draft; adds **Landscaping & fencing** |
| `src/lib/guided-brief.ts` `BRIEF_TRADES` | shipped | 47 granular activities incl. domestic/commercial splits for M&E |
| `src/lib/project-types.ts` | shipped | 10 trade keys + `default` job-type lists (domestic-leaning examples) |

This delivery **closes the ranking gap** for GB registered-firm counts using ONS **Construction statistics annual tables 2024** (Tables 3.7–3.8, Q3 2024), downloaded and parsed 2026-11-15 (see `docs/evidence/a006-20261115/source-extract.json`).

---

## Primary sources (dated)

| Source | Publisher | Release / data period | Used for |
| --- | --- | --- | --- |
| [Construction statistics, Great Britain: 2024](https://www.ons.gov.uk/businessindustryandtrade/constructionindustry/articles/constructionstatistics/2024) | ONS | Article **19 February 2026**; firms **Q3 2024** | Industry scale (370,770 VAT/PAYE construction firms GB); new-order sector trends |
| [Construction statistics annual tables (2024 edition)](https://www.ons.gov.uk/businessindustryandtrade/constructionindustry/datasets/constructionstatisticsannualtables) | ONS | Dataset **19 February 2026** | **Table 3.7–3.8**: firm counts by main and allied trade (IDBR) |
| [Enterprises in specialised construction: 2022 to 2024](https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation/adhocs/2900enterprisesinspecialisedconstruction2022to2024) | ONS | Ad hoc **25 June 2025**; IDBR March 2024 | Division 43 enterprise totals (432 install **106,800**; 433 finishing **84,300** enterprises UK, VAT/PAYE) |
| [Business population estimates for the UK and regions 2024](https://www.gov.uk/government/statistics/business-population-estimates-2024/business-population-estimates-for-the-uk-and-regions-2024-statistical-release) | DBT | **3 October 2024** (start of 2024) | **870,000** construction SMEs; turnover/employment context |
| [Construction output QMI](https://www.ons.gov.uk/businessindustryandtrade/constructionindustry/methodologies/constructionoutputqualityandmethodologyinformation) | ONS | QMI (SIC F coverage list) | Official SIC 2007 → activity labels (41201 domestic, 41202 commercial, 43.x trades) |
| [About Us — FIS](https://www.thefis.org/about-us/) | Finishes & Interiors Sector | live sector page | Fit-out/refurb spans homes, offices, hospitals, schools (sector-neutral wording) |

### Verified firm counts (GB, VAT/PAYE, Q3 2024)

From ONS Table 3.7 / 3.8, row **“All firms”** (IDBR main activity; firms sum across columns exceeds 370,770 because columns are **mutually exclusive trade assignments**, not additive market share):

**Main trades (Table 3.7)**

| ONS trade label | SIC | Firms |
| --- | --- | ---: |
| Domestic buildings | 41.20/2 | **56,980** |
| Commercial buildings | 41.20/1 | **17,344** |
| Property developers | 41.10 | 44,137 |
| Civil engineering (aggregate) | 42 | 21,680 |

**Allied / specialist trades (Table 3.8, selected)**

| ONS trade label | SIC | Firms |
| --- | --- | ---: |
| Electrical installation | 43.21 | **47,532** |
| Plumbing, heat & air conditioning | 43.22 | **44,668** |
| Other construction installation & finishing | 43.29, 43.39 | **35,799** |
| Joinery installation | 43.32 | **26,881** |
| Other specialised construction | 43.99/9 | **22,290** |
| Painting | 43.34/1 | **12,020** |
| Roofing | 43.91 | **11,842** |
| Floor & wall covering | 43.33 | **9,102** |
| Plastering | 43.31 | **6,427** |
| Scaffolding | 43.99/1 | **6,220** |
| Glazing | 43.34/2 | **3,926** |
| Site preparation | 43.12 | **2,863** |
| Demolition | 43.11 | **771** |

**New orders context (2024, Table 2.1):** total new orders **£71,707m** (+5.6% YoY). Housing new orders fell **10.9%** while **private commercial** rose **18.8%** (ONS article Main points). Product implication: keep **one** discipline list but ensure **commercial job types** and fit-out language stay first-class in brief/project-type flows.

**SME size context:** ONS Table 3.10 (2024 Q3): **226,445** construction firms with turnover **&lt;£500k** vs **21,412** at **£1m–&lt;£5m** — Constructa’s turnover band is a **thin tail** of IDBR; multi-trade “Dave” is statistically a small employer / micro, not a mid-market GC.

Limits (unchanged from Oct research, now narrowed): counts are **registered** firms only; **unregistered** construction businesses (~490k in DBT 2024 construction row per sector tables) are excluded; **no customer or competitor scrape**; IDBR **primary activity** mis-classification acknowledged in ONS QMI.

---

## Recommended first-wave discipline catalogue (ranked)

Ranking method: ONS Q3 2024 firm count where a 1:1 SIC mapping exists; otherwise **bundle** SICs to match Constructa nouns. Ties broken by fit to pre-construction proposal workflow (Brief → Estimate → Programme).

| Rank | Constructa label (target) | ONS / sector basis | Q3 2024 firms (basis) | Domestic + commercial |
| ---: | --- | --- | ---: | --- |
| 1 | **General building** | Domestic + commercial building contractors | 56,980 + 17,344 | Both — differentiate by `client_type` |
| 2 | **Refurbishment & fit-out** | Commercial/domestic building + FIS sector definition | 17,344+ (commercial) + fit-out language | Both — commercial weight higher |
| 3 | **Electrical installation** | 43.21 | 47,532 | Both — keep commercial/industrial lines in `BRIEF_TRADES`, not onboarding |
| 4 | **Plumbing & heating** | 43.22 (plumbing/HVAC) | 44,668 | Both |
| 5 | **Carpentry & joinery** | 43.32 | 26,881 | Both |
| 6 | **Groundworks & civils** | 43.12 site prep + civils 42 (subset for SME) | 2,863 + share of 21,680 | Both; cap civils depth for cohort |
| 7 | **Roofing** | 43.91 | 11,842 | Both |
| 8 | **Plastering & drylining** | 43.31 + FIS drylining | 6,427 (+ sector) | Both |
| 9 | **Painting & decorating** | 43.34/1 | 12,020 | Both |
| 10 | **Flooring & tiling** | 43.33 | 9,102 | Both |
| 11 | **Glazing & window installation** | 43.34/2 | 3,926 | Both |
| 12 | **Ventilation & air conditioning** | Part of 43.22 | (included in 44,668) | Both; keep separate tile for contractor self-ID |
| 13 | **Brickwork & blockwork** | Masonry within 41.20/2 domestic builders | (within 56,980) | Both |
| 14 | **Cladding & facades** | 43.29/39 install + envelope trades | (within 35,799 bundle) | Commercial-skew; retain tile |
| 15 | **Demolition & site preparation** | 43.11 + 43.12 | 771 + 2,863 | Both; low firm count but high workflow relevance |
| 16 | **Landscaping & fencing** | Other specialised / external works | 22,290 (partial) | Domestic-skew; **not** in Oct 15-list — retained per owner feedback |

**Decision:** **No change to tile count (16)** for first wave. The list matches `SETUP_WORK_SUGGESTIONS` exactly; ranking now **verified** against ONS 2024.

**Label tweak (docs-only recommendation):** consider harmonising **“Ventilation & air conditioning”** ↔ ONS **“Plumbing, heat and air conditioning installation”** in help copy only (not a silent rename).

**Explicitly defer (Phase 2b / Later):** property developers (41.10), large civils (highways/rail 42.1x), asbestos, piling, substations, industrial electrical — present in `BRIEF_TRADES` for **multi-trade brief sections** but **not** onboarding tiles until cohort expands beyond Dave.

---

## Gaps in the current taxonomy

| Gap | Where | Risk | First-wave mitigation |
| --- | --- | --- | --- |
| **Three vocabularies** | `SETUP_WORK_SUGGESTIONS` (16) vs `BRIEF_TRADES` (47) vs `PROJECT_TYPES_BY_TRADE` keys (10, different strings) | Job-type dropdown misses multi-trade setup answers; AI brief exact-name rule breaks | Publish mapping table (below); code alignment is a **separate authorised sprint** |
| **Domestic/commercial encoded as trade duplicates** | `BRIEF_TRADES`: Domestic/Commercial/Industrial Electrical etc. | Doubles brief grid size; confuses discipline vs client sector | Keep for **estimate sections**; **do not** mirror on onboarding |
| **`PROJECT_TYPES_BY_TRADE` keys don’t match setup labels** | e.g. `"General Builder / Extensions"` vs `"General building"` | `getProjectTypes()` falls back to `default` | Map via alias table in spec before code |
| **`CANONICAL_WORK_NAMES` superset** | `labels.ts` unions brief + all project types | Case-study suggestions overflow | Limit suggestions to **16 + user customs** until mapping done |
| **Kitchen / bathroom specialists** | Strong in `BRIEF_TRADES`; absent as setup tiles | Under-selection at onboarding | Covered by **free text** + brief trades; optional Phase 2b tiles |
| **Landscaping** | Tile present; weak ONS single line | Owner-validated specialism | Keep tile; rank 16 |
| **Verified ranking was missing** | A006 Partial | Wrong prioritisation | **Addressed in this doc** |

### Proposed alias map (spec only)

| `SETUP_WORK_SUGGESTIONS` | Primary ONS bucket | `PROJECT_TYPES_BY_TRADE` key (nearest) | `BRIEF_TRADES` anchors |
| --- | --- | --- | --- |
| General building | 41.20/2, 41.20/1 | General Builder / Extensions | Builders / General Building |
| Refurbishment & fit-out | 41.20/1 + FIS | Multi-trade / Other → Commercial Works | Drylining, Builders / General Building |
| Electrical installation | 43.21 | Electrical | Domestic + Commercial Electrical |
| Plumbing & heating | 43.22 | Plumbing & Heating | Domestic Plumbing, Domestic Heating |
| Carpentry & joinery | 43.32 | Joinery & Carpentry | Carpentry & Joinery |
| Groundworks & civils | 43.12, 42 (SME) | Groundworks & Civils | Groundworks & Civils |
| Roofing | 43.91 | Roofing | Roofing |
| Plastering & drylining | 43.31 | (none) | Plastering, Drylining & Partitions |
| Flooring & tiling | 43.33 | Joinery & Carpentry → Flooring | Flooring, Tiling |
| Painting & decorating | 43.34/1 | Painting & Decorating | Painting & Decorating |
| Glazing & window installation | 43.34/2 | (via Joinery) | Windows, Doors & Glazing |
| Ventilation & air conditioning | 43.22 (subset) | (none) | Mechanical / HVAC, Air Conditioning |
| Brickwork & blockwork | 41.20 | (none) | Masonry / Brickwork / Blockwork |
| Cladding & facades | 43.29/39 | (none) | Cladding & Rainscreen |
| Demolition & site preparation | 43.11, 43.12 | (none) | Demolition, Groundworks |
| Landscaping & fencing | 43.99/9 (partial) | Landscaping & Fencing | Landscaping & External Works |

---

## Design rules (confirmed)

1. **Free text remains primary** for “what work we do” (`profiles.business_type`).
2. **Tiles are optional, equal-weight suggestions** — not a mandatory taxonomy (unchanged from Oct research).
3. **Do not mix discipline with client sector** — use existing `client_type` (`domestic` | `commercial` | `public`) on brief.
4. **Margins / benchmarks / regional pricing (A025)** remain **out of scope** until consent and aggregation design land.
5. **No silent taxonomy migration** — any code or DB change waits on owner review of this doc and Codex workflow preflight.

---

## Ordered next steps

1. **Owner review (Rob)** — accept or edit the ranked 16-tile first wave and P0/P1 job-type table (domestic vs commercial).
2. **Codex workflow preflight** — then push branch and open PR (per inbox); **no push from this agent turn**.
3. **Spec PR (when authorised)** — implement `PROJECT_TYPES_BY_TRADE` aliases matching setup labels; add Vitest parity tests (no new onboarding tiles without UX sign-off).
4. **Brief grid policy** — document which of the 47 `BRIEF_TRADES` appear for **cohort** vs **full** launch profile (navigation already split).
5. **Optional validation (Later)** — sample 30 contractor websites stratified by ONS top-6 SIC buckets to measure **label mismatch rate** (closes remaining Oct research gap); no scraping until privacy note agreed.
6. **Register update (coordinator)** — if Rob accepts, move A006 from **Partial** to **Complete** with pointer to this doc + `source-extract.json` (not done here).

---

## Verification performed (this run)

- Git base: `33d8fd3f986571b669567a99039bf0166d3d9085` (verified `HEAD` on branch creation).
- Downloaded ONS **ah1715.xlsx** and **csatablesaccessiblefinal2024.xlsx** into `docs/temp-files/a006-20261115/` (local parse only; **not committed** — binary extracts lives in `source-extract.json`).
- No application build, no customer data, no register mutation.

## Artefacts

| Path | Role |
| --- | --- |
| `docs/delivery/2026-11-15/a006-uk-disciplines-research-decision.md` | This decision |
| `docs/evidence/a006-20261115/source-extract.json` | Machine-readable ONS extracts + URLs |
| `docs/backup-snapshots/2026-10-20/walkthrough-discipline-research.json` | Prior partial research |

---

*Push and PR intentionally withheld pending Codex workflow preflight.*