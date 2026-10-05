# Owner walkthrough: Phase 1 on your own phone and laptop

About 30 minutes. No developer tools and no database.

> Walkthrough status (5 October 2026): partially completed on laptop after
> mobile access difficulties. Release proof did not pass. See
> [OWNER-WALKTHROUGH-FINDINGS.md](./OWNER-WALKTHROUGH-FINDINGS.md) for the
> sanitised findings, blockers and retest scope.

**Before you start**

- Use the test link you are given for this release candidate. Do not use the
  live app: this walkthrough creates a made-up contractor and sends a made-up
  proposal.
- Use made-up details only. For the contractor account, use the reserved test
  address `walkthrough-051026-1@constructa.co`. The disposable Supabase
  project's hosted sign-up rejects RFC example domains and subdomains without
  mail records; this address has been verified against that project. Client
  email addresses can continue to end `@example.com`.
- Have your phone and a laptop. Do Part A on the phone.

**If anything differs from "You should see"**, stop at that step and send
back: the step number, a screenshot of the whole screen, the exact words of
any red or amber message, and which phone or browser you were using. Then
carry on if you can.

## Part A: on your phone (about 22 minutes)

| # | Do this | You should see |
| --- | --- | --- |
| 1 | Open the test link and add `/login` to the end. Tap **Sign up**. Enter `walkthrough-051026-1@constructa.co` and a password twice. Tap **Create account**. | A green message starting "Account created." |
| 2 | Tap **Sign in**, then sign in with the same email and password. | "Step 1 of 2" and "What kind of work do you do?" |
| 3 | Tap a trade, then **Save and continue**. Type a business name. Tap **Save and add your first job**. | "Add your first job". |
| 4 | Type a job name and a client name. Tap **Add more details** and type a client email ending `@example.com`. Tap **Create project and start the brief**. | "Job brief", with your job name under it. |
| 5 | Describe a job in a sentence. Tap **Tidy this up for me**. | A panel "From the assistant" marked "Suggestion · not applied". Your own sentence has not changed. |
| 6 | Tap **Apply**. | Your sentence changes to the suggested wording. The status near the top says "Unsaved". |
| 7 | Tap **Next** three times, then **Save and build the price**. | "Build the price". |
| 8 | Tap **Add the first price line**. Type what it is for and a price of `6500`. Tap **Save line**. | The line is listed. Total before VAT £6,500.00, VAT £1,300.00, total including VAT £7,800.00. |
| 9 | Tap **Add a price line**, then **Quantity and rate**. Quantity `18`, unit `m2`, rate `65`. Tap **Save line**. | Two lines. Total before VAT £7,670.00. |
| 10 | Tap **Advanced estimating**, then **+ Preliminaries**. Wait for the new row. Type a description, type `450` in the rate box, then tap somewhere else on the page. Tap **Advanced estimating** again to close it. | A third line reading "Preliminaries · 1 nr × £450.00". "Your price lines" is £8,120.00. No red message. |
| 11 | Tap **Price adjustments**. Overhead `10`, risk `7.5`, profit `12`. Tap **Save adjustments**. | Total before VAT **£10,754.13**, VAT **£2,150.83**, total including VAT **£12,904.96**. |
| 12 | Tap the **Proposal** tab at the top. | "2 things are needed before you can send": Programme and Payment stages are marked Missing. The price shown is £10,754.13. The Send button near the bottom is greyed out. |
| 13 | Tap **Open Programme**. Pick a start date that is a Monday. Type `3` for how long, in weeks. | "Finishes Friday …", the Friday of the third week. A one-bar timeline below. |
| 14 | Tap **Save programme**, then **Next: Proposal**. | "Saved", then "Review and send". |
| 15 | Find **Payment stages**. Tap **Add a payment stage** twice: "Deposit" `30`, and "Balance" `70`. Tap **Save draft**. | "Everything needed is in place". |
| 16 | Scroll to **What your client will see**. | A light, document-style page. Price including VAT £12,904.96, your start and finish dates, and it ends with "Confirm you have received this proposal". No overhead, risk or profit anywhere in it. |
| 17 | Scroll to **Send to your client**. | "Ask the client to confirm they have received it" is already chosen. There is no option to accept the proposal. |
| 18 | Tick **I have read the preview and it is right…** and tap **Send version 1**. | "Version 1 is published." and a "Private link for your client". It also says whether the email was sent; either answer is fine on the test link. |
| 19 | Tap **Copy the link**. Open a private (incognito) tab and paste it. | The proposal opens without signing in. You can read it without zooming or scrolling sideways. Price including VAT £12,904.96. |
| 20 | Tap **Download this proposal as a PDF**. | A PDF with the same price and dates. |
| 21 | Go back to the proposal page. Type a name and tap **Confirm receipt**. | "Receipt confirmed" and "Thank you, …". It says this is not acceptance and does not create a contract. |
| 22 | Return to the app and reload the page. Tap **Sent versions (1)**. | "Version 1" marked "Receipt confirmed", with "Response recorded … by" the name you typed. |
| 23 | Under **Send to your client**, choose **Ask the client whether they intend to go ahead**. Tick the box and tap **Send version 2**. Open the new link in a private tab. | "Tell us you intend to go ahead" and a button **I intend to proceed (not binding)**. Still no option to accept. |
| 24 | Type a name and tap **I intend to proceed (not binding)**. | "Intention to proceed recorded". |
| 25 | Tap the blue **C** at the top right of the app. | Your pipeline, with the job under "Proposal Sent" at £10,754. |

## Part B: on your laptop (about 8 minutes)

| # | Do this | You should see |
| --- | --- | --- |
| 26 | Open the test link with `/login` on the end and sign in with the same account. | Your pipeline with the job on it. |
| 27 | On the job, click **Proposal**. Without the mouse, press the Tab key repeatedly. | Each button, box and link is outlined in turn as you reach it. You can reach **Save draft** and the Send section. |
| 28 | Click **Full Dark Theme** at the bottom of the left-hand bar. Scroll to **What your client will see**. | The app turns dark. The client's document stays a light page. Click **Default Theme** to go back. |
| 29 | Click **Sent versions (2)**. | Version 2 "Intention to proceed (not binding)" and version 1 "Receipt confirmed". Nothing says "accepted". |
| 30 | In the address bar, replace everything after the site name with `/dashboard/projects/billing` and press Enter. | You are returned to the pipeline with a notice that the module is retained for a later release. |

## What this checks that the automated run cannot

- Real fingers on a real phone: the buttons are comfortable to press.
- A real PDF viewer on your phone.
- The real assistant's wording at step 5. The automated run uses a stand-in.
- Real email, if the test link is set up to send it.
