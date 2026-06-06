import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyVoteToken, TOKEN_MIN_AGE_MS, TOKEN_MAX_AGE_MS } from "@/lib/vote-token";

export const runtime = "nodejs";

const MAX_PLAYERS = 15;
const RATE_LIMIT_MS = 30_000;

function logSuspect(
  ip: string,
  req: NextRequest,
  reason: string,
  extra: Record<string, unknown> = {}
) {
  try {
    const db = getAdminFirestore();
    const rawCity = req.headers.get("x-vercel-ip-city");
    void db.collection("allStarSuspectAttempts").add({
      ip,
      country:   req.headers.get("x-vercel-ip-country") ?? null,
      city:      rawCity ? (() => { try { return decodeURIComponent(rawCity); } catch { return rawCity; } })() : null,
      region:    req.headers.get("x-vercel-ip-region") ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
      language:  req.headers.get("accept-language") ?? null,
      reason,
      ...extra,
      detectedAt: FieldValue.serverTimestamp(),
      seen: false,
    });
  } catch { /* never block the response */ }
}

export async function POST(req: NextRequest) {
  try {
    const ip = (
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown"
    ).replace(/\//g, "_");

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { firstName, lastName, phone, email, role, menPlayers, womenPlayers, token } = body;

    const safePhone = String(phone || "").replace(/\D/g, "").slice(0, 15) || null;
    const safeMen   = Array.isArray(menPlayers)   ? (menPlayers   as string[]).slice(0, 15) : null;
    const safeWomen = Array.isArray(womenPlayers) ? (womenPlayers as string[]).slice(0, 15) : null;
    const safeName  = `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim() || null;

    // ── Timing token validation ──────────────────────────────────────────────
    if (!token || typeof token !== "string") {
      logSuspect(ip, req, "TOKEN_MISSING", {
        phone: safePhone,
        name: safeName,
        menCount:    safeMen   ? safeMen.length   : null,
        womenCount:  safeWomen ? safeWomen.length : null,
        menPlayers:  safeMen,
        womenPlayers: safeWomen,
      });
      return NextResponse.json(
        { error: "Session token missing. Please refresh the page and try again." },
        { status: 400 }
      );
    }

    const tokenPayload = verifyVoteToken(token);
    if (!tokenPayload) {
      logSuspect(ip, req, "TOKEN_INVALID", {
        phone: safePhone,
        name: safeName,
        tokenPrefix: token.slice(0, 24),
        menPlayers:  safeMen,
        womenPlayers: safeWomen,
      });
      return NextResponse.json(
        { error: "Invalid session token. Please refresh the page." },
        { status: 400 }
      );
    }

    const tokenAge = Date.now() - tokenPayload.ts;
    if (tokenAge < TOKEN_MIN_AGE_MS) {
      logSuspect(ip, req, "TOKEN_TOO_YOUNG", {
        ageMs: tokenAge,
        phone: safePhone,
        name: safeName,
        menCount:    safeMen   ? safeMen.length   : null,
        womenCount:  safeWomen ? safeWomen.length : null,
        menPlayers:  safeMen,
        womenPlayers: safeWomen,
      });
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
    const menCount   = Array.isArray(menPlayers)   ? menPlayers.length   : -1;
    const womenCount = Array.isArray(womenPlayers) ? womenPlayers.length : -1;

    if (menCount !== MAX_PLAYERS || womenCount !== MAX_PLAYERS) {
      logSuspect(ip, req, "PLAYER_COUNT", {
        phone: docId || null,
        name: safeName,
        menCount,
        womenCount,
        menPlayers:  safeMen,
        womenPlayers: safeWomen,
      });
      return NextResponse.json(
        { error: `Must select exactly ${MAX_PLAYERS} men and ${MAX_PLAYERS} women` },
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
        logSuspect(ip, req, "RATE_LIMITED", {
          phone: docId || null,
          name: safeName,
          cooldownMs: RATE_LIMIT_MS - (Date.now() - last),
          menPlayers:  safeMen,
          womenPlayers: safeWomen,
        });
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment before trying again." },
          { status: 429 }
        );
      }
    }

    if (usedTokenSnap.exists) {
      logSuspect(ip, req, "TOKEN_REPLAY", {
        jti: tokenPayload.jti,
        phone: docId || null,
        name: safeName,
        menPlayers:  safeMen,
        womenPlayers: safeWomen,
      });
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

    await Promise.all([
      usedTokenRef.set({ usedAt: FieldValue.serverTimestamp(), phone: docId }),
      rateLimitRef.set({ lastVote: FieldValue.serverTimestamp() }, { merge: true }),
    ]);

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
