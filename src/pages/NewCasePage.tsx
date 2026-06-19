import React from "react";
import NewCaseForm from "../components/NewCaseForm";

interface NewCasePageProps {
  onSubmit: (data: { title: string; description: string; incidentDate?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function NewCasePage({ onSubmit, onCancel, isLoading = false }: NewCasePageProps) {
  return (
    <div className="py-4 w-full" id="new-case-page">
      <NewCaseForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={isLoading}
      />
    </div>
  );
}
