import type { Contract, ClauseId, Cohort, Criticality, Jurisdiction } from "./domain";
import { CLAUSES } from "./seed";

const ALL_CLAUSES: ClauseId[] = ["C1", "C2", "C3", "C4"];

export function missingClauses(c: Contract): ClauseId[] {
  return ALL_CLAUSES.filter((id) => !c.clausesPresent.includes(id));
}

export function isNonCompliant(c: Contract): boolean {
  // Only critical/important functions are in DORA scope for these clauses.
  return c.criticality !== "support" && missingClauses(c).length > 0;
}

// Escalation rule — stolen straight from Remedia's "control beats autonomy":
// if the contract's governing law differs from the entity's jurisdiction,
// the amendment is a genuine legal judgement, not a template. Force a human.
export function requiresEscalation(c: Contract): boolean {
  return c.governingLaw !== c.jurisdiction;
}

function clauseTitle(id: ClauseId): string {
  return CLAUSES.find((x) => x.id === id)?.title ?? id;
}

// Deterministic, fully-explainable clustering: exact group-by on
// (missing-clause-set × criticality). No embeddings, no model. Re-run it a
// thousand times and you get byte-identical cohorts. Jurisdiction isn't a
// grouping key — it's handled per-cohort via the escalation rule below.
export function buildCohorts(contracts: Contract[]): Cohort[] {
  const groups = new Map<string, Contract[]>();
  for (const c of contracts) {
    if (!isNonCompliant(c)) continue;
    const missing = missingClauses(c);
    // Cross-border is a grouping dimension, not an afterthought: a cross-border
    // contract needs genuine legal judgement, so it lands in its own cohort that
    // is force-escalated — never mixed in with domestic ones that can be templated.
    const crossBorder = requiresEscalation(c) ? "X" : "D";
    const key = `${missing.join("+")}|${c.criticality}|${crossBorder}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(c);
  }

  const cohorts: Cohort[] = [];
  let n = 1;
  for (const [key, members] of [...groups.entries()].sort()) {
    const [missingStr, criticality, crossBorder] = key.split("|");
    const missing = missingStr.split("+") as ClauseId[];
    const exposureGBP = members.reduce((s, c) => s + c.annualValueGBP, 0);
    const requiresEsc = crossBorder === "X";
    const jurisdiction = dominantJurisdiction(members);
    cohorts.push({
      id: `COH-${String(n++).padStart(2, "0")}`,
      missing,
      jurisdiction,
      criticality: criticality as Criticality,
      contractIds: members.map((c) => c.id),
      exposureGBP,
      requiresEscalation: requiresEsc,
      status: requiresEsc ? "escalated" : "pending",
      approvedBy: null,
      draft: draftAmendment(missing, jurisdiction, criticality as Criticality, members.length),
    });
  }
  // Biggest exposure first — that's where a programme lead's attention goes.
  return cohorts.sort((a, b) => b.exposureGBP - a.exposureGBP);
}

function dominantJurisdiction(members: Contract[]): Jurisdiction {
  const counts = new Map<Jurisdiction, number>();
  for (const c of members) counts.set(c.jurisdiction, (counts.get(c.jurisdiction) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Mock "LLM" amendment drafter — deterministic templated language so the demo
// runs with zero API keys (RuleLift's offline trick). llm.ts can swap this for
// real Claude drafting when ANTHROPIC_API_KEY is present.
export function draftAmendment(
  missing: ClauseId[],
  jurisdiction: Jurisdiction,
  criticality: Criticality,
  count: number,
): string {
  const bullets = missing
    .map((id) => {
      const cl = CLAUSES.find((x) => x.id === id)!;
      return `• Insert new clause satisfying ${cl.ref} — ${cl.title}: ${cl.summary}`;
    })
    .join("\n");
  return (
    `Amendment pack for ${count} ${criticality} ${jurisdiction} contract(s), ` +
    `remediating ${missing.length} missing DORA clause(s):\n\n${bullets}\n\n` +
    `Governing-law note: apply the ${jurisdiction} playbook wording. ` +
    `Counterparties will be notified per the cohort's outreach template on approval.`
  );
}

export function computeTotals(contracts: Contract[], cohorts: Cohort[]) {
  const nonCompliant = contracts.filter(isNonCompliant);
  const criticalNonCompliant = nonCompliant.filter((c) => c.criticality === "critical");
  const exposureGBP = nonCompliant.reduce((s, c) => s + c.annualValueGBP, 0);
  return {
    contracts: contracts.length,
    nonCompliant: nonCompliant.length,
    criticalNonCompliant: criticalNonCompliant.length,
    exposureGBP,
    cohorts: cohorts.length,
  };
}
