import React from "react";
import {
  Home,
  Activity,
  Calendar,
  FileText,
  Download,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import RiskGauge from "../analysis/RiskGauge";

/**
 * Static illustration of a Quick Check result, used as the hero visual.
 *
 * This is artwork, not a live view: the numbers are fixed sample values chosen to
 * match the reference design. It renders the real RiskGauge so the hero and the
 * product agree on how a score is drawn.
 */

const NAV = [
  { icon: Home, label: "Overview", active: true },
  { icon: Activity, label: "Indicators" },
  { icon: Calendar, label: "Evidence" },
  { icon: FileText, label: "Report" },
  { icon: Download, label: "Export" },
];

const INDICATORS = [
  { label: "Sender impersonation", level: "High" },
  { label: "Suspicious link detected", level: "High" },
  { label: "Urgency / payment request", level: "Medium" },
];

export default function QuickCheckMockup() {
  return (
    <div className="relative" aria-hidden="true">
      {/* Ambient glow behind the card */}
      <div
        className="absolute -inset-6 bg-gradient-to-br from-brand-200/40 via-brand-100/30 to-transparent rounded-[2rem] blur-2xl"
      />

      {/* Main product card */}
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-[0_24px_60px_-20px_rgba(15,23,42,0.28)] overflow-hidden">
        <div className="flex">
          {/* Mini sidebar */}
          <div className="hidden sm:flex flex-col gap-0.5 w-[132px] flex-shrink-0 border-r border-slate-100 bg-slate-50/60 p-2.5">
            {NAV.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium ${
                  item.active
                    ? "bg-white text-brand-700 shadow-xs border border-slate-200"
                    : "text-slate-500"
                }`}
              >
                <item.icon size={13} className={item.active ? "text-brand-600" : "text-slate-400"} />
                {item.label}
              </div>
            ))}
          </div>

          {/* Result body */}
          <div className="flex-grow p-4 sm:p-5 space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-slate-900">Quick Check result</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-md whitespace-nowrap">
                High risk
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Sized via the prop rather than a CSS transform: `scale` would still
                  reserve the full-size layout box and open a gap beside the gauge. */}
              <div className="flex-shrink-0">
                <RiskGauge score={88} size={86} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="text-[11px] text-slate-500">Possible category</div>
                <div className="text-[14px] font-medium text-slate-900 leading-snug">
                  Fake delivery / courier fee
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className="px-2 py-0.5 text-[10px] bg-red-50 text-red-700 border border-red-200 rounded">
                    Brand impersonation
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded">
                    Unofficial domain
                  </span>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="text-[10.5px] font-medium text-slate-700">Top risk indicators</div>
                {INDICATORS.map((ind) => (
                  <div key={ind.label} className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-slate-600 truncate">{ind.label}</span>
                    <span
                      className={`text-[10px] font-semibold flex-shrink-0 ${
                        ind.level === "High" ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {ind.level}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border border-slate-200 rounded-lg p-3 space-y-2.5">
                <div className="text-[10.5px] font-medium text-slate-700">Extracted indicator</div>
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-400">Link</div>
                  <div className="text-[10.5px] text-brand-600 font-mono truncate">
                    hxxps://fast-delivery-gh.com/pay
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-400">Sender</div>
                  <div className="text-[10.5px] text-slate-600 font-mono">+233 24 *** ** 456</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-brand-50 border border-brand-100 rounded-lg">
              <ShieldCheck size={13} className="text-brand-600 flex-shrink-0 mt-px" />
              <div className="min-w-0">
                <div className="text-[10.5px] text-brand-900 font-medium leading-snug">
                  All sensitive details are automatically masked before analysis.
                </div>
                <div className="text-[10px] text-brand-700/70 leading-snug">
                  e.g. names, account numbers, IDs, phone numbers.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating message bubble. Positioned clear of the card's top edge so it
          frames the mockup instead of covering its content. */}
      <div className="hidden lg:block absolute -right-10 -top-20 w-[200px] rotate-[3deg]">
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </span>
            <span className="text-[9px] text-slate-400 font-mono">+233 24 *** ** 456</span>
          </div>
          <div className="bg-slate-100 rounded-lg rounded-tl-sm p-2.5">
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Your package delivery requires a small fee to be re-attempted. Pay now to avoid delay:{" "}
              <span className="text-brand-600 underline">bit.ly/fastpay</span>
            </p>
          </div>
          <div className="text-[8.5px] text-slate-400 text-right">10:24 AM</div>
        </div>
      </div>

      {/* Floating evidence counter, sitting below the card's bottom edge */}
      <div className="hidden lg:flex absolute -right-6 -bottom-8 items-center gap-2.5 bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-3">
        <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-lg">
          <FileSpreadsheet size={15} className="text-brand-600" />
        </div>
        <div className="leading-none">
          <div className="text-[9px] text-slate-400 mb-1">Evidence items</div>
          <div className="text-[17px] font-bold text-slate-900 leading-none">12</div>
        </div>
      </div>

    </div>
  );
}
