"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle, RefreshCw, Unplug, Plug, Clock } from "lucide-react";
import {
  getXeroAuthUrlAction,
  disconnectXeroAction,
  fullSyncAction,
  pushInvoicesAction,
  pullPaymentsAction,
} from "./xero-actions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface XeroConnection {
  tenant_name: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  is_active: boolean;
  token_expires_at: string | null;
}

interface SyncLogEntry {
  id: string;
  sync_type: string;
  status: string;
  items_synced: number;
  items_failed: number;
  error_message: string | null;
  created_at: string;
}

interface Props {
  xeroConnection: XeroConnection | null;
  syncLog: SyncLogEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(s: string | null): string {
  if (!s) return "Never";
  return new Date(s).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function syncTypeLabel(t: string): string {
  const map: Record<string, string> = {
    push_invoices: "Push Invoices",
    pull_payments: "Pull Payments",
    push_expenses: "Push Expenses",
    full_sync:     "Full Sync",
  };
  return map[t] ?? t;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-900/50 text-emerald-300 border border-emerald-800",
    partial: "bg-amber-900/50 text-amber-300 border border-amber-800",
    error:   "bg-red-900/50 text-red-300 border border-red-800",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-zinc-800 text-zinc-400"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function IntegrationsClient({ xeroConnection, syncLog }: Props) {
  const searchParams = useSearchParams();
  const [conn, setConn] = useState(xeroConnection);
  const [log, setLog] = useState(syncLog);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Handle OAuth callback result
  useEffect(() => {
    const connected = searchParams?.get("xero_connected");
    const error     = searchParams?.get("xero_error");
    if (connected === "1") {
      setFlash({ type: "success", msg: "Xero connected successfully. Run a sync to push your invoices." });
      window.history.replaceState({}, "", "/dashboard/settings/integrations");
    } else if (error) {
      const msgs: Record<string, string> = {
        not_configured:        "Xero integration is not yet configured on this server.",
        token_exchange_failed: "Failed to exchange the authorisation code. Please try again.",
        no_tenant:             "No Xero organisation found on this account.",
        invalid_state:         "Session mismatch — please try connecting again.",
        unexpected:            "An unexpected error occurred.",
      };
      setFlash({ type: "error", msg: msgs[error] ?? `Xero error: ${error}` });
      window.history.replaceState({}, "", "/dashboard/settings/integrations");
    }
  }, [searchParams]);

  async function handleConnect() {
    setConnecting(true);
    const { url, error } = await getXeroAuthUrlAction();
    if (error || !url) {
      setFlash({ type: "error", msg: error ?? "Could not generate Xero auth URL" });
      setConnecting(false);
      return;
    }
    window.location.href = url;
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    const { error } = await disconnectXeroAction();
    if (error) {
      setFlash({ type: "error", msg: error });
    } else {
      setConn(null);
      setFlash({ type: "success", msg: "Xero disconnected." });
    }
    setDisconnecting(false);
    setShowDisconnectConfirm(false);
  }

  async function handleSync(type: "full" | "invoices" | "payments") {
    setSyncing(type);
    setSyncResult(null);
    try {
      if (type === "full") {
        const r = await fullSyncAction();
        if (r.error) {
          setSyncResult(`Error: ${r.error}`);
          setFlash({ type: "error", msg: r.error });
        } else {
          const msg = `Sync complete — ${r.invoicesSynced} invoices pushed, ${r.paymentsUpdated} payments updated.${r.invoicesFailed ? ` (${r.invoicesFailed} failed)` : ""}`;
          setSyncResult(msg);
          setFlash({ type: "success", msg });
        }
      } else if (type === "invoices") {
        const r = await pushInvoicesAction();
        const msg = r.error ? `Error: ${r.error}` : `${r.synced} invoices pushed to Xero.${r.failed ? ` ${r.failed} failed.` : ""}`;
        setSyncResult(msg);
        setFlash({ type: r.error ? "error" : "success", msg });
      } else {
        const r = await pullPaymentsAction();
        const msg = r.error ? `Error: ${r.error}` : `${r.updated} invoice statuses updated from Xero.`;
        setSyncResult(msg);
        setFlash({ type: r.error ? "error" : "success", msg });
      }
    } finally {
      setSyncing(null);
    }
  }

  const isConfigured = !!(process.env.NEXT_PUBLIC_XERO_CONFIGURED === "true" || conn);

  return (
    <div className="max-w-3xl mx-auto p-8 pt-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Integrations</h1>
        <p className="text-slate-400 mt-1">Connect Constructa to your accounting software.</p>
      </div>

      {/* Flash message */}
      {flash && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${
          flash.type === "success"
            ? "bg-emerald-900/20 border-emerald-700/50 text-emerald-300"
            : "bg-red-900/20 border-red-700/50 text-red-300"
        }`}>
          {flash.type === "success"
            ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          }
          <p className="text-sm">{flash.msg}</p>
          <button onClick={() => setFlash(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Xero card ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-4">
            {/* Xero logo placeholder */}
            <div className="w-10 h-10 rounded-lg bg-[#13B5EA] flex items-center justify-center text-white font-bold text-sm shrink-0">
              X
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Xero</h2>
              <p className="text-sm text-slate-400">Accounting & invoicing sync</p>
            </div>
          </div>
          {conn?.is_active ? (
            <span className="flex items-center gap-1.5 text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-full">
              <CheckCircle className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1 rounded-full">
              Not connected
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {conn?.is_active ? (
            <>
              {/* Connection details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Organisation</p>
                  <p className="text-slate-200 font-medium">{conn.tenant_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Connected</p>
                  <p className="text-slate-300">{fmtDate(conn.connected_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Last Sync</p>
                  <p className="text-slate-300">{fmtDate(conn.last_sync_at)}</p>
                </div>
              </div>

              {/* What syncs */}
              <div className="text-xs text-slate-500 space-y-1">
                <p className="text-slate-400 font-medium text-sm mb-2">What syncs</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { dir: "→", label: "Sent & Paid invoices pushed to Xero as draft ACCREC invoices" },
                    { dir: "←", label: "Invoices marked PAID in Xero update status in Constructa" },
                    { dir: "→", label: "Clients auto-created as Xero Contacts if not found" },
                    { dir: "→", label: "Invoice reference synced from Constructa invoice number" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-blue-400 font-mono">{item.dir}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sync buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => handleSync("full")}
                  disabled={!!syncing}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-md"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing === "full" ? "animate-spin" : ""}`} />
                  {syncing === "full" ? "Syncing…" : "Sync Now (Full)"}
                </button>
                <button
                  onClick={() => handleSync("invoices")}
                  disabled={!!syncing}
                  className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {syncing === "invoices" ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Push Invoices
                </button>
                <button
                  onClick={() => handleSync("payments")}
                  disabled={!!syncing}
                  className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {syncing === "payments" ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Pull Payments
                </button>
              </div>

              {syncResult && (
                <p className="text-xs text-slate-400 bg-slate-800 rounded px-3 py-2">{syncResult}</p>
              )}

              {/* Disconnect */}
              {!showDisconnectConfirm ? (
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-400 transition-colors pt-1"
                >
                  <Unplug className="w-4 h-4" /> Disconnect Xero
                </button>
              ) : (
                <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-300">Disconnect Xero? Sync history will be cleared.</p>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-md disabled:opacity-50 shrink-0"
                  >
                    {disconnecting ? "Disconnecting…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400">
                Connect Xero to automatically sync your Constructa invoices and pull payment
                status updates. No data leaves Constructa until you run a sync.
              </p>
              <div className="text-xs text-slate-500 space-y-1.5">
                <p className="font-medium text-slate-400">Requirements before connecting:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>A Xero account with at least one organisation</li>
                  <li>Account code 200 (Revenue) must exist in your Xero chart of accounts</li>
                  <li>You must be an Admin or Standard user in the Xero organisation</li>
                </ul>
              </div>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 bg-[#13B5EA] hover:bg-[#0fa0d0] disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-md"
              >
                <Plug className="w-4 h-4" />
                {connecting ? "Redirecting to Xero…" : "Connect Xero"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Sync Log ─────────────────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Sync History</h2>
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Synced</th>
                  <th className="text-right px-4 py-3">Failed</th>
                  <th className="text-right px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map(entry => (
                  <tr key={entry.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {fmtDate(entry.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{syncTypeLabel(entry.sync_type)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{entry.items_synced}</td>
                    <td className="px-4 py-3 text-right text-red-400">{entry.items_failed || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={entry.status} />
                      {entry.error_message && (
                        <p className="text-xs text-red-400 mt-0.5 text-right">{entry.error_message.slice(0, 80)}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Coming soon ───────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">Coming Soon</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { name: "QuickBooks Online", colour: "bg-[#2CA01C]", desc: "Push invoices and expenses to QuickBooks" },
            { name: "Sage Business Cloud", colour: "bg-[#00DC82]", desc: "Sync with Sage 50 and Sage Accounting" },
          ].map(i => (
            <div key={i.name} className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 flex items-center gap-4 opacity-60">
              <div className={`w-8 h-8 rounded-md ${i.colour} shrink-0`} />
              <div>
                <p className="text-sm font-medium text-slate-300">{i.name}</p>
                <p className="text-xs text-slate-500">{i.desc}</p>
              </div>
              <span className="ml-auto text-xs text-slate-600 border border-slate-700 px-2 py-0.5 rounded-full">Soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
