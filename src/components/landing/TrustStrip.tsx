import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck, CircleCheck, FolderOpen, Lock } from "lucide-react";
import { staggerContainer, riseItem, staticVariants, revealViewport } from "./motionPrimitives";

const PILLARS = [
  {
    icon: ShieldCheck,
    tone: "text-brand-600",
    title: "Privacy first",
    body: "We redact sensitive details before analysis.",
  },
  {
    icon: CircleCheck,
    tone: "text-emerald-600",
    title: "Facts over opinion",
    body: "AI surfaces risk signals. You stay in control.",
  },
  {
    icon: FolderOpen,
    tone: "text-violet-600",
    title: "Investigator workflow",
    body: "Organize evidence, build cases, export clean reports.",
  },
  {
    icon: Lock,
    tone: "text-teal-600",
    title: "Report-ready",
    body: "Clean PDFs with evidence and key indicators.",
  },
];

export default function TrustStrip() {
  const reduced = useReducedMotion();
  const item = reduced ? staticVariants : riseItem;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="trust-strip">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-2xl shadow-sm divide-y sm:divide-y-0 lg:divide-x divide-slate-100 overflow-hidden"
      >
        {PILLARS.map((p) => (
          <motion.div
            key={p.title}
            variants={item}
            className="flex items-start gap-3.5 p-5 lg:p-6 hover:bg-slate-50/70 transition-colors"
          >
            <p.icon size={22} className={`${p.tone} flex-shrink-0 mt-0.5`} strokeWidth={1.9} />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-900">{p.title}</div>
              <p className="text-[12.5px] text-slate-500 leading-relaxed mt-1">{p.body}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
