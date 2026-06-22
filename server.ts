import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { MOCK_CASES } from "./src/lib/mock/mockCases";
import { FraudCase } from "./src/types/fraudCase";
import { EvidenceItem } from "./src/types/evidence";
import { ExtractedEntities } from "./src/types/analysis";
import { QuickCheckResult } from "./src/types/quickCheck";
import { analyzeFraudCase } from "./src/lib/gemini/analyzeFraudCase";
import { adminDb, adminAuth, adminStorage } from "./src/lib/firebase/admin";
import { redactPIIAndSecrets } from "./src/lib/security/redaction";
import { validateUploadedFile } from "./src/lib/security/fileValidation";
import { logEvent, logRouteError, safeErrorType } from "./src/lib/observability/logger";
import { createAppCheckMiddleware } from "./src/lib/security/appCheck";
import { getRateLimitStore, makeDailyRateLimit, makeBurstRateLimit } from "./src/lib/security/rateLimit";
import {
  isCaseOwner,
  buildCaseUpdatePayload,
  resolveOwnerIdFromToken,
} from "./src/lib/security/ownerIsolation";
import multer from "multer";
import fs from "fs";

// Initialize environment variables
dotenv.config();

// Port & Host binding required by the AI Studio reverse-proxy environment
const PORT = 3000;
const HOST = "0.0.0.0";

// --- Public Quick Check (no-auth) abuse control + helpers ---
const QC_DAILY_LIMIT = 15; // anonymous analyze scans per IP per day
const SIGNAL_DAILY_LIMIT = 10; // anonymous community-signal submissions per IP per day
const QC_MAX_INPUT_CHARS = 5000; // public input length cap
const PUBLIC_JSON_MAX_BYTES = 1 * 1024 * 1024; // 1MB cap for public text endpoints (analyze, submit-signal)

// Public-route rate limiting (getClientIp, daily + burst limiters, and the shared-store seam)
// now lives in src/lib/security/rateLimit.ts. Behavior is preserved exactly; a Redis-backed shared
// store can be added via RATE_LIMIT_REDIS_URL later (see docs/SHARED_RATE_LIMIT_PLAN.md).

const rateLimitStore = getRateLimitStore();

const quickCheckRateLimit = makeDailyRateLimit(
  "qc_analyze",
  QC_DAILY_LIMIT,
  "You've reached today's free Quick Check limit. Create a free account to keep checking evidence.",
  rateLimitStore,
);
const submitSignalRateLimit = makeDailyRateLimit(
  "signal",
  SIGNAL_DAILY_LIMIT,
  "You've reached today's limit for sharing community signals. Please try again tomorrow.",
  rateLimitStore,
);

// Short-window burst caps (per client): analyze 5 / 5 min, file 3 / 5 min, signal 5 / 10 min.
const quickCheckBurstLimit = makeBurstRateLimit(
  "qc_analyze_burst",
  5,
  5 * 60 * 1000,
  "You're checking a little too fast. Please wait a moment and try again.",
  rateLimitStore,
);
const uploadBurstLimit = makeBurstRateLimit(
  "qc_file_burst",
  3,
  5 * 60 * 1000,
  "Too many file checks in a short time. Please wait a few minutes and try again.",
  rateLimitStore,
);
const signalBurstLimit = makeBurstRateLimit(
  "signal_burst",
  5,
  10 * 60 * 1000,
  "Too many signal submissions in a short time. Please wait a few minutes and try again.",
  rateLimitStore,
);

// App Check verification for public abuse-prone routes. DEFAULT-OFF: passes through
// unless APP_CHECK_ENFORCE=true. Enable only after the client attaches App Check tokens
// (see docs/APP_CHECK_IMPLEMENTATION_PLAN.md). Applied before rate limiters on public routes.
const verifyAppCheck = createAppCheckMiddleware();

// Conservative entity extraction from REDACTED text only. Unlike the heuristic analyzer's
// demo fillers, this never fabricates names/phones — it surfaces only what is genuinely
// present (URLs, monetary amounts, and phone tokens already masked by the redaction guard).
function quickCheckEntities(redactedText: string): ExtractedEntities {
  const urls = Array.from(
    new Set((redactedText.match(/https?:\/\/[^\s]+/gi) || []).map((u) => u.replace(/[).,"']+$/g, "")))
  );
  const amounts = Array.from(
    new Set(redactedText.match(/(?:GH[S₵]|₵|GHS)\s?\d[\d,]*(?:\.\d{1,2})?/gi) || [])
  );
  const phoneNumbers = Array.from(new Set(redactedText.match(/\d{2,4}\*{2,}\d{2,4}/g) || []));
  return {
    phoneNumbers,
    urls,
    names: [],
    organizations: [],
    amounts,
    dates: [],
    transactionReferences: [],
    locations: [],
  };
}

const QUICK_CHECK_DISCLAIMER =
  "This quick result is AI-assisted and may be incomplete. It does not determine guilt, provide legal advice, or replace official investigation.";

// Shown when a user uploads an image/PDF to public Quick Check. There is no OCR/text extraction in
// the public flow, so we guide the user rather than pretend deep document analysis exists.
const PUBLIC_UPLOAD_TEXT_GUIDANCE =
  "For best results, paste the visible message text. Full screenshot/document evidence can be saved inside a private case.";

// Shared Quick Check pipeline used by BOTH the paste and file-upload endpoints so the
// redaction/analysis logic lives in exactly one place. It redacts first, analyzes the REDACTED
// text only, and returns an EPHEMERAL result — it writes nothing to Firestore, Storage, or disk.
async function buildQuickCheckResult(rawText: string): Promise<QuickCheckResult> {
  const input = rawText.slice(0, QC_MAX_INPUT_CHARS);

  // 1. Redact BEFORE analysis — raw text is never sent to the AI and never stored.
  const redaction = redactPIIAndSecrets(input);

  // 2. Analyze the redacted text only (server-side Gemini; heuristic fallback if no key).
  const analysis = await analyzeFraudCase("Quick Check submission", redaction.redactedText, []);

  // 3. Build an ephemeral result. Nothing is written to Firestore/Storage/disk.
  return {
    quickCheckId: `qc-${Date.now()}`,
    redactedText: redaction.redactedText,
    scamCategory: analysis.scamCategory,
    riskScore: analysis.riskScore,
    confidence: analysis.confidence,
    shortSummary: analysis.shortSummary,
    possibleFraudIndicators: analysis.suspiciousIndicators || [],
    extractedEntities: quickCheckEntities(redaction.redactedText),
    redactionWarnings: redaction.redactionWarnings || [],
    recommendedNextSteps: analysis.recommendedNextSteps || [],
    saveAsCaseAvailable: true,
    shareRedactedSignalAvailable: false,
    disclaimer: QUICK_CHECK_DISCLAIMER,
  };
}

// --- Admin access control (Phase 4) ---
// Comma-separated allowlist. Fail-closed: empty/unset means no admins (everyone denied).
function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}
const HIGH_RISK_THRESHOLD = 50; // aligns with getRiskLevel "High" boundary (>= 50)
const ADMIN_REVIEW_STATUSES = ["pending", "reviewed", "false_positive", "useful"];

// --- Community signal helpers (Phase 3): derive safe, masked metadata server-side ---
function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/i);
  return m ? m[0].replace(/[).,"']+$/g, "") : null;
}

function normalizeDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function cappedStringArray(value: any, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === "string")
    .slice(0, maxItems)
    .map((v) => v.slice(0, maxLen));
}

// Re-derive a safe entities object for an anonymous signal. Drops any phone token that is not
// masked, and never stores names or transaction references.
function safeSignalEntities(entities: any): ExtractedEntities {
  const e = entities && typeof entities === "object" ? entities : {};
  return {
    phoneNumbers: cappedStringArray(e.phoneNumbers, 10, 40).filter((p) => p.includes("*")),
    urls: cappedStringArray(e.urls, 20, 300),
    names: [],
    organizations: cappedStringArray(e.organizations, 20, 120),
    amounts: cappedStringArray(e.amounts, 20, 40),
    dates: cappedStringArray(e.dates, 20, 40),
    transactionReferences: [],
    locations: cappedStringArray(e.locations, 20, 120),
  };
}

async function startServer() {
  const app = express();
  
  // Reject oversized PUBLIC Quick Check text requests EARLY (before body parsing) via the declared
  // Content-Length. Those endpoints only need a few KB; the 15mb limit below still covers the
  // authenticated routes. Returns a calm JSON error, never a stack trace.
  const PUBLIC_TEXT_PATHS = new Set(["/api/quick-check/analyze", "/api/quick-check/submit-signal"]);
  app.use((req: any, res: any, next: any) => {
    if (req.method === "POST" && PUBLIC_TEXT_PATHS.has(req.path)) {
      const declared = Number(req.headers["content-length"] || 0);
      if (declared > PUBLIC_JSON_MAX_BYTES) {
        res.status(413).json({ error: "Request too large. Paste the message text instead of a large payload." });
        return;
      }
    }
    next();
  });

  // Parse incoming JSON requests up to 15mb (authenticated routes). Public text routes are also
  // capped at PUBLIC_JSON_MAX_BYTES by the guard above.
  app.use(express.json({ limit: "15mb" }));

  // Calm JSON errors for body-parser failures (oversized or malformed JSON) instead of stack traces.
  app.use((err: any, _req: any, res: any, next: any) => {
    if (!err) return next();
    if (err.type === "entity.too.large") {
      res.status(413).json({ error: "Request too large." });
      return;
    }
    if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
    res.status(400).json({ error: "Request could not be processed." });
  });

  // Configure multer for secure memory storage. Files are held in memory only for
  // processing (redaction + validation) and streamed to Cloud Storage — no permanent
  // temp file is written on the happy path. See the upload route for the dev-only fallback.
  const MAX_FILE_BYTES = 10 * 1024 * 1024; // Strict 10MB cap
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_BYTES,
    },
  });

  // Max characters of extracted text persisted per readable evidence item. Keeps a single
  // evidence entry well under Firestore's 1 MiB per-document limit.
  const MAX_EXTRACT_CHARS = 20000;

  // Wrap multer so its errors (e.g. oversized file) return a clean 400 instead of
  // falling through to the generic error handler as a 500.
  function uploadSingle(req: any, res: any, next: any) {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: "File exceeds the 10MB maximum upload size." });
            return;
          }
          res.status(400).json({ error: `Upload rejected: ${err.message}` });
          return;
        }
        res.status(400).json({ error: "Upload could not be processed." });
        return;
      }
      next();
    });
  }

  // Public Quick Check uploads use a STRICTER 5MB cap (vs 10MB for authenticated case evidence)
  // and a single file. Bytes are held in memory only and processed ephemerally — never stored.
  const MAX_PUBLIC_FILE_BYTES = 5 * 1024 * 1024; // 5MB public cap
  const publicUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PUBLIC_FILE_BYTES, files: 1 },
  });

  function publicUploadSingle(req: any, res: any, next: any) {
    publicUpload.single("file")(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({
              error: "File exceeds the 5MB limit for Quick Check uploads. For larger evidence, save it inside a private case.",
            });
            return;
          }
          res.status(400).json({ error: `Upload rejected: ${err.message}` });
          return;
        }
        res.status(400).json({ error: "Upload could not be processed." });
        return;
      }
      next();
    });
  }

  function sanitizeFilename(name: string): string {
    const base = path.basename(name);
    const ext = path.extname(base);
    const stem = path.basename(base, ext);
    
    // Replace non-alphanumeric character patterns to avoid arbitrary directories / path traversals
    const cleanStem = stem.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 80);
    const cleanExt = ext.replace(/[^.a-zA-Z0-9]/g, "").toLowerCase();
    
    return (cleanStem || "evidence") + cleanExt;
  }

  // --- AUTHORIZATION MIDDLEWARE ---
  // Authenticates the client utilizing Firebase ID Tokens
  async function requireAuth(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
      return;
    }

    const token = authHeader.substring(7);
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
      next();
    } catch (err: any) {
      logEvent({ event: "token_verify_failed", level: "error", errorType: safeErrorType(err) });
      res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
  }

  // Admin guard: verify the Firebase ID token AND require the email to be allowlisted.
  // 401 when unauthenticated/invalid token; 403 when authenticated but not an admin.
  async function requireAdmin(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
      return;
    }

    const token = authHeader.substring(7);
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const email = (decodedToken.email || "").toLowerCase();
      if (!email || !getAdminEmails().has(email)) {
        res.status(403).json({ error: "Forbidden: Admin access required." });
        return;
      }
      req.user = { uid: decodedToken.uid, email: decodedToken.email };
      next();
    } catch (err: any) {
      logEvent({ event: "admin_token_verify_failed", level: "error", errorType: safeErrorType(err) });
      res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
  }

  // --- API ROUTES ---

  // Liveness/health check for deploy platforms and uptime monitors. Public, no auth.
  // Returns only safe, non-sensitive fields: never env values, versions, secrets, or paths.
  app.get("/api/health", (_req: any, res: any) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // Get all cases owned by the authenticated user
  app.get("/api/cases", requireAuth, async (req: any, res: any) => {
    try {
      const snapshot = await adminDb.collection("cases")
        .where("ownerId", "==", req.user.uid)
        .get();

      const cases: FraudCase[] = [];
      snapshot.forEach((doc) => {
        cases.push({ id: doc.id, ...doc.data() } as FraudCase);
      });

      // Sort cases in-memory to prevent requiring composite index creation in Firestore
      cases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(cases);
    } catch (err: any) {
      logRouteError("fetch_cases", "/api/cases", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get specific case details (verifying owner access)
  app.get("/api/cases/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const doc = await adminDb.collection("cases").doc(id).get();
      
      if (!doc.exists) {
        res.status(404).json({ error: "Fraud case not found" });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to this case resource." });
        return;
      }

      res.json({ id: doc.id, ...caseData });
    } catch (err: any) {
      logRouteError("fetch_case", "/api/cases/:id", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get specific case report details (identical to specific details route but semantic)
  app.get("/api/cases/:id/report", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const doc = await adminDb.collection("cases").doc(id).get();
      
      if (!doc.exists) {
        res.status(404).json({ error: "Fraud case not found" });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to this case report." });
        return;
      }

      res.json({ id: doc.id, ...caseData });
    } catch (err: any) {
      logRouteError("fetch_case_report", "/api/cases/:id/report", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new fraud case
  app.post("/api/cases", requireAuth, async (req: any, res: any) => {
    try {
      const { title, description, incidentDate } = req.body;
      if (!title || !description) {
        res.status(400).json({ error: "Title and description are required parameters." });
        return;
      }

      const caseId = `case-${Date.now()}`;
      const newCase: FraudCase & { ownerId: string } = {
        id: caseId,
        ownerId: resolveOwnerIdFromToken(req.user.uid),
        title,
        description,
        status: "draft",
        incidentDate: incidentDate || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        evidenceItems: [],
      };

      await adminDb.collection("cases").doc(caseId).set(newCase);
      res.status(201).json(newCase);
    } catch (err: any) {
      logRouteError("create_case", "/api/cases", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Add an evidence item to a case (verifying ownership and applying automatic backend redaction)
  app.post("/api/cases/:id/evidence", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { type, title, originalText, fileName, fileUrl } = req.body;

      if (!type || !title) {
        res.status(400).json({ error: "Evidence type and title are required fields." });
        return;
      }

      const docRef = adminDb.collection("cases").doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        res.status(404).json({ error: "Fraud case target not found." });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to this case resource." });
        return;
      }

      // Automatically apply safety redaction layer on the backend as well
      const redaction = redactPIIAndSecrets(originalText || "");

      const newEvidence: EvidenceItem = {
        id: `ev-${Date.now()}`,
        ownerId: resolveOwnerIdFromToken(req.user.uid),
        caseId: id,
        type,
        title,
        originalText: originalText || undefined,
        redactedText: redaction.redactedText || undefined,
        redactionWarnings: redaction.redactionWarnings || [],
        detectedSensitiveTypes: redaction.detectedSensitiveTypes || [],
        fileName: fileName || undefined,
        fileUrl: fileUrl || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const originalItems = caseData.evidenceItems || [];
      const updatedEvidenceItems = [...originalItems, newEvidence];

      const updates: any = {
        evidenceItems: updatedEvidenceItems,
        updatedAt: new Date().toISOString(),
      };

      if (caseData.status === "analyzed") {
        updates.status = "draft";
      }

      await docRef.update(updates);
      res.status(201).json({ id, ...caseData, ...updates });
    } catch (err: any) {
      logRouteError("add_evidence", "/api/cases/:id/evidence", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Add a file evidence item to a case. Validates content signatures, redacts readable
  // file contents from the raw bytes, and stores honestly in Cloud Storage (dev-only local fallback).
  app.post("/api/cases/:id/evidence/upload", requireAuth, uploadSingle, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { type, title, originalText } = req.body;

      if (!req.file) {
        res.status(400).json({ error: "No file was uploaded." });
        return;
      }

      if (!type || !title) {
        res.status(400).json({ error: "Evidence type and title are required fields." });
        return;
      }

      // Backend security: validate extension, declared MIME, AND real content signature.
      // Rejects files renamed/disguised to slip past the browser-side allowlist.
      const validation = validateUploadedFile(req.file.originalname, req.file.mimetype, req.file.buffer);
      if (!validation.ok) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const docRef = adminDb.collection("cases").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Fraud case target not found." });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to this case resource." });
        return;
      }

      const evidenceId = `ev-${Date.now()}`;

      // Sanitize the filename to prevent path traversal or arbitrary writes
      const safeName = sanitizeFilename(req.file.originalname);

      // Isolated logical path: users/{uid}/cases/{caseId}/evidence/{evidenceId}/{safeName}
      const storagePath = `users/${req.user.uid}/cases/${id}/evidence/${evidenceId}/${safeName}`;

      // --- Redaction: sanitize readable file contents from the raw bytes ---
      // We read and redact the bytes server-side rather than trusting client-sent text,
      // so raw PII in TXT/CSV/JSON/HTML never reaches Firestore, AI, or storage metadata.
      // `redactedText` and `extractedText` are the SAME sanitized string so the
      // EvidenceCard preview and the AI input can never diverge.
      const isReadable = validation.isReadableText;
      let safeText: string;
      let redactionWarnings: string[] = [];
      let detectedSensitiveTypes: string[] = [];

      if (isReadable) {
        let raw = req.file.buffer.toString("utf-8");
        let truncated = false;
        if (raw.length > MAX_EXTRACT_CHARS) {
          raw = raw.slice(0, MAX_EXTRACT_CHARS);
          truncated = true;
        }
        const r = redactPIIAndSecrets(raw);
        safeText = r.redactedText + (truncated ? "\n…[content truncated for storage]" : "");
        redactionWarnings = r.redactionWarnings;
        detectedSensitiveTypes = r.detectedSensitiveTypes;
      } else {
        // Non-readable (image/PDF): redact any client-supplied description/OCR note only.
        const note = originalText || `[File Attachment: ${safeName} · ${req.file.mimetype}]`;
        const r = redactPIIAndSecrets(note);
        safeText = r.redactedText;
        redactionWarnings = r.redactionWarnings;
        detectedSensitiveTypes = r.detectedSensitiveTypes;
      }

      // --- Honest storage: Cloud Storage first; local disk is a DEV-ONLY fallback ---
      let storageProvider: "gcs" | "local-dev" | undefined;
      let gcsSuccess = false;
      try {
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(storagePath);
        await fileRef.save(req.file.buffer, {
          contentType: req.file.mimetype,
          metadata: {
            cacheControl: "private, max-age=31536000",
            ownerId: resolveOwnerIdFromToken(req.user.uid),
            caseId: id,
            evidenceId: evidenceId,
          },
        });
        gcsSuccess = true;
        console.log(`Evidence stored in Cloud Storage: ${storagePath}`);
      } catch (gcsErr: any) {
        logEvent({ event: "gcs_upload_failed", level: "warn", errorType: safeErrorType(gcsErr) });
      }

      if (gcsSuccess) {
        storageProvider = "gcs";
      } else if (process.env.NODE_ENV === "production") {
        // Never silently keep raw evidence on ephemeral local disk in production.
        res.status(502).json({
          error: "Evidence storage is temporarily unavailable; the file was not saved. Please retry.",
        });
        return;
      } else {
        // Development only: persist to the git-ignored local cache so the flow is testable
        // without Cloud Storage credentials. Clearly marked as a dev-only fallback.
        try {
          const localDir = path.join(process.cwd(), "secure_uploads", req.user.uid, id, evidenceId);
          fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(path.join(localDir, safeName), req.file.buffer);
          storageProvider = "local-dev";
          console.warn(`[DEV-ONLY] Cloud Storage unavailable — evidence stored locally (provider=local-dev): ${storagePath}`);
        } catch (localErr: any) {
          logEvent({ event: "dev_local_storage_failed", level: "error", errorType: safeErrorType(localErr) });
          res.status(500).json({ error: "Could not store the evidence file." });
          return;
        }
      }

      const newEvidence: EvidenceItem = {
        id: evidenceId,
        ownerId: resolveOwnerIdFromToken(req.user.uid),
        caseId: id,
        type,
        title,
        fileName: safeName,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        storageProvider,
        storagePath,
        fileUrl: `/api/cases/${id}/evidence/${evidenceId}/file`,
        downloadUrl: `/api/cases/${id}/evidence/${evidenceId}/file?download=true`,
        // Raw readable file bytes are never persisted — only the redacted, length-capped text.
        originalText: undefined,
        extractedText: isReadable ? safeText : undefined,
        redactedText: safeText || undefined,
        redactionWarnings: redactionWarnings || [],
        detectedSensitiveTypes: detectedSensitiveTypes || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const originalItems = caseData.evidenceItems || [];
      const updatedEvidenceItems = [...originalItems, newEvidence];

      const updates: any = {
        evidenceItems: updatedEvidenceItems,
        updatedAt: new Date().toISOString(),
      };

      if (caseData.status === "analyzed") {
        updates.status = "draft";
      }

      await docRef.update(updates);
      res.status(201).json({ id, ...caseData, ...updates });
    } catch (err: any) {
      logRouteError("upload_evidence", "/api/cases/:id/evidence/upload", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get evidence file attachment (authenticated user ownership-validated stream proxy)
  app.get("/api/cases/:id/evidence/:evidenceId/file", requireAuth, async (req: any, res: any) => {
    try {
      const { id, evidenceId } = req.params;
      
      const doc = await adminDb.collection("cases").doc(id).get();
      if (!doc.exists) {
        res.status(404).json({ error: "Fraud case target not found." });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to this case resource." });
        return;
      }

      const originalItems = caseData.evidenceItems || [];
      const targetItem = originalItems.find((e: any) => e.id === evidenceId);

      if (!targetItem || !targetItem.fileName) {
        res.status(404).json({ error: "Requested evidence file is not registered or has no filename copy." });
        return;
      }

      const filename = targetItem.fileName;
      const fileExt = path.extname(filename).toLowerCase();
      let contentType = targetItem.fileType || "application/octet-stream";

      // Detect HTML files and override with safe plain-text MIME type
      const isHtml = fileExt === ".html" || fileExt === ".htm" || contentType.toLowerCase().includes("html");
      if (isHtml) {
        contentType = "text/plain";
      }

      // Safe Response Header configurations (Sanitizing XSS and script hazards)
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const isImage = [".png", ".jpg", ".jpeg", ".webp"].includes(fileExt);
      if (req.query.download === "true" || !isImage) {
        // Enforce attachments for PDFs, CSVs, TXT, JSON, HTML to isolate execution
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      } else {
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      }

      // Provider-aware retrieval. "local-dev" items (only created when Cloud Storage was
      // unavailable in development) are served from disk; everything else streams from
      // Cloud Storage with no phantom local fallback.
      const provider = targetItem.storageProvider || (targetItem.storagePath ? "gcs" : "local-dev");

      if (provider === "local-dev") {
        serveLocalFile(req.user.uid, id, evidenceId, filename, res, contentType);
        return;
      }

      let served = false;
      try {
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(targetItem.storagePath || "");
        const [exists] = await fileRef.exists();
        if (exists) {
          const readStream = fileRef.createReadStream();
          readStream.on("error", (streamErr) => {
            logEvent({ event: "gcs_stream_error", level: "error", route: "/api/cases/:id/evidence/:evidenceId/file", errorType: safeErrorType(streamErr) });
            if (!res.headersSent) {
              res.status(502).json({ error: "Could not stream the stored evidence file." });
            } else {
              res.destroy();
            }
          });
          readStream.pipe(res);
          served = true;
        }
      } catch (gcsStreamErr) {
        logEvent({ event: "gcs_query_failed", level: "warn", errorType: safeErrorType(gcsStreamErr) });
      }

      if (!served) {
        res.status(404).json({ error: "The evidence file could not be located in Cloud Storage." });
      }
    } catch (err: any) {
      logRouteError("get_evidence_file", "/api/cases/:id/evidence/:evidenceId/file", err);
      res.status(500).json({ error: err.message });
    }
  });

  function serveLocalFile(uid: string, caseId: string, evidenceId: string, filename: string, res: any, forcedContentType?: string) {
    const localFilePath = path.join(process.cwd(), "secure_uploads", uid, caseId, evidenceId, filename);
    if (fs.existsSync(localFilePath)) {
      const fileExt = path.extname(filename).toLowerCase();
      let contentType = forcedContentType || "application/octet-stream";
      const isHtml = fileExt === ".html" || fileExt === ".htm" || contentType.toLowerCase().includes("html");
      if (isHtml) {
        contentType = "text/plain";
      }

      const isImage = [".png", ".jpg", ".jpeg", ".webp"].includes(fileExt);
      const disposition = (!isImage) 
        ? `attachment; filename="${filename}"` 
        : `inline; filename="${filename}"`;

      res.sendFile(localFilePath, {
        headers: {
          "Content-Type": contentType,
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": disposition
        }
      });
    } else {
      res.status(404).json({ error: "The file is not stored in digital backups or Cloud Storage." });
    }
  }

  // Delete an evidence item from a case (verifying ownership and purging Storage + disk bytes)
  app.delete("/api/cases/:id/evidence/:evidenceId", requireAuth, async (req: any, res: any) => {
    try {
      const { id, evidenceId } = req.params;
      const docRef = adminDb.collection("cases").doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        res.status(404).json({ error: "Fraud case target not found." });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to this case resource." });
        return;
      }

      const originalItems = caseData.evidenceItems || [];
      const targetItem = originalItems.find((e: any) => e.id === evidenceId);

      if (targetItem) {
        // 1. Purge from Cloud Storage
        try {
          const bucket = adminStorage.bucket();
          const fileRef = bucket.file(targetItem.storagePath || "");
          const [exists] = await fileRef.exists();
          if (exists) {
            await fileRef.delete();
            console.log(`Deleted ${targetItem.storagePath} from GCS`);
          }
        } catch (gcsDeleteErr) {
          logEvent({ event: "gcs_purge_failed", level: "warn", errorType: safeErrorType(gcsDeleteErr) });
        }

        // 2. Purge from local workspace backup
        try {
          if (targetItem.fileName) {
            const localPath = path.join(
              process.cwd(),
              "secure_uploads",
              req.user.uid,
              id,
              evidenceId,
              targetItem.fileName
            );
            if (fs.existsSync(localPath)) {
              fs.unlinkSync(localPath);
              const localDir = path.dirname(localPath);
              if (fs.readdirSync(localDir).length === 0) {
                fs.rmdirSync(localDir);
              }
            }
          }
        } catch (localDeleteErr) {
          logEvent({ event: "local_purge_failed", level: "warn", errorType: safeErrorType(localDeleteErr) });
        }
      }

      const updatedEvidenceItems = originalItems.filter((e: any) => e.id !== evidenceId);

      const updates: any = {
        evidenceItems: updatedEvidenceItems,
        updatedAt: new Date().toISOString(),
      };

      if (caseData.status === "analyzed") {
        updates.status = "draft";
      }

      await docRef.update(updates);
      res.json({ id, ...caseData, ...updates });
    } catch (err: any) {
      logRouteError("delete_evidence", "/api/cases/:id/evidence/:evidenceId", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger Gemini-assisted Structured Evidence Analysis
  app.post("/api/cases/:id/analyze", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const docRef = adminDb.collection("cases").doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        res.status(404).json({ error: "Fraud case target not found." });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to this case resource." });
        return;
      }

      try {
        const analysisResult = await analyzeFraudCase(
          caseData.title || "",
          caseData.description || "",
          caseData.evidenceItems || []
        );

        const updates = {
          analysis: analysisResult,
          status: "analyzed" as const,
          updatedAt: new Date().toISOString(),
        };

        await docRef.update(updates);
        res.json({ id, ...caseData, ...updates });
      } catch (err: any) {
        logEvent({ event: "analyze_execution_error", level: "error", route: "/api/cases/:id/analyze", errorType: safeErrorType(err) });
        res.status(500).json({ error: "Could not analyze evidence due to processing issues." });
      }
    } catch (err: any) {
      logRouteError("analyze_case", "/api/cases/:id/analyze", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete an entire case
  app.delete("/api/cases/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const docRef = adminDb.collection("cases").doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        res.status(404).json({ error: "Case not found" });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to delete this case." });
        return;
      }

      await docRef.delete();
      res.json({ success: true, message: "Case successfully destroyed." });
    } catch (err: any) {
      logRouteError("delete_case", "/api/cases/:id", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update Case Parameters / Status (supporting both PUT and PATCH)
  const handleUpdate = async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const docRef = adminDb.collection("cases").doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        res.status(404).json({ error: "Case not found" });
        return;
      }

      const caseData = doc.data();
      if (!isCaseOwner(caseData, req.user.uid)) {
        res.status(403).json({ error: "Forbidden: Access denied to update this case." });
        return;
      }

      const { updates, updatedAt } = buildCaseUpdatePayload(req.body ?? {});
      await docRef.update({ ...updates, updatedAt });
      res.json({ id, ...caseData, ...updates, updatedAt });
    } catch (err: any) {
      logRouteError("update_case", "/api/cases/:id", err);
      res.status(500).json({ error: err.message });
    }
  };

  app.put("/api/cases/:id", requireAuth, handleUpdate);
  app.patch("/api/cases/:id", requireAuth, handleUpdate);

  // Seed demo cases with logged-in user isolated ownership
  app.post("/api/cases/seed", requireAuth, async (req: any, res: any) => {
    try {
      const batch = adminDb.batch();
      const demoCases = MOCK_CASES.map((c, idx) => {
        const newId = `demo-${idx}-${Date.now()}`;
        return {
          ...c,
          id: newId,
          ownerId: resolveOwnerIdFromToken(req.user.uid),
          title: `${c.title} (Demo)`,
          createdAt: new Date(Date.now() - idx * 3600000).toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      for (const c of demoCases) {
        const ref = adminDb.collection("cases").doc(c.id);
        batch.set(ref, c);
      }

      await batch.commit();
      res.json({ success: true, message: "Demo cases imported successfully." });
    } catch (err: any) {
      logRouteError("seed_cases", "/api/cases/seed", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- PUBLIC QUICK CHECK (no auth; rate-limited; nothing is persisted) ---
  // Intentionally bypasses requireAuth. Redacts the submitted text before any AI call and
  // writes nothing to Firestore/Storage/disk — anonymous submissions are never stored.
  app.post("/api/quick-check/analyze", verifyAppCheck, quickCheckBurstLimit, quickCheckRateLimit, async (req: any, res: any) => {
    try {
      const { text } = req.body || {};
      if (!text || typeof text !== "string" || !text.trim()) {
        res.status(400).json({ error: "Paste a suspicious message or link to run a Quick Check." });
        return;
      }

      // Redact → analyze redacted text only → ephemeral result (shared with the upload endpoint).
      const result = await buildQuickCheckResult(text);
      res.json(result);
    } catch (err: any) {
      logRouteError("quick_check_analyze", "/api/quick-check/analyze", err);
      res.status(500).json({ error: "Could not complete the Quick Check. Please try again." });
    }
  });

  // PUBLIC Quick Check file upload (no auth, rate-limited). Accepts READABLE TEXT files only
  // (TXT/CSV/JSON/HTML). Images/PDFs are validated but not analyzed here — there is no OCR/text
  // extraction — so we return clear guidance instead of pretending. Nothing is ever stored: the
  // handler intentionally has no Firestore/Storage/disk write path.
  app.post("/api/quick-check/analyze-file", verifyAppCheck, uploadBurstLimit, quickCheckRateLimit, publicUploadSingle, async (req: any, res: any) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Attach a .txt, .csv, .json, or .html file to run a Quick Check." });
        return;
      }

      // Same allowlist + magic-byte validation used for authenticated case evidence. Rejects
      // executables/scripts/macros and files renamed/disguised to slip past the browser allowlist.
      const validation = validateUploadedFile(req.file.originalname, req.file.mimetype, req.file.buffer);
      if (!validation.ok) {
        res.status(400).json({ error: validation.error });
        return;
      }

      // Only readable text is analyzable. Images/PDFs are valid evidence but need OCR we do not
      // have, so guide the user rather than fabricate an analysis.
      if (!validation.isReadableText) {
        res.status(415).json({ error: PUBLIC_UPLOAD_TEXT_GUIDANCE, guidance: true });
        return;
      }

      // Read bytes as UTF-8 text. HTML is treated as plain text — it is never parsed or rendered.
      const rawText = req.file.buffer.toString("utf-8");
      if (!rawText.trim()) {
        res.status(400).json({ error: "That file contained no readable text to check." });
        return;
      }

      // Identical ephemeral pipeline as the paste flow: redact → analyze redacted text → return.
      const result = await buildQuickCheckResult(rawText);
      res.json(result);
    } catch (err: any) {
      logRouteError("quick_check_analyze_file", "/api/quick-check/analyze-file", err);
      res.status(500).json({ error: "Could not complete the Quick Check upload. Please try again." });
    }
  });

  // --- PUBLIC COMMUNITY SIGNAL SUBMISSION (no auth; rate-limited; redacted-only) ---
  // Stores ONLY redacted/derived data for later admin pattern review. No raw input, no files,
  // no full identifiers. Requires explicit consent.
  app.post("/api/quick-check/submit-signal", verifyAppCheck, signalBurstLimit, submitSignalRateLimit, async (req: any, res: any) => {
    try {
      const { consentGiven, result } = req.body || {};

      if (consentGiven !== true) {
        res.status(400).json({ error: "Consent is required to share a community signal." });
        return;
      }
      if (!result || typeof result !== "object") {
        res.status(400).json({ error: "Missing Quick Check result data." });
        return;
      }

      const redactedText =
        typeof result.redactedText === "string" ? result.redactedText.slice(0, QC_MAX_INPUT_CHARS) : "";
      if (!redactedText.trim()) {
        res.status(400).json({ error: "A redacted result is required to share a signal." });
        return;
      }

      // Privacy guard: a properly redacted string is idempotent under the redaction guard.
      // If re-redacting changes it, raw sensitive data is present — reject, store nothing.
      const recheck = redactPIIAndSecrets(redactedText);
      if (recheck.redactedText !== redactedText) {
        res.status(400).json({
          error: "Submission appears to contain unredacted sensitive data and was not stored.",
        });
        return;
      }

      const entities = safeSignalEntities(result.extractedEntities);
      const normalizedDomainValue = normalizeDomain(entities.urls[0] || firstUrl(redactedText));
      const maskedPhone = entities.phoneNumbers[0] || null;
      const amountRequested = entities.amounts[0] || null;

      const signalId = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const signal = {
        source: "quick_check",
        consentGiven: true,
        redactedText,
        scamCategory: typeof result.scamCategory === "string" ? result.scamCategory : "unknown",
        riskScore: typeof result.riskScore === "number" ? result.riskScore : 0,
        confidence: typeof result.confidence === "string" ? result.confidence : "low",
        // Defensive: indicators are analysis text, but redact them too so no raw PII can leak.
        possibleFraudIndicators: cappedStringArray(result.possibleFraudIndicators, 20, 500).map(
          (s) => redactPIIAndSecrets(s).redactedText
        ),
        extractedEntities: entities,
        normalizedDomain: normalizedDomainValue,
        normalizedSender: null,
        maskedPhone,
        amountRequested,
        countryContext: "GH",
        createdAt: new Date().toISOString(),
        reviewedStatus: "pending",
        clusterId: null,
        userId: null,
        rawFileStored: false,
      };

      await adminDb.collection("communitySignals").doc(signalId).set(signal);
      res.status(201).json({ success: true });
    } catch (err: any) {
      logRouteError("submit_signal", "/api/quick-check/submit-signal", err);
      res.status(500).json({ error: "Could not submit the signal. Please try again." });
    }
  });

  // --- ADMIN: Community Signals review (admin-only) ---

  // Lightweight capability probe so the client can show/hide the admin link without
  // leaking the allowlist. Requires auth; returns isAdmin for the signed-in user.
  app.get("/api/admin/me", requireAuth, (req: any, res: any) => {
    const email = (req.user.email || "").toLowerCase();
    res.json({ isAdmin: getAdminEmails().has(email) });
  });

  // List redacted community signals with stats. In-memory filter/sort to avoid composite
  // indexes (fine for MVP volume; move to aggregation/pagination at scale).
  app.get("/api/admin/community-signals", requireAdmin, async (req: any, res: any) => {
    try {
      const snapshot = await adminDb.collection("communitySignals").get();
      const all: any[] = [];
      snapshot.forEach((doc) => all.push({ id: doc.id, ...doc.data() }));

      const stats = {
        total: all.length,
        pending: all.filter((s) => s.reviewedStatus === "pending").length,
        reviewed: all.filter((s) => s.reviewedStatus === "reviewed").length,
        falsePositive: all.filter((s) => s.reviewedStatus === "false_positive").length,
        useful: all.filter((s) => s.reviewedStatus === "useful").length,
        highRisk: all.filter((s) => (s.riskScore || 0) >= HIGH_RISK_THRESHOLD).length,
      };

      let list = all;
      const { status, category, minRiskScore, limit } = req.query;
      if (typeof status === "string" && status) list = list.filter((s) => s.reviewedStatus === status);
      if (typeof category === "string" && category) list = list.filter((s) => s.scamCategory === category);
      if (minRiskScore !== undefined) {
        const m = Number(minRiskScore);
        if (!isNaN(m)) list = list.filter((s) => (s.riskScore || 0) >= m);
      }
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lim = Math.min(Number(limit) || 100, 500);
      list = list.slice(0, lim);

      res.json({ stats, signals: list });
    } catch (err: any) {
      logRouteError("list_signals", "/api/admin/community-signals", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update review fields only. redactedText is never accepted; no deletes in this phase.
  app.patch("/api/admin/community-signals/:id", requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { reviewedStatus, adminNote, clusterId } = req.body || {};

      const updates: any = {};
      if (reviewedStatus !== undefined) {
        if (!ADMIN_REVIEW_STATUSES.includes(reviewedStatus)) {
          res.status(400).json({ error: "Invalid review status." });
          return;
        }
        updates.reviewedStatus = reviewedStatus;
      }
      if (adminNote !== undefined) {
        // Defensive: redact the admin note too — this collection never stores raw identifiers.
        updates.adminNote = redactPIIAndSecrets(String(adminNote).slice(0, 1000)).redactedText;
      }
      if (clusterId !== undefined) {
        updates.clusterId = clusterId === null ? null : String(clusterId).slice(0, 80);
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "No valid fields to update." });
        return;
      }
      updates.updatedAt = new Date().toISOString();

      const ref = adminDb.collection("communitySignals").doc(id);
      const doc = await ref.get();
      if (!doc.exists) {
        res.status(404).json({ error: "Signal not found." });
        return;
      }
      await ref.update(updates);
      const updated = await ref.get();
      res.json({ id: updated.id, ...updated.data() });
    } catch (err: any) {
      logRouteError("update_signal", "/api/admin/community-signals/:id", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- COMPILER DEV / PROD MIDDLEWARES ---

  if (process.env.NODE_ENV !== "production") {
    // Mount Vite development server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve build outputs in standard production container mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Launch service
  app.listen(PORT, HOST, () => {
    console.log(`FraudCase GH [Fullstack Service] listening at http://${HOST}:${PORT}`);
  });
}

// Prevent a rejected background promise (e.g. a Firebase Admin credential lookup when running
// without Application Default Credentials) from terminating the process. Public, unauthenticated
// endpoints must never be able to crash the server via an unhandled rejection.
process.on("unhandledRejection", (reason) => {
  logEvent({ event: "unhandled_rejection", level: "error", errorType: safeErrorType(reason) });
});

startServer().catch((error) => {
  logEvent({ event: "server_boot_failed", level: "error", errorType: safeErrorType(error) });
});
