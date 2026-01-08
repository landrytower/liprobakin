"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function VerificationNotification() {
  const { userProfile } = useAuth();
  const [showNotification, setShowNotification] = useState(false);
  const [hasShownNotification, setHasShownNotification] = useState(false);

  useEffect(() => {
    // Check if user was just verified
    if (
      userProfile && 
      userProfile.verificationStatus === "approved" && 
      !hasShownNotification &&
      userProfile.verificationReviewedAt
    ) {
      // Check if verification was recent (within last 7 days)
      const reviewedAt = new Date(userProfile.verificationReviewedAt);
      const now = new Date();
      const daysSinceReview = (now.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      // Check localStorage to see if we've shown this notification before
      const notificationKey = `verification_notif_${userProfile.uid}_${reviewedAt.getTime()}`;
      const alreadyShown = localStorage.getItem(notificationKey);
      
      if (daysSinceReview <= 7 && !alreadyShown) {
        setShowNotification(true);
        setHasShownNotification(true);
        localStorage.setItem(notificationKey, "true");
      }
    }
  }, [userProfile, hasShownNotification]);

  const handleClose = () => {
    setShowNotification(false);
  };

  if (!showNotification) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative max-w-md w-full bg-gradient-to-br from-green-900/90 to-green-950/90 border-2 border-green-500/50 rounded-2xl p-6 shadow-2xl shadow-green-500/20 animate-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          type="button"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Success icon */}
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-green-500/20 p-3 border-2 border-green-500">
            <svg className="h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            🎉 Verification Approved!
          </h2>
          <p className="text-green-100 mb-4">
            Congratulations! Your account has been verified by our admin team.
          </p>
          
          {userProfile?.role === "player" && userProfile?.teamName && (
            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-200">
                You are now linked to <span className="font-bold text-white">{userProfile.teamName}</span>
                {userProfile.linkedPlayerName && (
                  <> as <span className="font-bold text-white">{userProfile.linkedPlayerName}</span></>
                )}
              </p>
            </div>
          )}

          {userProfile?.verificationNotes && (
            <div className="bg-white/10 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs font-semibold text-green-300 mb-1">Admin Notes:</p>
              <p className="text-sm text-green-100">{userProfile.verificationNotes}</p>
            </div>
          )}

          <button
            onClick={handleClose}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            type="button"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
