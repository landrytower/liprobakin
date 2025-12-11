'use client';

import { useState } from 'react';
import { firebaseAuth, firebaseDB } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function SetupAdminPage() {
  const [email, setEmail] = useState('bobiyatch@gmail.com');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');

    try {
      // Sign in with the email/password
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;

      // Create the admin user document in Firestore
      await setDoc(doc(firebaseDB, 'adminUsers', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || email.split('@')[0],
        roles: ['master'],
        isActive: true,
        isFirstLogin: false,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });

      setStatus('✅ Master admin created successfully! You can now go to /admin');
    } catch (error: any) {
      console.error('Setup error:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center text-white">
          <h1 className="text-3xl font-bold">Setup Master Admin</h1>
          <p className="text-sm text-slate-400">
            Sign in with your Firebase account to grant it master admin access
          </p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-6">
          <div className="space-y-2">
            <label className="block text-sm text-slate-300">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 focus:border-white"
                required
              />
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-slate-300">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 focus:border-white"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Create Master Admin'}
          </button>

          {status && (
            <p className={`text-sm ${status.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
              {status}
            </p>
          )}
        </form>

        <p className="text-center text-xs text-slate-500">
          This page will create an admin user document for the Firebase account you sign in with.
          <br />
          After setup, you can delete this page or protect it.
        </p>
      </div>
    </div>
  );
}
