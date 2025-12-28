"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const { signUp, signIn, signInWithGoogle, signInWithApple } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        await signUp(email, password, firstName, lastName, phoneNumber);
        router.push("/profile-setup");
        onClose();
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
    setPhoneNumber("");
    setError("");
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
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

  if (!isOpen) return null;

  return (
    <>
      <style jsx>{`
        .auth-modal-overlay {
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

        .auth-container {
          max-width: 350px;
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
          font-size: 30px;
          color: rgb(16, 137, 211);
          margin-bottom: 20px;
        }

        .auth-form {
          margin-top: 20px;
        }

        .auth-input {
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

        .auth-input::placeholder {
          color: rgb(170, 170, 170);
        }

        .auth-input:focus {
          outline: none;
          border-inline: 2px solid #12B1D1;
        }

        .name-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .forgot-password {
          display: block;
          margin-top: 10px;
          margin-left: 10px;
        }

        .forgot-password a {
          font-size: 11px;
          color: #0099ff;
          text-decoration: none;
        }

        .forgot-password a:hover {
          text-decoration: underline;
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

        .login-button {
          display: block;
          width: 100%;
          font-weight: bold;
          background: linear-gradient(45deg, rgb(16, 137, 211) 0%, rgb(18, 177, 209) 100%);
          color: white;
          padding: 15px;
          margin: 20px auto;
          border-radius: 20px;
          box-shadow: rgba(133, 189, 215, 0.878) 0px 20px 10px -15px;
          border: none;
          transition: all 0.2s ease-in-out;
          cursor: pointer;
          font-size: 14px;
        }

        .login-button:hover:not(:disabled) {
          transform: scale(1.03);
          box-shadow: rgba(133, 189, 215, 0.878) 0px 23px 10px -20px;
        }

        .login-button:active:not(:disabled) {
          transform: scale(0.95);
          box-shadow: rgba(133, 189, 215, 0.878) 0px 15px 10px -10px;
        }

        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .social-account-container {
          margin-top: 25px;
        }

        .social-title {
          display: block;
          text-align: center;
          font-size: 10px;
          color: rgb(170, 170, 170);
        }

        .social-accounts {
          width: 100%;
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-top: 5px;
        }

        .social-button {
          background: linear-gradient(45deg, rgb(0, 0, 0) 0%, rgb(112, 112, 112) 100%);
          border: 5px solid white;
          padding: 5px;
          border-radius: 50%;
          width: 40px;
          aspect-ratio: 1;
          display: grid;
          place-content: center;
          box-shadow: rgba(133, 189, 215, 0.878) 0px 12px 10px -8px;
          transition: all 0.2s ease-in-out;
          cursor: pointer;
        }

        .social-button svg {
          fill: white;
          margin: auto;
          width: 16px;
          height: 16px;
        }

        .social-button:hover {
          transform: scale(1.2);
        }

        .social-button:active {
          transform: scale(0.9);
        }

        .agreement {
          display: block;
          text-align: center;
          margin-top: 15px;
        }

        .agreement a {
          text-decoration: none;
          color: #0099ff;
          font-size: 9px;
        }

        .agreement a:hover {
          text-decoration: underline;
        }

        .switch-mode {
          text-align: center;
          margin-top: 15px;
          font-size: 12px;
          color: rgb(100, 100, 100);
        }

        .switch-mode button {
          background: none;
          border: none;
          color: #0099ff;
          text-decoration: underline;
          cursor: pointer;
          font-size: 12px;
          margin-left: 5px;
        }

        .switch-mode button:hover {
          color: rgb(16, 137, 211);
        }
      `}</style>

      <div className="auth-modal-overlay" onClick={onClose}>
        <div className="auth-container" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="close-button" type="button">
            ×
          </button>

          <div className="heading">
            {mode === "login" ? "Sign In" : "Create Account"}
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "signup" && (
              <>
                <div className="name-grid">
                  <input
                    required
                    className="auth-input"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                  />
                  <input
                    required
                    className="auth-input"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                  />
                </div>
                <input
                  required
                  className="auth-input"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Phone Number"
                />
              </>
            )}

            <input
              required
              className="auth-input"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail or Phone Number"
            />
            <input
              required
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              minLength={6}
            />

            {mode === "login" && (
              <span className="forgot-password">
                <a href="#">Forgot Password?</a>
              </span>
            )}

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading} className="login-button">
              {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="social-account-container">
            <span className="social-title">Or Sign in with</span>
            <div className="social-accounts">
              <button 
                type="button" 
                className="social-button google"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 488 512">
                  <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
              </button>
              <button 
                type="button" 
                className="social-button apple"
                onClick={handleAppleSignIn}
                disabled={loading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 384 512">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"></path>
                </svg>
              </button>
            </div>
          </div>

          <span className="agreement">
            <a href="#">Learn user licence agreement</a>
          </span>

          <div className="switch-mode">
            {mode === "login" ? "New here?" : "Already have an account?"}
            <button type="button" onClick={switchMode}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
