"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDB } from "@/lib/firebase";
import { getAdminUser, recordLastLogin } from "@/lib/adminAuth";
import { logAuditAction, logSessionStart } from "@/lib/auditLog";
import type { AdminUser } from "@/types/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (next) => {
      setUser(next);
      if (next) {
        let data = await getAdminUser(next.uid);
        if (!data) {
          await new Promise((r) => setTimeout(r, 1000));
          data = await getAdminUser(next.uid);
        }
        setAdminUser(data);
        if (data) {
          await recordLastLogin(next.uid);
          router.push("/admin/pulse");
        }
      } else {
        setAdminUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Both email and password are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const uid = credential.user.uid;

      // Verify user exists in adminUsers collection
      const adminDocSnap = await getDoc(doc(firebaseDB, "adminUsers", uid));
      if (!adminDocSnap.exists()) {
        await signOut(firebaseAuth);
        setError("Access denied. This login is for administrators only.");
        return;
      }

      const adminData = adminDocSnap.data() as AdminUser;
      if (adminData.status === "inactive") {
        await signOut(firebaseAuth);
        setError("Your admin account has been deactivated. Contact the system administrator.");
        return;
      }

      // Log session and audit
      await logSessionStart(uid, credential.user.email ?? email);
      await logAuditAction(
        "user_login",
        uid,
        credential.user.email ?? email,
        "admin",
        uid,
        credential.user.email ?? email,
        { displayName: adminData?.displayName ?? email }
      );

      router.push("/admin/pulse");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please wait a moment and try again.");
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }
    try {
      setError(null);
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setResetSent(true);
    } catch {
      setError("Failed to send password reset email. Please check the address and try again.");
    }
  };

  const handleSignOut = async () => {
    await signOut(firebaseAuth);
    setUser(null);
    setAdminUser(null);
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-slate-950 text-white"
      style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}
    >
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(59,130,246,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 110%, rgba(14,165,233,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        {authLoading ? (
          /* Loading spinner */
          <div className="rounded-3xl border border-white/20 bg-white/10 px-8 py-6 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-orange-500" />
              <span className="text-white/80">Loading admin console…</span>
            </div>
          </div>
        ) : !user ? (
          /* Login form */
          <div className="w-full max-w-xl">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/[0.06] p-8 shadow-[0_30px_90px_rgba(2,6,23,0.55)] backdrop-blur-2xl sm:p-10">
              <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

              <div className="relative z-10 space-y-8">
                {/* Header */}
                <div className="text-center">
                  <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/25 bg-white/10 shadow-[0_0_50px_rgba(59,130,246,0.25)]">
                    <Image
                      src="/logos/liprobakin_logo_2.png"
                      alt="Liprobakin Logo"
                      width={70}
                      height={70}
                      className="h-16 w-16 object-contain"
                      priority
                    />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-300/90">
                    Admin Console
                  </p>
                  <h1 className="mt-3 text-4xl font-bold text-white sm:text-[2.75rem]">
                    League Dashboard
                  </h1>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300/85">
                    Secure access to content management, team administration, and league operations.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-white">Sign in</h2>
                    <p className="text-xs text-slate-400">
                      Enter your credentials to access the admin panel
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-2xl border border-white/20 bg-slate-950/35 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition-all focus:border-blue-400/60 focus:bg-slate-900/60 focus:ring-2 focus:ring-blue-400/20"
                        placeholder="admin@league.com"
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-white/20 bg-slate-950/35 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition-all focus:border-blue-400/60 focus:bg-slate-900/60 focus:ring-2 focus:ring-blue-400/20"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3">
                      <p className="text-sm text-red-200">{error}</p>
                    </div>
                  )}

                  {resetSent && (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                      <p className="text-sm text-emerald-200">
                        Password reset email sent. Please check your inbox.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-2xl border border-blue-300/40 bg-gradient-to-r from-blue-600/90 to-indigo-500/90 px-6 py-3 font-semibold text-white shadow-[0_10px_35px_rgba(37,99,235,0.35)] transition-all hover:from-blue-500 hover:to-indigo-400 hover:shadow-[0_14px_40px_rgba(59,130,246,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Signing In…
                      </span>
                    ) : (
                      "Access Dashboard"
                    )}
                  </button>
                </form>

                {/* Forgot password */}
                <div className="border-t border-white/10 pt-5 text-center">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm font-medium text-blue-300 transition-colors hover:text-blue-200"
                  >
                    Forgot your password?
                  </button>
                </div>

                {/* Footer note */}
                <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Need Access?</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300/85">
                    Contact your master admin to activate your account and assign proper permissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : user && !adminUser ? (
          /* Access Required */
          <div className="w-full max-w-2xl space-y-8">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-white/20 backdrop-blur-xl">
                <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Access Required</h1>
                <p className="text-slate-300/80 text-lg">
                  Your account needs admin privileges to access this dashboard.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/5 backdrop-blur-xl p-8 space-y-4">
              <p className="text-sm font-semibold text-slate-300">Account Status</p>
              <div className="divide-y divide-white/10 text-sm">
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Logged in as:</span>
                  <span className="text-white font-medium">{user.email}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">User ID:</span>
                  <span className="text-white font-mono">{user.uid}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-red-400 font-medium">No admin privileges found</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20"
              >
                Refresh
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-semibold text-white transition-all hover:bg-white/10"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}


