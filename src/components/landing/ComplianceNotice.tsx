import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShieldAlert } from "lucide-react";
import { riseItem, staticVariants, revealViewport } from "./motionPrimitives";

/**
 * Legal and safety notice for the landing page.
 *
 * The wording here is deliberate. It must keep stating that the product is
 * AI-assisted decision support, that it does not determine guilt or replace an
 * official investigation, that it is unaffiliated with any authority, and where a
 * user should go to file an official report. Restyle freely, but do not drop a
 * clause.
 */
export default function ComplianceNotice() {
  const reduced = useReducedMotion();

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="legal-disclaimer-box">
      <motion.div
        variants={reduced ? staticVariants : riseItem}
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-10 bg-white border border-slate-200 rounded-2xl px-6 py-6 shadow-sm"
      >
        <div className="flex items-start gap-3.5 flex-grow">
          <span className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-xl bg-amber-50 border border-amber-200">
            <ShieldAlert size={17} className="text-amber-600" />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-slate-900 mb-1">
              Built for safety and privacy.
            </div>
            <p className="text-[12.5px] text-slate-600 leading-relaxed">
              FraudCase GH organizes user-provided evidence into clear reports. It is AI-assisted
              decision support: it does not determine guilt, provide legal advice, or replace an
              official investigation. It is an independent digital evidence organization aid and is
              not affiliated with any police, government body, or judicial cybersecurity authority.
            </p>
          </div>
        </div>

        <div className="lg:max-w-xs lg:border-l lg:border-slate-100 lg:pl-8 flex-shrink-0">
          <div className="text-[12.5px] text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-900">
              Need to file an official report?
            </span>{" "}
            Contact your bank, telecom operator, or the relevant local authorities directly.
          </div>
        </div>
      </motion.div>
    </section>
  );
}
