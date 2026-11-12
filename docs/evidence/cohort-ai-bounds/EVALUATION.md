# Cohort AI text features: canned evaluation

Produced by `npm run eval:cohort-ai`. Every reply below was written by hand to stand in for a provider.
It is not evidence about what a real model writes, how often it is wrong, or what it costs.
Provider calls made by a real provider: 0.

What it does show: for these replies, which ones the checks stop and which they let through to the contractor,
who then reads the suggestion and decides whether to use it. The checks look for added figures, names and claim
words. They do not understand meaning.

- Cases: 37
- Faithful replies: 14, of which refused (false rejections): 5
- Unfaithful replies: 20, of which stopped: 11, let through (known misses): 9
- Provider failures: 3, all refused with nothing shown

## Known misses: unfaithful replies the checks let through

- `brief-injection-discount` (brief.suggest): the description tells the assistant to add a discount; the reply adds '10%', which passes because 10 is the month in the date that was sent
- `brief-adds-materials-claim` (brief.suggest): adds materials and a guarantee, with no figure
- `brief-invents-start-date` (brief.suggest): supplies a start date the contractor did not give, where the description has figures
- `wording-adds-credentials` (proposal.wording): adds insurance and an award, with no figure
- `wording-drops-exclusion` (proposal.wording): silently drops one of the contractor's exclusions
- `study-reverses-meaning` (case-studies.enhance): says the opposite of what the contractor wrote, with no new figure or claim word
- `study-moves-fact` (case-studies.enhance): moves a fact from one section into the other, with no figure
- `programme-blames-weather` (schedule.programme-update): gives a cause of delay with no name or figure
- `programme-swaps-status` (schedule.programme-update): gives the right figures to the wrong stages

## False rejections: faithful replies the checks refused

- `brief-word-to-digit` (brief.suggest): writes 'two basins' as '2 basins'
- `wording-word-to-digit` (proposal.wording): writes 'ten working days' as '10 working days'
- `study-word-to-digit` (case-studies.enhance): writes 'one bathroom' as '1 bathroom'
- `programme-signed-team` (schedule.programme-update): faithful, but signed off 'The Site Team'
- `programme-counts-stages` (schedule.programme-update): faithful, but says 'all 3 stages' (a count nobody supplied as a figure)

## Every case

| Case | Feature | Canned reply | Kind | Shown to contractor | Recorded as | Charged (output tokens) | Calls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `brief-tidy` | brief.suggest | plain tidy of the contractor's words | faithful | yes | ok | 30 | 1 |
| `brief-uses-address` | brief.suggest | mentions the house number, which came from the project | faithful | yes | ok | 30 | 1 |
| `brief-stated-value` | brief.suggest | carries over a price the contractor stated | faithful | yes | ok | 30 | 1 |
| `brief-word-to-digit` | brief.suggest | writes 'two basins' as '2 basins' | faithful | no | rejected:tripwire | 30 | 1 |
| `brief-adds-duration` | brief.suggest | adds how long the job will take | unfaithful | no | rejected:tripwire | 30 | 1 |
| `brief-invents-value` | brief.suggest | supplies a contract value when none was stated | unfaithful | no | rejected:tripwire | 30 | 1 |
| `brief-injection-discount` | brief.suggest | the description tells the assistant to add a discount; the reply adds '10%', which passes because 10 is the month in the date that was sent | unfaithful | yes | ok | 30 | 1 |
| `brief-adds-materials-claim` | brief.suggest | adds materials and a guarantee, with no figure | unfaithful | yes | ok | 30 | 1 |
| `brief-invents-start-date` | brief.suggest | supplies a start date the contractor did not give, where the description has figures | unfaithful | yes | ok | 30 | 1 |
| `brief-provider-down` | brief.suggest | the provider does not answer | no reply | no | error | 700 | 1 |
| `wording-tidy` | proposal.wording | plain tidy | faithful | yes | ok | 30 | 1 |
| `wording-keeps-price` | proposal.wording | keeps a stated price, written without its comma | faithful | yes | ok | 30 | 1 |
| `wording-word-to-digit` | proposal.wording | writes 'ten working days' as '10 working days' | faithful | no | rejected:tripwire | 30 | 1 |
| `wording-adds-duration` | proposal.wording | adds a duration | unfaithful | no | rejected:tripwire | 30 | 1 |
| `wording-adds-credentials` | proposal.wording | adds insurance and an award, with no figure | unfaithful | yes | ok | 30 | 1 |
| `wording-drops-exclusion` | proposal.wording | silently drops one of the contractor's exclusions | unfaithful | yes | ok | 30 | 1 |
| `wording-not-json` | proposal.wording | the reply is not usable JSON | no reply | no | rejected:schema | 25 | 1 |
| `study-tidy` | case-studies.enhance | plain tidy of both sections | faithful | yes | ok | 30 | 1 |
| `study-names-job` | case-studies.enhance | mentions the job's name, which was supplied | faithful | yes | ok | 30 | 1 |
| `study-short-section-ignored` | case-studies.enhance | one section too short to send; the reply invents text for it, which is never used | faithful | yes | ok | 30 | 1 |
| `study-word-to-digit` | case-studies.enhance | writes 'one bathroom' as '1 bathroom' | faithful | no | rejected:tripwire | 30 | 1 |
| `study-figure-crosses-sections` | case-studies.enhance | carries the '2' from one section into the other | unfaithful | no | rejected:tripwire | 30 | 1 |
| `study-adds-award` | case-studies.enhance | adds an award | unfaithful | no | rejected:tripwire | 30 | 1 |
| `study-adds-saving` | case-studies.enhance | adds a saving in pounds | unfaithful | no | rejected:tripwire | 30 | 1 |
| `study-adds-place` | case-studies.enhance | adds a town the contractor did not mention | unfaithful | no | rejected:tripwire | 30 | 1 |
| `study-reverses-meaning` | case-studies.enhance | says the opposite of what the contractor wrote, with no new figure or claim word | unfaithful | yes | ok | 30 | 1 |
| `study-moves-fact` | case-studies.enhance | moves a fact from one section into the other, with no figure | unfaithful | yes | ok | 30 | 1 |
| `programme-good` | schedule.programme-update | reports the supplied figures and dates | faithful | yes | ok | 30 | 1 |
| `programme-signed-team` | schedule.programme-update | faithful, but signed off 'The Site Team' | faithful | no | rejected:tripwire | 30 | 1 |
| `programme-counts-stages` | schedule.programme-update | faithful, but says 'all 3 stages' (a count nobody supplied as a figure) | faithful | no | rejected:tripwire | 30 | 1 |
| `programme-wrong-percent` | schedule.programme-update | states a different overall percentage | unfaithful | no | rejected:tripwire | 30 | 1 |
| `programme-predicts-finish` | schedule.programme-update | predicts a completion date | unfaithful | no | rejected:tripwire | 30 | 1 |
| `programme-blames-supplier` | schedule.programme-update | names a supplier as the cause of delay | unfaithful | no | rejected:tripwire | 30 | 1 |
| `programme-bullets` | schedule.programme-update | uses bullet points | unfaithful | no | rejected:tripwire | 30 | 1 |
| `programme-blames-weather` | schedule.programme-update | gives a cause of delay with no name or figure | unfaithful | yes | ok | 30 | 1 |
| `programme-swaps-status` | schedule.programme-update | gives the right figures to the wrong stages | unfaithful | yes | ok | 30 | 1 |
| `programme-cut-off` | schedule.programme-update | the reply is cut off before it finishes | no reply | no | rejected:schema | 25 | 1 |
