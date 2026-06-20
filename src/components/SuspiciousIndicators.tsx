import React from "react";
import { AlertCircle } from "lucide-react";

interface SuspiciousIndicatorsProps {
  indicators: string[];
}

export default function SuspiciousIndicators({ indicators }: SuspiciousIndicatorsProps) {
  const getSeverityAndDetails = (text: string) => {
    const norm = text.toLowerCase();
    let severity: "High" | "Medium" | "Low" = "Medium";
    let badgeColor = "bg-amber-50 text-amber-700 border-amber-200";

    if (norm.includes("critical") || norm.includes("urgent") || norm.includes("fake") || norm.includes("phish") || norm.includes("impersonat") || norm.includes("momo")) {
      severity = "High";
      badgeColor = "bg-red-50 text-red-700 border-red-200";
    } else if (norm.includes("verify") || norm.includes("unclear") || norm.includes("missing") || norm.includes("request")) {
      severity = "Medium";
      badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
    }
    // Unmatched indicators keep the initialized "Medium" severity. We deliberately do NOT default
    // to "Low": indicator strings on real fraud (e.g. delivery/courier scams) often lack the high-
    // risk trigger words above, and badging them "Low" understates the danger for the reader.

    // Ensure careful wording constraints
    let cleanedText = text
      .replace(/\bconfirmed scammer\b/gi, "potential unauthorized sender")
      .replace(/\bverified fraudster\b/gi, "possible unregistered node")
      .replace(/\bscammer\b/gi, "potential impersonator")
      .replace(/\bguilty party\b/gi, "risk target")
      .replace(/\bguilty\b/gi, "elevated risk profile")
      .replace(/\bcriminal\b/gi, "suspicious signature")
      .replace(/\bofficially verified\b/gi, "pattern matched");

    let source = "AI-assisted pattern match";
    if (norm.includes("sms")) {
      source = "Extracted from SMS specimen";
    } else if (norm.includes("whatsapp")) {
      source = "Extracted from WhatsApp specimen";
    } else if (norm.includes("url") || norm.includes("link") || norm.includes("domain")) {
      source = "Discovered web endpoint";
    } else if (norm.includes("receipt") || norm.includes("momo")) {
      source = "Extracted from MoMo slip data";
    }

    return { severity, badgeColor, cleanedText, source };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs" id="indicators-intel-panel">
      {/* Header block */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h4 className="text-[14px] font-semibold font-sans text-slate-800 tracking-tight text-left">
          Possible Fraud Indicators
        </h4>
        <p className="text-[13px] text-slate-500 font-sans font-normal mt-1 leading-normal text-left">
          Identified behavior patterns and security anomalies matching known smishing and delivery scams.
        </p>
      </div>

      {!indicators || indicators.length === 0 ? (
        <div className="p-6 text-center text-[13.5px] text-slate-405 font-sans font-normal bg-white">
          No specific possible fraud indicators detected.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 font-sans bg-white">
          {indicators.map((indicator, index) => {
            const { severity, badgeColor, cleanedText, source } = getSeverityAndDetails(indicator);
            return (
              <div
                key={index}
                className="p-4 flex flex-col sm:flex-row sm:items-start gap-3 justify-between hover:bg-slate-50/50 transition-colors text-left"
                id={`suspect-indicator-${index}`}
              >
                <div className="space-y-1.5 flex-grow pr-4">
                  <p className="text-[13.5px] text-slate-700 leading-relaxed font-normal">
                    {cleanedText}
                  </p>
                  <div className="text-[11px] text-slate-400 font-sans flex items-center gap-1.5">
                    <span>Source: {source}</span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <span className={`px-2.5 py-0.5 text-[11px] font-semibold border rounded-lg ${badgeColor}`}>
                    {severity} Risk
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
