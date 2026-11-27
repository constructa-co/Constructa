# BOQ import reconciliation and client export

Author: Kimi K3.1 Pro High, native D121 task, 28 Nov 2026; R1 reviewed. Draft suggested wording, not yet applied to screens. No new approval steps or runtime gates.

## Spreadsheet import

### Check your spreadsheet import

Constructa reads every spreadsheet tab and every row in each tab’s used range. Select the tabs containing the intended bill. Different views may repeat the same bill; repeated bills or rows are not deleted automatically. Each row is labelled item, continuation, heading, excluded, unresolved or blank. Excluded, hidden and unticked rows are listed for review.

A balanced row count means rows are accounted for; it does not confirm that all the right items and prices are included or that the estimate is ready. Check the amount used where quantity × rate differs from the source total.

Saved values only: Constructa does not run Excel formulas or macros. Fix or recalculate the original file in your spreadsheet app, save and re-upload if values are missing or out of date. PDF import is separate and reads up to ten pages; it may be partial.

Suggested buttons: Select bill tabs; Review excluded rows; Review unresolved rows; Review amount differences; Re-upload spreadsheet.

Existing unresolved-row checkbox: “I have reviewed and acknowledge the unresolved rows.” This does not clear other blockers.

Blocked messages:

- “Import blocked. Some spreadsheet content is malformed. Review the identified cells and re-upload the corrected file.”
- Proposed pending parser repair: “Import blocked. Some cells contain an Excel error or a numeric formula without a saved value. Fix or recalculate the original spreadsheet, save and re-upload it.”
- “Import blocked. Some text exceeds the import limit. Review the identified text; tender wording must not be silently shortened.”
- “Import blocked. This import exceeds 2,000 lines or 100 sections. Select the intended bill tabs or review how to split the bill into separate imports. Nothing has been silently truncated.”

## Client export

### Export a client BOQ

The client copy is a fresh workbook containing Ref, Description, Qty, Unit, all-in rate and Total, plus VAT from the job’s existing VAT treatment. It contains no internal cost build-ups, margin percentages, supplier notes, hidden sheets or private metadata. Its total must match the estimate’s contract sum to the penny (current browser estimate, not publication acceptance state).

Suggested refusal: “Export not created. The client total does not match the estimate’s contract sum to the penny. Review the figures and try again.”

Suggested buttons: “Download client workbook”; “Internal export — not for client”.

“Download only. Downloading does not send or publish the workbook, or constitute client acceptance.”

## Help

Check intended tabs, flagged rows and source-total differences. Before sending, check the downloaded client workbook. These are help suggestions, not extra mandatory approvals; client export also supports manually entered estimates.