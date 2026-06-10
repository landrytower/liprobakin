import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { getApps } from "firebase-admin/app";
import type { DocumentData } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Firestore REST API value → plain JS value ────────────────────────────────
type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

function fromFsValue(v: FsValue): unknown {
  if ("stringValue"    in v) return v.stringValue;
  if ("integerValue"   in v) return parseInt(v.integerValue, 10);
  if ("doubleValue"    in v) return v.doubleValue;
  if ("booleanValue"   in v) return v.booleanValue;
  if ("nullValue"      in v) return null;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue"     in v) return (v.arrayValue.values ?? []).map(fromFsValue);
  if ("mapValue"       in v) {
    const out: Record<string, unknown> = {};
    for (const [k, fv] of Object.entries(v.mapValue.fields ?? {})) out[k] = fromFsValue(fv);
    return out;
  }
  return null;
}

function fromFsDoc(fields: Record<string, FsValue>): DocumentData {
  const out: DocumentData = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromFsValue(v);
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getAdminAuth().verifyIdToken(authHeader.slice(7));

    const body = await req.json().catch(() => ({})) as { minutesAgo?: number };
    const minutesAgo = Math.min(Math.max(body.minutesAgo ?? 45, 5), 59);
    const readTime   = new Date(Date.now() - minutesAgo * 60_000).toISOString();

    const db = getAdminFirestore();

    // ── Step 1: all phones that ever voted (allStarUsedTokens → phone field) ─
    const tokensSnap = await db.collection("allStarUsedTokens").get();
    const votedPhones = new Set<string>();
    for (const d of tokensSnap.docs) {
      const phone = d.data().phone as string | undefined;
      if (phone) votedPhones.add(phone);
    }

    // ── Step 2: which of those phones no longer have a vote doc ─────────────
    const currentSnap = await db.collection("allStarVotes").get();
    const existingIds = new Set(currentSnap.docs.map((d) => d.id));
    const missingPhones = [...votedPhones].filter((p) => !existingIds.has(p));

    if (missingPhones.length === 0) {
      return NextResponse.json({ recovered: 0, message: "No missing votes found — nothing to restore." });
    }

    // ── Step 3: read deleted docs at past timestamp via Firestore REST API ───
    // The REST API supports readTime within the 1-hour version retention window
    const app = getApps()[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cred = (app.options as any).credential;
    const { access_token } = await cred.getAccessToken() as { access_token: string };

    const projectId  = process.env.FIREBASE_PROJECT_ID?.trim() ?? "ppop-35930";
    const resourceBase = `projects/${projectId}/databases/(default)/documents`;
    const apiBase      = `https://firestore.googleapis.com/v1/${resourceBase}`;

    // Batch fetches of missing docs (100 at a time via batchGet)
    const toRestore: Array<{ id: string; data: DocumentData }> = [];

    for (let i = 0; i < missingPhones.length; i += 100) {
      const batch = missingPhones.slice(i, i + 100);
      // batchGet expects resource paths, NOT full URLs
      const docNames = batch.map((p) => `${resourceBase}/allStarVotes/${p}`);

      const res = await fetch(`${apiBase}:batchGet`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ documents: docNames, readTime }),
      });

      if (!res.ok) {
        const errText = await res.text();
        // If PITR/readTime isn't available, surface a clear message
        if (errText.includes("FAILED_PRECONDITION") || errText.includes("point-in-time")) {
          return NextResponse.json({
            recovered: 0,
            missing: missingPhones.length,
            missingList: missingPhones.slice(0, 50),
            message: `Cannot read historical data — Firestore point-in-time reads are unavailable. The deleted votes cannot be automatically restored. The following ${missingPhones.length} phone(s) had their votes deleted: ask them to vote again.`,
          });
        }
        throw new Error(`Firestore REST API error: ${errText.slice(0, 200)}`);
      }

      type BatchResult = { found?: { name: string; fields?: Record<string, FsValue> }; missing?: string };
      const results = await res.json() as BatchResult[];

      for (const r of results) {
        if (!r.found?.fields) continue;
        const phoneId = r.found.name.split("/").pop()!;
        toRestore.push({ id: phoneId, data: fromFsDoc(r.found.fields) });
      }
    }

    if (toRestore.length === 0) {
      return NextResponse.json({
        recovered: 0,
        missing: missingPhones.length,
        missingList: missingPhones.slice(0, 50),
        message: `Found ${missingPhones.length} missing vote IDs but no historical data within the ${minutesAgo}-minute window. Try a shorter time window, or the 1-hour retention period may have passed.`,
      });
    }

    // ── Step 4: batch-restore ────────────────────────────────────────────────
    for (let i = 0; i < toRestore.length; i += 500) {
      const batch = db.batch();
      toRestore.slice(i, i + 500).forEach(({ id, data }) => {
        batch.set(db.collection("allStarVotes").doc(id), data);
      });
      await batch.commit();
    }

    // ── Step 5: recompute aggregates from all votes ──────────────────────────
    const allSnap = await db.collection("allStarVotes").get();
    const cleanMen:   Record<string, number> = {};
    const cleanWomen: Record<string, number> = {};
    let total = 0;

    for (const d of allSnap.docs) {
      const data = d.data();
      const men:   string[] = data.menPlayers   || [];
      const women: string[] = data.womenPlayers || [];
      if (men.length !== 15 || women.length !== 15) continue;
      total++;
      for (const id of men)   cleanMen[id]   = (cleanMen[id]   || 0) + 1;
      for (const id of women) cleanWomen[id] = (cleanWomen[id] || 0) + 1;
    }

    await Promise.all([
      db.collection("allStarVoteResults").doc("menPlayers").set(cleanMen),
      db.collection("allStarVoteResults").doc("womenPlayers").set(cleanWomen),
    ]);

    return NextResponse.json({
      recovered:      toRestore.length,
      totalAfter:     total,
      missingPhones:  missingPhones.length,
      restoredSample: toRestore.slice(0, 10).map((v) => ({
        phone: v.id,
        name:  `${v.data.firstName ?? ""} ${v.data.lastName ?? ""}`.trim() || v.id,
      })),
    });
  } catch (err) {
    console.error("Recovery error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
