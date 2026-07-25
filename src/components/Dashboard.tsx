"use client";

import { useEffect, useState, useCallback } from "react";
import type { AuditEvent, Cohort, ScanResult } from "@/lib/domain";
import { gbp, gbpCompact } from "@/lib/format";

type Tab = "cohorts" | "portfolio" | "audit";

const CRIT_COLOR: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  important: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  support: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

export default function Dashboard() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [tab, setTab] = useState<Tab>("cohorts");
  const [approver, setApprover] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [s, a] = await Promise.all([
      fetch("/api/scan").then((r) => r.json()),
      fetch("/api/audit").then((r) => r.json()),
    ]);
    setScan(s);
    setAudit(a);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const approve = async (cohortId: string) => {
    setError(null);
    const res = await fetch("/api/cohorts/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohortId, approver }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error);
      return;
    }
    await refresh();
  };

  const reset = async () => {
    await fetch("/api/reset", { method: "POST" });
    setError(null);
    await refresh();
  };

  if (!scan) {
    return <div className="p-10 text-slate-400">Scanning portfolio…</div>;
  }

  const t = scan.totals;
  const approvedCount = scan.cohorts.filter((c) => c.status === "approved").length;
  const remediatedExposure = scan.cohorts
    .filter((c) => c.status === "approved")
    .reduce((s, c) => s + c.exposureGBP, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">RegProof</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
              copilot
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            The agent maps, groups, drafts and tracks. <span className="text-slate-200">A human approves every cohort.</span>{" "}
            Every action is proven deterministically and audited.
          </p>
        </div>
        <div className="text-right">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Regulation</div>
            <div className="font-mono text-sm text-slate-200">{scan.regulation.code}</div>
            <div className="text-xs text-slate-500">in force {scan.regulation.inForce}</div>
          </div>
        </div>
      </header>

      {/* Hero exposure */}
      <section className="mt-8 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-rose-900/40 bg-gradient-to-br from-rose-950/40 to-slate-900/40 p-6">
          <div className="text-xs uppercase tracking-wide text-rose-300/80">Contract value under non-compliant critical &amp; important functions</div>
          <div className="mt-2 font-mono text-5xl font-bold text-rose-200">{gbp(t.exposureGBP)}</div>
          <div className="mt-2 text-sm text-slate-400">
            across <span className="text-slate-200">{t.nonCompliant}</span> in-scope contracts —{" "}
            <span className="text-slate-200">{t.criticalNonCompliant}</span> of them critical. Nobody flagged these by hand; the scan found them.
          </div>
          {approvedCount > 0 && (
            <div className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/20">
              {gbpCompact(remediatedExposure)} across {approvedCount} cohort(s) now human-approved and moving to outreach.
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Contracts scanned" value={String(t.contracts)} />
          <Stat label="Cohorts built" value={String(t.cohorts)} />
          <Stat label="Non-compliant" value={String(t.nonCompliant)} tone="amber" />
          <Stat label="Critical gaps" value={String(t.criticalNonCompliant)} tone="rose" />
        </div>
      </section>

      {/* Proof strip — why you can trust this */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Proof title="Deterministic gap detection" body="Clause present/absent is a checked fact, not an LLM opinion. Re-runnable, identical every time." />
        <Proof title="Exact group-by clustering" body="Cohorts are an exact group-by on missing-clauses × criticality. No embeddings, fully explainable and reproducible." />
        <Proof title="Human gate + immutable audit" body="No outreach without a named approver. Cross-border cases are force-escalated. Every action is logged append-only." />
      </section>

      {/* Tabs */}
      <nav className="mt-8 flex gap-1 border-b border-slate-800">
        {(["cohorts", "portfolio", "audit"] as Tab[]).map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              tab === x
                ? "border-emerald-400 text-emerald-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {x}
            {x === "audit" ? ` (${audit.length})` : ""}
          </button>
        ))}
        <button
          onClick={reset}
          className="ml-auto self-center rounded-md px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-700 hover:text-slate-200 hover:ring-slate-500"
        >
          Reset demo
        </button>
      </nav>

      {error && (
        <div className="mt-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </div>
      )}

      {tab === "cohorts" && (
        <CohortsTab scan={scan} approver={approver} setApprover={setApprover} approve={approve} />
      )}
      {tab === "portfolio" && <PortfolioTab scan={scan} />}
      {tab === "audit" && <AuditTab audit={audit} />}

      <footer className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-600">
        RegProof — hackathon build. Synthetic portfolio, illustrative figures. Control beats autonomy.
      </footer>
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "amber" | "rose" }) {
  const color = tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-slate-100";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className={`font-mono text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Proof({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
        <span className="text-emerald-400">✓</span>
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

function ClauseChip({ id }: { id: string }) {
  return (
    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">{id}</span>
  );
}

function CohortsTab({
  scan,
  approver,
  setApprover,
  approve,
}: {
  scan: ScanResult;
  approver: string;
  setApprover: (v: string) => void;
  approve: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <label className="text-sm text-slate-400">Approver</label>
        <input
          value={approver}
          onChange={(e) => setApprover(e.target.value)}
          placeholder="Your name (required to approve)"
          className="min-w-56 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
        />
        <span className="text-xs text-slate-500">The agent can never approve — only a named human can.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {scan.cohorts.map((c) => (
          <CohortCard
            key={c.id}
            cohort={c}
            expanded={open === c.id}
            toggle={() => setOpen(open === c.id ? null : c.id)}
            onApprove={() => approve(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CohortCard({
  cohort,
  expanded,
  toggle,
  onApprove,
}: {
  cohort: Cohort;
  expanded: boolean;
  toggle: () => void;
  onApprove: () => void;
}) {
  const approved = cohort.status === "approved";
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        approved
          ? "border-emerald-800/50 bg-emerald-950/20"
          : cohort.requiresEscalation
          ? "border-rose-900/50 bg-rose-950/10"
          : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-300">{cohort.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${CRIT_COLOR[cohort.criticality]}`}>
              {cohort.criticality}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{cohort.jurisdiction}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            missing
            {cohort.missing.map((m) => (
              <ClauseChip key={m} id={m} />
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-slate-100">{gbp(cohort.exposureGBP)}</div>
          <div className="text-xs text-slate-500">{cohort.contractIds.length} contracts</div>
        </div>
      </div>

      {cohort.requiresEscalation && !approved && (
        <div className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/25">
          ⚠ Cross-border governing law — forced escalation. No auto-resolution path; a human legal owner must sign off.
        </div>
      )}

      <button onClick={toggle} className="mt-3 text-xs text-emerald-400 hover:text-emerald-300">
        {expanded ? "Hide" : "View"} proposed amendment
      </button>
      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-300 ring-1 ring-slate-800">
          {cohort.draft}
        </pre>
      )}

      <div className="mt-4 flex items-center justify-between">
        {approved ? (
          <span className="text-sm text-emerald-300">✓ Approved by {cohort.approvedBy}</span>
        ) : (
          <span className="text-sm text-slate-500">
            {cohort.requiresEscalation ? "Awaiting legal sign-off" : "Awaiting approval"}
          </span>
        )}
        <button
          onClick={onApprove}
          disabled={approved}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            approved
              ? "cursor-default bg-emerald-900/30 text-emerald-500"
              : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          }`}
        >
          {approved ? "Approved" : cohort.requiresEscalation ? "Resolve & approve" : "Approve outreach"}
        </button>
      </div>
    </div>
  );
}

function PortfolioTab({ scan }: { scan: ScanResult }) {
  const missingFor = (id: string) => {
    const c = scan.contracts.find((x) => x.id === id)!;
    return (["C1", "C2", "C3", "C4"] as const).filter((m) => !c.clausesPresent.includes(m));
  };
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Contract</th>
            <th className="px-4 py-3">Supplier / service</th>
            <th className="px-4 py-3">Criticality</th>
            <th className="px-4 py-3">Law</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Gaps</th>
          </tr>
        </thead>
        <tbody>
          {scan.contracts.map((c) => {
            const gaps = c.criticality === "support" ? [] : missingFor(c.id);
            const cross = c.governingLaw !== c.jurisdiction;
            return (
              <tr key={c.id} className="border-t border-slate-800/70 hover:bg-slate-900/40">
                <td className="px-4 py-2 font-mono text-xs text-slate-400">{c.id}</td>
                <td className="px-4 py-2">
                  <div className="text-slate-200">{c.supplier}</div>
                  <div className="text-xs text-slate-500">{c.service}</div>
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${CRIT_COLOR[c.criticality]}`}>{c.criticality}</span>
                </td>
                <td className="px-4 py-2 text-xs text-slate-400">
                  {c.jurisdiction}
                  {cross && <span className="ml-1 text-rose-400">/{c.governingLaw}</span>}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-300">{gbpCompact(c.annualValueGBP)}</td>
                <td className="px-4 py-2">
                  {gaps.length === 0 ? (
                    <span className="text-xs text-emerald-400">compliant</span>
                  ) : (
                    <span className="flex gap-1">
                      {gaps.map((g) => (
                        <ClauseChip key={g} id={g} />
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab({ audit }: { audit: AuditEvent[] }) {
  return (
    <div className="mt-6 space-y-2">
      {audit.map((e, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-emerald-300">{e.action}</span>
              {e.cohortId && <span className="font-mono text-xs text-slate-500">{e.cohortId}</span>}
              <span className="ml-auto font-mono text-[11px] text-slate-600">{e.ts.replace("T", " ").slice(0, 19)}</span>
            </div>
            <div className="mt-1 text-sm text-slate-300">{e.justification}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              actor: <span className={e.actor === "agent" ? "text-sky-300" : "text-amber-300"}>{e.actor}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
