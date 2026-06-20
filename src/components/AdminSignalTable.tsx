import React from "react";
import { Eye } from "lucide-react";
import { CommunitySignal } from "../types/communitySignal";
import { getScamCategoryLabel, getRiskLevel } from "../lib/utils/risk";
import { formatDate } from "../lib/utils/dates";
import { REVIEW_STATUS_META } from "../lib/admin/signalStatus";

interface AdminSignalTableProps {
  signals: CommunitySignal[];
  onView: (signal: CommunitySignal) => void;
}

export default function AdminSignalTable({ signals, onView }: AdminSignalTableProps) {
  if (signals.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-[13px] text-slate-400 font-sans">
        No community signals match this view yet.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12.5px] font-sans">
          <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Date</th>
              <th className="px-3 py-2.5 font-semibold">Category</th>
              <th className="px-3 py-2.5 font-semibold">Risk</th>
              <th className="px-3 py-2.5 font-semibold">Confidence</th>
              <th className="px-3 py-2.5 font-semibold">Sender / domain</th>
              <th className="px-3 py-2.5 font-semibold">Top indicator</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {signals.map((s) => {
              const risk = getRiskLevel(s.riskScore);
              const meta = REVIEW_STATUS_META[s.reviewedStatus] || REVIEW_STATUS_META.pending;
              const sender = s.maskedPhone || s.normalizedDomain || s.normalizedSender || "—";
              const topIndicator = s.possibleFraudIndicators?.[0] || "—";
              return (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{getScamCategoryLabel(s.scamCategory)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`font-mono font-semibold ${risk.color}`}>{s.riskScore}</span>
                    <span className="text-slate-400">/100</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 capitalize">{s.confidence}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-600 max-w-[150px] truncate" title={sender}>
                    {sender}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-[220px] truncate" title={topIndicator}>
                    {topIndicator}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 text-[11px] rounded-full border font-medium whitespace-nowrap ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => onView(s)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded text-slate-600 cursor-pointer"
                    >
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
