"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth, firebaseDB } from "@/lib/firebase";
import type { VerificationRequest } from "@/types/user";

export default function AdminVerification() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [addToRoster, setAddToRoster] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedRequest, setEditedRequest] = useState<VerificationRequest | null>(null);

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
    if (!selectedRequest || !user) return;

    setProcessing(true);
    try {
      console.log("[Admin Verification] Processing request:", {
        requestId,
        status,
        customPlayer: selectedRequest.customPlayer,
        addToRoster,
        hasCustomPlayerData: !!selectedRequest.customPlayerData,
      });

      // Update verification request
      await updateDoc(doc(firebaseDB, "verificationRequests", requestId), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: user.email,
        notes: reviewNotes,
      });

      // Handle custom player creation (from profile-setup)
      if (selectedRequest.customPlayer && selectedRequest.customPlayerData) {
        console.log("[Admin Verification] Handling custom player");
        if (status === "approved" && addToRoster) {
          console.log("[Admin Verification] Creating player in roster");
          // Create new player in team roster
          const playerData = selectedRequest.customPlayerData;
          const rosterRef = collection(firebaseDB, "teams", selectedRequest.teamId, "roster");
          const newPlayerDoc = await addDoc(rosterRef, {
            firstName: playerData.firstName,
            lastName: playerData.lastName,
            name: `${playerData.firstName} ${playerData.lastName}`,
            number: playerData.jerseyNumber,
            position: playerData.position || "",
            height: playerData.height || "",
            birthdate: playerData.dateOfBirth || "",
            dateOfBirth: playerData.dateOfBirth || "", // Keep both for compatibility
            nationality: playerData.nationality || "",
            nationality2: playerData.secondNationality || null,
            secondNationality: playerData.secondNationality || null,
            playerLicense: playerData.playerLicense || null,
            headshot: playerData.headshotUrl || "",
            stats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 },
            verificationStatus: "verified",
            linkedUserId: selectedRequest.userId,
            linkedUserEmail: selectedRequest.userEmail || "",
            createdAt: serverTimestamp(),
          });

          console.log("[Admin Verification] Player created with ID:", newPlayerDoc.id);
          alert(`✅ Player added to ${selectedRequest.teamName} roster successfully!\nPlayer ID: ${newPlayerDoc.id}\nName: ${playerData.firstName} ${playerData.lastName}`);

          // Update user profile with link to new player
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            role: selectedRequest.role,
            teamId: selectedRequest.teamId,
            teamName: selectedRequest.teamName,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
            linkedPlayerId: newPlayerDoc.id,
            linkedPlayerName: `${playerData.firstName} ${playerData.lastName}`,
          });

          console.log("[Admin Verification] User profile updated");
        } else {
          console.log("[Admin Verification] Not adding to roster (rejected or checkbox disabled)");
          // Approved but not adding to roster, or rejected
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            role: status === "approved" ? selectedRequest.role : undefined,
            teamId: status === "approved" ? selectedRequest.teamId : undefined,
            teamName: status === "approved" ? selectedRequest.teamName : undefined,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (selectedRequest.requestType === "update_headshot") {
        if (status === "approved" && selectedRequest.newHeadshotUrl) {
          // Update player headshot
          if (selectedRequest.existingPlayerId && selectedRequest.role === "player") {
            await updateDoc(
              doc(firebaseDB, "teams", selectedRequest.teamId, "roster", selectedRequest.existingPlayerId),
              {
                headshot: selectedRequest.newHeadshotUrl,
                verificationStatus: "verified",
                linkedUserId: selectedRequest.userId,
                linkedUserEmail: selectedRequest.userEmail || "",
                updatedAt: serverTimestamp(),
              }
            );
          }
          
          // Update coach/staff headshot
          if (selectedRequest.existingCoachId && (selectedRequest.role === "coach" || selectedRequest.role === "staff")) {
            await updateDoc(
              doc(firebaseDB, "teams", selectedRequest.teamId, "coachStaff", selectedRequest.existingCoachId),
              {
                headshot: selectedRequest.newHeadshotUrl,
                updatedAt: serverTimestamp(),
              }
            );
          }

          // Update user profile timestamps
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        } else {
          // Rejected - just update user review fields
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (selectedRequest.requestType === "update_name") {
        if (status === "approved" && selectedRequest.existingPlayerId && selectedRequest.newFirstName && selectedRequest.newLastName) {
          // Update roster name
          await updateDoc(
            doc(firebaseDB, "teams", selectedRequest.teamId, "roster", selectedRequest.existingPlayerId),
            {
              firstName: selectedRequest.newFirstName,
              lastName: selectedRequest.newLastName,
              name: `${selectedRequest.newFirstName} ${selectedRequest.newLastName}`,
              updatedAt: serverTimestamp(),
            }
          );

          // Update user profile names
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            firstName: selectedRequest.newFirstName,
            lastName: selectedRequest.newLastName,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (selectedRequest.requestType === "claim_existing") {
        // CLAIM EXISTING PLAYER
        await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
          role: "player",
          teamId: selectedRequest.teamId,
          teamName: selectedRequest.teamName,
          verificationStatus: status,
          verificationReviewedAt: serverTimestamp(),
          verificationReviewedBy: user.email,
          verificationNotes: reviewNotes,
          updatedAt: serverTimestamp(),
          linkedPlayerId: status === "approved" ? selectedRequest.existingPlayerId : null,
          linkedPlayerName: status === "approved" ? selectedRequest.existingPlayerName : null,
        });

        // Link user to player roster entry
        if (status === "approved" && selectedRequest.existingPlayerId) {
          await updateDoc(
            doc(firebaseDB, "teams", selectedRequest.teamId, "roster", selectedRequest.existingPlayerId),
            {
              verificationStatus: "verified",
              linkedUserId: selectedRequest.userId,
              linkedUserEmail: selectedRequest.userEmail,
              linkedAt: serverTimestamp(),
            }
          );
        }
      } else if (selectedRequest.requestType === "create_new") {
        // CREATE NEW PLAYER REQUEST
        if (status === "approved" && selectedRequest.newPlayerData) {
          // Admin approved - create the player in the team roster
          const newPlayerData = selectedRequest.newPlayerData;
          const playerRef = await collection(firebaseDB, `teams/${selectedRequest.teamId}/roster`);
          const newPlayerDoc = await addDoc(playerRef, {
            firstName: newPlayerData.firstName,
            lastName: newPlayerData.lastName,
            number: newPlayerData.number,
            position: newPlayerData.position || "",
            height: newPlayerData.height || "",
            birthdate: newPlayerData.birthdate || "",
            nationality: newPlayerData.nationality || "",
            headshot: "",
            stats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 },
            verificationStatus: "verified",
            linkedUserId: selectedRequest.userId,
            linkedUserEmail: selectedRequest.userEmail,
            linkedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });

          // Update user profile with new player link
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            role: "player",
            teamId: selectedRequest.teamId,
            teamName: selectedRequest.teamName,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
            linkedPlayerId: newPlayerDoc.id,
            linkedPlayerName: `${newPlayerData.firstName} ${newPlayerData.lastName}`,
          });
        } else {
          // Rejected - just update user status
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (selectedRequest.requestType === "claim_existing_coach") {
        // CLAIM EXISTING COACH/STAFF
        await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
          role: selectedRequest.role,
          teamId: selectedRequest.teamId,
          teamName: selectedRequest.teamName,
          verificationStatus: status,
          verificationReviewedAt: serverTimestamp(),
          verificationReviewedBy: user.email,
          verificationNotes: reviewNotes,
          updatedAt: serverTimestamp(),
          linkedCoachId: status === "approved" ? selectedRequest.existingCoachId : null,
          linkedCoachName: status === "approved" ? selectedRequest.existingCoachName : null,
        });

        // Link user to coach staff entry
        if (status === "approved" && selectedRequest.existingCoachId) {
          await updateDoc(
            doc(firebaseDB, "teams", selectedRequest.teamId, "coachStaff", selectedRequest.existingCoachId),
            {
              linkedUserId: selectedRequest.userId,
              linkedUserEmail: selectedRequest.userEmail,
              linkedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
          );
        }
      } else if (selectedRequest.requestType === "create_new_coach" || selectedRequest.requestType === "create_new_staff") {
        // CREATE NEW COACH/STAFF REQUEST
        const isStaff = selectedRequest.requestType === "create_new_staff";
        const coachStaffData = isStaff ? selectedRequest.newStaffData : selectedRequest.newCoachData;
        
        if (status === "approved" && coachStaffData) {
          // Admin approved - create the coach/staff in the team coachStaff
          const coachRef = collection(firebaseDB, "teams", selectedRequest.teamId, "coachStaff");
          const newCoachDoc = await addDoc(coachRef, {
            firstName: coachStaffData.firstName,
            lastName: coachStaffData.lastName,
            role: isStaff ? "staff" : (coachStaffData as any).coachType,
            position: isStaff ? (coachStaffData as any).position : "",
            headshot: coachStaffData.headshotUrl || "",
            showOnRoster: isStaff ? (coachStaffData as any).showOnRoster ?? true : true,
            linkedUserId: selectedRequest.userId,
            linkedUserEmail: selectedRequest.userEmail,
            linkedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Update user profile with new coach link
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            role: selectedRequest.role,
            teamId: selectedRequest.teamId,
            teamName: selectedRequest.teamName,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
            linkedCoachId: newCoachDoc.id,
            linkedCoachName: `${coachStaffData.firstName} ${coachStaffData.lastName}`,
          });
        } else {
          // Rejected - just update user status
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: user.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Refresh list
      await fetchVerificationRequests();
      setSelectedRequest(null);
      setReviewNotes("");
      setAddToRoster(true); // Reset checkbox
      alert(`Verification ${status === "approved" ? "approved" : "rejected"} successfully!`);
    } catch (error) {
      console.error("[Admin Verification] Error reviewing verification:", error);
      alert(`Failed to process verification: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditToggle = () => {
    if (!editMode && selectedRequest) {
      setEditedRequest({ ...selectedRequest });
    }
    setEditMode(!editMode);
  };

  const handleFieldUpdate = (field: string, value: any) => {
    if (editedRequest) {
      setEditedRequest({
        ...editedRequest,
        [field]: value,
      });
    }
  };

  const handleCustomPlayerDataUpdate = (field: string, value: any) => {
    if (editedRequest && editedRequest.customPlayerData) {
      setEditedRequest({
        ...editedRequest,
        customPlayerData: {
          ...editedRequest.customPlayerData,
          [field]: value,
        },
      });
    }
  };

  const handleNewPlayerDataUpdate = (field: string, value: any) => {
    if (editedRequest && editedRequest.newPlayerData) {
      setEditedRequest({
        ...editedRequest,
        newPlayerData: {
          ...editedRequest.newPlayerData,
          [field]: value,
        },
      });
    }
  };

  const saveChanges = () => {
    if (editedRequest) {
      setSelectedRequest(editedRequest);
      setEditMode(false);
    }
  };

  const cancelChanges = () => {
    setEditedRequest(null);
    setEditMode(false);
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
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-3xl font-bold text-white">User Verification Requests</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Review and approve/reject player verification requests (Claim existing or create new profiles).
          </p>
        </div>

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
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Review Request</h2>
                  <div className="flex gap-2">
                    {editMode ? (
                      <>
                        <button
                          onClick={saveChanges}
                          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={cancelChanges}
                          className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleEditToggle}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Details
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-400">Name</label>
                    {editMode ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={editedRequest?.userFirstName || ""}
                          onChange={(e) => handleFieldUpdate("userFirstName", e.target.value)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                          placeholder="First Name"
                        />
                        <input
                          type="text"
                          value={editedRequest?.userLastName || ""}
                          onChange={(e) => handleFieldUpdate("userLastName", e.target.value)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                          placeholder="Last Name"
                        />
                      </div>
                    ) : (
                      <p className="text-white">
                        {selectedRequest.userFirstName} {selectedRequest.userLastName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">Phone</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editedRequest?.userPhone || ""}
                        onChange={(e) => handleFieldUpdate("userPhone", e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                        placeholder="Phone Number"
                      />
                    ) : (
                      <p className="text-white">{selectedRequest.userPhone}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">Role</label>
                    {editMode ? (
                      <select
                        value={editedRequest?.role || ""}
                        onChange={(e) => handleFieldUpdate("role", e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:border-blue-400 focus:outline-none"
                      >
                        <option value="player">Player</option>
                        <option value="coach">Coach</option>
                        <option value="staff">Staff</option>
                      </select>
                    ) : (
                      <p className="text-white capitalize">{selectedRequest.role}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">Team</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editedRequest?.teamName || ""}
                        onChange={(e) => handleFieldUpdate("teamName", e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                        placeholder="Team Name"
                      />
                    ) : (
                      <p className="text-white">{selectedRequest.teamName}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-400">Request Type</label>
                    <p className="text-white capitalize">
                      {selectedRequest.customPlayer
                        ? "Create Custom Player Profile"
                        : selectedRequest.requestType === "claim_existing"
                        ? "Claim Existing Player"
                        : selectedRequest.requestType === "claim_existing_coach"
                        ? "Claim Existing Coach/Staff"
                        : selectedRequest.requestType === "create_new_coach"
                        ? "Create New Coach"
                        : selectedRequest.requestType === "create_new_staff"
                        ? "Create New Staff"
                        : selectedRequest.requestType === "update_headshot"
                        ? "Update Headshot"
                        : selectedRequest.requestType === "update_name"
                        ? "Update Name"
                        : "Create New Player"}
                    </p>
                  </div>

                  {selectedRequest.requestType === "update_name" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400">Name Change</label>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                        <p>Previous: {selectedRequest.previousFirstName} {selectedRequest.previousLastName}</p>
                        <p>Requested: <span className="text-green-400 font-semibold">{selectedRequest.newFirstName} {selectedRequest.newLastName}</span></p>
                      </div>
                    </div>
                  )}

                  {selectedRequest.requestType === "update_headshot" && selectedRequest.newHeadshotUrl && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-400">Headshot Update (Approval Required)</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-2">New Headshot</p>
                          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            <Image src={selectedRequest.newHeadshotUrl} alt="New headshot" width={400} height={400} className="w-full h-full object-cover" />
                          </div>
                        </div>
                        {selectedRequest.previousHeadshotUrl && (
                          <div>
                            <p className="text-xs text-slate-400 mb-2">Previous Headshot</p>
                            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                              <Image src={selectedRequest.previousHeadshotUrl} alt="Previous headshot" width={400} height={400} className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRequest.requestType === "claim_existing" && selectedRequest.existingPlayerName && (
                    <div>
                      <label className="text-sm font-medium text-slate-400">Claiming Player</label>
                      <p className="text-white">
                        {selectedRequest.existingPlayerName} #{selectedRequest.existingPlayerNumber}
                      </p>
                    </div>
                  )}

                  {selectedRequest.requestType === "claim_existing_coach" && selectedRequest.existingCoachName && (
                    <div>
                      <label className="text-sm font-medium text-slate-400">Claiming Coach/Staff</label>
                      <p className="text-white">
                        {selectedRequest.existingCoachName}
                      </p>
                    </div>
                  )}

                  {/* Custom Player Data (from profile-setup) */}
                  {selectedRequest.customPlayer && selectedRequest.customPlayerData && (
                    <div>
                      <label className="text-sm font-medium text-slate-400">Custom Player Details</label>
                      <div className="mt-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 space-y-3">
                        {editMode ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={editedRequest?.customPlayerData?.firstName || ""}
                                onChange={(e) => handleCustomPlayerDataUpdate("firstName", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="First Name"
                              />
                              <input
                                type="text"
                                value={editedRequest?.customPlayerData?.lastName || ""}
                                onChange={(e) => handleCustomPlayerDataUpdate("lastName", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Last Name"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={editedRequest?.customPlayerData?.jerseyNumber || ""}
                                onChange={(e) => handleCustomPlayerDataUpdate("jerseyNumber", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Jersey #"
                              />
                              <input
                                type="text"
                                value={editedRequest?.customPlayerData?.position || ""}
                                onChange={(e) => handleCustomPlayerDataUpdate("position", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Position"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={editedRequest?.customPlayerData?.height || ""}
                                onChange={(e) => handleCustomPlayerDataUpdate("height", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Height (cm)"
                              />
                              <input
                                type="date"
                                value={editedRequest?.customPlayerData?.dateOfBirth || ""}
                                onChange={(e) => handleCustomPlayerDataUpdate("dateOfBirth", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={editedRequest?.customPlayerData?.nationality || ""}
                                onChange={(e) => handleCustomPlayerDataUpdate("nationality", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Nationality"
                              />
                              <input
                                type="text"
                                value={editedRequest?.customPlayerData?.secondNationality || ""}
                                onChange={(e) => handleCustomPlayerDataUpdate("secondNationality", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="2nd Nationality (Optional)"
                              />
                            </div>
                            <input
                              type="text"
                              value={editedRequest?.customPlayerData?.playerLicense || ""}
                              onChange={(e) => handleCustomPlayerDataUpdate("playerLicense", e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                              placeholder="Player License (Optional)"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-white font-semibold">
                              {selectedRequest.customPlayerData.firstName} {selectedRequest.customPlayerData.lastName}
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                              <p>Jersey: #{selectedRequest.customPlayerData.jerseyNumber}</p>
                              <p>Position: {selectedRequest.customPlayerData.position}</p>
                              <p>Height: {selectedRequest.customPlayerData.height} cm</p>
                              <p>DOB: {selectedRequest.customPlayerData.dateOfBirth}</p>
                              <p>Nationality: {selectedRequest.customPlayerData.nationality}</p>
                              {selectedRequest.customPlayerData.secondNationality && (
                                <p>2nd Nationality: {selectedRequest.customPlayerData.secondNationality}</p>
                              )}
                              {selectedRequest.customPlayerData.playerLicense && (
                                <p className="col-span-2">License: {selectedRequest.customPlayerData.playerLicense}</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRequest.requestType === "create_new" && selectedRequest.newPlayerData && (
                    <div>
                      <label className="text-sm font-medium text-slate-400">New Player Details</label>
                      <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                        {editMode ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={editedRequest?.newPlayerData?.firstName || ""}
                                onChange={(e) => handleNewPlayerDataUpdate("firstName", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="First Name"
                              />
                              <input
                                type="text"
                                value={editedRequest?.newPlayerData?.lastName || ""}
                                onChange={(e) => handleNewPlayerDataUpdate("lastName", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Last Name"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="number"
                                value={editedRequest?.newPlayerData?.number || ""}
                                onChange={(e) => handleNewPlayerDataUpdate("number", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Jersey #"
                              />
                              <input
                                type="text"
                                value={editedRequest?.newPlayerData?.position || ""}
                                onChange={(e) => handleNewPlayerDataUpdate("position", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Position"
                              />
                              <input
                                type="text"
                                value={editedRequest?.newPlayerData?.height || ""}
                                onChange={(e) => handleNewPlayerDataUpdate("height", e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Height"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-white">
                              Name: {selectedRequest.newPlayerData.firstName} {selectedRequest.newPlayerData.lastName}
                            </p>
                            <p className="text-slate-300 text-sm">
                              #{selectedRequest.newPlayerData.number}
                              {selectedRequest.newPlayerData.position && ` • ${selectedRequest.newPlayerData.position}`}
                              {selectedRequest.newPlayerData.height && ` • ${selectedRequest.newPlayerData.height}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(selectedRequest.requestType === "create_new_coach" || selectedRequest.requestType === "create_new_staff") && (selectedRequest.newCoachData || selectedRequest.newStaffData) && (
                    <div>
                      <label className="text-sm font-medium text-slate-400">New Coach/Staff Details</label>
                      <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                        <p className="text-white">
                          Name: {(selectedRequest.newCoachData || selectedRequest.newStaffData)?.firstName} {(selectedRequest.newCoachData || selectedRequest.newStaffData)?.lastName}
                        </p>
                        <p className="text-slate-300 text-sm capitalize">
                          Role: {selectedRequest.newCoachData ? (selectedRequest.newCoachData as any).coachType?.replace("_", " ") : "Staff"}
                        </p>
                        {selectedRequest.newStaffData?.position && (
                          <p className="text-slate-300 text-sm">
                            Position: {selectedRequest.newStaffData?.position}
                          </p>
                        )}
                        {(selectedRequest.newCoachData || selectedRequest.newStaffData)?.headshotUrl && (
                          <div className="mt-3">
                            <p className="text-xs text-slate-400 mb-2">Headshot</p>
                            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 w-32 h-32">
                              <Image src={(selectedRequest.newCoachData || selectedRequest.newStaffData)?.headshotUrl || ""} alt="Coach/Staff headshot" width={200} height={200} className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRequest.idImageUrl && (
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
                  )}

                  {/* Add to Roster Checkbox for Custom Players */}
                  {selectedRequest.customPlayer && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addToRoster}
                          onChange={(e) => setAddToRoster(e.target.checked)}
                          className="mt-1 h-5 w-5 rounded border-white/20 bg-white/10 text-green-500 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
                        />
                        <div>
                          <p className="font-semibold text-white">Add player to team roster?</p>
                          <p className="text-sm text-slate-300">
                            If checked, this custom player will be created and added to the {selectedRequest.teamName} roster when approved.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

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
