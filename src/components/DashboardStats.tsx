import React from "react";
import { FolderKanban, Edit3, ShieldAlert, CheckCircle } from "lucide-react";
import { FraudCase } from "../types/fraudCase";

interface DashboardStatsProps {
  cases: FraudCase[];
}

export default function DashboardStats({ cases }: DashboardStatsProps) {
  const total = cases.length;
  const draft = cases.filter((c) => c.status === "draft").length;
  const analyzed = cases.filter((c) => c.status === "analyzed").length;
  const exported = cases.filter((c) => c.status === "exported" || c.status === "reviewed").length;

  const cards = [
    {
      id: "stat-total",
      title: "Total Cases Registered",
      value: total,
      icon: <FolderKanban size={20} />,
      color: "text-blue-600 border-blue-200 bg-blue-50/50",
    },
    {
      id: "stat-draft",
      title: "Active Drafts",
      value: draft,
      icon: <Edit3 size={20} />,
      color: "text-amber-600 border-amber-200 bg-amber-50/50",
    },
    {
      id: "stat-analyzed",
      title: "AI Analyzed Cases",
      value: analyzed,
      icon: <ShieldAlert size={20} />,
      color: "text-cyan-600 border-cyan-200 bg-cyan-50/50",
    },
    {
      id: "stat-exported",
      title: "Exported Reports",
      value: exported,
      icon: <CheckCircle size={20} />,
      color: "text-emerald-600 border-emerald-200 bg-emerald-50/50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="stats-ribbon">
      {cards.map((card) => (
        <div
          key={card.id}
          className={`p-5 border rounded-xl backdrop-blur-sm transition-all flex flex-col justify-between bg-white shadow-sm hover:shadow-md ${card.color}`}
          id={card.id}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-slate-600 text-[13px] font-sans font-medium tracking-normal">
              {card.title}
            </span>
            <div className="p-1 opacity-80">{card.icon}</div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 font-sans tracking-tight">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
