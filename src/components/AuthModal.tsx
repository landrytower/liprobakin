"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import PasswordResetModal from "./PasswordResetModal";
import { isValidPhoneNumber } from "@/lib/passwordReset";
import { ConfirmationResult } from "firebase/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// DRC country code as default
const DEFAULT_COUNTRY_CODE = "+243";

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const { signUp, signIn, signInWithGoogle, signInWithApple, sendPhoneOTP, verifyPhoneOTP } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("phone"); // Default to phone for DRC users
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);

  // Email signup phone verification step
  const [emailSignupStep, setEmailSignupStep] = useState<"form" | "verify">("form");

  // Phone OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(DEFAULT_COUNTRY_CODE);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Reset OTP state when modal closes or method changes
  useEffect(() => {
    if (!isOpen) {
      setOtpSent(false);
      setOtp("");
      setConfirmationResult(null);
      setCountdown(0);
      setEmailSignupStep("form");
    }
  }, [isOpen]);

  // Send OTP for email signup phone verification
  const handleEmailSignupSendOTP = async () => {
    setError("");
    setLoading(true);

    try {
      // Validate all form fields first
      if (!firstName || !lastName) {
        throw new Error("Please enter your first and last name");
      }
      if (!email) {
        throw new Error("Please enter your email address");
      }
      if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      if (!phoneNumber || phoneNumber === DEFAULT_COUNTRY_CODE) {
        throw new Error("Please enter your phone number");
      }
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new Error("Please enter a valid phone number with country code");
      }

      const result = await sendPhoneOTP(phoneNumber, "recaptcha-container");
      setConfirmationResult(result);
      setEmailSignupStep("verify");
      setCountdown(60);
    } catch (err: any) {
      console.error("OTP send error:", err);
      if (err.code === "auth/invalid-phone-number") {
        setError("Invalid phone number format. Please include country code (e.g., +243...)");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(err.message || "Failed to send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and complete email signup
  const handleEmailSignupVerifyOTP = async () => {
    setError("");
    setLoading(true);

    try {
      if (!confirmationResult) {
        throw new Error("Please request OTP first");
      }
      if (!otp || otp.length < 6) {
        throw new Error("Please enter the 6-digit code");
      }

      // Verify the OTP first (this signs in with phone)
      await verifyPhoneOTP(confirmationResult, otp, firstName, lastName);
      
      // TODO: In future, could link email/password to the phone-verified account
      // For now, the phone verification creates the account
      
      router.push("/profile-setup");
      onClose();
    } catch (err: any) {
      console.error("OTP verify error:", err);
      if (err.code === "auth/invalid-verification-code") {
        setError("Invalid code. Please check and try again.");
      } else if (err.code === "auth/code-expired") {
        setError("Code expired. Please request a new one.");
        setEmailSignupStep("form");
        setOtp("");
      } else {
        setError(err.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    setError("");
    setLoading(true);

    try {
      // Validate phone number
      if (!phoneNumber || phoneNumber === DEFAULT_COUNTRY_CODE) {
        throw new Error("Please enter your phone number");
      }

      if (!isValidPhoneNumber(phoneNumber)) {
        throw new Error("Please enter a valid phone number with country code");
      }

      const result = await sendPhoneOTP(phoneNumber, "recaptcha-container");
      setConfirmationResult(result);
      setOtpSent(true);
      setCountdown(60); // 60 second countdown for resend
    } catch (err: any) {
      console.error("OTP send error:", err);
      if (err.code === "auth/invalid-phone-number") {
        setError("Invalid phone number format. Please include country code (e.g., +243...)");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(err.message || "Failed to send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");
    setLoading(true);

    try {
      if (!confirmationResult) {
        throw new Error("Please request OTP first");
      }

      if (!otp || otp.length < 6) {
        throw new Error("Please enter the 6-digit code");
      }

      // For signup, require name fields
      if (mode === "signup" && (!firstName || !lastName)) {
        throw new Error("Please enter your first and last name");
      }

      await verifyPhoneOTP(
        confirmationResult, 
        otp,
        mode === "signup" ? firstName : undefined,
        mode === "signup" ? lastName : undefined
      );
      
      router.push("/profile-setup");
      onClose();
    } catch (err: any) {
      console.error("OTP verify error:", err);
      if (err.code === "auth/invalid-verification-code") {
        setError("Invalid code. Please check and try again.");
      } else if (err.code === "auth/code-expired") {
        setError("Code expired. Please request a new one.");
        setOtpSent(false);
        setOtp("");
      } else {
        setError(err.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If using phone auth
    if (authMethod === "phone") {
      if (!otpSent) {
        await handleSendOTP();
      } else {
        await handleVerifyOTP();
      }
      return;
    }

    // Email/password auth
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        // For email signup, require phone verification
        if (emailSignupStep === "form") {
          // Validate and send OTP
          setLoading(false);
          await handleEmailSignupSendOTP();
          return;
        } else {
          // Verify OTP and complete signup
          setLoading(false);
          await handleEmailSignupVerifyOTP();
          return;
        }
      } else {
        await signIn(email, password);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setPhoneNumber(DEFAULT_COUNTRY_CODE);
    setError("");
    setOtpSent(false);
    setOtp("");
    setConfirmationResult(null);
    setCountdown(0);
    setEmailSignupStep("form");
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    resetForm();
  };

  const switchAuthMethod = () => {
    setAuthMethod(authMethod === "email" ? "phone" : "email");
    resetForm();
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push("/profile-setup");
      onClose();
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithApple();
      router.push("/profile-setup");
      onClose();
    } catch (err: any) {
      setError(err.message || "Apple sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowResetModal(true);
  };

  const handleResetModalClose = () => {
    setShowResetModal(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-4 sm:px-4 sm:py-6 overflow-y-auto"
        style={{
          background: "rgba(4, 8, 20, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={onClose}
      >
        {/* Modal Container */}
        <div
          className="relative w-full max-w-md my-auto"
          style={{ animation: "slideUp 0.3s ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glassy Card */}
          <div
            className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10"
            style={{
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
            }}
          >
            {/* Decorative gradient orb - hidden on very small screens */}
            <div
              className="hidden sm:block absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-30 blur-3xl pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(56, 189, 248, 0.4) 0%, transparent 70%)",
              }}
            />
            <div
              className="hidden sm:block absolute -bottom-20 -left-20 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%)",
              }}
            />

            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close modal"
              className="absolute right-3 top-3 sm:right-4 sm:top-4 z-50 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-all duration-200 cursor-pointer touch-manipulation"
              type="button"
            >
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="relative z-10 p-5 sm:p-8">
              {/* Header */}
              <div className="text-center mb-4 sm:mb-6">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-500 mb-1.5 sm:mb-2">
                  {mode === "login" ? "Welcome back" : "Get started"}
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  {mode === "login" ? "Sign In" : "Create Account"}
                </h2>
              </div>

              {/* Auth Method Toggle */}
              <div className="flex rounded-lg bg-slate-900/50 p-1 mb-4 sm:mb-5">
                <button
                  type="button"
                  onClick={() => { setAuthMethod("phone"); resetForm(); }}
                  className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    authMethod === "phone"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  📱 Phone
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMethod("email"); resetForm(); }}
                  className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    authMethod === "email"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ✉️ Email
                </button>
              </div>

              {/* reCAPTCHA container (invisible) */}
              <div id="recaptcha-container" ref={recaptchaContainerRef}></div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                
                {/* PHONE AUTH */}
                {authMethod === "phone" && (
                  <>
                    {/* Name fields for signup */}
                    {mode === "signup" && (
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                          <input
                            required
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="First Name"
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                          />
                        </div>
                        <div>
                          <input
                            required
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Last Name"
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Phone Number Input */}
                    {!otpSent ? (
                      <div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                            🇨🇩
                          </span>
                          <input
                            required
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => {
                              let value = e.target.value;
                              // Ensure it starts with + for international format
                              if (value && !value.startsWith("+")) {
                                value = "+" + value;
                              }
                              setPhoneNumber(value);
                            }}
                            placeholder="+243 XXX XXX XXX"
                            className="w-full pl-10 pr-3 sm:pl-12 sm:pr-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                          />
                        </div>
                        <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 pl-1">
                          Default: DRC (+243). Other codes: +1 (US), +44 (UK), +237 (CM)
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* OTP Input */}
                        <div className="text-center mb-2">
                          <p className="text-sm text-slate-400">
                            Code sent to <span className="text-cyan-400">{phoneNumber}</span>
                          </p>
                        </div>
                        <div>
                          <input
                            required
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            placeholder="Enter 6-digit code"
                            className="w-full px-3 sm:px-4 py-3 sm:py-4 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white text-center text-lg sm:text-xl tracking-[0.5em] placeholder:text-slate-500 placeholder:tracking-normal focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                            autoFocus
                          />
                        </div>
                        {/* Resend OTP */}
                        <div className="text-center">
                          {countdown > 0 ? (
                            <p className="text-xs text-slate-500">
                              Resend code in <span className="text-cyan-400">{countdown}s</span>
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setOtpSent(false); setOtp(""); }}
                              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              ← Change number or resend code
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* EMAIL AUTH */}
                {authMethod === "email" && (
                  <>
                    {mode === "signup" && emailSignupStep === "verify" ? (
                      /* Phone Verification Step for Email Signup */
                      <>
                        <div className="text-center mb-2">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/20 mb-3">
                            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-sm text-slate-300 font-medium">Verify Your Phone</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Enter the code sent to <span className="text-cyan-400">{phoneNumber}</span>
                          </p>
                        </div>
                        <div>
                          <input
                            required
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            placeholder="Enter 6-digit code"
                            className="w-full px-3 sm:px-4 py-3 sm:py-4 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white text-center text-lg sm:text-xl tracking-[0.5em] placeholder:text-slate-500 placeholder:tracking-normal focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                            autoFocus
                          />
                        </div>
                        {/* Resend OTP */}
                        <div className="text-center">
                          {countdown > 0 ? (
                            <p className="text-xs text-slate-500">
                              Resend code in <span className="text-cyan-400">{countdown}s</span>
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setEmailSignupStep("form"); setOtp(""); setConfirmationResult(null); }}
                              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              ← Back to form or resend code
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {mode === "signup" && (
                          <>
                            {/* Name Fields */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div>
                                <input
                                  required
                                  type="text"
                                  value={firstName}
                                  onChange={(e) => setFirstName(e.target.value)}
                                  placeholder="First Name"
                                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                                />
                              </div>
                              <div>
                                <input
                                  required
                                  type="text"
                                  value={lastName}
                                  onChange={(e) => setLastName(e.target.value)}
                                  placeholder="Last Name"
                                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                                />
                              </div>
                            </div>

                            {/* Phone for email signup */}
                            <div>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <input
                                  required
                                  type="tel"
                                  value={phoneNumber}
                                  onChange={(e) => setPhoneNumber(e.target.value)}
                                  placeholder="Phone (+243...)"
                                  className="w-full pl-10 pr-3 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-slate-500 pl-1">
                                📱 A verification code will be sent to this number
                              </p>
                            </div>
                          </>
                        )}

                        {/* Email */}
                        <div>
                          <input
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email address"
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                          />
                        </div>

                        {/* Password */}
                        <div>
                          <input
                            required
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            minLength={6}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                          />
                        </div>

                        {/* Forgot Password */}
                        {mode === "login" && (
                          <div className="text-right">
                            <button
                              type="button"
                              onClick={handleForgotPassword}
                              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              Forgot Password?
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Error Message */}
                {error && (
                  <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm text-center">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 sm:py-3.5 rounded-lg sm:rounded-xl font-semibold text-sm uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-500/20 to-sky-500/20 border border-cyan-500/30 text-cyan-400 hover:from-cyan-500/30 hover:to-sky-500/30 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] touch-manipulation"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {authMethod === "phone" && otpSent ? "Verifying..." : 
                       authMethod === "email" && mode === "signup" && emailSignupStep === "verify" ? "Verifying..." : 
                       "Processing..."}
                    </span>
                  ) : authMethod === "phone" ? (
                    otpSent ? "Verify Code" : "Send Code"
                  ) : mode === "login" ? (
                    "Sign In"
                  ) : emailSignupStep === "verify" ? (
                    "Verify & Create Account"
                  ) : (
                    "Send Verification Code"
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-4 sm:my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 sm:px-4 text-[10px] sm:text-xs text-slate-500" style={{ background: "rgba(15, 23, 42, 0.95)" }}>
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social Buttons */}
              <div className="flex justify-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  aria-label="Sign in with Google"
                  className="flex items-center justify-center w-14 h-14 sm:w-12 sm:h-12 rounded-xl bg-slate-900/70 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-white/20 active:bg-slate-700/70 transition-all duration-200 disabled:opacity-50 touch-manipulation"
                >
                  <svg className="w-6 h-6 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={loading}
                  aria-label="Sign in with Apple"
                  className="flex items-center justify-center w-14 h-14 sm:w-12 sm:h-12 rounded-xl bg-slate-900/70 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-white/20 active:bg-slate-700/70 transition-all duration-200 disabled:opacity-50 touch-manipulation"
                >
                  <svg className="w-6 h-6 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                </button>
              </div>

              {/* Terms */}
              <p className="mt-4 sm:mt-6 text-center text-[10px] sm:text-xs text-slate-500 leading-relaxed">
                By continuing, you agree to our{" "}
                <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                  Privacy Policy
                </a>
              </p>

              {/* Switch Mode */}
              <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-slate-400">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Password Reset Modal */}
      <PasswordResetModal 
        isOpen={showResetModal} 
        onClose={handleResetModalClose}
      />
    </>
  );
}
