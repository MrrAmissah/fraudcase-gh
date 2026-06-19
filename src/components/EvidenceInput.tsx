import React, { useState } from "react";
import { 
  MessageSquare, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  UploadCloud, 
  X, 
  FileText, 
  Image as ImageIcon 
} from "lucide-react";
import { EvidenceType } from "../types/evidence";
import { redactPIIAndSecrets, countSensitivePatterns } from "../lib/security/redaction";

interface EvidenceInputProps {
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
  isLoading?: boolean;
}

export default function EvidenceInput({ onAddEvidence, isLoading = false }: EvidenceInputProps) {
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("sms");
  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("");
  
  // Local Redaction State
  const [isRedactingLocal, setIsRedactingLocal] = useState(true);

  // File drag & selection states
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; type: string } | null>(null);
  
  // Progress and error display states
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const getPlaceholder = (type: EvidenceType) => {
    switch (type) {
      case "sms":
        return "Paste raw SMS text exactly as received, including headers/sender masks like 'GH-POST: ...'";
      case "whatsapp":
        return "Paste WhatsApp message, chat export logs, or private messenger lines (including stamps if possible)...";
      case "url":
        return "Paste full suspected link/URL starting with http:// or https:// (e.g. http://gh-postal-fees.icu)";
      case "receipt":
        return "Explain receipt payment reference code, Mobile Money cash transaction ID, withdrawal trace info, etc.";
      case "screenshot":
        return "Describe the visual mock capture or details shown in your file attachment...";
      default:
        return "Enter full detailed evidence contents here...";
    }
  };

  const handleFileTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as EvidenceType;
    setEvidenceType(type);
    
    // Set auto titles if empty or default
    if (!title || title.startsWith("Phishing") || title.startsWith("Threat") || title.startsWith("Recruitment") || title.startsWith("Mobile") || title.startsWith("Visual") || title.startsWith("Evidence")) {
      if (type === "url") setTitle("Phishing Destination Query Link");
      else if (type === "sms") setTitle("Threat/Inducement SMS String");
      else if (type === "whatsapp") setTitle("Recruitment/Impersonation Chat Thread");
      else if (type === "receipt") setTitle("Mobile Money Transaction Traces");
      else if (type === "screenshot") setTitle("Visual Proof Screen Capture");
      else if (type === "document") setTitle("Forensic Document Copy");
      else setTitle("");
    }
  };

  const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".csv", ".json", ".html"];
  const allowedMimeTypes = [
    "image/png", 
    "image/jpeg", 
    "image/webp", 
    "application/pdf", 
    "text/plain", 
    "text/csv", 
    "application/json", 
    "text/html"
  ];

  const handleFileSelection = (file: File) => {
    setFileError(null);
    
    // Check file size limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setFileError("File is too large. Maximum permitted size is 10MB.");
      return;
    }

    // Check file formats
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const mime = file.type;
    const isExtensionOk = allowedExtensions.includes(ext);
    const isMimeOk = allowedMimeTypes.includes(mime);

    if (!isExtensionOk && !isMimeOk) {
      setFileError("Forbidden type. Supported formats: PNG, JPG, WebP, PDF, TXT, CSV, JSON, HTML.");
      return;
    }

    setSelectedFile(file);
    
    // Human-friendly sizes
    let formattedSize = `${(file.size / 1024).toFixed(1)} KB`;
    if (file.size > 1024 * 1024) {
      formattedSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    setUploadedFile({
      name: file.name,
      size: formattedSize,
      type: file.type || "application/octet-stream",
    });

    // Smart auto title fills
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    // If text file, inject parsed script previews automatically
    const isTextFile = 
      ["text/plain", "text/csv", "application/json", "text/html"].includes(file.type) ||
      [".txt", ".csv", ".json", ".html"].includes(ext);

    if (isTextFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === "string") {
          setOriginalText(event.target.result);
        }
      };
      reader.readAsText(file);
    } else {
      // General OCR prompt placeholder if it is an image or PDF
      setOriginalText(`[File Attachment Signature: Name: ${file.name}, MIME: ${file.type || ext}, Size: ${formattedSize}]`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setUploadedFile(null);
    setFileError(null);
    setUploadProgress(null);
    setOriginalText("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let textToSend = originalText.trim();
    if (isRedactingLocal && textToSend) {
      // Local safety sanitization
      const redactResult = redactPIIAndSecrets(textToSend);
      textToSend = redactResult.redactedText;
    }

    // Interactive progress bar simulations
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev === null) return null;
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 15;
      });
    }, 80);

    // Call onAddEvidence with raw selected file after synthetic progression delay
    setTimeout(() => {
      onAddEvidence(
        {
          type: evidenceType,
          title: title.trim(),
          originalText: textToSend || undefined,
          fileName: uploadedFile?.name,
          fileUrl: undefined,
        },
        selectedFile || undefined
      );

      clearInterval(interval);
      setUploadProgress(100);

      // Reset all interactive states
      setTimeout(() => {
        setTitle("");
        setOriginalText("");
        setSelectedFile(null);
        setUploadedFile(null);
        setUploadProgress(null);
        setFileError(null);
      }, 300);
    }, 600);
  };

  // Local pattern counter for warnings
  const sensitiveItemsCount = countSensitivePatterns(originalText);

  return (
    <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-800" id="evidence-ingestion-deck">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-cyan-50 border border-cyan-100 rounded-lg text-cyan-600">
          <MessageSquare size={16} />
        </div>
        <h3 className="text-[14px] font-semibold font-sans text-slate-800">
          Import Case Evidence
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Type Selection & Description Title */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-slate-600 font-sans">
              Evidence Type
            </label>
            <select
              value={evidenceType}
              onChange={handleFileTypeChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-cyan-500/80 cursor-pointer font-sans"
              id="select-evidence-type"
            >
              <option value="sms">Unsolicited SMS Message</option>
              <option value="whatsapp">WhatsApp / Telegram Thread</option>
              <option value="url">Suspicious Web Link / URL</option>
              <option value="receipt">MoMo Transaction / Receipt Trace</option>
              <option value="screenshot">Device Screen Capture</option>
              <option value="document">Forensic Document Upload</option>
              <option value="email">Raw Phishing Email Copy</option>
              <option value="note">Supplementary Analyst Note</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-slate-600 font-sans">
              Evidence Label / Title description
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Delivery warning SMS thread"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 font-sans"
              id="input-evidence-title"
            />
          </div>
        </div>

        {/* Real File Upload area (Always visible as drag zone to allow rich attachments for all types!) */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-slate-600 font-sans">
            File Attachment <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => {
              const element = document.getElementById("file-picker-trigger");
              if (element) element.click();
            }}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all relative ${
              dragActive
                ? "border-cyan-550 bg-cyan-50/50"
                : uploadedFile
                ? "border-emerald-500 bg-emerald-50/10"
                : "border-slate-300 hover:border-slate-400 bg-slate-50/40"
            }`}
            id="file-drop-target"
          >
            <input
              type="file"
              id="file-picker-trigger"
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv,.json,.html,image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
            />
            {uploadedFile ? (
              <div className="flex items-center justify-between gap-4 p-1 rounded bg-white border border-slate-105 shadow-2xs text-left max-w-lg mx-auto font-sans text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
                    {uploadedFile.type.startsWith("image/") ? <ImageIcon size={18} /> : <FileText size={18} />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-800 truncate max-w-[220px]">{uploadedFile.name}</p>
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-450">
                      <span className="font-medium bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-sans uppercase">
                        {uploadedFile.name.split(".").pop()?.toUpperCase()}
                      </span>
                      <span>&bull;</span>
                      <span>{uploadedFile.size}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded"
                  title="Remove attachment"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 py-2 text-xs text-slate-500 font-sans flex flex-col items-center">
                <UploadCloud size={28} className="text-slate-400 animate-bounce" />
                <p className="font-semibold text-[11px] text-slate-600 tracking-normal uppercase">
                  Drag & drop your file here
                </p>
                <p className="text-slate-450 font-normal text-[11px]">
                  Supports PNG, JPG, WebP, PDF, TXT, CSV, JSON, HTML up to 10MB
                </p>
              </div>
            )}
          </div>

          {/* Validation/Upload Errors */}
          {fileError && (
            <div className="text-[11.5px] text-red-600 flex items-center gap-1 font-sans font-medium mt-1">
              <AlertCircle size={13} className="flex-shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Synthetic Progress bar */}
          {uploadProgress !== null && (
            <div className="mt-2 space-y-1 font-sans" id="upload-progress-box">
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Uploading files...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-cyan-600 h-full rounded-full transition-all duration-100" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Text Input area (Optional if file bound, otherwise helpful) */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-slate-600 font-sans">
            Evidence Text / Parsed Payload Extract
          </label>
          <textarea
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            rows={3}
            placeholder={getPlaceholder(evidenceType)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 font-mono"
            id="input-evidence-text"
          />
        </div>

        {/* Local PII Redactor Controls */}
        {originalText && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5" id="redactor-controls">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className={isRedactingLocal ? "text-cyan-600" : "text-slate-400"} />
                <span className="text-xs text-slate-705 font-bold font-sans">
                  Active Redaction Preprocessing Guard
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRedactingLocal}
                  onChange={(e) => setIsRedactingLocal(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600 peer-checked:after:bg-white" />
              </label>
            </div>

            {sensitiveItemsCount > 0 && (
              <div className="text-[11px] text-amber-600 flex items-start gap-1.5 leading-normal font-sans font-medium">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5 animate-pulse" />
                <span>
                  Detected <strong>{sensitiveItemsCount} sensitive credentials/PII triggers</strong>. 
                  {isRedactingLocal 
                    ? " They will be safely masked locally (e.g. [CARD/WALLET-REDACTED]) before AI review starts." 
                    : " WARNING: This text contains highly sensitive details that will transit raw!"}
                </span>
              </div>
            )}
            
            {isRedactingLocal && (
              <div className="p-2 bg-white border border-slate-200 rounded text-[10px] text-cyan-850 font-mono overflow-x-auto whitespace-pre-wrap max-h-32">
                <span className="text-slate-450 font-semibold block border-b border-slate-100 pb-1 mb-1 font-sans">
                  Redacted Sanitization Preview Output
                </span>
                {redactPIIAndSecrets(originalText).redactedText || "(No payload extracted)"}
              </div>
            )}
          </div>
        )}

        {/* Submit action */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isLoading || !title.trim() || !originalText.trim()}
            className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-semibold tracking-normal transition-all cursor-pointer disabled:opacity-40"
            id="bind-evidence-btn"
          >
            Add Evidence
            <ChevronRight size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
