import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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

    // Delete from Firestore
    await db.collection('adminUsers').doc(targetUid).delete();

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
