import React from "react";
import { Folder, Calendar, FileText, AlertTriangle, ArrowRight } from "lucide-react";
import { FraudCase, CaseStatus } from "../types/fraudCase";
import { formatDate } from "../lib/utils/dates";
import { getRiskLevel } from "../lib/utils/risk";

interface CaseCardProps {
  key?: string;
  fraudCase: FraudCase;
  onOpen: (id: string) => void;
}

export default function CaseCard({ fraudCase, onOpen }: CaseCardProps) {
  const { id, title, description, status, incidentDate, createdAt, evidenceItems, analysis } = fraudCase;
  
  // Custom styling for status tags in light mode Professional Polish theme
  const getStatusBadge = (s: CaseStatus) => {
    switch (s) {
      case "analyzed":
        return (
          <span className="px-2 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-800 font-sans text-[11px] font-medium rounded-md">
            AI-Analyzed
          </span>
        );
      case "reviewed":
        return (
          <span className="px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-800 font-sans text-[11px] font-medium rounded-md">
            Reviewed
          </span>
        );
      case "exported":
        return (
          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-sans text-[11px] font-medium rounded-md">
            Exported
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-705 font-sans text-[11px] font-medium rounded-md">
            Active Draft
          </span>
        );
    }
  };

  const riskInfo = analysis ? getRiskLevel(analysis.riskScore) : null;
  const cardSummary = analysis?.shortSummary || description;

  return (
    <div
      onClick={() => onOpen(id)}
      className="p-6 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 cursor-pointer group flex flex-col justify-between h-56 shadow-sm relative overflow-hidden"
      id={`case-card-${id}`}
    >
      {/* Background accent subtle highlight */}
      {riskInfo && (
        <div className={`absolute top-0 right-0 w-2 h-full ${riskInfo.color.replace('text-', 'bg-')}`} />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Folder size={12} className="text-slate-400" />
            <span>ID: {id.slice(-8).toUpperCase()}</span>
          </div>
          {getStatusBadge(status)}
        </div>

        <h3 className="text-[16px] font-semibold text-slate-800 group-hover:text-cyan-600 transition-colors tracking-tight line-clamp-1 font-sans">
          {title}
        </h3>

        <p className="text-[13.5px] text-slate-500 leading-relaxed font-sans line-clamp-2">
          {cardSummary}
        </p>
      </div>

      <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between text-[13px] text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>{incidentDate ? formatDate(incidentDate) : formatDate(createdAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText size={12} />
            <span>{evidenceItems.length} item{evidenceItems.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        {/* Risk meter snippet if analyzed */}
        {analysis && riskInfo ? (
          <div className="flex items-center gap-1">
            <AlertTriangle size={11} className={riskInfo.color} />
            <span className={`font-mono text-[11px] font-bold ${riskInfo.color}`}>
              {analysis.riskScore}%
            </span>
          </div>
        ) : (
          <span className="opacity-0 group-hover:opacity-100 text-cyan-600 font-mono flex items-center gap-1 transition-all">
            Open <ArrowRight size={12} />
          </span>
        )}
      </div>
    </div>
  );
}
