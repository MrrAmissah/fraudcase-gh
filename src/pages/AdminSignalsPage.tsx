import React, { useState, useEffect, useCallback } from "react";
import { ShieldX, RefreshCw, Lock } from "lucide-react";
import { listCommunitySignals, updateCommunitySignal, AdminAccessError } from "../lib/admin/adminClient";
import { CommunitySignal, CommunitySignalsResponse, ReviewedStatus } from "../types/communitySignal";
import AdminSignalTable from "../components/AdminSignalTable";
import AdminSignalDetailDrawer from "../components/AdminSignalDetailDrawer";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "useful", label: "Useful" },
  { value: "false_positive", label: "False positive" },
];

function StatCard({ label, value, accent }: { label: string; value?: number; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
      <span className="block text-[10.5px] text-slate-400 uppercase tracking-wide font-sans">{label}</span>
      <span className={`block text-[22px] font-bold font-mono mt-0.5 ${accent || "text-slate-800"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/**
 * Admin-only Community Signals dashboard. Renders an access-denied state on 403 (the
 * server enforces admin access; hiding the nav link is cosmetic only).
 */
export default function AdminSignalsPage() {
  const [data, setData] = useState<CommunitySignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<CommunitySignal | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCommunitySignals(status ? { status } : {});
      setData(res);
    } catch (err: any) {
      if (err instanceof AdminAccessError) setAccessDenied(true);
      else setError(err?.message || "Could not load community signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter, load]);

  const handleSave = async (updates: { reviewedStatus?: ReviewedStatus; adminNote?: string }) => {
    if (!selected) return;
    const updated = await updateCommunitySignal(selected.id, updates);
    setSelected(updated);
    await load(statusFilter); // refresh table + stats
  };

  if (accessDenied) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-3" id="admin-access-denied">
        <div className="p-3 bg-red-50 border border-red-150 rounded-full w-fit mx-auto text-red-500">
          <ShieldX size={26} />
        </div>
        <h2 className="text-[18px] font-semibold text-slate-800 font-sans">Admin access required</h2>
        <p className="text-[13px] text-slate-500 font-sans">
          This area is limited to authorized reviewers. If you believe this is an error, contact your
          administrator.
        </p>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="w-full max-w-[1240px] mx-auto space-y-5" id="admin-signals-page">
      <div className="space-y-1">
        <h1 className="text-[22px] font-bold text-slate-900 font-sans tracking-tight">Community Fraud Signals</h1>
        <p className="text-[13px] text-slate-500 font-sans">
          Redacted first-scan signals shared anonymously for possible-pattern review.
        </p>
      </div>

      <div className="flex items-start gap-2 text-[12px] text-slate-600 bg-cyan-50/50 border border-cyan-100 rounded-lg px-3 py-2 font-sans">
        <Lock size={14} className="text-cyan-600 flex-shrink-0 mt-0.5" />
        <span>
          These are redacted community signals, not official reports or confirmed fraud cases. No raw
          identifiers, files, or private case data are shown here.
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats?.total} />
        <StatCard label="Pending" value={stats?.pending} accent="text-amber-600" />
        <StatCard label="Useful" value={stats?.useful} accent="text-emerald-600" />
        <StatCard label="Reviewed" value={stats?.reviewed} accent="text-cyan-700" />
        <StatCard label="False positive" value={stats?.falsePositive} />
        <StatCard label="High-risk (≥50)" value={stats?.highRisk} accent="text-red-500" />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 text-[12px] rounded-lg border font-sans cursor-pointer ${
                statusFilter === f.value
                  ? "bg-slate-100 border-slate-300 text-slate-800 font-medium"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(statusFilter)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer font-sans"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="text-[12px] text-red-600 bg-red-50/60 border border-red-150 px-3 py-2 rounded-lg font-sans">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="py-16 text-center text-slate-400 font-sans text-[13px] flex flex-col items-center gap-3">
          <RefreshCw size={26} className="animate-spin text-cyan-600" />
          Loading signals…
        </div>
      ) : (
        <AdminSignalTable signals={data?.signals || []} onView={setSelected} />
      )}

      {selected && (
        <AdminSignalDetailDrawer signal={selected} onClose={() => setSelected(null)} onSave={handleSave} />
      )}
    </div>
  );
}
