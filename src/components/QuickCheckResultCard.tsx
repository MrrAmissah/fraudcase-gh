import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Copy,
  Check,
  UserPlus,
  FolderPlus,
  Share2,
  RotateCcw,
  ListChecks,
} from "lucide-react";
import { QuickCheckResult } from "../types/quickCheck";
import { getRiskLevel, getScamCategoryLabel } from "../lib/utils/risk";
import SuspiciousIndicators from "./SuspiciousIndicators";
import ExtractedEntitiesTable from "./ExtractedEntitiesTable";

interface QuickCheckResultCardProps {
  result: QuickCheckResult;
  onCreateAccount: () => void;
  onStartFullCase: () => void;
  onNewCheck: () => void;
}

export default function QuickCheckResultCard({
  result,
  onCreateAccount,
  onStartFullCase,
  onNewCheck,
}: QuickCheckResultCardProps) {
  const [copied, setCopied] = useState(false);
  const risk = getRiskLevel(result.riskScore);
  const hasWarnings = result.redactionWarnings && result.redactionWarnings.length > 0;

  const handleCopy = async () => {
    const summary = [
      `FraudCase GH — Quick Check result`,
      `Possible category: ${getScamCategoryLabel(result.scamCategory)}`,
      `Risk signal: ${risk.label} (${result.riskScore}/100, ${result.confidence} confidence)`,
      ``,
      `Summary: ${result.shortSummary}`,
      ``,
      `Possible fraud indicators:`,
      ...result.possibleFraudIndicators.map((i) => `  - ${i}`),
      ``,
      `Recommended next steps:`,
      ...result.recommendedNextSteps.map((s) => `  - ${s}`),
      ``,
      result.disclaimer,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className="space-y-5" id="quick-check-result">
      {/* 1. Risk summary header */}
      <div className={`p-5 rounded-xl border ${risk.borderColor} ${risk.bgColor}`} id="quick-check-risk-summary">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-500">
              Quick Check risk signal
            </span>
            <div className="flex items-center gap-2">
              <h3 className={`text-[20px] font-bold font-sans tracking-tight ${risk.color}`}>
                {risk.label}
              </h3>
              <span className="text-[12px] text-slate-500 font-sans">
                {result.confidence} confidence
              </span>
            </div>
            <p className="text-[12.5px] text-slate-600 font-sans">
              Possible category: <span className="font-semibold text-slate-700">{getScamCategoryLabel(result.scamCategory)}</span>
            </p>
          </div>
          <div className="flex items-baseline gap-1 sm:flex-col sm:items-end">
            <span className={`text-[30px] font-bold font-mono leading-none ${risk.color}`}>{result.riskScore}</span>
            <span className="text-[12px] text-slate-400 font-sans">/100</span>
          </div>
        </div>
        <p className="text-[13px] text-slate-600 font-sans leading-relaxed mt-3 pt-3 border-t border-slate-200/70">
          {result.shortSummary}
        </p>
      </div>

      {/* 2. Sensitive data warning (reflects the original input) */}
      <div
        className={`p-3.5 rounded-lg border flex items-start gap-2.5 ${
          hasWarnings ? "bg-amber-50/60 border-amber-200" : "bg-emerald-50/50 border-emerald-150"
        }`}
        id="quick-check-redaction-status"
      >
        {hasWarnings ? (
          <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="space-y-0.5">
          <p className="text-[12.5px] font-semibold font-sans text-slate-700">
            {hasWarnings ? "Sensitive data was masked before analysis" : "No sensitive data detected"}
          </p>
          {hasWarnings && (
            <ul className="text-[11.5px] text-slate-600 font-sans list-disc pl-4 space-y-0.5">
              {result.redactionWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 3. Possible fraud indicators (reused component) */}
      <SuspiciousIndicators indicators={result.possibleFraudIndicators} />

      {/* 4. Extracted entities (reused component, conservative server-side extraction) */}
      <ExtractedEntitiesTable entities={result.extractedEntities} />

      {/* 5. Recommended next steps */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
          <ListChecks size={15} className="text-cyan-600" />
          <h4 className="text-[14px] font-semibold font-sans text-slate-800 tracking-tight">
            Safe recommended next steps
          </h4>
        </div>
        <ul className="divide-y divide-slate-100">
          {result.recommendedNextSteps.map((step, i) => (
            <li key={i} className="p-4 text-[13px] text-slate-700 font-sans leading-relaxed flex gap-2.5">
              <span className="text-cyan-600 font-semibold flex-shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 6. Actions */}
      <div className="p-5 bg-cyan-50/40 border border-cyan-100 rounded-xl space-y-3" id="quick-check-actions">
        <h4 className="text-[14px] font-semibold text-slate-800 font-sans tracking-tight">What next?</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onCreateAccount}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-semibold cursor-pointer transition-all"
            id="quick-check-create-account"
          >
            <UserPlus size={14} />
            Create a free account to save cases
          </button>
          <button
            onClick={onStartFullCase}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 rounded-lg text-xs font-sans font-semibold cursor-pointer transition-all"
            id="quick-check-start-case"
          >
            <FolderPlus size={14} className="text-slate-500" />
            Start a full case
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 rounded-lg text-xs font-sans font-semibold cursor-pointer transition-all"
            id="quick-check-copy"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-slate-500" />}
            {copied ? "Copied" : "Copy summary"}
          </button>
          <button
            disabled
            title="Anonymous community fraud signals are coming soon."
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-lg text-xs font-sans font-semibold cursor-not-allowed"
            id="quick-check-share-signal"
          >
            <Share2 size={14} />
            Share redacted signal (coming soon)
          </button>
          <button
            onClick={onNewCheck}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-500 hover:text-slate-800 rounded-lg text-xs font-sans font-medium cursor-pointer transition-all"
            id="quick-check-new"
          >
            <RotateCcw size={13} />
            New check
          </button>
        </div>
        <p className="text-[11px] text-slate-500 font-sans leading-normal">
          Nothing from this Quick Check has been saved. Create a free account if you want to keep a
          private case and add more evidence.
        </p>
      </div>

      {/* 7. Disclaimer */}
      <p className="text-[11.5px] text-slate-500 font-sans leading-relaxed italic border-t border-slate-150 pt-4">
        {result.disclaimer}
      </p>
    </div>
  );
}
