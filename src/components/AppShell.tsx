import React from "react";
import { Lock, AlertTriangle, HelpCircle, Terminal, User } from "lucide-react";
import BrandLogo from "./BrandLogo";

interface AppShellProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
  userEmail?: string;
  onSignOut?: () => void;
}

export default function AppShell({
  children,
  activeView,
  onNavigate,
  userEmail,
  onSignOut,
}: AppShellProps) {

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="app-shell">
      {/* Top Warning Banner / Forensics Mode */}
      <div className="bg-amber-50 border-b border-amber-250 px-4 py-2 text-center text-xs text-amber-850 font-sans tracking-wide flex items-center justify-center gap-2" id="forensic-safety-banner">
        <AlertTriangle size={14} className="flex-shrink-0 text-amber-600" />
        <span>
          <strong>AI Evidence Organizer:</strong> This is a decision-support helper. It does not determine guilt or replace official legal advice/investigation.
        </span>
      </div>

      {/* Main Header navigation */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-40" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          <div 
            onClick={() => onNavigate("landing")} 
            className="flex items-center cursor-pointer group hover:opacity-90 transition-opacity"
            id="brand-logo"
          >
            <BrandLogo variant="full" height={34} />
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-4" id="main-nav">
            <button
              onClick={() => onNavigate("landing")}
              className={`px-3 py-1 rounded-lg text-xs font-sans transition-colors cursor-pointer ${
                activeView === "landing"
                  ? "bg-slate-100 border border-slate-200 text-slate-850 font-medium"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              id="nav-landing"
            >
              Portal
            </button>
            <button
              onClick={() => onNavigate("dashboard")}
              className={`px-3 py-1 rounded-lg text-xs font-sans transition-colors cursor-pointer ${
                activeView === "dashboard" || activeView === "new_case" || activeView === "case_detail" || activeView === "report_preview"
                  ? "bg-slate-100 border border-slate-200 text-slate-850 font-medium"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              id="nav-dashboard"
            >
              Cases
            </button>
          </nav>

          {/* User Session Metadata Badge */}
          <div className="flex items-center gap-3.5" id="user-badge-container">
            {userEmail ? (
              <>
                <div className="hidden md:flex flex-col items-end text-[11px] font-sans text-slate-400">
                  <span className="font-medium text-[10px] uppercase tracking-wider text-slate-700">Active User</span>
                  <span className="text-slate-600 font-mono text-[11px]">{userEmail}</span>
                </div>
                <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-full text-slate-500">
                  <User size={14} />
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="px-2.5 py-1.5 text-[11px] font-sans font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/70 border border-red-200 hover:border-red-300 rounded-lg transition-all shadow-xs cursor-pointer"
                    id="sign-out-btn"
                  >
                    Sign Out
                  </button>
                )}
              </>
            ) : (
              <div className="hidden md:flex flex-col items-end text-[11px] font-sans text-slate-400">
                <span className="font-medium text-[10px] uppercase tracking-wider text-slate-500">Investigator Mode</span>
                <span className="text-slate-400 font-sans text-[11.5px]">Guest Access</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Core View Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-start">
        {children}
      </main>

      {/* Footer / Privacy Policy disclaimer notice */}
      <footer className="border-t border-slate-200 bg-white py-8 text-slate-500 text-xs mt-12" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-semibold font-sans text-sm">
                <Lock size={14} className="text-cyan-600" />
                <span>Privacy & Security Notice</span>
              </div>
              <p className="text-slate-600 leading-relaxed max-w-lg font-sans font-normal text-[14px]">
                FraudCase GH helps organize scattered evidence. We advise users never to include highly sensitive keys, passcode credentials, or bank PINs in the input logs. Your safety and data control are supported.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-semibold font-sans text-sm">
                <Terminal size={14} className="text-amber-600" />
                <span>System & Privacy Notice</span>
              </div>
              <p className="text-slate-500 leading-relaxed font-sans font-normal text-[14px]">
                Designed to facilitate case report preparation. This application is an independent digital evidence organization aid and is not affiliated with any police, government body, or judicial cybersecurity authority.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 mt-6 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400">
            <span>&copy; {new Date().getFullYear()} FraudCase GH. All rights reserved.</span>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Contact reliable official reporting channels if filing a formal claim.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
