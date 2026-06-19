import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { MOCK_CASES } from "./src/lib/mock/mockCases";
import { FraudCase } from "./src/types/fraudCase";
import { EvidenceItem } from "./src/types/evidence";
import { analyzeFraudCase } from "./src/lib/gemini/analyzeFraudCase";
import { adminDb, adminAuth, adminStorage } from "./src/lib/firebase/admin";
import { redactPIIAndSecrets } from "./src/lib/security/redaction";
import multer from "multer";
import fs from "fs";

// Initialize environment variables
dotenv.config();

// Port & Host binding required by the AI Studio reverse-proxy environment
const PORT = 3000;
const HOST = "0.0.0.0";

async function startServer() {
  const app = express();
  
  // Parse incoming JSON requests up to 15mb
  app.use(express.json({ limit: "15mb" }));

  // Configure multer for secure memory storage to stream direct to Firebase Cloud Storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // Strict 10MB file limitation limit check
    },
  });

  // Strict File Upload Allowlist and Sanitization Config
  const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".csv", ".json", ".html"];
  const ALLOWED_MIME_TYPES = [
    "image/png", 
    "image/jpeg", 
    "image/pjpeg",
    "image/webp", 
    "application/pdf", 
    "text/plain", 
    "text/csv", 
    "application/json", 
    "text/html"
  ];

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

  // Add a file evidence item to a case (verifying ownership, uploading to GCS with isolated fallback)
  app.post("/api/cases/:id/evidence/upload", requireAuth, upload.single("file"), async (req: any, res: any) => {
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

      // Backend security: Validate file extensions and MIME claims strictly
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      const fileMime = req.file.mimetype.toLowerCase();

      const isAllowedExt = ALLOWED_EXTENSIONS.includes(fileExt);
      const isAllowedMime = ALLOWED_MIME_TYPES.includes(fileMime);

      if (!isAllowedExt || !isAllowedMime) {
        res.status(400).json({ 
          error: "Forbidden file type. Acceptable extension limits: PNG, JPG, WebP, PDF, TXT, CSV, JSON, HTML." 
        });
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
      
      // Sanitize the filename to prevent shell injection, path traversal or arbitrary writes
      const safeName = sanitizeFilename(req.file.originalname);

      // Compute isolated path: users/{uid}/cases/{caseId}/evidence/{evidenceId}/{safeName}
      const storagePath = `users/${req.user.uid}/cases/${id}/evidence/${evidenceId}/${safeName}`;

      // 1. Upload to GCS / Firebase Cloud Storage
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
          }
        });
        gcsSuccess = true;
        console.log(`Uploaded file successfully to ${storagePath}`);
      } catch (gcsErr: any) {
        console.warn("Storage upload unsuccessful, leveraging redundant disk backup. Error:", gcsErr.message);
      }

      // 2. Save physical workspace backup fallback privately
      try {
        const localDir = path.join(process.cwd(), "secure_uploads", req.user.uid, id, evidenceId);
        fs.mkdirSync(localDir, { recursive: true });
        const localFilePath = path.join(localDir, safeName);
        fs.writeFileSync(localFilePath, req.file.buffer);
      } catch (localErr: any) {
        console.error("Local disk backup save error:", localErr);
      }

      // 3. Process backend text safety redactions (could be OCR transcript or textual description)
      const textToRedact = originalText || `[File Attachment: Name: ${safeName}, Type: ${req.file.mimetype}]`;
      const redaction = redactPIIAndSecrets(textToRedact);

      const newEvidence: EvidenceItem = {
        id: evidenceId,
        ownerId: req.user.uid,
        caseId: id,
        type,
        title,
        fileName: safeName,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        storagePath: storagePath,
        fileUrl: `/api/cases/${id}/evidence/${evidenceId}/file`,
        downloadUrl: `/api/cases/${id}/evidence/${evidenceId}/file?download=true`,
        originalText: originalText || undefined,
        redactedText: redaction.redactedText || undefined,
        redactionWarnings: redaction.redactionWarnings || [],
        detectedSensitiveTypes: redaction.detectedSensitiveTypes || [],
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

      // 1. Try streaming from GCS
      let served = false;
      try {
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(targetItem.storagePath || "");
        const [exists] = await fileRef.exists();
        if (exists) {
          const readStream = fileRef.createReadStream();
          readStream.on("error", (streamErr) => {
            console.error("GCS stream error. Falling back to local storage.", streamErr);
            serveLocalFile(req.user.uid, id, evidenceId, filename, res, contentType);
          });
          readStream.pipe(res);
          served = true;
        }
      } catch (gcsStreamErr) {
        console.warn("Could not query GCS stream. Falling back to local storage.", gcsStreamErr);
      }

      // 2. Try streaming from Local storage fallback
      if (!served) {
        serveLocalFile(req.user.uid, id, evidenceId, filename, res, contentType);
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
