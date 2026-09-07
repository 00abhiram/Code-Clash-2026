import { NextResponse } from "next/server";

// This route is intentionally disabled.
// All submissions must go through POST /api/submissions/evaluate
// which performs server-side grading, ownership verification,
// and idempotency checks.
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is disabled. Use /api/submissions/evaluate." },
    { status: 410 }
  );
}
