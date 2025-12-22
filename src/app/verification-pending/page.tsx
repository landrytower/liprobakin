"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function VerificationPending() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  useEffect(() => {
    if (!user) {
      router.push("/");
    }
    if (userProfile?.verificationStatus === "approved") {
      router.push("/");
    }
  }, [user, userProfile, router]);

  if (!user || !userProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 to-slate-950 p-8 text-center shadow-2xl">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full border-4 border-yellow-500/20 bg-yellow-500/10 p-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-yellow-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          <h1 className="mb-4 text-3xl font-bold text-white">Verification Pending</h1>

          <p className="mb-6 text-slate-300">
            Thank you for submitting your verification request. Your account is currently under review by our
            administrators.
          </p>

          <div className="mb-8 rounded-lg border border-blue-500/50 bg-blue-500/10 p-4 text-sm text-blue-300">
            <strong>What happens next?</strong>
            <ul className="mt-2 space-y-1 text-left">
              <li>• Our admin team will review your ID and profile information</li>
              <li>• You will receive an email notification once your account is approved</li>
              <li>• This process typically takes 1-2 business days</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Link
              href="/"
              className="block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Return to Home
            </Link>
            <p className="text-sm text-slate-400">
              Questions? Contact support at{" "}
              <a href="mailto:support@liprobakin.com" className="text-blue-400 hover:text-blue-300">
                support@liprobakin.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
