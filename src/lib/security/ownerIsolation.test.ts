import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isCaseOwner,
  buildCaseUpdatePayload,
  resolveOwnerIdFromToken,
  CASE_UPDATE_ALLOWED_FIELDS,
} from "./ownerIsolation";

test("isCaseOwner returns true only when ownerId matches authenticated uid", () => {
  assert.equal(isCaseOwner({ ownerId: "user-a" }, "user-a"), true);
  assert.equal(isCaseOwner({ ownerId: "user-a" }, "user-b"), false);
  assert.equal(isCaseOwner({ ownerId: "user-a" }, ""), false);
  assert.equal(isCaseOwner({}, "user-a"), false);
  assert.equal(isCaseOwner(null, "user-a"), false);
});

test("buildCaseUpdatePayload whitelists editable fields only", () => {
  const { updates } = buildCaseUpdatePayload({
    title: "Updated title",
    description: "New description",
    status: "closed",
    incidentDate: "2026-06-01",
    ownerId: "attacker-uid",
    analysis: { riskScore: 0 },
    evidenceItems: [],
  });

  assert.equal(updates.title, "Updated title");
  assert.equal(updates.description, "New description");
  assert.equal(updates.status, "closed");
  assert.equal(updates.incidentDate, "2026-06-01");
  assert.equal("ownerId" in updates, false);
  assert.equal("analysis" in updates, false);
  assert.equal("evidenceItems" in updates, false);
});

test("buildCaseUpdatePayload ignores unknown fields", () => {
  const { updates } = buildCaseUpdatePayload({
    hackerField: "x",
    admin: true,
  });
  assert.deepEqual(updates, {});
});

test("CASE_UPDATE_ALLOWED_FIELDS does not include ownerId", () => {
  assert.equal(CASE_UPDATE_ALLOWED_FIELDS.includes("ownerId" as never), false);
});

test("resolveOwnerIdFromToken returns token uid and rejects empty", () => {
  assert.equal(resolveOwnerIdFromToken("firebase-uid-123"), "firebase-uid-123");
  assert.throws(() => resolveOwnerIdFromToken(""), /Authenticated UID is required/);
});

test("ownership transfer via update payload is structurally impossible", () => {
  const maliciousBody = {
    ownerId: "attacker",
    title: "Legit title change",
  };
  const { updates } = buildCaseUpdatePayload(maliciousBody);
  assert.equal(updates.title, "Legit title change");
  assert.equal(Object.keys(updates).join(","), "title");
});
