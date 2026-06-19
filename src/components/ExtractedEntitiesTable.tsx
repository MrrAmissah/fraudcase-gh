import React from "react";
import { ArrowUpRight, User } from "lucide-react";
import { ExtractedEntities } from "../types/analysis";

interface ExtractedEntitiesTableProps {
  entities: ExtractedEntities;
}

export default function ExtractedEntitiesTable({ entities }: ExtractedEntitiesTableProps) {
  const { phoneNumbers, urls, names, organizations, amounts, dates, transactionReferences, locations } = entities;

  const rows = [
    {
      id: "ent-organizations",
      label: "Impersonated organizations",
      items: organizations || [],
      tagColor: "bg-cyan-50/50 border-cyan-150 text-cyan-800 font-sans",
    },
    {
      id: "ent-names",
      label: "Claimed names / aliases",
      items: names || [],
      tagColor: "bg-cyan-50/50 border-cyan-150 text-cyan-800 font-sans",
    },
    {
      id: "ent-phones",
      label: "Phone numbers / sender IDs",
      items: phoneNumbers || [],
      tagColor: "bg-cyan-50/50 border-cyan-150 text-cyan-800 font-mono",
    },
    {
      id: "ent-urls",
      label: "External links",
      items: urls || [],
      tagColor: "bg-red-50/50 border-red-150 text-red-700 font-mono break-all",
    },
    {
      id: "ent-amounts",
      label: "Monetary requests",
      items: amounts || [],
      tagColor: "bg-amber-50/50 border-amber-150 text-amber-800 font-mono",
    },
    {
      id: "ent-dates",
      label: "Dates",
      items: dates || [],
      tagColor: "bg-cyan-50/50 border-cyan-150 text-cyan-800 font-sans",
    },
    {
      id: "ent-references",
      label: "Transaction references",
      items: transactionReferences || [],
      tagColor: "bg-emerald-50/50 border-emerald-150 text-emerald-800 font-mono",
    },
    {
      id: "ent-locations",
      label: "Locations",
      items: locations || [],
      tagColor: "bg-cyan-50/50 border-cyan-150 text-cyan-800 font-sans",
    },
  ];

  const hasAnyEntities = rows.some((r) => r.items && r.items.length > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs" id="entities-log-panel">
      {/* Table Header block */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h4 className="text-[14px] font-semibold font-sans text-slate-800 tracking-tight">
          Extracted Case Entities
        </h4>
        <p className="text-[13px] text-slate-500 font-sans font-normal mt-1 leading-normal">
          Key elements identified automatically within the evidence vault by AI analysis.
        </p>
      </div>

      {!hasAnyEntities ? (
        <div className="p-8 text-center text-[13.5px] text-slate-405 font-sans font-normal bg-white">
          No specific entities parsed yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            if (!row.items || row.items.length === 0) return null;
            return (
              <div
                key={row.id}
                className="p-4 flex flex-col sm:flex-row sm:items-baseline gap-3 justify-between hover:bg-slate-50/50 transition-colors"
                id={row.id}
              >
                {/* Meta Column */}
                <div className="flex items-center gap-2 sm:max-w-[220px] flex-shrink-0">
                  <span className="text-[13px] font-semibold text-slate-600 font-sans">
                    {row.label}
                  </span>
                </div>

                {/* Badges Column */}
                <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end flex-grow">
                  {row.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-2 py-0.5 text-[12px] border rounded-md inline-flex items-center gap-1 font-normal ${row.tagColor}`}
                    >
                      <span>{item}</span>
                      {row.id === "ent-urls" && (
                        <a
                          href={item.startsWith("http") ? item : `https://${item}`}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          className="hover:text-red-900 ml-0.5 inline-block cursor-pointer"
                          title="Review safely in separate container"
                        >
                          <ArrowUpRight size={10} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
