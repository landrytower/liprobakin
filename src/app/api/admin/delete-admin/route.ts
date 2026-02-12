import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
    const { adminId, requestorUid } = await request.json();

    if (!adminId || !requestorUid) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: adminId, requestorUid' },
        { status: 400 }
      );
    }

    const auth = getAuth();
    const db = getFirestore();

    // Verify the requestor is a master admin
    const requestorDoc = await db.collection('adminUsers').doc(requestorUid).get();
    const requestorData = requestorDoc.data();
    const requestorRoles = Array.isArray(requestorData?.roles) ? requestorData.roles : [];

    if (!requestorDoc.exists || !requestorRoles.includes('master')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only master admins can delete admins' },
        { status: 403 }
      );
    }

    // Get admin to be deleted
    const adminDoc = await db.collection('adminUsers').doc(adminId).get();
    if (!adminDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      );
    }

    const adminData = adminDoc.data();
    const adminRoles = Array.isArray(adminData?.roles) ? adminData.roles : [];

    // Prevent deleting other master admins
    if (adminRoles.includes('master')) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete master admin accounts' },
        { status: 403 }
      );
    }

    // Log audit trail before deletion
    const requestorEmail = requestorData?.email || 'unknown';
    const adminEmail = adminData?.email || 'unknown';
    await db.collection('auditLogs').add({
      action: 'admin_user_deleted',
      userId: requestorUid,
      userEmail: requestorEmail,
      targetType: 'admin',
      targetId: adminId,
      targetName: adminEmail,
      details: {
        displayName: adminData?.displayName || '',
        roles: adminRoles,
      },
      deviceInfo: {
        userAgent: request.headers.get('user-agent') || 'unknown',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
      },
      timestamp: serverTimestamp(),
    });

    // Delete from Firebase Auth
    try {
      await auth.deleteUser(adminId);
    } catch (authError: unknown) {
      // If user doesn't exist in Auth, continue with Firestore deletion
      if ((authError as { code?: string })?.code !== 'auth/user-not-found') {
        console.error('Error deleting user from Auth:', authError);
        throw authError;
      }
    }

    // Delete from Firestore
    await db.collection('adminUsers').doc(adminId).delete();

    // Also delete any invite records
    try {
      await db.collection('adminInvites').doc(adminId).delete();
    } catch {
      // Not critical if invite record doesn't exist
      console.log('No invite record to delete for admin:', adminId);
    }

    console.log(`✅ Admin account deleted: ${adminEmail} (${adminId})`);

    return NextResponse.json({
      success: true,
      message: `Admin account deleted successfully: ${adminEmail}`,
    });
  } catch (error: unknown) {
    console.error('Error deleting admin:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to delete admin' },
      { status: 500 }
    );
  }
}