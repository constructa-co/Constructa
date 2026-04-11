"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

const XERO_TOKEN_URL     = "https://identity.xero.com/connect/token";
const XERO_API_BASE      = "https://api.xero.com/api.xro/2.0";
const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";

// ── Token management ──────────────────────────────────────────────────────────

async function refreshXeroToken(userId: string, refreshToken: string): Promise<string | null> {
  const clientId     = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;

  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabase = await createClient();
  await supabase.from("xero_connections").update({
    access_token:     tokens.access_token,
    refresh_token:    tokens.refresh_token ?? refreshToken,
    token_expires_at: expiresAt,
  }).eq("user_id", userId);

  return tokens.access_token;
}

async function getValidToken(userId: string): Promise<{ token: string; tenantId: string } | null> {
  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("xero_connections")
    .select("access_token, refresh_token, token_expires_at, tenant_id, is_active")
    .eq("user_id", userId)
    .single();

  if (!conn || !conn.is_active) return null;

  // Refresh if expiring within 5 minutes
  const expiresAt = new Date(conn.token_expires_at);
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  const token = needsRefresh
    ? await refreshXeroToken(userId, conn.refresh_token)
    : conn.access_token;

  if (!token) return null;
  return { token, tenantId: conn.tenant_id };
}

async function xeroFetch(
  path: string,
  token: string,
  tenantId: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${XERO_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization:  `Bearer ${token}`,
      "Xero-Tenant-Id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });
}

// ── Connect / Disconnect ──────────────────────────────────────────────────────

export async function getXeroAuthUrlAction(): Promise<{ url?: string; error?: string }> {
  const { user, supabase } = await requireAuth();

  const clientId    = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI
    ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/xero/callback`;

  if (!clientId) return { error: "Xero integration not configured" };

  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         "openid profile email accounting.transactions accounting.contacts offline_access",
    state:         user.id,   // tie callback to this user session
  });

  return { url: `${XERO_AUTHORIZE_URL}?${params.toString()}` };
}

export async function disconnectXeroAction(): Promise<{ error?: string }> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("xero_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings/integrations");
  return {};
}

// ── Push invoices to Xero ─────────────────────────────────────────────────────

export async function pushInvoicesAction(): Promise<{ synced: number; failed: number; error?: string }> {
  const { user, supabase } = await requireAuth();

  const auth = await getValidToken(user.id);
  if (!auth) return { synced: 0, failed: 0, error: "Xero not connected or token expired" };

  // Fetch invoices not yet pushed (no xero_invoice_id), status Sent or Paid
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, status, created_at, due_date, net_due, project_id, projects(name, client_name)")
    .eq("user_id", user.id)
    .in("status", ["Sent", "Paid"])
    .is("xero_invoice_id", null);

  if (!invoices?.length) {
    await supabase.from("xero_sync_log").insert({
      user_id: user.id, sync_type: "push_invoices", status: "success",
      items_synced: 0, details: { message: "No unsynced invoices" },
    });
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;
  const details: object[] = [];

  for (const inv of invoices) {
    try {
      const project = (inv.projects as unknown as { name: string; client_name: string | null } | null);
      const contactName = project?.client_name ?? project?.name ?? "Unknown Client";

      const xeroInvoice = {
        Type:      "ACCREC",
        Contact:   { Name: contactName },
        Date:      inv.created_at.slice(0, 10),
        DueDate:   inv.due_date ?? inv.created_at.slice(0, 10),
        Status:    "DRAFT",
        Reference: inv.invoice_number ?? `INV-${inv.id.slice(0, 8).toUpperCase()}`,
        LineItems: [{
          Description: project?.name ? `${project.name} — invoice` : "Construction services",
          Quantity:    1,
          UnitAmount:  inv.net_due ?? inv.amount,
          AccountCode: "200",  // default revenue account
        }],
      };

      const res = await xeroFetch("/Invoices", auth.token, auth.tenantId, {
        method: "POST",
        body: JSON.stringify({ Invoices: [xeroInvoice] }),
      });

      if (!res.ok) {
        const err = await res.text();
        details.push({ invoiceId: inv.id, status: "error", error: err.slice(0, 200) });
        failed++;
        continue;
      }

      const body = await res.json();
      const xeroId = body.Invoices?.[0]?.InvoiceID;

      if (xeroId) {
        await supabase.from("invoices").update({
          xero_invoice_id: xeroId,
          xero_synced_at:  new Date().toISOString(),
        }).eq("id", inv.id);
        details.push({ invoiceId: inv.id, xeroId, status: "success" });
        synced++;
      } else {
        details.push({ invoiceId: inv.id, status: "error", error: "No InvoiceID returned" });
        failed++;
      }
    } catch (e) {
      details.push({ invoiceId: inv.id, status: "error", error: String(e).slice(0, 200) });
      failed++;
    }
  }

  await supabase.from("xero_sync_log").insert({
    user_id: user.id,
    sync_type: "push_invoices",
    status: failed === 0 ? "success" : synced === 0 ? "error" : "partial",
    items_synced: synced,
    items_failed: failed,
    details,
  });

  await supabase.from("xero_connections").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);
  revalidatePath("/dashboard/settings/integrations");
  return { synced, failed };
}

// ── Pull payment status from Xero ─────────────────────────────────────────────

export async function pullPaymentsAction(): Promise<{ updated: number; error?: string }> {
  const { user, supabase } = await requireAuth();

  const auth = await getValidToken(user.id);
  if (!auth) return { updated: 0, error: "Xero not connected or token expired" };

  // Get our invoices that have a xero_invoice_id but aren't yet marked Paid
  const { data: sentInvoices } = await supabase
    .from("invoices")
    .select("id, xero_invoice_id, status")
    .eq("user_id", user.id)
    .not("xero_invoice_id", "is", null)
    .neq("status", "Paid");

  if (!sentInvoices?.length) {
    await supabase.from("xero_sync_log").insert({
      user_id: user.id, sync_type: "pull_payments", status: "success",
      items_synced: 0, details: { message: "No invoices to check" },
    });
    return { updated: 0 };
  }

  // Fetch each invoice status from Xero
  const xeroIds = sentInvoices.map(i => i.xero_invoice_id).join(",");
  const res = await xeroFetch(
    `/Invoices?IDs=${encodeURIComponent(xeroIds)}`,
    auth.token,
    auth.tenantId
  );

  if (!res.ok) {
    const err = await res.text();
    await supabase.from("xero_sync_log").insert({
      user_id: user.id, sync_type: "pull_payments", status: "error",
      items_synced: 0, error_message: err.slice(0, 500),
    });
    return { updated: 0, error: "Failed to fetch Xero invoices" };
  }

  const body = await res.json();
  const xeroInvoices: Array<{ InvoiceID: string; Status: string; AmountPaid: number }> =
    body.Invoices ?? [];

  let updated = 0;
  for (const xi of xeroInvoices) {
    if (xi.Status === "PAID") {
      const local = sentInvoices.find(i => i.xero_invoice_id === xi.InvoiceID);
      if (local && local.status !== "Paid") {
        await supabase.from("invoices").update({
          status: "Paid",
          paid_date: new Date().toISOString().slice(0, 10),
        }).eq("id", local.id);
        updated++;
      }
    }
  }

  await supabase.from("xero_sync_log").insert({
    user_id: user.id,
    sync_type: "pull_payments",
    status: "success",
    items_synced: updated,
    details: { checked: sentInvoices.length, updated },
  });

  await supabase.from("xero_connections").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);
  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard/projects");
  return { updated };
}

// ── Full sync (push invoices + pull payments) ─────────────────────────────────

export async function fullSyncAction(): Promise<{
  invoicesSynced: number;
  invoicesFailed: number;
  paymentsUpdated: number;
  error?: string;
}> {
  const [pushResult, pullResult] = await Promise.all([
    pushInvoicesAction(),
    pullPaymentsAction(),
  ]);

  if (pushResult.error && pullResult.error) {
    return { invoicesSynced: 0, invoicesFailed: 0, paymentsUpdated: 0, error: pushResult.error };
  }

  return {
    invoicesSynced:   pushResult.synced,
    invoicesFailed:   pushResult.failed,
    paymentsUpdated:  pullResult.updated,
  };
}
