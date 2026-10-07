# Owner retest: the Stage 2F blockers, on your phone and laptop

About 20 minutes. No developer tools and no database. This repeats the part
of the 5 October walkthrough that did not pass, after the repairs in
[README.md](README.md).

**If anything differs from "You should see"**, stop at that step and send
back: the step number, a screenshot of the whole screen, the exact words of
any red or amber message, and which phone or browser you were using.

## Before you start

- Use the new test link you are given for this release candidate, never the
  live app. Whoever prepares the link follows "Preparing the test link" at
  the end of this page first.
- Use made-up details only. Sign in with the same test account as last time,
  `walkthrough-051026-1@constructa.co`. Client email addresses end
  `@example.com`.
- Do Part A on your phone.

## Part A: on your phone (about 16 minutes)

| # | Do this | You should see |
| --- | --- | --- |
| 1 | Open the test link with `/login` on the end and sign in. | Your pipeline, with the job from last time. |
| 2 | Tap the menu (three lines, top left), then **New Project**. Type a job name and a client name. Tap **Create project and start the brief**. | "Job brief", with your job name under it. |
| 3 | Describe the job in a sentence. Tap **Next** three times, then **Save and build the price**. Tap **Add the first price line**, type what it is for and a price of `6500`, and tap **Save line**. | Total before VAT £6,500.00, VAT £1,300.00, total including VAT £7,800.00. |
| 4 | Tap the **Proposal** tab. Scroll to **Send to your client** at the bottom. | An amber box: "You can't send yet. 2 things are still needed." It names **Programme** and **Payment stages**, each with its own button or link. The tick box and **Send version 1** are greyed out. |
| 5 | In that amber box, tap **Open Programme**. | The Programme screen for this job. Nothing filled in. |
| 6 | Tap **Detailed programme planner** to open it. Read the amber note. Tap **Detailed programme planner** again to close it. | The note says the stages are "a starting point" and "are not saved". After closing, "Start on site" and "How long it takes" are still empty and the status says "Nothing to save yet". This is the step that used to put a "General" stage on your proposal. |
| 7 | Pick a start date that is a Monday. Tap **Break the job into stages**. Fill in three: "Strip out", `3`, working days; "First fix", `2`, weeks; "Finish", `4`, working days. | "Finishes Tuesday …", three weeks and a day after your Monday. Three bars under "How it looks on the proposal", with your three names. |
| 8 | Without saving, tap **Detailed programme planner**. | An amber message: "Save your programme first." The planner does not open and your three stages are still there. |
| 9 | Tap **Save programme**. Then reload the page. | "Saved". After the reload, the same three stages with the same lengths. |
| 10 | Tap **Next: Proposal** and scroll to **Send to your client**. | "You can't send yet. 1 thing is still needed." Only **Payment stages** is left. |
| 11 | In the amber box, tap **Use a deposit and balance**. | The amber box goes at once. The tick box can now be ticked. At the top of the page: "Everything needed is in place". |
| 12 | Scroll up to **Payment stages**. Change **Deposit (%)** to `25`. | "Deposit and balance" is chosen. "The balance is 75%, due on completion." Under "Your client will see": Deposit £1,625.00 and Balance £4,875.00, before VAT. You did not work anything out. |
| 13 | Scroll to **What your client will see**. | Under "Programme": your three stage names, in your order, each with its own dates. No stage called "General". The payment stages and amounts from step 12. |
| 14 | Tap **Download this draft as a PDF**. Open it. | A PDF with "DRAFT PREVIEW - NOT SENT TO THE CLIENT" on every page, the same three stages and dates, the same price and payment stages. Near the end: "Check code" and eight letters and numbers. Back in the app: "Nothing has been sent." |
| 15 | Scroll to **Send to your client**. Tick **I have read the preview and it is right…** and tap **Send version 1**. | "Version 1 is published. It is the proposal you checked: check code …" showing the same code as the PDF from step 14. |
| 16 | Tap **Copy the link**. Open a private (incognito) tab and paste it. | The proposal opens without signing in: the three stages with their dates, the payment stages, price including VAT £7,800.00. It ends with "Confirm you have received this proposal". No option to accept. |
| 17 | Tap **Download this proposal as a PDF**. | The same document as step 14, without the draft marking. |
| 18 | Type a name and tap **Confirm receipt**. Go back to the app, reload, and tap **Sent versions (1)**. | "Receipt confirmed" on the client's page, and "Version 1 … Receipt confirmed" in the app. |
| 19 | Under **Send to your client**, choose **Ask the client whether they intend to go ahead**. Tick the box and tap **Send version 2**. Open the new link in a private tab, type a name and tap **I intend to proceed (not binding)**. | "Intention to proceed recorded". Still no option to accept. |
| 20 | Tap the blue **C** at the top right. | Your pipeline, with the new job under "Proposal Sent" at £6,500. |

## Part B: on your laptop (about 4 minutes)

| # | Do this | You should see |
| --- | --- | --- |
| 21 | Sign in with the same account. Create one more job as in steps 2 and 3, then open its **Proposal** tab. | The amber "You can't send yet" box beside the greyed-out Send button. |
| 22 | Without the mouse, press Tab until you reach the amber box. Press Enter on **Use payment on completion**. | Each button and link is outlined as you reach it. After Enter, "Payment stages" leaves the amber box, which now lists only Programme and is itself outlined, so the keyboard is never left with nothing selected. |
| 23 | Still with the keyboard, Tab back up to **Payment stages** and use the arrow keys on the three choices. | "Payment on completion", "Deposit and balance" and "Custom stages" can each be chosen with the arrow keys. "Custom stages" opens the stage boxes to fill in yourself. |

## What this checks that the automated run cannot

- Real fingers on a real phone, and signing in on it.
- A real PDF viewer on your phone, for both the draft and the sent PDF.
- That the three stages and the payment wording read correctly to you.

## Preparing the test link

For whoever deploys the preview, before the owner starts:

1. In Vercel, for the Preview environment (or this branch only), the three
   Supabase variables must be the disposable project's, and
   `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF` must be set to that project's
   reference. Without it the preview now refuses to build.
2. In the build log, find these two lines and check both end `PASS` and name
   the disposable project, not production:

   ```
   Supabase target check: context=preview (from VERCEL_ENV) expected=… url=… anon-key=… service-key=… -> PASS
   Compiled Supabase target: context=preview (from VERCEL_ENV) expected=… projects in build=… -> PASS
   ```

3. If the second line is missing, the project's build command is not
   `npm run build`. The first check still ran; restore the default build
   command so the compiled-build check runs too.
