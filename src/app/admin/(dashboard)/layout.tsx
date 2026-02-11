"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { firebaseAuth, firebaseDB } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, updateDoc, setDoc, serverTimestamp, onSnapshot, collection, query, where } from "firebase/firestore";
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
};

const navItems: NavItem[] = [
  { key: "stories", label: { en: "Stories", fr: "Histoires" }, href: "/admin/stories", icon: "📰", requiredPermission: "canManageNews" },
  { key: "teams", label: { en: "Teams", fr: "Équipes" }, href: "/admin/teams", icon: "🏀", requiredPermission: "canManageTeams" },
  { key: "traffic", label: { en: "Traffic", fr: "Trafic" }, href: "/admin/traffic", icon: "📊", requiredPermission: "canManageNews" },
  { key: "accounts", label: { en: "Accounts", fr: "Accounts" }, href: "/admin/accounts", icon: "👥", requiredPermission: "canManageUsers" },
  { key: "verifications", label: { en: "Verifications", fr: "Vérifications" }, href: "/admin/verifications", icon: "✓", requiredPermission: "canManageUsers" },
  { key: "games", label: { en: "Games", fr: "Matchs" }, href: "/admin/games", icon: "🏟️", requiredPermission: "canManageGames" },
  { key: "stats", label: { en: "Statistics", fr: "Statistiques" }, href: "/admin/stats", icon: "📈", requiredPermission: "canManageGames" },
  // League sub-sections
  { key: "referees", label: { en: "Referees", fr: "Arbitres" }, href: "/admin/league/referees", icon: "👨‍⚖️", requiredPermission: "canManageReferees" },
  { key: "committee", label: { en: "Committee", fr: "Comité" }, href: "/admin/league/committee", icon: "👔", requiredPermission: "canManageCommittee" },
  { key: "partners", label: { en: "Partners", fr: "Partenaires" }, href: "/admin/league/partners", icon: "🤝", requiredPermission: "canManagePartners" },
  { key: "sales", label: { en: "Sales", fr: "Sales" }, href: "/admin/league/sales", icon: "💰", requiredPermission: "canManageSales" },
  { key: "league", label: { en: "League Settings", fr: "Paramètres Ligue" }, href: "/admin/league", icon: "⚙️", requiredPermission: "canManageLeague" },
  { key: "admins", label: { en: "Administrators", fr: "Administrateurs" }, href: "/admin/admins", icon: "👤", requiredPermission: "canManageAdmins" },
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
  },
};

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlineAdminsCount, setOnlineAdminsCount] = useState(0);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  // Listen for online admins
  useEffect(() => {
    const adminsRef = collection(firebaseDB, "adminUsers");
    const q = query(adminsRef, where("isOnline", "==", true));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOnlineAdminsCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

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
              <div>
                <h1 className="text-xl font-bold text-white">{t.dashboard}</h1>
                <p className="text-xs text-slate-400">{t.cms}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Online admins indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm text-slate-300">
                    {onlineAdminsCount} {t.adminsOnline}
                  </span>
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

        {/* Main content */}
        <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
          {children}
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
      </div>
    </AdminContext.Provider>
  );
}
