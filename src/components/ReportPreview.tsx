import React from "react";
import { ArrowLeft, Printer, Shield, ShieldCheck, AlertTriangle, Calendar, FileText, CheckSquare, MessageSquare, Link, Receipt, Image } from "lucide-react";
import { FraudCase } from "../types/fraudCase";
import { formatDate } from "../lib/utils/dates";
import { getRiskLevel, getScamCategoryLabel } from "../lib/utils/risk";
import BrandLogo from "./BrandLogo";

interface ReportPreviewProps {
  fraudCase: FraudCase;
  onBack: () => void;
}

export default function ReportPreview({ fraudCase, onBack }: ReportPreviewProps) {
  const { id, title, description, status, incidentDate, createdAt, evidenceItems, analysis } = fraudCase;

  // Print function
  const triggerMockPDFDownload = () => {
    window.print();
  };

  if (!analysis) {
    return (
      <div className="text-center p-12 bg-white border border-slate-200 rounded-xl" id="report-empty-panel">
        <AlertTriangle size={36} className="text-amber-500 mx-auto mb-4" />
        <h3 className="text-[15px] font-semibold text-slate-800 font-sans tracking-tight">
          Case Analysis Not Generated Yet
        </h3>
        <p className="text-[13.5px] text-slate-500 mt-2 font-sans font-normal">
          Please run AI analysis on the case screen before viewing the investigation report.
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-150 font-sans text-xs text-slate-700 border border-slate-200 rounded-xl cursor-pointer font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { scamCategory, confidence, riskScore, shortSummary, suspiciousIndicators, extractedEntities, timeline, evidenceChecklist, recommendedNextSteps } = analysis;
  const riskInfo = getRiskLevel(riskScore);

  return (
    <div className="space-y-6 text-slate-800 font-sans" id="report-preview-container">
      
      {/* Action Controller bar - hidden on printing */}
      <div className="flex items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-xs no-print" id="report-controls">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-sans text-slate-600 font-medium transition-all cursor-pointer"
          id="report-back-btn"
        >
          <ArrowLeft size={14} />
          Edit Case
        </button>

        <button
          onClick={triggerMockPDFDownload}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 border border-cyan-500 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-semibold tracking-normal transition-all cursor-pointer shadow-md"
          id="report-print-btn"
        >
          <Printer size={14} />
          Print / Save PDF Report
        </button>
      </div>

      {/* Main Dossier Report Page (A4 formatted styling block) */}
      <div className="bg-white border border-slate-250 p-8 sm:p-12 rounded-2xl shadow-xl space-y-10 relative overflow-hidden" id="report-printable-dossier">
        
        {/* Micro visual cyber stripe */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-cyan-600" />

        {/* 1. Header Metadata Block */}
        <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-6" id="report-meta-header">
          <div className="space-y-2.5">
            <div className="flex items-center">
              <BrandLogo variant="full" height={40} />
              <div className="ml-3 pl-3 border-l border-slate-250 text-[16px] font-bold text-slate-800 font-sans tracking-widest uppercase self-center">
                REPORT
              </div>
            </div>
            
            <p className="text-[11px] text-slate-500 font-sans font-medium tracking-normal">
              Confidential case evidence summary &bull; <span className="font-mono text-[10.5px]">Case ID: {id.toUpperCase()}</span>
            </p>
          </div>

          <div className="text-left md:text-right text-[12px] font-sans text-slate-500 space-y-1.5 flex-shrink-0">
            <div>Registered: <span className="font-mono text-[11px]">{formatDate(createdAt)}</span></div>
            <div>Incident target: <span className="font-mono text-[11px]">{incidentDate ? formatDate(incidentDate) : "(Not specified)"}</span></div>
            <div className="text-cyan-700 font-medium">Status: Case report prepared</div>
          </div>
        </div>

        {/* 2. Overview Card */}
        <div className="space-y-4" id="report-overview">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="text-[14px] font-semibold text-slate-700 font-sans tracking-tight">
              Case Information & Overview
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-[12px] font-medium text-slate-400 font-sans">
                Case Subject Title
              </h3>
              <p className="text-sm font-semibold text-slate-800 font-sans">{title}</p>
              
              <h3 className="text-[12px] font-medium text-slate-400 font-sans pt-3">
                Background details
              </h3>
              <p className="text-[14px] text-slate-600 leading-relaxed font-sans font-normal">
                {description}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-[12px] font-semibold text-slate-555 font-sans">
                Risk Assessment Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-sans text-[11.5px] text-slate-400 block font-normal text-slate-400">
                    Possible scam category
                  </span>
                  <span className="text-xs font-semibold text-slate-700 font-sans">
                    {getScamCategoryLabel(scamCategory)}
                  </span>
                </div>
                <div>
                  <span className="font-sans text-[11.5px] text-slate-400 block font-normal text-slate-400">
                    Calculated risk score
                  </span>
                  <span className={`text-xs font-semibold font-sans ${riskInfo.color}`}>
                    {riskInfo.label} ({riskScore}/100)
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 mt-1">
                <span className="font-sans text-[11.5px] text-slate-400 block font-normal text-slate-400">
                  Confidence rating
                </span>
                <span className="text-xs text-slate-600 font-sans font-normal">
                  Model confidence: <strong className="font-semibold text-cyan-700">{confidence}</strong> (verified templates matched).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Narrative & Short Summary */}
        <div className="space-y-3" id="report-narrative">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="text-[14px] font-semibold text-slate-700 font-sans tracking-tight">
              Executive Summary
            </span>
          </div>
          <p className="p-5 bg-slate-50/70 border border-slate-200 rounded-xl text-[14.5px] text-slate-700 leading-relaxed font-sans font-normal">
            {shortSummary}
          </p>
        </div>

        {/* 4. Extracted Entities */}
        <div className="space-y-4" id="report-entities">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="text-[14px] font-semibold text-slate-700 font-sans tracking-tight">
              Extracted Case Evidence Details
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {extractedEntities.names && extractedEntities.names.length > 0 && (
              <div className="p-3 flex items-start gap-4">
                <span className="text-[13px] font-semibold text-slate-500 font-sans w-44 flex-shrink-0">
                  Claimed aliases:
                </span>
                <span className="text-[13.5px] text-slate-800 font-semibold font-sans">{extractedEntities.names.join(", ")}</span>
              </div>
            )}
            
            {extractedEntities.organizations && extractedEntities.organizations.length > 0 && (
              <div className="p-3 flex items-start gap-4">
                <span className="text-[13px] font-semibold text-slate-500 font-sans w-44 flex-shrink-0">
                  Impersonated orgs:
                </span>
                <span className="text-[13.5px] text-slate-800 font-semibold font-sans">{extractedEntities.organizations.join(", ")}</span>
              </div>
            )}

            {extractedEntities.phoneNumbers && extractedEntities.phoneNumbers.length > 0 && (
              <div className="p-3 flex items-start gap-4">
                <span className="text-[13px] font-semibold text-slate-500 font-sans w-44 flex-shrink-0">
                  Phone numbers:
                </span>
                <span className="text-[13.5px] text-slate-800 font-mono">{extractedEntities.phoneNumbers.join(", ")}</span>
              </div>
            )}

            {extractedEntities.urls && extractedEntities.urls.length > 0 && (
              <div className="p-3 flex items-start gap-4">
                <span className="text-[13px] font-semibold text-slate-500 font-sans w-44 flex-shrink-0">
                  Phishing web link:
                </span>
                <span className="text-[13.5px] text-cyan-700 font-mono break-all">{extractedEntities.urls.join(", ")}</span>
              </div>
            )}

            {extractedEntities.amounts && extractedEntities.amounts.length > 0 && (
              <div className="p-3 flex items-start gap-4">
                <span className="text-[13px] font-semibold text-slate-500 font-sans w-44 flex-shrink-0">
                  Monetary elements:
                </span>
                <span className="text-[13.5px] text-slate-800 font-mono font-semibold">{extractedEntities.amounts.join(", ")}</span>
              </div>
            )}

            {extractedEntities.transactionReferences && extractedEntities.transactionReferences.length > 0 && (
              <div className="p-3 flex items-start gap-4">
                <span className="text-[13px] font-semibold text-slate-500 font-sans w-44 flex-shrink-0">
                  Transaction references:
                </span>
                <span className="text-[13.5px] text-slate-800 font-mono font-semibold">{extractedEntities.transactionReferences.join(", ")}</span>
              </div>
            )}

            {extractedEntities.locations && extractedEntities.locations.length > 0 && (
              <div className="p-3 flex items-start gap-4">
                <span className="text-[13px] font-semibold text-slate-500 font-sans w-44 flex-shrink-0">
                  Mentioned locations:
                </span>
                <span className="text-[13.5px] text-slate-705 font-sans font-normal">{extractedEntities.locations.join(", ")}</span>
              </div>
            )}
          </div>
        </div>

        {/* 5. Threat timeline section */}
        {timeline && timeline.length > 0 && (
          <div className="space-y-4" id="report-timeline">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-[14px] font-semibold text-slate-700 font-sans tracking-tight">
                Case Event Timeline
              </span>
            </div>

            <div className="space-y-3 font-sans">
              {timeline.map((event, idx) => (
                <div key={idx} className="flex gap-4 p-3 bg-slate-50/50 border border-slate-150 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-600 mt-1.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-4 text-[11px] font-sans text-slate-400">
                      <span>{event.date ? formatDate(event.date) : "Situational Timeline"}</span>
                      {event.source && (
                        <>
                          <span>&bull;</span>
                          <span className="text-slate-500 font-medium font-sans">Source: {event.source}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[13.5px] text-slate-700 leading-relaxed font-sans font-normal">
                      {event.event}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Legal Action Checklist */}
        {evidenceChecklist && evidenceChecklist.length > 0 && (
          <div className="space-y-4" id="report-checklist">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="text-[14px] font-semibold text-slate-700 font-sans tracking-tight">
                Completeness Checklist
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {evidenceChecklist.map((item, idx) => (
                <div key={idx} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between gap-2">
                  <div className="space-y-0.5 animate-none">
                    <span className="text-[13.5px] font-semibold text-slate-800 font-sans">{item.item}</span>
                    <span className="text-[11.5px] text-slate-400 block leading-snug font-sans font-normal">{item.note}</span>
                  </div>
                  <span className={`px-2.5 py-0.5 font-sans text-[11px] font-semibold rounded ${
                    item.status === "present"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-150"
                      : item.status === "missing"
                      ? "bg-rose-50 text-rose-800 border border-rose-150"
                      : "bg-amber-50 text-amber-900 border border-amber-155"
                  }`}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Guided Safety Directives */}
        {recommendedNextSteps && recommendedNextSteps.length > 0 && (
          <div className="space-y-4" id="report-directives">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-[14px] font-semibold text-slate-700 font-sans tracking-tight">
                Recommended Actions & Protective Steps
              </span>
            </div>

            <div className="p-5 border border-cyan-100 bg-cyan-50/20 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-cyan-600" size={16} />
                <h4 className="text-[13.5px] font-semibold text-cyan-800 font-sans">
                  Safety and backup guidance
                </h4>
              </div>
              <ul className="space-y-2 list-none p-0 text-[13.5px] text-slate-600 leading-relaxed font-sans font-normal">
                {recommendedNextSteps.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-cyan-600 font-bold">&bull;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 8. Forensics Footer warning */}
        <div className="border-t border-slate-200 pt-8 text-center space-y-3" id="report-dossier-footer">
          <div className="p-3 border border-amber-200 bg-amber-50 rounded-xl max-w-3xl mx-auto flex items-start gap-4 text-left">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-[13px] font-semibold text-amber-900 font-sans block">
                Safety & Privacy Notice
              </span>
              <p className="text-[12.5px] text-slate-700 leading-relaxed font-sans font-normal">
                This report is compiled programmatically to help organize evidence. It does not certify guilt, constitute legal advice, or replace an official law-enforcement investigation. If files or formal claims are necessary, contact relative official dispute and reporting channels directly.
              </p>
            </div>
          </div>

          <div className="text-[11px] font-sans text-slate-400 space-y-1 pt-4">
            <p>FraudCase GH &bull; AI-Assisted Evidence Organization Tool</p>
          </div>
        </div>

      </div>
    </div>
  );
}
