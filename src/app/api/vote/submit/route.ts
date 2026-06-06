import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyVoteToken, TOKEN_MIN_AGE_MS, TOKEN_MAX_AGE_MS } from "@/lib/vote-token";

export const runtime = "nodejs";

const MAX_PLAYERS = 15;
const RATE_LIMIT_MS = 30_000; // 30s cooldown per IP

export async function POST(req: NextRequest) {
  try {
    // Identify client IP
    const ip = (
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown"
    ).replace(/\//g, "_");

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { firstName, lastName, phone, email, role, menPlayers, womenPlayers, token } = body;

    // ── Timing token validation ──────────────────────────────────────────────
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Session token missing. Please refresh the page and try again." },
        { status: 400 }
      );
    }
    const tokenPayload = verifyVoteToken(token);
    if (!tokenPayload) {
      return NextResponse.json(
        { error: "Invalid session token. Please refresh the page." },
        { status: 400 }
      );
    }
    const tokenAge = Date.now() - tokenPayload.ts;
    if (tokenAge < TOKEN_MIN_AGE_MS) {
      return NextResponse.json(
        { error: "Please take more time to review your selections before submitting." },
        { status: 400 }
      );
    }
    if (tokenAge > TOKEN_MAX_AGE_MS) {
      return NextResponse.json(
        { error: "Your session has expired. Please refresh the page and try again." },
        { status: 400 }
      );
    }

    // ── Identity validation ──────────────────────────────────────────────────
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }
    if (!role || !["joueur", "staff", "fan"].includes(role)) {
      return NextResponse.json({ error: "Valid role is required" }, { status: 400 });
    }
    const docId = String(phone || "").replace(/\D/g, "");
    if (docId.length < 9) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    // ── Player count validation ──────────────────────────────────────────────
    if (!Array.isArray(menPlayers) || menPlayers.length !== MAX_PLAYERS) {
      return NextResponse.json(
        { error: `Must select exactly ${MAX_PLAYERS} men (got ${Array.isArray(menPlayers) ? menPlayers.length : 0})` },
        { status: 400 }
      );
    }
    if (!Array.isArray(womenPlayers) || womenPlayers.length !== MAX_PLAYERS) {
      return NextResponse.json(
        { error: `Must select exactly ${MAX_PLAYERS} women (got ${Array.isArray(womenPlayers) ? womenPlayers.length : 0})` },
        { status: 400 }
      );
    }
    const allIds = [...menPlayers, ...womenPlayers];
    if (allIds.some((id) => typeof id !== "string" || !id.trim())) {
      return NextResponse.json({ error: "Invalid player selection" }, { status: 400 });
    }

    const db = getAdminFirestore();

    // ── Parallel checks: rate limit + token already used ────────────────────
    const rateLimitRef = db.collection("allStarRateLimits").doc(ip);
    const usedTokenRef = db.collection("allStarUsedTokens").doc(tokenPayload.jti);

    const [rateLimitSnap, usedTokenSnap] = await Promise.all([
      rateLimitRef.get(),
      usedTokenRef.get(),
    ]);

    if (rateLimitSnap.exists) {
      const last: number = rateLimitSnap.data()?.lastVote?.toMillis?.() ?? 0;
      if (Date.now() - last < RATE_LIMIT_MS) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment before trying again." },
          { status: 429 }
        );
      }
    }

    if (usedTokenSnap.exists) {
      return NextResponse.json(
        { error: "This session has already been used. Please refresh the page to vote again." },
        { status: 400 }
      );
    }

    // ── Duplicate vote check ─────────────────────────────────────────────────
    const voteRef = db.collection("allStarVotes").doc(docId);
    const existing = await voteRef.get();
    if (existing.exists) {
      return NextResponse.json({ error: "already_voted" }, { status: 409 });
    }

    // ── Eligibility check ────────────────────────────────────────────────────
    const eligSnap = await db.collection("settings").doc("allStarEligibility").get();
    const eligData = eligSnap.exists
      ? ((eligSnap.data()?.teams as Record<string, string[]>) ?? {})
      : {};
    const eligibleSet = new Set(Object.values(eligData).flat());

    if (eligibleSet.size > 0) {
      const badMen   = menPlayers.filter((id: string) => !eligibleSet.has(id));
      const badWomen = womenPlayers.filter((id: string) => !eligibleSet.has(id));
      if (badMen.length > 0 || badWomen.length > 0) {
        return NextResponse.json(
          { error: "One or more selected players are not eligible" },
          { status: 400 }
        );
      }
    }

    // ── Voting enabled check ─────────────────────────────────────────────────
    const settingsSnap = await db.collection("settings").doc("allStar").get();
    if (settingsSnap.exists && settingsSnap.data()?.enabled === false) {
      return NextResponse.json({ error: "Voting is currently closed" }, { status: 403 });
    }

    // ── Write vote ───────────────────────────────────────────────────────────
    await voteRef.set({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      phone:     `+${docId}`,
      email:     email?.trim() || null,
      role,
      menPlayers,
      womenPlayers,
      submittedAt:  FieldValue.serverTimestamp(),
      lastModified: FieldValue.serverTimestamp(),
    });

    // Mark token as used + update rate limit (parallel, non-blocking on failure)
    await Promise.all([
      usedTokenRef.set({ usedAt: FieldValue.serverTimestamp(), phone: docId }),
      rateLimitRef.set({ lastVote: FieldValue.serverTimestamp() }, { merge: true }),
    ]);

    // ── Update public vote-count aggregates ──────────────────────────────────
    const menInc   = Object.fromEntries(menPlayers.map((id: string)   => [id, FieldValue.increment(1)]));
    const womenInc = Object.fromEntries(womenPlayers.map((id: string) => [id, FieldValue.increment(1)]));
    await Promise.all([
      db.collection("allStarVoteResults").doc("menPlayers").set(menInc, { merge: true }),
      db.collection("allStarVoteResults").doc("womenPlayers").set(womenInc, { merge: true }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Vote submit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
