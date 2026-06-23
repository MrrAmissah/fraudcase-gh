import { GoogleGenAI } from "@google/genai";
import { fraudCaseSchema } from "./fraudCaseSchema";
import { FRAUD_CASE_PROMPT } from "./fraudCasePrompt";
import { EvidenceItem } from "../../types/evidence";
import { FraudAnalysis } from "../../types/analysis";
import { logEvent, safeErrorType } from "../observability/logger";
import { withTimeout, GeminiTimeoutError } from "./withTimeout";

// Server-side Gemini model id. Centralised so it can be verified/swapped in one place and named in logs.
const GEMINI_MODEL = "gemini-3.5-flash";

// Initialize GoogleGenAI client lazily. IMPORTANT: the key is read at CALL TIME (not at module load)
// so analysis works regardless of when dotenv.config() runs relative to this module being imported.
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!aiClient && apiKey) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Default per-call Gemini timeout (ms). Kept under the public route timeout (20s) so a slow model
// triggers the heuristic fallback BEFORE the route gives up. Override via GEMINI_ANALYSIS_TIMEOUT_MS.
const DEFAULT_GEMINI_TIMEOUT_MS = 15000;
function geminiTimeoutMs(): number {
  const raw = Number(process.env.GEMINI_ANALYSIS_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GEMINI_TIMEOUT_MS;
}

export interface AnalyzeOptions {
  /** Injectable client (tests): `undefined` uses the env client; `null` forces the heuristic. */
  client?: GoogleGenAI | null;
  /** Override the Gemini timeout (ms), mainly for tests. */
  timeoutMs?: number;
}

/**
 * Server-side function to analyze suspicious messages and evidence items.
 */
export async function analyzeFraudCase(
  caseTitle: string,
  caseDescription: string,
  evidenceItems: EvidenceItem[],
  opts: AnalyzeOptions = {}
): Promise<FraudAnalysis> {
  const client = opts.client !== undefined ? opts.client : getAiClient();

  if (!client) {
    logEvent({ event: "gemini_unavailable", level: "warn", meta: { reason: "no_api_key", mode: "heuristic" } });
    return generateHeuristicMockAnalysis(caseTitle, caseDescription, evidenceItems);
  }

  const timeoutMs = opts.timeoutMs ?? geminiTimeoutMs();

  try {
    const evidenceText = evidenceItems
      .map(
        (item) =>
          `- [Type: ${item.type}] Title: "${item.title}"\n  Text payload: "${
            item.redactedText || item.originalText || "(No text captured)"
          }"`
      )
      .join("\n\n");

    const fullPrompt = FRAUD_CASE_PROMPT
      .replace("${caseTitle}", caseTitle)
      .replace("${caseDescription}", caseDescription)
      .replace("${evidenceText}", evidenceText);

    // Call Gemini server-side, bounded by a timeout so a slow model falls back to the heuristic
    // BEFORE the public route timeout fires. A late Gemini resolution is ignored (see withTimeout).
    const response = await withTimeout(
      client.models.generateContent({
        model: GEMINI_MODEL,
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: fraudCaseSchema,
          systemInstruction: "You are a cyber safety inspector. Respond strictly with formatted JSON analytical reports regarding potential digital risks in Ghana without stating guilt or legal outcomes.",
        },
      }),
      timeoutMs,
    );

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response returned from Gemini.");
    }

    const parsed = JSON.parse(textOutput) as FraudAnalysis;
    parsed.analysisProvider = "gemini";
    return parsed;
  } catch (error: unknown) {
    // Never log raw prompts, responses, evidence, or error bodies. Structured, type-only metadata only.
    const timedOut = error instanceof GeminiTimeoutError;
    logEvent({
      event: timedOut ? "gemini_analysis_timeout" : "gemini_analysis_error",
      level: "warn",
      route: "gemini.analyzeFraudCase",
      ...(timedOut ? {} : { errorType: safeErrorType(error) }),
      meta: timedOut
        ? { reason: "gemini_timeout", timeoutMs, mode: "heuristic" }
        : { reason: "gemini_error", mode: "heuristic" },
    });
    return generateHeuristicMockAnalysis(caseTitle, caseDescription, evidenceItems);
  }
}

/**
 * Heuristics-based fallback generator for offline-first operation or missing keys.
 *
 * Grounding rule: entities are extracted ONLY from the supplied evidence text. This function never
 * invents names, domains, phone numbers, organizations, amounts, or locations — when a value is
 * absent from the evidence, its list stays empty. Indicator strings are pattern descriptions and
 * deliberately avoid embedding any specific (fabricated) value.
 *
 * Exported for unit testing of analysis quality.
 */
export function generateHeuristicMockAnalysis(
  title: string,
  description: string,
  evidence: EvidenceItem[]
): FraudAnalysis {
  // Prefer redactedText (uploaded file contents are now stored redacted, not in originalText).
  const combinedText = `${title} ${description} ${evidence.map(e => e.redactedText || e.originalText || "").join(" ")}`.toLowerCase();

  let category: FraudAnalysis["scamCategory"] = "unknown";
  let score = 30;
  let summary = "The evidence has been processed and organized. Suspicious signals were scanned against known fraud patterns.";
  let indicators: string[] = ["The communication arose from an unsolicited channel."];
  let recommendedSteps: string[] = [
    "Securely preserve the physical evidence. Take screenshots of original notifications with sender metadata visibly included.",
    "Do not distribute financial detail (such as credit card PINs, CVV, or Mobile Money PINs).",
    "Report the suspicious signals to relevant platforms."
  ];

  if (combinedText.includes("post") || combinedText.includes("delivery") || combinedText.includes("parcel") || combinedText.includes("sorting")) {
    category = "fake_delivery";
    score = 85;
    summary = "Attributes heavily align with unauthorized postal/courier impersonation scams. These exploit urgency by claiming a low-value parcel is pending custom fee clearances.";
    indicators = [
      "Unexpected delivery/courier SMS from a masked sender ID impersonating a postal brand.",
      "Requests a small upfront 'clearance' or 're-delivery' fee through a web link to release a parcel.",
      "Payment link relies on an unofficial domain with no operational relationship to a legitimate local courier."
    ];
    recommendedSteps = [
      "DO NOT fill custom address grids or MoMo credentials on web references linked in standard text messages.",
      "Call Ghana Post officially via their certified national customer lines directly to query parcel code matches.",
      "Dial NCA Cybersecurity Incident reporting shortcode 292 to report the domain/Sender URL.",
      "If wallet inputs were submitted, initiate a PIN rotation immediately and alert your Mobile Money provider (MTN, Telecel, AT)."
    ];
  } else if (combinedText.includes("whatsapp") || combinedText.includes("freelance") || combinedText.includes("like") || combinedText.includes("job") || combinedText.includes("commission") || combinedText.includes("deposit")) {
    category = "fake_investment";
    score = 75;
    summary = "Patterns match online high-yield task recruitment fraud where victims are enticed to like social feeds for GHS commissions, but must submit deposits first.";
    indicators = [
      "Unsolicited job/task offer via WhatsApp/Telegram without any formal interview or background check.",
      "Demands an upfront registration or 'level-up' deposit in exchange for promised task payouts.",
      "Directs to an unofficial domain to display fabricated employee or earnings statistics."
    ];
    recommendedSteps = [
      "Do not send money or deposits in order to receive job compensation. This is a primary hallmark of structural advance-fee fraud.",
      "Leave the WhatsApp recruitment group immediate and report the admin users inside the app.",
      "Block the incoming number from your terminal."
    ];
  } else if (combinedText.includes("momo") || combinedText.includes("reversal") || combinedText.includes("agent") || combinedText.includes("sent to your number") || combinedText.includes("wrong transaction")) {
    category = "payment_dispute";
    score = 80;
    summary = "High similarity to Mobile Money refund tricks ('wrong transaction error') where fraudsters contact individuals falsely claiming a cash transfer error.";
    indicators = [
      "Urgent calling or messaging claiming a mistaken MoMo transfer was pushed to your number.",
      "Instructions to run specific USSD codes or return funds immediately to a distinct phone number.",
      "Absent corresponding official credit notification in your operator sms history."
    ];
    recommendedSteps = [
      "Do NOT dial USSD sequences or direct cash transfers back to private lines based solely on a caller's claim.",
      "Check your transaction history or contact your network operator's help center (e.g., MTN 100) to confirm if a deposit truly occurred.",
      "Let the caller know they must officially report details to the operator to request manual dispute reversals."
    ];
  } else if (combinedText.includes("link") || combinedText.includes("verification") || combinedText.includes("account") || combinedText.includes("suspend") || combinedText.includes("login")) {
    category = "phishing";
    score = 70;
    summary = "Matches technical credentials phishing layout, requesting fast verification to secure a supposedly frozen profile.";
    indicators = [
      "Arbitrary warnings of account suspension designed to manipulate customer reactions.",
      "Destination addresses lacking valid TLS certificate domains of original companies."
    ];
  }

  // Extract entities ONLY from the supplied evidence text (title + description + each evidence
  // item), reading the same redacted-first text the categorizer uses. Nothing is invented: absent
  // values simply stay empty. No category-based fillers, placeholder numbers, or default domains.
  const uniq = (arr: string[]) => Array.from(new Set(arr));
  const corpus = [
    title,
    description,
    ...evidence.map(e => e.redactedText || e.originalText || ""),
  ].join("\n");

  const phoneNumbers = uniq(corpus.match(/0[235]\d{8}/g) || []);
  const urls = uniq((corpus.match(/https?:\/\/[^\s]+/g) || []).map(u => u.replace(/[",.)]+$/g, "")));
  const amounts = uniq(corpus.match(/GHS\s*\d+(?:\.\d{2})?/gi) || []);

  // Names, organizations, and locations are left empty: the heuristic cannot reliably extract them
  // from free text, and guessing would fabricate entities. Gemini (when available) fills these in.
  const organizations: string[] = [];
  const transactionReferences: string[] = [];

  // Map to checklist
  const timeline = [
    {
      date: new Date().toISOString().split("T")[0],
      event: "Identification and capture of potential threat vectors.",
      source: "Incident Description Intake"
    }
  ];

  evidence.forEach((ev) => {
    timeline.push({
      date: ev.createdAt.split("T")[0],
      event: `Registered evidence segment: ${ev.title}`,
      source: ev.type
    });
  });

  const evidenceChecklist: FraudAnalysis["evidenceChecklist"] = [
    {
      item: "original SMS/message captured",
      status: evidence.some(e => e.type === "sms" || e.type === "whatsapp") ? "present" : "missing",
      note: "Verifies original digital dispatch of the scam script."
    },
    {
      item: "sender ID or phone number captured",
      status: phoneNumbers.length > 0 || evidence.some(e => e.type === "sms") ? "present" : "missing",
      note: "Key to identify spoofed labels on mobile phone networks."
    },
    {
      item: "destination URL captured",
      status: urls.length > 0 || evidence.some(e => e.type === "url") ? "present" : "unclear",
      note: "Required to trace command domain networks hosting malicious forms."
    },
    {
      item: "payment receipt added if payment occurred",
      status: evidence.some(e => e.type === "receipt") ? "present" : (amounts.length > 0 ? "missing" : "unclear"),
      note: "Needed to request operator reversals for MoMo transactions."
    },
    {
      item: "transaction reference added if payment occurred",
      status: transactionReferences.length > 0 ? "present" : (evidence.some(e => e.type === "receipt") ? "missing" : "unclear"),
      note: "Critical index to locate the specific ledger entries with network providers."
    },
    {
      item: "screenshot evidence added",
      status: evidence.some(e => e.type === "screenshot") ? "present" : "missing",
      note: "Visual backups document site designs before domains are torn down."
    },
    {
      item: "user notes added",
      status: description.trim().length > 15 ? "present" : "missing",
      note: "Incident logs build context around social engineering methods."
    }
  ];

  return {
    analysisProvider: "heuristic",
    scamCategory: category,
    confidence: score > 50 ? "high" : "medium",
    riskScore: score,
    shortSummary: summary,
    suspiciousIndicators: indicators,
    extractedEntities: {
      phoneNumbers,
      urls,
      names: [],
      organizations,
      amounts,
      // Evidence-derived capture timestamps only — never a synthesized "today".
      dates: uniq(evidence.map(e => e.createdAt.split("T")[0])),
      transactionReferences,
      locations: []
    },
    timeline,
    evidenceChecklist,
    recommendedNextSteps: recommendedSteps,
    reportSummary: `Review of possible risks and extracted parameters. Found ${indicators.length} primary threat signatures matching categorical templates. Final report structures findings in a forensics-grade format suitable for further analysis.`,
    disclaimer: "Disclaimer: This review is synthesized programmatically for evidence cataloging and risk recognition. It does not certify legal culpability, criminal guilt, or represent an official statement of the state of Ghana or local law enforcement."
  };
}
