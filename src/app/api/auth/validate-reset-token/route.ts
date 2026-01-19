import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    console.log('🔍 Validating reset token:', token);

    // Get Firestore instance
    const db = getAdminFirestore();

    // Query Firestore for the reset token
    const resetTokensRef = db.collection('passwordResetTokens');
    const tokenQuery = await resetTokensRef.where('token', '==', token).get();

    if (tokenQuery.empty) {
      console.log('❌ Reset token not found');
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 404 });
    }

    const tokenDoc = tokenQuery.docs[0];
    const tokenData = tokenDoc.data();

    // Check if token has expired
    const now = new Date();
    const expiresAt = tokenData.expiresAt.toDate();

    if (now > expiresAt) {
      console.log('⏰ Reset token has expired');
      // Delete expired token
      await tokenDoc.ref.delete();
      return NextResponse.json({ error: 'Reset token has expired' }, { status: 410 });
    }

    console.log('✅ Reset token is valid');

    return NextResponse.json({ 
      valid: true, 
      userId: tokenData.userId 
    });

  } catch (error) {
    console.error('❌ Error validating reset token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}