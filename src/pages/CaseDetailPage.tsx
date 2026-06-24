import React, { useState, useRef } from "react";
import { 
  ArrowLeft, 
  Play, 
  Sparkles, 
  FileCheck, 
  RefreshCw, 
  Trash2, 
  Shield, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle 
} from "lucide-react";
import { FraudCase } from "../types/fraudCase";
import { EvidenceItem, EvidenceType } from "../types/evidence";
import { formatDate } from "../lib/utils/dates";
import { getRiskLevel, getScamCategoryLabel } from "../lib/utils/risk";

// Core sub-components we built earlier
import EvidenceInput from "../components/EvidenceInput";
import EvidenceCard from "../components/EvidenceCard";
import ExtractedEntitiesTable from "../components/ExtractedEntitiesTable";
import SuspiciousIndicators from "../components/SuspiciousIndicators";
import TimelineView from "../components/TimelineView";
import EvidenceChecklist from "../components/EvidenceChecklist";
import AnalysisVisualSummary from "../components/analysis/AnalysisVisualSummary";
import VerificationWorkspace from "../components/VerificationWorkspace";

interface CaseDetailPageProps {
  fraudCase: FraudCase;
  onBack: () => void;
  onAddEvidence: (
    data: {
      type: EvidenceType;
      title: string;
      originalText?: string;
      fileName?: string;
      fileUrl?: string;
    },
    file?: File
  ) => void;
  onRemoveEvidence: (id: string) => void;
  onExtractEvidence: (evidenceId: string) => Promise<void>;
  onVerifyFact: (evidenceId: string, factId: string, decision: "accept" | "reject") => Promise<void>;
  onAnalyze: () => void;
  onDeleteCase: () => void;
  onViewReport: () => void;
  isAnalyzing?: boolean;
}

export default function CaseDetailPage({
  fraudCase,
  onBack,
  onAddEvidence,
  onRemoveEvidence,
  onExtractEvidence,
  onVerifyFact,
  onAnalyze,
  onDeleteCase,
  onViewReport,
  isAnalyzing = false,
}: CaseDetailPageProps) {
  const { id, title, description, status, incidentDate, createdAt, updatedAt, evidenceItems, analysis } = fraudCase;
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [verifyingEvidenceId, setVerifyingEvidenceId] = useState<string | null>(null);
  const [analysisStale, setAnalysisStale] = useState(false);
  const evidenceFormRef = useRef<HTMLDivElement>(null);

  const hasAnalysis = !!analysis;

  // Accepting/rejecting facts changes what analysis WOULD use, but `/analyze` only rebuilds the
  // accepted-facts bundle when re-run. Surface a stale nudge so the payoff is not invisible.
  const handleVerifyFactLocal = async (
    evidenceId: string,
    factId: string,
    decision: "accept" | "reject",
  ) => {
    await onVerifyFact(evidenceId, factId, decision);
    if (hasAnalysis) setAnalysisStale(true);
  };
  const handleAnalyzeLocal = () => {
    setAnalysisStale(false);
    onAnalyze();
  };

  const verifyingEvidence = verifyingEvidenceId
    ? evidenceItems.find((e) => e.id === verifyingEvidenceId)
    : undefined;
  const riskInfo = hasAnalysis ? getRiskLevel(analysis.riskScore) : {
    label: "Awaiting Assessment",
    color: "text-slate-400",
    bgColor: "bg-slate-50 whitespace-normal",
    borderColor: "border-slate-200",
    description: "Please trigger AI-assisted evidence analysis to calculate threat signals."
  };
  const scamCategory = hasAnalysis ? analysis.scamCategory : "unknown";
  const confidence = hasAnalysis ? analysis.confidence : "Undetermined";
  const riskScore = hasAnalysis ? analysis.riskScore : "--";

  const lastAnalyzedDateStr = analysis ? formatDate(updatedAt) : "Never analyzed";

  const getReportReadiness = () => {
    if (!hasAnalysis) return "Awaiting Analysis";
    const missing = analysis.evidenceChecklist?.find(c => c.status === "missing");
    if (missing) {
      return `Partial / Needs ${missing.item.toLowerCase()}`;
    }
    return "Ready / Complete";
  };

  const handleOpenAddEvidence = () => {
    setIsFormOpen(true);
    setTimeout(() => {
      evidenceFormRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="w-full text-slate-800 space-y-6 max-w-[1240px] mx-auto text-left" id="case-detail-page">
      
      {/* 1. Case Header Bar */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4" id="case-header-bar">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-sans cursor-pointer"
              id="back-to-dashboard-shortcut"
            >
              <ArrowLeft size={14} />
              <span>Back to Cases</span>
            </button>
            <h2 className="text-[24px] font-bold font-sans text-slate-900 tracking-tight leading-snug">
              {title}
            </h2>
            <div className="text-[12px] text-slate-500 font-sans flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] bg-slate-50 border border-slate-100 rounded px-1 text-slate-600">
                Case ID: {id.slice(-8).toUpperCase()}
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${
                status === "analyzed" ? "bg-cyan-50 text-cyan-700 border border-cyan-100" : "bg-slate-50 text-slate-600 border border-slate-150"
              }`}>
                Status: {status === "analyzed" ? "Analyzed" : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
              <span className="text-slate-300">&bull;</span>
              <span>Evidence: {evidenceItems.length} items</span>
              <span className="text-slate-300">&bull;</span>
              <span>Last analyzed: {lastAnalyzedDateStr}</span>
              <span className="text-slate-300">&bull;</span>
              <span>Risk Level: <span className={`font-semibold uppercase tracking-wide ${riskInfo.color}`}>{riskInfo.label}</span></span>
            </div>
          </div>

          {/* Core Controls */}
          <div className="flex flex-wrap items-center gap-2 md:self-start">
            {deleteConfirm ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 p-1.5 rounded-lg text-xs leading-none">
                <span className="text-red-700 font-semibold font-sans">Delete case?</span>
                <button
                  onClick={onDeleteCase}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-sans rounded cursor-pointer text-xs font-semibold"
                  id="confirm-delete-btn"
                >
                  Yes
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans rounded cursor-pointer text-xs font-medium"
                  id="cancel-delete-btn"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                title="Purge Case Folder"
                id="request-delete-btn"
              >
                <Trash2 size={15} />
              </button>
            )}

            <button
              onClick={handleOpenAddEvidence}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 rounded-lg text-xs font-sans font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              id="add-evidence-shortcut-btn"
            >
              <Plus size={13} className="text-slate-500" />
              Add Evidence
            </button>

            <button
              onClick={handleAnalyzeLocal}
              disabled={isAnalyzing || evidenceItems.length === 0}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:border-slate-150 disabled:text-slate-405 border border-slate-250 text-slate-700 rounded-lg text-xs font-sans font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              id="reanalyze-shortcut-btn"
            >
              <RefreshCw size={13} className={`text-slate-500 ${isAnalyzing ? "animate-spin" : ""}`} />
              {hasAnalysis ? "Re-analyze" : "Analyze Case"}
            </button>

            {hasAnalysis && (
              <button
                onClick={onViewReport}
                className="px-4 py-2 bg-cyan-600 border border-cyan-500 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-semibold cursor-pointer shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap"
                id="view-report-shortcut"
              >
                <FileCheck size={14} />
                View Case Report
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Analysis Status Banner (Only if analyzed) */}
      {hasAnalysis && (
        <div className="bg-cyan-50/60 border border-cyan-150 p-4 rounded-xl space-y-1 rounded-2xl no-print" id="analysis-status-banner">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-cyan-600 flex-shrink-0 animate-pulse" />
            <h4 className="text-[13.5px] font-semibold text-cyan-900 font-sans">
              AI analysis generated. Review findings before export.
            </h4>
          </div>
          <p className="text-[12px] text-slate-500 leading-normal font-sans font-normal pl-5">
            This is a decision-support tool and does not determine guilt or replace official investigation.
          </p>
        </div>
      )}

      {/* 2b. Stale-analysis nudge: accepted/rejected facts only affect analysis after a re-run. */}
      {hasAnalysis && analysisStale && (
        <div className="bg-amber-50/70 border border-amber-150 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print" id="analysis-stale-banner">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[12.5px] text-amber-900 font-sans leading-snug">
              You changed which extracted facts are accepted. Re-analyze to include only your accepted facts.
            </p>
          </div>
          <button
            onClick={handleAnalyzeLocal}
            disabled={isAnalyzing}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg text-[11.5px] font-semibold font-sans cursor-pointer transition-colors whitespace-nowrap"
          >
            <RefreshCw size={12} className={isAnalyzing ? "animate-spin" : ""} /> Re-analyze
          </button>
        </div>
      )}

      {/* 3. Top Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="top-summary-grid">
        
        {/* Left side: Case Synopsis Card */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 md:col-span-7 flex flex-col justify-between shadow-xs">
          <div className="space-y-2 text-left">
            <h3 className="text-[14px] font-semibold font-sans text-slate-405 tracking-normal uppercase">
              Case Synopsis
            </h3>
            <p className="text-[14px] text-slate-605 leading-relaxed font-sans font-normal">
              {description}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11.5px] text-slate-400 pt-3 border-t border-slate-100 font-sans mt-auto">
            <span>Incident registered:</span>
            <span className="font-mono text-[11px] text-slate-605">
              {formatDate(incidentDate || createdAt)}
            </span>
          </div>
        </div>

        {/* Right side: Risk Overview Panel */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs md:col-span-5 flex flex-col justify-between gap-4 text-left">
          <div className="space-y-2">
            <h3 className="text-[14px] font-semibold font-sans text-slate-405 tracking-normal uppercase">
              Risk Overview Panel
            </h3>
            
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block font-sans">Scam Category</span>
                <span className="text-[12.5px] font-semibold text-slate-700 block mt-0.5 leading-tight truncate">
                  {getScamCategoryLabel(scamCategory)}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block font-sans">Risk Level</span>
                <span className={`text-[12.5px] font-semibold block mt-0.5 uppercase tracking-wide`}>
                  <span className={riskInfo.color}>{riskInfo.label}</span>
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block font-sans">Risk Score</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[16px] font-bold text-slate-800 font-mono leading-none">
                    {riskScore}
                  </span>
                  <span className="text-[11px] text-slate-400 font-sans">/100</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block font-sans">Model Confidence</span>
                <span className="text-[12.5px] font-semibold text-slate-700 block mt-0.5 capitalize">
                  {confidence}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-cyan-50/40 border border-cyan-100 px-3 py-2 rounded-lg text-xs text-cyan-800 font-sans mt-auto">
            <span className="font-normal text-slate-500">Report readiness:</span>
            <span className="font-semibold text-[11.5px] text-cyan-900 leading-normal">
              {getReportReadiness()}
            </span>
          </div>
        </div>

      </div>

      {/* 4. Detailed Forensic Workspace Section layout columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
        
        {/* Left column (Synopsis & Evidence elements - Spans 5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Evidence Vault Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4" id="evidence-vault-section">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-[15px] font-semibold font-sans text-slate-805 tracking-tight">
                  Evidence Vault
                </h3>
                <p className="text-[11.5px] text-slate-400 font-sans mt-0.5">
                  Captured materials ({evidenceItems.length})
                </p>
              </div>
              
              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg cursor-pointer transition-colors"
              >
                <span>{isFormOpen ? "Hide Form" : "Add Evidence"}</span>
                {isFormOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {/* Attached elements list */}
            {evidenceItems.length === 0 ? (
              <div className="p-8 border border-slate-150 border-dashed rounded-lg text-center bg-slate-50/50">
                <p className="text-[13px] text-slate-400 font-sans font-normal leading-normal">
                  Evidence vault is empty. Click "Add Evidence" to import logs or screenshots.
                </p>
              </div>
            ) : (
              <div className="space-y-3" id="attached-evidence-flow">
                {evidenceItems.map((item) => (
                  <EvidenceCard
                    key={item.id}
                    evidence={item}
                    onRemove={onRemoveEvidence}
                    onExtract={onExtractEvidence}
                    onOpenVerify={(eid) => setVerifyingEvidenceId(eid)}
                  />
                ))}
              </div>
            )}

            {/* Collapsible form area (Below the list, as requested) */}
            <div 
              ref={evidenceFormRef} 
              className={`transition-all duration-300 overflow-hidden ${
                isFormOpen ? "max-h-[800px] opacity-100 pt-3 border-t border-slate-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <div className="bg-slate-50/60 p-3.5 border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-[13px] font-semibold text-slate-850 font-sans">
                  Attach New Evidence
                </h4>
                <EvidenceInput 
                  onAddEvidence={(data, file) => {
                    onAddEvidence(data, file);
                    setIsFormOpen(false); // Collapses after adding
                  }} 
                  isLoading={isAnalyzing} 
                />
              </div>
            </div>

          </div>

          {/* Prompt / Manual Action banner when not analyzed */}
          {!hasAnalysis && !isAnalyzing && (
            <div className="p-5 border border-amber-100 bg-amber-50/30 rounded-xl text-left space-y-3">
              <div className="flex gap-2">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <span className="text-[13px] font-semibold text-amber-900 font-sans block">
                    Forensic AI analysis pending
                  </span>
                  <p className="text-[12.5px] text-slate-600 font-sans leading-relaxed">
                    Trigger the assessment to build possible fraud indicator scores, reconstruct case timelines, and verify evidence completeness.
                  </p>
                </div>
              </div>
              <button
                disabled={evidenceItems.length === 0}
                onClick={handleAnalyzeLocal}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-150 disabled:text-slate-400 text-white text-xs font-sans font-semibold rounded-lg shadow-xs cursor-pointer transition-all"
                id="workspace-trigger-analysis-btn"
              >
                <Play size={11} />
                Analyze Evidence Vault
              </button>
            </div>
          )}

        </div>

        {/* Right column (AI Analysis findings Spans 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {isAnalyzing ? (
            /* Loading State spinner card */
            <div className="p-12 border border-cyan-205 bg-cyan-50/10 rounded-xl text-center space-y-4 shadow-xs relative overflow-hidden" id="analysis-loading">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/5 to-transparent animate-pulse" />
              <div className="p-4 bg-white border border-cyan-100 text-cyan-600 rounded-full w-fit mx-auto animate-spin">
                <RefreshCw size={28} />
              </div>
              <div className="space-y-1 z-10 relative text-center">
                <h3 className="text-[16px] font-semibold text-slate-805 font-sans tracking-tight">
                  Processing Evidence...
                </h3>
                <p className="text-[13px] text-slate-500 font-sans max-w-sm mx-auto leading-relaxed font-normal">
                  Mapping incident timestamps, extracting suspect entities, and matching Ghana-specific Smishing patterns using secure AI models.
                </p>
              </div>
            </div>
          ) : !hasAnalysis ? (
            /* Blank state waiting */
            <div className="p-10 border border-slate-200 bg-white rounded-xl text-center space-y-4 shadow-xs" id="ready-to-analyze-panel">
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-full text-slate-400 w-fit mx-auto">
                <Shield size={24} />
              </div>
              
              <div className="space-y-1.5 max-w-md mx-auto text-center">
                <h3 className="text-[16px] font-semibold font-sans text-slate-805 tracking-tight">
                  Evidence Assessment Results
                </h3>
                <p className="text-[13px] text-slate-500 font-sans leading-relaxed font-normal">
                  Once you import messages, screenshots, or transaction slips, trigger the AI analysis engine above to verify possible patterns.
                </p>
              </div>
            </div>
          ) : (
            /* Analyzed details modules */
            <div className="space-y-6" id="analysis-results-panel">

              {/* Executive-readable visual summary (pure rendering of the analysis fields below) */}
              <AnalysisVisualSummary
                riskScore={analysis.riskScore}
                confidence={analysis.confidence}
                scamCategory={analysis.scamCategory}
                indicators={analysis.suspiciousIndicators}
                entities={analysis.extractedEntities}
                checklist={analysis.evidenceChecklist}
                shortSummary={analysis.shortSummary}
              />

              {/* Extracted Case Entities */}
              <ExtractedEntitiesTable entities={analysis.extractedEntities} />

              {/* Possible Fraud Indicators list */}
              <SuspiciousIndicators indicators={analysis.suspiciousIndicators} />

              {/* Chronology Timeline milestones */}
              <TimelineView timeline={analysis.timeline} />

              {/* Completeness score checklist */}
              <EvidenceChecklist checklist={analysis.evidenceChecklist} />

            </div>
          )}

        </div>

      </div>

      {/* 5. Report Export CTA (Bottom) */}
      {hasAnalysis && (
        <div className="p-6 bg-cyan-50/40 border border-cyan-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 mt-8" id="report-cta-bottom-panel text-left">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-[15px] font-semibold text-slate-850 font-sans tracking-tight">
              Ready to prepare a case report?
            </h3>
            <p className="text-[13px] text-slate-500 font-sans font-normal leading-normal">
              Review all extracted signatures, verify the readiness checklist, and export the official dispute statement.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleOpenAddEvidence}
              className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-205 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors font-sans whitespace-nowrap"
            >
              Add More Evidence
            </button>
            <button
              onClick={onViewReport}
              className="px-4.5 py-2 bg-cyan-600 border border-cyan-500 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-semibold tracking-normal shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileCheck size={14} />
              Preview Case Report
            </button>
          </div>
        </div>
      )}

      {/* Verification workspace (split-screen modal) */}
      {verifyingEvidence && (
        <VerificationWorkspace
          caseId={id}
          evidence={verifyingEvidence}
          onClose={() => setVerifyingEvidenceId(null)}
          onVerifyFact={handleVerifyFactLocal}
        />
      )}

    </div>
  );
}
