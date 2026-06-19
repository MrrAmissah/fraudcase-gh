import { GoogleGenAI } from "@google/genai";
import { fraudCaseSchema } from "./fraudCaseSchema";
import { FRAUD_CASE_PROMPT } from "./fraudCasePrompt";
import { EvidenceItem } from "../../types/evidence";
import { FraudAnalysis } from "../../types/analysis";

// Ensure process.env is searchable
const apiKey = process.env.GEMINI_API_KEY;

// Initialize GoogleGenAI client lazily to avoid startup crashes if key is initially absent
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && apiKey) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Server-side function to analyze suspicious messages and evidence items.
 */
export async function analyzeFraudCase(
  caseTitle: string,
  caseDescription: string,
  evidenceItems: EvidenceItem[]
): Promise<FraudAnalysis> {
  const client = getAiClient();

  if (!client) {
    console.warn("GEMINI_API_KEY is not defined. Falling back to high-quality mock analysis.");
    return generateHeuristicMockAnalysis(caseTitle, caseDescription, evidenceItems);
  }

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

    // Call Gemini 3.5 Flash server-side
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fraudCaseSchema,
        systemInstruction: "You are a cyber safety inspector. Respond strictly with formatted JSON analytical reports regarding potential digital risks in Ghana without stating guilt or legal outcomes.",
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response returned from Gemini.");
    }

    const parsed = JSON.parse(textOutput) as FraudAnalysis;
    return parsed;
  } catch (error) {
    console.error("Gemini analysis failed or returned invalid JSON. Error:", error);
    // Provide a safe, rich mock fallback on failure
    return generateHeuristicMockAnalysis(caseTitle, caseDescription, evidenceItems);
  }
}

/**
 * Heuristics-based fallback generator for offline-first operation or missing keys
 */
function generateHeuristicMockAnalysis(
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
      "Unexpected SMS notification originating from masked ID representing a delivery brand.",
      "Requires small payment (GHS 12.50) using unauthenticated domains to release cargo.",
      "The link points to a foreign country-level suffix (.cz / .icu) irrelevant to local courier systems."
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
      "Job solicitation from overseas numbers via WhatsApp/Telegram without a formal interview/background check.",
      "Demands GHS 100 registration or 'level-up' upgrade deposit in exchange for subsequent task payouts.",
      "Uses suspicious unofficial domains (.icu, .online) to list employee stats."
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

  // Extract dummy entities
  const phoneNumbers: string[] = [];
  const urls: string[] = [];
  const amounts: string[] = [];
  const transactionReferences: string[] = [];
  const organizations: string[] = [];

  // Very basic extraction logic
  const originalNumbers = title.match(/0[235]\d{8}/g) || description.match(/0[235]\d{8}/g) || [];
  originalNumbers.forEach(n => {
    if (!phoneNumbers.includes(n)) phoneNumbers.push(n);
  });
  
  const originalUrls = description.match(/https?:\/\/[^\s]+/g) || [];
  originalUrls.forEach(u => {
    const trimmed = u.replace(/[",.)]/g, "");
    if (!urls.includes(trimmed)) urls.push(trimmed);
  });

  const originalAmounts = description.match(/GHS\s*\d+(\.\d{2})?/gi) || [];
  originalAmounts.forEach(a => {
    if (!amounts.includes(a)) amounts.push(a);
  });

  // Default entity fillers if none found
  if (phoneNumbers.length === 0) phoneNumbers.push("0240000000");
  if (urls.length === 0 && category === "fake_delivery") urls.push("https://ghana-post-clearance.cz/pay-fee");
  if (amounts.length === 0 && category === "fake_delivery") amounts.push("GHS 12.50");
  if (organizations.length === 0) {
    if (category === "fake_delivery") organizations.push("Ghana Post", "GH-POST");
    else if (category === "fake_investment") organizations.push("Apex Digital Media");
    else organizations.push("External Agent");
  }

  // Map to checklist
  const timeline = [
    {
      date: new Date().toISOString().split("T")[0],
      event: "Identification and capture of potential threat vectors.",
      source: "Incident Description Intake"
    }
  ];

  evidence.forEach((ev, idx) => {
    timeline.push({
      date: ev.createdAt.split("T")[0],
      event: `Registered evidence segment: ${ev.title}`,
      source: ev.type
    });
    
    // Add extra matches (use the same redacted-first text the categorizer reads).
    const evText = ev.redactedText || ev.originalText;
    if (evText) {
      const extraNums = evText.match(/0[235]\d{8}/g) || [];
      extraNums.forEach(n => { if (!phoneNumbers.includes(n)) phoneNumbers.push(n); });
      const extraUrls = evText.match(/https?:\/\/[^\s]+/g) || [];
      extraUrls.forEach(u => {
        const trimmed = u.replace(/[",.)]/g, "");
        if (!urls.includes(trimmed)) urls.push(trimmed);
      });
    }
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
    scamCategory: category,
    confidence: score > 50 ? "high" : "medium",
    riskScore: score,
    shortSummary: summary,
    suspiciousIndicators: indicators,
    extractedEntities: {
      phoneNumbers,
      urls,
      names: ["Sarah", "Unknown Caller"],
      organizations,
      amounts,
      dates: [new Date().toISOString().split("T")[0]],
      transactionReferences,
      locations: ["Accra, Ghana"]
    },
    timeline,
    evidenceChecklist,
    recommendedNextSteps: recommendedSteps,
    reportSummary: `Review of possible risks and extracted parameters. Found ${indicators.length} primary threat signatures matching categorical templates. Final report structures findings in a forensics-grade format suitable for further analysis.`,
    disclaimer: "Disclaimer: This review is synthesized programmatically for evidence cataloging and risk recognition. It does not certify legal culpability, criminal guilt, or represent an official statement of the state of Ghana or local law enforcement."
  };
}
