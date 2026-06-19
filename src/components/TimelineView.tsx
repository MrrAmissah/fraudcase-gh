import React from "react";
import { Link, MessageSquare, FileText, Image, Receipt } from "lucide-react";
import { TimelineEvent } from "../types/analysis";
import { formatDate } from "../lib/utils/dates";

interface TimelineViewProps {
  timeline: TimelineEvent[];
}

export default function TimelineView({ timeline }: TimelineViewProps) {
  
  const getNodeIcon = (source?: string) => {
    if (!source) return <FileText size={11} className="text-slate-400" />;
    const s = source.toLowerCase();
    if (s.includes("sms")) return <MessageSquare size={11} className="text-cyan-600" />;
    if (s.includes("whatsapp") || s.includes("chat")) return <MessageSquare size={11} className="text-cyan-600" />;
    if (s.includes("url") || s.includes("link")) return <Link size={11} className="text-cyan-600" />;
    if (s.includes("receipt") || s.includes("payment")) return <Receipt size={11} className="text-cyan-600" />;
    if (s.includes("screenshot")) return <Image size={11} className="text-cyan-600" />;
    return <FileText size={11} className="text-slate-400" />;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs text-left" id="timeline-flow-panel">
      {/* Header block */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h4 className="text-[14px] font-semibold font-sans text-slate-800 tracking-tight">
          Reconstructed Case Timeline
        </h4>
        <p className="text-[13px] text-slate-500 font-sans font-normal mt-1 leading-normal">
          Chronological event order extracted from headers, text timestamps, and logs in the case folder.
        </p>
      </div>

      {!timeline || timeline.length === 0 ? (
        <div className="p-8 text-center text-[13.5px] text-slate-405 font-sans font-normal bg-white">
          No timeline events extracted yet. Import evidence to build context.
        </div>
      ) : (
        <div className="p-6 relative bg-white" id="timeline-scroll-area">
          {/* Thin elegant vertical core line */}
          <div className="absolute left-[29px] top-6 bottom-6 w-[1px] bg-slate-200" />

          <div className="space-y-6">
            {timeline.map((event, index) => (
              <div key={index} className="flex gap-4 relative" id={`timeline-event-${index}`}>
                
                {/* Node circle and icon wrapper (Smaller circle) */}
                <div className="z-10 w-[26px] h-[26px] rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 ml-[1px]">
                  {getNodeIcon(event.source)}
                </div>

                {/* Event card details */}
                <div className="flex-grow p-3 hover:bg-slate-50/50 rounded-xl transition-colors border border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                    <span className="text-[11.5px] font-sans text-slate-400 font-medium">
                      {event.date ? formatDate(event.date) : "Situational Timeline"}
                    </span>
                    {event.source && (
                      <span className="px-2 py-0.5 bg-slate-50 border border-slate-150 rounded font-sans text-[10px] text-slate-500 font-normal w-fit ml-auto">
                        Source: {event.source}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[13.5px] text-slate-705 leading-relaxed font-sans font-normal">
                    {event.event}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
