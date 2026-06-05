import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getAdminAuth().verifyIdToken(authHeader.slice(7));

    const buffer = Buffer.from(await req.arrayBuffer());
    if (!buffer.byteLength) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const fileRef = bucket.file("allstar-banners/home-banner");

    await fileRef.save(buffer, {
      metadata: { contentType: "image/jpeg" },
      resumable: false,
    });

    const bucketName = bucket.name;
    const encodedPath = encodeURIComponent("allstar-banners/home-banner");
    const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodedPath}?alt=media`;

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Banner upload error:", err);
    const msg = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
