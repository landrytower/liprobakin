'use client';

import { useState } from 'react';

export default function SetupAdminPage() {
  const [email, setEmail] = useState('bobiyatch@gmail.com');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuthHelp, setShowAuthHelp] = useState(false);

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const authConsoleUrl = projectId
    ? `https://console.firebase.google.com/project/${projectId}/authentication/providers`
    : 'https://console.firebase.google.com';

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');
    setShowAuthHelp(false);

    try {
      const response = await fetch('/api/setup-admin/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: email.split('@')[0],
        }),
      });

      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to bootstrap admin account.');
      }

      setStatus('✅ Master admin created successfully! You can now go to /admin');
    } catch (error: unknown) {
      console.error('Setup error:', error);
      const firebaseCode = (error as { code?: string })?.code;

      if (firebaseCode === 'auth/configuration-not-found' || firebaseCode === 'auth/operation-not-allowed') {
        setShowAuthHelp(true);
        setStatus('❌ Firebase Authentication is not configured for this project yet.');
      } else {
        setStatus(`❌ Error: ${(error as Error).message}`);
      }
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

          {showAuthHelp && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
              <p>
                Go to Firebase Console → Authentication → Get started, then enable Email/Password provider.
              </p>
              <a
                href={authConsoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg border border-amber-300/40 px-3 py-1.5 text-amber-100 hover:bg-amber-300/10"
              >
                Open Authentication Settings
              </a>
            </div>
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
