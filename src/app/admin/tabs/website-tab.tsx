import type { AdminData } from "../types";

interface Props {
  data: AdminData;
}

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function WebsiteTab({ data }: Props) {
  const { website } = data;

  if (!website.available) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-8 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌐</span>
            <h2 className="text-lg font-semibold text-zinc-100">
              Connect Plausible Analytics
            </h2>
          </div>
          <p className="text-sm text-zinc-400">
            Add{" "}
            <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-sky-300 text-xs font-mono">
              PLAUSIBLE_API_KEY
            </code>{" "}
            to your Vercel environment variables.
          </p>
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-400 text-xs flex items-center justify-center font-semibold">
                1
              </span>
              <span>
                Get your API key from{" "}
                <span className="text-sky-400 font-medium">plausible.io</span> →
                Account → API Keys
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-400 text-xs flex items-center justify-center font-semibold">
                2
              </span>
              <span>
                Add to Vercel:{" "}
                <span className="font-mono text-xs bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                  Settings → Environment Variables → PLAUSIBLE_API_KEY
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-400 text-xs flex items-center justify-center font-semibold">
                3
              </span>
              <span>Redeploy</span>
            </li>
          </ol>
          <div className="rounded-lg bg-zinc-800 border border-zinc-600 px-4 py-3 text-sm text-zinc-400">
            Plausible is already installed on{" "}
            <span className="text-zinc-200 font-medium">constructa.co</span>{" "}
            (tracking active). The API key just enables this admin view.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Unique Visitors (30d)",
            value: website.visitors30d.toLocaleString("en-GB"),
          },
          {
            label: "Page Views",
            value: website.pageviews30d.toLocaleString("en-GB"),
          },
          {
            label: "Bounce Rate",
            value: `${website.bounceRate.toFixed(0)}%`,
          },
          {
            label: "Avg Session Duration",
            value: fmtDuration(website.visitDuration),
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 flex flex-col gap-1"
          >
            <span className="text-xs text-zinc-400 uppercase tracking-wide">
              {kpi.label}
            </span>
            <span className="text-2xl font-bold text-zinc-100">{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* ── Conversion Funnel ── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-4">
          Conversion Funnel
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-center min-w-[100px]">
              <p className="text-xs text-zinc-400">Visitors</p>
              <p className="text-xl font-bold text-zinc-100">
                {website.visitors30d.toLocaleString("en-GB")}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5 flex-1">
            <div className="h-px w-full bg-zinc-600" />
            <span className="text-xs text-sky-400 font-semibold whitespace-nowrap">
              {website.signupConversionRate.toFixed(2)}% conversion
            </span>
            <div className="h-px w-full bg-zinc-600" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="rounded-lg bg-zinc-800 border border-sky-700 px-4 py-3 text-center min-w-[100px]">
              <p className="text-xs text-sky-400">Signups</p>
              <p className="text-xl font-bold text-zinc-100">
                {Math.round(
                  website.visitors30d * (website.signupConversionRate / 100)
                ).toLocaleString("en-GB")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Pages + Traffic Sources ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top Pages */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-3">
            Top Pages
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-1.5 font-medium">Page</th>
                <th className="text-right py-1.5 font-medium">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {website.topPages.map((row) => (
                <tr
                  key={row.page}
                  className="border-b border-zinc-800 last:border-0 text-zinc-300"
                >
                  <td className="py-1.5 font-mono text-xs truncate max-w-[200px]">
                    {row.page}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.visitors.toLocaleString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Traffic Sources */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-3">
            Traffic Sources
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-1.5 font-medium">Source</th>
                <th className="text-right py-1.5 font-medium">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {website.topSources.map((row) => (
                <tr
                  key={row.source}
                  className="border-b border-zinc-800 last:border-0 text-zinc-300"
                >
                  <td className="py-1.5">{row.source}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.visitors.toLocaleString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer note ── */}
      <p className="text-xs text-zinc-500 text-center">
        Data from plausible.io for constructa.co, last 30 days
      </p>
    </div>
  );
}
