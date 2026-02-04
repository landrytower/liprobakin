import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { AdminRole } from '@/types/admin';
import { mergePermissions } from '@/types/admin';

type CreateAdminPayload = {
  email?: string;
  displayName?: string;
  password?: string;
  roles?: unknown;
  createdByUid?: string;
};

type DeviceInfo = {
  userAgent: string;
  ip: string;
  timestamp: string;
};

type AdminUserDocument = {
  uid: string;
  email: string;
  displayName: string;
  roles: AdminRole[];
  permissions: ReturnType<typeof mergePermissions>;
  isFirstLogin: true;
  createdAt: FirebaseFirestore.FieldValue;
  createdBy: string;
  lastLogin: null;
  isActive: true;
};

type AuditLogEntry = {
  action: 'admin_user_created';
  userId: string;
  userEmail: string;
  targetType: 'admin';
  targetId: string;
  targetName: string;
  details: {
    displayName: string;
    roles: AdminRole[];
    createdViaAPI: true;
  };
  deviceInfo: DeviceInfo;
  timestamp: FirebaseFirestore.FieldValue;
};

// Initialize Firebase Admin (only once)
if (
  !getApps().length &&
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  // Properly clean the private key - handle both escaped newlines and Windows line breaks
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

export async function POST(request: NextRequest) {
  return createAdminUser(request).catch((error: unknown) => {
    const errorMessage = extractErrorMessage(error);
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  });
}

async function createAdminUser(request: NextRequest) {
  const payload = (await request.json()) as CreateAdminPayload;
  const { email, displayName, password, roles, createdByUid } = payload;

  if (!email || !displayName || !password || !createdByUid || !isAdminRoleArray(roles)) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields' },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { success: false, error: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  const adminEmail: string = email;
  const adminDisplayName: string = displayName;
  const adminPassword: string = password;
  const roleList: AdminRole[] = roles;
  const creatorId: string = createdByUid;
  const auth = getAuth();
  const db = getFirestore();

  // Verify the creator is a master admin
  const creatorDoc = await db.collection('adminUsers').doc(createdByUid).get();
  const creatorData = creatorDoc.data() as Record<string, unknown> | undefined;
  const creatorRoles = extractStringArray(creatorData ? creatorData.roles : undefined);

  if (!creatorDoc.exists || !creatorRoles.includes('master')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Only master admins can create new admin users' },
      { status: 403 }
    );
  }

  // Check if user already exists
  try {
    await auth.getUserByEmail(adminEmail);
    return NextResponse.json(
      { success: false, error: 'An admin with this email already exists' },
      { status: 409 }
    );
  } catch (lookupError: unknown) {
    if (!isFirebaseAuthError(lookupError, 'auth/user-not-found')) {
      throw lookupError;
    }
  }

  // Create user in Firebase Auth with password
  const userRecord = await auth.createUser({
    email: adminEmail,
    password: adminPassword,
    emailVerified: false,
  });

  const userEmail = userRecord.email ?? adminEmail;

  // Create admin user document in Firestore
  const adminUserDocument: AdminUserDocument = {
    uid: userRecord.uid,
    email: userEmail,
    displayName: adminDisplayName,
    roles: roleList,
    permissions: mergePermissions(roleList),
    isFirstLogin: true,
    createdAt: serverTimestamp(),
    createdBy: creatorId,
    lastLogin: null,
    isActive: true,
  };

  await db.collection('adminUsers').doc(userRecord.uid).set(adminUserDocument);

  const creatorEmail = extractStringField(creatorData, 'email', 'unknown');
  const deviceInfo = createDeviceInfo(request);

  // Log comprehensive audit trail
  const auditEntry: AuditLogEntry = {
    action: 'admin_user_created',
    userId: creatorId,
    userEmail: creatorEmail,
    targetType: 'admin',
    targetId: userRecord.uid,
    targetName: adminEmail,
    details: {
      displayName: adminDisplayName,
      roles: roleList,
      createdViaAPI: true,
    },
    deviceInfo,
    timestamp: serverTimestamp(),
  };

  await db.collection('auditLogs').add(auditEntry);

  console.log(`✅ Admin user created: ${adminEmail} with roles:`, roleList, 'by:', creatorEmail);

  return NextResponse.json({
    success: true,
    userId: userRecord.uid,
    message: `Admin user "${adminDisplayName}" created successfully. They can log in with their email and password.`,
  });
}

function isAdminRoleArray(roles: unknown): roles is AdminRole[] {
  return Array.isArray(roles) && roles.every((role) => typeof role === 'string');
}

function extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function createDeviceInfo(request: NextRequest): DeviceInfo {
  return {
    userAgent: request.headers.get('user-agent') || 'unknown',
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    timestamp: new Date().toISOString(),
  };
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
  } catch (serializationError: unknown) {
    console.error('Failed to serialize error:', serializationError);
  }

  return 'Failed to create user';
}

function isFirebaseAuthError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code === code
  );
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

function serverTimestamp(): FirebaseFirestore.FieldValue {
  return FieldValue.serverTimestamp();
}
