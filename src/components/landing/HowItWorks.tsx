import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Upload, Sparkles, FileText, Sparkle } from "lucide-react";
import { staggerContainer, riseItem, staticVariants, revealViewport } from "./motionPrimitives";

const STEPS = [
  {
    n: 1,
    icon: Upload,
    title: "Paste or upload evidence",
    body: "Drop in a suspicious SMS, WhatsApp message, link, or a text file. We redact sensitive data first.",
  },
  {
    n: 2,
    icon: Sparkles,
    title: "Get an instant risk signal",
    body: "AI-assisted extraction highlights key indicators, a risk score, and the patterns behind them.",
  },
  {
    n: 3,
    icon: FileText,
    title: "Save, verify, and report",
    body: "Organize the case, review findings, and export a clean PDF report when you are ready.",
  },
];

/** Dashed connector drawn between step cards on wide screens. */
function Connector() {
  return (
    <div
      className="hidden lg:flex items-center justify-center flex-shrink-0 w-14"
      aria-hidden="true"
    >
      <svg width="46" height="10" viewBox="0 0 46 10" fill="none">
        <path
          d="M1 5h34"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 5"
        />
        <path
          d="M36 1l5 4-5 4"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function HowItWorks() {
  const reduced = useReducedMotion();
  const item = reduced ? staticVariants : riseItem;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="how-it-works">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
      >
        <motion.div variants={item} className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 border border-brand-100 rounded-full text-[11px] font-semibold text-brand-700 mb-4">
            <Sparkle size={11} className="text-brand-600" />
            From suspicion to evidence in three simple steps
          </span>
          <h2 className="text-[30px] sm:text-[38px] font-extrabold text-slate-900 tracking-[-0.025em] leading-tight">
            How <span className="text-brand-600">FraudCase GH</span> works
          </h2>
          <p className="text-[15px] text-slate-500 mt-3 leading-relaxed">
            Collect suspicious messages, let AI extract and verify what matters, then organize
            everything into clean, case-ready reports.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-stretch gap-5 lg:gap-0">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <motion.div
                variants={item}
                className="group flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-brand-200 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-5">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white text-[13px] font-bold shadow-sm shadow-brand-600/30">
                    {s.n}
                  </span>
                  <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/70 border border-brand-100 group-hover:scale-105 transition-transform duration-300">
                    <s.icon size={24} className="text-brand-600" strokeWidth={1.9} />
                  </span>
                </div>
                <h3 className="text-[17px] font-bold text-slate-900 mb-2 tracking-tight">
                  {s.title}
                </h3>
                <p className="text-[13.5px] text-slate-600 leading-relaxed">{s.body}</p>
              </motion.div>
              {i < STEPS.length - 1 && <Connector />}
            </React.Fragment>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
