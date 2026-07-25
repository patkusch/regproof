import { NextRequest, NextResponse } from "next/server";
import { approveCohort, ApprovalError } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { cohortId, approver } = await req.json();
    const cohort = approveCohort(String(cohortId), String(approver ?? ""));
    return NextResponse.json({ ok: true, cohort });
  } catch (e) {
    if (e instanceof ApprovalError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
