import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { cascadeDeleteCase, CascadeDeleteCaseDeps, CascadePurgeEvent } from "./deleteCascade";

interface Calls {
  prefixes: string[];
  localDirs: string[];
  purgeRuns: number;
  deletedDoc: number;
  errors: CascadePurgeEvent[];
  order: string[];
}

function makeDeps(overrides: Partial<CascadeDeleteCaseDeps> = {}) {
  const calls: Calls = { prefixes: [], localDirs: [], purgeRuns: 0, deletedDoc: 0, errors: [], order: [] };
  const deps: CascadeDeleteCaseDeps = {
    uid: "uid-1",
    caseId: "case-99",
    cwd: "/srv/app",
    purgeStoragePrefix: async (p) => { calls.prefixes.push(p); calls.order.push("gcs"); },
    purgeLocalDir: (d) => { calls.localDirs.push(d); calls.order.push("local"); },
    purgeExtractionRuns: async () => { calls.purgeRuns++; calls.order.push("runs"); },
    deleteCaseDoc: async () => { calls.deletedDoc++; calls.order.push("doc"); },
    onPurgeError: (e) => { calls.errors.push(e); },
    ...overrides,
  };
  return { deps, calls };
}

test("cascadeDeleteCase: GCS prefix is the case folder WITH a trailing slash (no sibling-case match)", async () => {
  const { deps, calls } = makeDeps();
  await cascadeDeleteCase(deps);
  assert.deepEqual(calls.prefixes, ["users/uid-1/cases/case-99/"]);
  // The trailing slash is load-bearing: a bare `.../cases/case-99` prefix would also match case-990 etc.
  assert.ok(calls.prefixes[0].endsWith("/cases/case-99/"));
});

test("cascadeDeleteCase: uses the RAW uid passed in (matches upload storagePath keying)", async () => {
  const { deps, calls } = makeDeps({ uid: "RAW-uid-xyz", caseId: "case-7" });
  await cascadeDeleteCase(deps);
  assert.equal(calls.prefixes[0], "users/RAW-uid-xyz/cases/case-7/");
  assert.equal(calls.localDirs[0], path.join("/srv/app", "secure_uploads", "RAW-uid-xyz", "case-7"));
});

test("cascadeDeleteCase: purges local backup + extractionRuns, then deletes the doc last", async () => {
  const { deps, calls } = makeDeps();
  await cascadeDeleteCase(deps);
  assert.deepEqual(calls.localDirs, [path.join("/srv/app", "secure_uploads", "uid-1", "case-99")]);
  assert.equal(calls.purgeRuns, 1);
  assert.equal(calls.deletedDoc, 1);
  assert.equal(calls.errors.length, 0);
  assert.deepEqual(calls.order, ["gcs", "local", "runs", "doc"]);
});

test("cascadeDeleteCase: a storage purge failure is logged but the doc is STILL deleted (best-effort)", async () => {
  const { deps, calls } = makeDeps({ purgeStoragePrefix: async () => { throw new Error("gcs down"); } });
  await cascadeDeleteCase(deps);
  assert.equal(calls.deletedDoc, 1, "doc deletion must not be blocked by a storage failure");
  assert.deepEqual(calls.errors, ["gcs_purge_failed"]);
});

test("cascadeDeleteCase: an extractionRuns failure is logged but the doc is still deleted", async () => {
  const { deps, calls } = makeDeps({ purgeExtractionRuns: async () => { throw new Error("firestore err"); } });
  await cascadeDeleteCase(deps);
  assert.equal(calls.deletedDoc, 1);
  assert.deepEqual(calls.errors, ["extraction_runs_purge_failed"]);
});

test("cascadeDeleteCase: a local-dir purge failure is logged but the doc is still deleted", async () => {
  const { deps, calls } = makeDeps({ purgeLocalDir: () => { throw new Error("fs err"); } });
  await cascadeDeleteCase(deps);
  assert.equal(calls.deletedDoc, 1);
  assert.deepEqual(calls.errors, ["local_purge_failed"]);
});
