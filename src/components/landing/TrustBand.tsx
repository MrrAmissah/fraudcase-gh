import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Lock, ShieldCheck, Archive, BadgeCheck } from "lucide-react";
import { staggerContainer, riseItem, staticVariants, revealViewport } from "./motionPrimitives";

const ITEMS = [
  {
    icon: Lock,
    title: "Private by design",
    body: "We redact sensitive details before analysis. Quick Check stores nothing.",
  },
  {
    icon: ShieldCheck,
    title: "Evidence you can rely on",
    body: "Structured indicators and timestamps help you build clear, defensible reports.",
  },
  {
    icon: Archive,
    title: "Organized & secure",
    body: "All evidence stays private in your workspace. You are in control.",
  },
  {
    icon: BadgeCheck,
    title: "Investigator-ready",
    body: "Export clean, professional PDF reports for cases, audits, or escalations.",
  },
];

export default function TrustBand() {
  const reduced = useReducedMotion();
  const item = reduced ? staticVariants : riseItem;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="trust-band">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        className="relative bg-gradient-to-br from-brand-50 via-slate-50 to-brand-50/40 border border-brand-100 rounded-2xl px-6 py-10 sm:px-10 overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{
            backgroundImage: "radial-gradient(circle, #93c5fd 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse 60% 80% at 50% 0%, black 0%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 80% at 50% 0%, black 0%, transparent 75%)",
          }}
        />

        <motion.div
          variants={item}
          className="relative flex items-center justify-center gap-2.5 mb-9 text-center"
        >
          <ShieldCheck size={22} className="text-brand-600 flex-shrink-0" strokeWidth={2} />
          <h2 className="text-[21px] sm:text-[24px] font-bold text-slate-900 tracking-tight">
            Built for privacy. Designed for trust.
          </h2>
        </motion.div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x divide-brand-100">
          {ITEMS.map((it) => (
            <motion.div key={it.title} variants={item} className="lg:px-6 first:lg:pl-0 last:lg:pr-0">
              <it.icon size={22} className="text-brand-600 mb-3" strokeWidth={1.9} />
              <div className="text-[14px] font-medium text-slate-900 mb-1.5">{it.title}</div>
              <p className="text-[12.5px] text-slate-600 leading-relaxed">{it.body}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
