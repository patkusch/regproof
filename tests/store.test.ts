// The approval gate's three invariants, tried from the outside.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { approveCohort, ApprovalError, getAudit, getScan, resetState } from "../src/lib/store";

describe("approval gate", () => {
  beforeEach(() => resetState());

  test("nothing is approved without a named human", () => {
    const target = getScan().cohorts.find((c) => !c.requiresEscalation)!;
    for (const approver of ["", "   ", "agent", "Agent", " AGENT "]) {
      assert.throws(() => approveCohort(target.id, approver), ApprovalError, JSON.stringify(approver));
    }
    assert.equal(getScan().cohorts.find((c) => c.id === target.id)!.status, "pending", "a refused approval changes nothing");
    assert.equal(getAudit().length, 1, "and writes no audit event");
  });

  test("a named human approves once, and the audit event carries their name", () => {
    const target = getScan().cohorts.find((c) => !c.requiresEscalation)!;
    const approved = approveCohort(target.id, "  Dana Okafor ");
    assert.equal(approved.status, "approved");
    assert.equal(approved.approvedBy, "Dana Okafor");
    const [latest] = getAudit();
    assert.equal(latest.actor, "Dana Okafor");
    assert.equal(latest.action, "cohort.approved");
    assert.equal(latest.cohortId, target.id);
    assert.throws(() => approveCohort(target.id, "Dana Okafor"), /already approved/);
  });

  test("an escalated cohort is only ever resolved explicitly, and the record says so", () => {
    const target = getScan().cohorts.find((c) => c.requiresEscalation)!;
    assert.equal(target.status, "escalated");
    const resolved = approveCohort(target.id, "Legal Owner");
    assert.equal(resolved.status, "approved");
    assert.equal(getAudit()[0].action, "cohort.escalation_resolved");
  });

  test("an unknown cohort is refused", () => {
    assert.throws(() => approveCohort("COH-99", "Dana Okafor"), /Unknown cohort/);
  });

  test("the audit log is handed out newest-first as a copy", () => {
    const before = getAudit();
    before.length = 0;
    assert.equal(getAudit().length, 1, "mutating the copy does not touch the log");
    approveCohort(getScan().cohorts.find((c) => !c.requiresEscalation)!.id, "Dana Okafor");
    const [first, second] = getAudit();
    assert.equal(first.action, "cohort.approved");
    assert.equal(second.action, "scan.completed");
  });
});
