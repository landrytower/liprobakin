import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import type { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

const CLONE_MIN_CLUSTER = 3;        // 3+ identical selections…
const CLONE_WINDOW_MS   = 5 * 60_000; // …within 5 minutes = bot cluster

type VoteDoc = {
  id: string;
  phone: string;
  name: string;
  men: string[];
  women: string[];
  ts: number; // submittedAt ms
};

type CloneGroup = {
  count: number;
  ids: string[];
  windowMs: number;
  sampleVotes: { id: string; name: string; phone: string }[];
  sampleMen: string[];
  sampleWomen: string[];
};

function detectClones(docs: VoteDoc[]): { cloneIds: Set<string>; groups: CloneGroup[] } {
  // Group by sorted-fingerprint so order of IDs doesn't matter
  const byFp = new Map<string, VoteDoc[]>();
  for (const d of docs) {
    const fp = [...d.men].sort().join(",") + "§" + [...d.women].sort().join(",");
    if (!byFp.has(fp)) byFp.set(fp, []);
    byFp.get(fp)!.push(d);
  }

  const cloneIds = new Set<string>();
  const groups: CloneGroup[] = [];

  for (const group of byFp.values()) {
    if (group.length < CLONE_MIN_CLUSTER) continue;
    const sorted = [...group].sort((a, b) => a.ts - b.ts);
    const markedInGroup = new Set<string>();

    // Sliding window: for every starting point i, count how many fall within window
    for (let i = 0; i < sorted.length; i++) {
      const inWindow: VoteDoc[] = [];
      for (let j = i; j < sorted.length && sorted[j].ts - sorted[i].ts <= CLONE_WINDOW_MS; j++) {
        inWindow.push(sorted[j]);
      }
      if (inWindow.length >= CLONE_MIN_CLUSTER) {
        for (const v of inWindow) markedInGroup.add(v.id);
      }
    }

    if (markedInGroup.size === 0) continue;

    const marked = sorted.filter((v) => markedInGroup.has(v.id));
    const windowMs = marked[marked.length - 1].ts - marked[0].ts;

    for (const id of markedInGroup) cloneIds.add(id);
    groups.push({
      count:       markedInGroup.size,
      ids:         [...markedInGroup],
      windowMs,
      sampleVotes: marked.slice(0, 8).map((v) => ({ id: v.id, name: v.name, phone: v.phone })),
      sampleMen:   marked[0].men.slice(0, 5),
      sampleWomen: marked[0].women.slice(0, 5),
    });
  }

  // Sort groups largest-first
  groups.sort((a, b) => b.count - a.count);
  return { cloneIds, groups };
}

// ── GET — dry run: return both fake-count and clone-group counts ────────────
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getAdminAuth().verifyIdToken(authHeader.slice(7));

    const db = getAdminFirestore();
    const votesSnap = await db.collection("allStarVotes").get();

    const fake: Array<{ id: string; men: number; women: number; phone: string; name: string }> = [];
    const allDocs: VoteDoc[] = [];

    for (const d of votesSnap.docs) {
      const data = d.data();
      const men   = (data.menPlayers   || []) as string[];
      const women = (data.womenPlayers || []) as string[];
      const ts    = (data.submittedAt  as Timestamp | undefined)?.toMillis?.()
                 ?? (data.lastModified as Timestamp | undefined)?.toMillis?.()
                 ?? 0;
      const name  = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Unknown";
      const phone = (data.phone as string) || d.id;

      if (men.length !== 15 || women.length !== 15) {
        fake.push({ id: d.id, men: men.length, women: women.length, phone, name });
      } else {
        // Only valid-structure votes can be clones
        allDocs.push({ id: d.id, phone, name, men, women, ts });
      }
    }

    const { cloneIds, groups } = detectClones(allDocs);

    return NextResponse.json({
      fakeCount:   fake.length,
      cloneCount:  cloneIds.size,
      total:       votesSnap.size,
      fake,
      cloneGroups: groups,
    });
  } catch (err) {
    console.error("Cleanup scan error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ── POST — delete fake + clone votes, rewrite aggregates from clean votes ──
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getAdminAuth().verifyIdToken(authHeader.slice(7));

    const db = getAdminFirestore();
    const votesSnap = await db.collection("allStarVotes").get();

    // ── Step 1: identify fake (wrong count) ─────────────────────────────────
    const fakeIds = new Set<string>();
    const validDocs: VoteDoc[] = [];

    for (const d of votesSnap.docs) {
      const data = d.data();
      const men   = (data.menPlayers   || []) as string[];
      const women = (data.womenPlayers || []) as string[];
      const ts    = (data.submittedAt  as Timestamp | undefined)?.toMillis?.()
                 ?? (data.lastModified as Timestamp | undefined)?.toMillis?.()
                 ?? 0;

      if (men.length !== 15 || women.length !== 15) {
        fakeIds.add(d.id);
      } else {
        validDocs.push({
          id:    d.id,
          phone: (data.phone as string) || d.id,
          name:  `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Unknown",
          men,
          women,
          ts,
        });
      }
    }

    // ── Step 2: identify clones (identical selection, bulk timing) ──────────
    const { cloneIds } = detectClones(validDocs);

    // ── Step 3: union of all bad IDs ─────────────────────────────────────────
    const toDelete = new Set([...fakeIds, ...cloneIds]);

    // ── Step 4: batch-delete ─────────────────────────────────────────────────
    const toDeleteArr = [...toDelete];
    for (let i = 0; i < toDeleteArr.length; i += 500) {
      const batch = db.batch();
      toDeleteArr.slice(i, i + 500).forEach((id) => {
        batch.delete(db.collection("allStarVotes").doc(id));
      });
      await batch.commit();
    }

    // ── Step 5: recompute aggregates from surviving votes ────────────────────
    const cleanMen:   Record<string, number> = {};
    const cleanWomen: Record<string, number> = {};
    let remaining = 0;

    for (const v of validDocs) {
      if (cloneIds.has(v.id)) continue;
      remaining++;
      for (const id of v.men)   cleanMen[id]   = (cleanMen[id]   || 0) + 1;
      for (const id of v.women) cleanWomen[id] = (cleanWomen[id] || 0) + 1;
    }

    await Promise.all([
      db.collection("allStarVoteResults").doc("menPlayers").set(cleanMen),
      db.collection("allStarVoteResults").doc("womenPlayers").set(cleanWomen),
    ]);

    return NextResponse.json({
      deleted:      toDelete.size,
      deletedFake:  fakeIds.size,
      deletedClone: cloneIds.size,
      remaining,
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
