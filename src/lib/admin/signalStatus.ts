import { ReviewedStatus } from "../../types/communitySignal";

/** Display metadata for review statuses (careful, non-accusatory labels). */
export const REVIEW_STATUS_META: Record<ReviewedStatus, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  reviewed: { label: "Reviewed", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  useful: { label: "Useful pattern", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  false_positive: { label: "False positive", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const REVIEW_STATUS_ORDER: ReviewedStatus[] = ["pending", "reviewed", "useful", "false_positive"];
