#!/usr/bin/env node
/**
 * Static multimodal staging-readiness check.
 *
 * This script performs local repo checks only. It does not make network calls, does not call
 * Gemini/Firebase/GCS, does not mutate env, and never prints env values.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const warnings = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function pass(label) {
  console.log(`✓ ${label}`);
}

function fail(label) {
  failures.push(label);
  console.log(`✗ ${label}`);
}

function warn(label) {
  warnings.push(label);
  console.log(`! ${label}`);
}

function check(label, ok) {
  if (ok) pass(label);
  else fail(label);
}

function exportedInterfaceBlock(source, name) {
  const match = source.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  return match ? match[1] : "";
}

function hasNone(source, patterns) {
  return patterns.every((pattern) => !pattern.test(source));
}

console.log("\nFraudCase GH — multimodal staging-readiness static check");
console.log("Values are never printed. No network, cloud, Gemini, deploy, or env mutation is performed.\n");

const requiredDocs = [
  "docs/MULTIMODAL_STAGING_SMOKE_TEST.md",
  "docs/SPRINT_3_PLAN.md",
  "docs/PRODUCTION_ENV_CHECKLIST.md",
  "docs/DEPLOYMENT_RUNBOOK.md",
  "docs/GEMINI_QUOTA_AND_BILLING.md",
  "docs/STORAGE_RULES.md",
];

for (const doc of requiredDocs) {
  check(`${doc} exists`, exists(doc));
}

const envExample = exists(".env.example") ? read(".env.example") : "";
const expectedEnvNames = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_FIRESTORE_DATABASE_ID",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_ANALYSIS_TIMEOUT_MS",
  "MULTIMODAL_EXTRACTION_ENABLED",
  "MULTIMODAL_EXTRACTION_TIMEOUT_MS",
];

for (const name of expectedEnvNames) {
  check(`${name} is documented in .env.example`, envExample.includes(name));
}

if (process.env.MULTIMODAL_EXTRACTION_ENABLED === "true") {
  fail("local MULTIMODAL_EXTRACTION_ENABLED is not enabled");
} else {
  pass("local MULTIMODAL_EXTRACTION_ENABLED is not enabled");
}

const packageJson = JSON.parse(read("package.json"));
check("npm test includes extraction test glob", String(packageJson.scripts?.test || "").includes("src/lib/extraction/__tests__/*.test.ts"));
check("npm build script is present", typeof packageJson.scripts?.build === "string" && packageJson.scripts.build.includes("vite build"));

const server = read("server.ts");
check("extract route is present", server.includes('app.post("/api/cases/:id/evidence/:evidenceId/extract"'));
check("fact verification route is present", server.includes('app.patch("/api/cases/:id/evidence/:evidenceId/facts/:factId"'));
check("case analyze route is present", server.includes('app.post("/api/cases/:id/analyze"'));
check("extract route reads storage server-side", server.includes("adminStorage.bucket().file(evidenceItem.storagePath).download()"));
check("extract route does not use client-provided URLs", !server.includes("signedUrl") && !server.includes("getSignedUrl"));
check("extract route writes extractionRuns subcollection", server.includes('collection("extractionRuns")'));
check("extract route uses shared precondition mapping", server.includes("EXTRACTION_DECISION_HTTP[decision]"));
check("extract route requires consent", server.includes("consentGiven"));
check("extract route validates real bytes", server.includes("detectFileKind(buffer)") && server.includes("Only PNG, JPEG, or PDF evidence can be extracted."));
check("extract logging uses content-free event", server.includes('event: "evidence_extracted"'));

const extractor = read("src/lib/extraction/multimodalExtractor.ts");
check("feature flag enables only on exact string true", extractor.includes('process.env.MULTIMODAL_EXTRACTION_ENABLED === "true"'));
check("multimodal logs use content-free event names", ["multimodal_extract_ok", "multimodal_extract_skipped", "multimodal_extract_timeout", "multimodal_extract_error"].every((s) => extractor.includes(s)));

const pipeline = read("src/lib/extraction/extractionPipeline.ts");
check("precondition order includes flag, owner, evidence, consent", ["flag_disabled", "not_owner", "evidence_not_found", "consent_missing"].every((s) => pipeline.includes(s)));
check("precondition mapping returns disabled flag 503 path", pipeline.includes('flag_disabled: { status: 503, error: "Multimodal extraction is not enabled." }'));
check("pipeline never writes OCR into text evidence fields", pipeline.includes("never writes or overwrites") && server.includes("redactedText/originalText/extractedText are never written here"));

const sourceMapping = read("src/lib/extraction/sourceMapping.ts");
check("analysis bundle uses only accepted extracted facts", sourceMapping.includes("Only user-accepted extracted facts are used as analysis input."));

const types = read("src/lib/extraction/types.ts");
const extractionRunType = exportedInterfaceBlock(types, "ExtractionRun");
const extractedFactType = exportedInterfaceBlock(types, "ExtractedFact");
const rawExtractionType = exportedInterfaceBlock(types, "RawExtraction");
const rawFactType = exportedInterfaceBlock(types, "RawExtractedFact");
check("ExtractionRun type omits raw text/prompt/response fields", !!extractionRunType && hasNone(extractionRunType, [/\brawVisibleText\b/, /\bredactedText\b/, /\bprompt\b/i, /\bresponse\b/i, /\bsignedUrl\b/i, /\btoken\b/i]));
check("persisted ExtractedFact type omits rawValue", !!extractedFactType && !/\brawValue\b/.test(extractedFactType));
check("raw extraction types are explicitly memory-only", rawExtractionType.includes("rawVisibleText") && rawFactType.includes("rawValue") && types.includes("Request-memory ONLY"));

const extractionAndUiFiles = [
  "src/lib/extraction/extractionPipeline.ts",
  "src/lib/extraction/multimodalExtractor.ts",
  "src/lib/extraction/redactExtractedText.ts",
  "src/lib/extraction/sourceMapping.ts",
  "src/components/EvidenceCard.tsx",
  "src/components/VerificationWorkspace.tsx",
];
for (const file of extractionAndUiFiles) {
  const source = read(file);
  check(`${file} has no console.log`, !/\bconsole\.log\s*\(/.test(source));
  check(`${file} has no signed URL helper usage`, !/\bgetSignedUrl\b|\bsignedUrl\b/.test(source));
}

const runbook = read("docs/MULTIMODAL_STAGING_SMOKE_TEST.md");
check("runbook has do-not-run staging guard", runbook.includes("DO NOT RUN THIS"));
check("runbook documents success evidence capture", runbook.includes("Success evidence to capture"));
check("runbook documents rollback/teardown", runbook.includes("## 6. Rollback / teardown"));
check("runbook caps real extraction calls", runbook.includes("One or two extraction calls maximum"));

if (warnings.length) {
  console.log(`\nWarnings: ${warnings.length}`);
  for (const item of warnings) console.log(`- ${item}`);
}

if (failures.length) {
  console.log(`\nFailed checks: ${failures.length}`);
  for (const item of failures) console.log(`- ${item}`);
  process.exit(1);
}

console.log("\nAll static multimodal readiness checks passed.\n");
