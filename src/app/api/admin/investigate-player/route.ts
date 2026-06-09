import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import type { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getAdminAuth().verifyIdToken(authHeader.slice(7));

    const name = req.nextUrl.searchParams.get("name")?.toLowerCase().trim() ?? "";
    if (!name) return NextResponse.json({ error: "?name= required" }, { status: 400 });

    const db = getAdminFirestore();

    // ── 1. Find matching player IDs across all rosters ─────────────────────
    const teamsSnap = await db.collection("teams").get();
    const matchedPlayers: { id: string; name: string; teamName: string }[] = [];

    await Promise.all(
      teamsSnap.docs.map(async (teamDoc) => {
        const td = teamDoc.data();
        const teamName = [td.city, td.name].filter(Boolean).join(" ");
        const rosterSnap = await db.collection("teams").doc(teamDoc.id).collection("roster").get();
        for (const p of rosterSnap.docs) {
          const pd = p.data();
          const fullName = `${pd.firstName || ""} ${pd.lastName || ""}`.trim().toLowerCase();
          if (fullName.includes(name) || name.includes(fullName.split(" ")[0])) {
            matchedPlayers.push({ id: p.id, name: fullName, teamName });
          }
        }
      })
    );

    if (matchedPlayers.length === 0) {
      return NextResponse.json({ error: "Player not found", searched: name });
    }

    const targetIds = new Set(matchedPlayers.map((p) => p.id));

    // ── 2. Scan all votes for any that include these player IDs ────────────
    const votesSnap = await db.collection("allStarVotes").get();

    type VoteRecord = {
      voteId: string;
      voterName: string;
      phone: string;
      role: string;
      submittedAt: Date | null;
      tsMs: number;
      menPlayers: string[];
      womenPlayers: string[];
      category: "men" | "women";
    };

    const matchingVotes: VoteRecord[] = [];

    for (const d of votesSnap.docs) {
      const data = d.data();
      const men:   string[] = data.menPlayers   || [];
      const women: string[] = data.womenPlayers || [];
      const foundInMen   = men.some((id)   => targetIds.has(id));
      const foundInWomen = women.some((id) => targetIds.has(id));
      if (!foundInMen && !foundInWomen) continue;

      const tsMs = (data.submittedAt as Timestamp | undefined)?.toMillis?.()
                ?? (data.lastModified as Timestamp | undefined)?.toMillis?.()
                ?? 0;

      matchingVotes.push({
        voteId:      d.id,
        voterName:   `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Unknown",
        phone:       data.phone || d.id,
        role:        data.role  || "—",
        submittedAt: tsMs ? new Date(tsMs) : null,
        tsMs,
        menPlayers:   men,
        womenPlayers: women,
        category:    foundInMen ? "men" : "women",
      });
    }

    matchingVotes.sort((a, b) => a.tsMs - b.tsMs);

    // ── 3. Burst analysis ─────────────────────────────────────────────────
    const BURST_WINDOW_MS = 60_000; // 1 minute
    let maxBurst = 0;
    let maxBurstWindow = { start: 0, end: 0 };

    for (let i = 0; i < matchingVotes.length; i++) {
      let count = 1;
      for (let j = i + 1; j < matchingVotes.length; j++) {
        if (matchingVotes[j].tsMs - matchingVotes[i].tsMs <= BURST_WINDOW_MS) count++;
        else break;
      }
      if (count > maxBurst) {
        maxBurst = count;
        maxBurstWindow = { start: matchingVotes[i].tsMs, end: matchingVotes[Math.min(i + count - 1, matchingVotes.length - 1)].tsMs };
      }
    }

    // ── 4. Phone pattern analysis ─────────────────────────────────────────
    const phoneDigits = matchingVotes
      .map((v) => v.phone.replace(/\D/g, ""))
      .filter(Boolean)
      .sort();

    let sequentialRuns = 0;
    for (let i = 1; i < phoneDigits.length; i++) {
      const diff = parseInt(phoneDigits[i]) - parseInt(phoneDigits[i - 1]);
      if (diff >= 1 && diff <= 5) sequentialRuns++;
    }
    const sequentialPct = phoneDigits.length > 1
      ? Math.round((sequentialRuns / (phoneDigits.length - 1)) * 100)
      : 0;

    // ── 5. Role breakdown ─────────────────────────────────────────────────
    const roles: Record<string, number> = {};
    for (const v of matchingVotes) roles[v.role] = (roles[v.role] || 0) + 1;

    // ── 6. Player selection fingerprint (clone detection) ─────────────────
    const fpCounts = new Map<string, number>();
    for (const v of matchingVotes) {
      const fp = [...v.menPlayers].sort().join(",") + "§" + [...v.womenPlayers].sort().join(",");
      fpCounts.set(fp, (fpCounts.get(fp) || 0) + 1);
    }
    const topFp = [...fpCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const cloneRatio = topFp ? Math.round((topFp[1] / matchingVotes.length) * 100) : 0;

    // ── 7. Time distribution (votes per hour) ────────────────────────────
    const byHour: Record<string, number> = {};
    for (const v of matchingVotes) {
      if (!v.submittedAt) continue;
      const key = `${v.submittedAt.toISOString().slice(0, 13)}h`;
      byHour[key] = (byHour[key] || 0) + 1;
    }

    // ── 8. Suspect log cross-reference ────────────────────────────────────
    const suspectSnap = await db.collection("allStarSuspectAttempts")
      .orderBy("detectedAt", "desc")
      .limit(500)
      .get();

    const relevantSuspects = suspectSnap.docs
      .map((d) => {
        const data = d.data();
        const men:   string[] = data.menPlayers   || [];
        const women: string[] = data.womenPlayers || [];
        const mentions = [...men, ...women].some((id) => targetIds.has(id));
        if (!mentions) return null;
        return {
          ip:        data.ip,
          reason:    data.reason,
          name:      data.name,
          phone:     data.phone,
          detectedAt: (data.detectedAt as Timestamp | undefined)?.toMillis?.() ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // ── 9. Find votes where target player appears more than once ─────────────
    const dupVotes = matchingVotes.filter((v) => {
      const allPlayerIds = [...v.menPlayers, ...v.womenPlayers];
      const targetCount = allPlayerIds.filter((id) => targetIds.has(id)).length;
      return targetCount > 1;
    });

    return NextResponse.json({
      players: matchedPlayers,
      totalVotes:         matchingVotes.length,
      firstVote:          matchingVotes[0]?.submittedAt ?? null,
      lastVote:           matchingVotes[matchingVotes.length - 1]?.submittedAt ?? null,
      maxBurstPerMinute:  maxBurst,
      maxBurstWindow:     maxBurst > 1 ? {
        from:    new Date(maxBurstWindow.start),
        to:      new Date(maxBurstWindow.end),
        seconds: Math.round((maxBurstWindow.end - maxBurstWindow.start) / 1000),
      } : null,
      phoneSequentialPct: sequentialPct,
      roles,
      cloneRatio,
      topCloneCount:      topFp?.[1] ?? 0,
      votesByHour:        byHour,
      suspectAttempts:    relevantSuspects.length,
      suspectDetails:     relevantSuspects.slice(0, 20),
      dupVoteCount:       dupVotes.length,
      dupVoteIds:         dupVotes.map((v) => v.voteId),
      recentVotes:        matchingVotes.slice(-30).map((v) => ({
        phone:       v.phone,
        name:        v.voterName,
        role:        v.role,
        submittedAt: v.submittedAt,
        hasDupPlayer: dupVotes.some((d) => d.voteId === v.voteId),
      })),
    });
  } catch (err) {
    console.error("Investigation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST — delete dup-player votes for a specific player, recompute totals ─
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getAdminAuth().verifyIdToken(authHeader.slice(7));

    const body = await req.json().catch(() => ({})) as { name?: string };
    const name = (body.name ?? "").toLowerCase().trim();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const db = getAdminFirestore();

    // 1. Resolve player IDs
    const teamsSnap = await db.collection("teams").get();
    const targetIds = new Set<string>();

    await Promise.all(
      teamsSnap.docs.map(async (teamDoc) => {
        const rosterSnap = await db.collection("teams").doc(teamDoc.id).collection("roster").get();
        for (const p of rosterSnap.docs) {
          const pd = p.data();
          const fullName = `${pd.firstName || ""} ${pd.lastName || ""}`.trim().toLowerCase();
          if (fullName.includes(name) || name.includes(fullName.split(" ")[0])) {
            targetIds.add(p.id);
          }
        }
      })
    );

    if (targetIds.size === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // 2. Find all votes that have this player duplicated
    const votesSnap = await db.collection("allStarVotes").get();
    const toDeleteIds: string[] = [];

    for (const d of votesSnap.docs) {
      const data = d.data();
      const men:   string[] = data.menPlayers   || [];
      const women: string[] = data.womenPlayers || [];
      const targetCount = [...men, ...women].filter((id) => targetIds.has(id)).length;
      if (targetCount > 1) toDeleteIds.push(d.id);
    }

    // 3. Batch delete
    for (let i = 0; i < toDeleteIds.length; i += 500) {
      const batch = db.batch();
      toDeleteIds.slice(i, i + 500).forEach((id) => {
        batch.delete(db.collection("allStarVotes").doc(id));
      });
      await batch.commit();
    }

    // 4. Recompute aggregates from remaining votes
    const cleanMen:   Record<string, number> = {};
    const cleanWomen: Record<string, number> = {};
    let remaining = 0;

    const deletedSet = new Set(toDeleteIds);
    for (const d of votesSnap.docs) {
      if (deletedSet.has(d.id)) continue;
      const data = d.data();
      const men:   string[] = data.menPlayers   || [];
      const women: string[] = data.womenPlayers || [];
      remaining++;
      for (const id of men)   cleanMen[id]   = (cleanMen[id]   || 0) + 1;
      for (const id of women) cleanWomen[id] = (cleanWomen[id] || 0) + 1;
    }

    await Promise.all([
      db.collection("allStarVoteResults").doc("menPlayers").set(cleanMen),
      db.collection("allStarVoteResults").doc("womenPlayers").set(cleanWomen),
    ]);

    return NextResponse.json({ deleted: toDeleteIds.length, remaining });
  } catch (err) {
    console.error("Investigation delete error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
