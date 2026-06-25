/**
 * Pass A multimodal extraction service (Gemini), gated by MULTIMODAL_EXTRACTION_ENABLED.
 *
 * Returns a RawExtraction held in REQUEST MEMORY ONLY. It never persists, and it never logs the
 * image bytes, the prompt, the model response, or any transcribed text. On any failure it returns
 * a discrete outcome so the caller can still write an audit ExtractionRun (status only, no content).
 */
import { GoogleGenAI } from "@google/genai";
import { extractionSchema } from "./extractionSchema";
import { EXTRACTION_SYSTEM_INSTRUCTION, buildExtractionPrompt } from "./extractionPrompt";
import { withTimeout, GeminiTimeoutError } from "../gemini/withTimeout";
import { resolveGeminiModel } from "../config/runtimeConfig";
import { logEvent, safeErrorType } from "../observability/logger";
import {
  type ExtractedFactType,
  type RawExtractedFact,
  type RawExtraction,
  type VisualSignal,
  type VisualSignalType,
} from "./types";

const DEFAULT_EXTRACTION_TIMEOUT_MS = 30000;

/** Model id used for extraction; overridable via GEMINI_MODEL, with a stable default. Read at call time. */
export function extractionModelId(): string {
  return resolveGeminiModel();
}

function extractionTimeoutMs(): number {
  const raw = Number(process.env.MULTIMODAL_EXTRACTION_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EXTRACTION_TIMEOUT_MS;
}

/** Default OFF: only the literal string "true" enables multimodal extraction (mirrors APP_CHECK_ENFORCE). */
export function isMultimodalExtractionEnabled(): boolean {
  return process.env.MULTIMODAL_EXTRACTION_ENABLED === "true";
}

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!aiClient && apiKey) {
    aiClient = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
  }
  return aiClient;
}

const FACT_TYPES: ReadonlySet<string> = new Set<ExtractedFactType>([
  "phone_number", "url", "amount", "transaction_ref", "person_name",
  "organization", "date", "time", "otp_request", "payment_request",
]);
const SIGNAL_TYPES: ReadonlySet<string> = new Set<VisualSignalType>([
  "urgency_language", "request_for_reversal", "possible_brand_impersonation",
  "personal_number_claiming_official_brand", "suspicious_link", "otp_or_pin_request",
  "document_layout_anomaly", "cropped_or_missing_context",
]);
const SEVERITIES: ReadonlySet<string> = new Set(["low", "medium", "high"]);

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function sanitizeFacts(value: unknown): RawExtractedFact[] {
  if (!Array.isArray(value)) return [];
  const out: RawExtractedFact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const type = asString(f.type);
    const rawValue = asString(f.rawValue);
    const evidenceQuote = asString(f.evidenceQuote);
    if (!FACT_TYPES.has(type) || !rawValue || !evidenceQuote) continue;
    const sourcePage = typeof f.sourcePage === "number" ? f.sourcePage : undefined;
    const confidence = typeof f.confidence === "number" ? f.confidence : undefined;
    out.push({ type: type as ExtractedFactType, rawValue, evidenceQuote, sourcePage, confidence });
  }
  return out;
}

function sanitizeSignals(value: unknown): VisualSignal[] {
  if (!Array.isArray(value)) return [];
  const out: VisualSignal[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const signalType = asString(s.signalType);
    const description = asString(s.description);
    const severity = asString(s.severity);
    if (!SIGNAL_TYPES.has(signalType) || !description || !SEVERITIES.has(severity)) continue;
    out.push({
      signalType: signalType as VisualSignalType,
      description,
      severity: severity as VisualSignal["severity"],
      evidenceQuote: asString(s.evidenceQuote) || undefined,
      sourcePage: typeof s.sourcePage === "number" ? s.sourcePage : undefined,
    });
  }
  return out;
}

function sanitizeNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 30);
}

export interface ExtractInput {
  buffer: Buffer;
  mimeType: string;
  kind: "image" | "pdf";
}

export interface ExtractOptions {
  /** Injectable client (tests): `undefined` uses the env client; `null` forces the no-op path. */
  client?: GoogleGenAI | null;
  timeoutMs?: number;
}

export interface ExtractionOutcome {
  raw: RawExtraction;
  status: "succeeded" | "failed" | "timeout" | "skipped";
  errorType?: string;
}

function emptyRaw(): RawExtraction {
  return { provider: "none", rawVisibleText: "", facts: [], visualSignals: [], uncertaintyNotes: [] };
}

/**
 * Run pass A extraction. Caller is responsible for the env-flag gate, owner check, and consent gate;
 * this function performs the model call only and returns memory-only raw output.
 */
export async function extractVisualEvidence(
  input: ExtractInput,
  opts: ExtractOptions = {},
): Promise<ExtractionOutcome> {
  const provider = input.kind === "pdf" ? "gemini_inline_pdf" : "gemini_inline_image";
  const client = opts.client !== undefined ? opts.client : getAiClient();

  if (!client) {
    // No model configured: a calm no-op (mirrors the analysis heuristic fallback).
    logEvent({ event: "multimodal_extract_skipped", level: "warn", meta: { reason: "no_api_key" } });
    return { raw: emptyRaw(), status: "skipped" };
  }

  const timeoutMs = opts.timeoutMs ?? extractionTimeoutMs();
  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: extractionModelId(),
        contents: [
          { inlineData: { mimeType: input.mimeType, data: input.buffer.toString("base64") } },
          buildExtractionPrompt(input.kind),
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: extractionSchema,
          systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
        },
      }),
      timeoutMs,
    );

    const text = (response as { text?: string }).text;
    if (!text) throw new Error("Empty response returned from Gemini extraction.");
    const parsed = JSON.parse(text) as Record<string, unknown>;

    const raw: RawExtraction = {
      provider,
      rawVisibleText: asString(parsed.visibleText),
      languageHint: asString(parsed.languageHint) || undefined,
      facts: sanitizeFacts(parsed.facts),
      visualSignals: sanitizeSignals(parsed.visualSignals),
      uncertaintyNotes: sanitizeNotes(parsed.uncertaintyNotes),
    };
    // Counts only; never the transcribed content.
    logEvent({
      event: "multimodal_extract_ok",
      meta: { provider, factCount: raw.facts.length, signalCount: raw.visualSignals.length },
    });
    return { raw, status: "succeeded" };
  } catch (error: unknown) {
    const timedOut = error instanceof GeminiTimeoutError;
    logEvent({
      event: timedOut ? "multimodal_extract_timeout" : "multimodal_extract_error",
      level: "warn",
      route: "extraction.extractVisualEvidence",
      ...(timedOut ? {} : { errorType: safeErrorType(error) }),
      meta: { provider, reason: timedOut ? "timeout" : "error" },
    });
    return { raw: emptyRaw(), status: timedOut ? "timeout" : "failed", errorType: timedOut ? undefined : safeErrorType(error) };
  }
}
