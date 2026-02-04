import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (only once)
if (!getApps().length && process.env.FIREBASE_PROJECT_ID) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ?.replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n'),
    }),
  });
}

type ChangePasswordPayload = {
  uid?: string;
  newPassword?: string;
  changedByUid?: string;
};

type AuditLogEntry = {
  action: 'admin_password_changed';
  userId: string;
  userEmail: string;
  targetType: 'admin';
  targetId: string;
  targetName: string;
  details: {
    displayName: string;
    selfChange: boolean;
    changedViaAPI: boolean;
  };
  deviceInfo: {
    userAgent: string;
    ip: string;
    timestamp: string;
  };
  timestamp: FirebaseFirestore.FieldValue;
};

export async function POST(request: NextRequest) {
  return changeAdminPassword(request).catch((error: unknown) => {
    const errorMessage = extractErrorMessage(error);
    console.error('Error changing password:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  });
}

async function changeAdminPassword(request: NextRequest) {
  const { uid, newPassword, changedByUid }: ChangePasswordPayload = await request.json();

  if (!uid || !newPassword) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields' },
      { status: 400 }
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { success: false, error: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  const auth = getAuth();
  const db = getFirestore();

  // Update user password in Firebase Auth
  await auth.updateUser(uid, {
    password: newPassword,
  });

  // Get user info for audit log
  const targetDoc = await db.collection('adminUsers').doc(uid).get();
  const targetData = targetDoc.exists ? (targetDoc.data() as unknown) : undefined;
  const targetEmail = extractStringField(targetData, 'email', 'unknown');
  const targetName = extractStringField(targetData, 'displayName', 'unknown');

  let changerEmail = 'system';
  if (changedByUid) {
    const changerDoc = await db.collection('adminUsers').doc(changedByUid).get();
    const changerData = changerDoc.exists ? (changerDoc.data() as unknown) : undefined;
    changerEmail = extractStringField(changerData, 'email', 'unknown');
  }

  // Get device info from request headers
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const deviceInfo = {
    userAgent,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Log comprehensive audit trail
  const auditEntry: AuditLogEntry = {
    action: 'admin_password_changed',
    userId: changedByUid || uid,
    userEmail: changerEmail,
    targetType: 'admin',
    targetId: uid,
    targetName: targetEmail,
    details: {
      displayName: targetName,
      selfChange: !changedByUid || changedByUid === uid,
      changedViaAPI: true,
    },
    deviceInfo,
    timestamp: FieldValue.serverTimestamp(),
  };

  await db.collection('auditLogs').add(auditEntry);

  console.log(`✅ Password changed for ${targetEmail} by ${changerEmail}`);

  return NextResponse.json({
    success: true,
    message: 'Password changed successfully',
  });
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch (serializationError) {
    console.error('Failed to serialize error:', serializationError);
  }

  return 'Failed to change password';
}

function extractStringField(data: unknown, field: string, fallback: string): string {
  if (!isPlainObject(data)) {
    return fallback;
  }

  const value = data[field];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
