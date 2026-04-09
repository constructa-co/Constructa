"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
  Info,
  TrendingUp,
  X,
  Package,
} from "lucide-react";

interface MaterialPrice {
  id: string;
  trade_category: string;
  material: string;
  description: string | null;
  unit: string;
  region: string;
  price_low: number | null;
  price_mid: number;
  price_high: number | null;
  supplier_note: string | null;
  source_date: string;
}

interface BasketItem {
  material: MaterialPrice;
  qty: number;
}

interface Props {
  materials: MaterialPrice[];
  categories: string[];
  regions: string[];
}

function fmtCcy(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
}

function PriceBar({ low, mid, high }: { low: number | null; mid: number; high: number | null }) {
  if (!low || !high) return <span className="text-white font-semibold">{fmtCcy(mid)}</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs">{fmtCcy(low)}</span>
      <div className="flex-1 relative h-1.5 bg-slate-700 rounded-full min-w-[60px]">
        <div
          className="absolute top-0 h-1.5 bg-blue-500 rounded-full"
          style={{ left: "0%", width: "100%" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full"
          style={{ left: `${((mid - low) / (high - low)) * 100}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <span className="text-slate-500 text-xs">{fmtCcy(high)}</span>
    </div>
  );
}

export default function MaterialsClient({ materials, categories, regions }: Props) {
  const router = useRouter();
  const [search, setSearch]           = useState("");
  const [category, setCategory]       = useState("All");
  const [region, setRegion]           = useState("National");
  const [basket, setBasket]           = useState<BasketItem[]>([]);
  const [basketOpen, setBasketOpen]   = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  // Filter materials
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return materials.filter(m => {
      if (category !== "All" && m.trade_category !== category) return false;
      if (region !== "All" && m.region !== region) return false;
      if (q && !m.material.toLowerCase().includes(q) && !m.trade_category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [materials, category, region, search]);

  // Group by trade_category
  const grouped = useMemo(() => {
    const map = new Map<string, MaterialPrice[]>();
    for (const m of filtered) {
      if (!map.has(m.trade_category)) map.set(m.trade_category, []);
      map.get(m.trade_category)!.push(m);
    }
    return map;
  }, [filtered]);

  const basketTotal = basket.reduce((sum, b) => sum + b.material.price_mid * b.qty, 0);
  const basketCount = basket.reduce((sum, b) => sum + b.qty, 0);

  function addToBasket(m: MaterialPrice) {
    setBasket(prev => {
      const existing = prev.find(b => b.material.id === m.id);
      if (existing) return prev.map(b => b.material.id === m.id ? { ...b, qty: b.qty + 1 } : b);
      return [...prev, { material: m, qty: 1 }];
    });
    setBasketOpen(true);
  }

  function updateQty(id: string, delta: number) {
    setBasket(prev =>
      prev.map(b => b.material.id === id ? { ...b, qty: Math.max(1, b.qty + delta) } : b)
    );
  }

  function removeItem(id: string) {
    setBasket(prev => prev.filter(b => b.material.id !== id));
  }

  function logAllCosts() {
    // Build a URL that prefills the P&L cost log with basket items
    // The P&L page will pick up a basket param and pre-populate
    const items = basket.map(b => `${encodeURIComponent(b.material.material)}:${b.qty}:${b.material.price_mid}:${encodeURIComponent(b.material.unit)}`).join(",");
    router.push(`/dashboard/projects/p-and-l?basketItems=${items}`);
  }

  return (
    <div className="max-w-5xl mx-auto p-8 pt-12 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Material Rates</h1>
          <p className="text-slate-400 mt-1">
            Indicative UK trade prices — {materials.length} items across {categories.length} categories.
          </p>
        </div>
        <button
          onClick={() => setBasketOpen(true)}
          className="relative flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg shrink-0 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Basket</span>
          {basketCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
              {basketCount}
            </span>
          )}
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/80 leading-relaxed">
          Prices are <strong>indicative</strong> based on published UK trade data (April 2026, ex-VAT).
          Always confirm with your supplier before committing. Regional premiums apply.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500 placeholder:text-slate-500"
            placeholder="Search materials…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500"
        >
          <option value="All">All Trades</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500"
        >
          <option value="All">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-500">
        {filtered.length} item{filtered.length !== 1 ? "s" : ""} shown
        {category !== "All" ? ` in ${category}` : ""}
        {region !== "All" ? ` — ${region}` : ""}
      </p>

      {/* Material groups */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
          <Package className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-500">No materials match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-200">{cat}</h2>
                <span className="text-xs text-slate-500 ml-auto">{items.length} items</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800/50">
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Material</th>
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium hidden sm:table-cell">Unit</th>
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium">Price range</th>
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-medium hidden md:table-cell">Region</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m, i) => (
                    <>
                      <tr
                        key={m.id}
                        className={`${i < items.length - 1 || expandedId === m.id ? "border-b border-slate-800/40" : ""} hover:bg-slate-800/40 transition-colors`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                            className="text-left"
                          >
                            <p className="text-white font-medium text-sm">{m.material}</p>
                            {m.supplier_note && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{m.supplier_note}</p>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{m.unit}</td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <PriceBar low={m.price_low} mid={m.price_mid} high={m.price_high} />
                          <p className="text-[10px] text-slate-500 mt-1">Mid: <span className="text-slate-300 font-medium">{fmtCcy(m.price_mid)}</span></p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">{m.region}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => addToBasket(m)}
                            className="text-slate-500 hover:text-blue-400 transition-colors"
                            title="Add to basket"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedId === m.id && (
                        <tr key={`${m.id}-exp`} className="border-b border-slate-800/40 bg-slate-800/20">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400">
                              {m.price_low && <div><span className="text-slate-500">Low estimate:</span> <span className="text-white">{fmtCcy(m.price_low)} /{m.unit}</span></div>}
                              <div><span className="text-slate-500">Mid price:</span> <span className="text-blue-300 font-semibold">{fmtCcy(m.price_mid)} /{m.unit}</span></div>
                              {m.price_high && <div><span className="text-slate-500">High estimate:</span> <span className="text-white">{fmtCcy(m.price_high)} /{m.unit}</span></div>}
                              <div><span className="text-slate-500">Source:</span> <span className="text-white">{new Date(m.source_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span></div>
                            </div>
                            {m.description && <p className="text-xs text-slate-500 mt-2">{m.description}</p>}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ── Basket panel ──────────────────────────────────────────────────────── */}
      {basketOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setBasketOpen(false)} />
          <div className="relative w-full max-w-md bg-[#111] border-l border-slate-800 flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Material Basket</h2>
                {basketCount > 0 && <span className="text-xs text-slate-400">({basketCount} items)</span>}
              </div>
              <button onClick={() => setBasketOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {basket.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-500 text-sm">Basket is empty</p>
                  <p className="text-slate-600 text-xs mt-1">Click + next to any material</p>
                </div>
              ) : (
                basket.map(b => (
                  <div key={b.material.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{b.material.material}</p>
                        <p className="text-[11px] text-slate-500">{b.material.trade_category} · {b.material.region}</p>
                      </div>
                      <button onClick={() => removeItem(b.material.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(b.material.id, -1)}
                          className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm text-white font-medium w-8 text-center">{b.qty}</span>
                        <button
                          onClick={() => updateQty(b.material.id, 1)}
                          className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-slate-500">{b.material.unit}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{fmtCcy(b.material.price_mid * b.qty)}</p>
                        <p className="text-[10px] text-slate-500">{fmtCcy(b.material.price_mid)} ea.</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {basket.length > 0 && (
              <div className="px-5 py-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Estimated total (ex-VAT)</span>
                  <span className="text-lg font-bold text-white">{fmtCcy(basketTotal)}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Mid-point prices only. Actual cost may vary. Confirm with supplier before ordering.
                </p>
                <button
                  onClick={logAllCosts}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
                >
                  Log all to Job P&L →
                </button>
                <button
                  onClick={() => setBasket([])}
                  className="w-full text-slate-500 hover:text-slate-300 text-xs py-1 transition-colors"
                >
                  Clear basket
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
