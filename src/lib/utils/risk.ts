/**
 * Risk score & Category helper utilities for FraudCase GH
 */

export interface RiskLevelInfo {
  label: "Critical" | "High" | "Medium" | "Low";
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export function getRiskLevel(score: number): RiskLevelInfo {
  if (score >= 80) {
    return {
      label: "Critical",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      description: "Severe warnings present. Multiple suspicious request vectors or high-loss vectors identified."
    };
  }
  if (score >= 50) {
    return {
      label: "High",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
      description: "Strong signal match of registered local fraud templates (e.g., impersonations, fake clearance fees)."
    };
  }
  if (score >= 25) {
    return {
      label: "Medium",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
      description: "Ambiguous markers. Suspicious patterns detected; additional corroboration required."
    };
  }
  return {
    label: "Low",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    description: "Standard signals. Low indicators detected, but maintain high vigilance."
  };
}

export function getScamCategoryLabel(category: string): string {
  switch (category) {
    case "smishing":
      return "Smishing (SMS Scam)";
    case "phishing":
      return "Phishing Link / Email";
    case "impersonation":
      return "Identity Impersonation";
    case "fake_delivery":
      return "Fake Delivery/Courier Fee";
    case "payment_dispute":
      return "Payment Dispute or MoMo Reversal";
    case "fake_investment":
      return "Fake Investment/Ponzi Signal";
    case "romance_scam":
      return "Social/Romance Fraud";
    case "account_takeover":
      return "Account Takeover Attempt";
    default:
      return "Unclassified/Suspicious Pattern";
  }
}
