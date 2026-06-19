import React from "react";
import { ShieldCheck, Zap, Lock } from "lucide-react";

/**
 * Compact hero for the public Quick Check page. Deliberately simpler than the private
 * workspace — fast input → result, with a visible privacy note.
 */
export default function QuickCheckHero() {
  return (
    <div className="text-center space-y-4 max-w-2xl mx-auto" id="quick-check-hero">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-50 border border-cyan-150 rounded-full text-[11px] text-cyan-700 font-sans font-semibold">
        <Zap size={12} className="text-cyan-600" />
        No sign-up needed
      </div>

      <h1 className="text-[28px] sm:text-[34px] font-bold text-slate-900 font-sans tracking-tight leading-tight">
        Quick Check a{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">
          suspicious message
        </span>
      </h1>

      <p className="text-[14.5px] text-slate-600 font-sans leading-relaxed max-w-xl mx-auto">
        Paste a suspicious SMS, WhatsApp message, or link and get a quick AI-assisted risk
        signal before deciding what to do. This is a first-scan helper — not an accusation,
        and not an official report.
      </p>

      <div className="inline-flex items-start gap-2 text-left px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg max-w-xl">
        <Lock size={14} className="text-cyan-600 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-slate-600 font-sans leading-normal">
          <span className="font-semibold text-slate-700">Privacy first.</span> Your message is
          redacted before any AI analysis, and nothing is stored unless you choose to save it as a
          private case.
        </p>
      </div>
    </div>
  );
}
