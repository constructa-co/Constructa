# Programme and cost screens

Author: Kimi K3.1 Pro High, D122 native task; R1 reviewed. Draft suggested wording, not yet applied to screens.

> **Status: proposed wording, not wired.** The D122 screens currently use their own interim wording. The notes at the end list where the current screens differ, so the copy can be applied in a later change without new checks, gates or maths.

## Check planned crew hours

This check compares priced labour hours with productive hours available from the programme’s workdays, shifts and planned operatives. When stages overlap, their hours are checked against the same available crew. Planned crew capacity is separate from the minimum paid gang cost.

Labels: Planned crew; Hours needed; Hours available; Shortfall.

Warning: “Planned crew hours are short by [hours]. Review crew allocation or the programme. This check does not guarantee the programme; it does not change crew sizes, dates, productivity or prices.”

Unknown: “Cannot check yet. Some crew, labour or calendar values are missing. Add the missing values before treating this check as complete.”

## Review hire dates

On-hire and planned off-hire can follow a selected programme stage’s start and finish. Show separately where applicable: On-hire date; Planned off-hire date; Supplier charging end date; Supplier notice date; Supplier collection date.

Hint: “Planned off-hire is not an off-hire request or supplier confirmation. No call, email, booking or cancellation has been made.”

Changed: “Programme changed — review the updated hire dates and cost preview. Saved costs have not been repriced automatically.”

Unknown terms: “Price unavailable. Add the supplier’s billing basis, minimum charge or notice terms. No price has been calculated using assumed terms.”

## Review cost changes

This version adds programme costs once to an estimate. Later changes remain pending review; saved costs are not automatically deleted or replaced.

Labels: Contract sum before; Contract sum after; Change in price. Where relevant, show the preliminaries percentage allowance that stops applying when Preliminaries are priced as lines; do not imply it changes on every preview.

“VAT and markup use the existing job inputs. This preview does not confirm that the estimate is commercially complete.”

Existing review acknowledgement: “I have reviewed the programme, hire dates and before-and-after cost figures.”

Suggested buttons: Review crew allocation; Review programme; Review hire dates; Preview cost changes; Apply reviewed costs.

No new mandatory checkbox or release approval is introduced by this note. Planned dates do not send instructions to suppliers.

## How this fits the current screens (Claude, D122)

- **Crew check.** The screens show hours needed, hours available and the shortfall for each short crew, with the dates and shifts affected, and list each stage shift that cannot be checked and why. “Cannot check yet” matches the current `cannot_check` / `partial` / `not_set` states. None of these is shown as a pass.
- **Hire dates.** The screens show the on-hire date, the planned off-hire date and the date the supplier charges to, each separately. There is **no separate notice date or collection date field**. The supplier’s rule shows as text under the charged-to date (for example “off-hire call, then 2 days’ notice” or “collected 3 days after”), and the charged-to date is the planned off-hire date plus those days. Showing notice or collection as their own dates would need no new maths, only display.
- **Unknown terms.** A hire with a missing or unsupported basis is refused, with its own reason, and is not priced.
- **Cost change.** The screens currently label the figures “Total before VAT now” and “After applying”, with the change in brackets. The current acknowledgement wording is “I have checked this change: the total before VAT goes from £X to £Y.” Replacing it with the reviewed wording above is a wording change only; the acknowledgement stays tied to the exact before and after figures.
- **Buttons.** There is one apply button (“Apply programme costs to the estimate”) and a link to the programme. The other suggested buttons would be links or anchors within the same panel, not new steps.
