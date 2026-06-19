import React, { useState } from "react";
import { 
  Trash2, 
  Link, 
  MessageSquare, 
  AlertCircle, 
  FileText, 
  Image as ImageIcon, 
  Receipt, 
  Eye, 
  Download, 
  ShieldAlert, 
  ShieldCheck, 
  Loader2 
} from "lucide-react";
import { EvidenceItem, EvidenceType } from "../types/evidence";
import { formatDateTime } from "../lib/utils/dates";
import { auth } from "../lib/firebase/client";

interface EvidenceCardProps {
  key?: string;
  evidence: EvidenceItem;
  onRemove?: (id: string) => void;
}

export default function EvidenceCard({ evidence, onRemove }: EvidenceCardProps) {
  const { 
    id, 
    caseId, 
    type, 
    title, 
    originalText, 
    redactedText, 
    redactionWarnings, 
    fileName, 
    fileType, 
    fileSize, 
    createdAt 
  } = evidence;

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const getEvidenceIcon = (t: EvidenceType) => {
    switch (t) {
      case "sms":
        return <MessageSquare size={16} className="text-blue-600" />;
      case "whatsapp":
        return <MessageSquare size={16} className="text-emerald-600" />;
      case "url":
        return <Link size={16} className="text-cyan-600" />;
      case "receipt":
        return <Receipt size={16} className="text-purple-600" />;
      case "screenshot":
        return <ImageIcon size={16} className="text-indigo-600" />;
      case "email":
        return <FileText size={16} className="text-amber-600" />;
      default:
        return <AlertCircle size={16} className="text-slate-500" />;
    }
  };

  const getTypeNameStr = (t: EvidenceType) => {
    switch (t) {
      case "sms": return "SMS Text";
      case "whatsapp": return "WhatsApp Chat";
      case "url": return "Suspicious Link";
      case "receipt": return "MoMo Slip Trace";
      case "screenshot": return "Screen Capture";
      case "document": return "Forensic Document";
      case "email": return "Phishing Email";
      default: return "Archived Note";
    }
  };

  // Convert raw size number to human readable string
  const formatBytes = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Securely request file streaming from the authenticated backend gateway
  const handlePreviewFile = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    setErrorText(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Login session has expired.");
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`/api/cases/${caseId}/evidence/${id}/file`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errObj = await response.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to download secure attachment.");
      }

      const blob = await response.blob();
      const rawUrl = URL.createObjectURL(blob);
      
      const isImg = fileType?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(fileName?.split(".").pop()?.toLowerCase() || "");
      
      if (isImg) {
        // Safe preview page injection
        const w = window.open();
        if (w) {
          w.document.write(`
            <html>
              <head>
                <title>${fileName || "Evidence Image Preview"}</title>
                <style>
                  body { margin: 0; background: #0b0f19; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                  img { max-width: 95%; max-height: 95vh; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 8px; border: 1px solid #1e293b; }
                </style>
              </head>
              <body>
                <img src="${rawUrl}" />
              </body>
            </html>
          `);
          w.document.close();
        }
      } else {
        // PDFs & spreadsheet file download
        const a = document.createElement("a");
        a.href = rawUrl;
        a.download = fileName || "attachment";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Could not retrieve attachment.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const hasWarnings = redactionWarnings && redactionWarnings.length > 0;
  // Choose text representation (redactedText is safer!)
  const previewText = redactedText || originalText;

  return (
    <div className="p-4 bg-white border border-slate-205 rounded-xl hover:border-slate-300 transition-all flex flex-col justify-between space-y-3 relative group text-left" id={`evidence-item-${id}`}>
      
      {/* 1. Header Information Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-150">
            {getEvidenceIcon(type)}
          </div>
          <div>
            <h4 className="text-[13.5px] font-semibold text-slate-850 tracking-tight leading-normal">
              {title}
            </h4>
            <div className="text-[11px] font-sans text-slate-450 mt-0.5 inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="font-medium text-slate-650">{getTypeNameStr(type)}</span>
              <span>&bull;</span>
              <span className="font-mono bg-slate-50 border border-slate-100 rounded px-1 text-[10px]">
                ID: {id.slice(-6).toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {onRemove && (
          <button
            onClick={() => onRemove(id)}
            className="p-1 px-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Purge Evidence Element"
            id={`remove-evidence-${id}`}
          >
            <Trash2 size={13.5} />
          </button>
        )}
      </div>

      {/* 2. Attached File Card */}
      {fileName && (
        <div className="bg-slate-50/80 border border-slate-150 p-3 rounded-lg flex items-center justify-between gap-3 text-xs font-sans">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white border border-slate-100 rounded text-slate-500">
              {fileType?.startsWith("image/") ? <ImageIcon size={15} /> : <FileText size={15} />}
            </div>
            <div className="space-y-0.5 text-left truncate max-w-[140px] sm:max-w-[180px]">
              <p className="font-semibold text-slate-800 truncate" title={fileName}>
                {fileName}
              </p>
              <p className="text-[10.5px] text-slate-450">
                {formatBytes(fileSize)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePreviewFile}
            disabled={isPreviewing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50 font-sans cursor-pointer"
            title="Unlock secure file preview"
          >
            {isPreviewing ? (
              <Loader2 size={11} className="animate-spin text-slate-400" />
            ) : fileType?.startsWith("image/") ? (
              <Eye size={11} />
            ) : (
              <Download size={11} />
            )}
            <span>{isPreviewing ? "Checking..." : fileType?.startsWith("image/") ? "View" : "Get"}</span>
          </button>
        </div>
      )}

      {errorText && (
        <div className="text-[10.5px] text-red-600 bg-red-50/50 border border-red-100 px-2 py-1 rounded font-sans leading-normal">
          {errorText}
        </div>
      )}

      {/* 3. Text Preview with Code-styling */}
      {previewText && (
        <div className="bg-slate-950 text-slate-100 border border-slate-800 p-3 rounded-md text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-36 overflow-y-auto selection:bg-cyan-500 selection:text-slate-950">
          {previewText}
        </div>
      )}

      {/* 4. Integrity and PII Redaction Indicators */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {/* Redaction Guard Status badge */}
        <div className="flex items-center gap-1">
          {redactedText ? (
            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded-full text-[10px] font-sans font-semibold">
              <ShieldCheck size={11} className="text-emerald-650" />
              <span>Redacted & Safe</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-100 px-1.5 py-0.5 rounded-full text-[10px] font-sans font-semibold">
              <ShieldAlert size={11} className="text-amber-600" />
              <span>Unfiltered / Raw Output</span>
            </div>
          )}

          {hasWarnings && (
            <span className="text-[10px] font-semibold text-amber-600 font-sans bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full" title={redactionWarnings.join(", ")}>
              ({redactionWarnings.length} flags)
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-[10.5px] text-slate-400 font-sans font-normal text-right">
          Added: <span className="font-mono text-[10px] text-slate-500 font-normal">{formatDateTime(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
