"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAdmin } from "../layout";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type UserAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: "player" | "coach" | "staff" | "fan";
  teamId?: string;
  teamName?: string;
  favoriteTeamId?: string;
  favoriteTeamName?: string;
  headshot?: string;
  verificationStatus?: "pending" | "approved" | "rejected";
  linkedPlayerId?: string;
  linkedCoachId?: string;
  showOnRoster?: boolean;
  createdAt: Date;
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "Accounts",
    subtitle: "Manage user accounts, roles, and permissions",
    allUsers: "All Users",
    players: "Players",
    coaches: "Coaches",
    fans: "Fans",
    search: "Search by name, email, or phone...",
    noUsers: "No users found",
    totalUsers: "Total Users",
    verified: "Verified",
    pending: "Pending",
    email: "Email",
    phone: "Phone",
    role: "Role",
    team: "Team",
    favoriteTeam: "Favorite Team",
    registeredOn: "Registered On",
    verificationStatus: "Verification",
    linkedTo: "Linked To",
    onRoster: "On Roster",
    userId: "User ID",
    editProfile: "Edit Profile",
    sendResetEmail: "Reset Email",
    sendResetSMS: "Reset SMS",
    deleteAccount: "Delete",
    save: "Save",
    cancel: "Cancel",
    firstName: "First Name",
    lastName: "Last Name",
    showOnRoster: "Show on Roster",
    photo: "Photo",
    notSet: "Not set",
    yes: "Yes",
    no: "No",
    player: "Player",
    coach: "Coach",
    staff: "Staff",
    fan: "Fan",
    approved: "Approved",
    rejected: "Rejected",
    notVerified: "Not Verified",
  },
  fr: {
    title: "Comptes",
    subtitle: "Gérer les comptes utilisateurs, rôles et permissions",
    allUsers: "Tous",
    players: "Joueurs",
    coaches: "Entraîneurs",
    fans: "Fans",
    search: "Rechercher par nom, email ou téléphone...",
    noUsers: "Aucun utilisateur trouvé",
    totalUsers: "Total",
    verified: "Vérifié",
    pending: "En attente",
    email: "Email",
    phone: "Téléphone",
    role: "Rôle",
    team: "Équipe",
    favoriteTeam: "Équipe Favorite",
    registeredOn: "Inscrit le",
    verificationStatus: "Vérification",
    linkedTo: "Lié à",
    onRoster: "Sur le Roster",
    userId: "ID Utilisateur",
    editProfile: "Modifier",
    sendResetEmail: "Email Réinit.",
    sendResetSMS: "SMS Réinit.",
    deleteAccount: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    firstName: "Prénom",
    lastName: "Nom",
    showOnRoster: "Afficher sur le roster",
    photo: "Photo",
    notSet: "Non renseigné",
    yes: "Oui",
    no: "Non",
    player: "Joueur",
    coach: "Entraîneur",
    staff: "Staff",
    fan: "Fan",
    approved: "Approuvé",
    rejected: "Rejeté",
    notVerified: "Non vérifié",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "player" | "coach" | "fan">("all");
  const [search, setSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", showOnRoster: true, role: "", headshot: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(firebaseDB, "users"));
      const data = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id, firstName: d.firstName ?? "", lastName: d.lastName ?? "", email: d.email ?? "",
          phoneNumber: d.phoneNumber ?? "", role: d.role ?? "fan", teamId: d.teamId, teamName: d.teamName,
          favoriteTeamId: d.favoriteTeamId, favoriteTeamName: d.favoriteTeamName, headshot: d.headshot,
          verificationStatus: d.verificationStatus, linkedPlayerId: d.linkedPlayerId, linkedCoachId: d.linkedCoachId,
          showOnRoster: d.showOnRoster !== false, createdAt: d.createdAt?.toDate() || new Date(),
        } as UserAccount;
      });
      setUsers(data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) { console.error("Error fetching users:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = users.filter((user) => {
    const matchesFilter = filter === "all" || (filter === "coach" ? user.role === "coach" || user.role === "staff" : user.role === filter);
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) || user.phoneNumber?.includes(search) || user.teamName?.toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  const playerCount = users.filter((u) => u.role === "player").length;
  const coachCount = users.filter((u) => u.role === "coach" || u.role === "staff").length;
  const fanCount = users.filter((u) => u.role === "fan").length;
  const verifiedCount = users.filter((u) => u.verificationStatus === "approved").length;

  const openEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setEditForm({ firstName: user.firstName, lastName: user.lastName, showOnRoster: user.showOnRoster !== false, role: user.role, headshot: user.headshot ?? "" });
    setPhotoPreview(user.headshot ?? ""); setPhotoFile(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      let headshotUrl = editForm.headshot;
      if (photoFile) {
        const photoPath = `users/${editingUser.id}/headshot_${Date.now()}.png`;
        const photoStorageReference = storageRef(firebaseStorage, photoPath);
        await uploadBytes(photoStorageReference, photoFile);
        headshotUrl = await getDownloadURL(photoStorageReference);
      }
      await updateDoc(doc(firebaseDB, "users", editingUser.id), {
        firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim(),
        showOnRoster: editForm.showOnRoster, role: editForm.role, headshot: headshotUrl || null, updatedAt: serverTimestamp(),
      });
      setEditingUser(null); fetchUsers();
    } catch (error) { console.error("Error saving user:", error); }
    finally { setSaving(false); }
  };

  const sendPasswordReset = async (user: UserAccount, method: "email" | "sms") => {
    const target = method === "email" ? user.email : user.phoneNumber;
    if (!target || !confirm(`Send password reset via ${method} to ${target}?`)) return;
    setSendingReset(true);
    try {
      const response = await fetch("/api/auth/send-reset-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailOrPhone: target }) });
      const result = await response.json();
      if (response.ok) { alert("✅ Password reset sent successfully"); } else { throw new Error(result.error); }
    } catch (error) { console.error("Error sending reset:", error); alert("Error sending reset link"); }
    finally { setSendingReset(false); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    setDeletingUser(userId);
    try { await deleteDoc(doc(firebaseDB, "users", userId)); fetchUsers(); }
    catch (error) { console.error("Error deleting user:", error); }
    finally { setDeletingUser(null); }
  };

  const getRoleLabel = (role: string) => {
    if (role === "player") return copy.player; if (role === "coach") return copy.coach; if (role === "staff") return copy.staff; return copy.fan;
  };

  const getVerificationLabel = (status?: string) => {
    if (status === "approved") return { label: copy.approved, class: "text-green-400 bg-green-500/20" };
    if (status === "pending") return { label: copy.pending, class: "text-amber-400 bg-amber-500/20" };
    if (status === "rejected") return { label: copy.rejected, class: "text-red-400 bg-red-500/20" };
    return { label: copy.notVerified, class: "text-slate-400 bg-slate-500/20" };
  };

  const canManage = currentAdminUser?.permissions?.canManageTeams ?? false;

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">{copy.title}</h1><p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p></div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => setFilter("all")} className={`p-4 rounded-xl border text-left transition-all ${filter === "all" ? "border-white/40 bg-white/10 ring-2 ring-white/20" : "border-white/10 bg-blue-500/10 hover:border-white/20"}`}>
          <div className="text-sm text-slate-400">{copy.totalUsers}</div><div className="mt-2 text-3xl font-bold text-blue-400">{users.length}</div>
        </button>
        <button onClick={() => setFilter("player")} className={`p-4 rounded-xl border text-left transition-all ${filter === "player" ? "border-cyan-400/60 bg-cyan-500/20 ring-2 ring-cyan-400/30" : "border-white/10 bg-cyan-500/10 hover:border-white/20"}`}>
          <div className="text-sm text-slate-400">{copy.players}</div><div className="mt-2 text-3xl font-bold text-cyan-400">{playerCount}</div>
        </button>
        <button onClick={() => setFilter("coach")} className={`p-4 rounded-xl border text-left transition-all ${filter === "coach" ? "border-purple-400/60 bg-purple-500/20 ring-2 ring-purple-400/30" : "border-white/10 bg-purple-500/10 hover:border-white/20"}`}>
          <div className="text-sm text-slate-400">{copy.coaches}</div><div className="mt-2 text-3xl font-bold text-purple-400">{coachCount}</div>
        </button>
        <button onClick={() => setFilter("fan")} className={`p-4 rounded-xl border text-left transition-all ${filter === "fan" ? "border-orange-400/60 bg-orange-500/20 ring-2 ring-orange-400/30" : "border-white/10 bg-orange-500/10 hover:border-white/20"}`}>
          <div className="text-sm text-slate-400">{copy.fans}</div><div className="mt-2 text-3xl font-bold text-orange-400">{fanCount}</div>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search}
          className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
        {search && (<button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">✕</button>)}
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-400"><span className="text-green-400">✓ {verifiedCount}</span> {copy.verified}</div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (<div className="text-center py-12 text-slate-400">{copy.noUsers}</div>) : (
          filteredUsers.map((user) => (
            <div key={user.id} className={`rounded-xl border transition-all ${expandedUserId === user.id ? "border-cyan-400/40 bg-slate-800/60" : "border-white/10 bg-slate-800/30 hover:border-white/20"}`}>
              <div className="p-4 cursor-pointer" onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ${user.role === "player" ? "bg-gradient-to-br from-cyan-500 to-blue-600" : user.role === "coach" || user.role === "staff" ? "bg-gradient-to-br from-purple-500 to-pink-600" : "bg-gradient-to-br from-orange-500 to-amber-600"}`}>
                      {user.headshot ? (<Image src={user.headshot} alt={user.lastName} width={48} height={48} className="w-full h-full rounded-full object-cover" unoptimized />) : (<>{user.firstName?.[0]}{user.lastName?.[0]}</>)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-white text-lg">{user.firstName} {user.lastName}</h4>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.role === "player" ? "bg-cyan-500/20 text-cyan-400" : user.role === "coach" || user.role === "staff" ? "bg-purple-500/20 text-purple-400" : "bg-orange-500/20 text-orange-400"}`}>{getRoleLabel(user.role)}</span>
                        {user.verificationStatus === "approved" && (<span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-green-500/20 text-green-400">✓</span>)}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-slate-400"><span>📧 {user.email || copy.notSet}</span><span>📱 {user.phoneNumber || copy.notSet}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {user.teamName && (<span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-slate-300">🏀 {user.teamName}</span>)}
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedUserId === user.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              {expandedUserId === user.id && (
                <div className="border-t border-white/10 p-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{copy.email}</p><p className="text-white font-medium">{user.email || copy.notSet}</p></div>
                    <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{copy.phone}</p><p className="text-white font-medium">{user.phoneNumber || copy.notSet}</p></div>
                    <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{copy.role}</p><p className="text-white font-medium capitalize">{getRoleLabel(user.role)}</p></div>
                    <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{copy.team}</p><p className="text-white font-medium">{user.teamName || copy.notSet}</p></div>
                    <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{copy.registeredOn}</p><p className="text-white font-medium">{user.createdAt.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}</p></div>
                    <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{copy.verificationStatus}</p><p className={`font-medium ${getVerificationLabel(user.verificationStatus).class} px-2 py-0.5 rounded inline-block`}>{getVerificationLabel(user.verificationStatus).label}</p></div>
                  </div>
                  <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{copy.userId}</p><p className="text-white font-mono text-sm">{user.id}</p></div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button onClick={() => openEditModal(user)} className="rounded-lg bg-cyan-600/20 px-4 py-2 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-600/30">✏️ {copy.editProfile}</button>
                      {user.email && (<button onClick={() => sendPasswordReset(user, "email")} disabled={sendingReset} className="rounded-lg bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-400 transition hover:bg-blue-600/30 disabled:opacity-50">📧 {copy.sendResetEmail}</button>)}
                      {user.phoneNumber && (<button onClick={() => sendPasswordReset(user, "sms")} disabled={sendingReset} className="rounded-lg bg-green-600/20 px-4 py-2 text-sm font-semibold text-green-400 transition hover:bg-green-600/30 disabled:opacity-50">📱 {copy.sendResetSMS}</button>)}
                      <button onClick={() => handleDeleteUser(user.id)} disabled={deletingUser === user.id} className="rounded-lg bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-600/30 disabled:opacity-50">🗑️ {copy.deleteAccount}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/10"><h3 className="text-xl font-bold text-white">{copy.editProfile}</h3></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.firstName}</label><input type="text" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} placeholder={copy.firstName} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" /></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.lastName}</label><input type="text" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} placeholder={copy.lastName} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" /></div>
              </div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.role}</label><select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} title={copy.role} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"><option value="fan">{copy.fan}</option><option value="player">{copy.player}</option><option value="coach">{copy.coach}</option><option value="staff">{copy.staff}</option></select></div>
              <div className="flex items-center gap-3"><input type="checkbox" id="showOnRoster" checked={editForm.showOnRoster} onChange={(e) => setEditForm({ ...editForm, showOnRoster: e.target.checked })} className="w-5 h-5 rounded border-white/20 bg-slate-800" /><label htmlFor="showOnRoster" className="text-sm text-slate-300">{copy.showOnRoster}</label></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.photo}</label><div className="flex items-center gap-4">{photoPreview && (<div className="relative w-16 h-16 rounded-full bg-slate-800 overflow-hidden"><Image src={photoPreview} alt="Photo" fill className="object-cover" unoptimized /></div>)}<input type="file" accept="image/*" onChange={handlePhotoChange} title={copy.photo} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-500/20 file:text-orange-400 hover:file:bg-orange-500/30" /></div></div>
            </div>
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition">{copy.cancel}</button>
              <button onClick={handleSaveUser} disabled={saving} className="flex-1 py-2 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition disabled:opacity-50">{saving ? "..." : copy.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
