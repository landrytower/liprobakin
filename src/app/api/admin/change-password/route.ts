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
    const { uid, newPassword, changedByUid } = await request.json();

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
    const targetEmail = targetDoc.exists ? targetDoc.data()?.email : 'unknown';
    const targetName = targetDoc.exists ? targetDoc.data()?.displayName : 'unknown';
    
    let changerEmail = 'system';
    if (changedByUid) {
      const changerDoc = await db.collection('adminUsers').doc(changedByUid).get();
      changerEmail = changerDoc.exists ? changerDoc.data()?.email || 'unknown' : 'unknown';
    }

    // Get device info from request headers
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceInfo = {
      userAgent,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Log comprehensive audit trail
    await db.collection('auditLogs').add({
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
    });

    console.log(`✅ Password changed for ${targetEmail} by ${changerEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to change password' },
      { status: 500 }
    );
  }
}
