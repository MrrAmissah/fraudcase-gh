import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePort,
  DEFAULT_PORT,
  resolveFirestoreDatabaseId,
  DEFAULT_FIRESTORE_DATABASE_ID,
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
