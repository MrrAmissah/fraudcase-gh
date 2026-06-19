import React, { useState } from "react";
import { FolderPlus, Search, ShieldCheck, Info } from "lucide-react";
import DashboardStats from "../components/DashboardStats";
import CaseCard from "../components/CaseCard";
import EmptyState from "../components/EmptyState";
import { FraudCase } from "../types/fraudCase";

interface DashboardPageProps {
  cases: FraudCase[];
  onOpenCase: (id: string) => void;
  onNewCase: () => void;
  onLoadDemo?: () => void;
  isDemoLoading?: boolean;
}

export default function DashboardPage({ 
  cases, 
  onOpenCase, 
  onNewCase,
  onLoadDemo,
  isDemoLoading
}: DashboardPageProps) {
  const [searchQuery, setSearchQuery] = useState("");


  const filteredCases = cases.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 w-full text-slate-800" id="dashboard-page">
      {/* Overview stats layout */}
      <DashboardStats cases={cases} />

      {/* Main workspace section */}
      <div className="space-y-4">
        {/* Workspace ribbon header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-[21px] font-semibold font-sans text-slate-900 tracking-tight">
              Case Evidence Desk
            </h2>
            <p className="text-[13.5px] text-slate-500 font-sans mt-0.5">
              Review active cases, organize evidence timelines, and generate case reports.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search case reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-805 placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 w-44 sm:w-56"
                id="case-search-filter"
              />
            </div>

            {/* CTA action */}
            <button
              onClick={onNewCase}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-medium tracking-normal border border-cyan-500 cursor-pointer shadow-md transition-all"
              id="dashboard-new-case-btn"
            >
              <FolderPlus size={14} />
              Add Evidence
            </button>
          </div>
        </div>

        {/* List of cases */}
        {filteredCases.length === 0 ? (
          searchQuery ? (
            <div className="text-center py-12 border border-slate-200 bg-white rounded-xl">
              <p className="text-slate-500 text-sm font-sans">
                No cases matched your search query "{searchQuery}". Try editing filters.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full" id="empty-dashboard-wrapper">
              <EmptyState
                title="No Cases Registered"
                description="Create a case folder to begin organizing SMS logs, WhatsApp chat exports, or transaction references."
                actionText="Add First Case"
                onAction={onNewCase}
              />
              {onLoadDemo && (
                <button
                  type="button"
                  onClick={onLoadDemo}
                  disabled={isDemoLoading}
                  className="mt-6 px-4 py-2 text-xs font-sans font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  id="dashboard-load-demo-btn"
                >
                  {isDemoLoading ? "Seeding isolated cases..." : "Load Demo Cases"}
                </button>
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="cases-grid-list">
            {filteredCases.map((fraudCase) => (
              <CaseCard
                key={fraudCase.id}
                fraudCase={fraudCase}
                onOpen={onOpenCase}
              />
            ))}
          </div>
        )}
      </div>

      {/* Safety & Privacy Notice + System Notice sections aligned with requested hierarchy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-slate-200" id="dashboard-notices">
        {/* 4. Safety/Privacy Notice */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-cyan-700 font-semibold font-sans text-sm">
            <ShieldCheck size={16} />
            <span>Safety & Privacy Notice</span>
          </div>
          <p className="text-[14px] text-slate-600 leading-relaxed font-sans font-normal">
            FraudCase GH serves as an independent evidence organizer. All analysis is structured to assist users in compiling their own timelines. We strongly advise against pasting sensitive passwords, active banking credentials, or private PINs.
          </p>
        </div>

        {/* 5. System Notice */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-slate-700 font-semibold font-sans text-sm">
            <Info size={16} />
            <span>System Notice & Credibility Guidance</span>
          </div>
          <p className="text-[14px] text-slate-600 leading-relaxed font-sans font-normal">
            This platform is an independent aid and is not endorsed or operated by any government body, law-enforcement agency, or official Cybersecurity Authority. It does not replace official reports. Users seeking official investigations are urged to contact their relevant financial institution, network service provider, or local law-enforcement agencies directly.
          </p>
        </div>
      </div>
    </div>
  );
}
