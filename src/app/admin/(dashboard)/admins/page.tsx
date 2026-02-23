"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAdmin } from "../layout";
import { firebaseDB, firebaseAuth } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import type { AdminRole, AdminPermissions } from "@/types/admin";
import { logAuditAction } from "@/lib/auditLog";

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminUserData = {
  id: string;
  email: string;
  displayName?: string;
  photo?: string;
  roles?: AdminRole[];
  createdAt?: { seconds: number };
  isPendingSetup?: boolean;
  isFirstLogin?: boolean;
  isActive?: boolean;
  lastLogin?: { seconds: number } | null;
  permissions?: {
    canManageNews?: boolean; canManageTeams?: boolean; canManageGames?: boolean;
    canManageReferees?: boolean; canManageVenues?: boolean; canManagePartners?: boolean; canManageEubakin?: boolean;
    canManageGameMedia?: boolean;
    canManageAdmins?: boolean;
  };
};

type InviteStep = "info" | "roles" | "review";

// ─── Translations ────────────────────────────────────────────────────────────

const translations = {
  en: {
    title: "Admin Management",
    subtitle: "Invite new admins, assign roles, and manage your team.",
    inviteAdmin: "Add New Admin",
    adminsCount: "Total Admins",
    pendingCount: "Pending Setup",
    activeCount: "Active",
    noAdmins: "No administrators found",
    noAdminsDesc: "Invite your first team member to get started.",
    step1Title: "Admin Information",
    step1Desc: "Who are you inviting?",
    step2Title: "Assign Roles",
    step2Desc: "What can they access?",
    step3Title: "Review & Send",
    step3Desc: "Confirm and send the invitation",
    emailLabel: "Email Address",
    emailPlaceholder: "admin@example.com",
    nameLabel: "Full Name",
    namePlaceholder: "e.g. Jean-Pierre Mbala",
    next: "Continue",
    back: "Back",
    cancel: "Cancel",
    sendInvite: "Create Admin",
    sending: "Creating...",
    selectRoles: "Select at least one role",
    passwordLabel: "Password",
    passwordPlaceholder: "Minimum 6 characters",
    confirmPasswordLabel: "Confirm Password",
    confirmPasswordPlaceholder: "Re-enter password",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 6 characters",
    passwordSet: "Password has been set",
    adminCanChangePassword: "The admin can change their password after logging in.",
    master: "Master Admin",
    masterDesc: "Full control — manages everything including other admins",
    league_manager: "League Manager",
    league_managerDesc: "Manages all league content except admin accounts",
    media_manager: "Media Manager",
    media_managerDesc: "Manage game photos and highlight videos",
    eubakin_manager: "EUBAKIN Manager",
    eubakin_managerDesc: "Manages EUBAKIN teams, schedule, and scores",
    news_editor: "News Editor",
    news_editorDesc: "Create and manage news articles and stories",
    game_scheduler: "Game Scheduler",
    game_schedulerDesc: "Schedule and manage games and matchdays",
    team_manager: "Team Manager",
    team_managerDesc: "Manage teams, rosters, and player profiles",
    referee_manager: "Referee Manager",
    referee_managerDesc: "Assign and manage referees",
    venue_manager: "Venue Manager",
    venue_managerDesc: "Manage stadiums and game venues",
    partner_manager: "Partner Manager",
    partner_managerDesc: "Manage sponsors, partners, and committee",
    reviewTitle: "You're about to invite",
    reviewRoles: "With these roles",
    reviewEmailNote: "They'll receive an email with a link to set their password and access the admin dashboard.",
    status: "Status",
    active: "Active",
    pending: "Pending Setup",
    invited: "Invited",
    role: "Role",
    permissions: "Permissions",
    allPermissions: "All Permissions",
    edit: "Edit Permissions",
    remove: "Remove",
    copyLink: "Copy Invite Link",
    resend: "Resend Invite",
    joined: "Joined",
    lastActive: "Last active",
    never: "Never",
    inviteSuccess: "Admin created!",
    inviteSuccessDesc: "account has been created. They can log in with the password you set.",
    inviteFailed: "Invitation failed",
    linkCopied: "Invite link copied to clipboard!",
    linkCopyFailed: "Could not copy link. Check console for the link.",
    confirmRemove: "Are you sure you want to remove this admin? This action cannot be undone.",
    removeSuccess: "Admin removed successfully",
    removeFailed: "Failed to remove admin",
    removing: "Deleting admin...",
    editRoles: "Edit Permissions",
    saveChanges: "Save Changes",
    saving: "Saving...",
    noRolesAssigned: "No roles assigned yet",
  },
  fr: {
    title: "Gestion des Administrateurs",
    subtitle: "Invitez de nouveaux admins, attribuez des rôles et gérez votre équipe.",
    inviteAdmin: "Ajouter un Admin",
    adminsCount: "Total Admins",
    pendingCount: "En Attente",
    activeCount: "Actifs",
    noAdmins: "Aucun administrateur trouvé",
    noAdminsDesc: "Invitez votre premier membre d'équipe pour commencer.",
    step1Title: "Informations",
    step1Desc: "Qui invitez-vous ?",
    step2Title: "Rôles",
    step2Desc: "Quels accès ?",
    step3Title: "Confirmation",
    step3Desc: "Vérifier et envoyer l'invitation",
    emailLabel: "Adresse Email",
    emailPlaceholder: "admin@exemple.com",
    nameLabel: "Nom Complet",
    namePlaceholder: "ex. Jean-Pierre Mbala",
    next: "Continuer",
    back: "Retour",
    cancel: "Annuler",
    sendInvite: "Créer l'Admin",
    sending: "Création...",
    selectRoles: "Sélectionnez au moins un rôle",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Minimum 6 caractères",
    confirmPasswordLabel: "Confirmer le mot de passe",
    confirmPasswordPlaceholder: "Ressaisir le mot de passe",
    passwordMismatch: "Les mots de passe ne correspondent pas",
    passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères",
    passwordSet: "Mot de passe défini",
    adminCanChangePassword: "L'admin pourra changer son mot de passe après connexion.",
    master: "Admin Principal",
    masterDesc: "Contrôle total — gère tout, y compris les autres admins",
    league_manager: "Directeur de Ligue",
    league_managerDesc: "Gère tout le contenu de la ligue sauf les comptes admin",
    media_manager: "Gestionnaire Média",
    media_managerDesc: "Gère les photos de match et les vidéos des highlights",
    eubakin_manager: "Gestionnaire EUBAKIN",
    eubakin_managerDesc: "Gère les équipes, le calendrier et les scores EUBAKIN",
    news_editor: "Rédacteur",
    news_editorDesc: "Créer et gérer les articles et les histoires",
    game_scheduler: "Planificateur",
    game_schedulerDesc: "Planifier et gérer les matchs et les journées",
    team_manager: "Gestionnaire Équipes",
    team_managerDesc: "Gérer les équipes, effectifs et profils joueurs",
    referee_manager: "Gestionnaire Arbitres",
    referee_managerDesc: "Assigner et gérer les arbitres",
    venue_manager: "Gestionnaire Sites",
    venue_managerDesc: "Gérer les stades et lieux de match",
    partner_manager: "Gestionnaire Partenaires",
    partner_managerDesc: "Gérer les sponsors, partenaires et comité",
    reviewTitle: "Vous allez inviter",
    reviewRoles: "Avec ces rôles",
    reviewEmailNote: "Cette personne recevra un email avec un lien pour définir son mot de passe et accéder au tableau de bord.",
    status: "Statut",
    active: "Actif",
    pending: "En Attente",
    invited: "Invité",
    role: "Rôle",
    permissions: "Permissions",
    allPermissions: "Toutes les Permissions",
    edit: "Modifier les Permissions",
    remove: "Supprimer",
    copyLink: "Copier le Lien",
    resend: "Renvoyer l'Invitation",
    joined: "Inscrit",
    lastActive: "Dernière activité",
    never: "Jamais",
    inviteSuccess: "Admin créé !",
    inviteSuccessDesc: "compte a été créé. Il peut se connecter avec le mot de passe défini.",
    inviteFailed: "L'invitation a échoué",
    linkCopied: "Lien d'invitation copié !",
    linkCopyFailed: "Impossible de copier le lien. Vérifiez la console.",
    confirmRemove: "Êtes-vous sûr de vouloir supprimer cet admin ? Cette action est irréversible.",
    removeSuccess: "Admin supprimé avec succès",
    removeFailed: "Échec de la suppression",
    removing: "Suppression de l'admin...",
    editRoles: "Modifier les Permissions",
    saveChanges: "Enregistrer",
    saving: "Enregistrement...",
    noRolesAssigned: "Aucun rôle attribué pour le moment",
  },
};

const ROLE_CONFIG: { role: AdminRole; icon: string; color: string; gradient: string }[] = [
  { role: "master", icon: "👑", color: "amber", gradient: "from-amber-500 to-orange-500" },
  { role: "league_manager", icon: "⚡", color: "violet", gradient: "from-violet-500 to-purple-500" },
  { role: "media_manager", icon: "🎬", color: "fuchsia", gradient: "from-fuchsia-500 to-pink-500" },
  { role: "eubakin_manager", icon: "🏀", color: "amber", gradient: "from-amber-500 to-yellow-500" },
  { role: "news_editor", icon: "📰", color: "blue", gradient: "from-blue-500 to-cyan-500" },
  { role: "game_scheduler", icon: "📅", color: "emerald", gradient: "from-emerald-500 to-teal-500" },
  { role: "team_manager", icon: "👥", color: "rose", gradient: "from-rose-500 to-pink-500" },
  { role: "referee_manager", icon: "🔵", color: "sky", gradient: "from-sky-500 to-blue-500" },
  { role: "venue_manager", icon: "🏟️", color: "orange", gradient: "from-orange-500 to-red-500" },
  { role: "partner_manager", icon: "🤝", color: "yellow", gradient: "from-yellow-500 to-amber-500" },
];

// Permission-based navigation sections
type PermissionConfig = {
  key: keyof AdminPermissions;
  icon: string;
  label: { en: string; fr: string };
  gradient: string;
  subPermissions?: {
    key: keyof AdminPermissions;
    icon: string;
    label: { en: string; fr: string };
  }[];
};

const PERMISSION_CONFIG: PermissionConfig[] = [
  { key: "canManageNews", icon: "📰", label: { en: "Stories", fr: "Histoires" }, gradient: "from-blue-500 to-cyan-500" },
  { key: "canManageTeams", icon: "🏀", label: { en: "Teams", fr: "Équipes" }, gradient: "from-rose-500 to-pink-500" },
  { 
    key: "canManageUsers", 
    icon: "👥", 
    label: { en: "Users", fr: "Utilisateurs" }, 
    gradient: "from-purple-500 to-indigo-500",
    subPermissions: [
      { key: "canManageAccounts", icon: "👥", label: { en: "Accounts", fr: "Comptes" } },
      { key: "canManageVerifications", icon: "✓", label: { en: "Verifications", fr: "Vérifications" } },
    ]
  },
  { 
    key: "canManageGames", 
    icon: "🗓️", 
    label: { en: "Games", fr: "Jeux" }, 
    gradient: "from-emerald-500 to-teal-500",
    subPermissions: [
      { key: "canManageMatches", icon: "🏟️", label: { en: "Matches", fr: "Matchs" } },
      { key: "canManageStatistics", icon: "📊", label: { en: "Statistics", fr: "Statistiques" } },
    ]
  },
  { 
    key: "canManageLeague", 
    icon: "⚙️", 
    label: { en: "League Settings", fr: "Paramètres League" }, 
    gradient: "from-orange-500 to-amber-500",
    subPermissions: [
      { key: "canManageReferees", icon: "👨‍⚖️", label: { en: "Referees", fr: "Arbitres" } },
      { key: "canManageEubakin", icon: "🏀", label: { en: "EUBAKIN", fr: "EUBAKIN" } },
      { key: "canManageCommittee", icon: "👔", label: { en: "Committee Members", fr: "Membre du Comité" } },
      { key: "canManageCommission", icon: "📋", label: { en: "Commission", fr: "Commission" } },
      { key: "canManageGameMedia", icon: "🎬", label: { en: "Game Media", fr: "Médias des matchs" } },
      { key: "canManagePartners", icon: "🤝", label: { en: "Partners", fr: "Partenaires" } },
      { key: "canManageVenues", icon: "🏟️", label: { en: "Venues", fr: "Sites" } },
      { key: "canManageSales", icon: "💰", label: { en: "Sales", fr: "Sales" } },
    ]
  },
  { key: "canManageAdmins", icon: "👥", label: { en: "Administrators", fr: "Administrateurs" }, gradient: "from-amber-500 to-orange-500" },
  { key: "canViewTraffic", icon: "📊", label: { en: "Traffic Analytics", fr: "Analytique du trafic" }, gradient: "from-violet-500 to-purple-500" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const { language, currentAdminUser } = useAdmin();
  const t = translations[language];

  // Data
  const [admins, setAdmins] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite flow
  const [showInviteFlow, setShowInviteFlow] = useState(false);
  const [inviteStep, setInviteStep] = useState<InviteStep>("info");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState("");
  const [inviteRoles, setInviteRoles] = useState<AdminRole[]>([]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Status/notifications
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Edit modal
  const [editingAdmin, setEditingAdmin] = useState<AdminUserData | null>(null);
  const [editRoles, setEditRoles] = useState<AdminRole[]>([]);
  const [editPermissions, setEditPermissions] = useState<Partial<AdminPermissions>>({});
  const [editSaving, setEditSaving] = useState(false);

  // ─── Fetch admins ────────────────────────────────────────────────────────

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(firebaseDB, "adminUsers"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AdminUserData))
        .filter((u) => u.roles && u.roles.length > 0);
      list.sort((a, b) => {
        const aMaster = a.roles?.includes("master") ? 0 : 1;
        const bMaster = b.roles?.includes("master") ? 0 : 1;
        if (aMaster !== bMaster) return aMaster - bMaster;
        return (a.displayName || a.email).localeCompare(b.displayName || b.email);
      });
      setAdmins(list);
    } catch (error) {
      console.error("Error fetching admins:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  // ─── Notification auto-dismiss ───────────────────────────────────────────

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // ─── Invite flow ─────────────────────────────────────────────────────────

  const resetInviteFlow = () => {
    setShowInviteFlow(false);
    setInviteStep("info");
    setInviteEmail("");
    setInviteName("");
    setInvitePassword("");
    setInvitePasswordConfirm("");
    setInviteRoles([]);
  };

  const handleSendInvite = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    setInviteSubmitting(true);
    try {
      const res = await fetch("/api/admin/invite-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          displayName: inviteName,
          password: invitePassword,
          roles: inviteRoles,
          createdByUid: user.uid,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setNotification({
          type: "success",
          message: `${inviteName} (${inviteEmail}) — ${t.inviteSuccessDesc}`,
        });
        if (data.resetLink) {
          sessionStorage.setItem(`invite_link_${data.userId}`, data.resetLink);
        }
        await logAuditAction(
          "admin_created", 
          currentAdminUser?.id || "unknown", 
          currentAdminUser?.email || "unknown", 
          "admin", 
          data.userId || inviteEmail, 
          inviteName, 
          {
            email: inviteEmail,
            roles: inviteRoles.join(", "),
          }
        );
        resetInviteFlow();
        fetchAdmins();
      } else {
        setNotification({ type: "error", message: data.error || t.inviteFailed });
      }
    } catch (error) {
      setNotification({ type: "error", message: t.inviteFailed });
    } finally {
      setInviteSubmitting(false);
    }
  };

  // ─── Admin actions ───────────────────────────────────────────────────────

  const handleRemoveAdmin = async (admin: AdminUserData) => {
    if (!confirm(t.confirmRemove)) return;
    
    const user = firebaseAuth.currentUser;
    if (!user) {
      setNotification({ type: "error", message: "Not authenticated" });
      return;
    }

    try {
      setNotification({ type: "info", message: t.removing });
      
      const res = await fetch("/api/admin/delete-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: admin.id,
          requestorUid: user.uid,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setNotification({ type: "success", message: t.removeSuccess });
        await logAuditAction(
          "admin_deleted", 
          currentAdminUser?.id || "unknown", 
          currentAdminUser?.email || "unknown", 
          "admin", 
          admin.id, 
          admin.displayName || admin.email, 
          {
            email: admin.email,
            roles: admin.roles?.join(", "),
          }
        );
        fetchAdmins();
      } else {
        setNotification({ type: "error", message: data.error || t.removeFailed });
      }
    } catch (error) {
      console.error("Error removing admin:", error);
      setNotification({ type: "error", message: t.removeFailed });
    }
  };

  const handleCopyLink = async (adminId: string) => {
    const link = sessionStorage.getItem(`invite_link_${adminId}`);
    if (link) {
      try {
        await navigator.clipboard.writeText(link);
        setNotification({ type: "info", message: t.linkCopied });
      } catch {
        console.log("Invite link:", link);
        setNotification({ type: "error", message: t.linkCopyFailed });
      }
    }
  };

  const handleSaveRoles = async () => {
    if (!editingAdmin) return;
    setEditSaving(true);
    try {
      // Convert permissions object to boolean values (remove undefined/null)
      const cleanPermissions: Partial<AdminPermissions> = {};
      Object.keys(editPermissions).forEach((key) => {
        if (editPermissions[key as keyof AdminPermissions] === true) {
          cleanPermissions[key as keyof AdminPermissions] = true;
        }
      });

      // Determine current roles based on permissions for display
      const updatedRoles: AdminRole[] = [];
      if (cleanPermissions.canManageNews) updatedRoles.push('news_editor');
      if (cleanPermissions.canManageTeams) updatedRoles.push('team_manager'); 
      if (cleanPermissions.canManageGames) updatedRoles.push('game_scheduler');
      if (cleanPermissions.canManageAdmins) updatedRoles.push('master');
      if (cleanPermissions.canManageReferees) updatedRoles.push('referee_manager');
      if (cleanPermissions.canManageVenues) updatedRoles.push('venue_manager');
      if (cleanPermissions.canManagePartners) updatedRoles.push('partner_manager');
      if (cleanPermissions.canManageEubakin) updatedRoles.push('eubakin_manager');
      if (cleanPermissions.canManageGameMedia) updatedRoles.push('media_manager');

      const adminDisplayName = editingAdmin.displayName || editingAdmin.email;

      await updateDoc(doc(firebaseDB, "adminUsers", editingAdmin.id), {
        permissions: cleanPermissions,
        roles: updatedRoles, // Update roles as well
        updatedAt: serverTimestamp(),
      });

      await logAuditAction(
        "admin_roles_updated", 
        currentAdminUser?.id || "unknown", 
        currentAdminUser?.email || "unknown", 
        "admin", 
        editingAdmin.id, 
        adminDisplayName, 
        {
          email: editingAdmin.email,
          newRoles: updatedRoles.join(", "),
        }
      );

      const roleLabels = updatedRoles.map(role => getRoleLabel(role));

      // Show success notification with updated roles
      setNotification({
        type: "success",
        message: language === "fr" 
          ? `✅ Rôles mis à jour pour ${adminDisplayName}\n\n🔑 Nouveaux rôles: ${roleLabels.join(', ')}\n📧 Statut: Actif - peut accéder immédiatement`
          : `✅ Roles updated for ${adminDisplayName}\n\n🔑 New roles: ${roleLabels.join(', ')}\n📧 Status: Active - can access immediately`
      });

      // Browser notification (if permission granted)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🔄 Admin Roles Updated!', {
          body: `${adminDisplayName}'s roles updated: ${roleLabels.join(', ')}`,
          icon: '/logos/liprobakin.png',
        });
      }

      setEditingAdmin(null);
      fetchAdmins(); // This will refresh the display with new roles
    } catch (error) {
      console.error("Error saving permissions:", error);
      setNotification({
        type: "error",
        message: language === "fr" ? "Erreur lors de la mise à jour des rôles" : "Failed to update roles"
      });
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const isMaster = (roles?: AdminRole[]) => roles?.includes("master");
  const canManageAdmins = currentAdminUser?.permissions?.canManageAdmins || currentAdminUser?.roles?.includes("master");
  const activeCount = admins.filter(a => !a.isPendingSetup && a.isActive !== false).length;
  const pendingCount = admins.filter(a => a.isPendingSetup).length;

  const getRoleConfig = (role: AdminRole) => ROLE_CONFIG.find(r => r.role === role) || ROLE_CONFIG[1];

  const getAdminStatus = (admin: AdminUserData): "active" | "pending" => {
    if (admin.isPendingSetup || admin.isFirstLogin) return "pending";
    return "active";
  };

  const formatDate = (timestamp?: { seconds: number } | null) => {
    if (!timestamp) return t.never;
    return new Date(timestamp.seconds * 1000).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const getRoleBadgeClasses = (role: AdminRole) => {
    const config = getRoleConfig(role);
    return `bg-gradient-to-r ${config.gradient} text-white`;
  };

  const getRoleLabel = (role: AdminRole) => {
    return (t as Record<string, string>)[role] || role;
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-slate-400 animate-pulse">Loading admins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* ─── Notification Toast ─────────────────────────────────────────── */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] max-w-md rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          notification.type === "success" ? "border-emerald-500/40 bg-emerald-900/80 text-emerald-100" :
          notification.type === "error" ? "border-rose-500/40 bg-rose-900/80 text-rose-100" :
          "border-blue-500/40 bg-blue-900/80 text-blue-100"
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">
              {notification.type === "success" ? "✅" : notification.type === "error" ? "❌" : "ℹ️"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-relaxed">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-white/60 hover:text-white flex-shrink-0">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
        </div>
        {canManageAdmins && (
          <button
            onClick={() => setShowInviteFlow(true)}
            className="group relative flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="h-5 w-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {t.inviteAdmin}
          </button>
        )}
      </div>

      {/* ─── Stats Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-4 backdrop-blur-sm">
          <p className="text-2xl font-bold text-white sm:text-3xl">{admins.length}</p>
          <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">{t.adminsCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-2xl font-bold text-emerald-400 sm:text-3xl">{activeCount}</p>
          <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">{t.activeCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-2xl font-bold text-amber-400 sm:text-3xl">{pendingCount}</p>
          <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">{t.pendingCount}</p>
        </div>
      </div>

      {/* ─── Admin List ─────────────────────────────────────────────────── */}
      {admins.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-16 text-center">
          <div className="text-6xl mb-4">👥</div>
          <p className="text-lg font-semibold text-slate-300">{t.noAdmins}</p>
          <p className="mt-2 text-sm text-slate-500">{t.noAdminsDesc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => {
            const status = getAdminStatus(admin);
            const primaryRole = admin.roles?.[0];
            const roleConfig = primaryRole ? getRoleConfig(primaryRole) : ROLE_CONFIG[1];

            return (
              <div
                key={admin.id}
                className="group rounded-2xl border border-white/10 bg-slate-800/30 p-4 transition-all duration-200 hover:border-white/20 hover:bg-slate-800/50 sm:p-5"
              >
                <div className="flex items-start gap-4 sm:items-center">
                  {/* Avatar */}
                  <div className={`relative h-12 w-12 flex-shrink-0 rounded-2xl bg-gradient-to-br ${roleConfig.gradient} flex items-center justify-center shadow-lg sm:h-14 sm:w-14`}>
                    {admin.photo ? (
                      <Image src={admin.photo} alt="" width={56} height={56} className="rounded-2xl object-cover w-full h-full" unoptimized />
                    ) : (
                      <span className="text-xl font-bold text-white sm:text-2xl">
                        {(admin.displayName?.[0] || admin.email[0]).toUpperCase()}
                      </span>
                    )}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-slate-800 ${
                      status === "active" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                    }`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white truncate">{admin.displayName || admin.email}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        status === "active"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}>
                        {status === "active" ? t.active : t.pending}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-400 truncate">{admin.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {admin.roles && admin.roles.length > 0 ? (
                        admin.roles.map((role) => (
                          <span key={role} className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-sm ${getRoleBadgeClasses(role)}`}>
                            {getRoleConfig(role).icon} {getRoleLabel(role)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          {t.noRolesAssigned}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canManageAdmins && !isMaster(admin.roles) && (
                    <div className="flex flex-col gap-2 sm:flex-row flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { 
                          setEditingAdmin(admin); 
                          setEditRoles(admin.roles || []); 
                          setEditPermissions(admin.permissions || {});
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-white/10 hover:text-white"
                      >
                        {t.edit}
                      </button>
                      {status === "pending" && (
                        <button
                          onClick={() => handleCopyLink(admin.id)}
                          className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition-all hover:bg-sky-500/20"
                        >
                          {t.copyLink}
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveAdmin(admin)}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-all hover:bg-red-500/20"
                      >
                        {t.remove}
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer meta */}
                <div className="mt-3 flex items-center gap-4 pl-16 text-[11px] text-slate-500">
                  <span>{t.joined}: {formatDate(admin.createdAt)}</span>
                  {admin.lastLogin && <span>{t.lastActive}: {formatDate(admin.lastLogin)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          INVITE MODAL (3-Step Flow)
          ═══════════════════════════════════════════════════════════════════ */}
      {showInviteFlow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
            {/* Stepper Header */}
            <div className="border-b border-white/10 bg-slate-800/50 px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">{t.inviteAdmin}</h2>
                <button onClick={resetInviteFlow} title="Close" className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Step indicators */}
              <div className="flex items-center gap-2">
                {(["info", "roles", "review"] as InviteStep[]).map((step, i) => {
                  const stepLabels = [t.step1Title, t.step2Title, t.step3Title];
                  const isActive = step === inviteStep;
                  const isPast = (inviteStep === "roles" && i === 0) || (inviteStep === "review" && i < 2);
                  return (
                    <React.Fragment key={step}>
                      {i > 0 && (
                        <div className={`h-px flex-1 transition-colors ${isPast ? "bg-orange-500" : "bg-slate-700"}`} />
                      )}
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                          isActive ? "bg-orange-500 text-white scale-110" :
                          isPast ? "bg-orange-500/30 text-orange-300" :
                          "bg-slate-700 text-slate-400"
                        }`}>
                          {isPast ? "✓" : i + 1}
                        </div>
                        <span className={`hidden text-xs font-medium sm:block ${isActive ? "text-white" : "text-slate-400"}`}>
                          {stepLabels[i]}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="p-6">
              {/* ── Step 1: Info ── */}
              {inviteStep === "info" && (
                <div className="space-y-5">
                  <p className="text-sm text-slate-400 mb-5">{t.step1Desc}</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t.emailLabel}</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t.nameLabel}</label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t.passwordLabel}</label>
                    <input
                      type="password"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t.confirmPasswordLabel}</label>
                    <input
                      type="password"
                      value={invitePasswordConfirm}
                      onChange={(e) => setInvitePasswordConfirm(e.target.value)}
                      placeholder={t.confirmPasswordPlaceholder}
                      className={`w-full rounded-xl border bg-slate-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 transition-colors ${
                        invitePasswordConfirm && invitePassword !== invitePasswordConfirm
                          ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30"
                          : "border-white/10 focus:border-orange-500/50 focus:ring-orange-500/30"
                      }`}
                    />
                    {invitePasswordConfirm && invitePassword !== invitePasswordConfirm && (
                      <p className="text-xs text-red-400 mt-1">{t.passwordMismatch}</p>
                    )}
                    {invitePassword && invitePassword.length < 6 && (
                      <p className="text-xs text-amber-400 mt-1">{t.passwordTooShort}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 2: Roles ── */}
              {inviteStep === "roles" && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">{t.selectRoles}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ROLE_CONFIG.map(({ role, icon, gradient }) => {
                      const selected = inviteRoles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            setInviteRoles(
                              selected
                                ? inviteRoles.filter(r => r !== role)
                                : [...inviteRoles, role]
                            );
                          }}
                          className={`group/role relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
                            selected
                              ? "border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                              : "border-white/10 bg-slate-800/30 hover:border-white/20 hover:bg-slate-800/50"
                          }`}
                        >
                          <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-all ${
                            selected ? `bg-gradient-to-br ${gradient} border-transparent` : "border-slate-600 bg-slate-800"
                          }`}>
                            {selected && (
                              <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{icon} {getRoleLabel(role)}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                              {(t as Record<string, string>)[`${role}Desc`] || ""}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Step 3: Review ── */}
              {inviteStep === "review" && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t.reviewTitle}</p>
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg">
                        <span className="text-2xl font-bold text-white">{inviteName[0]?.toUpperCase() || "?"}</span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{inviteName}</p>
                        <p className="text-sm text-slate-400">{inviteEmail}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t.reviewRoles}</p>
                    <div className="flex flex-wrap gap-2">
                      {inviteRoles.map((role) => (
                        <span key={role} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm ${getRoleBadgeClasses(role)}`}>
                          {getRoleConfig(role).icon} {getRoleLabel(role)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <svg className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-emerald-300">{t.passwordSet}</p>
                      <p className="text-xs text-emerald-200/60 mt-1">{t.adminCanChangePassword}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-white/10 bg-slate-800/30 px-6 py-4">
              <button
                onClick={() => {
                  if (inviteStep === "info") resetInviteFlow();
                  else if (inviteStep === "roles") setInviteStep("info");
                  else setInviteStep("roles");
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                {inviteStep === "info" ? t.cancel : t.back}
              </button>

              {inviteStep !== "review" ? (
                <button
                  onClick={() => {
                    if (inviteStep === "info") setInviteStep("roles");
                    else setInviteStep("review");
                  }}
                  disabled={
                    (inviteStep === "info" && (!inviteEmail.trim() || !inviteName.trim() || invitePassword.length < 6 || invitePassword !== invitePasswordConfirm)) ||
                    (inviteStep === "roles" && inviteRoles.length === 0)
                  }
                  className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t.next} →
                </button>
              ) : (
                <button
                  onClick={handleSendInvite}
                  disabled={inviteSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-50"
                >
                  {inviteSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t.sending}
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      {t.sendInvite}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          EDIT ROLES MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {editingAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="border-b border-white/10 bg-slate-800/50 px-6 py-5">
              <h3 className="text-lg font-bold text-white">{t.editRoles}</h3>
              <p className="mt-1 text-sm text-slate-400">{editingAdmin.displayName || editingAdmin.email}</p>
            </div>
            <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {PERMISSION_CONFIG.map(({ key, icon, label, gradient, subPermissions }) => {
                const selected = editPermissions[key as keyof AdminPermissions] === true;
                return (
                  <div key={key} className="space-y-2">
                    {/* Main Permission */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditPermissions({
                          ...editPermissions,
                          [key]: !selected
                        });
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                        selected
                          ? "border-orange-500/50 bg-orange-500/10"
                          : "border-white/10 bg-slate-800/30 hover:bg-slate-800/50"
                      }`}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                        selected ? `bg-gradient-to-br ${gradient} border-transparent` : "border-slate-600 bg-slate-800"
                      }`}>
                        {selected && (
                          <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{icon} {language === "fr" ? label.fr : label.en}</p>
                      </div>
                    </button>

                    {/* Sub-Permissions (shown when parent is selected) */}
                    {selected && subPermissions && subPermissions.length > 0 && (
                      <div className="ml-8 space-y-1.5">
                        {subPermissions.map((subPerm) => {
                          const subSelected = editPermissions[subPerm.key as keyof AdminPermissions] === true;
                          return (
                            <button
                              key={subPerm.key}
                              type="button"
                              onClick={() => {
                                setEditPermissions({
                                  ...editPermissions,
                                  [subPerm.key]: !subSelected
                                });
                              }}
                              className={`flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                                subSelected
                                  ? "border-orange-400/40 bg-orange-500/5"
                                  : "border-white/5 bg-slate-800/20 hover:bg-slate-800/40"
                              }`}
                            >
                              <div className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                                subSelected ? "bg-orange-500 border-orange-500" : "border-slate-600 bg-slate-800"
                              }`}>
                                {subSelected && (
                                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <p className="text-xs font-medium text-slate-300">
                                {subPerm.icon} {language === "fr" ? subPerm.label.fr : subPerm.label.en}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 border-t border-white/10 bg-slate-800/30 px-6 py-4">
              <button
                onClick={() => setEditingAdmin(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSaveRoles}
                disabled={editSaving}
                className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50"
              >
                {editSaving ? t.saving : t.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
