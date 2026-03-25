"use client";

import { useState, useEffect } from "react";
import { sendPasswordResetEmail, ActionCodeSettings } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase/firestore";

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ResetStep = "request" | "verify" | "reset" | "success" | "email-sent";

export default function PasswordResetModal({ isOpen, onClose }: PasswordResetModalProps) {
  const [step, setStep] = useState<ResetStep>("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form fields
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Store user data for password reset
  const [userId, setUserId] = useState("");
  const [sentTo, setSentTo] = useState<"email" | "phone">("email");
  const [maskedInfo, setMaskedInfo] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Check if it's an email format
      const isEmail = emailOrPhone.includes('@');
      
      if (isEmail) {
        // First verify the user exists in our database
        const usersRef = collection(firebaseDB, "users");
        const emailQuery = query(usersRef, where("email", "==", emailOrPhone.toLowerCase().trim()));
        const userSnapshot = await getDocs(emailQuery);
        
        if (userSnapshot.empty) {
          throw new Error("No account found with this email address.");
        }

        // Configure action code settings for better email delivery
        const actionCodeSettings: ActionCodeSettings = {
          url: typeof window !== 'undefined' ? `${window.location.origin}/?resetPassword=true` : 'https://febaco.com',
          handleCodeInApp: false,
        };

        // Use Firebase's built-in password reset for email
        await sendPasswordResetEmail(firebaseAuth, emailOrPhone.toLowerCase().trim(), actionCodeSettings);
        setMaskedInfo(emailOrPhone);
        setResendTimer(60); // 60 second cooldown
        setStep("email-sent");
      } else {
        // Use custom API for phone number reset
        const response = await fetch("/api/auth/send-reset-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailOrPhone }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to send reset code");
        }

        setSentTo(data.sentTo);
        setMaskedInfo(data.maskedInfo);
        setSuccess(data.message);
        setResendTimer(60);
        setStep("verify");
      }
    } catch (err: any) {
      // Handle specific Firebase errors
      if (err.code === 'auth/user-not-found') {
        setError("No account found with this email address.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many requests. Please wait a few minutes and try again.");
      } else {
        setError(err.message || "Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendTimer > 0) return;
    
    setError("");
    setLoading(true);
    
    try {
      const actionCodeSettings: ActionCodeSettings = {
        url: typeof window !== 'undefined' ? `${window.location.origin}/?resetPassword=true` : 'https://febaco.com',
        handleCodeInApp: false,
      };
      
      await sendPasswordResetEmail(firebaseAuth, emailOrPhone.toLowerCase().trim(), actionCodeSettings);
      setSuccess("Reset email sent again! Please check your inbox and spam folder.");
      setResendTimer(60);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setError("Too many requests. Please wait a few minutes and try again.");
      } else {
        setError("Failed to resend email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid code");
      }

      setUserId(data.userId);
      setSuccess("Code verified! Enter your new password.");
      setStep("reset");
    } catch (err: any) {
      setError(err.message || "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Call API to reset password using Firebase Admin SDK
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      if (data.passwordUpdated) {
        setSuccess("Your password has been reset successfully! You can now sign in with your new password.");
      } else {
        setSuccess("Password reset processed. Please try signing in with your new password.");
      }
      
      setStep("success");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/send-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend code");
      }

      setSuccess("New code sent!");
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmailOrPhone("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    setUserId("");
    setStep("request");
    setResendTimer(0);
    setMaskedInfo("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <style jsx>{`
        .reset-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .reset-container {
          max-width: 400px;
          width: 100%;
          background: linear-gradient(0deg, rgb(255, 255, 255) 0%, rgb(244, 247, 251) 100%);
          border-radius: 40px;
          padding: 25px 35px;
          border: 5px solid rgb(255, 255, 255);
          box-shadow: rgba(133, 189, 215, 0.878) 0px 30px 30px -20px;
          position: relative;
          animation: zoomIn 0.2s ease-out;
        }

        @keyframes zoomIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .close-button {
          position: absolute;
          right: 15px;
          top: 15px;
          background: rgba(0, 0, 0, 0.1);
          border: none;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 20px;
          color: #666;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: rgba(0, 0, 0, 0.2);
          transform: scale(1.1);
        }

        .heading {
          text-align: center;
          font-weight: 900;
          font-size: 28px;
          color: rgb(16, 137, 211);
          margin-bottom: 10px;
        }

        .subheading {
          text-align: center;
          font-size: 13px;
          color: rgb(100, 100, 100);
          margin-bottom: 20px;
        }

        .reset-form {
          margin-top: 20px;
        }

        .reset-input {
          width: 100%;
          background: white;
          border: none;
          padding: 15px 20px;
          border-radius: 20px;
          margin-top: 15px;
          box-shadow: #cff0ff 0px 10px 10px -5px;
          border-inline: 2px solid transparent;
          font-size: 14px;
          color: #000;
        }

        .reset-input::placeholder {
          color: rgb(170, 170, 170);
        }

        .reset-input:focus {
          outline: none;
          border-inline: 2px solid #12B1D1;
        }

        .code-input {
          font-size: 24px;
          text-align: center;
          letter-spacing: 10px;
          font-weight: bold;
        }

        .error-message {
          margin-top: 15px;
          padding: 12px 15px;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 15px;
          color: #c33;
          font-size: 13px;
          text-align: center;
        }

        .success-message {
          margin-top: 15px;
          padding: 12px 15px;
          background: #efe;
          border: 1px solid #cfc;
          border-radius: 15px;
          color: #363;
          font-size: 13px;
          text-align: center;
        }

        .submit-button {
          display: block;
          width: 100%;
          font-weight: bold;
          background: linear-gradient(45deg, rgb(16, 137, 211) 0%, rgb(18, 177, 209) 100%);
          color: white;
          padding: 15px;
          margin: 20px auto 10px;
          border-radius: 20px;
          box-shadow: rgba(133, 189, 215, 0.878) 0px 20px 10px -15px;
          border: none;
          transition: all 0.2s ease-in-out;
          cursor: pointer;
          font-size: 14px;
        }

        .submit-button:hover:not(:disabled) {
          transform: scale(1.03);
          box-shadow: rgba(133, 189, 215, 0.878) 0px 23px 10px -20px;
        }

        .submit-button:active:not(:disabled) {
          transform: scale(0.95);
          box-shadow: rgba(133, 189, 215, 0.878) 0px 15px 10px -10px;
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .resend-button {
          background: none;
          border: none;
          color: #0099ff;
          text-decoration: underline;
          cursor: pointer;
          font-size: 12px;
          margin-top: 10px;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }

        .resend-button:hover:not(:disabled) {
          color: rgb(16, 137, 211);
        }

        .resend-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .back-button {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 12px;
          margin-top: 10px;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }

        .back-button:hover {
          color: #333;
          text-decoration: underline;
        }

        .success-icon {
          font-size: 60px;
          text-align: center;
          color: #4CAF50;
          margin-bottom: 20px;
        }

        .info-box {
          background: #f0f8ff;
          border: 1px solid #b3d9ff;
          border-radius: 15px;
          padding: 12px 15px;
          margin-top: 15px;
          font-size: 12px;
          color: #0066cc;
        }

        .phone-hint {
          display: block;
          font-size: 10px;
          color: rgb(120, 120, 120);
          margin-top: 5px;
          margin-left: 10px;
        }
      `}</style>

      <div className="reset-modal-overlay" onClick={handleClose}>
        <div className="reset-container" onClick={(e) => e.stopPropagation()}>
          <button onClick={handleClose} className="close-button" type="button">
            ×
          </button>

          {step === "request" && (
            <>
              <div className="heading">Reset Password</div>
              <div className="subheading">
                Enter your email or phone number to receive a reset code
              </div>

              <form onSubmit={handleRequestCode} className="reset-form">
                <input
                  required
                  className="reset-input"
                  type="text"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="Email or Phone (e.g., +237...)"
                />
                <div className="phone-hint">
                  For phone: include country code (+1 US, +44 UK, +237 Cameroon)
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <button type="submit" disabled={loading} className="submit-button">
                  {loading ? "Sending..." : "Send Reset Code"}
                </button>
              </form>
            </>
          )}

          {step === "verify" && (
            <>
              <div className="heading">Enter Code</div>
              <div className="subheading">
                We sent a 6-digit code to {maskedInfo}
              </div>

              <form onSubmit={handleVerifyCode} className="reset-form">
                <input
                  required
                  className="reset-input code-input"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                />

                <div className="info-box">
                  Code expires in 10 minutes
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <button type="submit" disabled={loading || code.length !== 6} className="submit-button">
                  {loading ? "Verifying..." : "Verify Code"}
                </button>

                <button 
                  type="button" 
                  onClick={handleResendCode} 
                  disabled={loading}
                  className="resend-button"
                >
                  Resend Code
                </button>

                <button 
                  type="button" 
                  onClick={() => setStep("request")} 
                  className="back-button"
                >
                  ← Back
                </button>
              </form>
            </>
          )}

          {step === "reset" && (
            <>
              <div className="heading">New Password</div>
              <div className="subheading">
                Enter your new password
              </div>

              <form onSubmit={handleResetPassword} className="reset-form">
                <input
                  required
                  className="reset-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  minLength={6}
                />
                <input
                  required
                  className="reset-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  minLength={6}
                />

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <button type="submit" disabled={loading} className="submit-button">
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          )}

          {step === "success" && (
            <>
              <div className="success-icon">✓</div>
              <div className="heading">Success!</div>
              <div className="subheading">
                {success}
              </div>

              <button 
                type="button" 
                onClick={handleClose} 
                className="submit-button"
                style={{ marginTop: "30px" }}
              >
                Sign In
              </button>
            </>
          )}

          {step === "email-sent" && (
            <>
              <div className="success-icon" style={{ color: '#1089D3' }}>📧</div>
              <div className="heading">Check Your Email</div>
              <div className="subheading">
                We sent a password reset link to:
              </div>
              <div style={{ 
                textAlign: 'center', 
                fontWeight: 'bold', 
                color: '#1089D3',
                fontSize: '16px',
                marginBottom: '15px'
              }}>
                {maskedInfo}
              </div>

              <div className="info-box" style={{ marginTop: '0' }}>
                <strong>📌 Important:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px' }}>
                  <li>Check your <strong>Inbox</strong> and <strong>Spam/Junk</strong> folder</li>
                  <li>The email comes from <strong>noreply@ppop-35930.firebaseapp.com</strong></li>
                  <li>The link expires in 1 hour</li>
                </ul>
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              <button 
                type="button" 
                onClick={handleResendEmail}
                disabled={loading || resendTimer > 0}
                className="submit-button"
                style={{ marginTop: "20px" }}
              >
                {loading ? "Sending..." : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Email"}
              </button>

              <button 
                type="button" 
                onClick={() => { setStep("request"); setError(""); setSuccess(""); }} 
                className="back-button"
              >
                ← Try a different email
              </button>

              <button 
                type="button" 
                onClick={handleClose} 
                className="back-button"
                style={{ marginTop: '5px' }}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
