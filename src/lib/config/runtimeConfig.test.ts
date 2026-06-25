import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePort,
  DEFAULT_PORT,
  resolveFirestoreDatabaseId,
  DEFAULT_FIRESTORE_DATABASE_ID,
  resolveGeminiModel,
  DEFAULT_GEMINI_MODEL,
  resolveGenAIClientConfig,
  DEFAULT_VERTEX_LOCATION,
} from "./runtimeConfig";

test("resolvePort: defaults to 3000 when PORT is unset or empty", () => {
  assert.equal(resolvePort({} as NodeJS.ProcessEnv), DEFAULT_PORT);
  assert.equal(resolvePort({ PORT: "" } as unknown as NodeJS.ProcessEnv), DEFAULT_PORT);
});

test("resolvePort: honors a numeric PORT injected by the platform (Cloud Run)", () => {
  assert.equal(resolvePort({ PORT: "8080" } as unknown as NodeJS.ProcessEnv), 8080);
});

test("resolvePort: ignores invalid/zero/negative PORT and falls back to the default", () => {
  assert.equal(resolvePort({ PORT: "abc" } as unknown as NodeJS.ProcessEnv), DEFAULT_PORT);
  assert.equal(resolvePort({ PORT: "0" } as unknown as NodeJS.ProcessEnv), DEFAULT_PORT);
  assert.equal(resolvePort({ PORT: "-5" } as unknown as NodeJS.ProcessEnv), DEFAULT_PORT);
});

test("resolveFirestoreDatabaseId: defaults to the current AI Studio database id", () => {
  assert.equal(resolveFirestoreDatabaseId({} as NodeJS.ProcessEnv), DEFAULT_FIRESTORE_DATABASE_ID);
  assert.equal(DEFAULT_FIRESTORE_DATABASE_ID, "ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9");
});

test("resolveFirestoreDatabaseId: honors an explicit override", () => {
  assert.equal(
    resolveFirestoreDatabaseId({ FIRESTORE_DATABASE_ID: "fraudcase-staging-db" } as unknown as NodeJS.ProcessEnv),
    "fraudcase-staging-db",
  );
});

test("resolveFirestoreDatabaseId: empty/whitespace never silently becomes (default)", () => {
  assert.equal(resolveFirestoreDatabaseId({ FIRESTORE_DATABASE_ID: "" } as unknown as NodeJS.ProcessEnv), DEFAULT_FIRESTORE_DATABASE_ID);
  assert.equal(resolveFirestoreDatabaseId({ FIRESTORE_DATABASE_ID: "   " } as unknown as NodeJS.ProcessEnv), DEFAULT_FIRESTORE_DATABASE_ID);
  assert.notEqual(resolveFirestoreDatabaseId({ FIRESTORE_DATABASE_ID: "" } as unknown as NodeJS.ProcessEnv), "(default)");
});

test("resolveGeminiModel: defaults to a stable GA model, not the unreliable gemini-3.5-flash", () => {
  assert.equal(resolveGeminiModel({} as NodeJS.ProcessEnv), DEFAULT_GEMINI_MODEL);
  assert.equal(DEFAULT_GEMINI_MODEL, "gemini-2.5-flash");
  assert.notEqual(DEFAULT_GEMINI_MODEL, "gemini-3.5-flash");
});

test("resolveGeminiModel: honors the GEMINI_MODEL override (applies to analyzer + extractor alike)", () => {
  assert.equal(resolveGeminiModel({ GEMINI_MODEL: "gemini-2.0-flash" } as unknown as NodeJS.ProcessEnv), "gemini-2.0-flash");
});

test("resolveGeminiModel: empty/whitespace falls back to the default", () => {
  assert.equal(resolveGeminiModel({ GEMINI_MODEL: "" } as unknown as NodeJS.ProcessEnv), DEFAULT_GEMINI_MODEL);
  assert.equal(resolveGeminiModel({ GEMINI_MODEL: "  " } as unknown as NodeJS.ProcessEnv), DEFAULT_GEMINI_MODEL);
});

test("resolveGenAIClientConfig: defaults to Gemini API (apiKey) mode", () => {
  const cfg = resolveGenAIClientConfig({ GEMINI_API_KEY: "AIzaXXXX" } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(cfg, { vertexai: false, apiKey: "AIzaXXXX" });
});

test("resolveGenAIClientConfig: Vertex mode uses ADC + project/location, no apiKey", () => {
  const cfg = resolveGenAIClientConfig({
    GOOGLE_GENAI_USE_VERTEXAI: "true",
    GOOGLE_CLOUD_PROJECT: "stellar-perigee-498907-c4",
    GOOGLE_CLOUD_LOCATION: "europe-west1",
  } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(cfg, { vertexai: true, project: "stellar-perigee-498907-c4", location: "europe-west1" });
  assert.equal((cfg as { apiKey?: string }).apiKey, undefined);
});

test("resolveGenAIClientConfig: Vertex falls back to VITE project + default region", () => {
  const cfg = resolveGenAIClientConfig({
    GOOGLE_GENAI_USE_VERTEXAI: "true",
    VITE_FIREBASE_PROJECT_ID: "proj-x",
  } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(cfg, { vertexai: true, project: "proj-x", location: DEFAULT_VERTEX_LOCATION });
});

test("resolveGenAIClientConfig: null when nothing is configured (heuristic fallback)", () => {
  assert.equal(resolveGenAIClientConfig({} as NodeJS.ProcessEnv), null);
  assert.equal(
    resolveGenAIClientConfig({ GOOGLE_GENAI_USE_VERTEXAI: "true" } as unknown as NodeJS.ProcessEnv),
    null,
  );
});
