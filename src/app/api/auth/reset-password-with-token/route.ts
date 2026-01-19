import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    console.log('🔐 Processing password reset with token:', token);

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

    const userId = tokenData.userId;

    // Get the user document
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log('❌ User not found:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password
    await userRef.update({
      password: hashedPassword,
      updatedAt: new Date()
    });

    // Delete the used token
    await tokenDoc.ref.delete();

    console.log('✅ Password reset successfully for user:', userId);

    return NextResponse.json({ 
      message: 'Password reset successfully',
      success: true 
    });

  } catch (error) {
    console.error('❌ Error resetting password with token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}