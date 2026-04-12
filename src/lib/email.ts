import { Resend } from "resend";

// Initialise once — safe to call at module level (server only)
const resend = new Resend(process.env.RESEND_API_KEY);

// Sender address — switch to a verified domain address once constructa.co
// is verified in the Resend dashboard (Domains → Add Domain).
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendProposalEmailArgs {
    clientEmail: string;
    clientName: string;
    projectName: string;
    proposalUrl: string;
    companyName: string;
    siteAddress?: string;
}

interface AcceptanceConfirmationArgs {
    clientEmail: string;
    clientName: string;
    projectName: string;
    companyName: string;
    refCode: string;
    siteAddress?: string;
}

interface ContractorNotificationArgs {
    contractorEmail: string;
    clientName: string;
    projectName: string;
    projectValue?: number;
    refCode: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Email: Contractor sends proposal to client ───────────────────────────────

export async function sendProposalEmail({
    clientEmail,
    clientName,
    projectName,
    proposalUrl,
    companyName,
    siteAddress,
}: SendProposalEmailArgs) {
    return resend.emails.send({
        from: FROM,
        to: clientEmail,
        subject: `Your Proposal — ${projectName}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
    <tr>
      <td style="background:#0d0d0d; padding:28px 32px;">
        <p style="color:#ffffff; font-size:22px; font-weight:700; margin:0;">${companyName}</p>
        <p style="color:#9ca3af; font-size:13px; margin:4px 0 0;">Proposal</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="color:#111827; font-size:16px; margin:0 0 16px;">Dear ${clientName},</p>
        <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
          Thank you for the opportunity to work with you. Please find your proposal for
          <strong>${projectName}</strong>${siteAddress ? ` at ${siteAddress}` : ""} via the link below.
        </p>
        <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 24px;">
          You can review the full scope of works, pricing, programme, and terms — and confirm your acceptance directly through the proposal.
        </p>
        <a href="${proposalUrl}" style="display:inline-block; background:#0d0d0d; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:14px 28px; border-radius:8px;">
          View Your Proposal →
        </a>
        <p style="color:#6b7280; font-size:13px; margin:24px 0 0;">
          Or copy this link: <a href="${proposalUrl}" style="color:#2563eb;">${proposalUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">
          This proposal was sent via Constructa. If you have any questions, please contact ${companyName} directly.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

// ─── Email: Client receives acceptance confirmation ───────────────────────────

export async function sendAcceptanceConfirmationEmail({
    clientEmail,
    clientName,
    projectName,
    companyName,
    refCode,
    siteAddress,
}: AcceptanceConfirmationArgs) {
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    return resend.emails.send({
        from: FROM,
        to: clientEmail,
        subject: `Acceptance Confirmed — ${projectName}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
    <tr>
      <td style="background:#16a34a; padding:28px 32px;">
        <p style="color:#ffffff; font-size:22px; font-weight:700; margin:0;">✓ Proposal Accepted</p>
        <p style="color:#bbf7d0; font-size:13px; margin:4px 0 0;">${date} · Ref: ${refCode}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="color:#111827; font-size:16px; margin:0 0 16px;">Dear ${clientName},</p>
        <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
          Thank you for accepting the proposal for <strong>${projectName}</strong>${siteAddress ? ` at ${siteAddress}` : ""}.
          This email confirms your acceptance on <strong>${date}</strong>.
        </p>
        <table style="width:100%; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin:0 0 16px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 12px; color:#6b7280; font-size:13px;">Project</td>
            <td style="padding:6px 12px; color:#111827; font-size:13px; font-weight:600;">${projectName}</td>
          </tr>
          ${siteAddress ? `<tr>
            <td style="padding:6px 12px; color:#6b7280; font-size:13px;">Site</td>
            <td style="padding:6px 12px; color:#111827; font-size:13px;">${siteAddress}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:6px 12px; color:#6b7280; font-size:13px;">Contractor</td>
            <td style="padding:6px 12px; color:#111827; font-size:13px; font-weight:600;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; color:#6b7280; font-size:13px;">Reference</td>
            <td style="padding:6px 12px; color:#111827; font-size:13px; font-family:monospace;">${refCode}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; color:#6b7280; font-size:13px;">Date</td>
            <td style="padding:6px 12px; color:#111827; font-size:13px;">${date}</td>
          </tr>
        </table>
        <p style="color:#374151; font-size:14px; line-height:1.6; margin:0;">
          ${companyName} will be in touch shortly to confirm the next steps. Please keep this email as your confirmation record.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">
          This confirmation was generated via Constructa.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

// ─── Email: Contractor notified when client views proposal ───────────────────

interface ContractorViewedArgs {
    contractorEmail: string;
    clientName: string;
    projectName: string;
    proposalUrl: string;
}

export async function sendContractorViewedNotification({
    contractorEmail,
    clientName,
    projectName,
    proposalUrl,
}: ContractorViewedArgs) {
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    return resend.emails.send({
        from: FROM,
        to: contractorEmail,
        subject: `👀 ${clientName} just opened your proposal — ${projectName}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
    <tr>
      <td style="background:#1e3a5f; padding:28px 32px;">
        <p style="color:#ffffff; font-size:22px; font-weight:700; margin:0;">👀 Proposal Viewed</p>
        <p style="color:#93c5fd; font-size:13px; margin:4px 0 0;">${date} at ${time}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="color:#111827; font-size:16px; margin:0 0 12px;"><strong>${clientName}</strong> has just opened your proposal for <strong>${projectName}</strong>.</p>
        <p style="color:#374151; font-size:14px; line-height:1.6; margin:0 0 24px;">
          Now is a great time to follow up — they're actively reviewing your proposal right now.
        </p>
        <a href="${proposalUrl}" style="display:inline-block; background:#1e3a5f; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; padding:12px 24px; border-radius:8px;">
          View Proposal →
        </a>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">Constructa — smart proposals for construction contractors.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

// ─── Email: Welcome email to new users on signup ─────────────────────────────

interface WelcomeEmailArgs {
    contractorEmail: string;
    fullName?: string;
    companyName: string;
    dashboardUrl: string;
}

export async function sendWelcomeEmail({
    contractorEmail,
    fullName,
    companyName,
    dashboardUrl,
}: WelcomeEmailArgs) {
    const greeting = fullName ? `Hi ${fullName.split(" ")[0]},` : "Welcome,";
    return resend.emails.send({
        from: FROM,
        to: contractorEmail,
        subject: `Welcome to Constructa, ${companyName} 🎉`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
    <tr>
      <td style="background:#0d0d0d; padding:28px 32px;">
        <p style="color:#ffffff; font-size:24px; font-weight:700; margin:0;">Welcome to Constructa 🎉</p>
        <p style="color:#9ca3af; font-size:13px; margin:4px 0 0;">Smart proposals for construction contractors</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="color:#111827; font-size:16px; margin:0 0 16px;">${greeting}</p>
        <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 20px;">
          Your Constructa account for <strong>${companyName}</strong> is all set up and ready to go. Here's what to do next:
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 24px;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid #f3f4f6;">
              <span style="color:#2563eb; font-weight:700; font-size:15px;">1.</span>
              <span style="color:#111827; font-size:14px; margin-left:10px;"><strong>Create your first project</strong> — add a client, site address and project value</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid #f3f4f6;">
              <span style="color:#2563eb; font-weight:700; font-size:15px;">2.</span>
              <span style="color:#111827; font-size:14px; margin-left:10px;"><strong>Build your estimate</strong> — our cost library has 833 line items ready to use</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid #f3f4f6;">
              <span style="color:#2563eb; font-weight:700; font-size:15px;">3.</span>
              <span style="color:#111827; font-size:14px; margin-left:10px;"><strong>Generate your proposal</strong> — professional PDF sent to the client with one click</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <span style="color:#2563eb; font-weight:700; font-size:15px;">4.</span>
              <span style="color:#111827; font-size:14px; margin-left:10px;"><strong>Get notified</strong> when the client views and accepts</span>
            </td>
          </tr>
        </table>
        <a href="${dashboardUrl}" style="display:inline-block; background:#0d0d0d; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:14px 28px; border-radius:8px;">
          Go to Dashboard →
        </a>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">
          If you have any questions, reply to this email — we're happy to help.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

// ─── Email: Contract alert digest (Sprint 59) ─────────────────────────────────
//
// Daily digest of imminent contract time bars and overdue / due-soon
// obligations across all of the contractor's projects. Sent by the
// /api/cron/contract-alerts endpoint when the contractor has at least
// one item in the warning window. Idempotent — see
// `contract_alert_notifications` table for the cadence rules.

export interface ContractAlertDigestItem {
    type: "time_bar_warning" | "obligation_overdue" | "obligation_due_soon";
    /** "CE-004" / "Programme submission" */
    title: string;
    /** Short description shown under the title */
    detail?: string;
    /** Project name for context — e.g. "22 Birchwood Avenue" */
    projectName: string;
    /** Project id used to deep-link */
    projectId: string;
    /** Days remaining (negative = overdue) */
    daysRemaining: number;
    /** Optional clause reference — e.g. "61.3" */
    clauseRef?: string;
}

interface ContractAlertEmailArgs {
    contractorEmail: string;
    contractorName?: string;
    companyName: string;
    items: ContractAlertDigestItem[];
    dashboardUrl: string;
}

function urgencyPhrase(days: number): { label: string; tone: "red" | "amber" } {
    if (days < 0)   return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} OVERDUE`, tone: "red" };
    if (days === 0) return { label: "EXPIRES TODAY", tone: "red" };
    if (days === 1) return { label: "1 day left", tone: "red" };
    if (days <= 3)  return { label: `${days} days left`, tone: "red" };
    return { label: `${days} days`, tone: "amber" };
}

function alertTypeLabel(type: ContractAlertDigestItem["type"]): string {
    switch (type) {
        case "time_bar_warning":    return "Contract Time Bar";
        case "obligation_overdue":  return "Overdue Obligation";
        case "obligation_due_soon": return "Obligation Due";
    }
}

export async function sendContractAlertEmail({
    contractorEmail,
    contractorName,
    companyName,
    items,
    dashboardUrl,
}: ContractAlertEmailArgs) {
    if (items.length === 0) return null;

    const greeting = contractorName ? `Hi ${contractorName.split(" ")[0]},` : "Good morning,";

    // Sort: red urgency first, then ascending daysRemaining (most urgent at top).
    const sorted = [...items].sort((a, b) => {
        const ua = urgencyPhrase(a.daysRemaining).tone === "red" ? 0 : 1;
        const ub = urgencyPhrase(b.daysRemaining).tone === "red" ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return a.daysRemaining - b.daysRemaining;
    });

    const timeBarCount = sorted.filter(i => i.type === "time_bar_warning").length;
    const overdueCount = sorted.filter(i => i.type === "obligation_overdue").length;
    const dueSoonCount = sorted.filter(i => i.type === "obligation_due_soon").length;

    const subjectParts: string[] = [];
    if (timeBarCount > 0) subjectParts.push(`${timeBarCount} time bar${timeBarCount > 1 ? "s" : ""}`);
    if (overdueCount > 0) subjectParts.push(`${overdueCount} overdue`);
    if (dueSoonCount > 0) subjectParts.push(`${dueSoonCount} due soon`);
    const subject = `⚠ Contract alerts — ${subjectParts.join(", ")}`;

    const baseUrl = dashboardUrl.replace(/\/+$/, "");

    const itemsHtml = sorted.map(item => {
        const urg = urgencyPhrase(item.daysRemaining);
        const badgeBg = urg.tone === "red" ? "#fee2e2" : "#fef3c7";
        const badgeFg = urg.tone === "red" ? "#b91c1c" : "#92400e";
        const borderColour = urg.tone === "red" ? "#dc2626" : "#f59e0b";
        return `
        <tr>
          <td style="padding:14px 16px; border-left:3px solid ${borderColour}; background:#ffffff; border-bottom:1px solid #f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#9ca3af; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
                    ${alertTypeLabel(item.type)}${item.clauseRef ? ` · cl. ${item.clauseRef}` : ""}
                  </span>
                </td>
                <td align="right">
                  <span style="background:${badgeBg}; color:${badgeFg}; font-size:11px; font-weight:700; padding:3px 8px; border-radius:10px; white-space:nowrap;">
                    ${urg.label}
                  </span>
                </td>
              </tr>
            </table>
            <p style="color:#111827; font-size:14px; font-weight:600; margin:6px 0 2px;">${item.title}</p>
            <p style="color:#6b7280; font-size:12px; margin:0 0 6px;">${item.projectName}</p>
            ${item.detail ? `<p style="color:#374151; font-size:12px; margin:4px 0 0; line-height:1.5;">${item.detail}</p>` : ""}
            <a href="${baseUrl}/dashboard/projects/contract-admin?projectId=${item.projectId}"
               style="display:inline-block; color:#2563eb; font-size:12px; font-weight:600; text-decoration:none; margin-top:8px;">
              Open in Contract Admin →
            </a>
          </td>
        </tr>`;
    }).join("");

    return resend.emails.send({
        from: FROM,
        to: contractorEmail,
        subject,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
    <tr>
      <td style="background:#0d0d0d; padding:24px 28px; border-bottom:3px solid #dc2626;">
        <p style="color:#ffffff; font-size:20px; font-weight:700; margin:0;">⚠ Contract Alerts</p>
        <p style="color:#9ca3af; font-size:13px; margin:4px 0 0;">${companyName} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px 8px;">
        <p style="color:#111827; font-size:15px; margin:0 0 8px;">${greeting}</p>
        <p style="color:#374151; font-size:14px; line-height:1.6; margin:0;">
          You have <strong>${items.length} contract item${items.length > 1 ? "s" : ""}</strong> needing attention.
          ${timeBarCount > 0 ? `<strong style="color:#dc2626;">Missing a time bar can mean losing entitlement entirely</strong> — please review the items below today.` : "Please review the items below."}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 16px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
          ${itemsHtml}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 24px;">
        <a href="${baseUrl}/dashboard/home"
           style="display:inline-block; background:#0d0d0d; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; padding:12px 24px; border-radius:8px;">
          Open Dashboard →
        </a>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:18px 28px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:11px; margin:0; line-height:1.6;">
          You're receiving this digest because you have at least one open contract event or obligation in Constructa.
          Time bars and obligations are tracked from the contract type you selected on the project's Contract Admin tab.
          To stop these emails, mark the relevant items as complete or close the project.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

// ─── Email: Contractor notified when client accepts ───────────────────────────

export async function sendContractorAcceptanceNotification({
    contractorEmail,
    clientName,
    projectName,
    projectValue,
    refCode,
}: ContractorNotificationArgs) {
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    return resend.emails.send({
        from: FROM,
        to: contractorEmail,
        subject: `🎉 Accepted — ${clientName} has signed off on ${projectName}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
    <tr>
      <td style="background:#0d0d0d; padding:28px 32px;">
        <p style="color:#ffffff; font-size:22px; font-weight:700; margin:0;">🎉 Proposal Accepted</p>
        <p style="color:#9ca3af; font-size:13px; margin:4px 0 0;">You've won the job</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
          <strong>${clientName}</strong> has accepted your proposal for <strong>${projectName}</strong> on ${date}.
        </p>
        ${projectValue ? `<p style="color:#16a34a; font-size:28px; font-weight:700; margin:0 0 20px;">${fmtGBP(projectValue)}</p>` : ""}
        <table style="width:100%; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin:0 0 20px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 12px; color:#6b7280; font-size:13px;">Client</td>
            <td style="padding:6px 12px; color:#111827; font-size:13px; font-weight:600;">${clientName}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; color:#6b7280; font-size:13px;">Project</td>
            <td style="padding:6px 12px; color:#111827; font-size:13px;">${projectName}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; color:#6b7280; font-size:13px;">Reference</td>
            <td style="padding:6px 12px; color:#111827; font-size:13px; font-family:monospace;">${refCode}</td>
          </tr>
        </table>
        <p style="color:#374151; font-size:14px; line-height:1.6;">
          Log in to Constructa to manage the next steps.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">Constructa — smart proposals for construction contractors.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

// ── Supervisor Portal Invite ──────────────────────────────────────────────

export async function sendSupervisorInviteEmail(args: {
    supervisorEmail: string;
    supervisorName: string;
    projectName: string;
    companyName: string;
    portalUrl: string;
}) {
    if (!process.env.RESEND_API_KEY) return;

    await resend.emails.send({
        from: "Constructa <noreply@constructa.co>",
        to: [args.supervisorEmail],
        subject: `${args.companyName} — Supervisor Portal for ${args.projectName}`,
        html: `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; margin:0; padding:0; background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto;">
    <tr>
      <td style="background:#0f172a; padding:24px 32px;">
        <h1 style="color:#fff; font-size:18px; margin:0;">${args.companyName}</h1>
        <p style="color:#94a3b8; font-size:13px; margin:4px 0 0;">Supervisor Portal Invitation</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff; padding:32px;">
        <p style="color:#1e293b; font-size:15px; line-height:1.6; margin:0 0 16px;">
          Dear ${args.supervisorName},
        </p>
        <p style="color:#475569; font-size:14px; line-height:1.6; margin:0 0 16px;">
          You have been invited to view and acknowledge contract obligations on
          <strong>${args.projectName}</strong>.
        </p>
        <p style="color:#475569; font-size:14px; line-height:1.6; margin:0 0 24px;">
          Click the button below to access your supervisor portal. No account or login is required.
        </p>
        <a href="${args.portalUrl}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px;">
          Open Supervisor Portal
        </a>
        <p style="color:#94a3b8; font-size:12px; margin:24px 0 0;">
          If the button doesn't work, copy this link: ${args.portalUrl}
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">Sent via Constructa on behalf of ${args.companyName}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}
