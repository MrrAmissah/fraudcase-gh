import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePort, DEFAULT_PORT } from "./runtimeConfig";

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
