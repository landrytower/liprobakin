import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { AdminRole } from '@/types/admin';
import { mergePermissions } from '@/types/admin';

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  // For production, use environment variables
  // For now, you'll need to add your service account
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
    const { email, displayName, password, roles, createdByUid } = await request.json();

    if (!email || !displayName || !password || !roles || !Array.isArray(roles) || !createdByUid) {
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

    const auth = getAuth();
    const db = getFirestore();

    // Verify the creator is a master admin
    const creatorDoc = await db.collection('adminUsers').doc(createdByUid).get();
    if (!creatorDoc.exists || !creatorDoc.data()?.roles?.includes('master')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(email);
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'An admin with this email already exists' },
          { status: 409 }
        );
      }
    } catch (error: any) {
      // User doesn't exist, continue with creation
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create user in Firebase Auth with password
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });

    // Create admin user document in Firestore
    await db.collection('adminUsers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: displayName,
      roles,
      permissions: mergePermissions(roles as AdminRole[]),
      isFirstLogin: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: createdByUid,
      lastLogin: null,
      isActive: true,
    });

    console.log(`✅ Admin user created: ${email} with roles:`, roles);

    return NextResponse.json({
      success: true,
      userId: userRecord.uid,
      message: `User created successfully. They can log in with their email and password.`,
    });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
