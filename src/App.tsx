import React, { useState, useEffect } from "react";
import AppShell from "./components/AppShell";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import NewCasePage from "./pages/NewCasePage";
import CaseDetailPage from "./pages/CaseDetailPage";
import ReportPage from "./pages/ReportPage";
import QuickCheckPage from "./pages/QuickCheckPage";
import AdminSignalsPage from "./pages/AdminSignalsPage";
import AuthPage from "./pages/AuthPage";
import { FraudCase } from "./types/fraudCase";
import { EvidenceType } from "./types/evidence";
import { QuickCheckResult } from "./types/quickCheck";
import { getScamCategoryLabel } from "./lib/utils/risk";
import { getAdminStatus } from "./lib/admin/adminClient";
import { AlertCircle, RefreshCw } from "lucide-react";

// Firebase imports
import { AuthProvider, useAuth } from "./lib/firebase/auth";
import {
  getCases,
  createCase,
  addEvidence,
  addEvidenceFile,
  deleteEvidence,
  analyzeCase,
  deleteCase,
  updateCase,
  seedDemoCases,
} from "./lib/firebase/firestore";

// sessionStorage key holding ONLY a redacted QuickCheckResult while an anonymous user signs in.
const PENDING_QUICK_CHECK_KEY = "fraudcase.pendingQuickCheck";

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  
  const [activeView, setActiveView] = useState<
    "landing" | "quick_check" | "dashboard" | "new_case" | "case_detail" | "report_preview" | "admin_signals"
  >("landing");

  // Admin status drives the (cosmetic) admin nav link; the server enforces access. Starts false.
  const [isAdmin, setIsAdmin] = useState(false);

  const [cases, setCases] = useState<FraudCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  
  // States for loaders and errors
  const [globalLoading, setGlobalLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Sync cases lists from Express server DB State on authentication changes
  useEffect(() => {
    if (user) {
      (async () => {
        await fetchCases();
        await resumePendingQuickCheck();
        setIsAdmin(await getAdminStatus()); // non-fatal; returns false on any error
      })();
    } else {
      setCases([]);
      setActiveCaseId(null);
      setIsAdmin(false);
    }
  }, [user]);

  const fetchCases = async () => {
    try {
      setGlobalLoading(true);
      setApiError(null);
      const data = await getCases();
      setCases(data);
    } catch (err: any) {
      console.error("Could not trace cases from Firestore endpoint: ", err);
      setApiError("Database error: Could not load case files from workspace partition.");
    } finally {
      setGlobalLoading(false);
    }
  };

  // Build a private case from a redacted Quick Check result using the EXISTING authenticated
  // case API (create -> add redacted evidence -> analyze). No new server surface; owner-isolated.
  const saveQuickCheckAsCase = async (result: QuickCheckResult): Promise<FraudCase> => {
    const title = `Quick Check: ${getScamCategoryLabel(result.scamCategory)}`;
    const description = result.shortSummary || "Imported from a public Quick Check scan.";

    const created = await createCase(title, description);
    await addEvidence(created.id, {
      type: "note",
      title: "Imported from Quick Check",
      originalText: result.redactedText, // already redacted/masked — no raw input
    });
    return analyzeCase(created.id);
  };

  // Save action invoked from the Quick Check result card.
  const handleSaveQuickCheckAsCase = async (result: QuickCheckResult) => {
    if (!user) {
      // Signed out: stash ONLY the redacted result, then route to the auth screen.
      try {
        sessionStorage.setItem(PENDING_QUICK_CHECK_KEY, JSON.stringify(result));
      } catch (e) {
        console.warn("Could not stash Quick Check result:", e);
      }
      setActiveView("dashboard"); // AuthPage renders while signed out
      return;
    }

    // Signed in: create the private case now and open it. Throws on failure so the
    // Quick Check page can show a calm, recoverable error (no navigation on failure).
    const created = await saveQuickCheckAsCase(result);
    setCases((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    setActiveCaseId(created.id);
    setActiveView("case_detail");
  };

  // After sign-in, turn any stashed redacted Quick Check result into a private case.
  const resumePendingQuickCheck = async () => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_QUICK_CHECK_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    // Clear first so an effect re-run cannot double-create the case.
    try {
      sessionStorage.removeItem(PENDING_QUICK_CHECK_KEY);
    } catch {
      /* ignore */
    }

    let result: QuickCheckResult;
    try {
      result = JSON.parse(raw) as QuickCheckResult;
    } catch {
      return;
    }

    try {
      setGlobalLoading(true);
      const created = await saveQuickCheckAsCase(result);
      setCases((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setActiveCaseId(created.id);
      setActiveView("case_detail");
    } catch (err) {
      console.error("Could not save pending Quick Check after sign-in:", err);
      setApiError(
        "You're signed in, but we couldn't save your Quick Check result. You can start a new case from your dashboard."
      );
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    try {
      setIsDemoLoading(true);
      setApiError(null);
      await seedDemoCases();
      await fetchCases();
    } catch (err: any) {
      console.error(err);
      setApiError("Failed to import seed cases for testing.");
    } finally {
      setIsDemoLoading(false);
    }
  };

  // Create standard Case Specimen
  const handleCreateCase = async (inputData: {
    title: string;
    description: string;
    incidentDate?: string;
  }) => {
    try {
      setIsActionLoading(true);
      setApiError(null);
      const newCase = await createCase(
        inputData.title,
        inputData.description,
        inputData.incidentDate
      );
      
      // Update local states
      setCases((prev) => [newCase, ...prev]);
      setActiveCaseId(newCase.id);
      setActiveView("case_detail");
    } catch (err: any) {
      console.error(err);
      setApiError("Could not register folder. Verification bounds failed.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Add individual evidence item to specified case (supporting either JSON text or physical file upload)
  const handleAddEvidence = async (
    evidenceInput: {
      type: EvidenceType;
      title: string;
      originalText?: string;
      fileName?: string;
      fileUrl?: string;
    },
    file?: File
  ) => {
    if (!activeCaseId) return;
    try {
      setApiError(null);
      let updatedCaseObj;
      if (file) {
        updatedCaseObj = await addEvidenceFile(activeCaseId, file, {
          type: evidenceInput.type,
          title: evidenceInput.title,
          originalText: evidenceInput.originalText,
        });
      } else {
        updatedCaseObj = await addEvidence(activeCaseId, evidenceInput);
      }
      
      // Update list state
      setCases((prev) =>
        prev.map((c) => (c.id === activeCaseId ? updatedCaseObj : c))
      );
    } catch (err: any) {
      console.error(err);
      setApiError("Unable to register evidence: " + err.message);
    }
  };

  // Remove individual evidence item
  const handleRemoveEvidence = async (evidenceId: string) => {
    if (!activeCaseId) return;
    try {
      setApiError(null);
      const updatedCaseObj = await deleteEvidence(activeCaseId, evidenceId);
      
      setCases((prev) =>
        prev.map((c) => (c.id === activeCaseId ? updatedCaseObj : c))
      );
    } catch (err: any) {
      console.error(err);
      setApiError("Case reduction failed.");
    }
  };

  // Trigger server-side Gemini Model analysis
  const handleAnalyzeCase = async () => {
    if (!activeCaseId) return;
    try {
      setIsAnalyzing(true);
      setApiError(null);
      
      const updatedDoc = await analyzeCase(activeCaseId);
      
      setCases((prev) =>
        prev.map((c) => (c.id === activeCaseId ? updatedDoc : c))
      );
    } catch (err: any) {
      console.error(err);
      setApiError("Evidence telemetry parse fault. Contact support.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Destroy case dossier completely
  const handleDeleteCase = async () => {
    if (!activeCaseId) return;
    try {
      setApiError(null);
      await deleteCase(activeCaseId);

      setCases((prev) => prev.filter((c) => c.id !== activeCaseId));
      setActiveCaseId(null);
      setActiveView("dashboard");
    } catch (err: any) {
      console.error(err);
      setApiError("Failed to purge requested directory folder.");
    }
  };

  // Active case object helper
  const currentCase = cases.find((c) => c.id === activeCaseId);

  // If Firebase context is boot-monitoring the user session state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" id="app-boot-loading">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="animate-spin text-cyan-600 p-3.5 bg-white border border-slate-200 rounded-full shadow-md">
            <RefreshCw size={28} />
          </div>
          <span className="font-mono text-[10.5px] uppercase tracking-widest text-slate-500 font-bold">
            Verifying secure session token...
          </span>
        </div>
      </div>
    );
  }

  // Intercept views when user is not authenticated, shielding case folders
  const handleNavigate = (view: any) => {
    // Public views — available without authentication.
    if (view === "landing" || view === "quick_check") {
      setActiveView(view);
      return;
    }

    // For protected workspace, require user to sign in
    if (!user) {
      setActiveView("dashboard"); // Auth card will render
    } else {
      setActiveView(view);
    }
  };

  const renderActiveView = () => {
    // Always permit the landing view
    if (activeView === "landing") {
      return (
        <LandingPage
          onStart={() => setActiveView("dashboard")}
          onQuickCheck={() => setActiveView("quick_check")}
        />
      );
    }

    // Public Quick Check — intentionally available without authentication.
    if (activeView === "quick_check") {
      return (
        <QuickCheckPage
          isAuthenticated={!!user}
          onSaveAsCase={handleSaveQuickCheckAsCase}
          onBackToLanding={() => setActiveView("landing")}
        />
      );
    }

    // Intercept with AuthPage if user is not authenticated for any secure views
    if (!user) {
      return <AuthPage />;
    }

    if (globalLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4" id="app-loading-spinner">
          <div className="animate-spin text-cyan-600 p-3 bg-white border border-slate-200 rounded-full shadow-sm">
            <RefreshCw size={32} />
          </div>
          <p className="font-mono text-xs text-slate-500 uppercase tracking-widest leading-none">
            RETRIEVING SECURE CASE FILES...
          </p>
        </div>
      );
    }

    switch (activeView) {
      case "dashboard":
        return (
          <DashboardPage
            cases={cases}
            onOpenCase={(id) => {
              setActiveCaseId(id);
              setActiveView("case_detail");
            }}
            onNewCase={() => {
              setActiveView("new_case");
            }}
            onLoadDemo={handleLoadDemo}
            isDemoLoading={isDemoLoading}
          />
        );

      case "new_case":
        return (
          <NewCasePage
            onSubmit={handleCreateCase}
            onCancel={() => {
              setActiveView("dashboard");
            }}
            isLoading={isActionLoading}
          />
        );

      case "case_detail":
        if (!currentCase) {
          return (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">Specified case details could not be found.</p>
              <button
                onClick={() => setActiveView("dashboard")}
                className="mt-4 px-4 py-2 bg-slate-100 text-xs border border-slate-200 rounded text-slate-700 cursor-pointer font-sans font-medium"
              >
                Go Back
              </button>
            </div>
          );
        }
        return (
          <CaseDetailPage
            fraudCase={currentCase}
            onBack={() => {
              setActiveView("dashboard");
              setActiveCaseId(null);
            }}
            onAddEvidence={handleAddEvidence}
            onRemoveEvidence={handleRemoveEvidence}
            onAnalyze={handleAnalyzeCase}
            onDeleteCase={handleDeleteCase}
            onViewReport={() => {
              setActiveView("report_preview");
            }}
            isAnalyzing={isAnalyzing}
          />
        );

      case "report_preview":
        if (!currentCase) {
          return (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">Failed to locate subject report code.</p>
            </div>
          );
        }
        return (
          <ReportPage
            fraudCase={currentCase}
            onBack={() => {
              setActiveView("case_detail");
            }}
          />
        );

      case "admin_signals":
        // Server enforces admin access; the page renders an access-denied state on 403.
        return <AdminSignalsPage />;

      default:
        return <LandingPage onStart={() => setActiveView("dashboard")} />;
    }
  };

  return (
    <AppShell
      activeView={activeView}
      onNavigate={handleNavigate}
      userEmail={user?.email || undefined}
      onSignOut={user ? signOut : undefined}
      isAdmin={isAdmin}
    >
      {/* Global Toast for failures */}
      {apiError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 no-print animate-fade-in-out" id="global-alert-toast">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
          <div className="space-y-1">
            <span className="text-xs font-bold text-red-700 font-mono uppercase block font-sans">System Warning</span>
            <p className="text-xs text-red-650 leading-relaxed font-sans font-medium">{apiError}</p>
          </div>
        </div>
      )}

      {renderActiveView()}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
