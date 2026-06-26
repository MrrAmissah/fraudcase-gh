import React from "react";
import { ShieldAlert, Globe, Lock } from "lucide-react";
import { RiskSignalsViewModel, RiskSeverity } from "../lib/threat-intel/riskSignalsViewModel";

const severityStyle: Record<RiskSeverity, string> = {
  info: "bg-slate-100 text-slate-600 border-slate-200",
  caution: "bg-amber-50 text-amber-700 border-amber-200",
  elevated: "bg-orange-50 text-orange-700 border-orange-200",
  high: "bg-red-50 text-red-700 border-red-200",
};

interface RiskSignalsPanelProps {
  riskSignals?: RiskSignalsViewModel;
}

/**
 * "Risk signals" panel. Renders Tier-0 LOCAL indicators and a separate EXTERNAL reputation section
 * (reads "Not checked" until a provider is enabled). Renders nothing when the feature is off, so it
 * ships dark until THREAT_INTEL_ENABLED. Supporting context only — never presented as proof.
 */
export default function RiskSignalsPanel({ riskSignals }: RiskSignalsPanelProps) {
  if (!riskSignals || !riskSignals.enabled) return null;
  const { localIndicators, external, summary, privacyWarnings } = riskSignals;

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5 space-y-4" id="risk-signals-panel">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-cyan-600" />
        <h4 className="text-[15px] font-semibold font-sans text-slate-800 tracking-tight">Risk signals</h4>
      </div>
      <p className="text-xs text-slate-500 font-sans">{summary}</p>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
          <Lock className="w-3 h-3" /> Local indicators
        </span>
        {localIndicators.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No local indicators detected</p>
        ) : (
          <ul className="space-y-1.5">
            {localIndicators.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 px-2 py-0.5 border rounded-full text-[10px] font-semibold uppercase ${severityStyle[s.severity]}`}>
                  Local indicator
                </span>
                <span className="text-slate-700">
                  <span className="font-medium break-all">{s.safeDisplayValue}</span>
                  <span className="text-slate-500"> — {s.explanation}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
          <Globe className="w-3 h-3" /> External reputation
        </span>
        {external.signals.length === 0 ? (
          <p className="text-xs text-slate-400 italic">{external.label}</p>
        ) : (
          <ul className="space-y-1.5">
            {external.signals.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 px-2 py-0.5 border border-slate-200 rounded-full text-[10px] font-semibold uppercase text-slate-600">
                  {s.provider}
                </span>
                <span className="text-slate-700">
                  <span className="font-medium break-all">{s.safeDisplayValue}</span>
                  <span className="text-slate-500"> — {s.explanation}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {privacyWarnings.length > 0 && (
        <ul className="text-[11px] text-slate-400 space-y-0.5">
          {privacyWarnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-slate-400 italic border-t border-slate-100 pt-2">
        Supporting context only — possible matches that need verification, not proof.
      </p>
    </div>
  );
}
