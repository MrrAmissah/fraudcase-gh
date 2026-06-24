import React, { useEffect, useState } from "react";
import {
  X,
  Image as ImageIcon,
  FileText,
  Loader2,
  Check,
  Ban,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { EvidenceItem } from "../types/evidence";
import { auth } from "../lib/firebase/client";
import {
  factStatusBadge,
  factGroundingLabel,
  factConfidenceLabel,
  factTypeLabel,
  factCounts,
  orderedFacts,
  type BadgeTone,
} from "../lib/extraction/verificationView";

interface VerificationWorkspaceProps {
  caseId: string;
  evidence: EvidenceItem;
  onClose: () => void;
  onVerifyFact: (evidenceId: string, factId: string, decision: "accept" | "reject") => Promise<void>;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  trusted: "bg-emerald-50 text-emerald-800 border-emerald-200",
  suggested: "bg-indigo-50 text-indigo-700 border-indigo-200",
  caution: "bg-amber-50 text-amber-800 border-amber-200",
  rejected: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function VerificationWorkspace({ caseId, evidence, onClose, onVerifyFact }: VerificationWorkspaceProps) {
  const artifact = evidence.extractedArtifact;
  const isImage = (evidence.fileType || "").startsWith("image/");

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busyFactId, setBusyFactId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load the owner's own evidence image via the authenticated proxy into a local object URL.
  // The object URL is revoked on unmount and is never logged (no signed URLs, no content logged).
  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const resp = await fetch(`/api/cases/${caseId}/evidence/${evidence.id}/file`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          if (!cancelled) setPreviewError("Could not load the evidence image.");
          return;
        }
        const blob = await resp.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setImgUrl(objectUrl);
      } catch {
        if (!cancelled) setPreviewError("Could not load the evidence image.");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [caseId, evidence.id, isImage]);

  const openPdf = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const resp = await fetch(`/api/cases/${caseId}/evidence/${evidence.id}/file?download=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        setPreviewError("Could not open the PDF.");
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Give the new tab a moment to consume the blob before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setPreviewError("Could not open the PDF.");
    }
  };

  const act = async (factId: string, decision: "accept" | "reject") => {
    if (busyFactId) return;
    setBusyFactId(factId);
    setActionError(null);
    try {
      await onVerifyFact(evidence.id, factId, decision);
    } catch (err: any) {
      setActionError(err?.message || "Could not update the fact.");
    } finally {
      setBusyFactId(null);
    }
  };

  const counts = factCounts(artifact);
  const facts = orderedFacts(artifact);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print" id="verification-workspace-overlay">
      <div className="bg-white w-full max-w-[1100px] max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-150">
          <div className="flex items-center gap-2">
            {isImage ? <ImageIcon size={16} className="text-indigo-500" /> : <FileText size={16} className="text-indigo-500" />}
            <div>
              <h3 className="text-[14px] font-semibold text-slate-850 font-sans tracking-tight">Verify extracted evidence</h3>
              <p className="text-[11px] text-slate-450 font-sans">{evidence.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer" title="Close" id="verify-close-btn">
            <X size={16} />
          </button>
        </div>

        {/* Warning banner */}
        <div className="px-5 py-2.5 bg-amber-50/70 border-b border-amber-100 flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11.5px] text-amber-900 font-sans leading-snug">
            AI extraction can be wrong. Each fact is only a suggestion until you accept it. Only facts you accept are used in the case analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden flex-1 min-h-0">
          {/* LEFT: evidence preview */}
          <div className="p-5 border-r border-slate-150 overflow-y-auto bg-slate-50/40">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-405 font-sans mb-3">Original evidence</h4>
            {previewError ? (
              <div className="text-[12px] text-red-600 font-sans bg-red-50 border border-red-100 rounded-lg p-3">{previewError}</div>
            ) : isImage ? (
              imgUrl ? (
                <img src={imgUrl} alt="Evidence preview" className="w-full rounded-lg border border-slate-200 shadow-sm" />
              ) : (
                <div className="flex items-center gap-2 text-[12px] text-slate-400 font-sans py-10 justify-center">
                  <Loader2 size={14} className="animate-spin" /> Loading secure preview...
                </div>
              )
            ) : (
              <div className="border border-slate-200 rounded-lg p-5 bg-white text-center space-y-3">
                <FileText size={28} className="text-slate-400 mx-auto" />
                <p className="text-[12px] text-slate-500 font-sans">{evidence.fileName || "PDF document"}</p>
                <button onClick={openPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold font-sans cursor-pointer">
                  <ExternalLink size={11} /> Open PDF in a new tab
                </button>
              </div>
            )}

            {artifact?.redactedText && (
              <div className="mt-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-405 font-sans mb-2">Redacted extracted text</h4>
                <div className="bg-slate-950 text-slate-100 border border-slate-800 p-3 rounded-md text-[11px] font-mono whitespace-pre-wrap max-h-44 overflow-y-auto">
                  {artifact.redactedText}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: extracted facts */}
          <div className="p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-405 font-sans">Extracted facts</h4>
              <span className="text-[10.5px] text-slate-500 font-sans">
                {counts.accepted} accepted · {counts.pending} to review · {counts.rejected} rejected
              </span>
            </div>

            {actionError && (
              <div className="mb-3 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 font-sans">{actionError}</div>
            )}

            {!artifact || facts.length === 0 ? (
              <div className="p-6 border border-dashed border-slate-200 rounded-lg text-center text-[12px] text-slate-400 font-sans">
                No verifiable facts were extracted from this evidence.
              </div>
            ) : (
              <div className="space-y-2.5">
                {facts.map((fact) => {
                  const badge = factStatusBadge(fact);
                  const isBusy = busyFactId === fact.id;
                  return (
                    <div key={fact.id} className="border border-slate-200 rounded-xl p-3 space-y-2" id={`fact-${fact.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wide text-slate-400 font-sans">{factTypeLabel(fact.type)}</span>
                          <p className="text-[13px] font-semibold text-slate-800 font-mono break-words">{fact.redactedValue}</p>
                        </div>
                        {/* Status badge is the authoritative, dominant signal. */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold font-sans whitespace-nowrap ${TONE_CLASSES[badge.tone]}`}>
                          {badge.isTrusted && <ShieldCheck size={10} />}
                          {badge.label}
                        </span>
                      </div>

                      {fact.evidenceQuote && (
                        <p className="text-[11px] text-slate-500 font-sans italic border-l-2 border-slate-150 pl-2">"{fact.evidenceQuote}"</p>
                      )}

                      {/* Subordinate AI signals — clearly not a trust verdict. */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400 font-sans">
                        <span>{factGroundingLabel(fact.verification)}</span>
                        <span>{factConfidenceLabel(fact.confidence)}</span>
                        {fact.sourcePage ? <span>Page {fact.sourcePage}</span> : null}
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          onClick={() => act(fact.id, "accept")}
                          disabled={isBusy || badge.isTrusted}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-default text-white rounded-lg text-[11px] font-semibold font-sans cursor-pointer transition-colors"
                          id={`accept-${fact.id}`}
                        >
                          {isBusy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Accept
                        </button>
                        <button
                          onClick={() => act(fact.id, "reject")}
                          disabled={isBusy || fact.verificationStatus === "rejected"}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-default rounded-lg text-[11px] font-semibold font-sans cursor-pointer transition-colors"
                          id={`reject-${fact.id}`}
                        >
                          <Ban size={11} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Visual signals + uncertainty notes */}
            {artifact && artifact.visualSignals.length > 0 && (
              <div className="mt-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-405 font-sans mb-2">Possible visual signals (AI inference)</h4>
                <ul className="space-y-1">
                  {artifact.visualSignals.map((s, i) => (
                    <li key={i} className="text-[11.5px] text-slate-600 font-sans flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{s.description} <span className="text-slate-400">({s.severity})</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {artifact && artifact.uncertaintyNotes.length > 0 && (
              <div className="mt-3 text-[11px] text-slate-400 font-sans">
                <span className="font-semibold">Notes:</span> {artifact.uncertaintyNotes.join(" ")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
