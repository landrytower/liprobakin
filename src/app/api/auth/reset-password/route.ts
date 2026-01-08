import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { isResetCodeExpired } from "@/lib/passwordReset";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: "User ID and new password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Get reset code document
    const resetCodeDoc = doc(firebaseDB, "passwordResets", userId);
    const resetCodeSnap = await getDoc(resetCodeDoc);

    if (!resetCodeSnap.exists()) {
      return NextResponse.json(
        { error: "No reset request found. Please start over." },
        { status: 400 }
      );
    }

    const resetData = resetCodeSnap.data();

    // Verify the code was verified
    if (!resetData.verified) {
      return NextResponse.json(
        { error: "Code must be verified first" },
        { status: 400 }
      );
    }

    // Check if code has expired
    const expiresAt = resetData.expiresAt.toMillis();
    if (isResetCodeExpired(expiresAt)) {
      await deleteDoc(resetCodeDoc);
      return NextResponse.json(
        { error: "Reset session has expired. Please start over." },
        { status: 400 }
      );
    }

    // Get user document
    const userDoc = doc(firebaseDB, "users", userId);
    const userSnap = await getDoc(userDoc);

    if (!userSnap.exists()) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Use Firebase Admin SDK to update the password
    try {
      const adminAuth = getAdminAuth();
      await adminAuth.updateUser(userId, {
        password: newPassword,
      });
      
      console.log(`Password successfully updated for user: ${userId}`);
    } catch (adminError: unknown) {
      console.error("Firebase Admin error:", adminError);
      
      // If Admin SDK fails, provide a helpful error
      const errorMessage = adminError instanceof Error ? adminError.message : 'Unknown error';
      if (errorMessage.includes("credential") || errorMessage.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
        return NextResponse.json(
          { 
            error: "Password update requires server configuration. Please contact support.",
            needsAdminSetup: true 
          },
          { status: 500 }
        );
      }
      
      throw adminError;
    }

    // Delete the reset code document after successful reset
    await deleteDoc(resetCodeDoc);

    return NextResponse.json(
      {
        message: "Password has been reset successfully!",
        passwordUpdated: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
