import { NextResponse } from "next/server";
import { createVoteToken } from "@/lib/vote-token";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ token: createVoteToken() });
}
