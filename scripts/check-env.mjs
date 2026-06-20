#!/usr/bin/env node
/**
 * Lightweight environment check for FraudCase GH.
 * Reports which variables are present vs not set — it NEVER prints any value.
 * Informational only (always exits 0).
 *
 *   npm run check:env
 */
import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
dotenv.config();

// Well-known location where `gcloud auth application-default login` writes local ADC.
// CLOUDSDK_CONFIG overrides the gcloud config dir; otherwise it's platform-specific.
// We only check for the file's existence — its contents are never read or printed.
function adcWellKnownPath() {
  const configDir =
    process.env.CLOUDSDK_CONFIG ||
    (process.platform === "win32"
      ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "gcloud")
      : path.join(os.homedir(), ".config", "gcloud"));
  return path.join(configDir, "application_default_credentials.json");
}

function fileExists(p) {
  try {
    return !!p && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

const groups = [
  {
    title: "Firebase client config (VITE_*, build-time) — code has hardcoded fallbacks",
    vars: [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
      "VITE_FIREBASE_FIRESTORE_DATABASE_ID",
    ],
  },
  {
    title: "Server AI — optional (heuristic mock used if unset)",
    vars: ["GEMINI_API_KEY"],
  },
  {
    title: "Admin dashboard — optional (fail-closed: admin disabled if unset)",
    vars: ["ADMIN_EMAILS"],
  },
];

// The Admin SDK accepts credentials from EITHER a service-account JSON path
// (GOOGLE_APPLICATION_CREDENTIALS) OR local ADC from `gcloud auth application-default login`.
// firebase-admin resolves these automatically, so the group is satisfied if either exists.

const isSet = (name) => !!(process.env[name] && String(process.env[name]).trim());

console.log("\nFraudCase GH — environment check (values are never printed)\n");

let presentCount = 0;
let totalCount = 0;
for (const g of groups) {
  console.log(g.title);
  for (const name of g.vars) {
    totalCount += 1;
    const present = isSet(name);
    if (present) presentCount += 1;
    console.log(`  ${present ? "✓ present " : "○ not set "}  ${name}`);
  }
  if (g.note) console.log(`    note: ${g.note}`);
  console.log("");
}

// Firebase Admin credentials — special-cased because either source satisfies it.
{
  console.log("Firebase Admin credentials — required for persistence (Firestore/Storage)");
  const gacSet = isSet("GOOGLE_APPLICATION_CREDENTIALS");
  const gacFileOk = gacSet && fileExists(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const adcPath = adcWellKnownPath();
  const adcOk = fileExists(adcPath);

  console.log(
    `  ${gacSet ? "✓ present " : "○ not set "}  GOOGLE_APPLICATION_CREDENTIALS (service-account JSON path)` +
      (gacSet && !gacFileOk ? "  [warning: file not found at that path]" : "")
  );
  console.log(
    `  ${adcOk ? "✓ present " : "○ not set "}  Local ADC at ${adcPath}`
  );

  const credentialsOk = gacFileOk || adcOk;
  totalCount += 1;
  if (credentialsOk) presentCount += 1;

  if (credentialsOk) {
    console.log(`    → credentials available via ${gacFileOk ? "service-account JSON" : "local ADC (gcloud)"}.`);
  } else {
    console.log("    → none detected. Run `gcloud auth application-default login` (ADC) or set GOOGLE_APPLICATION_CREDENTIALS.");
  }
  console.log("");
}

console.log(`Summary: ${presentCount}/${totalCount} variables set.`);
console.log("Reminder: never commit real secrets — .env and service-account keys are git-ignored.\n");
