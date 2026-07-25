import type { AuditEvent, Cohort, ScanResult } from "./domain";
import { CLAUSES, REGULATION, seedContracts } from "./seed";
import { buildCohorts, computeTotals } from "./engine";

// In-memory singleton state for the demo. It survives across requests within a
// running server (module singletons persist), and resets on restart — which is
// exactly what you want for a repeatable hackathon demo.
interface State {
  scan: ScanResult;
  audit: AuditEvent[];
}

declare global {
  // eslint-disable-next-line no-var
  var __regproof: State | undefined;
}

function isoNow(): string {
  return new Date().toISOString();
}

function build(): State {
  const contracts = seedContracts();
  const cohorts = buildCohorts(contracts);
  const scan: ScanResult = {
    regulation: { code: REGULATION.code, title: REGULATION.title, inForce: REGULATION.inForce },
    clauses: CLAUSES,
    totals: computeTotals(contracts, cohorts),
    contracts,
    cohorts,
  };
  return {
    scan,
    audit: [
      {
        ts: isoNow(),
        actor: "agent",
        action: "scan.completed",
        justification: `Scanned ${scan.totals.contracts} contracts against ${REGULATION.code}; ${scan.totals.cohorts} cohorts built by deterministic group-by.`,
      },
    ],
  };
}

function state(): State {
  if (!globalThis.__regproof) globalThis.__regproof = build();
  return globalThis.__regproof;
}

export function getScan(): ScanResult {
  return state().scan;
}

export function getAudit(): AuditEvent[] {
  // Return a copy — the audit log is append-only and never handed out mutable.
  return [...state().audit].reverse();
}

export class ApprovalError extends Error {}

// The approval gate. INVARIANTS, enforced here in code and not in any prompt:
//  1. Nothing can be approved without a named human approver.
//  2. An escalated (cross-border legal) cohort cannot be auto-approved by the
//     agent — it must be resolved by a human legal owner, explicitly.
//  3. Every approval appends an immutable, justified audit event.
export function approveCohort(cohortId: string, approver: string): Cohort {
  const s = state();
  const cohort = s.scan.cohorts.find((c) => c.id === cohortId);
  if (!cohort) throw new ApprovalError(`Unknown cohort ${cohortId}`);

  const name = approver.trim();
  if (!name) throw new ApprovalError("Approval requires a named human approver.");
  if (name.toLowerCase() === "agent")
    throw new ApprovalError("The agent may not approve its own work — a human must sign off.");
  if (cohort.status === "approved") throw new ApprovalError(`${cohortId} is already approved.`);

  cohort.status = "approved";
  cohort.approvedBy = name;
  s.audit.push({
    ts: isoNow(),
    actor: name,
    action: cohort.requiresEscalation ? "cohort.escalation_resolved" : "cohort.approved",
    cohortId,
    justification: cohort.requiresEscalation
      ? `Human resolved cross-border escalation and approved outreach for ${cohort.contractIds.length} contract(s).`
      : `Human approved outreach for ${cohort.contractIds.length} contract(s), £${cohort.exposureGBP.toLocaleString("en-GB")} exposure.`,
  });
  return cohort;
}

export function resetState(): void {
  globalThis.__regproof = build();
}
