import React from "react";
import { Plus } from "lucide-react";
import BrandLogo from "./BrandLogo";

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  description,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-slate-200 rounded-2xl bg-white shadow-xs max-w-md mx-auto my-12" id="empty-state">
      <div className="p-1 px-1.5 mb-4">
        <BrandLogo variant="icon" height={48} />
      </div>
      <h3 className="text-[18px] font-semibold text-slate-800 font-sans tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-[14px] text-slate-500 font-sans leading-relaxed mb-6 font-normal">
        {description}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-sans font-semibold tracking-normal transition-all duration-150 shadow-sm border border-cyan-500 hover:scale-[1.02] cursor-pointer"
          id="empty-state-action"
        >
          <Plus size={16} />
          {actionText}
        </button>
      )}
    </div>
  );
}
