<div align="center">

# RegProof

**A new regulation lands. Thousands of signed contracts are suddenly non-compliant.<br/>RegProof finds them, groups them, drafts the fix — and refuses to act without a human.**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)
![Works offline](https://img.shields.io/badge/LLM-optional%2C%20deterministic%20core-7d5a10)
![License](https://img.shields.io/badge/license-MIT-blue)

Regulatory-change remediation copilot for financial services — demoed on **DORA**.

</div>

---

## The problem

When a regulation like **DORA** (Regulation (EU) 2022/2554) enters into force, a bank has to
re-audit **thousands of already-signed supplier contracts**, work out which are missing the newly
mandatory clauses, group the work sensibly, draft amendments, write to every counterparty and
track thousands of negotiations. Today that's months of work and dozens of lawyers — and the
*volume* of it crowds out the actual legal judgement.

An LLM can read a contract in seconds. But you cannot bet a regulatory filing on an LLM's opinion,
and you cannot let an agent quietly send thousands of amendment letters on the bank's behalf.

## The answer: the agent does the volume, the human keeps the judgement

RegProof industrialises the **execution volume** around legal judgement — without ever replacing it.

- **The agent** scans the portfolio, detects clause gaps, groups contracts into remediation
  cohorts, drafts amendment language and tracks status.
- **The human** approves every cohort and resolves every escalated case. Nothing leaves the
  building without a named sign-off.

The trust doesn't come from a well-behaved prompt. It comes from **guardrails enforced in code**.

## The proof model — why you can trust it

| Guarantee | How it's enforced (in code, not in a prompt) | Where |
|---|---|---|
| **Gap detection is deterministic** — clause present/absent is a checked fact, not an LLM guess | pure set comparison, re-runnable, identical every time | [`engine.ts`](src/lib/engine.ts) `missingClauses` |
| **Cohorts are an exact group-by** on missing-clauses × criticality × cross-border — no embeddings, fully explainable | deterministic `Map` group-by over a seeded portfolio | [`engine.ts`](src/lib/engine.ts) `buildCohorts` |
| **Nothing is approved without a named human** (`approvedBy` null ⇒ nothing leaves) | approval gate rejects an empty approver | [`store.ts`](src/lib/store.ts) `approveCohort` |
| **The agent may never approve its own work** | approver `"agent"` is rejected | [`store.ts`](src/lib/store.ts) `approveCohort` |
| **Cross-border contracts are force-escalated** — genuine legal judgement, no auto path | cross-border is a grouping dimension → its own escalated cohort | [`engine.ts`](src/lib/engine.ts) `buildCohorts` |
| **Every action is an immutable, justified audit event** | audit log is append-only; the store exposes no update/delete | [`store.ts`](src/lib/store.ts) `getAudit` |

## The demo in 60 seconds

1. **Scan** — 240 synthetic supplier contracts vs DORA's 4 mandatory clauses. Headline:
   **~£288M of contract value under non-compliant critical & important functions** — found
   automatically, nobody flagged it by hand.
2. **Cohorts** — 193 problems collapse into **15 actionable cohorts**, biggest exposure first.
   8 are domestic (templatable); 7 are cross-border and **force-escalated to legal**.
3. **Approve** — type your name, approve a domestic cohort → it moves to outreach. Try approving
   as `agent`, or with no name → **blocked**. Try an escalated cohort → it demands legal sign-off.
4. **Audit** — every scan, approval and escalation is on an append-only, timestamped trail.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind 4**
- Deterministic domain core in [`src/lib`](src/lib) — no database, in-memory singleton store
- **LLM-optional**: amendment drafting ships as deterministic templates so the demo runs with
  **zero API keys**. `draftAmendment` is the single seam to swap in **Claude** (`claude-opus-4-8`)
  for richer, contract-specific language later.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

`npm test` pins the claims above: the seed is identical on every run, cohorts are
byte-identical across runs, every member of a cohort shares its remediation shape,
cross-border contracts are never grouped with domestic ones, and the approval gate
refuses a blank or `agent` approver without touching the state or the audit log.


---

<div align="center">
<sub>Hackathon build · synthetic data, illustrative figures · MIT</sub>
</div>
