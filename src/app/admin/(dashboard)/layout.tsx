"use client";

import { useEffect, useState, createContext, useContext, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { firebaseAuth, firebaseDB, firebaseStorage } from "@/lib/firebase";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { doc, updateDoc, setDoc, serverTimestamp, onSnapshot, collection } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import type { AdminUser } from "@/types/admin";
import { getAdminUser, updateLastActivity } from "@/lib/adminAuth";

// Create context for admin data to share across pages
type AdminContextType = {
  currentAdminUser: AdminUser | null;
  language: "en" | "fr";
  setLanguage: (lang: "en" | "fr") => void;
  permissions: Record<string, boolean>;
};

export const AdminContext = createContext<AdminContextType>({
  currentAdminUser: null,
  language: "fr",
  setLanguage: () => {},
  permissions: {},
});

export const useAdmin = () => useContext(AdminContext);

type NavItem = {
  key: string;
  label: { en: string; fr: string };
  href: string;
  icon: string;
  requiredPermission?: string;
  masterOnly?: boolean;
};

const navItems: NavItem[] = [
  { key: "stories", label: { en: "Stories", fr: "Histoires" }, href: "/admin/stories", icon: "📰", requiredPermission: "canManageNews" },
  { key: "teams", label: { en: "Teams", fr: "Équipes" }, href: "/admin/teams", icon: "🏀", requiredPermission: "canManageTeams" },
  { key: "accounts", label: { en: "Accounts", fr: "Accounts" }, href: "/admin/accounts", icon: "👥", requiredPermission: "canManageUsers" },
  { key: "verifications", label: { en: "Verifications", fr: "Vérifications" }, href: "/admin/verifications", icon: "✓", requiredPermission: "canManageUsers" },
  { key: "games", label: { en: "Games", fr: "Matchs" }, href: "/admin/games", icon: "🏟️", requiredPermission: "canManageGames" },
  { key: "stats", label: { en: "Statistics", fr: "Statistiques" }, href: "/admin/stats", icon: "📈", requiredPermission: "canManageGames" },
  { key: "league", label: { en: "League Settings", fr: "Paramètres Ligue" }, href: "/admin/league", icon: "⚙️", requiredPermission: "canManageLeague" },
  { key: "admins", label: { en: "Administrators", fr: "Administrateurs" }, href: "/admin/admins", icon: "👤", requiredPermission: "canManageAdmins" },
  { key: "activity", label: { en: "Activity Log", fr: "Journal d'activité" }, href: "/admin/activity", icon: "📋", masterOnly: true },
  { key: "errors", label: { en: "Error Monitor", fr: "Surveillance Erreurs" }, href: "/admin/errors", icon: "⚠️", masterOnly: true },
];

const translations = {
  en: {
    dashboard: "Administrator Dashboard",
    cms: "Content Management System",
    adminsOnline: "admins online",
    changePassword: "Change Password",
    signOut: "Sign Out",
    resetDatabase: "Database Reset",
    resetDatabaseDesc: "Delete all games, standings and reset all team/player statistics to 0.",
    resetAllStats: "Reset All Stats",
    editDisplayName: "Edit Display Name",
    editProfilePicture: "Edit Profile Picture",
    addProfilePicture: "Add Profile Picture",
    displayName: "Display Name",
    profilePicture: "Profile Picture",
    chooseNewPhoto: "Choose new photo",
    removePhoto: "Remove photo",
    uploadImage: "Upload Image",
    removeImage: "Remove Image",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
    firstLoginTitle: "Complete your profile",
    firstLoginSubtitle: "On your first login, add your full name and profile picture to continue.",
    firstLoginFullName: "Full name",
    firstLoginFullNamePlaceholder: "e.g. Jean-Pierre Mbala",
    firstLoginPhotoRequired: "Profile picture (optional)",
    firstLoginChoosePhoto: "Choose profile picture",
    firstLoginSubmit: "Continue to dashboard",
    firstLoginNameError: "Please enter your full name (first and last name).",
    firstLoginMustChangeNameError: "Please update your name (it must be different from the one set by the master admin).",
    firstLoginPhotoError: "Please upload a profile picture.",
    photoReminderTitle: "Complete your profile",
    photoReminderSubtitle: "Add a profile picture so other admins can identify you quickly.",
    photoReminderLater: "Not now",
    photoReminderUpdate: "Update profile",
  },
  fr: {
    dashboard: "Tableau de bord administrateur",
    cms: "Système de gestion de contenu",
    adminsOnline: "admins en ligne",
    changePassword: "Changer le mot de passe",
    signOut: "Se déconnecter",
    resetDatabase: "Réinitialisation de la base de données",
    resetDatabaseDesc: "Supprimer tous les matchs, classements et réinitialiser toutes les statistiques des équipes/joueurs à 0.",
    resetAllStats: "Réinitialiser toutes les stats",
    editDisplayName: "Modifier le nom d'affichage",
    editProfilePicture: "Modifier la photo de profil",
    addProfilePicture: "Ajouter une photo de profil",
    displayName: "Nom d'affichage",
    profilePicture: "Photo de profil",
    chooseNewPhoto: "Choisir une nouvelle photo",
    removePhoto: "Supprimer la photo",
    uploadImage: "Télécharger une image",
    removeImage: "Supprimer l'image",
    save: "Enregistrer",
    cancel: "Annuler",
    saving: "Enregistrement...",
    firstLoginTitle: "Complétez votre profil",
    firstLoginSubtitle: "Lors de votre première connexion, ajoutez votre nom complet et votre photo de profil pour continuer.",
    firstLoginFullName: "Nom complet",
    firstLoginFullNamePlaceholder: "ex. Jean-Pierre Mbala",
    firstLoginPhotoRequired: "Photo de profil (optionnelle)",
    firstLoginChoosePhoto: "Choisir une photo de profil",
    firstLoginSubmit: "Continuer vers le tableau de bord",
    firstLoginNameError: "Veuillez saisir votre nom complet (prénom et nom).",
    firstLoginMustChangeNameError: "Veuillez modifier votre nom (il doit être différent de celui défini par l'admin principal).",
    firstLoginPhotoError: "Veuillez téléverser une photo de profil.",
    photoReminderTitle: "Complétez votre profil",
    photoReminderSubtitle: "Ajoutez une photo de profil pour que les autres admins vous identifient rapidement.",
    photoReminderLater: "Plus tard",
    photoReminderUpdate: "Mettre à jour le profil",
  },
};

type OnlineAdmin = {
  id: string;
  email: string;
  name?: string;
  photo?: string;
  lastActivity: Date | null;
  connectedSince: Date | null;
  status: 'active' | 'away' | 'idle' | 'offline';
  minutesAgo: number;
};

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlineAdminsCount, setOnlineAdminsCount] = useState(0);
  const [onlineAdmins, setOnlineAdmins] = useState<OnlineAdmin[]>([]);
  const [showOnlineAdmins, setShowOnlineAdmins] = useState(false);
  const onlineAdminsDropdownRef = useRef<HTMLDivElement | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showDisplayNameEdit, setShowDisplayNameEdit] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [showProfilePictureEdit, setShowProfilePictureEdit] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");
  const [profilePictureSaving, setProfilePictureSaving] = useState(false);
  const [firstLoginName, setFirstLoginName] = useState("");
  const [firstLoginPhotoFile, setFirstLoginPhotoFile] = useState<File | null>(null);
  const [firstLoginPhotoPreview, setFirstLoginPhotoPreview] = useState<string>("");
  const [firstLoginSaving, setFirstLoginSaving] = useState(false);
  const [firstLoginError, setFirstLoginError] = useState<string | null>(null);
  const [showPhotoReminder, setShowPhotoReminder] = useState(false);

  const t = translations[language];

  // Check authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        router.push("/admin");
        return;
      }

      try {
        const adminUser = await getAdminUser(user.uid);
        if (!adminUser || !adminUser.isActive) {
          await signOut(firebaseAuth);
          router.push("/admin");
          return;
        }
        setCurrentAdminUser(adminUser);
        
        // Update online status (use setDoc with merge to avoid errors if document doesn't exist)
        await setDoc(doc(firebaseDB, "adminUsers", user.uid), {
          isOnline: true,
          lastActivity: serverTimestamp(),
          connectedSince: serverTimestamp(),
        }, { merge: true });
        
        await updateLastActivity(user.uid);
      } catch (error) {
        console.error("Error fetching admin user:", error);
        router.push("/admin");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Listen for all admins and derive presence status from recent activity
  useEffect(() => {
    const adminsRef = collection(firebaseDB, "adminUsers");
    const unsubscribe = onSnapshot(adminsRef, (snapshot) => {
      const now = new Date();
      
      const admins: OnlineAdmin[] = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const lastActivity = data.lastActivity?.toDate() || null;
          const minutesAgo = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / 60000) : 999;
          
          // Determine status based on minutes ago
          let status: OnlineAdmin['status'] = 'offline';
          if (minutesAgo < 5) status = 'active';
          else if (minutesAgo < 15) status = 'active';
          else if (minutesAgo < 30) status = 'away';
          else if (minutesAgo < 60) status = 'idle';
          
          return {
            id: doc.id,
            email: data.email || "Unknown",
            name: data.displayName || data.name || data.email?.split("@")[0] || "Unknown",
            photo: data.photo,
            lastActivity,
            connectedSince: data.connectedSince?.toDate() || lastActivity,
            status,
            minutesAgo,
          };
        })
        .sort((a, b) => {
          const statusPriority: Record<OnlineAdmin['status'], number> = {
            active: 0,
            away: 1,
            idle: 2,
            offline: 3,
          };
          const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
          if (priorityDiff !== 0) return priorityDiff;
          return a.minutesAgo - b.minutesAgo;
        });
      
      // Count only "active" admins (within 5 min) for the badge
      const activeCount = admins.filter(a => a.minutesAgo < 5).length;
      setOnlineAdminsCount(activeCount);
      setOnlineAdmins(admins);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!showOnlineAdmins) return;

    const handleClickAway = (event: MouseEvent | TouchEvent) => {
      const dropdown = onlineAdminsDropdownRef.current;
      const target = event.target as Node | null;
      if (dropdown && target && !dropdown.contains(target)) {
        setShowOnlineAdmins(false);
      }
    };

    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("touchstart", handleClickAway);

    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("touchstart", handleClickAway);
    };
  }, [showOnlineAdmins]);

  // Activity heartbeat
  useEffect(() => {
    if (!currentAdminUser) return;
    
    const interval = setInterval(async () => {
      await updateLastActivity(currentAdminUser.id);
    }, 60000);

    return () => clearInterval(interval);
  }, [currentAdminUser]);

  const handleSignOut = async () => {
    try {
      if (currentAdminUser) {
        await setDoc(doc(firebaseDB, "adminUsers", currentAdminUser.id), {
          isOnline: false,
          lastActivity: serverTimestamp(),
        }, { merge: true });
      }
      await signOut(firebaseAuth);
      router.push("/admin");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleUpdateDisplayName = async () => {
    if (!currentAdminUser || !newDisplayName.trim()) return;
    
    setDisplayNameSaving(true);
    try {
      await updateDoc(doc(firebaseDB, "adminUsers", currentAdminUser.id), {
        displayName: newDisplayName.trim(),
      });
      
      // Update local state
      setCurrentAdminUser({
        ...currentAdminUser,
        displayName: newDisplayName.trim(),
      });
      
      setShowDisplayNameEdit(false);
      setNewDisplayName("");
    } catch (error) {
      console.error("Error updating display name:", error);
      alert(language === "fr" ? "Erreur lors de la mise à jour du nom" : "Error updating display name");
    } finally {
      setDisplayNameSaving(false);
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfilePicture = async () => {
    if (!currentAdminUser) return;
    
    setProfilePictureSaving(true);
    try {
      let imageUrl = currentAdminUser.photo;
      
      if (profileImageFile) {
        const path = `admin-photos/${currentAdminUser.id}/${Date.now()}.png`;
        const storageReference = storageRef(firebaseStorage, path);
        await uploadBytes(storageReference, profileImageFile);
        imageUrl = await getDownloadURL(storageReference);
      } else if (profileImagePreview === "") {
        // Remove image
        imageUrl = "";
      }
      
      await updateDoc(doc(firebaseDB, "adminUsers", currentAdminUser.id), {
        photo: imageUrl,
        profilePicturePrompted: true,
        updatedAt: serverTimestamp(),
      });
      
      // Update local state
      setCurrentAdminUser({
        ...currentAdminUser,
        photo: imageUrl || undefined,
        profilePicturePrompted: true,
      });
      setShowPhotoReminder(!imageUrl);
      
      setShowProfilePictureEdit(false);
      setProfileImageFile(null);
      setProfileImagePreview("");
    } catch (error) {
      console.error("Error updating profile picture:", error);
      alert(language === "fr" ? "Erreur lors de la mise à jour de la photo" : "Error updating profile picture");
    } finally {
      setProfilePictureSaving(false);
    }
  };

  const handleRemoveProfilePicture = () => {
    setProfileImageFile(null);
    setProfileImagePreview("");
  };

  const markPhotoReminderSeen = async () => {
    if (!currentAdminUser || currentAdminUser.profilePicturePrompted) return;
    try {
      await updateDoc(doc(firebaseDB, "adminUsers", currentAdminUser.id), {
        profilePicturePrompted: true,
        updatedAt: serverTimestamp(),
      });
      setCurrentAdminUser({
        ...currentAdminUser,
        profilePicturePrompted: true,
      });
    } catch (error) {
      console.error("Error marking photo reminder as seen:", error);
    }
  };

  useEffect(() => {
    if (!currentAdminUser?.isFirstLogin) return;
    setFirstLoginName("");
    setFirstLoginPhotoPreview(currentAdminUser.photo || "");
    setFirstLoginPhotoFile(null);
    setFirstLoginError(null);
  }, [currentAdminUser]);

  useEffect(() => {
    if (!currentAdminUser) return;
    if (currentAdminUser.isFirstLogin) {
      setShowPhotoReminder(false);
      return;
    }
    const shouldShowReminder = !currentAdminUser.photo && !currentAdminUser.profilePicturePrompted;
    setShowPhotoReminder(shouldShowReminder);
    if (shouldShowReminder) {
      void markPhotoReminderSeen();
    }
  }, [currentAdminUser]);

  const handleFirstLoginPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFirstLoginPhotoFile(file);
    setFirstLoginPhotoPreview(URL.createObjectURL(file));
  };

  const handleCompleteFirstLogin = async () => {
    if (!currentAdminUser) return;

    const trimmedName = firstLoginName.trim();
    const nameParts = trimmedName.split(/\s+/).filter(Boolean);
    const existingName = (currentAdminUser.displayName || "").trim();
    if (!trimmedName || nameParts.length < 2) {
      setFirstLoginError(t.firstLoginNameError);
      return;
    }

    if (existingName && trimmedName.toLowerCase() === existingName.toLowerCase()) {
      setFirstLoginError(t.firstLoginMustChangeNameError);
      return;
    }

    setFirstLoginSaving(true);
    setFirstLoginError(null);

    try {
      let photoUrl = currentAdminUser.photo || "";

      if (firstLoginPhotoFile) {
        const path = `admin-photos/${currentAdminUser.id}/first-login-${Date.now()}.png`;
        const storageReference = storageRef(firebaseStorage, path);
        await uploadBytes(storageReference, firstLoginPhotoFile);
        photoUrl = await getDownloadURL(storageReference);
      }

      await updateDoc(doc(firebaseDB, "adminUsers", currentAdminUser.id), {
        displayName: trimmedName,
        photo: photoUrl,
        profilePicturePrompted: !!photoUrl,
        isFirstLogin: false,
        updatedAt: serverTimestamp(),
      });

      if (firebaseAuth.currentUser) {
        await updateProfile(firebaseAuth.currentUser, {
          displayName: trimmedName,
          photoURL: photoUrl || null,
        });
      }

      setCurrentAdminUser({
        ...currentAdminUser,
        displayName: trimmedName,
        photo: photoUrl || undefined,
        profilePicturePrompted: !!photoUrl,
        isFirstLogin: false,
      });
      setShowPhotoReminder(!photoUrl);
      setFirstLoginPhotoFile(null);
      setFirstLoginError(null);
    } catch (error) {
      console.error("Error completing first login setup:", error);
      setFirstLoginError(language === "fr" ? "Impossible de terminer la configuration." : "Failed to complete setup.");
    } finally {
      setFirstLoginSaving(false);
    }
  };

  const getPermissions = (user: AdminUser | null): Record<string, boolean> => {
    if (!user) return {};
    
    // If user has explicit permissions object, use it directly
    if (user.permissions) {
      const perms: Record<string, boolean> = {};
      Object.entries(user.permissions).forEach(([key, value]) => {
        if (value === true) {
          perms[key] = true;
        }
      });
      
      // Master role always gets all permissions
      if (user.roles?.includes("master")) {
        perms.canManageNews = true;
        perms.canManageTeams = true;
        perms.canManageGames = true;
        perms.canManageUsers = true;
        perms.canManageAdmins = true;
        perms.canManageLeague = true;
        perms.canManageReferees = true;
        perms.canManageCommittee = true;
        perms.canManagePartners = true;
        perms.canManageSales = true;
        perms.canManagePlayers = true;
        perms.canManageVenues = true;
        perms.canManageEubakin = true;
      }
      
      return perms;
    }
    
    // Fallback: derive permissions from roles (legacy support)
    const perms: Record<string, boolean> = {};
    user.roles?.forEach((role) => {
      if (role === "master" || role === "league_manager") {
        perms.canManageNews = true;
        perms.canManageTeams = true;
        perms.canManageGames = true;
        perms.canManageUsers = true;
        perms.canManageAdmins = role === "master";
        perms.canManageLeague = true;
        perms.canManageReferees = true;
        perms.canManageCommittee = true;
        perms.canManagePartners = true;
        perms.canManageSales = true;
        perms.canManageEubakin = true;
      } else if (role === "news_editor") {
        perms.canManageNews = true;
      } else if (role === "team_manager") {
        perms.canManageTeams = true;
      } else if (role === "game_scheduler") {
        perms.canManageGames = true;
      } else if (role === "referee_manager") {
        perms.canManageReferees = true;
      } else if (role === "venue_manager") {
        perms.canManageVenues = true;
      } else if (role === "partner_manager") {
        perms.canManagePartners = true;
        perms.canManageCommittee = true;
      } else if (role === "eubakin_manager") {
        perms.canManageEubakin = true;
      }
    });
    return perms;
  };

  const permissions = getPermissions(currentAdminUser);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const filteredNavItems = navItems.filter((item) => {
    // Master only items
    if (item.masterOnly) {
      return currentAdminUser?.roles?.includes('master');
    }
    if (item.key === "league") {
      return permissions.canManageLeague || permissions.canManageEubakin;
    }
    if (!item.requiredPermission) return true;
    return permissions[item.requiredPermission];
  });

  return (
    <AdminContext.Provider value={{ currentAdminUser, language, setLanguage, permissions }}>
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                {/* Profile Picture */}
                <div className="relative" ref={onlineAdminsDropdownRef}>
                  {currentAdminUser?.photo ? (
                    <div className="relative">
                      <Image
                        src={currentAdminUser.photo}
                        alt="Profile"
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover border-2 border-orange-500/30"
                      />
                      <button
                        onClick={() => setShowProfilePictureEdit(true)}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center text-white transition-colors"
                        title={t.editProfilePicture}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-semibold">
                        {(currentAdminUser?.displayName || currentAdminUser?.email || "A")[0].toUpperCase()}
                      </div>
                      <button
                        onClick={() => setShowProfilePictureEdit(true)}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center text-white transition-colors"
                        title={t.addProfilePicture}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{t.dashboard}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-orange-400 font-medium">
                      {currentAdminUser?.displayName || currentAdminUser?.email}
                    </p>
                    <button
                      onClick={() => {
                        setNewDisplayName(currentAdminUser?.displayName || "");
                        setShowDisplayNameEdit(true);
                      }}
                      className="text-slate-400 hover:text-orange-400 transition-colors"
                      title={t.editDisplayName}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">{t.cms}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Online admins indicator */}
                <div className="relative">
                  <button
                    onClick={() => setShowOnlineAdmins(!showOnlineAdmins)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-white/10 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm text-slate-300">
                      {onlineAdminsCount} {t.adminsOnline}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showOnlineAdmins ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Online Admins Dropdown */}
                  {showOnlineAdmins && (
                    <>
                      <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/10 bg-slate-800/50">
                          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            {language === "fr" ? "Liste des administrateurs" : "Administrators"}
                          </h3>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {onlineAdmins.length === 0 ? (
                            <div className="px-4 py-6 text-center text-slate-500 text-sm">
                              {language === "fr" ? "Aucun administrateur" : "No administrators"}
                            </div>
                          ) : (
                            <ul className="divide-y divide-white/5">
                              {onlineAdmins.map((admin) => {
                                const statusColor = admin.status === 'active' 
                                  ? 'text-green-400' 
                                  : admin.status === 'away'
                                    ? 'text-orange-400'
                                    : admin.status === 'idle'
                                      ? 'text-amber-400'
                                      : 'text-slate-400';
                                const dotColor = admin.status === 'active' 
                                  ? 'bg-green-500' 
                                  : admin.status === 'away'
                                    ? 'bg-orange-500'
                                    : admin.status === 'idle'
                                      ? 'bg-amber-500'
                                      : 'bg-slate-500';

                                const statusText = admin.minutesAgo < 1
                                  ? (language === "fr" ? "Connecté" : "Connected")
                                  : admin.minutesAgo < 60
                                    ? (language === "fr" ? `Connecté il y a ${admin.minutesAgo} min` : `Connected ${admin.minutesAgo} min ago`)
                                    : (() => {
                                        const hours = Math.floor(admin.minutesAgo / 60);
                                        const mins = admin.minutesAgo % 60;
                                        if (language === "fr") {
                                          return mins > 0
                                            ? `Dernière connexion il y a ${hours}h ${mins}min`
                                            : `Dernière connexion il y a ${hours}h`;
                                        }
                                        return mins > 0
                                          ? `Last connected ${hours}h ${mins}m ago`
                                          : `Last connected ${hours}h ago`;
                                      })();
                                
                                // Format connected since time
                                const connectedSinceText = admin.lastActivity
                                  ? admin.lastActivity.toLocaleTimeString(language === "fr" ? "fr-FR" : "en-US", {
                                      hour: '2-digit', 
                                      minute: '2-digit',
                                      hour12: language !== "fr"
                                    })
                                  : null;
                                
                                return (
                                  <li key={admin.id} className="px-4 py-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="relative">
                                          {admin.photo ? (
                                            <Image
                                              src={admin.photo}
                                              alt="Profile"
                                              width={32}
                                              height={32}
                                              className="w-8 h-8 rounded-full object-cover border border-orange-500/30"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-semibold text-sm">
                                              {(admin.name || admin.email || "A")[0].toUpperCase()}
                                            </div>
                                          )}
                                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${dotColor} rounded-full border-2 border-slate-900`}></div>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium text-white">
                                            {admin.name || admin.email?.split("@")[0] || "Unknown"}
                                          </p>
                                          <p className="text-xs text-slate-500">{admin.email}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className={`text-xs font-medium ${statusColor}`}>
                                          {statusText}
                                        </p>
                                        {connectedSinceText && (
                                          <p className="text-xs text-slate-500">
                                            {language === "fr" ? `vu à ${connectedSinceText}` : `seen at ${connectedSinceText}`}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Language toggle */}
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  <button
                    onClick={() => setLanguage("en")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      language === "en" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLanguage("fr")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      language === "fr" ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    FR
                  </button>
                </div>

                {/* Password change button */}
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors"
                >
                  {t.changePassword}
                </button>

                {/* Sign out button */}
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  {t.signOut}
                </button>
              </div>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
            <nav className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
              {filteredNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${
                      isActive
                        ? "border-orange-500 text-orange-400"
                        : "border-transparent text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{language === "fr" ? item.label.fr : item.label.en}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        {/* Database Reset Warning Banner */}
        {permissions.canManageAdmins && (
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-6">
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="text-yellow-400 font-semibold flex items-center gap-2">
                  <span>⚠️</span> {t.resetDatabase}
                </p>
                <p className="text-sm text-slate-400 mt-1">{t.resetDatabaseDesc}</p>
              </div>
              <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider text-orange-400 border border-orange-500/50 rounded-xl hover:bg-orange-500/10 transition-colors">
                {t.resetAllStats}
              </button>
            </div>
          </div>
        )}

        {/* Main content with page transition */}
        <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
          <div 
            key={pathname}
            className="animate-in fade-in slide-in-from-right-4 duration-300"
          >
            {children}
          </div>
        </main>

        {/* Password Change Modal */}
        {showPasswordChange && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">{t.changePassword}</h3>
              <div className="space-y-4">
                <input
                  type="password"
                  placeholder={language === "fr" ? "Nouveau mot de passe" : "New password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-slate-500"
                />
                <input
                  type="password"
                  placeholder={language === "fr" ? "Confirmer le mot de passe" : "Confirm password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-slate-500"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPasswordChange(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition-colors"
                  >
                    {language === "fr" ? "Annuler" : "Cancel"}
                  </button>
                  <button
                    className="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
                  >
                    {language === "fr" ? "Enregistrer" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Display Name Edit Modal */}
        {showDisplayNameEdit && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">{t.editDisplayName}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">{t.displayName}</label>
                  <input
                    type="text"
                    placeholder={currentAdminUser?.email}
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDisplayNameEdit(false);
                      setNewDisplayName("");
                    }}
                    disabled={displayNameSaving}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleUpdateDisplayName}
                    disabled={displayNameSaving || !newDisplayName.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {displayNameSaving ? t.saving : t.save}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Picture Edit Modal */}
        {showProfilePictureEdit && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">{t.editProfilePicture}</h3>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="relative inline-block">
                    {profileImagePreview || currentAdminUser?.photo ? (
                      <Image
                        src={profileImagePreview || currentAdminUser?.photo || ""}
                        alt="Profile preview"
                        width={120}
                        height={120}
                        className="w-30 h-30 rounded-full object-cover border-2 border-orange-500/30"
                      />
                    ) : (
                      <div className="w-30 h-30 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-3xl">
                        {(currentAdminUser?.displayName || currentAdminUser?.email || "A")[0].toUpperCase()}
                      </div>
                    )}
                    {(profileImagePreview || currentAdminUser?.photo) && (
                      <button
                        onClick={handleRemoveProfilePicture}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
                        title={t.removePhoto}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">{t.chooseNewPhoto}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    title={t.chooseNewPhoto}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowProfilePictureEdit(false);
                      setProfileImageFile(null);
                      setProfileImagePreview("");
                    }}
                    disabled={profilePictureSaving}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleUpdateProfilePicture}
                    disabled={profilePictureSaving}
                    className="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {profilePictureSaving ? t.saving : t.save}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* First Login Setup Modal */}
        {currentAdminUser?.isFirstLogin && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6">
              <h3 className="text-xl font-semibold text-white mb-2">{t.firstLoginTitle}</h3>
              <p className="text-sm text-slate-400 mb-5">{t.firstLoginSubtitle}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">{t.firstLoginFullName}</label>
                  <input
                    type="text"
                    value={firstLoginName}
                    onChange={(e) => setFirstLoginName(e.target.value)}
                    placeholder={t.firstLoginFullNamePlaceholder}
                    title={t.firstLoginFullName}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                  {currentAdminUser.displayName && (
                    <p className="mt-2 text-xs text-slate-500">
                      {language === "fr"
                        ? `Nom actuel défini par l'admin principal: ${currentAdminUser.displayName}`
                        : `Current name set by master admin: ${currentAdminUser.displayName}`}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-2">{t.firstLoginPhotoRequired}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFirstLoginPhotoChange}
                    title={t.firstLoginChoosePhoto}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer"
                  />
                </div>

                {(firstLoginPhotoPreview || currentAdminUser.photo) && (
                  <div className="flex justify-center">
                    <Image
                      src={firstLoginPhotoPreview || currentAdminUser.photo || ""}
                      alt="Profile preview"
                      width={96}
                      height={96}
                      className="h-24 w-24 rounded-full object-cover border border-orange-500/40"
                    />
                  </div>
                )}

                {firstLoginError && (
                  <p className="text-sm text-rose-300">{firstLoginError}</p>
                )}

                <button
                  onClick={handleCompleteFirstLogin}
                  disabled={firstLoginSaving}
                  className="w-full px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {firstLoginSaving ? t.saving : t.firstLoginSubmit}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Picture Reminder */}
        {showPhotoReminder && (
          <div className="fixed inset-0 z-[215] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6">
              <h3 className="text-xl font-semibold text-white mb-2">{t.photoReminderTitle}</h3>
              <p className="text-sm text-slate-400 mb-6">{t.photoReminderSubtitle}</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPhotoReminder(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
                >
                  {t.photoReminderLater}
                </button>
                <button
                  onClick={() => {
                    setShowPhotoReminder(false);
                    setShowProfilePictureEdit(true);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
                >
                  {t.photoReminderUpdate}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminContext.Provider>
  );
}
