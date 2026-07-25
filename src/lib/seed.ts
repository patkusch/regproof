import type { Contract, ClauseId, MandatoryClause, Criticality, Jurisdiction } from "./domain";

// The four DORA contractual clauses that are mandatory for ICT third-party
// arrangements supporting critical or important functions (Art. 30).
export const REGULATION = {
  code: "DORA",
  title: "Regulation (EU) 2022/2554 — Digital Operational Resilience Act",
  inForce: "2025-01-17",
};

export const CLAUSES: MandatoryClause[] = [
  {
    id: "C1",
    ref: "Art. 30(2)(a)",
    title: "ICT incident reporting & cooperation",
    summary: "Provider must report ICT-related incidents and cooperate with the financial entity and its authorities.",
  },
  {
    id: "C2",
    ref: "Art. 30(2)(e)",
    title: "Access, inspection & audit rights",
    summary: "Unrestricted rights of access, inspection and audit for the entity and competent authorities.",
  },
  {
    id: "C3",
    ref: "Art. 30(3)(a)",
    title: "Exit strategy & termination rights",
    summary: "Documented exit plan and explicit termination rights on breach or supervisory instruction.",
  },
  {
    id: "C4",
    ref: "Art. 30(3)(b)",
    title: "Subcontracting conditions",
    summary: "Conditions and prior approval for subcontracting of critical or important functions.",
  },
];

// Deterministic PRNG (mulberry32) so the portfolio — and therefore the
// headline exposure number — is identical on every run. Trust starts with
// reproducibility: nobody can accuse the demo of cherry-picking a lucky seed.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUPPLIERS = [
  "Northwind Cloud", "Helvetia DataCentres", "Aegis Payments", "Meridian Core Banking",
  "Cirrus Analytics", "Blackwood Custody", "Sterling KYC", "Orion Messaging",
  "Pallas Cybersecurity", "Verdant Managed IT", "Halcyon Trading Tech", "Lumen Reconciliation",
  "Ferrum Settlement", "Solace Card Processing", "Kestrel Fraud Ops", "Onyx Market Data",
  "Vantage Collateral", "Brightmoor Archiving", "Sable Identity", "Thorne Middleware",
];

const SERVICES = [
  "core ledger hosting", "payment authorisation", "custody & safekeeping", "KYC/AML screening",
  "market data feed", "fraud detection", "trade settlement", "cloud infrastructure",
  "reconciliation engine", "secure messaging", "card processing", "collateral management",
];

const CRITICALITY: Criticality[] = ["critical", "important", "support"];
const JURISDICTIONS: Jurisdiction[] = ["EU", "UK", "US", "APAC"];
const ALL_CLAUSES: ClauseId[] = ["C1", "C2", "C3", "C4"];

// Realistic "gap profiles": legacy contracts predate the newer clauses, so
// they tend to miss C4 (subcontracting) and C3 (exit), then C2, then C1 for the
// truly ancient ones. Modelling gaps as a few recognisable profiles — rather
// than random noise — is what lets the engine consolidate 185 problems into a
// handful of actionable cohorts. It's also just how legacy estates actually look.
const GAP_PROFILES: ClauseId[][] = [
  [], // compliant
  ["C4"], // subcontracting only — newest requirement, most common gap
  ["C3", "C4"], // exit + subcontracting
  ["C2", "C3", "C4"], // access + exit + subcontracting
  ["C1", "C2", "C3", "C4"], // legacy — predates everything
  ["C2"], // audit rights only
];

// Pick a gap profile skewed by contract age and criticality. Older + more
// critical estates carry heavier gaps.
function pickMissing(rnd: () => number, year: number, criticality: Criticality): ClauseId[] {
  const age = 2026 - year; // 2..10
  let severity = age / 12 + (criticality === "critical" ? 0.28 : criticality === "important" ? 0.14 : -0.15);
  severity += rnd() * 0.35 - 0.1;
  if (severity < 0.22) return GAP_PROFILES[0];
  if (severity < 0.45) return rnd() < 0.75 ? GAP_PROFILES[1] : GAP_PROFILES[5];
  if (severity < 0.68) return GAP_PROFILES[2];
  if (severity < 0.86) return GAP_PROFILES[3];
  return GAP_PROFILES[4];
}

// Generate a realistic, reproducible portfolio.
export function seedContracts(count = 240): Contract[] {
  const rnd = mulberry32(20554); // seed = the regulation number, why not
  const contracts: Contract[] = [];
  for (let i = 0; i < count; i++) {
    const criticality = CRITICALITY[Math.floor(rnd() * (rnd() < 0.55 ? 2 : 3))];
    const jurisdiction = JURISDICTIONS[Math.floor(rnd() * JURISDICTIONS.length)];
    // 25% of contracts are governed by a different law than the entity's jurisdiction.
    const governingLaw =
      rnd() < 0.25 ? JURISDICTIONS[Math.floor(rnd() * JURISDICTIONS.length)] : jurisdiction;

    const year = 2016 + Math.floor(rnd() * 8);
    const missing = criticality === "support" ? [] : pickMissing(rnd, year, criticality);
    const clausesPresent = ALL_CLAUSES.filter((id) => !missing.includes(id));

    const baseValue = criticality === "critical" ? 1_800_000 : criticality === "important" ? 620_000 : 140_000;
    const annualValueGBP = Math.round((baseValue * (0.5 + rnd() * 1.5)) / 1000) * 1000;

    const month = 1 + Math.floor(rnd() * 12);
    const day = 1 + Math.floor(rnd() * 27);

    contracts.push({
      id: `CTR-${String(1000 + i)}`,
      supplier: SUPPLIERS[i % SUPPLIERS.length],
      service: SERVICES[i % SERVICES.length],
      criticality,
      jurisdiction,
      governingLaw,
      annualValueGBP,
      signed: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      clausesPresent,
    });
  }
  return contracts;
}
