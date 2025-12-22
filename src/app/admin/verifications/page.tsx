"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth, firebaseDB } from "@/lib/firebase";
import type { VerificationRequest } from "@/types/user";

export default function AdminVerification() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/admin");
      } else {
        setUser(firebaseUser);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchVerificationRequests();
    }
  }, [user]);

  const fetchVerificationRequests = async () => {
    const q = query(
      collection(firebaseDB, "verificationRequests"),
      where("status", "==", "pending")
    );
    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate() || new Date(),
      reviewedAt: doc.data().reviewedAt?.toDate(),
    })) as VerificationRequest[];
    setVerificationRequests(requests);
  };

  const handleReview = async (requestId: string, status: "approved" | "rejected") => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      // Update verification request
      await updateDoc(doc(firebaseDB, "verificationRequests", requestId), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: user.email,
        notes: reviewNotes,
      });

      // Update user profile
      // IMPORTANT: Never update firstName/lastName here - those are the user's real identity
      // from sign-up and must never be changed by player selection
      await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
        verificationStatus: status,
        verificationReviewedAt: serverTimestamp(),
        verificationReviewedBy: user.email,
        verificationNotes: reviewNotes,
        updatedAt: serverTimestamp(),
        // Store the link to the player they claimed, but DO NOT modify their name
        linkedPlayerId: status === "approved" ? selectedRequest.selectedPersonId : null,
        linkedPlayerName: status === "approved" ? selectedRequest.selectedPersonName : null,
        // Explicitly preserve the user's real name (never overwrite with player data)
        // firstName and lastName should remain unchanged from their original sign-up values
      });

      // If approved, link the user account to the player roster entry
      // This creates a bidirectional link without modifying the player's actual name
      if (status === "approved" && selectedRequest.teamId && selectedRequest.selectedPersonId) {
        await updateDoc(
          doc(firebaseDB, "teams", selectedRequest.teamId, "roster", selectedRequest.selectedPersonId),
          {
            linkedUserId: selectedRequest.userId,
            linkedUserName: `${selectedRequest.userFirstName} ${selectedRequest.userLastName}`,
            linkedAt: serverTimestamp(),
            // CRITICAL: Do NOT update the player's firstName, lastName, or name fields
            // The player roster name must remain the official player name
            // linkedUserName is stored separately for reference only
          }
        );
      }

      // Refresh list
      await fetchVerificationRequests();
      setSelectedRequest(null);
      setReviewNotes("");
    } catch (error) {
      console.error("Error reviewing verification:", error);
      alert("Failed to process verification");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <nav className="border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/admin" className="text-xl font-semibold text-white">
            ← Back to Admin Dashboard
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold text-white">User Verification Requests</h1>

        {verificationRequests.length === 0 ? (
          <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 to-slate-950 p-8 text-center">
            <p className="text-slate-300">No pending verification requests</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Requests List */}
            <div className="space-y-4">
              {verificationRequests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selectedRequest?.id === request.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-white/20 bg-white/5 hover:border-white/40"
                  }`}
                  type="button"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">
                        {request.userFirstName} {request.userLastName}
                      </h3>
                      <p className="text-sm text-slate-400">{request.role}</p>
                      <p className="text-sm text-slate-400">{request.teamName}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Submitted: {request.submittedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-400">
                      Pending
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Request Details */}
            {selectedRequest && (
              <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
                <h2 className="mb-6 text-2xl font-bold text-white">Review Request</h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-400">Name</label>
                    <p className="text-white">
                      {selectedRequest.userFirstName} {selectedRequest.userLastName}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">Phone</label>
                    <p className="text-white">{selectedRequest.userPhone}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">Role</label>
                    <p className="text-white capitalize">{selectedRequest.role}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">Team</label>
                    <p className="text-white">{selectedRequest.teamName}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">Selected Person</label>
                    <p className="text-white">{selectedRequest.selectedPersonName}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">ID Document</label>
                    <div className="mt-2 rounded-lg border border-white/20 bg-black/30 p-2">
                      <Image
                        src={selectedRequest.idImageUrl}
                        alt="Verification ID"
                        width={400}
                        height={300}
                        className="w-full rounded object-contain"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400">Review Notes (Optional)</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      rows={3}
                      placeholder="Add any notes about this verification..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReview(selectedRequest.id, "approved")}
                      disabled={processing}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                      type="button"
                    >
                      {processing ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReview(selectedRequest.id, "rejected")}
                      disabled={processing}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                      type="button"
                    >
                      {processing ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
