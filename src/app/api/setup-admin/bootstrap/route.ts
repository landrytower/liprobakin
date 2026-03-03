import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { mergePermissions } from "@/types/admin";

type BootstrapPayload = {
  email?: string;
  password?: string;
  displayName?: string;
};

const isSandboxProject = (projectId: string) => projectId.includes("sandbox");

export async function POST(request: NextRequest) {
  try {
    const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Missing FIREBASE_PROJECT_ID." }, { status: 500 });
    }

    // Safety guard: this endpoint is intended for local/dev sandbox bootstrap only.
    if (process.env.NODE_ENV === "production" || !isSandboxProject(projectId)) {
      return NextResponse.json(
        { success: false, error: "Setup bootstrap endpoint is only available for sandbox development." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as BootstrapPayload;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const displayName = String(body.displayName || email.split("@")[0] || "Master Admin").trim();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    const db = getAdminFirestore();

    let uid: string;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      await auth.updateUser(uid, { password, displayName });
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: string }).code)
        : "";

      if (code !== "auth/user-not-found") {
        throw error;
      }

      const created = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: false,
      });
      uid = created.uid;
    }

    await db.collection("adminUsers").doc(uid).set(
      {
        uid,
        email,
        displayName,
        roles: ["master"],
        permissions: mergePermissions(["master"]),
        isFirstLogin: false,
        isActive: true,
        status: "active",
        createdBy: "setup-admin-bootstrap",
        createdAt: FieldValue.serverTimestamp(),
        lastLogin: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      uid,
      message: "Master admin account is ready. You can now sign in at /admin.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to bootstrap admin.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
