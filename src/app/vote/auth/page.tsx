"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "signin" | "register";

const DRC_CARRIERS = ["Vodacom", "Airtel", "Africel", "Orange"];

function PhoneFlag() {
  return (
    <span className="text-sm select-none shrink-0 mr-1" title="DRC +243">
      🇨🇩
    </span>
  );
}

function formatDRCPlaceholder(val: string) {
  const digits = val.replace(/\D/g, "");
  return digits;
}

export default function VoteAuthPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sign-in fields
  const [siInput, setSiInput] = useState(""); // phone or email
  const [siPassword, setSiPassword] = useState("");

  // Register fields
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(siInput.trim(), siPassword);
      router.push("/vote");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(formatAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (regPassword !== regConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!regPhone.trim()) {
      setError("Phone number is required.");
      return;
    }

    // Build E.164 from DRC input — if starts with 0, replace with +243
    const rawPhone = regPhone.trim();
    let normalizedPhone: string;
    if (rawPhone.startsWith("+")) {
      normalizedPhone = rawPhone;
    } else if (rawPhone.startsWith("0")) {
      normalizedPhone = "+243" + rawPhone.slice(1);
    } else if (rawPhone.startsWith("243")) {
      normalizedPhone = "+" + rawPhone;
    } else {
      normalizedPhone = "+243" + rawPhone;
    }

    setLoading(true);
    try {
      await signUp(regEmail.trim(), regPassword, regFirstName.trim(), regLastName.trim(), normalizedPhone);
      router.push("/vote");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setError(formatAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Navbar */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/logos/liprobakin.png" alt="Logo" width={32} height={32} className="rounded-full border border-white/20 object-cover" />
            <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              All-Star Vote
            </h1>
          </div>
          <div className="w-5" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">

          {/* Hero copy */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏀</div>
            <h2 className="text-2xl font-black text-white mb-1">
              {mode === "signin" ? "Welcome back" : "Join the vote"}
            </h2>
            <p className="text-sm text-slate-400">
              {mode === "signin"
                ? "Sign in to cast your All-Star vote"
                : "Create a free account to vote for your All-Stars"}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex bg-slate-800/60 rounded-xl p-1 mb-6 border border-white/5">
            {(["register", "signin"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  mode === m
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {m === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Sign In Form ── */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Phone number or email
                </label>
                <input
                  type="text"
                  value={siInput}
                  onChange={(e) => setSiInput(e.target.value)}
                  placeholder="0812345678 or name@email.com"
                  autoComplete="username"
                  required
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  value={siPassword}
                  onChange={(e) => setSiPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Signing in…
                  </span>
                ) : "Sign In"}
              </button>

              <p className="text-center text-xs text-slate-500 pt-2">
                No account yet?{" "}
                <button type="button" onClick={() => switchMode("register")} className="text-emerald-400 font-semibold hover:underline">
                  Create one — it&apos;s free
                </button>
              </p>
            </form>
          )}

          {/* ── Register Form ── */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    First name
                  </label>
                  <input
                    type="text"
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="Jean"
                    autoComplete="given-name"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="Lokwa"
                    autoComplete="family-name"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Phone number */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Phone number
                  <span className="ml-1 text-slate-600 normal-case tracking-normal font-normal">(Vodacom, Airtel, Africel, Orange)</span>
                </label>
                <div className="relative flex items-center bg-slate-800 border border-white/10 rounded-xl px-4 py-3 focus-within:border-emerald-500 transition-colors">
                  <PhoneFlag />
                  <span className="text-slate-400 text-sm mr-1 shrink-0">+243</span>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(formatDRCPlaceholder(e.target.value))}
                    placeholder="812 345 678"
                    autoComplete="tel"
                    required
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none min-w-0"
                  />
                </div>
                <p className="text-[11px] text-slate-600 mt-1 pl-1">Enter your DRC mobile number without the country code</p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="yourname@email.com"
                  autoComplete="email"
                  required
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPass ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    required
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    tabIndex={-1}
                  >
                    {showRegPass ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Confirm password
                </label>
                <input
                  type={showRegPass ? "text" : "password"}
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  required
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Creating account…
                  </span>
                ) : "Create Account & Vote"}
              </button>

              <p className="text-center text-xs text-slate-500 pt-2">
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("signin")} className="text-emerald-400 font-semibold hover:underline">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Carrier badges */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <p className="text-center text-[11px] text-slate-600 mb-3 uppercase tracking-wider">Works with</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {DRC_CARRIERS.map((c) => (
                <span key={c} className="px-3 py-1 rounded-full bg-slate-800/60 border border-white/5 text-xs text-slate-400 font-medium">
                  {c}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function formatAuthError(msg: string): string {
  if (msg.includes("email-already-in-use") || msg.includes("already registered")) return "This email is already registered. Sign in instead.";
  if (msg.includes("wrong-password") || msg.includes("invalid-credential")) return "Wrong email or password. Please try again.";
  if (msg.includes("user-not-found") || msg.includes("No account found")) return "No account found with that phone or email.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("network-request-failed")) return "Network error. Check your connection and try again.";
  if (msg.includes("Admin accounts")) return msg;
  return msg;
}
