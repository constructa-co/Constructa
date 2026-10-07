import { Resend } from "resend";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import {
    describeRecordedResponse,
    responseWording,
    type ProposalResponseKind,
    type RecordedResponseKind,
} from "@/lib/proposal-response";

function getResend(): Resend {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error("RESEND_API_KEY is required to send email.");
    }

    return new Resend(apiKey);
}

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
    /** What the client is asked for. Worded from the one response wording table. */
    responseKind?: ProposalResponseKind;
    idempotencyKey?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function escapeEmailHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function normalizeEmailSubjectPart(value: string, maxLength = 120) {
    return value
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

export function requireTrustedAppUrl(value: string) {
    const url = new URL(value);
    const configuredOrigins = new Set(
        [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL, "https://constructa-nu.vercel.app"]
            .filter((candidate): candidate is string => Boolean(candidate))
            .map((candidate) => new URL(candidate).origin),
    );
    if (!['http:', 'https:'].includes(url.protocol) || !configuredOrigins.has(url.origin) || url.username || url.password) {
        throw new Error("Email link must use the configured Constructa origin.");
    }
    return url.toString();
}

type ProposalResponse = "acknowledged" | "accepted" | "declined";

interface ProposalResponseReceiptArgs {
    recipientEmail: string;
    recipientKind: "client" | "owner";
    clientName: string;
    projectName: string;
    companyName: string;
    response: ProposalResponse;
    /** What the publication asked for. Decides how an acknowledgement is described. */
    responseKind?: RecordedResponseKind;
    respondedAt: string;
    refCode: string;
    publicationVersion: number;
    snapshotReference: string;
    idempotencyKey: string;
}

export function buildProposalResponseReceiptContent(
    args: Omit<ProposalResponseReceiptArgs, "recipientEmail" | "idempotencyKey">,
) {
    const clientName = escapeEmailHtml(args.clientName);
    const projectName = escapeEmailHtml(args.projectName);
    const companyName = escapeEmailHtml(args.companyName);
    const refCode = escapeEmailHtml(args.refCode);
    const snapshotReference = escapeEmailHtml(args.snapshotReference.slice(0, 12));
    const { label: responseLabel, explanation: responseExplanation } = describeRecordedResponse(
        args.response,
        args.responseKind ?? "acknowledgement",
    );
    const date = new Date(args.respondedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
        timeZoneName: "short",
    });
    const greeting = args.recipientKind === "client" ? `Dear ${clientName},` : "Hello,";
    const summary = args.recipientKind === "client"
        ? `Your response to ${companyName}'s proposal for <strong>${projectName}</strong> has been recorded.`
        : `<strong>${clientName}</strong> responded to your published proposal for <strong>${projectName}</strong>.`;

    return {
        subject: `${responseLabel} — ${normalizeEmailSubjectPart(args.projectName)}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f9f9;margin:0;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <tr><td style="background:#0f172a;padding:28px 32px;color:#ffffff;">
      <p style="font-size:22px;font-weight:700;margin:0;">${responseLabel}</p>
      <p style="color:#cbd5e1;font-size:13px;margin:4px 0 0;">${date} · ${refCode}</p>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="color:#111827;font-size:16px;margin:0 0 16px;">${greeting}</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">${summary}</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;">${responseExplanation}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
        <tr><td style="color:#64748b;font-size:13px;padding:4px 8px;">Publication</td><td style="color:#0f172a;font-size:13px;padding:4px 8px;font-weight:600;">Version ${args.publicationVersion}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:4px 8px;">Reference</td><td style="color:#0f172a;font-size:13px;padding:4px 8px;font-family:monospace;">${refCode}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:4px 8px;">Snapshot</td><td style="color:#0f172a;font-size:13px;padding:4px 8px;font-family:monospace;">${snapshotReference}</td></tr>
      </table>
      <p style="color:#64748b;font-size:12px;line-height:1.5;margin:20px 0 0;">Keep this email as a response receipt. It references the immutable proposal version shown to the client.</p>
    </td></tr>
  </table>
</body>
</html>`,
    };
}

export async function sendProposalResponseReceipt(args: ProposalResponseReceiptArgs) {
    const content = buildProposalResponseReceiptContent(args);
    return getResend().emails.send({
        from: FROM,
        to: args.recipientEmail,
        subject: content.subject,
        html: content.html,
    }, { idempotencyKey: args.idempotencyKey });
}

// ─── Email: Contractor sends proposal to client ───────────────────────────────

/** The email that delivers a published proposal to the client. */
export function buildProposalEmailContent({
    clientName,
    projectName,
    proposalUrl,
    companyName,
    siteAddress,
    responseKind = "acknowledgement",
}: Omit<SendProposalEmailArgs, "clientEmail" | "idempotencyKey">) {
    const safeClientName = escapeEmailHtml(clientName);
    const safeProjectName = escapeEmailHtml(projectName);
    const safeCompanyName = escapeEmailHtml(companyName);
    const safeSiteAddress = siteAddress ? escapeEmailHtml(siteAddress) : null;
    const safeProposalUrl = escapeEmailHtml(requireTrustedAppUrl(proposalUrl));
    const responseCopy = escapeEmailHtml(responseWording(responseKind).emailInvite);
    return {
        subject: `Your Proposal — ${normalizeEmailSubjectPart(projectName)}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
    <tr>
      <td style="background:#0d0d0d; padding:28px 32px;">
        <p style="color:#ffffff; font-size:22px; font-weight:700; margin:0;">${safeCompanyName}</p>
        <p style="color:#9ca3af; font-size:13px; margin:4px 0 0;">Proposal</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="color:#111827; font-size:16px; margin:0 0 16px;">Dear ${safeClientName},</p>
        <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
          Please find our proposal for
          <strong>${safeProjectName}</strong>${safeSiteAddress ? ` at ${safeSiteAddress}` : ""} via the link below.
        </p>
        <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 24px;">
          You can read the scope of works, price, programme and terms, ${responseCopy}.
        </p>
        <a href="${safeProposalUrl}" style="display:inline-block; background:#0d0d0d; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:14px 28px; border-radius:8px;">
          View Your Proposal →
        </a>
        <p style="color:#6b7280; font-size:13px; margin:24px 0 0;">
          Or copy this link: <a href="${safeProposalUrl}" style="color:#2563eb;">${safeProposalUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">
          This proposal was sent via Constructa. If you have any questions, please contact ${safeCompanyName} directly.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };
}

export async function sendProposalEmail({ clientEmail, idempotencyKey, ...args }: SendProposalEmailArgs) {
    const content = buildProposalEmailContent(args);
    return getResend().emails.send({
        from: FROM,
        to: clientEmail,
        subject: content.subject,
        html: content.html,
    }, idempotencyKey ? { idempotencyKey } : undefined);
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
    const safeClientName = escapeEmailHtml(clientName);
    const safeProjectName = escapeEmailHtml(projectName);
    const safeProposalUrl = escapeEmailHtml(requireTrustedAppUrl(proposalUrl));
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    return getResend().emails.send({
        from: FROM,
        to: contractorEmail,
        subject: `Proposal viewed — ${normalizeEmailSubjectPart(projectName)}`,
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
        <p style="color:#111827; font-size:16px; margin:0 0 12px;"><strong>${safeClientName}</strong> has just opened your proposal for <strong>${safeProjectName}</strong>.</p>
        <p style="color:#374151; font-size:14px; line-height:1.6; margin:0 0 24px;">
          Now is a great time to follow up — they're actively reviewing your proposal right now.
        </p>
        <a href="${safeProposalUrl}" style="display:inline-block; background:#1e3a5f; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; padding:12px 24px; border-radius:8px;">
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
    const safeCompanyName = escapeEmailHtml(companyName);
    const safeDashboardUrl = escapeEmailHtml(requireTrustedAppUrl(dashboardUrl));
    const greeting = fullName ? `Hi ${escapeEmailHtml(fullName.split(" ")[0])},` : "Welcome,";
    return getResend().emails.send({
        from: FROM,
        to: contractorEmail,
        subject: `Welcome to Constructa, ${normalizeEmailSubjectPart(companyName)}`,
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
          Your Constructa account for <strong>${safeCompanyName}</strong> is all set up and ready to go. Here's what to do next:
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
        <a href="${safeDashboardUrl}" style="display:inline-block; background:#0d0d0d; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:14px 28px; border-radius:8px;">
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

    const greeting = contractorName ? `Hi ${escapeEmailHtml(contractorName.split(" ")[0])},` : "Good morning,";
    const safeCompanyName = escapeEmailHtml(companyName);

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

    const baseUrl = requireTrustedAppUrl(dashboardUrl).replace(/\/+$/, "");
    const safeBaseUrl = escapeEmailHtml(baseUrl);

    const itemsHtml = sorted.map(item => {
        const urg = urgencyPhrase(item.daysRemaining);
        const safeClauseRef = item.clauseRef ? escapeEmailHtml(item.clauseRef) : null;
        const safeTitle = escapeEmailHtml(item.title);
        const safeProjectName = escapeEmailHtml(item.projectName);
        const safeDetail = item.detail ? escapeEmailHtml(item.detail) : null;
        const projectId = encodeURIComponent(item.projectId);
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
                    ${alertTypeLabel(item.type)}${safeClauseRef ? ` · cl. ${safeClauseRef}` : ""}
                  </span>
                </td>
                <td align="right">
                  <span style="background:${badgeBg}; color:${badgeFg}; font-size:11px; font-weight:700; padding:3px 8px; border-radius:10px; white-space:nowrap;">
                    ${urg.label}
                  </span>
                </td>
              </tr>
            </table>
            <p style="color:#111827; font-size:14px; font-weight:600; margin:6px 0 2px;">${safeTitle}</p>
            <p style="color:#6b7280; font-size:12px; margin:0 0 6px;">${safeProjectName}</p>
            ${safeDetail ? `<p style="color:#374151; font-size:12px; margin:4px 0 0; line-height:1.5;">${safeDetail}</p>` : ""}
            <a href="${safeBaseUrl}/dashboard/projects/contract-admin?projectId=${projectId}"
               style="display:inline-block; color:#2563eb; font-size:12px; font-weight:600; text-decoration:none; margin-top:8px;">
              Open in Contract Admin →
            </a>
          </td>
        </tr>`;
    }).join("");

    return getResend().emails.send({
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
        <p style="color:#9ca3af; font-size:13px; margin:4px 0 0;">${safeCompanyName} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
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
        <a href="${safeBaseUrl}${getLaunchLandingPath()}"
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

// ── Supervisor Portal Invite ──────────────────────────────────────────────

export async function sendSupervisorInviteEmail(args: {
    supervisorEmail: string;
    supervisorName: string;
    projectName: string;
    companyName: string;
    portalUrl: string;
}) {
    if (!process.env.RESEND_API_KEY) return;

    const safeCompanyName = escapeEmailHtml(args.companyName);
    const safeSupervisorName = escapeEmailHtml(args.supervisorName);
    const safeProjectName = escapeEmailHtml(args.projectName);
    const safePortalUrl = escapeEmailHtml(requireTrustedAppUrl(args.portalUrl));

    await getResend().emails.send({
        from: FROM,
        to: [args.supervisorEmail],
        subject: `${normalizeEmailSubjectPart(args.companyName)} — Supervisor Portal for ${normalizeEmailSubjectPart(args.projectName)}`,
        html: `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; margin:0; padding:0; background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto;">
    <tr>
      <td style="background:#0f172a; padding:24px 32px;">
        <h1 style="color:#fff; font-size:18px; margin:0;">${safeCompanyName}</h1>
        <p style="color:#94a3b8; font-size:13px; margin:4px 0 0;">Supervisor Portal Invitation</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff; padding:32px;">
        <p style="color:#1e293b; font-size:15px; line-height:1.6; margin:0 0 16px;">
          Dear ${safeSupervisorName},
        </p>
        <p style="color:#475569; font-size:14px; line-height:1.6; margin:0 0 16px;">
          You have been invited to view and acknowledge contract obligations on
          <strong>${safeProjectName}</strong>.
        </p>
        <p style="color:#475569; font-size:14px; line-height:1.6; margin:0 0 24px;">
          Click the button below to access your supervisor portal. No account or login is required.
        </p>
        <a href="${safePortalUrl}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px;">
          Open Supervisor Portal
        </a>
        <p style="color:#94a3b8; font-size:12px; margin:24px 0 0;">
          If the button doesn't work, copy this link: ${safePortalUrl}
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af; font-size:12px; margin:0;">Sent via Constructa on behalf of ${safeCompanyName}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}
