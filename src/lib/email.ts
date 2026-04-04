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
