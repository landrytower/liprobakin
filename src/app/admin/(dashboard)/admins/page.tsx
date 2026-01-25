"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAdmin } from "../layout";
import { firebaseDB } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, where } from "firebase/firestore";
import { AdminRole } from "@/types/admin";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AdminUserData = {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  roles?: AdminRole[];
  createdAt?: { seconds: number };
  permissions?: {
    canManageNews?: boolean; canManageTeams?: boolean; canManageGames?: boolean;
    canManageReferees?: boolean; canManageVenues?: boolean; canManagePartners?: boolean;
    canManageAdmins?: boolean;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "Administrator Management",
    subtitle: "Manage admin users and permissions",
    admins: "Administrators",
    noAdmins: "No administrators found",
    email: "Email",
    role: "Role",
    permissions: "Permissions",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    editPermissions: "Edit Permissions",
    master: "Master Admin",
    league_manager: "League Manager",
    news_editor: "News Editor",
    game_scheduler: "Game Scheduler",
    team_manager: "Team Manager",
    referee_manager: "Referee Manager",
    venue_manager: "Venue Manager",
    partner_manager: "Partner Manager",
    news: "News", teams: "Teams", games: "Games",
    referees: "Referees", venues: "Venues", partners: "Partners", adminsPermission: "Admins",
    lastActive: "Last Active",
    allPermissions: "All Permissions",
  },
  fr: {
    title: "Gestion des Administrateurs",
    subtitle: "Gérer les utilisateurs administrateurs et les permissions",
    admins: "Administrateurs",
    noAdmins: "Aucun administrateur trouvé",
    email: "Email",
    role: "Rôle",
    permissions: "Permissions",
    actions: "Actions",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    editPermissions: "Modifier les Permissions",
    master: "Admin Principal",
    league_manager: "Directeur de Ligue",
    news_editor: "Rédacteur",
    game_scheduler: "Planificateur",
    team_manager: "Gestionnaire Équipes",
    referee_manager: "Gestionnaire Arbitres",
    venue_manager: "Gestionnaire Sites",
    partner_manager: "Gestionnaire Partenaires",
    news: "Actualités", teams: "Équipes", games: "Matchs",
    referees: "Arbitres", venues: "Sites", partners: "Partenaires", adminsPermission: "Admins",
    lastActive: "Dernière Activité",
    allPermissions: "Toutes les Permissions",
  },
};

const permissionKeys = ["canManageNews", "canManageTeams", "canManageGames", "canManageReferees", "canManageVenues", "canManagePartners", "canManageAdmins"] as const;
const permissionLabels = { en: { canManageNews: "News", canManageTeams: "Teams", canManageGames: "Games", canManageReferees: "Referees", canManageVenues: "Venues", canManagePartners: "Partners", canManageAdmins: "Admins" }, fr: { canManageNews: "Actualités", canManageTeams: "Équipes", canManageGames: "Matchs", canManageReferees: "Arbitres", canManageVenues: "Sites", canManagePartners: "Partenaires", canManageAdmins: "Admins" } };

export default function AdminsPage() {
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];

  const [admins, setAdmins] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAdmin, setEditingAdmin] = useState<AdminUserData | null>(null);
  const [permissionForm, setPermissionForm] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(firebaseDB, "users"), where("roles", "!=", null)));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminUserData)).filter((u) => u.roles && u.roles.length > 0);
      setAdmins(list);
    } catch (error) { console.error("Error fetching admins:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const openEditModal = (admin: AdminUserData) => {
    setEditingAdmin(admin);
    setPermissionForm(admin.permissions || {});
  };

  const savePermissions = async () => {
    if (!editingAdmin) return;
    setSaving(true);
    try {
      await updateDoc(doc(firebaseDB, "users", editingAdmin.id), { permissions: permissionForm, updatedAt: serverTimestamp() });
      setEditingAdmin(null); fetchAdmins();
    } catch (error) { console.error("Error saving permissions:", error); }
    finally { setSaving(false); }
  };

  const deleteAdmin = async (id: string) => {
    if (!confirm("Remove admin privileges from this user?")) return;
    try {
      await updateDoc(doc(firebaseDB, "users", id), { roles: [], permissions: {}, updatedAt: serverTimestamp() });
      fetchAdmins();
    } catch (error) { console.error("Error removing admin:", error); }
  };

  const getRoleColor = (roles?: AdminRole[]) => {
    if (!roles || roles.length === 0) return "bg-slate-700/50 text-slate-300 border border-slate-600";
    if (roles.includes("master")) return "bg-gradient-to-r from-amber-500 to-orange-500 text-white";
    if (roles.includes("league_manager")) return "bg-violet-500/20 text-violet-300 border border-violet-500/30";
    return "bg-slate-700/50 text-slate-300 border border-slate-600";
  };

  const getRoleLabel = (roles?: AdminRole[]) => {
    if (!roles || roles.length === 0) return "";
    if (roles.includes("master")) return copy.master;
    if (roles.includes("league_manager")) return copy.league_manager;
    if (roles.includes("news_editor")) return copy.news_editor;
    if (roles.includes("game_scheduler")) return copy.game_scheduler;
    if (roles.includes("team_manager")) return copy.team_manager;
    return roles[0];
  };

  const countPermissions = (perms?: Record<string, boolean>) => Object.values(perms || {}).filter(Boolean).length;
  const isMaster = (roles?: AdminRole[]) => roles?.includes("master");

  const canManageAdmins = currentAdminUser?.permissions?.canManageAdmins || currentAdminUser?.roles?.includes("master");

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">{copy.title}</h1><p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p></div>

      {/* Admin Count */}
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-violet-500/10 px-4 py-2 border border-violet-500/30">
          <span className="text-lg font-bold text-violet-300">{admins.length}</span>
          <span className="text-xs text-slate-400 ml-2">{copy.admins}</span>
        </div>
      </div>

      {/* Admins Table */}
      {admins.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-16 text-center">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-base font-semibold text-slate-300">{copy.noAdmins}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => (
            <div key={admin.id} className="rounded-xl border border-white/10 bg-slate-800/30 p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {admin.photoURL ? (<Image src={admin.photoURL} alt={admin.displayName || ""} width={48} height={48} className="object-cover w-full h-full" unoptimized />) : (<span className="text-violet-400 font-bold text-lg">{(admin.displayName?.[0] || admin.email[0]).toUpperCase()}</span>)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{admin.displayName || admin.email}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getRoleColor(admin.roles)}`}>
                      {getRoleLabel(admin.roles)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{admin.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">{copy.permissions}:</span>
                    <span className="text-xs font-semibold text-violet-300">{isMaster(admin.roles) ? copy.allPermissions : `${countPermissions(admin.permissions)}/7`}</span>
                  </div>
                </div>
                {canManageAdmins && !isMaster(admin.roles) && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openEditModal(admin)} className="px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 text-xs hover:bg-violet-600/30">{copy.edit}</button>
                    <button onClick={() => deleteAdmin(admin.id)} className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 text-xs hover:bg-red-600/30">{copy.delete}</button>
                  </div>
                )}
              </div>
              {/* Permission Badges */}
              {admin.permissions && Object.keys(admin.permissions).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3 pl-16">
                  {permissionKeys.map((key) => admin.permissions?.[key] && (<span key={key} className="px-2 py-0.5 rounded bg-slate-700/50 text-[10px] text-slate-300">{permissionLabels[language][key]}</span>))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white">{copy.editPermissions}</h3>
              <p className="text-sm text-slate-400">{editingAdmin.displayName || editingAdmin.email}</p>
            </div>
            <div className="p-6 space-y-3">
              {permissionKeys.map((key) => (
                <label key={key} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 cursor-pointer">
                  <span className="text-sm text-white">{permissionLabels[language][key]}</span>
                  <input type="checkbox" checked={permissionForm[key] || false} onChange={(e) => setPermissionForm({ ...permissionForm, [key]: e.target.checked })} className="w-5 h-5 rounded accent-violet-500" />
                </label>
              ))}
            </div>
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button onClick={() => setEditingAdmin(null)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700">{copy.cancel}</button>
              <button onClick={savePermissions} disabled={saving} className="flex-1 py-2 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-500 disabled:opacity-50">{saving ? "..." : copy.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
