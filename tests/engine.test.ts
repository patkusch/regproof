// The engine's claims, pinned: deterministic seed, byte-identical cohorts,
// exact group-by semantics, the escalation rule, and totals that reconcile.
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { seedContracts } from "../src/lib/seed";
import {
  buildCohorts,
  computeTotals,
  isNonCompliant,
  missingClauses,
  requiresEscalation,
} from "../src/lib/engine";
import type { Contract } from "../src/lib/domain";

const contract = (over: Partial<Contract> = {}): Contract => ({
  id: "X-1",
  supplier: "Test",
  service: "Hosting",
  criticality: "critical",
  jurisdiction: "UK",
  governingLaw: "UK",
  annualValueGBP: 1000,
  signed: "2024-01-01",
  clausesPresent: ["C1", "C2"],
  ...over,
});

describe("seed", () => {
  test("the portfolio is identical on every run, so the headline number cannot be a lucky roll", () => {
    assert.deepEqual(seedContracts(), seedContracts());
    assert.equal(seedContracts().length, 240);
  });

  test("it contains what the demo needs: cross-border contracts and out-of-scope support ones", () => {
    const all = seedContracts();
    assert.ok(all.some(requiresEscalation), "some cross-border");
    assert.ok(all.some((c) => c.criticality === "support"), "some support");
  });
});

describe("scope and escalation", () => {
  test("only critical and important functions are in scope for the clauses", () => {
    assert.equal(isNonCompliant(contract({ criticality: "support", clausesPresent: [] })), false);
    assert.equal(isNonCompliant(contract({ criticality: "important", clausesPresent: [] })), true);
    assert.equal(isNonCompliant(contract({ clausesPresent: ["C1", "C2", "C3", "C4"] })), false);
  });

  test("missing clauses come back in canonical order whatever order they were present in", () => {
    assert.deepEqual(missingClauses(contract({ clausesPresent: ["C4", "C1"] })), ["C2", "C3"]);
  });

  test("a governing law other than the entity's jurisdiction is a legal judgement, not a template", () => {
    assert.equal(requiresEscalation(contract({ governingLaw: "UK" })), false);
    assert.equal(requiresEscalation(contract({ governingLaw: "US" })), true);
  });
});

describe("buildCohorts", () => {
  const contracts = seedContracts();
  const cohorts = buildCohorts(contracts);

  test("re-running gives byte-identical cohorts", () => {
    assert.equal(JSON.stringify(buildCohorts(seedContracts())), JSON.stringify(cohorts));
  });

  test("every member of a cohort shares its missing set, criticality and escalation state", () => {
    const byId = new Map(contracts.map((c) => [c.id, c]));
    for (const cohort of cohorts) {
      for (const id of cohort.contractIds) {
        const c = byId.get(id)!;
        assert.deepEqual(missingClauses(c), cohort.missing, `${id} in ${cohort.id}`);
        assert.equal(c.criticality, cohort.criticality, `${id} in ${cohort.id}`);
        assert.equal(requiresEscalation(c), cohort.requiresEscalation, `${id} in ${cohort.id}`);
      }
    }
  });

  test("every non-compliant contract lands in exactly one cohort, and no compliant or support one does", () => {
    const seen = new Map<string, number>();
    for (const cohort of cohorts) for (const id of cohort.contractIds) seen.set(id, (seen.get(id) ?? 0) + 1);
    for (const c of contracts) {
      assert.equal(seen.get(c.id) ?? 0, isNonCompliant(c) ? 1 : 0, c.id);
    }
  });

  test("cross-border cohorts are escalated and domestic ones are pending; none is pre-approved", () => {
    for (const cohort of cohorts) {
      assert.equal(cohort.status, cohort.requiresEscalation ? "escalated" : "pending", cohort.id);
      assert.equal(cohort.approvedBy, null);
    }
  });

  test("cohorts are ordered by exposure, exposure is the sum of members, and ids are unique", () => {
    const byId = new Map(contracts.map((c) => [c.id, c]));
    for (let i = 1; i < cohorts.length; i++) assert.ok(cohorts[i - 1].exposureGBP >= cohorts[i].exposureGBP);
    for (const cohort of cohorts) {
      const sum = cohort.contractIds.reduce((s, id) => s + byId.get(id)!.annualValueGBP, 0);
      assert.equal(cohort.exposureGBP, sum, cohort.id);
      assert.match(cohort.id, /^COH-\d{2}$/);
    }
    assert.equal(new Set(cohorts.map((c) => c.id)).size, cohorts.length);
  });

  test("a cross-border contract is never grouped with a domestic one that shares its remediation shape", () => {
    const domestic = contract({ id: "D", governingLaw: "UK" });
    const cross = contract({ id: "X", governingLaw: "US" });
    const out = buildCohorts([domestic, cross]);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((c) => c.contractIds).sort(), [["D"], ["X"]]);
  });

  test("the draft names every missing clause by its statutory reference", () => {
    for (const cohort of cohorts) {
      for (const id of cohort.missing) assert.ok(cohort.draft.includes(id === "C1" ? "Art. 30(2)(a)" : id === "C2" ? "Art. 30(2)(e)" : id === "C3" ? "Art. 30(3)(a)" : "Art. 30(3)(b)"), cohort.id);
    }
  });
});

describe("computeTotals", () => {
  test("the exposure headline reconciles with the cohorts it summarises", () => {
    const contracts = seedContracts();
    const cohorts = buildCohorts(contracts);
    const totals = computeTotals(contracts, cohorts);
    assert.equal(totals.contracts, 240);
    assert.equal(totals.cohorts, cohorts.length);
    assert.equal(totals.exposureGBP, cohorts.reduce((s, c) => s + c.exposureGBP, 0));
    assert.equal(totals.nonCompliant, cohorts.reduce((s, c) => s + c.contractIds.length, 0));
    assert.ok(totals.criticalNonCompliant <= totals.nonCompliant);
  });
});
