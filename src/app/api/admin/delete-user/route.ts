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
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { targetUid, deletedByUid } = await request.json();

    if (!targetUid || !deletedByUid) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const auth = getAuth();
    const db = getFirestore();

    // Verify the deleter is a master admin
    const deleterDoc = await db.collection('adminUsers').doc(deletedByUid).get();
    if (!deleterDoc.exists || !deleterDoc.data()?.roles?.includes('master')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only master admins can delete users' },
        { status: 403 }
      );
    }

    // Prevent self-deletion
    if (targetUid === deletedByUid) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if target is a master admin
    const targetDoc = await db.collection('adminUsers').doc(targetUid).get();
    if (targetDoc.exists && targetDoc.data()?.roles?.includes('master')) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete another master admin' },
        { status: 403 }
      );
    }

    // Delete from Firebase Auth
    try {
      await auth.deleteUser(targetUid);
    } catch (authError: any) {
      console.error('Auth deletion error:', authError);
      // Continue even if auth deletion fails (user might already be deleted)
    }

    // Get info before deletion for audit log
    const targetEmail = targetDoc.exists ? targetDoc.data()?.email : 'unknown';
    const targetName = targetDoc.exists ? targetDoc.data()?.displayName : 'unknown';
    const deleterEmail = deleterDoc.data()?.email || 'unknown';

    // Delete from Firestore
    await db.collection('adminUsers').doc(targetUid).delete();

    // Get device info from request headers
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceInfo = {
      userAgent,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Log comprehensive audit trail
    await db.collection('auditLogs').add({
      action: 'admin_user_deleted',
      userId: deletedByUid,
      userEmail: deleterEmail,
      targetType: 'admin',
      targetId: targetUid,
      targetName: targetEmail,
      details: {
        displayName: targetName,
        deletedViaAPI: true,
      },
      deviceInfo,
      timestamp: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Admin user deleted: ${targetEmail} by ${deleterEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Admin user deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting admin user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
