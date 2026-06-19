import React from "react";
import { Check, X, HelpCircle } from "lucide-react";
import { ChecklistItem } from "../types/analysis";

interface EvidenceChecklistProps {
  checklist: ChecklistItem[];
}

export default function EvidenceChecklist({ checklist }: EvidenceChecklistProps) {
  
  const getStatusBadge = (status: "present" | "missing" | "unclear") => {
    switch (status) {
      case "present":
        return (
          <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-205 text-emerald-800 font-sans text-[11px] font-semibold rounded">
            Present
          </span>
        );
      case "missing":
        return (
          <span className="px-2.5 py-0.5 bg-rose-50 border border-rose-205 text-rose-800 font-sans text-[11px] font-semibold rounded">
            Missing
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-205 text-amber-900 font-sans text-[11px] font-semibold rounded">
            Unclear
          </span>
        );
    }
  };

  const getStatusIcon = (status: "present" | "missing" | "unclear") => {
    switch (status) {
      case "present":
        return <Check size={14} className="text-emerald-600" />;
      case "missing":
        return <X size={14} className="text-rose-500" />;
      default:
        return <HelpCircle size={14} className="text-amber-500" />;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs text-left" id="evidence-checklist-card">
      {/* Header block */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h4 className="text-[14px] font-semibold font-sans text-slate-800 tracking-tight">
          Evidence Readiness Checklist
        </h4>
        <p className="text-[13px] text-slate-500 font-sans font-normal mt-1 leading-normal">
          Identifies outstanding specimens or logs required to compile a robust, formal protective case report.
        </p>
      </div>

      {!checklist || checklist.length === 0 ? (
        <div className="p-6 text-center text-[13.5px] text-slate-400 font-sans font-normal">
          No checklist items generated.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {checklist.map((item, index) => (
            <div
              key={index}
              className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors"
              id={`checklist-item-${index}`}
            >
              <div className="flex items-center gap-3">
                {/* Left icon wrapper */}
                <div className="p-1 bg-slate-50 border border-slate-200 rounded-lg">
                  {getStatusIcon(item.status)}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[13.5px] font-semibold text-slate-800 font-sans">
                    {item.item}
                  </span>
                  <p className="text-[11.5px] text-slate-400 font-sans">
                    {item.note}
                  </p>
                </div>
              </div>

              {/* Right Badge Status */}
              <div className="flex-shrink-0">
                {getStatusBadge(item.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
