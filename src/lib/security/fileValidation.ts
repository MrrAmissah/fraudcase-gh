/**
 * Upload file validation: allowlist + real content-signature ("magic byte") checks.
 *
 * Browsers report extension and MIME based on the OS, both of which a user can spoof
 * by renaming a file. These helpers additionally sniff the leading bytes so a script
 * renamed `.png`, or an executable renamed `.pdf`, is rejected even if the declared
 * extension/MIME are allowlisted.
 *
 * Pure functions only (no Node/Express/Firebase deps beyond `path`) so they are
 * unit-testable in isolation.
 */
import path from "path";

export type FileKind = "png" | "jpeg" | "webp" | "pdf" | "text" | "unknown";

// Strict MVP allowlist. Anything not listed — js, sh, py, exe, bat, cmd, php, jar,
// macro-enabled Office files, and unknown binaries — is rejected by omission.
export const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".csv", ".json", ".html"];

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/pjpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "text/html",
];

// Extensions whose contents we can safely read as text and run through redaction.
export const READABLE_EXTENSIONS = [".txt", ".csv", ".json", ".html"];

// Expected real content kind for each allowed extension.
const EXT_TO_KIND: Record<string, FileKind> = {
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".webp": "webp",
  ".pdf": "pdf",
  ".txt": "text",
  ".csv": "text",
  ".json": "text",
  ".html": "text",
};

/**
 * Heuristic UTF-8 text check: no NUL bytes and a low ratio of C0 control characters.
 * UTF-8 multibyte sequences (e.g. "é" = 0xC3 0xA9, "₵" = 0xE2 0x82 0xB5) are all
 * >= 0x20, so accented/currency text is not misclassified as binary.
 */
export function looksLikeText(buf: Buffer): boolean {
  if (buf.length === 0) return true;
  const sample = buf.subarray(0, 4096);
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false; // NUL strongly implies a binary payload
    // Count C0 controls except tab(09), LF(0a), VT(0b), FF(0c), CR(0d)
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control++;
  }
  return control / sample.length < 0.1;
}

/** Sniff the real file kind from its leading bytes. */
export function detectFileKind(buf: Buffer): FileKind {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "png";
  }

  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }

  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  // Strict: PDF signature must be at offset 0. Rejects PDFs with leading junk bytes
  // (rare; Acrobat tolerates them). Acceptable security-strict trade-off for the MVP.
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") {
    return "pdf";
  }

  if (looksLikeText(buf)) return "text";

  return "unknown";
}

export interface FileValidationResult {
  ok: boolean;
  ext: string;
  kind: FileKind;
  isReadableText: boolean;
  error?: string;
}

/**
 * Validate an uploaded file against the allowlist AND its real content signature.
 * Returns `ok: false` with a user-safe `error` message on any failure.
 */
export function validateUploadedFile(
  originalname: string,
  mimetype: string,
  buffer: Buffer
): FileValidationResult {
  const ext = path.extname(originalname || "").toLowerCase();
  const mime = (mimetype || "").toLowerCase();
  const kind = detectFileKind(buffer);
  const isReadableText = READABLE_EXTENSIONS.includes(ext);

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      ext,
      kind,
      isReadableText,
      error: "Forbidden file type. Allowed: PNG, JPG, WebP, PDF, TXT, CSV, JSON, HTML.",
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    return {
      ok: false,
      ext,
      kind,
      isReadableText,
      error: "Declared content-type is not permitted for this evidence format.",
    };
  }

  const expectedKind = EXT_TO_KIND[ext];
  if (!expectedKind || kind !== expectedKind) {
    return {
      ok: false,
      ext,
      kind,
      isReadableText,
      error: "File contents do not match the declared file type (possible renamed or disguised file).",
    };
  }

  return { ok: true, ext, kind, isReadableText };
}
