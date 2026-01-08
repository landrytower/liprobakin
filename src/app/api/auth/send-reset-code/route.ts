import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { generateResetCode, normalizePhoneNumber } from "@/lib/passwordReset";
import { sendResetCodeSMS, sendResetCodeEmail } from "@/lib/sms.server";

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
        { message: "If an account exists with this information, a reset code has been sent." },
        { status: 200 }
      );
    }

    const userData = userSnapshot.docs[0].data();
    const userId = userSnapshot.docs[0].id;

    // Generate 6-digit code
    const code = generateResetCode();
    
    // Set expiration to 10 minutes from now
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Store reset code in Firestore
    const resetCodeDoc = doc(firebaseDB, "passwordResets", userId);
    await setDoc(resetCodeDoc, {
      userId,
      email: userData.email || null,
      phoneNumber: userData.phoneNumber || null,
      code,
      createdAt: new Date(),
      expiresAt: new Date(expiresAt),
      verified: false,
    });

    // Send code via email or SMS
    let sent = false;
    if (isEmail && userData.email) {
      sent = await sendResetCodeEmail(
        userData.email,
        code,
        userData.firstName || "User"
      );
    } else if (!isEmail && userData.phoneNumber) {
      sent = await sendResetCodeSMS(
        userData.phoneNumber,
        code,
        userData.firstName || "User"
      );
    }

    if (!sent) {
      return NextResponse.json(
        { error: "Failed to send reset code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Reset code sent successfully",
        sentTo: isEmail ? "email" : "phone",
        maskedInfo: isEmail 
          ? maskEmail(emailOrPhone)
          : maskPhone(emailOrPhone)
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending reset code:", error);
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
