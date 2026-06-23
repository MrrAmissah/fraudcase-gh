import { test } from "node:test";
import assert from "node:assert/strict";

// Smoke test proving the extraction test directory is wired into the npm `test` glob.
// Real coverage lives in the sibling *.test.ts files added across Sprint 3.
test("extraction test runner is wired", () => {
  assert.ok(true);
});
