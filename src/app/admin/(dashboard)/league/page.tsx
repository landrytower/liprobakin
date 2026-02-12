"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAdmin } from "../layout";
import { firebaseDB, firebaseStorage, firebaseAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Referee = { id: string; firstName: string; lastName: string; phone: string; headshot?: string };
type CommitteeMember = { id: string; firstName: string; lastName: string; role: string; email?: string; phone?: string; photo?: string; bio?: string; experience?: string; education?: string; department?: string; twitter?: string; linkedin?: string; facebook?: string; instagram?: string };
type Venue = { id: string; name: string; address: string; city: string; capacity?: number; photo?: string };

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "League Management",
    subtitle: "Manage referees, committee members, and venues",
    referees: "Referees",
    committee: "Committee",
    partners: "Partners",
    venues: "Venues",
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    firstName: "First Name",
    lastName: "Last Name",
    phone: "Phone",
    email: "Email",
    role: "Role",
    name: "Name",
    address: "Address",
    city: "City",
    capacity: "Capacity",
    photo: "Photo",
    noReferees: "No referees added",
    noCommittee: "No committee members",
    noVenues: "No venues added",
    bio: "Biography",
    experience: "Experience",
    education: "Education",
    department: "Department",
    twitter: "Twitter URL",
    linkedin: "LinkedIn URL",
    facebook: "Facebook URL",
    instagram: "Instagram URL",
    viewProfile: "View Profile",
    databaseReset: "Database Reset",
    resetDescription: "Delete all games, standings and reset all team/player statistics to 0.",
    resetStats: "Reset All Stats",
    resetWarning: "This action cannot be undone!",
    confirmReset: "Are you sure you want to reset all statistics?",
  },
  fr: {
    title: "Gestion de la Ligue",
    subtitle: "Gérer les arbitres, les membres du comité et les sites",
    referees: "Arbitres",
    committee: "Comité",
    partners: "Partenaires",
    venues: "Sites",
    add: "Ajouter",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    firstName: "Prénom",
    lastName: "Nom",
    phone: "Téléphone",
    email: "Email",
    role: "Rôle",
    name: "Nom",
    address: "Adresse",
    city: "Ville",
    capacity: "Capacité",
    photo: "Photo",
    noReferees: "Aucun arbitre ajouté",
    noCommittee: "Aucun membre du comité",
    noVenues: "Aucun site ajouté",
    bio: "Biographie",
    experience: "Expérience",
    education: "Éducation",
    department: "Département",
    twitter: "URL Twitter",
    linkedin: "URL LinkedIn",
    facebook: "URL Facebook",
    instagram: "URL Instagram",
    viewProfile: "Voir le profil",
    databaseReset: "Réinitialisation",
    resetDescription: "Supprimer tous les matchs, classements et remettre les stats équipes/joueurs à 0.",
    resetStats: "Réinitialiser",
    resetWarning: "Cette action est irréversible!",
    confirmReset: "Êtes-vous sûr de vouloir réinitialiser toutes les statistiques?",
  },
};

export default function LeaguePage() {
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];

  const [activeTab, setActiveTab] = useState<"referees" | "committee" | "venues">("referees");
  const [referees, setReferees] = useState<Referee[]>([]);
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showRefereeModal, setShowRefereeModal] = useState(false);
  const [editingReferee, setEditingReferee] = useState<Referee | null>(null);
  const [refereeForm, setRefereeForm] = useState({ firstName: "", lastName: "", phone: "", headshot: "" });
  const [refereePhoto, setRefereePhoto] = useState<File | null>(null);
  const [refereePhotoPreview, setRefereePhotoPreview] = useState("");

  const [showCommitteeModal, setShowCommitteeModal] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<CommitteeMember | null>(null);
  const [committeeForm, setCommitteeForm] = useState({ firstName: "", lastName: "", role: "", email: "", phone: "", photo: "", bio: "", experience: "", education: "", department: "", twitter: "", linkedin: "", facebook: "", instagram: "" });
  const [committeePhoto, setCommitteePhoto] = useState<File | null>(null);
  const [committeePhotoPreview, setCommitteePhotoPreview] = useState("");

  const [showVenueModal, setShowVenueModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [venueForm, setVenueForm] = useState({ name: "", address: "", city: "", capacity: "", photo: "" });
  const [venuePhoto, setVenuePhoto] = useState<File | null>(null);
  const [venuePhotoPreview, setVenuePhotoPreview] = useState("");

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [refSnap, comSnap, venSnap] = await Promise.all([
        getDocs(collection(firebaseDB, "referees")),
        getDocs(collection(firebaseDB, "committee")),
        getDocs(collection(firebaseDB, "venues")),
      ]);
      setReferees(refSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Referee)));
      setCommittee(comSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CommitteeMember)));
      setVenues(venSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Venue)));
    } catch (error) { console.error("Error fetching league data:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Referee CRUD
  const openRefereeModal = (ref?: Referee) => {
    setEditingReferee(ref || null);
    setRefereeForm(ref ? { firstName: ref.firstName, lastName: ref.lastName, phone: ref.phone, headshot: ref.headshot || "" } : { firstName: "", lastName: "", phone: "", headshot: "" });
    setRefereePhotoPreview(ref?.headshot || ""); setRefereePhoto(null); setShowRefereeModal(true);
  };

  const saveReferee = async () => {
    if (!refereeForm.firstName || !refereeForm.lastName) return;
    setSaving(true);
    try {
      let photoUrl = refereeForm.headshot;
      if (refereePhoto) {
        const path = `league/referees/${Date.now()}.png`;
        const storageReference = storageRef(firebaseStorage, path);
        await uploadBytes(storageReference, refereePhoto);
        photoUrl = await getDownloadURL(storageReference);
      }
      const data = { firstName: refereeForm.firstName.trim(), lastName: refereeForm.lastName.trim(), phone: refereeForm.phone, headshot: photoUrl || null, updatedAt: serverTimestamp() };
      if (editingReferee) { await updateDoc(doc(firebaseDB, "referees", editingReferee.id), data); }
      else { await addDoc(collection(firebaseDB, "referees"), { ...data, createdAt: serverTimestamp() }); }
      setShowRefereeModal(false); fetchData();
    } catch (error) { console.error("Error saving referee:", error); }
    finally { setSaving(false); }
  };

  const deleteReferee = async (id: string) => {
    if (!confirm("Delete this referee?")) return;
    try { await deleteDoc(doc(firebaseDB, "referees", id)); fetchData(); } catch (error) { console.error(error); }
  };

  // Committee CRUD
  const openCommitteeModal = (mem?: CommitteeMember) => {
    setEditingCommittee(mem || null);
    setCommitteeForm(mem ? { firstName: mem.firstName, lastName: mem.lastName, role: mem.role, email: mem.email || "", phone: mem.phone || "", photo: mem.photo || "", bio: mem.bio || "", experience: mem.experience || "", education: mem.education || "", department: mem.department || "", twitter: mem.twitter || "", linkedin: mem.linkedin || "", facebook: mem.facebook || "", instagram: mem.instagram || "" } : { firstName: "", lastName: "", role: "", email: "", phone: "", photo: "", bio: "", experience: "", education: "", department: "", twitter: "", linkedin: "", facebook: "", instagram: "" });
    setCommitteePhotoPreview(mem?.photo || ""); setCommitteePhoto(null); setShowCommitteeModal(true);
  };

  const saveCommittee = async () => {
    if (!committeeForm.firstName || !committeeForm.lastName || !committeeForm.role) return;
    setSaving(true);
    try {
      let photoUrl = committeeForm.photo;
      if (committeePhoto) {
        const path = `league/committee/${Date.now()}.png`;
        const storageReference = storageRef(firebaseStorage, path);
        await uploadBytes(storageReference, committeePhoto);
        photoUrl = await getDownloadURL(storageReference);
      }
      const data: any = { 
        firstName: committeeForm.firstName.trim(), 
        lastName: committeeForm.lastName.trim(), 
        role: committeeForm.role.trim(), 
        email: committeeForm.email?.trim() || "", 
        phone: committeeForm.phone?.trim() || "", 
        photo: photoUrl || "", 
        bio: committeeForm.bio?.trim() || "", 
        experience: committeeForm.experience?.trim() || "", 
        education: committeeForm.education?.trim() || "", 
        department: committeeForm.department?.trim() || "", 
        twitter: committeeForm.twitter?.trim() || "", 
        linkedin: committeeForm.linkedin?.trim() || "", 
        facebook: committeeForm.facebook?.trim() || "", 
        instagram: committeeForm.instagram?.trim() || "", 
        updatedAt: serverTimestamp() 
      };
      if (editingCommittee) { 
        await updateDoc(doc(firebaseDB, "committee", editingCommittee.id), data); 
      } else { 
        await addDoc(collection(firebaseDB, "committee"), { ...data, createdAt: serverTimestamp() }); 
      }
      setShowCommitteeModal(false); fetchData();
    } catch (error) { console.error("Error saving committee member:", error); }
    finally { setSaving(false); }
  };

  const deleteCommittee = async (id: string) => {
    if (!confirm("Delete this committee member?")) return;
    try { await deleteDoc(doc(firebaseDB, "committee", id)); fetchData(); } catch (error) { console.error(error); }
  };

  // Venue CRUD
  const openVenueModal = (ven?: Venue) => {
    setEditingVenue(ven || null);
    setVenueForm(ven ? { name: ven.name, address: ven.address, city: ven.city, capacity: ven.capacity?.toString() || "", photo: ven.photo || "" } : { name: "", address: "", city: "", capacity: "", photo: "" });
    setVenuePhotoPreview(ven?.photo || ""); setVenuePhoto(null); setShowVenueModal(true);
  };

  const saveVenue = async () => {
    if (!venueForm.name || !venueForm.city) return;
    setSaving(true);
    try {
      let photoUrl = venueForm.photo;
      if (venuePhoto) {
        const path = `league/venues/${Date.now()}.png`;
        const storageReference = storageRef(firebaseStorage, path);
        await uploadBytes(storageReference, venuePhoto);
        photoUrl = await getDownloadURL(storageReference);
      }
      const data = { name: venueForm.name.trim(), address: venueForm.address.trim(), city: venueForm.city.trim(), capacity: venueForm.capacity ? parseInt(venueForm.capacity) : null, photo: photoUrl || null, updatedAt: serverTimestamp() };
      if (editingVenue) { await updateDoc(doc(firebaseDB, "venues", editingVenue.id), data); }
      else { await addDoc(collection(firebaseDB, "venues"), { ...data, createdAt: serverTimestamp() }); }
      setShowVenueModal(false); fetchData();
    } catch (error) { console.error("Error saving venue:", error); }
    finally { setSaving(false); }
  };

  const deleteVenue = async (id: string) => {
    if (!confirm("Delete this venue?")) return;
    try { await deleteDoc(doc(firebaseDB, "venues", id)); fetchData(); } catch (error) { console.error(error); }
  };

  // Database Reset with password verification
  const handleResetClick = () => {
    setResetPassword("");
    setResetError("");
    setResetSuccess("");
    setShowPasswordModal(true);
  };

  const handleResetStats = async () => {
    if (!currentAdminUser?.email || !resetPassword) {
      setResetError(language === "fr" ? "Mot de passe requis" : "Password required");
      return;
    }

    setResetting(true);
    setResetError("");

    try {
      // Verify password
      await signInWithEmailAndPassword(firebaseAuth, currentAdminUser.email, resetPassword);

      // Delete all games
      const gamesSnap = await getDocs(collection(firebaseDB, "games"));
      const batch1 = writeBatch(firebaseDB);
      gamesSnap.docs.forEach((d) => batch1.delete(d.ref));
      if (gamesSnap.docs.length > 0) await batch1.commit();

      // Delete all standings
      const standingsSnap = await getDocs(collection(firebaseDB, "standings"));
      const batch2 = writeBatch(firebaseDB);
      standingsSnap.docs.forEach((d) => batch2.delete(d.ref));
      if (standingsSnap.docs.length > 0) await batch2.commit();

      // Reset team stats and player stats
      const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
      for (const teamDoc of teamsSnap.docs) {
        await updateDoc(teamDoc.ref, { wins: 0, losses: 0, totalPoints: 0, updatedAt: serverTimestamp() });
        // Reset player stats
        const rosterSnap = await getDocs(collection(firebaseDB, `teams/${teamDoc.id}/roster`));
        for (const playerDoc of rosterSnap.docs) {
          await updateDoc(playerDoc.ref, {
            stats: { pts: "0.0", reb: "0.0", ast: "0.0", stl: "0.0", blk: "0.0" },
            gamesPlayed: 0,
            updatedAt: serverTimestamp(),
          });
        }
      }

      setResetSuccess(language === "fr" 
        ? `✓ Réinitialisation terminée! ${gamesSnap.docs.length} matchs supprimés, ${teamsSnap.docs.length} équipes réinitialisées.`
        : `✓ Reset complete! Deleted ${gamesSnap.docs.length} games, reset ${teamsSnap.docs.length} teams.`);
      setResetPassword("");
      setTimeout(() => setShowPasswordModal(false), 3000);
    } catch (error: any) {
      console.error("Error resetting stats:", error);
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        setResetError(language === "fr" ? "Mot de passe incorrect" : "Incorrect password");
      } else {
        setResetError(language === "fr" ? "Erreur lors de la réinitialisation" : "Reset failed");
      }
    } finally {
      setResetting(false);
    }
  };

  const canManage = currentAdminUser?.permissions?.canManageReferees || currentAdminUser?.permissions?.canManageVenues || currentAdminUser?.permissions?.canManagePartners;

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <div className="space-y-6">
      {/* Database Reset Warning - Only for master admins */}
      {currentAdminUser?.roles?.includes('master') && (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-rose-300 font-bold flex items-center gap-2">⚠️ {copy.databaseReset}</h3>
          <p className="text-sm text-slate-400 mt-1">{copy.resetDescription}</p>
        </div>
        <button onClick={handleResetClick} className="px-4 py-2 border border-rose-500 text-rose-400 rounded-xl hover:bg-rose-500/20 transition text-sm font-semibold whitespace-nowrap">
          {copy.resetStats}
        </button>
      </div>
      )}

      {/* Password Confirmation Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-rose-300 mb-2">⚠️ {language === "fr" ? "Confirmation requise" : "Confirmation Required"}</h3>
            <p className="text-sm text-slate-400 mb-4">
              {language === "fr" 
                ? "Cette action supprimera tous les matchs, classements et réinitialisera toutes les statistiques à 0. Entrez votre mot de passe pour confirmer."
                : "This will delete all games, standings and reset all stats to 0. Enter your password to confirm."}
            </p>
            
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder={language === "fr" ? "Votre mot de passe" : "Your password"}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none mb-4"
              onKeyDown={(e) => e.key === "Enter" && handleResetStats()}
            />

            {resetError && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                {resetError}
              </div>
            )}
            
            {resetSuccess && (
              <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
                {resetSuccess}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white hover:bg-slate-700 transition"
              >
                {copy.cancel}
              </button>
              <button
                onClick={handleResetStats}
                disabled={resetting || !resetPassword}
                className="flex-1 rounded-xl border border-rose-500 bg-rose-500/20 px-4 py-3 text-rose-300 font-semibold hover:bg-rose-500/30 transition disabled:opacity-50"
              >
                {resetting ? "..." : language === "fr" ? "Confirmer la réinitialisation" : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div><h1 className="text-2xl font-bold text-white">{copy.title}</h1><p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p></div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link 
          href="/admin/league/referees"
          className="group relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 p-6 transition hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/20"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">👨‍⚖️</span>
              <svg className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{copy.referees}</h3>
            <p className="text-sm text-indigo-300">{language === "fr" ? "Gérer les arbitres" : "Manage referees"}</p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition" />
        </Link>

        <Link 
          href="/admin/league/committee"
          className="group relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/20 to-violet-900/20 p-6 transition hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/20"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">👔</span>
              <svg className="w-5 h-5 text-violet-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{copy.committee}</h3>
            <p className="text-sm text-violet-300">{language === "fr" ? "Gérer le comité" : "Manage committee"}</p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition" />
        </Link>

        <Link 
          href="/admin/league/partners"
          className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 p-6 transition hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/20"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">🤝</span>
              <svg className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{copy.partners || (language === "fr" ? "Partenaires" : "Partners")}</h3>
            <p className="text-sm text-emerald-300">{language === "fr" ? "Gérer les partenaires" : "Manage partners"}</p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition" />
        </Link>

        <Link 
          href="/admin/league/venues"
          className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-600/20 to-cyan-900/20 p-6 transition hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/20"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">🏟️</span>
              <svg className="w-5 h-5 text-cyan-300 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{copy.venues}</h3>
            <p className="text-sm text-cyan-200">{language === "fr" ? "Gerer les sites" : "Manage venues"}</p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl border border-white/10 w-fit">
        {(["referees", "committee", "venues"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"}`}>
            {tab === "referees" ? copy.referees : tab === "committee" ? copy.committee : copy.venues}
            <span className="ml-2 text-xs opacity-70">({tab === "referees" ? referees.length : tab === "committee" ? committee.length : venues.length})</span>
          </button>
        ))}
      </div>

      {/* Referees Tab */}
      {activeTab === "referees" && (
        <div className="space-y-4">
          {canManage && (<button onClick={() => openRefereeModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition">+ {copy.add} {copy.referees}</button>)}
          {referees.length === 0 ? (<div className="text-center py-12 text-slate-400">{copy.noReferees}</div>) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {referees.map((ref) => (
                <div key={ref.id} className="rounded-xl border border-white/10 bg-slate-800/30 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-600/20 flex items-center justify-center overflow-hidden">
                    {ref.headshot ? (<Image src={ref.headshot} alt={ref.lastName} width={48} height={48} className="object-cover w-full h-full" unoptimized />) : (<span className="text-indigo-400 font-bold">{ref.firstName[0]}{ref.lastName[0]}</span>)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{ref.firstName} {ref.lastName}</p>
                    <p className="text-xs text-slate-400">{ref.phone || "—"}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={() => openRefereeModal(ref)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">✏️</button>
                      <button onClick={() => deleteReferee(ref.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400">🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Committee Tab */}
      {activeTab === "committee" && (
        <div className="space-y-4">
          {canManage && (<button onClick={() => openCommitteeModal()} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-500 transition">+ {copy.add} {copy.committee}</button>)}
          {committee.length === 0 ? (<div className="text-center py-12 text-slate-400">{copy.noCommittee}</div>) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {committee.map((mem) => (
                <div key={mem.id} className="rounded-xl border border-white/10 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-full bg-violet-600/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {mem.photo ? (<Image src={mem.photo} alt={mem.lastName} width={56} height={56} className="object-cover w-full h-full" unoptimized />) : (<span className="text-violet-400 font-bold text-lg">{mem.firstName[0]}{mem.lastName[0]}</span>)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{mem.firstName} {mem.lastName}</p>
                      <p className="text-xs text-violet-400">{mem.role}</p>
                      {mem.department && <p className="text-xs text-slate-500">{mem.department}</p>}
                      {mem.email && <p className="text-xs text-slate-500 truncate mt-1">{mem.email}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href={`/staff/${mem.id}`} target="_blank" className="flex-1 py-1.5 rounded-lg bg-slate-800/50 text-slate-300 text-xs hover:bg-slate-800 text-center transition">{copy.viewProfile}</Link>
                    {canManage && (
                      <>
                        <button onClick={() => openCommitteeModal(mem)} className="flex-1 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 text-xs hover:bg-violet-600/30">{copy.edit}</button>
                        <button onClick={() => deleteCommittee(mem.id)} className="py-1.5 px-3 rounded-lg bg-red-600/20 text-red-300 text-xs hover:bg-red-600/30">{copy.delete}</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Venues Tab */}
      {activeTab === "venues" && (
        <div className="space-y-4">
          {canManage && (<button onClick={() => openVenueModal()} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500 transition">+ {copy.add} {copy.venues}</button>)}
          {venues.length === 0 ? (<div className="text-center py-12 text-slate-400">{copy.noVenues}</div>) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((ven) => (
                <div key={ven.id} className="rounded-xl border border-white/10 bg-slate-800/30 p-4">
                  {ven.photo && (<div className="relative h-32 rounded-lg overflow-hidden mb-3"><Image src={ven.photo} alt={ven.name} fill className="object-cover" unoptimized /></div>)}
                  <p className="font-semibold text-white">{ven.name}</p>
                  <p className="text-xs text-slate-400">{ven.address}, {ven.city}</p>
                  {ven.capacity && <p className="text-xs text-emerald-400 mt-1">{copy.capacity}: {ven.capacity}</p>}
                  {canManage && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openVenueModal(ven)} className="flex-1 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs hover:bg-emerald-600/30">{copy.edit}</button>
                      <button onClick={() => deleteVenue(ven.id)} className="flex-1 py-1.5 rounded-lg bg-red-600/20 text-red-300 text-xs hover:bg-red-600/30">{copy.delete}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Referee Modal */}
      {showRefereeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/10"><h3 className="text-xl font-bold text-white">{editingReferee ? copy.edit : copy.add} {copy.referees}</h3></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.firstName}</label><input type="text" value={refereeForm.firstName} onChange={(e) => setRefereeForm({ ...refereeForm, firstName: e.target.value })} placeholder={copy.firstName} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.lastName}</label><input type="text" value={refereeForm.lastName} onChange={(e) => setRefereeForm({ ...refereeForm, lastName: e.target.value })} placeholder={copy.lastName} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              </div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.phone}</label><input type="tel" value={refereeForm.phone} onChange={(e) => setRefereeForm({ ...refereeForm, phone: e.target.value })} placeholder={copy.phone} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.photo}</label><div className="flex items-center gap-4">{refereePhotoPreview && (<div className="relative w-12 h-12 rounded-full overflow-hidden"><Image src={refereePhotoPreview} alt="Preview" fill className="object-cover" unoptimized /></div>)}<input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setRefereePhoto(f); setRefereePhotoPreview(URL.createObjectURL(f)); } }} title={copy.photo} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white" /></div></div>
            </div>
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button onClick={() => setShowRefereeModal(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700">{copy.cancel}</button>
              <button onClick={saveReferee} disabled={saving} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 disabled:opacity-50">{saving ? "..." : copy.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Committee Modal */}
      {showCommitteeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 rounded-2xl border border-white/10 shadow-2xl my-8">
            <div className="p-6 border-b border-white/10"><h3 className="text-xl font-bold text-white">{editingCommittee ? copy.edit : copy.add} {copy.committee}</h3></div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Basic Info Row */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.firstName}</label><input type="text" value={committeeForm.firstName} onChange={(e) => setCommitteeForm({ ...committeeForm, firstName: e.target.value })} placeholder={copy.firstName} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.lastName}</label><input type="text" value={committeeForm.lastName} onChange={(e) => setCommitteeForm({ ...committeeForm, lastName: e.target.value })} placeholder={copy.lastName} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              </div>
              {/* Role & Department Row */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.role}</label><input type="text" value={committeeForm.role} onChange={(e) => setCommitteeForm({ ...committeeForm, role: e.target.value })} placeholder={copy.role} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.department}</label><input type="text" value={committeeForm.department} onChange={(e) => setCommitteeForm({ ...committeeForm, department: e.target.value })} placeholder={copy.department} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              </div>
              
              {/* Biography Section - Prominent */}
              <div className="pt-3 border-t border-violet-500/20">
                <label className="block text-base font-semibold text-violet-400 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {copy.bio}
                </label>
                <textarea 
                  value={committeeForm.bio} 
                  onChange={(e) => setCommitteeForm({ ...committeeForm, bio: e.target.value })} 
                  placeholder={language === "fr" ? "Présentez cette personne... Cette biographie sera affichée sur leur page de profil." : "Introduce this person... This biography will be shown on their profile page."} 
                  rows={5} 
                  className="w-full px-4 py-3 bg-slate-800 border border-violet-500/30 rounded-xl text-white resize-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" 
                />
                <p className="text-xs text-slate-500 mt-1">{language === "fr" ? "📝 Sera visible sur la page du membre" : "📝 Will be visible on member's profile page"}</p>
              </div>

              {/* Contact Row */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.email}</label><input type="email" value={committeeForm.email} onChange={(e) => setCommitteeForm({ ...committeeForm, email: e.target.value })} placeholder={copy.email} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.phone}</label><input type="tel" value={committeeForm.phone} onChange={(e) => setCommitteeForm({ ...committeeForm, phone: e.target.value })} placeholder={copy.phone} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              </div>
              {/* Photo */}
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.photo}</label><div className="flex items-center gap-4">{committeePhotoPreview && (<div className="relative w-16 h-16 rounded-full overflow-hidden"><Image src={committeePhotoPreview} alt="Preview" fill className="object-cover" unoptimized /></div>)}<input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCommitteePhoto(f); setCommitteePhotoPreview(URL.createObjectURL(f)); } }} title={copy.photo} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white" /></div></div>
              {/* Experience */}
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.experience}</label><textarea value={committeeForm.experience} onChange={(e) => setCommitteeForm({ ...committeeForm, experience: e.target.value })} placeholder={language === "fr" ? "Expérience professionnelle..." : "Professional experience..."} rows={3} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white resize-none" /></div>
              {/* Education */}
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.education}</label><input type="text" value={committeeForm.education} onChange={(e) => setCommitteeForm({ ...committeeForm, education: e.target.value })} placeholder={language === "fr" ? "Formation académique..." : "Academic background..."} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              {/* Social Media Section */}
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm font-medium text-slate-400 mb-3">{language === "fr" ? "Réseaux sociaux" : "Social Media"}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs text-slate-500 mb-1">{copy.twitter}</label><input type="url" value={committeeForm.twitter} onChange={(e) => setCommitteeForm({ ...committeeForm, twitter: e.target.value })} placeholder="https://twitter.com/..." className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">{copy.linkedin}</label><input type="url" value={committeeForm.linkedin} onChange={(e) => setCommitteeForm({ ...committeeForm, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">{copy.facebook}</label><input type="url" value={committeeForm.facebook} onChange={(e) => setCommitteeForm({ ...committeeForm, facebook: e.target.value })} placeholder="https://facebook.com/..." className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">{copy.instagram}</label><input type="url" value={committeeForm.instagram} onChange={(e) => setCommitteeForm({ ...committeeForm, instagram: e.target.value })} placeholder="https://instagram.com/..." className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm" /></div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button onClick={() => setShowCommitteeModal(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700">{copy.cancel}</button>
              <button onClick={saveCommittee} disabled={saving} className="flex-1 py-2 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-500 disabled:opacity-50">{saving ? "..." : copy.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Venue Modal */}
      {showVenueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/10"><h3 className="text-xl font-bold text-white">{editingVenue ? copy.edit : copy.add} {copy.venues}</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.name}</label><input type="text" value={venueForm.name} onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })} placeholder={copy.name} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.address}</label><input type="text" value={venueForm.address} onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })} placeholder={copy.address} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.city}</label><input type="text" value={venueForm.city} onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })} placeholder={copy.city} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.capacity}</label><input type="number" value={venueForm.capacity} onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value })} placeholder="500" className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              </div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.photo}</label><div className="flex items-center gap-4">{venuePhotoPreview && (<div className="relative w-16 h-16 rounded-lg overflow-hidden"><Image src={venuePhotoPreview} alt="Preview" fill className="object-cover" unoptimized /></div>)}<input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setVenuePhoto(f); setVenuePhotoPreview(URL.createObjectURL(f)); } }} title={copy.photo} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white" /></div></div>
            </div>
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button onClick={() => setShowVenueModal(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700">{copy.cancel}</button>
              <button onClick={saveVenue} disabled={saving} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 disabled:opacity-50">{saving ? "..." : copy.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
