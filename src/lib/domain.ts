// Domain types for RegProof — regulatory-change remediation copilot.
// The vocabulary here is deliberately close to how a bank's DORA programme
// would actually talk: contracts, mandatory clauses, cohorts, escalation, audit.

export type ClauseId = "C1" | "C2" | "C3" | "C4";

export interface MandatoryClause {
  id: ClauseId;
  ref: string; // statutory reference
  title: string;
  summary: string;
}

export type Criticality = "critical" | "important" | "support";
export type Jurisdiction = "EU" | "UK" | "US" | "APAC";

export interface Contract {
  id: string;
  supplier: string;
  service: string;
  criticality: Criticality;
  jurisdiction: Jurisdiction;
  governingLaw: Jurisdiction; // the law the contract is written under
  annualValueGBP: number;
  signed: string; // ISO date
  clausesPresent: ClauseId[];
}

// A cohort is a group of contracts that share the SAME remediation shape:
// same set of missing clauses × same jurisdiction × same criticality.
// Grouping is an exact deterministic group-by — no embeddings, fully explainable.
export type CohortStatus = "pending" | "approved" | "escalated";

export interface Cohort {
  id: string;
  missing: ClauseId[];
  jurisdiction: Jurisdiction;
  criticality: Criticality;
  contractIds: string[];
  exposureGBP: number;
  requiresEscalation: boolean; // governing law != playbook reference => forced human review
  status: CohortStatus;
  approvedBy: string | null;
  draft: string; // proposed amendment language (mock LLM or Claude)
}

export interface AuditEvent {
  ts: string;
  actor: string; // "agent" or a human name
  action: string;
  cohortId?: string;
  justification: string;
}

export interface ScanResult {
  regulation: { code: string; title: string; inForce: string };
  clauses: MandatoryClause[];
  totals: {
    contracts: number;
    nonCompliant: number;
    criticalNonCompliant: number;
    exposureGBP: number;
    cohorts: number;
  };
  contracts: Contract[];
  cohorts: Cohort[];
}
