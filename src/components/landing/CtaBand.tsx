import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Search, ArrowRight, Lock, ShieldCheck, MessageSquare } from "lucide-react";
import { staggerContainer, riseItem, scaleItem, staticVariants, revealViewport } from "./motionPrimitives";

interface CtaBandProps {
  onGetStarted: () => void;
  onQuickCheck?: () => void;
}

/** Abstract case-summary artwork for the closing band. Decorative only. */
function CtaArtwork() {
  return (
    <div className="relative hidden lg:block" aria-hidden="true">
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-bold tracking-[0.14em] text-slate-400 uppercase">
            Case Summary
          </span>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg width="82" height="82" viewBox="0 0 82 82" className="-rotate-90">
              <circle cx="41" cy="41" r="33" fill="none" stroke="#f1f5f9" strokeWidth="9" />
              <circle
                cx="41"
                cy="41"
                r="33"
                fill="none"
                stroke="url(#ctaGauge)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 33}
                strokeDashoffset={2 * Math.PI * 33 * 0.12}
              />
              <defs>
                <linearGradient id="ctaGauge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-[20px] font-extrabold font-mono text-slate-900">88</span>
              <span className="text-[8.5px] text-slate-400 mt-0.5">/100</span>
            </div>
          </div>
          <div className="flex-grow space-y-2">
            <div className="h-2 bg-slate-100 rounded-full w-full" />
            <div className="h-2 bg-slate-100 rounded-full w-4/5" />
            <div className="flex gap-1.5 pt-0.5">
              <span className="h-4 w-16 bg-red-50 border border-red-100 rounded" />
              <span className="h-4 w-14 bg-amber-50 border border-amber-100 rounded" />
            </div>
          </div>
        </div>

        <div className="text-[10px] font-bold text-red-600 tracking-wide">CRITICAL RISK</div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <ShieldCheck size={11} className="text-brand-500 flex-shrink-0" />
              <div className="h-1.5 bg-slate-100 rounded-full flex-grow" style={{ maxWidth: `${88 - i * 14}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Floating message chip */}
      <div className="absolute -left-12 -bottom-8 w-[190px] bg-white border border-slate-200 rounded-xl shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <MessageSquare size={10} className="text-white" />
          </span>
          <div className="h-1.5 bg-slate-100 rounded-full flex-grow" />
          <span className="text-[8.5px] text-slate-400 flex-shrink-0">10:42 AM</span>
        </div>
        <div className="text-[9.5px] text-red-600 font-medium">Potential delivery scam</div>
      </div>
    </div>
  );
}

export default function CtaBand({ onGetStarted, onQuickCheck }: CtaBandProps) {
  const reduced = useReducedMotion();
  const item = reduced ? staticVariants : riseItem;
  const art = reduced ? staticVariants : scaleItem;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="cta-band">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        className="relative bg-gradient-to-br from-white via-brand-50/50 to-brand-100/40 border border-slate-200 rounded-3xl px-6 py-12 sm:px-12 lg:px-14 shadow-sm overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-50"
          aria-hidden="true"
          style={{
            backgroundImage: "radial-gradient(circle, #bfdbfe 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 70% 70% at 85% 40%, black 0%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 85% 40%, black 0%, transparent 70%)",
          }}
        />

        <div className="relative grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 lg:gap-14 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <motion.h2
              variants={item}
              className="text-[30px] sm:text-[38px] font-extrabold text-slate-900 tracking-[-0.025em] leading-[1.1]"
            >
              Ready to turn suspicious messages into a{" "}
              <span className="text-brand-600">clear case report?</span>
            </motion.h2>

            <motion.p variants={item} className="text-[15.5px] text-slate-600 leading-relaxed max-w-lg mx-auto lg:mx-0">
              Check a suspicious message in seconds, organize the evidence privately, and prepare a
              report you can trust.
            </motion.p>

            <motion.div
              variants={item}
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3"
            >
              {onQuickCheck && (
                <button
                  onClick={onQuickCheck}
                  id="cta-quick-check-btn"
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[15px] font-semibold shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                >
                  <Search size={18} />
                  Quick Check a message
                </button>
              )}
              <button
                onClick={onGetStarted}
                id="cta-workspace-btn"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-[15px] font-semibold shadow-sm border border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                Open private workspace
                <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

            <motion.div
              variants={item}
              className="flex items-center justify-center lg:justify-start gap-2 text-[12px] text-slate-500"
            >
              <Lock size={12.5} className="text-brand-600 flex-shrink-0" />
              Sensitive details are masked before analysis. Quick Check stores nothing.
            </motion.div>
          </div>

          <motion.div variants={art} className="lg:pl-6">
            <CtaArtwork />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
