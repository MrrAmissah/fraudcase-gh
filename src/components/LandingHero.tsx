import React from "react";
import { motion } from "motion/react";
import { ShieldCheck, FileSpreadsheet, Search, ArrowRight, Upload, Lock, Sparkles, AlertCircle } from "lucide-react";
import RiskGauge from "./analysis/RiskGauge";

interface LandingHeroProps {
  onGetStarted: () => void;
  onQuickCheck?: () => void;
}

const STEPS = [
  { n: 1, icon: Upload, title: "Paste or upload", body: "Drop in a suspicious SMS, WhatsApp message, link, or a text file. Sensitive data is redacted first." },
  { n: 2, icon: Sparkles, title: "Get an instant risk signal", body: "AI-assisted indicators, a risk score, and extracted signals, all grounded in your evidence and never invented." },
  { n: 3, icon: FileSpreadsheet, title: "Save & report", body: "Keep it in a private case, add more evidence, and export a clean PDF report when you're ready." },
];

export default function LandingHero({ onGetStarted, onQuickCheck }: LandingHeroProps) {
  return (
    <div className="space-y-20 py-10" id="landing-hero-block">
      {/* HERO — two columns: copy + product mockup */}
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 text-center lg:text-left"
        >
          <div className="inline-flex items-center px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-[11px] text-slate-600 font-sans font-medium shadow-xs">
            Investigation support · no sign-up to start
          </div>

          <h1
            className="text-[34px] sm:text-[42px] lg:text-[50px] font-bold text-slate-900 font-sans tracking-tight leading-[1.08]"
            id="hero-title"
          >
            From scattered scam messages to a{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">
              clear case report
            </span>
            .
          </h1>

          <p className="text-[15.5px] text-slate-600 font-sans max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Check a suspicious SMS, WhatsApp message, or link in seconds, then keep the evidence
            organized, private, and report-ready.
          </p>

          <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 pt-1">
            {onQuickCheck && (
              <button
                onClick={onQuickCheck}
                id="hero-quick-check-btn"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[15px] font-semibold shadow-md border border-cyan-500 hover:scale-[1.02] transition-all duration-150 cursor-pointer"
              >
                <Search size={18} />
                Quick Check a message
              </button>
            )}
            <button
              onClick={onGetStarted}
              id="hero-get-started-btn"
              className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-[15px] font-semibold shadow-sm border border-slate-250 hover:border-slate-300 transition-all duration-150 cursor-pointer"
            >
              Open a private workspace
              <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-2 text-[11.5px] text-slate-500 font-sans">
            <Lock size={12} className="text-cyan-600 flex-shrink-0" />
            <span>Sensitive data is redacted before analysis. Quick Check stores nothing.</span>
          </div>
        </motion.div>

        {/* Product mockup (static, illustrative) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative"
          id="hero-mockup"
        >
          <div className="absolute -inset-3 bg-gradient-to-br from-cyan-100/40 to-blue-100/30 rounded-3xl blur-xl" aria-hidden="true" />
          <div className="relative bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search size={15} className="text-cyan-600" />
                <span className="text-[12px] font-semibold text-slate-700 font-sans">Quick Check result</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-md">
                High risk
              </span>
            </div>

            <div className="flex items-center gap-4">
              <RiskGauge score={88} size={108} />
              <div className="space-y-1.5 flex-grow">
                <div className="text-[11px] text-slate-500 font-sans">Possible category</div>
                <div className="text-[13px] font-semibold text-slate-800 font-sans leading-snug">
                  Fake delivery / courier fee
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 text-[10px] bg-red-50 text-red-700 border border-red-200 rounded">
                    Brand impersonation
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded">
                    Unofficial domain
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-500 font-sans">
              <ShieldCheck size={13} className="text-cyan-600 flex-shrink-0" />
              <span>
                Sensitive details masked before analysis, e.g. <span className="font-mono">024***456</span>
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* HOW IT WORKS — 3 steps */}
      <div className="max-w-5xl mx-auto" id="how-it-works">
        <div className="text-center mb-8">
          <h2 className="text-[22px] font-bold text-slate-900 font-sans tracking-tight">How it works</h2>
          <p className="text-[13.5px] text-slate-500 font-sans mt-1">
            Three steps from a suspicious message to a clear report.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-[11px] font-bold font-sans">
                  {s.n}
                </span>
                <s.icon size={16} className="text-cyan-600" />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-800 font-sans mb-1">{s.title}</h3>
              <p className="text-[13px] text-slate-600 font-sans leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AMBER SAFETY DISCLAIMER */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="max-w-4xl mx-auto p-5 border border-amber-200 rounded-xl bg-amber-50/70 flex items-start gap-3.5 shadow-sm"
        id="legal-disclaimer-box"
      >
        <div className="text-amber-600 p-1.5 bg-amber-100 border border-amber-250 rounded-lg mt-0.5 flex-shrink-0">
          <AlertCircle size={18} />
        </div>
        <p className="text-[13.5px] text-slate-700 leading-relaxed font-sans">
          <strong className="text-amber-800">FraudCase GH organizes user-provided evidence into clear reports.</strong>{" "}
          It is AI-assisted decision support. It does not determine guilt, provide legal advice, or replace an
          official investigation. To file an official report, contact your bank, telecom operator, or the relevant
          authorities directly.
        </p>
      </motion.div>
    </div>
  );
}
