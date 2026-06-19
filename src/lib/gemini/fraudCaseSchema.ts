import { Type } from "@google/genai";

export const fraudCaseSchema = {
  type: Type.OBJECT,
  properties: {
    scamCategory: {
      type: Type.STRING,
      description: "Must be exactly one of: smishing, phishing, impersonation, fake_delivery, payment_dispute, fake_investment, romance_scam, account_takeover, unknown",
    },
    confidence: {
      type: Type.STRING,
      description: "Must be exactly one of: low, medium, high",
    },
    riskScore: {
      type: Type.INTEGER,
      description: "A calculated fraud risk indicator from 0 to 100",
    },
    shortSummary: {
      type: Type.STRING,
      description: "A precise, non-accusatory summary of the suspicious patterns shown in the data",
    },
    suspiciousIndicators: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of key signals or technical details that suggest possible fraud (e.g., shortened link, brand mismatch, coercion)",
    },
    extractedEntities: {
      type: Type.OBJECT,
      properties: {
        phoneNumbers: { type: Type.ARRAY, items: { type: Type.STRING } },
        urls: { type: Type.ARRAY, items: { type: Type.STRING } },
        names: { type: Type.ARRAY, items: { type: Type.STRING } },
        organizations: { type: Type.ARRAY, items: { type: Type.STRING } },
        amounts: { type: Type.ARRAY, items: { type: Type.STRING } },
        dates: { type: Type.ARRAY, items: { type: Type.STRING } },
        transactionReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
        locations: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["phoneNumbers", "urls", "names", "organizations", "amounts", "dates", "transactionReferences", "locations"],
    },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "The timestamp/date of this event if available" },
          event: { type: Type.STRING, description: "Description of the milestone event" },
          source: { type: Type.STRING, description: "The piece of evidence this event relates to" },
        },
        required: ["event"],
      },
    },
    evidenceChecklist: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING, description: "Description of the evidence item needed (e.g. sender ID, payment receipt, full chat export)" },
          status: { type: Type.STRING, description: "Must be exactly one of: present, missing, unclear" },
          note: { type: Type.STRING, description: "Contextual advice about why this evidence is important and how to safe-keep it" },
        },
        required: ["item", "status", "note"],
      },
    },
    recommendedNextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Actionable cyber-hygiene steps for Ghana-based victims (e.g. NCA reporting on 292, block contacts, notify service provider, contact bank/mobile money support)",
    },
    reportSummary: {
      type: Type.STRING,
      description: "A synthesised casework summary of the findings, ready for the dossier",
    },
    disclaimer: {
      type: Type.STRING,
      description: "Standard cybersecurity warning disclaimer strictly clarifying the AI does not declare formal guilt or constitute legal advice",
    },
  },
  required: [
    "scamCategory",
    "confidence",
    "riskScore",
    "shortSummary",
    "suspiciousIndicators",
    "extractedEntities",
    "timeline",
    "evidenceChecklist",
    "recommendedNextSteps",
    "reportSummary",
    "disclaimer"
  ],
};
