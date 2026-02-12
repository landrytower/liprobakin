"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import type { VerificationRequest } from "@/types/user";
import { useAdmin } from "../layout";

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "Verification Requests",
    subtitle: "Review and approve/reject player verification requests",
    noPending: "No pending verification requests",
    pending: "Pending",
    name: "Name",
    phone: "Phone",
    role: "Role",
    team: "Team",
    requestType: "Request Type",
    submitted: "Submitted",
    reviewNotes: "Review Notes (Optional)",
    reviewNotesPlaceholder: "Add any notes about this verification...",
    approve: "Approve",
    reject: "Reject",
    processing: "Processing...",
    editDetails: "Edit Details",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    addToRoster: "Add player to team roster?",
    addToRosterDesc: "If checked, this custom player will be created and added to the team roster when approved.",
    customPlayerDetails: "Custom Player Details",
    newPlayerDetails: "New Player Details",
    newCoachStaffDetails: "New Coach/Staff Details",
    claimingPlayer: "Claiming Player",
    claimingCoach: "Claiming Coach/Staff",
    idDocument: "ID Document",
    headshotUpdate: "Headshot Update (Approval Required)",
    newHeadshot: "New Headshot",
    previousHeadshot: "Previous Headshot",
    nameChange: "Name Change",
    previous: "Previous",
    requested: "Requested",
    createCustomPlayer: "Create Custom Player Profile",
    claimExisting: "Claim Existing Player",
    claimExistingCoach: "Claim Existing Coach/Staff",
    createNewCoach: "Create New Coach",
    createNewStaff: "Create New Staff",
    updateHeadshot: "Update Headshot",
    updateName: "Update Name",
    createNewPlayer: "Create New Player",
  },
  fr: {
    title: "Demandes de Vérification",
    subtitle: "Examiner et approuver/rejeter les demandes de vérification des joueurs",
    noPending: "Aucune demande de vérification en attente",
    pending: "En attente",
    name: "Nom",
    phone: "Téléphone",
    role: "Rôle",
    team: "Équipe",
    requestType: "Type de demande",
    submitted: "Soumis",
    reviewNotes: "Notes de révision (Optionnel)",
    reviewNotesPlaceholder: "Ajouter des notes sur cette vérification...",
    approve: "Approuver",
    reject: "Rejeter",
    processing: "Traitement...",
    editDetails: "Modifier les détails",
    saveChanges: "Sauvegarder",
    cancel: "Annuler",
    addToRoster: "Ajouter le joueur à l'effectif?",
    addToRosterDesc: "Si coché, ce joueur sera créé et ajouté à l'effectif de l'équipe une fois approuvé.",
    customPlayerDetails: "Détails du joueur personnalisé",
    newPlayerDetails: "Détails du nouveau joueur",
    newCoachStaffDetails: "Détails du nouveau coach/staff",
    claimingPlayer: "Réclamation du joueur",
    claimingCoach: "Réclamation du coach/staff",
    idDocument: "Document d'identité",
    headshotUpdate: "Mise à jour photo (Approbation requise)",
    newHeadshot: "Nouvelle photo",
    previousHeadshot: "Photo précédente",
    nameChange: "Changement de nom",
    previous: "Précédent",
    requested: "Demandé",
    createCustomPlayer: "Créer un profil joueur personnalisé",
    claimExisting: "Réclamer un joueur existant",
    claimExistingCoach: "Réclamer un coach/staff existant",
    createNewCoach: "Créer un nouveau coach",
    createNewStaff: "Créer un nouveau staff",
    updateHeadshot: "Mettre à jour la photo",
    updateName: "Mettre à jour le nom",
    createNewPlayer: "Créer un nouveau joueur",
  },
};

export default function VerificationsPage() {
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];

  const [loading, setLoading] = useState(true);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [addToRoster, setAddToRoster] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedRequest, setEditedRequest] = useState<VerificationRequest | null>(null);

  const fetchVerificationRequests = useCallback(async () => {
    setLoading(true);
    try {
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
    } catch (error) {
      console.error("Error fetching verification requests:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerificationRequests();
  }, [fetchVerificationRequests]);

  const handleReview = async (requestId: string, status: "approved" | "rejected") => {
    if (!selectedRequest || !currentAdminUser) return;

    setProcessing(true);
    try {
      // Update verification request
      await updateDoc(doc(firebaseDB, "verificationRequests", requestId), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: currentAdminUser.email,
        notes: reviewNotes,
      });

      // Handle custom player creation
      if (selectedRequest.customPlayer && selectedRequest.customPlayerData) {
        if (status === "approved" && addToRoster) {
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
            dateOfBirth: playerData.dateOfBirth || "",
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

          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            role: selectedRequest.role,
            teamId: selectedRequest.teamId,
            teamName: selectedRequest.teamName,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: currentAdminUser.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
            linkedPlayerId: newPlayerDoc.id,
            linkedPlayerName: `${playerData.firstName} ${playerData.lastName}`,
          });
        } else {
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            role: status === "approved" ? selectedRequest.role : undefined,
            teamId: status === "approved" ? selectedRequest.teamId : undefined,
            teamName: status === "approved" ? selectedRequest.teamName : undefined,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: currentAdminUser.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (selectedRequest.requestType === "update_headshot") {
        if (status === "approved" && selectedRequest.newHeadshotUrl) {
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
          if (selectedRequest.existingCoachId && (selectedRequest.role === "coach" || selectedRequest.role === "staff")) {
            await updateDoc(
              doc(firebaseDB, "teams", selectedRequest.teamId, "coachStaff", selectedRequest.existingCoachId),
              {
                headshot: selectedRequest.newHeadshotUrl,
                updatedAt: serverTimestamp(),
              }
            );
          }
        }
        await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
          verificationStatus: status,
          verificationReviewedAt: serverTimestamp(),
          verificationReviewedBy: currentAdminUser.email,
          verificationNotes: reviewNotes,
          updatedAt: serverTimestamp(),
        });
      } else if (selectedRequest.requestType === "update_name") {
        if (status === "approved" && selectedRequest.existingPlayerId && selectedRequest.newFirstName && selectedRequest.newLastName) {
          await updateDoc(
            doc(firebaseDB, "teams", selectedRequest.teamId, "roster", selectedRequest.existingPlayerId),
            {
              firstName: selectedRequest.newFirstName,
              lastName: selectedRequest.newLastName,
              name: `${selectedRequest.newFirstName} ${selectedRequest.newLastName}`,
              updatedAt: serverTimestamp(),
            }
          );
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            firstName: selectedRequest.newFirstName,
            lastName: selectedRequest.newLastName,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: currentAdminUser.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: currentAdminUser.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (selectedRequest.requestType === "claim_existing") {
        await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
          role: "player",
          teamId: selectedRequest.teamId,
          teamName: selectedRequest.teamName,
          verificationStatus: status,
          verificationReviewedAt: serverTimestamp(),
          verificationReviewedBy: currentAdminUser.email,
          verificationNotes: reviewNotes,
          updatedAt: serverTimestamp(),
          linkedPlayerId: status === "approved" ? selectedRequest.existingPlayerId : null,
          linkedPlayerName: status === "approved" ? selectedRequest.existingPlayerName : null,
        });
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
      } else if (selectedRequest.requestType === "create_new" && selectedRequest.newPlayerData) {
        if (status === "approved") {
          const newPlayerData = selectedRequest.newPlayerData;
          const playerRef = collection(firebaseDB, `teams/${selectedRequest.teamId}/roster`);
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
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            role: "player",
            teamId: selectedRequest.teamId,
            teamName: selectedRequest.teamName,
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: currentAdminUser.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
            linkedPlayerId: newPlayerDoc.id,
            linkedPlayerName: `${newPlayerData.firstName} ${newPlayerData.lastName}`,
          });
        } else {
          await updateDoc(doc(firebaseDB, "users", selectedRequest.userId), {
            verificationStatus: status,
            verificationReviewedAt: serverTimestamp(),
            verificationReviewedBy: currentAdminUser.email,
            verificationNotes: reviewNotes,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await fetchVerificationRequests();
      setSelectedRequest(null);
      setReviewNotes("");
      setAddToRoster(true);
    } catch (error) {
      console.error("Error reviewing verification:", error);
      alert(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setProcessing(false);
    }
  };

  const getRequestTypeLabel = (request: VerificationRequest) => {
    if (request.customPlayer) return copy.createCustomPlayer;
    switch (request.requestType) {
      case "claim_existing": return copy.claimExisting;
      case "claim_existing_coach": return copy.claimExistingCoach;
      case "create_new_coach": return copy.createNewCoach;
      case "create_new_staff": return copy.createNewStaff;
      case "update_headshot": return copy.updateHeadshot;
      case "update_name": return copy.updateName;
      default: return copy.createNewPlayer;
    }
  };

  const handleEditToggle = () => {
    if (!editMode && selectedRequest) {
      setEditedRequest({ ...selectedRequest });
    }
    setEditMode(!editMode);
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
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">✓ {copy.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{copy.subtitle}</p>
      </div>

      {verificationRequests.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-center">
          <p className="text-slate-400">{copy.noPending}</p>
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
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-white/10 bg-slate-900/80 hover:border-white/20"
                }`}
                type="button"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">
                      {request.userFirstName} {request.userLastName}
                    </h3>
                    <p className="text-sm text-slate-400 capitalize">{request.role}</p>
                    <p className="text-sm text-slate-400">{request.teamName}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {copy.submitted}: {request.submittedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-400">
                    {copy.pending}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Request Details */}
          {selectedRequest && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Review</h2>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <button onClick={saveChanges} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition">
                        {copy.saveChanges}
                      </button>
                      <button onClick={cancelChanges} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium transition">
                        {copy.cancel}
                      </button>
                    </>
                  ) : (
                    <button onClick={handleEditToggle} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition flex items-center gap-2">
                      ✏️ {copy.editDetails}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-400">{copy.name}</label>
                  <p className="text-white">{selectedRequest.userFirstName} {selectedRequest.userLastName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">{copy.phone}</label>
                  <p className="text-white">{selectedRequest.userPhone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">{copy.role}</label>
                  <p className="text-white capitalize">{selectedRequest.role}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">{copy.team}</label>
                  <p className="text-white">{selectedRequest.teamName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">{copy.requestType}</label>
                  <p className="text-white capitalize">{getRequestTypeLabel(selectedRequest)}</p>
                </div>

                {/* Name Change */}
                {selectedRequest.requestType === "update_name" && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    <p>{copy.previous}: {selectedRequest.previousFirstName} {selectedRequest.previousLastName}</p>
                    <p>{copy.requested}: <span className="text-green-400 font-semibold">{selectedRequest.newFirstName} {selectedRequest.newLastName}</span></p>
                  </div>
                )}

                {/* Headshot Update */}
                {selectedRequest.requestType === "update_headshot" && selectedRequest.newHeadshotUrl && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400">{copy.headshotUpdate}</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-2">{copy.newHeadshot}</p>
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          <Image src={selectedRequest.newHeadshotUrl} alt="New" width={200} height={200} className="w-full h-full object-cover" unoptimized />
                        </div>
                      </div>
                      {selectedRequest.previousHeadshotUrl && (
                        <div>
                          <p className="text-xs text-slate-400 mb-2">{copy.previousHeadshot}</p>
                          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            <Image src={selectedRequest.previousHeadshotUrl} alt="Previous" width={200} height={200} className="w-full h-full object-cover" unoptimized />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Claim Existing Player */}
                {selectedRequest.requestType === "claim_existing" && selectedRequest.existingPlayerName && (
                  <div>
                    <label className="text-sm font-medium text-slate-400">{copy.claimingPlayer}</label>
                    <p className="text-white">{selectedRequest.existingPlayerName} #{selectedRequest.existingPlayerNumber}</p>
                  </div>
                )}

                {/* Custom Player Data */}
                {selectedRequest.customPlayer && selectedRequest.customPlayerData && (
                  <div>
                    <label className="text-sm font-medium text-slate-400">{copy.customPlayerDetails}</label>
                    <div className="mt-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 space-y-2">
                      <p className="text-white font-semibold">
                        {selectedRequest.customPlayerData.firstName} {selectedRequest.customPlayerData.lastName}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                        <p>Jersey: #{selectedRequest.customPlayerData.jerseyNumber}</p>
                        <p>Position: {selectedRequest.customPlayerData.position}</p>
                        <p>Height: {selectedRequest.customPlayerData.height} cm</p>
                        <p>DOB: {selectedRequest.customPlayerData.dateOfBirth}</p>
                        <p>Nationality: {selectedRequest.customPlayerData.nationality}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ID Document */}
                {selectedRequest.idImageUrl && (
                  <div>
                    <label className="text-sm font-medium text-slate-400">{copy.idDocument}</label>
                    <div className="mt-2 rounded-lg border border-white/20 bg-black/30 p-2">
                      <Image src={selectedRequest.idImageUrl} alt="ID" width={400} height={300} className="w-full rounded object-contain" unoptimized />
                    </div>
                  </div>
                )}

                {/* Add to Roster Checkbox */}
                {selectedRequest.customPlayer && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addToRoster}
                        onChange={(e) => setAddToRoster(e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-white/20 bg-white/10 text-green-500"
                      />
                      <div>
                        <p className="font-semibold text-white">{copy.addToRoster}</p>
                        <p className="text-sm text-slate-300">{copy.addToRosterDesc}</p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Review Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-400">{copy.reviewNotes}</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-white placeholder-slate-500"
                    rows={3}
                    placeholder={copy.reviewNotesPlaceholder}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReview(selectedRequest.id, "approved")}
                    disabled={processing}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                    type="button"
                  >
                    {processing ? copy.processing : copy.approve}
                  </button>
                  <button
                    onClick={() => handleReview(selectedRequest.id, "rejected")}
                    disabled={processing}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    type="button"
                  >
                    {processing ? copy.processing : copy.reject}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
