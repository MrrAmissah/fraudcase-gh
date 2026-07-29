import React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  MessageSquare,
  Link2,
  FileText,
  Phone,
  Globe,
  Tag,
  Check,
  X,
  ShieldCheck,
  Upload,
  Lock,
  CircleCheck,
} from "lucide-react";
import { staggerContainer, riseItem, staticVariants } from "./motionPrimitives";

/**
 * Marketing section illustrating the collect -> verify -> report pipeline.
 *
 * Everything inside the three columns is fixed sample artwork matching the
 * reference design. It intentionally mirrors the vocabulary the real workspace
 * uses (accepted / rejected facts, risk levels) so the promise and the product
 * line up.
 */

const INBOX = [
  {
    icon: MessageSquare,
    tone: "bg-emerald-50 text-emerald-600",
    title: "WhatsApp",
    time: "10:42 AM",
    body: "Kindly confirm your delivery fee of GHS 350 to...",
    flag: "Potential delivery scam",
  },
  {
    icon: MessageSquare,
    tone: "bg-brand-50 text-brand-600",
    title: "SMS",
    time: "Yesterday",
    body: "Your package is on hold. Pay now to release: gh-express-delivery.com/pay",
    flag: "Suspicious link",
  },
  {
    icon: Link2,
    tone: "bg-brand-50 text-brand-600",
    title: "gh-express-delivery.com/pay",
    time: "Yesterday",
    flag: "Unverified domain",
    tag: "New domain",
  },
];

const FACTS = [
  { icon: Phone, label: "+233 24****456", sub: "Masked phone number" },
  { icon: Globe, label: "gh-express-delivery.com", sub: "Suspicious / unverified domain" },
  { icon: Tag, label: "Fake delivery / courier fee", sub: "Likely scam category" },
];

const FINDINGS = [
  "Impersonation of courier brand",
  "Unverified domain used in link",
  "Payment requested upfront",
];

function ColumnHeader({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="flex items-center justify-center flex-shrink-0 w-9 h-7 rounded-md bg-brand-600 text-white text-[12px] font-bold shadow-sm shadow-brand-600/25">
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="text-[15.5px] font-bold text-slate-900 tracking-tight">{title}</h3>
        <p className="text-[12.5px] text-slate-500 leading-relaxed mt-1">{body}</p>
      </div>
    </div>
  );
}

export default function EvidencePipeline() {
  const reduced = useReducedMotion();
  const item = reduced ? staticVariants : riseItem;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="evidence-pipeline">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
      >
        <motion.div variants={item} className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-[30px] sm:text-[38px] font-bold text-slate-900 tracking-[-0.025em] leading-tight">
            Turn messy evidence into a{" "}
            <span className="text-brand-600">case-ready file</span>.
          </h2>
          <p className="text-[15px] text-slate-500 mt-3 leading-relaxed">
            FraudCase GH organizes, verifies, and structures your fraud evidence so you can report
            with confidence.
          </p>
        </motion.div>

        {/* The column headings are real section copy and stay in the accessibility
            tree. Only the sample cards below each heading are decorative.
            items-start lets each card hug its content: stretching them to a
            common height left large dead areas under the two shorter columns. */}
        <div className="grid lg:grid-cols-3 gap-5 items-start">
          {/* 01 — Collect */}
          <motion.div
            variants={item}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <ColumnHeader
              n="01"
              title="Collect & import evidence"
              body="Gather messages, links, screenshots, documents, and more."
            />
            <div className="space-y-2" aria-hidden="true">
              {INBOX.map((m, i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-lg p-2.5 hover:border-brand-200 hover:bg-brand-50/20 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${m.tone}`}>
                      <m.icon size={14} />
                    </span>
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium text-slate-800 truncate">
                          {m.title}
                        </span>
                        <span className="text-[9.5px] text-slate-400 flex-shrink-0">{m.time}</span>
                      </div>
                      {m.body && (
                        <p className="text-[11px] text-slate-500 leading-snug mt-1 line-clamp-2">
                          {m.body}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-red-600 font-medium">{m.flag}</span>
                        {m.tag && (
                          <span className="px-1.5 py-px text-[9px] bg-amber-50 text-amber-700 border border-amber-200 rounded">
                            {m.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center">
                <Upload size={15} className="text-slate-400 mx-auto mb-1.5" />
                <div className="text-[11.5px] text-slate-600 font-medium">
                  Drop files here or click to upload
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  WhatsApp export, screenshots, PDFs, links, etc.
                </div>
              </div>
            </div>
          </motion.div>

          {/* 02 — Verify */}
          <motion.div
            variants={item}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <ColumnHeader
              n="02"
              title="Review & lock accepted facts"
              body="AI surfaces risks and facts you can verify. You accept what is true and reject what is noise."
            />

            <div className="border border-slate-200 rounded-lg p-3 space-y-2" aria-hidden="true">
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700">
                <ShieldCheck size={13} className="text-brand-600" />
                Detected facts
              </div>
              {FACTS.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                >
                  <f.icon size={14} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0 flex-grow">
                    <div className="text-[11.5px] font-medium text-slate-800 truncate">
                      {f.label}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{f.sub}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded flex-shrink-0">
                    Accepted <Check size={9} />
                  </span>
                </div>
              ))}
            </div>

            <div className="border border-slate-200 rounded-lg p-3 space-y-2 mt-3" aria-hidden="true">
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700">
                <X size={13} className="text-slate-400" />
                Rejected / dismissed
              </div>
              <div className="flex items-center gap-2.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                <MessageSquare size={14} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-grow">
                  <div className="text-[11.5px] font-medium text-slate-600 truncate">
                    "I will pay tomorrow"
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">Not relevant to fraud</div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9.5px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded flex-shrink-0">
                  Rejected <X size={9} />
                </span>
              </div>
            </div>
          </motion.div>

          {/* 03 — Report */}
          <motion.div
            variants={item}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <ColumnHeader
              n="03"
              title="Get a clean, report-ready case file"
              body="Export a structured PDF with evidence, key findings, and a risk summary."
            />

            <div className="border border-slate-200 rounded-lg p-3.5 space-y-2.5" aria-hidden="true">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-slate-900">Case Summary</span>
                <span className="px-2 py-0.5 text-[9.5px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded">
                  High risk
                </span>
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Case type</div>
                <div className="text-[12.5px] font-semibold text-slate-800">
                  Fake delivery / courier fee
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div>
                  <div className="text-[10px] text-slate-400 mb-0.5">Risk score</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[26px] font-bold text-slate-900 leading-none font-mono">
                      88
                    </span>
                    <span className="text-[11px] text-slate-400">/100</span>
                  </div>
                  <div className="text-[11px] font-semibold text-red-600 mt-1">Critical risk</div>
                </div>
                <svg width="54" height="54" viewBox="0 0 54 54" className="-rotate-90 flex-shrink-0">
                  <circle cx="27" cy="27" r="22" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                  <circle
                    cx="27"
                    cy="27"
                    r="22"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 22}
                    strokeDashoffset={2 * Math.PI * 22 * 0.12}
                  />
                </svg>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="text-[11px] font-semibold text-slate-700 mb-2">Key findings</div>
                <div className="space-y-1.5">
                  {FINDINGS.map((f) => (
                    <div key={f} className="flex items-start gap-1.5">
                      <CircleCheck size={12} className="text-brand-600 flex-shrink-0 mt-px" />
                      <span className="text-[11px] text-slate-600 leading-snug">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-[12.5px] font-semibold shadow-sm shadow-brand-600/25">
                <FileText size={14} />
                Export PDF Report
              </div>
            </div>

          </motion.div>
        </div>

        <motion.div
          variants={item}
          className="flex items-center justify-center gap-2 text-[12.5px] text-slate-500 mt-8"
        >
          <Lock size={13} className="text-brand-600 flex-shrink-0" />
          Your evidence stays private. You decide what to include in your report.
        </motion.div>
      </motion.div>
    </section>
  );
}
