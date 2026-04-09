"use client";

import { useState } from "react";
import { Key, Plus, Trash2, Copy, CheckCircle, Eye, EyeOff } from "lucide-react";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  tier: string;
  rate_limit_per_hour: number;
  requests_total: number;
  last_used_at: string | null;
  created_at: string;
  is_active: boolean;
  revoked_at: string | null;
}

function fmtDate(s: string | null): string {
  if (!s) return "Never";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ApiKeysClient({ keys: initialKeys }: { keys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!newKeyName.trim()) { setError("Enter a name for this key"); return; }
    setCreating(true);
    setError("");
    const res = await createApiKeyAction(newKeyName);
    if (res.error) {
      setError(res.error);
    } else if (res.key) {
      setNewKeyValue(res.key);
      setShowCreate(false);
      setNewKeyName("");
      // Refresh key list via reload (key_prefix now visible)
      window.location.reload();
    }
    setCreating(false);
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    const res = await revokeApiKeyAction(id);
    if (!res.error) {
      setKeys(k => k.map(key => key.id === id ? { ...key, is_active: false, revoked_at: new Date().toISOString() } : key));
    }
    setRevoking(null);
    setRevokeConfirm(null);
  }

  async function handleCopy() {
    if (!newKeyValue) return;
    await navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeKeys = keys.filter(k => k.is_active);
  const revokedKeys = keys.filter(k => !k.is_active);

  return (
    <div className="max-w-3xl mx-auto p-8 pt-12 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">API Keys</h1>
          <p className="text-slate-400 mt-1">
            Use API keys to access the Constructa Benchmark Data API.
          </p>
        </div>
        {!showCreate && !newKeyValue && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md shrink-0"
          >
            <Plus className="w-4 h-4" /> New Key
          </button>
        )}
      </div>

      {/* ── New key just created — show ONCE ─────────────────────────────── */}
      {newKeyValue && (
        <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">API key created — copy it now</p>
              <p className="text-xs text-emerald-400/80 mt-0.5">
                This key will not be shown again. Store it somewhere safe.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3">
            <code className="flex-1 text-sm text-slate-200 font-mono break-all">{newKeyValue}</code>
            <button onClick={handleCopy} className="shrink-0 text-slate-400 hover:text-white transition-colors">
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={() => setNewKeyValue(null)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* ── Create form ───────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Create new API key</h3>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Key name</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="e.g. Production, Dashboard, Testing"
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-md"
            >
              {creating ? "Creating…" : "Create Key"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setError(""); }}
              className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-md border border-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Active keys ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {activeKeys.length === 0 && !showCreate && !newKeyValue ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
            <Key className="w-8 h-8 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-500 text-sm">No API keys yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-blue-400 text-sm hover:text-blue-300 mt-1"
            >
              Create your first key →
            </button>
          </div>
        ) : (
          activeKeys.map(key => (
            <div key={key.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Key className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">{key.name}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{key.key_prefix}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Created {fmtDate(key.created_at)}</span>
                      <span>Last used {fmtDate(key.last_used_at)}</span>
                      <span>{key.requests_total.toLocaleString()} total requests</span>
                      <span className="text-blue-400">{key.rate_limit_per_hour}/hr limit</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full capitalize">{key.tier}</span>
                  {revokeConfirm === key.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRevoke(key.id)}
                        disabled={revoking === key.id}
                        className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded-md disabled:opacity-50"
                      >
                        {revoking === key.id ? "Revoking…" : "Confirm revoke"}
                      </button>
                      <button onClick={() => setRevokeConfirm(null)} className="text-xs text-slate-400 hover:text-slate-200">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevokeConfirm(key.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── API usage docs ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Using the API</h3>
        <div className="space-y-3 text-xs text-slate-400">
          <div>
            <p className="text-slate-300 font-medium mb-1">Endpoint</p>
            <code className="block bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-300">
              GET https://constructa.co/api/v1/benchmarks
            </code>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">Authentication</p>
            <code className="block bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-300">
              Authorization: Bearer ck_live_your_key_here
            </code>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">Query parameters</p>
            <div className="grid grid-cols-1 gap-1 font-mono">
              <span><span className="text-blue-400">project_type</span> — filter by type (e.g. Residential, Commercial)</span>
              <span><span className="text-blue-400">value_band</span>   — filter by band (0-50k, 50k-100k, 100k-250k, 250k-500k, 500k+)</span>
            </div>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">Example response</p>
            <pre className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-400 overflow-x-auto text-xs">{`{
  "data": [{
    "project_type": "Residential",
    "contract_value_band": "100k-250k",
    "sample_size": 42,
    "avg_gross_margin_pct": 18.4,
    "avg_variation_rate_pct": 6.2,
    "avg_programme_delay_days": 11,
    "pct_delivered_on_time": 64
  }],
  "meta": { "total_records": 42, "api_version": "v1" }
}`}</pre>
          </div>
        </div>
      </div>

      {/* ── Revoked keys ─────────────────────────────────────────────────── */}
      {revokedKeys.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Revoked Keys</h2>
          <div className="space-y-2">
            {revokedKeys.map(key => (
              <div key={key.id} className="bg-slate-900/40 border border-slate-800/50 rounded-lg px-4 py-3 flex items-center gap-3 opacity-50">
                <Key className="w-4 h-4 text-slate-600 shrink-0" />
                <div>
                  <p className="text-sm text-slate-400">{key.name}</p>
                  <p className="text-xs font-mono text-slate-600">{key.key_prefix}</p>
                </div>
                <span className="ml-auto text-xs text-red-600">Revoked {fmtDate(key.revoked_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
