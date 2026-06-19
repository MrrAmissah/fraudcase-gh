import React from "react";
import { motion } from "motion/react";
import { ShieldCheck, Database, FileSpreadsheet, Lock, AlertCircle, ArrowRight } from "lucide-react";
import BrandLogo from "./BrandLogo";

interface LandingHeroProps {
  onGetStarted: () => void;
}

export default function LandingHero({ onGetStarted }: LandingHeroProps) {
  return (
    <div className="space-y-16 py-12" id="landing-hero-block">
      {/* Title & Core Subtext CTA Section */}
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-[11px] text-slate-600 font-sans font-medium tracking-normal text-center shadow-xs"
          id="hero-badge"
        >
          <span className="font-sans font-medium">Investigation Support Utility</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-[32px] sm:text-[40px] lg:text-[52px] font-bold text-slate-900 font-sans tracking-tight leading-tight"
          id="hero-title"
        >
          Turn scattered scam evidence into a{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 font-sans">
            structured case report
          </span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-[15px] sm:text-[16px] text-slate-600 font-sans max-w-2xl mx-auto leading-relaxed"
          id="hero-tagline"
        >
          Organize suspicious messages, links, receipts, and transaction details into a clear evidence timeline with AI-assisted risk indicators and report preparation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="pt-4"
          id="hero-cta-container"
        >
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-base font-semibold shadow-md border border-cyan-500 hover:scale-[1.02] transition-all duration-150 cursor-pointer animate-none"
            id="hero-get-started-btn"
          >
            Open Evidence Dashboard
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>

      {/* Three Functional Value Proposition Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto" id="feature-grid">
        {/* Feature 1 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-slate-300 transition-all shadow-sm"
          id="feature-card-1"
        >
          <div className="p-3 bg-cyan-50 border border-cyan-150 rounded-lg text-cyan-600 w-fit mb-4">
            <Database size={20} />
          </div>
          <h3 className="text-[17px] font-semibold text-slate-800 tracking-tight font-sans mb-2">
            1. Collect & Classify Evidence
          </h3>
          <p className="text-[15px] text-slate-600 leading-relaxed font-sans">
            Paste suspicious WhatsApp chat export logs, SMS strings, transaction URLs, or Mobile Money references. Keep your records indexed in one structured folder.
          </p>
        </motion.div>

        {/* Feature 2 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-slate-300 transition-all shadow-sm"
          id="feature-card-2"
        >
          <div className="p-3 bg-blue-50 border border-blue-150 rounded-lg text-blue-600 w-fit mb-4">
            <ShieldCheck size={20} />
          </div>
          <h3 className="text-[17px] font-semibold text-slate-800 tracking-tight font-sans mb-2">
            2. Analyze Risk Signals
          </h3>
          <p className="text-[15px] text-slate-600 leading-relaxed font-sans">
            Utilize server-side Gemini intelligence models to identify common phishing, delivery-fee traps, Ponzi signals, and trace indicators without exposing secrets to the client.
          </p>
        </motion.div>

        {/* Feature 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-slate-300 transition-all shadow-sm"
          id="feature-card-3"
        >
          <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-lg text-indigo-600 w-fit mb-4">
            <FileSpreadsheet size={20} />
          </div>
          <h3 className="text-[17px] font-semibold text-slate-800 tracking-tight font-sans mb-2">
            3. Export a Clean Case Report
          </h3>
          <p className="text-[15px] text-slate-600 leading-relaxed font-sans">
            Review a structured investigation report. Save chronological event milestones, extracted targets, checklists, and safe operational guidelines in a professional layout.
          </p>
        </motion.div>
      </div>

      {/* Large Legal Disclaimer Banner - Safety Framing */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="max-w-4xl mx-auto p-6 border border-amber-200 rounded-xl bg-amber-50/70 flex items-start gap-4 shadow-sm"
        id="legal-disclaimer-box"
      >
        <div className="text-amber-600 p-1.5 bg-amber-100 border border-amber-250 rounded-lg mt-0.5 flex-shrink-0">
          <AlertCircle size={20} />
        </div>
        <div className="space-y-1">
          <h4 className="text-amber-800 font-semibold text-[14px] font-sans">
            Safety Disclaimer & Platform Guardrails
          </h4>
          <p className="text-[14px] text-slate-700 leading-relaxed font-sans font-normal">
            <strong>FraudCase GH is an independent AI-assisted utility that organizes user-provided evidence details into clean chronological reports.</strong> It does not determine guilt, provide legal advice, or replace an official law-enforcement investigation. If you wish to file an official report, please contact your financial institution, telecom operator, or relevant official authorities directly.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
