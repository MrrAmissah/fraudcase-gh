import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Search, ArrowRight } from "lucide-react";
import QuickCheckMockup from "./QuickCheckMockup";
import RotatingHeadline from "./RotatingHeadline";
import { staggerContainer, riseItem, scaleItem, staticVariants } from "./motionPrimitives";

interface HeroSectionProps {
  onGetStarted: () => void;
  onQuickCheck?: () => void;
}

export default function HeroSection({ onGetStarted, onQuickCheck }: HeroSectionProps) {
  const reduced = useReducedMotion();
  const item = reduced ? staticVariants : riseItem;
  const art = reduced ? staticVariants : scaleItem;

  return (
    <section className="relative overflow-hidden" id="hero">
      {/* Soft canvas wash and a dotted texture, both purely decorative */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-brand-50/60 via-white to-white"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.6]"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 70% 60% at 20% 30%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 20% 30%, black 0%, transparent 70%)",
        }}
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-24 lg:pb-16"
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-12 lg:gap-16 items-center">
          {/* Copy column */}
          <div className="space-y-6 text-center lg:text-left">
            <motion.div variants={item}>
              {/* Solid chip on dark slate, text only. The shield icon it used to
                  carry already appears several times further down the page. */}
              <span className="inline-flex items-center px-4 py-2 bg-slate-900 rounded-full shadow-lg shadow-slate-900/20">
                <span className="text-[11.5px] font-medium text-white tracking-[0.06em] uppercase">
                  Private. Secure. Investigator-ready.
                </span>
              </span>
            </motion.div>

            {/* min-h reserves two lines so the typing cycle does not shove the
                paragraph and buttons up and down as message lengths change. */}
            <motion.div variants={item}>
              <RotatingHeadline className="text-[38px] sm:text-[48px] lg:text-[56px] font-bold text-slate-900 tracking-[-0.03em] leading-[1.04] min-h-[2.08em] block" />
            </motion.div>

            <motion.p
              variants={item}
              className="text-[16px] sm:text-[17px] text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              Check a suspicious SMS, WhatsApp message, or link in seconds. We extract risk
              signals, organize evidence privately, and help you prepare report-ready
              documentation with confidence.
            </motion.p>

            <motion.div
              variants={item}
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-1"
            >
              {onQuickCheck && (
                <button
                  onClick={onQuickCheck}
                  id="hero-quick-check-btn"
                  className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[15px] font-semibold shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                >
                  <Search size={18} />
                  Quick Check a message
                </button>
              )}
              <button
                onClick={onGetStarted}
                id="hero-get-started-btn"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-[15px] font-semibold shadow-sm border border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                Open a private workspace
                <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

          </div>

          {/* Product artwork column */}
          <motion.div variants={art} className="relative lg:pr-10" id="hero-mockup">
            <QuickCheckMockup />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
