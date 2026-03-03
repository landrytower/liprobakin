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
    const { email, displayName, password, roles, createdByUid } = await request.json();

    if (!email || !displayName || !password || !createdByUid || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: email, displayName, password, roles, createdByUid' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
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
    } catch (lookupError: unknown) {
      if ((lookupError as { code?: string })?.code !== 'auth/user-not-found') {
        throw lookupError;
      }
    }

    // Create user in Firebase Auth with the provided password
    const userRecord = await auth.createUser({
      email,
      password,
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
      isPendingSetup: false,
      createdAt: serverTimestamp(),
      createdBy: createdByUid,
      lastLogin: null,
      isActive: true,
      isOnline: false,
    });

    // Store invite record for audit purposes
    await db.collection('adminInvites').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      roles,
      createdBy: createdByUid,
      createdAt: serverTimestamp(),
      status: 'active',
    });

    // Log audit trail
    const creatorEmail = creatorData?.email || 'unknown';
    await db.collection('auditLogs').add({
      action: 'admin_user_created',
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

    console.log(`✅ Admin account created for ${email} with roles:`, roles);

    return NextResponse.json({
      success: true,
      userId: userRecord.uid,
      message: `Admin account created successfully for ${email}.`,
    });
  } catch (error: unknown) {
    console.error('Error inviting admin:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to invite admin' },
      { status: 500 }
    );
  }
}
