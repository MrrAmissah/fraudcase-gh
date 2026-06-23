import type {
  ExtractedArtifact,
  ExtractionProvider,
  ExtractionStatus,
  PrivacyFlags,
} from "../lib/extraction/types";

export type EvidenceType =
  | "sms"
  | "whatsapp"
  | "email"
  | "url"
  | "receipt"
  | "screenshot"
  | "document"
  | "note";

export interface EvidenceItem {
  id: string;
  ownerId?: string;
  caseId: string;
  type: EvidenceType;
  title: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  storageProvider?: "gcs" | "local-dev";
  storagePath?: string;
  fileUrl?: string;
  downloadUrl?: string;
  originalText?: string;
  extractedText?: string;
  redactedText?: string;
  redactionWarnings?: string[];
  detectedSensitiveTypes?: string[];
  // --- Sprint 3 multimodal extraction (image/PDF). ---
  // The redacted extraction lives ONLY in `extractedArtifact`; it is never written into
  // `redactedText`/`originalText`/`extractedText`, so the case analyzer (which reads those)
  // cannot auto-include unaccepted extracted text. Trusted analysis input requires user acceptance.
  extractionStatus?: ExtractionStatus;
  extractionProvider?: ExtractionProvider;
  extractedArtifact?: ExtractedArtifact;
  latestExtractionRunId?: string;
  requiresHumanReview?: boolean;
  privacyFlags?: PrivacyFlags;
  createdAt: string;
  updatedAt?: string;
}
