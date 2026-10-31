PASS — focused execution evidence on frozen source at `319ce9d`; no source/test edits; no baseline RED run (not fabricated).

# CQ-2216 A038 focused verification

Checker: grade this report and the pinned files at HEAD below. Do not treat `docs/reviews/cq-2210-a038-photo-compatibility.md` as execution evidence; it remains the prior FAIL static handoff.

## Pin

| Field | Value |
| --- | --- |
| Worktree | `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0431-a038-upload-outcomes` |
| Branch | `cq/cq-2210-a038-photo-compatibility` |
| HEAD | `319ce9d9dab5d55506f164dd13b6841c6ee066d3` |
| Parent (from prior review) | `24b9dcd` — not re-run for RED; no checkout of parent performed |
| Node binary | `/usr/local/bin/node` |
| Node version | `v24.19.0` |
| ROOT `node_modules` | `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules` |
| Vitest | `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs` (v5.0.2) |
| ESLint | `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/eslint/bin/eslint.js` |
| TypeScript | `/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/typescript/bin/tsc` |
| Temp | `TMPDIR=/tmp` (session `TMPDIR` pointed at a non-writable path; see limitations) |
| Config | Existing `vitest.config.mts` and `tsconfig.json` in worktree; no config edits |

## SHA256 — before and after (identical; no file edits)

| Path | SHA256 before | SHA256 after |
| --- | --- | --- |
| `docs/reviews/cq-2210-a038-photo-compatibility.md` | `e80516574dc9edc82ac7a18bc2cd567e16834574c7f7a66ccd80c7837dac0f9f` | `e80516574dc9edc82ac7a18bc2cd567e16834574c7f7a66ccd80c7837dac0f9f` |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | `816206cbf07da377a6232b08a19d4c42cccb8a2a392b4b7e0e3b3870729b2e06` | `816206cbf07da377a6232b08a19d4c42cccb8a2a392b4b7e0e3b3870729b2e06` |
| `src/app/dashboard/settings/case-studies/library-panel.tsx` | `051d2d9403fabeb6a5f8a13df154bc1caf755a8c84053d5634c77e6e9a799413` | `051d2d9403fabeb6a5f8a13df154bc1caf755a8c84053d5634c77e6e9a799413` |
| `src/app/dashboard/settings/case-studies/library/guided-capture.tsx` | `4d48007ddd882fe40a8119ce35febb07f8528c3633f7053af9aa6d8306dad8aa` | `4d48007ddd882fe40a8119ce35febb07f8528c3633f7053af9aa6d8306dad8aa` |
| `src/lib/case-library/messages.ts` | `b9d93f9c1dc13783d00bce09cdf0b02e648dd2520065b6665538b0ac0c788ad5` | `b9d93f9c1dc13783d00bce09cdf0b02e648dd2520065b6665538b0ac0c788ad5` |
| `src/lib/case-library/past-jobs.ts` | `ac2d2a7016e133a1b1f299be1ea25c0ee82959bcbbacc855dc11dfd243ed53b9` | `ac2d2a7016e133a1b1f299be1ea25c0ee82959bcbbacc855dc11dfd243ed53b9` |
| `src/lib/case-library/photo-compatibility.test.ts` | `025849da12fa1d45fff26da996cfa3b5c9f3cd4ffb6261f44ae9f5df20f19a8e` | `025849da12fa1d45fff26da996cfa3b5c9f3cd4ffb6261f44ae9f5df20f19a8e` |
| `src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx` | `dce1af93f3328e8c5df28be43722d955a4b88a98487d0aeb1a17035a43b2b510` | `dce1af93f3328e8c5df28be43722d955a4b88a98487d0aeb1a17035a43b2b510` |
| `src/app/dashboard/settings/case-studies/photo-accessibility.test.tsx` | `3529a64959ece70b89e1dd1559b0e3f743ad7f6966752996f0e58b573912123f` | `3529a64959ece70b89e1dd1559b0e3f743ad7f6966752996f0e58b573912123f` |
| `src/app/dashboard/settings/case-studies/library-screens.test.ts` | `ab611f01b7a47fa7d85aad4b1f278a630f719bc7abb05f9e2e5c6199759675d4` | `ab611f01b7a47fa7d85aad4b1f278a630f719bc7abb05f9e2e5c6199759675d4` |

This file (`docs/reviews/cq-2216-a038-focused-verification.md`) is new evidence only; hashes above exclude it.

## Scope executed

- Vitest: **only** the four materially changed test files (48 tests retained in those files).
- ESLint: **only** the five changed production paths.
- TypeScript: full project `tsc --noEmit` via ROOT (dependencies resolvable).
- Not run: Next build, baseline RED at `24b9dcd`, full old suite lists from cq-2210 doc, live upload/storage/DB/auth/browser.

## 1. Vitest (authoritative run)

**cwd:** `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0431-a038-upload-outcomes`

**argv:**

```text
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run src/lib/case-library/photo-compatibility.test.ts src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx src/app/dashboard/settings/case-studies/photo-accessibility.test.tsx src/app/dashboard/settings/case-studies/library-screens.test.ts --reporter=verbose
```

**env:** `TMPDIR=/tmp`

**exit code:** `0`

**stdout (raw):**

```text

 RUN  v5.0.2 /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0431-a038-upload-outcomes

 ✓ src/lib/case-library/photo-compatibility.test.ts > a new version chosen in place of an older job with pictures > says the proposal goes out without them, how many the older one has, and what to do 4ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > a new version chosen in place of an older job with pictures > counts only pictures a proposal could really show 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > a new version chosen in place of an older job with pictures > says nothing when the older job has no usable pictures 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > a new version chosen in place of an older job with pictures > says nothing when the older job is ticked too, which already has its own note 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > a new version chosen in place of an older job with pictures > says nothing when the new version is not ticked 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > a new version chosen in place of an older job with pictures > says nothing for a library job that was not started from an older one 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > a new version chosen in place of an older job with pictures > says nothing once the approved copy itself carries a picture 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > a new version chosen in place of an older job with pictures > never moves an older job's pictures onto the library job 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > what the library says about photos > points to where photos can be kept today, and promises nothing on the full form 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > what the library says about photos > returns to the full form only when the wire carries photos 0ms
 ✓ src/lib/case-library/photo-compatibility.test.ts > what the library says about photos > a refused picture keeps the wording safe and says where pictures can go 0ms
 ✓ src/app/dashboard/settings/case-studies/photo-accessibility.test.tsx > past-work photo input accessibility > keeps three natively focusable inputs with distinct slot and example names 7ms
 ✓ src/app/dashboard/settings/case-studies/photo-accessibility.test.tsx > past-work photo input accessibility > names replacement separately without activating an upload or changing the image 3ms
 ✓ src/app/dashboard/settings/case-studies/photo-accessibility.test.tsx > past-work photo input accessibility > names a remove control only for a slot that holds a photo, outside the replace label 3ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > a photo reply lands on the example it was picked for > follows its example when an earlier one is removed while it uploads 17ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > a photo reply lands on the example it was picked for > is discarded, and says so, when its example was removed 7ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > a photo reply lands on the example it was picked for > tells apart stored examples that have no id or share one 11ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > a photo reply lands on the example it was picked for > keeps its place for an example added after the page loaded 7ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > photos and text changed while an upload runs > keeps both of two slots however they return (first back: 0) 5ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > photos and text changed while an upload runs > keeps both of two slots however they return (first back: 1) 4ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > photos and text changed while an upload runs > keeps a photo already on the example and the latest text 2ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > photos and text changed while an upload runs > lets the latest pick for one slot stand when the older reply comes last 4ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > photos and text changed while an upload runs > does not fill a slot from an older pick when the latest pick failed 4ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > an upload that fails > settles and reports a thrown transport failure, changing nothing and sending once 2ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > an upload that fails > reports a returned failure and sends once: {"error":"That image is too large."} 2ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > an upload that fails > reports a returned failure and sends once: {} 2ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > an upload that fails > still reports a thrown failure on a removed example without touching the others 4ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > taking a photo off an older example > clears only that slot, keeps the others in place, and is unsaved until saved 2ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > taking a photo off an older example > offers the upload for that slot again 2ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > taking a photo off an older example > does not let a replacement already on its way put a picture back in that slot 2ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > taking a photo off an older example > leaves a reply for another slot alone 1ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > what stays as it was > leaves the save rules alone: a save already sent keeps its copy, and a late photo is unsaved 6ms
 ✓ src/app/dashboard/settings/case-studies/photo-upload-outcomes.test.tsx > what stays as it was > keeps the held paths switched off 0ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the library list > unavailable is said plainly and is never shown as an empty library 5ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the library list > says what each case study's state is, in words 3ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the library list > offers a new version only for older case studies that do not have one, and claims nothing about their pictures 1ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the library list > does not promise photos on the full form, and says pictures stay on the older one 1ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the editor > a new case study asks only for the job, with client and price closed and off 5ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the editor > every field has a visible label tied to it 4ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the questions > a new one opens on the job name alone, with the full form one press away and nothing claimed as saved 3ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the questions > an existing one opens on what is saved, says what is not remembered, and shows consent as it stands 1ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the questions > the optional questions are offered from what is saved, never as part of the six, and say whose words they are 2ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the questions > an approved one says proposals keep the approved version, and offers no approval here 6ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the ways in to the questions > the list offers them beside the full form 8ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the ways in to the questions > the full form links to them only when it is told where they are 37ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > what would be approved > is drawn from the approved copy alone, under the proposal's headings 1ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the library's part of the review screen > renders nothing at all for a proposal with no library, no problem and no note, so the older list is as it was 0ms
 ✓ src/app/dashboard/settings/case-studies/library-screens.test.ts > the library's part of the review screen > a ticked case study that cannot be sent is shown with why and a way to untick it 1ms

 Test Files  4 passed (4)
      Tests  48 passed (48)
   Start at  22:18:09
   Duration  725ms (transform 54%, import 33%, tests 12%, worker 1%)

```

## 2. ESLint (five production paths)

**argv:**

```text
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/eslint/bin/eslint.js src/app/dashboard/settings/case-studies/case-studies-client.tsx src/app/dashboard/settings/case-studies/library-panel.tsx src/app/dashboard/settings/case-studies/library/guided-capture.tsx src/lib/case-library/messages.ts src/lib/case-library/past-jobs.ts
```

**exit code:** `0`

**stdout (raw):**

```text

/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0431-a038-upload-outcomes/src/app/dashboard/settings/case-studies/case-studies-client.tsx
   6:65  warning  'MapPin' is defined but never used         @typescript-eslint/no-unused-vars
   6:84  warning  'Calendar' is defined but never used       @typescript-eslint/no-unused-vars
   6:94  warning  'PoundSterling' is defined but never used  @typescript-eslint/no-unused-vars
  49:65  warning  'userId' is defined but never used         @typescript-eslint/no-unused-vars

✖ 4 problems (0 errors, 4 warnings)

```

## 3. TypeScript

**argv:**

```text
/usr/local/bin/node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/typescript/bin/tsc --noEmit
```

**cwd:** worktree (same as above)

**exit code:** `0`

**stdout:** *(empty)*

**stderr:** *(empty)*

## Failures

None in the executed commands above. No assertion failures.

## Limitations (not green claims)

1. **No baseline RED** at parent `24b9dcd` — intentionally not run; would require checkout of parent against current tests; not fabricated.
2. **Prior probe (not counted as pass):** one Vitest invocation with session `TMPDIR` failed (`mkdir: … Operation not permitted`) and Vitest v5 rejected deprecated `--cache.dir`; authoritative run used `TMPDIR=/tmp` only.
3. **ESLint warnings** on pre-existing unused imports/`userId` in `case-studies-client.tsx`; exit code still 0.
4. **Hosted / integration** gaps listed in cq-2210 review (migrations applied state, real upload, PDF) remain unproven here.
5. **Worktree `node_modules`:** vitest/vite symlinks only; resolution uses ROOT packages; no new symlinks were required for this run.

## Grok / static audit

Independent Grok grading of source was out of scope for this runner; this document is execution evidence only.
