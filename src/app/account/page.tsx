"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountPage() {
  const { user, userProfile, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
    }
  }, [user, router]);

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-[-200px] h-[500px] bg-[radial-gradient(circle,_rgba(56,189,248,0.35),_transparent_60%)] blur-3xl" aria-hidden />
      
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-5 md:px-12">
          <Link href="/" className="flex items-center gap-3 text-xl font-semibold tracking-[0.3em] text-white hover:text-blue-400 transition">
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <div className="w-32"></div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-12 md:px-12">
        {/* Sign Out Button at Top */}
        <div className="mb-8 flex justify-end">
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="rounded-lg bg-red-600 hover:bg-red-700 px-6 py-3 text-sm font-semibold text-white transition shadow-lg"
            type="button"
          >
            🚪 Sign Out
          </button>
        </div>

        {/* Account Details Card */}
        <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 pb-6 mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">Account Details</h2>
            <p className="text-slate-400">Your profile information and settings</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Name */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Full Name</label>
              <p className="text-lg text-white font-medium">{userProfile.firstName} {userProfile.lastName}</p>
              <p className="text-xs text-slate-500 mt-2">🔒 Cannot be modified</p>
            </div>

            {/* Email */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Email Address</label>
              <p className="text-lg text-white font-medium break-all">{user.email}</p>
            </div>

            {/* Phone */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Phone Number</label>
              <p className="text-lg text-white font-medium">{userProfile.phoneNumber}</p>
            </div>

            {/* Role */}
            {userProfile.role && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Role</label>
                <p className="text-lg text-white font-medium capitalize">{userProfile.role}</p>
              </div>
            )}

            {/* Team */}
            {userProfile.teamName && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Team</label>
                <p className="text-lg text-white font-medium">{userProfile.teamName}</p>
              </div>
            )}

            {/* Jersey Number */}
            {userProfile.playerNumber && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Jersey Number</label>
                <p className="text-lg text-white font-medium">#{userProfile.playerNumber}</p>
              </div>
            )}

            {/* Position */}
            {userProfile.position && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Position</label>
                <p className="text-lg text-white font-medium">{userProfile.position}</p>
              </div>
            )}

            {/* Verification Status */}
            {userProfile.verificationStatus && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Verification Status</label>
                <p className={`text-lg font-bold flex items-center gap-2 ${
                  userProfile.verificationStatus === 'approved' ? 'text-green-400' :
                  userProfile.verificationStatus === 'pending' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {userProfile.verificationStatus === 'approved' ? (
                    <>
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </>
                  ) : userProfile.verificationStatus === 'pending' ? (
                    <>
                      <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Pending
                    </>
                  ) : (
                    <>
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Rejected
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Favorite Team */}
            {userProfile.favoriteTeamName && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Favorite Team</label>
                <p className="text-lg text-white font-medium">⭐ {userProfile.favoriteTeamName}</p>
              </div>
            )}

            {/* Favorite Athlete */}
            {userProfile.favoriteAthleteName && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Favorite Athlete</label>
                <p className="text-lg text-white font-medium">⭐ {userProfile.favoriteAthleteName}</p>
              </div>
            )}
          </div>

          {/* Account Created Date */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-sm text-slate-400">
              Account created on {userProfile.createdAt?.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
