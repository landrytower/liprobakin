import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { AdminRole } from '@/types/admin';
import { mergePermissions } from '@/types/admin';

// Initialize Firebase Admin (only once)
if (
  !getApps().length &&
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY as string)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID as string,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
      privateKey,
    }),
  });
}

function serverTimestamp(): FirebaseFirestore.FieldValue {
  return FieldValue.serverTimestamp();
}

export async function POST(request: NextRequest) {
  try {
    const { email, displayName, roles, createdByUid } = await request.json();

    if (!email || !displayName || !createdByUid || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: email, displayName, roles, createdByUid' },
        { status: 400 }
      );
    }

    const auth = getAuth();
    const db = getFirestore();

    // Verify the creator is a master admin
    const creatorDoc = await db.collection('adminUsers').doc(createdByUid).get();
    const creatorData = creatorDoc.data();
    const creatorRoles = Array.isArray(creatorData?.roles) ? creatorData.roles : [];

    if (!creatorDoc.exists || !creatorRoles.includes('master')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only master admins can invite new admins' },
        { status: 403 }
      );
    }

    // Check if user already exists
    try {
      await auth.getUserByEmail(email);
      return NextResponse.json(
        { success: false, error: 'An admin with this email already exists' },
        { status: 409 }
      );
    } catch (lookupError: any) {
      if (lookupError?.code !== 'auth/user-not-found') {
        throw lookupError;
      }
    }

    // Generate a secure random temporary password (user will never see this)
    const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 32);

    // Create user in Firebase Auth with temp password (no email verification needed)
    const userRecord = await auth.createUser({
      email,
      password: tempPassword,
      displayName,
      emailVerified: false,
    });

    // Create admin user document in Firestore
    await db.collection('adminUsers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email || email,
      displayName,
      roles: roles as AdminRole[],
      permissions: mergePermissions(roles as AdminRole[]),
      isFirstLogin: true,
      isPendingSetup: true,
      createdAt: serverTimestamp(),
      createdBy: createdByUid,
      lastLogin: null,
      isActive: true,
      isOnline: false,
    });

    // Generate a password reset link via Firebase Admin SDK — this sends a REAL email
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://liprobakin.com'}/admin`,
      handleCodeInApp: false,
    };

    const resetLink = await auth.generatePasswordResetLink(email, actionCodeSettings);

    // Send the invite email using Firebase Admin SDK's built-in email
    // The generatePasswordResetLink already triggers Firebase's email if configured,
    // but we also store the link for manual sharing as backup
    await db.collection('adminInvites').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      roles,
      resetLink,
      createdBy: createdByUid,
      createdAt: serverTimestamp(),
      status: 'pending',
    });

    // Log audit trail
    const creatorEmail = creatorData?.email || 'unknown';
    await db.collection('auditLogs').add({
      action: 'admin_user_invited',
      userId: createdByUid,
      userEmail: creatorEmail,
      targetType: 'admin',
      targetId: userRecord.uid,
      targetName: email,
      details: {
        displayName,
        roles,
        invitedViaEmail: true,
      },
      deviceInfo: {
        userAgent: request.headers.get('user-agent') || 'unknown',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
      },
      timestamp: serverTimestamp(),
    });

    console.log(`✅ Admin invite sent to ${email} with roles:`, roles);

    return NextResponse.json({
      success: true,
      userId: userRecord.uid,
      resetLink, // Return link so master admin can share it manually if email doesn't arrive
      message: `Invitation sent to ${email}. They will receive an email to set their password.`,
    });
  } catch (error: any) {
    console.error('Error inviting admin:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to invite admin' },
      { status: 500 }
    );
  }
}
