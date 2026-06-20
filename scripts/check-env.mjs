#!/usr/bin/env node
/**
 * Lightweight environment check for FraudCase GH.
 * Reports which variables are present vs not set — it NEVER prints any value.
 * Informational only (always exits 0).
 *
 *   npm run check:env
 */
import dotenv from "dotenv";
dotenv.config();

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
  {
    title: "Firebase Admin credentials — required for persistence (Firestore/Storage)",
    vars: ["GOOGLE_APPLICATION_CREDENTIALS"],
    note: "Alternatively use `gcloud auth application-default login` (ADC), which this check cannot detect.",
  },
];

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

console.log(`Summary: ${presentCount}/${totalCount} variables set.`);
console.log("Reminder: never commit real secrets — .env and service-account keys are git-ignored.\n");
