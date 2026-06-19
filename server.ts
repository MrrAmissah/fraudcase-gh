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
import multer from "multer";
import fs from "fs";

// Initialize environment variables
dotenv.config();

// Port & Host binding required by the AI Studio reverse-proxy environment
const PORT = 3000;
const HOST = "0.0.0.0";

// --- Public Quick Check (no-auth) abuse control + helpers ---
const QC_DAILY_LIMIT = 15; // anonymous scans per IP per day
const QC_MAX_INPUT_CHARS = 5000; // public input length cap
const quickCheckHits = new Map<string, { count: number; day: string }>();

// Best-effort per-IP daily limiter for the public endpoint. NOTE: x-forwarded-for is
// client-spoofable, so this is a scaffold only — App Check / CAPTCHA is the real control
// (tracked in docs/QUICK_CHECK_TODO.md).
function quickCheckRateLimit(req: any, res: any, next: any) {
  const ip = String(
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown"
  );
  const today = new Date().toISOString().slice(0, 10);
  const entry = quickCheckHits.get(ip);

  if (!entry || entry.day !== today) {
    quickCheckHits.set(ip, { count: 1, day: today });
  } else if (entry.count >= QC_DAILY_LIMIT) {
    res.status(429).json({
      error: "You've reached today's free Quick Check limit. Create a free account to keep checking evidence.",
    });
    return;
  } else {
    entry.count += 1;
  }

  // Opportunistic cleanup of stale day buckets to bound memory.
  if (quickCheckHits.size > 5000) {
    for (const [k, v] of quickCheckHits) {
      if (v.day !== today) quickCheckHits.delete(k);
    }
  }

  next();
}

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

async function startServer() {
  const app = express();
  
  // Parse incoming JSON requests up to 15mb
  app.use(express.json({ limit: "15mb" }));

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
      console.error("Token verification failed:", err);
      res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
  }

  // --- API ROUTES ---

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
      console.error("Fetch cases error:", err);
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
      if (caseData?.ownerId !== req.user.uid) {
        res.status(403).json({ error: "Forbidden: Access denied to this case resource." });
        return;
      }

      res.json({ id: doc.id, ...caseData });
    } catch (err: any) {
      console.error("Fetch specific case error:", err);
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
      if (caseData?.ownerId !== req.user.uid) {
        res.status(403).json({ error: "Forbidden: Access denied to this case report." });
        return;
      }

      res.json({ id: doc.id, ...caseData });
    } catch (err: any) {
      console.error("Fetch case report error:", err);
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
        ownerId: req.user.uid,
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
      console.error("Create case error:", err);
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
      if (caseData?.ownerId !== req.user.uid) {
        res.status(403).json({ error: "Forbidden: Access denied to this case resource." });
        return;
      }

      // Automatically apply safety redaction layer on the backend as well
      const redaction = redactPIIAndSecrets(originalText || "");

      const newEvidence: EvidenceItem = {
        id: `ev-${Date.now()}`,
        ownerId: req.user.uid,
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
      console.error("Add evidence error:", err);
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
      if (caseData?.ownerId !== req.user.uid) {
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
            ownerId: req.user.uid,
            caseId: id,
            evidenceId: evidenceId,
          },
        });
        gcsSuccess = true;
        console.log(`Evidence stored in Cloud Storage: ${storagePath}`);
      } catch (gcsErr: any) {
        console.warn("Cloud Storage upload failed:", gcsErr.message);
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
          console.error("Dev-only local storage failed:", localErr);
          res.status(500).json({ error: "Could not store the evidence file." });
          return;
        }
      }

      const newEvidence: EvidenceItem = {
        id: evidenceId,
        ownerId: req.user.uid,
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
      console.error("File upload evidence error:", err);
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
      if (caseData?.ownerId !== req.user.uid) {
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
            console.error("Cloud Storage stream error.", streamErr);
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
        console.warn("Could not query Cloud Storage object.", gcsStreamErr);
      }

      if (!served) {
        res.status(404).json({ error: "The evidence file could not be located in Cloud Storage." });
      }
    } catch (err: any) {
      console.error("Secure file retrieval error:", err);
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
      if (caseData?.ownerId !== req.user.uid) {
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
          console.warn("Could not purge GCS bytes:", gcsDeleteErr);
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
          console.warn("Could not purge local file fallback:", localDeleteErr);
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
      console.error("Delete evidence error:", err);
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
      if (caseData?.ownerId !== req.user.uid) {
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
        console.error("Analysis execution error: ", err);
        res.status(500).json({ error: "Could not analyze evidence due to processing issues." });
      }
    } catch (err: any) {
      console.error("Analyze case wrapper error:", err);
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
      if (caseData?.ownerId !== req.user.uid) {
        res.status(403).json({ error: "Forbidden: Access denied to delete this case." });
        return;
      }

      await docRef.delete();
      res.json({ success: true, message: "Case successfully destroyed." });
    } catch (err: any) {
      console.error("Delete case error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update Case Parameters / Status (supporting both PUT and PATCH)
  const handleUpdate = async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status, title, description, incidentDate } = req.body;
      
      const docRef = adminDb.collection("cases").doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        res.status(404).json({ error: "Case not found" });
        return;
      }

      const caseData = doc.data();
      if (caseData?.ownerId !== req.user.uid) {
        res.status(403).json({ error: "Forbidden: Access denied to update this case." });
        return;
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (incidentDate !== undefined) updates.incidentDate = incidentDate;
      if (status !== undefined) updates.status = status;
      updates.updatedAt = new Date().toISOString();

      await docRef.update(updates);
      res.json({ id, ...caseData, ...updates });
    } catch (err: any) {
      console.error("Update case error:", err);
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
          ownerId: req.user.uid,
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
      console.error("Seed demo cases error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- PUBLIC QUICK CHECK (no auth; rate-limited; nothing is persisted) ---
  // Intentionally bypasses requireAuth. Redacts the submitted text before any AI call and
  // writes nothing to Firestore/Storage/disk — anonymous submissions are never stored.
  app.post("/api/quick-check/analyze", quickCheckRateLimit, async (req: any, res: any) => {
    try {
      const { text } = req.body || {};
      if (!text || typeof text !== "string" || !text.trim()) {
        res.status(400).json({ error: "Paste a suspicious message or link to run a Quick Check." });
        return;
      }

      const input = text.slice(0, QC_MAX_INPUT_CHARS);

      // 1. Redact BEFORE analysis — raw text is never sent to the AI and never stored.
      const redaction = redactPIIAndSecrets(input);

      // 2. Analyze the redacted text only (server-side Gemini; heuristic fallback if no key).
      const analysis = await analyzeFraudCase("Quick Check submission", redaction.redactedText, []);

      // 3. Build an ephemeral result. Nothing is written to Firestore/Storage/disk.
      const result: QuickCheckResult = {
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
        saveAsCaseAvailable: true, // CTA scaffolded for Phase 2 (no persistence yet)
        shareRedactedSignalAvailable: false, // community signals = Phase 3
        disclaimer: QUICK_CHECK_DISCLAIMER,
      };

      res.json(result);
    } catch (err: any) {
      console.error("Quick Check analyze error:", err);
      res.status(500).json({ error: "Could not complete the Quick Check. Please try again." });
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

startServer().catch((error) => {
  console.error("Critical: Failed to boot custom Express + Vite server:", error);
});
