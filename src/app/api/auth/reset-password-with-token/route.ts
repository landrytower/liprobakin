import { NextRequest, NextResponse } from 'next/server';
import { firebaseDB } from '@/lib/firebase';
import bcrypt from 'bcryptjs';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
    const resetTokensRef = collection(firebaseDB, 'passwordResetTokens');
    const tokenQuerySnapshot = await getDocs(query(resetTokensRef, where('token', '==', token)));

    if (tokenQuerySnapshot.empty) {
      console.log('❌ Reset token not found');
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 404 });
    }

    const tokenDocSnap = tokenQuerySnapshot.docs[0];
    const tokenData = tokenDocSnap.data();

    // Check if token has expired
    const now = new Date();
    const expiresAt = tokenData.expiresAt.toDate();

    if (now > expiresAt) {
      console.log('⏰ Reset token has expired');
      // Delete expired token
      await deleteDoc(tokenDocSnap.ref);
      return NextResponse.json({ error: 'Reset token has expired' }, { status: 410 });
    }

    const userId = tokenData.userId;

    // Get the user document
    const userRef = doc(firebaseDB, 'users', userId);
    const userDocSnap = await getDoc(userRef);

    if (!userDocSnap.exists()) {
      console.log('❌ User not found:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password
    await updateDoc(userRef, {
      password: hashedPassword,
      updatedAt: new Date()
    });

    // Delete the used token
    await deleteDoc(tokenDocSnap.ref);

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