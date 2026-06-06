import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

// GET — dry run: count fake votes without deleting
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

    for (const d of votesSnap.docs) {
      const data = d.data();
      const men = (data.menPlayers || []) as string[];
      const women = (data.womenPlayers || []) as string[];
      if (men.length !== 15 || women.length !== 15) {
        fake.push({
          id: d.id,
          men: men.length,
          women: women.length,
          phone: (data.phone as string) || d.id,
          name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Unknown",
        });
      }
    }

    return NextResponse.json({ fakeCount: fake.length, total: votesSnap.size, fake });
  } catch (err) {
    console.error("Cleanup scan error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — delete fake votes and recalculate counts from valid votes only
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getAdminAuth().verifyIdToken(authHeader.slice(7));

    const db = getAdminFirestore();
    const votesSnap = await db.collection("allStarVotes").get();

    const fakeIds: string[] = [];
    const validMen: Record<string, number> = {};
    const validWomen: Record<string, number> = {};
    let validVoters = 0;

    for (const d of votesSnap.docs) {
      const data = d.data();
      const men = (data.menPlayers || []) as string[];
      const women = (data.womenPlayers || []) as string[];

      if (men.length !== 15 || women.length !== 15) {
        fakeIds.push(d.id);
      } else {
        validVoters++;
        for (const id of men)   validMen[id]   = (validMen[id]   || 0) + 1;
        for (const id of women) validWomen[id] = (validWomen[id] || 0) + 1;
      }
    }

    // Batch-delete fake votes (Firestore limit: 500 per batch)
    for (let i = 0; i < fakeIds.length; i += 500) {
      const batch = db.batch();
      fakeIds.slice(i, i + 500).forEach((id) => {
        batch.delete(db.collection("allStarVotes").doc(id));
      });
      await batch.commit();
    }

    // Rewrite aggregates based on valid votes only
    await Promise.all([
      db.collection("allStarVoteResults").doc("menPlayers").set(validMen),
      db.collection("allStarVoteResults").doc("womenPlayers").set(validWomen),
    ]);

    return NextResponse.json({
      deleted: fakeIds.length,
      remaining: validVoters,
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
