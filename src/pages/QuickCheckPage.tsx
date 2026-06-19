import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import QuickCheckHero from "../components/QuickCheckHero";
import QuickCheckInputPanel from "../components/QuickCheckInputPanel";
import QuickCheckResultCard from "../components/QuickCheckResultCard";
import { runQuickCheck } from "../lib/quickCheck/quickCheckClient";
import { QuickCheckResult } from "../types/quickCheck";

interface QuickCheckPageProps {
  onCreateAccount: () => void;
  onStartFullCase: () => void;
  onBackToLanding: () => void;
}

/**
 * Public, no-sign-up Quick Check flow: Input → Analyze → Result. Renders without an
 * authenticated user (mounted before the auth gate in App.tsx). Nothing is persisted.
 */
export default function QuickCheckPage({
  onCreateAccount,
  onStartFullCase,
  onBackToLanding,
}: QuickCheckPageProps) {
  const [result, setResult] = useState<QuickCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (text: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await runQuickCheck(text);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Quick Check failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewCheck = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 py-4" id="quick-check-page">
      <button
        onClick={onBackToLanding}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-sans cursor-pointer"
      >
        <ArrowLeft size={14} />
        Back to home
      </button>

      {!result ? (
        <>
          <QuickCheckHero />
          <QuickCheckInputPanel onAnalyze={handleAnalyze} isLoading={isLoading} error={error} />
        </>
      ) : (
        <QuickCheckResultCard
          result={result}
          onCreateAccount={onCreateAccount}
          onStartFullCase={onStartFullCase}
          onNewCheck={handleNewCheck}
        />
      )}
    </div>
  );
}
