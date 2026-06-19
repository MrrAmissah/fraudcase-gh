import React from "react";
import { AlertTriangle, Clock, ShieldCheck, CheckSquare } from "lucide-react";
import { FraudAnalysis } from "../types/analysis";
import { getRiskLevel, getScamCategoryLabel } from "../lib/utils/risk";

interface AnalysisSummaryProps {
  analysis: FraudAnalysis;
}

export default function AnalysisSummary({ analysis }: AnalysisSummaryProps) {
  const { scamCategory, confidence, riskScore, shortSummary } = analysis;
  const riskInfo = getRiskLevel(riskScore);

  const getConfidenceStyle = (c: string) => {
    switch (c) {
      case "high":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-705 border-slate-200";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="analysis-summary-block">
      {/* Category Card */}
      <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col justify-between" id="summary-category">
        <div className="space-y-1">
          <span className="text-[11px] font-sans text-slate-400 font-medium block">
            Evaluated category
          </span>
          <h4 className="text-[17px] font-semibold font-sans text-slate-800 tracking-tight leading-snug">
            {getScamCategoryLabel(scamCategory)}
          </h4>
        </div>
        
        <div className="flex items-center gap-2 mt-4 text-xs text-slate-500 font-sans">
          <span>Confidence:</span>
          <span className={`px-2.5 py-0.5 border text-[10.5px] font-semibold font-sans rounded-full uppercase ${getConfidenceStyle(confidence)}`}>
            {confidence}
          </span>
        </div>
      </div>

      {/* Risk Score Card */}
      <div className={`p-5 border rounded-xl shadow-sm bg-white flex flex-col justify-between ${riskInfo.borderColor}`} id="summary-risk-score">
        <div className="space-y-1">
          <span className="text-[11px] font-sans text-slate-400 font-medium block">
            Calculated risk level
          </span>
          <div className="flex items-baseline gap-2">
            <h4 className={`text-[22px] font-bold font-sans ${riskInfo.color}`}>
              {riskInfo.label}
            </h4>
            <span className="text-xs text-slate-400 font-mono">({riskScore}/100)</span>
          </div>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden border border-slate-200">
          <div
            className={`h-full rounded-full ${
              riskScore >= 80 ? "bg-red-500" : riskScore >= 50 ? "bg-orange-500" : "bg-yellow-500"
            }`}
            style={{ width: `${riskScore}%` }}
          />
        </div>
      </div>

      {/* Narrative Summary card */}
      <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm md:col-span-1 flex flex-col justify-between" id="summary-narrative">
        <div className="space-y-1">
          <span className="text-[11px] font-sans text-slate-400 font-medium block">
            Risk assessment narrative
          </span>
          <p className="text-[14px] text-slate-600 leading-relaxed font-sans font-normal line-clamp-3">
            {shortSummary}
          </p>
        </div>
        <span className="text-[10.5px] font-sans text-slate-405 mt-3 block font-normal">
          AI-Assisted Evidence Tool
        </span>
      </div>
    </div>
  );
}
