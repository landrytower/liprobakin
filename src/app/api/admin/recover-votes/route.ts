import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
// Give this plenty of time — it scans large collections
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getAdminAuth().verifyIdToken(authHeader.slice(7));

    const body = await req.json().catch(() => ({})) as { minutesAgo?: number };
    // How far back to look — default 45 min (well within the 60-min retention window)
    const minutesAgo = Math.min(Math.max(body.minutesAgo ?? 45, 5), 59);
    const readTime = Timestamp.fromMillis(Date.now() - minutesAgo * 60_000);

    const db = getAdminFirestore();

    // ── Step 1: find every phone that ever submitted a vote ──────────────────
    // allStarUsedTokens is keyed by JTI but stores { phone, usedAt }
    const tokensSnap = await db.collection("allStarUsedTokens").get();
    const votedPhones = new Set<string>();
    for (const d of tokensSnap.docs) {
      const phone = d.data().phone as string | undefined;
      if (phone) votedPhones.add(phone);
    }

    // ── Step 2: find which of those phones no longer have a vote doc ─────────
    const currentSnap = await db.collection("allStarVotes").get();
    const existingIds = new Set(currentSnap.docs.map((d) => d.id));

    const missingPhones = [...votedPhones].filter((p) => !existingIds.has(p));

    if (missingPhones.length === 0) {
      return NextResponse.json({ recovered: 0, message: "No missing votes found — nothing to restore." });
    }

    // ── Step 3: read those deleted documents at the past timestamp ───────────
    const missingRefs = missingPhones.map((p) => db.collection("allStarVotes").doc(p));

    // getAll with readTime reads docs as they existed at that moment
    const pastSnaps = await db.getAll(...missingRefs, { readTime });

    const toRestore: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const snap of pastSnaps) {
      if (snap.exists) {
        toRestore.push({ id: snap.id, data: snap.data() as Record<string, unknown> });
      }
    }

    if (toRestore.length === 0) {
      return NextResponse.json({
        recovered: 0,
        missing: missingPhones.length,
        message: `Found ${missingPhones.length} missing vote IDs but no historical data within the ${minutesAgo}-minute window. The 1-hour retention period may have passed.`,
      });
    }

    // ── Step 4: batch-restore the recovered documents ────────────────────────
    for (let i = 0; i < toRestore.length; i += 500) {
      const batch = db.batch();
      toRestore.slice(i, i + 500).forEach(({ id, data }) => {
        batch.set(db.collection("allStarVotes").doc(id), data);
      });
      await batch.commit();
    }

    // ── Step 5: recompute aggregates from ALL votes (existing + restored) ────
    const allVotesSnap = await db.collection("allStarVotes").get();
    const cleanMen:   Record<string, number> = {};
    const cleanWomen: Record<string, number> = {};
    let total = 0;

    for (const d of allVotesSnap.docs) {
      const data = d.data();
      const men:   string[] = data.menPlayers   || [];
      const women: string[] = data.womenPlayers || [];
      if (men.length !== 15 || women.length !== 15) continue; // skip malformed
      total++;
      for (const id of men)   cleanMen[id]   = (cleanMen[id]   || 0) + 1;
      for (const id of women) cleanWomen[id] = (cleanWomen[id] || 0) + 1;
    }

    await Promise.all([
      db.collection("allStarVoteResults").doc("menPlayers").set(cleanMen),
      db.collection("allStarVoteResults").doc("womenPlayers").set(cleanWomen),
    ]);

    return NextResponse.json({
      recovered:       toRestore.length,
      totalAfter:      total,
      missingPhones:   missingPhones.length,
      restoredSample:  toRestore.slice(0, 10).map((v) => ({
        phone: v.id,
        name:  `${v.data.firstName ?? ""} ${v.data.lastName ?? ""}`.trim(),
      })),
    });
  } catch (err) {
    console.error("Recovery error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
