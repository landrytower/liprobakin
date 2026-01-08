import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { isValidResetCode, isResetCodeExpired, normalizePhoneNumber } from "@/lib/passwordReset";

export async function POST(request: NextRequest) {
  try {
    const { emailOrPhone, code } = await request.json();

    if (!emailOrPhone || !code) {
      return NextResponse.json(
        { error: "Email/phone and code are required" },
        { status: 400 }
      );
    }

    // Validate code format
    if (!isValidResetCode(code)) {
      return NextResponse.json(
        { error: "Invalid code format" },
        { status: 400 }
      );
    }

    // Find user - normalize phone number if needed
    const isEmail = emailOrPhone.includes('@');
    const searchValue = isEmail ? emailOrPhone : normalizePhoneNumber(emailOrPhone);
    
    const usersRef = collection(firebaseDB, "users");
    const userQuery = query(
      usersRef,
      where(isEmail ? "email" : "phoneNumber", "==", searchValue)
    );
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      return NextResponse.json(
        { error: "Invalid code or expired" },
        { status: 400 }
      );
    }

    const userId = userSnapshot.docs[0].id;

    // Get reset code document
    const resetCodeDoc = doc(firebaseDB, "passwordResets", userId);
    const resetCodeSnap = await getDoc(resetCodeDoc);

    if (!resetCodeSnap.exists()) {
      return NextResponse.json(
        { error: "No reset request found" },
        { status: 400 }
      );
    }

    const resetData = resetCodeSnap.data();

    // Check if code matches
    if (resetData.code !== code) {
      return NextResponse.json(
        { error: "Invalid code" },
        { status: 400 }
      );
    }

    // Check if code has expired
    const expiresAt = resetData.expiresAt.toMillis();
    if (isResetCodeExpired(expiresAt)) {
      return NextResponse.json(
        { error: "Code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if code was already used
    if (resetData.verified) {
      return NextResponse.json(
        { error: "Code has already been used" },
        { status: 400 }
      );
    }

    // Mark code as verified
    await updateDoc(resetCodeDoc, {
      verified: true,
    });

    return NextResponse.json(
      {
        message: "Code verified successfully",
        userId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying reset code:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
