import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore, getAdminStorage } from "@/lib/firebaseAdmin";

const normalizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");

const buildDownloadUrl = (bucketName: string, objectPath: string, downloadToken: string) => {
  const encodedPath = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;
};

export async function POST(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get("authorization") || "";
    const idToken = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : "";

    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const db = getAdminFirestore();
    const adminSnapshot = await db.collection("adminUsers").doc(decodedToken.uid).get();

    if (!adminSnapshot.exists || adminSnapshot.data()?.isActive === false || adminSnapshot.data()?.status === "inactive") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const folderId = String(formData.get("folderId") || "").trim();
    const fileEntry = formData.get("file");

    if (!folderId || !(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Missing folder or file" }, { status: 400 });
    }

    const safeName = normalizeFileName(fileEntry.name || "document");
    const objectPath = `admin-documents/${folderId}/${Date.now()}-${safeName}`;
    const contentType = fileEntry.type || "application/octet-stream";
    const downloadToken = randomUUID();
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const file = bucket.file(objectPath);
    const buffer = Buffer.from(await fileEntry.arrayBuffer());

    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedBy: decodedToken.uid,
        },
      },
    });

    return NextResponse.json({
      url: buildDownloadUrl(bucket.name, objectPath, downloadToken),
      path: objectPath,
      contentType,
    });
  } catch (error) {
    console.error("Admin document upload failed:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}