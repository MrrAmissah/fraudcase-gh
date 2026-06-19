import React, { useState } from "react";
import { Search, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { redactPIIAndSecrets, countSensitivePatterns } from "../lib/security/redaction";

interface QuickCheckInputPanelProps {
  onAnalyze: (text: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Public input panel: paste suspicious message text or a URL. Shows a live redaction
 * preview (the same guard the server applies before analysis) so the user can see what
 * gets masked. Redaction is always applied before analysis — it cannot be turned off.
 */
export default function QuickCheckInputPanel({ onAnalyze, isLoading = false, error }: QuickCheckInputPanelProps) {
  const [text, setText] = useState("");

  const trimmed = text.trim();
  const sensitiveCount = countSensitivePatterns(text);
  const redactedPreview = redactPIIAndSecrets(text).redactedText;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || isLoading) return;
    onAnalyze(trimmed);
  };

  return (
    <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-800" id="quick-check-input-panel">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-slate-600 font-sans" htmlFor="quick-check-text">
            Suspicious message or link
          </label>
          <textarea
            id="quick-check-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="Paste the suspicious SMS, WhatsApp message, or link here — e.g. 'GH-POST: Your parcel is held, pay GHS 12.50 at http://gh-postal-fees.icu'"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 font-mono leading-relaxed"
          />
          <div className="flex justify-between text-[10.5px] text-slate-400 font-sans">
            <span>SMS · WhatsApp · URL · pasted text</span>
            <span>{text.length}/5000</span>
          </div>
        </div>

        {/* Redaction preview (always-on guard) */}
        {trimmed && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2" id="quick-check-redaction-preview">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-cyan-600" />
              <span className="text-[12px] text-slate-700 font-bold font-sans">
                Redaction guard preview
              </span>
              <span className="text-[10.5px] text-slate-400 font-sans">always applied before analysis</span>
            </div>

            {sensitiveCount > 0 && (
              <div className="text-[11px] text-amber-600 flex items-start gap-1.5 font-sans font-medium leading-normal">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  Detected <strong>{sensitiveCount} sensitive item(s)</strong> in your text — see the
                  masked version below.
                </span>
              </div>
            )}

            <div className="p-2 bg-white border border-slate-200 rounded text-[10.5px] text-slate-700 font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
              {redactedPreview || "(nothing to preview yet)"}
            </div>
          </div>
        )}

        {error && (
          <div className="text-[11.5px] text-red-600 bg-red-50/60 border border-red-150 px-3 py-2 rounded-lg flex items-start gap-1.5 font-sans font-medium">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!trimmed || isLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer disabled:opacity-40"
            id="run-quick-check-btn"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {isLoading ? "Checking…" : "Run Quick Check"}
          </button>
        </div>
      </form>
    </div>
  );
}
