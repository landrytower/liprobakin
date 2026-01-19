import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizePhoneNumber } from "@/lib/passwordReset";
import { sendResetLinkSMS, sendResetLinkEmail } from "@/lib/sms.server";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { emailOrPhone } = await request.json();

    if (!emailOrPhone) {
      return NextResponse.json(
        { error: "Email or phone number is required" },
        { status: 400 }
      );
    }

    // Determine if input is email or phone
    const isEmail = emailOrPhone.includes('@');
    
    // Normalize phone number if it's a phone lookup
    const searchValue = isEmail ? emailOrPhone : normalizePhoneNumber(emailOrPhone);
    
    const usersRef = collection(firebaseDB, "users");
    
    // Search for user by email or normalized phone
    const userQuery = query(
      usersRef,
      where(isEmail ? "email" : "phoneNumber", "==", searchValue)
    );
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      // Don't reveal if user exists or not for security
      return NextResponse.json(
        { message: "If an account exists with this information, a reset link has been sent." },
        { status: 200 }
      );
    }

    const userData = userSnapshot.docs[0].data();
    const userId = userSnapshot.docs[0].id;

    // Generate secure reset token (32 bytes = 64 character hex string)
    const resetToken = randomBytes(32).toString('hex');
    
    // Set expiration to 1 hour from now
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    // Store reset token in Firestore
    const resetTokenDoc = doc(firebaseDB, "passwordResets", userId);
    await setDoc(resetTokenDoc, {
      userId,
      email: userData.email || null,
      phoneNumber: userData.phoneNumber || null,
      token: resetToken,
      createdAt: new Date(),
      expiresAt: new Date(expiresAt),
      used: false,
    });

    // Create reset link
    const resetLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send link via email or SMS
    let sent = false;
    if (isEmail && userData.email) {
      sent = await sendResetLinkEmail(
        userData.email,
        resetLink,
        userData.firstName || "User"
      );
    } else if (!isEmail && userData.phoneNumber) {
      sent = await sendResetLinkSMS(
        userData.phoneNumber,
        resetLink,
        userData.firstName || "User"
      );
    }

    if (!sent) {
      return NextResponse.json(
        { error: "Failed to send reset link. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Reset link sent successfully",
        sentTo: isEmail ? "email" : "phone",
        maskedInfo: isEmail 
          ? maskEmail(emailOrPhone)
          : maskPhone(emailOrPhone)
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending reset link:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

// Helper function to mask email
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart.substring(0, 2)}***@${domain}`;
}

// Helper function to mask phone
function maskPhone(phone: string): string {
  if (phone.length <= 4) {
    return `***${phone.slice(-2)}`;
  }
  return `***${phone.slice(-4)}`;
}