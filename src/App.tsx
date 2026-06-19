import React, { useState, useEffect } from "react";
import AppShell from "./components/AppShell";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import NewCasePage from "./pages/NewCasePage";
import CaseDetailPage from "./pages/CaseDetailPage";
import ReportPage from "./pages/ReportPage";
import AuthPage from "./pages/AuthPage";
import { FraudCase } from "./types/fraudCase";
import { EvidenceType } from "./types/evidence";
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

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  
  const [activeView, setActiveView] = useState<
    "landing" | "dashboard" | "new_case" | "case_detail" | "report_preview"
  >("landing");

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
      fetchCases();
    } else {
      setCases([]);
      setActiveCaseId(null);
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
    // If navigating to landing, allow without auth
    if (view === "landing") {
      setActiveView("landing");
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
          onStart={() => {
            if (user) {
              setActiveView("dashboard");
            } else {
              setActiveView("dashboard"); // Displays auth page inside shell
            }
          }}
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
