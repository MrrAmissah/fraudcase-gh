import React, { useState } from "react";
import { PlusCircle, Info, CalendarClock, ShieldAlert } from "lucide-react";

interface NewCaseFormProps {
  onSubmit: (data: { title: string; description: string; incidentDate?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function NewCaseForm({ onSubmit, onCancel, isLoading = false }: NewCaseFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [errorObj, setErrorObj] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorObj(null);

    if (!title.trim()) {
      setErrorObj("Please enter a case identifier title.");
      return;
    }
    if (!description.trim()) {
      setErrorObj("Please outline some details about the fraud incident.");
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      incidentDate: incidentDate || undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white border border-slate-200 rounded-2xl shadow-xl relative overflow-hidden text-slate-800" id="new-case-form-card">
      
      {/* Top micro decoration */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600" />

      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-cyan-50 border border-cyan-150 text-cyan-600 rounded-xl">
          <ShieldAlert size={22} />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold font-sans text-slate-900 tracking-tight">
            Create New Case Folder
          </h2>
          <p className="text-[13.5px] text-slate-500 font-sans leading-relaxed mt-1">
            Set up your case folder. You can subsequently add messages, chat logs, links, or transaction details.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" id="new-case-form">
        {errorObj && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <Info size={14} />
            <span>{errorObj}</span>
          </div>
        )}

        {/* Title Input */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-slate-600 font-sans tracking-normal">
            Case Title / Main Subject
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
            placeholder="e.g., Fake Courier Clearance GHS 12.50 SMS Scam"
            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 transition-colors font-sans"
            id="input-title"
          />
          <p className="text-[11px] text-slate-400 font-sans">
            Give it a descriptive, unique title naming the main organization impersonated or action.
          </p>
        </div>

        {/* Date Row */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-slate-600 font-sans tracking-normal flex items-center gap-1.5">
            <CalendarClock size={12} />
            Incident Date
          </label>
          <input
            type="date"
            value={incidentDate}
            onChange={(e) => setIncidentDate(e.target.value)}
            disabled={isLoading}
            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-cyan-500/80 transition-colors font-mono"
            id="input-date"
          />
        </div>

        {/* Description Input */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-slate-600 font-sans tracking-normal">
            Incident Description (Context Recap)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={4}
            placeholder="Outline how the communication arose, what you were asked to do, any transaction details made, or threat sequences mentioned."
            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 transition-colors font-sans"
            id="input-description"
          />
          <p className="text-[11px] text-slate-400 font-sans">
            Write anything you remember. Do not include critical secrets (like account pins, password codes).
          </p>
        </div>

        {/* Active controls */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100" id="form-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-sans font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            id="cancel-case-btn"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-semibold tracking-normal border border-cyan-500 transition-all cursor-pointer shadow-md disabled:opacity-50"
            id="create-case-btn"
          >
            {isLoading ? "Creating..." : "Create Case Folder"}
          </button>
        </div>
      </form>
    </div>
  );
}
