import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin (only once)
if (!getApps().length && process.env.FIREBASE_PROJECT_ID) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
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
    const storage = getStorage();

    // Verify the deleter is an admin
    const deleterDoc = await db.collection('adminUsers').doc(deletedByUid).get();
    if (!deleterDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Get user data before deletion
    const userDoc = await db.collection('users').doc(targetUid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const userEmail = userData?.email || 'unknown';
    const userName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'unknown';
    const deleterEmail = deleterDoc.data()?.email || 'unknown';

    // 1. Delete user's headshot from storage if exists
    const headshotPaths = [
      `headshots/${targetUid}/`,
      `headshot-updates/${targetUid}/`,
      `verification-photos/${targetUid}/`,
    ];

    for (const path of headshotPaths) {
      try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles({ prefix: path });
        
        for (const file of files) {
          try {
            await file.delete();
            console.log(`Deleted file: ${file.name}`);
          } catch (fileError) {
            console.error(`Error deleting file ${file.name}:`, fileError);
          }
        }
      } catch (storageError) {
        console.error(`Error accessing storage path ${path}:`, storageError);
      }
    }

    // 2. Delete from Firebase Auth
    try {
      await auth.deleteUser(targetUid);
      console.log(`Deleted user from Firebase Auth: ${targetUid}`);
    } catch (authError: any) {
      console.error('Auth deletion error:', authError);
      // Continue even if auth deletion fails (user might already be deleted)
    }

    // 3. Delete verification requests
    const verificationQuery = await db.collection('verificationRequests')
      .where('userId', '==', targetUid)
      .get();
    
    const deleteVerificationPromises = verificationQuery.docs.map(doc => doc.ref.delete());
    await Promise.all(deleteVerificationPromises);
    console.log(`Deleted ${verificationQuery.docs.length} verification requests`);

    // 4. If user is linked to a player/coach/staff, remove the link but keep the roster entry
    if (userData?.linkedPlayerId && userData?.teamId) {
      const playerRef = db.collection('teams').doc(userData.teamId)
        .collection('roster').doc(userData.linkedPlayerId);
      
      await playerRef.update({
        linkedUserId: FieldValue.delete(),
        linkedUserEmail: FieldValue.delete(),
        linkedAt: FieldValue.delete(),
        verificationStatus: 'unverified',
      });
      console.log(`Unlinked player: ${userData.linkedPlayerId}`);
    }

    if (userData?.linkedCoachId && userData?.teamId) {
      const coachRef = db.collection('teams').doc(userData.teamId)
        .collection('coachStaff').doc(userData.linkedCoachId);
      
      await coachRef.update({
        linkedUserId: FieldValue.delete(),
        linkedUserEmail: FieldValue.delete(),
        linkedAt: FieldValue.delete(),
        verificationStatus: 'unverified',
      });
      console.log(`Unlinked coach: ${userData.linkedCoachId}`);
    }

    if (userData?.linkedStaffId && userData?.teamId) {
      const staffRef = db.collection('teams').doc(userData.teamId)
        .collection('staff').doc(userData.linkedStaffId);
      
      await staffRef.update({
        linkedUserId: FieldValue.delete(),
        linkedUserEmail: FieldValue.delete(),
        linkedAt: FieldValue.delete(),
      });
      console.log(`Unlinked staff: ${userData.linkedStaffId}`);
    }

    // 5. Delete from Firestore users collection
    await db.collection('users').doc(targetUid).delete();
    console.log(`Deleted user document: ${targetUid}`);

    // 6. Log audit trail
    const deviceInfo = {
      userAgent: request.headers.get('user-agent') || 'unknown',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      timestamp: new Date().toISOString(),
    };

    await db.collection('auditLogs').add({
      action: 'regular_user_deleted',
      userId: deletedByUid,
      userEmail: deleterEmail,
      targetType: 'user',
      targetId: targetUid,
      targetName: userName,
      details: {
        email: userEmail,
        role: userData?.role || 'unknown',
        teamName: userData?.teamName || null,
        linkedPlayerId: userData?.linkedPlayerId || null,
        linkedCoachId: userData?.linkedCoachId || null,
        deletedViaAPI: true,
        storageCleanedUp: true,
      },
      deviceInfo,
      timestamp: FieldValue.serverTimestamp(),
    });

    console.log(`✅ User deleted completely: ${userEmail} by ${deleterEmail}`);

    return NextResponse.json({
      success: true,
      message: 'User and associated data deleted successfully',
      deletedUser: {
        uid: targetUid,
        email: userEmail,
        name: userName,
      },
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
