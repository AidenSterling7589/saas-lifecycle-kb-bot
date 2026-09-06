import assert from "node:assert/strict";
import test from "node:test";
import { decideAdminAction } from "../src/lifecycle_decision.js";

test("a suspended account procedure requires an admin review", () => {
  const decision = decideAdminAction({
    documentId: "suspended-account-review",
    title: "Review an account that is suspended",
    guidance: "Keep access disabled while an admin verifies the account state.",
    stage: "suspended",
    confidence: 0.94
  });

  assert.equal(decision.action, "admin_review");
  assert.match(decision.note, /confirm the account state/);
});
