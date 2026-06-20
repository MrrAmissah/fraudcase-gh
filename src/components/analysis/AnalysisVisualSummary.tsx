import React from "react";
import { Link2, Phone, Banknote, Building2, Hash, Info } from "lucide-react";
import { getRiskLevel, getScamCategoryLabel } from "../../lib/utils/risk";
import { classifyIndicatorSeverity } from "../../lib/utils/indicatorSeverity";
import { ExtractedEntities, ChecklistItem } from "../../types/analysis";
import RiskGauge from "./RiskGauge";

interface AnalysisVisualSummaryProps {
  riskScore: number;
  confidence: string;
  scamCategory: string;
  indicators: string[];
  entities: ExtractedEntities;
  checklist?: ChecklistItem[];
  shortSummary?: string;
}

/**
 * Executive-readable visual summary of an analysis. Every element is a pure rendering of fields
 * that already exist on the analysis (riskScore, confidence, indicators, entities, checklist) —
 * it introduces no new analysis logic and authors no verdict-like prose. The detailed text
 * sections still render below this component.
 */
export default function AnalysisVisualSummary({
  riskScore,
  confidence,
  scamCategory,
  indicators,
  entities,
  checklist,
  shortSummary,
}: AnalysisVisualSummaryProps) {
  const risk = getRiskLevel(riskScore);

  const confLevel = (confidence || "").toLowerCase();
  const confSteps = confLevel === "high" ? 3 : confLevel === "medium" ? 2 : confLevel === "low" ? 1 : 0;

  const list = indicators || [];
  const highCount = list.filter((i) => classifyIndicatorSeverity(i) === "High").length;
  const medCount = list.length - highCount;
  const maxBar = Math.max(highCount, medCount, 1);

  const checks = checklist || [];
  const present = checks.filter((c) => c.status === "present").length;
  const unclear = checks.filter((c) => c.status === "unclear").length;
  const missing = checks.filter((c) => c.status === "missing").length;
  const totalChecks = checks.length;
  const readinessPct = totalChecks ? Math.round((present / totalChecks) * 100) : 0;

  const entityStats = [
    { label: "Links", count: entities?.urls?.length || 0, icon: Link2 },
    { label: "Phones / IDs", count: entities?.phoneNumbers?.length || 0, icon: Phone },
    { label: "Amounts", count: entities?.amounts?.length || 0, icon: Banknote },
    { label: "Orgs", count: entities?.organizations?.length || 0, icon: Building2 },
    { label: "Refs", count: entities?.transactionReferences?.length || 0, icon: Hash },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden" id="analysis-visual-summary">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[14px] font-semibold font-sans text-slate-800 tracking-tight">Analysis at a glance</h4>
          <p className="text-[11.5px] text-slate-500 font-sans mt-0.5">
            Executive summary of the AI-assisted assessment. Verify before acting.
          </p>
        </div>
        <span
          className={`px-2.5 py-1 text-[11px] font-semibold border rounded-lg whitespace-nowrap ${risk.bgColor} ${risk.color} ${risk.borderColor}`}
        >
          {risk.label}
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Risk gauge + possible category */}
        <div className="flex flex-col items-center justify-center text-center border border-slate-100 rounded-lg p-4 bg-slate-50/30">
          <RiskGauge score={riskScore} />
          <span className="mt-2 text-[12px] text-slate-600 font-sans leading-snug">
            Possible category:{" "}
            <span className="font-semibold text-slate-800">{getScamCategoryLabel(scamCategory)}</span>
          </span>
        </div>

        {/* Confidence meter + indicator severity */}
        <div className="space-y-4">
          <div className="border border-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-700 font-sans">Model confidence</span>
              <span className="text-[11px] text-slate-500 font-sans capitalize">{confidence || "n/a"}</span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <div key={n} className={`h-2 flex-1 rounded-full ${n <= confSteps ? "bg-cyan-500" : "bg-slate-200"}`} />
              ))}
            </div>
          </div>

          <div className="border border-slate-100 rounded-lg p-4">
            <span className="text-[12px] font-semibold text-slate-700 font-sans block mb-2">Indicator severity</span>
            <div className="space-y-2">
              <SeverityBar label="High" count={highCount} max={maxBar} color="bg-red-500" />
              <SeverityBar label="Medium" count={medCount} max={maxBar} color="bg-amber-400" />
            </div>
          </div>
        </div>

        {/* Evidence readiness + extracted signals */}
        <div className="space-y-4">
          {totalChecks > 0 && (
            <div className="border border-slate-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-slate-700 font-sans">Evidence readiness</span>
                <span className="text-[11px] text-slate-500 font-sans">
                  {present}/{totalChecks}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${readinessPct}%` }} />
              </div>
              <div className="flex gap-3 mt-2 text-[10.5px] font-sans">
                <span className="text-emerald-600">{present} present</span>
                <span className="text-amber-600">{unclear} unclear</span>
                <span className="text-slate-400">{missing} missing</span>
              </div>
            </div>
          )}

          <div className="border border-slate-100 rounded-lg p-4">
            <span className="text-[12px] font-semibold text-slate-700 font-sans block mb-2">Extracted signals</span>
            <div className="grid grid-cols-3 gap-2">
              {entityStats.map((s) => (
                <div key={s.label} className="bg-slate-50/70 border border-slate-100 rounded-md p-2 text-center">
                  <s.icon size={13} className="text-slate-400 mx-auto" />
                  <div className="text-[15px] font-bold font-mono text-slate-800 leading-none mt-1">{s.count}</div>
                  <div className="text-[9.5px] text-slate-400 font-sans leading-tight mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* What this means — sourced from existing non-accusatory fields only */}
      <div className="px-5 pb-5">
        <div className="flex items-start gap-2.5 p-4 rounded-lg bg-cyan-50/40 border border-cyan-100">
          <Info size={15} className="text-cyan-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-[12.5px] font-semibold text-slate-800 font-sans">What this means</span>
            <p className="text-[12.5px] text-slate-600 font-sans leading-relaxed">
              {risk.description}
              {shortSummary ? ` ${shortSummary}` : ""}
            </p>
            <p className="text-[11px] text-slate-400 font-sans italic">
              AI-assisted indicators, not a determination of guilt. Verify before acting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeverityBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500 font-sans w-14 flex-shrink-0">{label}</span>
      <div className="h-2.5 flex-grow bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${count > 0 ? Math.max(pct, 8) : 0}%` }} />
      </div>
      <span className="text-[11px] font-mono text-slate-600 w-5 text-right flex-shrink-0">{count}</span>
    </div>
  );
}
