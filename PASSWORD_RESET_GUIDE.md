# Password Reset Setup Guide

## Overview
This guide explains how to set up the password reset functionality for players in the FEBACO application. The system supports password reset via both email and phone number.

## Features
- ✅ Reset password using email or phone number
- ✅ 6-digit verification code sent via email/SMS
- ✅ Code expires after 10 minutes
- ✅ Secure verification process
- ✅ Integration with Firebase Authentication

## Architecture

### Flow Diagram
```
User Request → Send Code → Verify Code → Reset Password → Success
     ↓              ↓            ↓              ↓            ↓
  Enter Email   Get Code    Enter Code   New Password   Sign In
   or Phone     via Email     (6 digits)   (min 6 chars)
                 or SMS
```

### Components Created

1. **Types** (`src/types/passwordReset.ts`)
   - PasswordResetRequest interface
   - ResetCodeData interface

2. **Utilities** (`src/lib/passwordReset.ts`)
   - generateResetCode() - Creates 6-digit codes
   - sendResetCodeEmail() - Sends email with code
   - sendResetCodeSMS() - Sends SMS with code
   - Validation helpers

3. **API Routes**
   - `/api/auth/send-reset-code` - Sends verification code
   - `/api/auth/verify-reset-code` - Verifies the code
   - `/api/auth/reset-password` - Resets the password

4. **UI Components**
   - `PasswordResetModal.tsx` - Main reset interface
   - Updated `AuthModal.tsx` - Integration with "Forgot Password?"

## Database Structure

### Firestore Collection: `passwordResets`
```typescript
{
  userId: string,              // User's UID
  email: string | null,        // User's email
  phoneNumber: string | null,  // User's phone
  code: string,                // 6-digit code
  createdAt: Timestamp,        // When created
  expiresAt: Timestamp,        // Expiration time (10 min)
  verified: boolean,           // Code verified?
  usedAt: Timestamp | null     // When used (optional)
}
```

## Setup Instructions

### 1. Firebase Admin SDK (For Production)

To enable server-side password updates, you need Firebase Admin SDK:

```bash
npm install firebase-admin
```

Create `src/lib/firebaseAdmin.ts`:
```typescript
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminAuth = admin.auth();
export const adminDB = admin.firestore();
```

Add to `.env.local`:
```env
FIREBASE_PROJECT_ID=ppop-35930
FIREBASE_CLIENT_EMAIL=your-service-account@ppop-35930.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 2. Email Service Setup (SendGrid)

```bash
npm install @sendgrid/mail
```

Update `src/lib/passwordReset.ts`:
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendResetCodeEmail(email: string, code: string, firstName: string) {
  const msg = {
    to: email,
    from: 'noreply@febaco.com',
    subject: 'Password Reset Code - FEBACO',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1089D3;">Password Reset Request</h2>
        <p>Hi ${firstName},</p>
        <p>You requested to reset your password. Use the code below to proceed:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #1089D3; font-size: 36px; letter-spacing: 10px; margin: 0;">${code}</h1>
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br><strong>FEBACO Team</strong></p>
      </div>
    `,
  };
  
  await sgMail.send(msg);
  return true;
}
```

Add to `.env.local`:
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. SMS Service Setup (Firebase Phone Auth)

Firebase Phone Authentication handles SMS OTP delivery automatically. No additional SMS service is required.

**To enable Firebase Phone Auth:**
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable "Phone" as a sign-in provider
3. Add your domain to authorized domains
4. Firebase will handle SMS delivery automatically

**Note:** The phone auth is already integrated in the AuthModal component using:
- `signInWithPhoneNumber()` - For login/signup with phone
- `RecaptchaVerifier` - For verification

For password reset via phone, the code is logged to console in development.

### 4. Update Password Reset Route

Update `src/app/api/auth/reset-password/route.ts`:
```typescript
import { adminAuth } from "@/lib/firebaseAdmin";

// Inside the POST handler:
await adminAuth.updateUser(userId, {
  password: newPassword
});

// Delete reset document
await deleteDoc(resetCodeDoc);

return NextResponse.json({
  message: "Password reset successful",
  passwordUpdated: true,
});
```

## Current Implementation (Development Mode)

For development/testing without Admin SDK:
- Email users: Uses Firebase's built-in `sendPasswordResetEmail()`
- Phone users: Sends verification code and instructs to use email link

## Security Features

1. **Rate Limiting** - Consider adding rate limiting to prevent abuse
2. **Code Expiration** - Codes expire after 10 minutes
3. **One-Time Use** - Codes can only be used once
4. **Secure Storage** - Codes stored in Firestore with timestamps
5. **Masked Display** - Shows masked email/phone (e.g., ab***@domain.com)

## Usage

### For Users

1. Click "Forgot Password?" on login modal
2. Enter email or phone number
3. Receive 6-digit code via email/SMS
4. Enter code to verify
5. Set new password
6. Sign in with new password

### Testing

```bash
# Development - codes are logged to console
npm run dev

# Check terminal for codes when testing:
# ====================================
# PASSWORD RESET CODE
# Email: user@example.com
# Code: 123456
# ====================================
```

## Firestore Security Rules

Add to `firestore.rules`:
```
match /passwordResets/{userId} {
  // Only allow server-side writes (via API routes)
  allow read, write: if false;
}
```

## Future Enhancements

- [ ] Add rate limiting (max 3 attempts per hour)
- [ ] Add reCAPTCHA to prevent bots
- [ ] SMS delivery status tracking
- [ ] Email delivery confirmation
- [ ] Multi-language support for reset emails/SMS
- [ ] Password strength meter
- [ ] Account lockout after multiple failed attempts
- [ ] Notification to user when password is changed

## Troubleshooting

### Code Not Received
- Check spam/junk folder for emails
- Verify phone number format (include country code)
- Check Firebase console for phone auth delivery status

### Code Expired
- Codes expire after 10 minutes
- Request a new code using "Resend Code" button

### Invalid Code
- Ensure you're entering the exact 6-digit code
- Code is case-sensitive and numeric only
- Each code can only be used once

## Support

For issues or questions:
- Check Firebase console for auth errors
- Review API route logs for detailed error messages
- Verify environment variables are set correctly
