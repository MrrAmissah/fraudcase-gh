import { Type } from "@google/genai";

/**
 * Gemini structured-output schema for PASS A (extraction only).
 *
 * Deliberately contains NO risk score, scam category, or guilt determination. Pass A transcribes
 * visible content and lists grounded entities/signals; all scoring happens in pass B over redacted,
 * user-accepted facts. This separation is a core prompt-injection control: an instruction embedded
 * in a screenshot cannot move a score that pass A never computes.
 */
export const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    visibleText: {
      type: Type.STRING,
      description:
        "All text visible in the image or PDF, transcribed verbatim. Do not summarize, translate, or add anything that is not visibly present.",
    },
    languageHint: {
      type: Type.STRING,
      description: "Best-guess language code of the visible text (for example: en). Optional.",
    },
    facts: {
      type: Type.ARRAY,
      description:
        "Entities transcribed VERBATIM from visible content only. Never invent values. Every fact must include an evidenceQuote copied from the visible text.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description:
              "Exactly one of: phone_number, url, amount, transaction_ref, person_name, organization, date, time, otp_request, payment_request",
          },
          rawValue: { type: Type.STRING, description: "The exact visible value, copied verbatim." },
          evidenceQuote: {
            type: Type.STRING,
            description: "A short quote copied verbatim from the visible content that contains rawValue.",
          },
          sourcePage: {
            type: Type.INTEGER,
            description: "1 for a single screenshot; the page number for a PDF.",
          },
          confidence: { type: Type.NUMBER, description: "Transcription confidence from 0 to 1." },
        },
        required: ["type", "rawValue", "evidenceQuote"],
      },
    },
    visualSignals: {
      type: Type.ARRAY,
      description:
        "Possible visual or structural red flags. Descriptive only; never a risk score or a guilt determination.",
      items: {
        type: Type.OBJECT,
        properties: {
          signalType: {
            type: Type.STRING,
            description:
              "Exactly one of: urgency_language, request_for_reversal, possible_brand_impersonation, personal_number_claiming_official_brand, suspicious_link, otp_or_pin_request, document_layout_anomaly, cropped_or_missing_context",
          },
          description: { type: Type.STRING, description: "A short, non-accusatory explanation." },
          severity: { type: Type.STRING, description: "Exactly one of: low, medium, high" },
          evidenceQuote: { type: Type.STRING, description: "A visible quote grounding the signal." },
          sourcePage: { type: Type.INTEGER },
        },
        required: ["signalType", "description", "severity"],
      },
    },
    uncertaintyNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Notes about unreadable, cropped, blurred, or partially visible content.",
    },
  },
  required: ["visibleText", "facts", "visualSignals", "uncertaintyNotes"],
};
