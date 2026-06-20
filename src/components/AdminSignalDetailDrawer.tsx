import React, { useState } from "react";
import { X, ShieldAlert, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { CommunitySignal, ReviewedStatus } from "../types/communitySignal";
import { getScamCategoryLabel, getRiskLevel } from "../lib/utils/risk";
import { formatDateTime } from "../lib/utils/dates";
import { REVIEW_STATUS_META, REVIEW_STATUS_ORDER } from "../lib/admin/signalStatus";
import SuspiciousIndicators from "./SuspiciousIndicators";
import ExtractedEntitiesTable from "./ExtractedEntitiesTable";

interface AdminSignalDetailDrawerProps {
  signal: CommunitySignal;
  onClose: () => void;
  onSave: (updates: { reviewedStatus?: ReviewedStatus; adminNote?: string }) => Promise<void>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 font-sans">
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
      <span className="block text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="block text-[12px] text-slate-700 font-medium mt-0.5 truncate">{value}</span>
    </div>
  );
}

export default function AdminSignalDetailDrawer({ signal, onClose, onSave }: AdminSignalDetailDrawerProps) {
  const [status, setStatus] = useState<ReviewedStatus>(signal.reviewedStatus);
  const [note, setNote] = useState(signal.adminNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const risk = getRiskLevel(signal.riskScore);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await onSave({ reviewedStatus: status, adminNote: note });
      setSavedMsg("Review saved.");
    } catch (err: any) {
      setError(err?.message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" id="admin-signal-drawer">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl border-l border-slate-200">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between z-10">
          <h3 className="text-[14px] font-semibold text-slate-800 font-sans">Redacted signal</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 text-[11.5px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-sans leading-normal">
            <ShieldAlert size={14} className="text-cyan-600 flex-shrink-0 mt-0.5" />
            <span>These are redacted community signals, not official reports or confirmed fraud cases.</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Possible category" value={getScamCategoryLabel(signal.scamCategory)} />
            <Field label="Risk signal" value={<span className={risk.color}>{risk.label} · {signal.riskScore}/100</span>} />
            <Field label="Confidence" value={<span className="capitalize">{signal.confidence}</span>} />
            <Field label="Submitted" value={formatDateTime(signal.createdAt)} />
            <Field label="Masked sender" value={signal.maskedPhone || "—"} />
            <Field label="Domain" value={signal.normalizedDomain || "—"} />
            <Field label="Amount" value={signal.amountRequested || "—"} />
            <Field label="Country" value={signal.countryContext || "—"} />
          </div>

          <div>
            <Label>Redacted text</Label>
            <div className="bg-slate-950 text-slate-100 border border-slate-800 p-3 rounded-md text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
              {signal.redactedText}
            </div>
          </div>

          <SuspiciousIndicators indicators={signal.possibleFraudIndicators} />
          <ExtractedEntitiesTable entities={signal.extractedEntities} />

          {signal.recommendedNextSteps && signal.recommendedNextSteps.length > 0 && (
            <div>
              <Label>Recommended next steps</Label>
              <ul className="list-disc pl-5 text-[12px] text-slate-600 space-y-1 font-sans">
                {signal.recommendedNextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 border-t border-slate-150 pt-4">
            <Label>Review status</Label>
            <div className="flex flex-wrap gap-1.5">
              {REVIEW_STATUS_ORDER.map((st) => {
                const meta = REVIEW_STATUS_META[st];
                const active = status === st;
                return (
                  <button
                    key={st}
                    onClick={() => setStatus(st)}
                    className={`px-2.5 py-1 text-[11.5px] rounded-full border font-medium cursor-pointer transition-colors ${
                      active ? meta.badge : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Admin note <span className="text-slate-400 font-normal normal-case">(redacted on save)</span>
            </Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Optional internal note about this possible pattern…"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-cyan-500/80 font-sans"
            />
          </div>

          {error && (
            <div className="text-[11.5px] text-red-600 bg-red-50/60 border border-red-150 px-3 py-2 rounded-lg flex items-start gap-1.5 font-sans">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {savedMsg && (
            <div className="text-[11.5px] text-emerald-700 inline-flex items-center gap-1.5 font-sans">
              <CheckCircle2 size={13} /> {savedMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer font-sans"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 font-sans"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
