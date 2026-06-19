import React from "react";
import ReportPreview from "../components/ReportPreview";
import { FraudCase } from "../types/fraudCase";

interface ReportPageProps {
  fraudCase: FraudCase;
  onBack: () => void;
}

export default function ReportPage({ fraudCase, onBack }: ReportPageProps) {
  return (
    <div className="py-4 w-full" id="report-page">
      <ReportPreview fraudCase={fraudCase} onBack={onBack} />
    </div>
  );
}
