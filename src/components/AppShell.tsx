import React from "react";
import { Lock, AlertTriangle, User, ShieldCheck, Sparkles } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
  userEmail?: string;
  onSignOut?: () => void;
  isAdmin?: boolean;
}

/** Nav destinations that actually exist in the app. */
const NAV_ITEMS = [
  { view: "landing", label: "Portal", id: "nav-landing", matches: ["landing"] },
  { view: "quick_check", label: "Quick Check", id: "nav-quick-check", matches: ["quick_check"] },
  {
    view: "dashboard",
    label: "Cases",
    id: "nav-dashboard",
    matches: ["dashboard", "new_case", "case_detail", "report_preview"],
  },
];

export default function AppShell({
  children,
  activeView,
  onNavigate,
  userEmail,
  onSignOut,
  isAdmin = false,
}: AppShellProps) {
  // The landing page paints its own full-bleed bands, so it opts out of the
  // centered, padded content column every other view uses.
  const isLanding = activeView === "landing";

  const navItems = isAdmin
    ? [
        ...NAV_ITEMS,
        { view: "admin_signals", label: "Signals", id: "nav-admin-signals", matches: ["admin_signals"] },
      ]
    : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="app-shell">
      {/* Standing safety banner */}
      <div
        className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-[11.5px] text-amber-800 flex items-center justify-center gap-2"
        id="forensic-safety-banner"
      >
        <AlertTriangle size={13} className="flex-shrink-0 text-amber-600" />
        <span>
          <strong className="font-semibold">AI Evidence Organizer:</strong> This is a
          decision-support helper. It does not determine guilt or replace official legal advice or
          investigation.
        </span>
      </div>

      {/* Header */}
      <header
        className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40"
        id="app-header"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => onNavigate("landing")}
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
            id="brand-logo"
            aria-label="FraudCase GH home"
          >
            <img src="/brand/fraudcase-wordmark.png" alt="FraudCase GH" className="h-9 w-auto" />
          </button>

          {/* Centered pill navigation */}
          <nav
            className="flex items-center gap-1 bg-slate-100/70 border border-slate-200 rounded-xl p-1"
            id="main-nav"
          >
            {navItems.map((item) => {
              const active = item.matches.includes(activeView);
              return (
                <button
                  key={item.view}
                  onClick={() => onNavigate(item.view)}
                  id={item.id}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-white text-brand-700 font-semibold shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Session badge */}
          <div className="flex items-center gap-3 flex-shrink-0" id="user-badge-container">
            {userEmail ? (
              <>
                <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <span className="p-1 bg-brand-50 rounded-lg text-brand-600">
                    <User size={13} />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Active user
                    </span>
                    <span className="text-[11.5px] text-slate-700 font-mono max-w-[170px] truncate">
                      {userEmail}
                    </span>
                  </div>
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="px-3 py-2 text-[11.5px] font-semibold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-all cursor-pointer"
                    id="sign-out-btn"
                  >
                    Sign out
                  </button>
                )}
              </>
            ) : (
              <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                <span className="p-1 bg-brand-50 rounded-lg text-brand-600">
                  <Lock size={13} />
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Investigator mode
                  </span>
                  <span className="text-[11.5px] text-slate-700">Guest access</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main
        className={
          isLanding
            ? "flex-grow w-full flex flex-col justify-start"
            : "flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-start"
        }
      >
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white pt-12 pb-8" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1fr)] gap-10 lg:gap-12">
            {/* Brand */}
            <div className="space-y-4">
              <img src="/brand/fraudcase-wordmark.png" alt="FraudCase GH" className="h-9 w-auto" />
              <p className="text-[13px] text-slate-600 leading-relaxed max-w-xs">
                Organize evidence, assess risk, and build clear case reports with confidence.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
                  <Sparkles size={12.5} className="text-brand-600" />
                  AI-assisted decision support
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
                  <ShieldCheck size={12.5} className="text-brand-600" />
                  Evidence stays private
                </span>
              </div>
            </div>

            {/* Product navigation — only destinations that exist */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-4">
                Product
              </div>
              <ul className="space-y-2.5">
                <li>
                  <button
                    onClick={() => onNavigate("quick_check")}
                    className="text-[13px] text-slate-600 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    Quick Check
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate("dashboard")}
                    className="text-[13px] text-slate-600 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    Cases
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate("landing")}
                    className="text-[13px] text-slate-600 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    Portal
                  </button>
                </li>
              </ul>
            </div>

            {/* Privacy and security notice */}
            <div className="space-y-4">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Privacy &amp; security
              </div>
              <p className="text-[12.5px] text-slate-600 leading-relaxed">
                FraudCase GH helps organize scattered evidence. Never include passwords, passcodes,
                or bank PINs in the messages you upload. Sensitive details are redacted before
                analysis, and Quick Check stores nothing.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11.5px] text-slate-400">
            <span>&copy; {new Date().getFullYear()} FraudCase GH. All rights reserved.</span>
            <span className="text-center md:text-right md:max-w-xl leading-relaxed">
              FraudCase GH is an independent digital evidence organization aid and is not affiliated
              with any police, government body, or judicial cybersecurity authority. To file a
              formal claim, contact your bank, telecom operator, or the relevant authorities.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
