export type AdminRole = 
  | "master" 
  | "league_manager"
  | "news_editor" 
  | "game_scheduler" 
  | "team_manager" 
  | "referee_manager"
  | "venue_manager"
  | "partner_manager";

// Nested permission structure: main categories with sub-permissions
export type AdminPermissions = {
  canManageNews: boolean;          // 📰 HISTOIRES
  canManageTeams: boolean;         // 🏀 ÉQUIPES
  canManageUsers: boolean;         // 👥 ACCOUNTS + ✓ VERIFICATIONS
  canManageGames: boolean;         // 🗓️ MATCHS + 📊 STATISTIQUES
  canManageLeague: boolean;        // ⚙️ LIGUE (parent)
  canManageAdmins: boolean;        // 👥 ADMINISTRATEURS
  canManagePlayers: boolean;
  canManageReferees: boolean;      // Sub-permission under League
  canManageVenues: boolean;
  canManagePartners: boolean;      // Sub-permission under League
  canManageCommittee: boolean;     // Sub-permission under League (membre du comité)
  canManageSales: boolean;         // Sub-permission under League
};

// Sub-permission keys for each main category
export type PermissionSubCategories = {
  canManageLeague: ('canManageReferees' | 'canManageCommittee' | 'canManagePartners' | 'canManageSales')[];
  canManageGames: ('canManageMatches' | 'canManageStatistics')[];
  canManageUsers: ('canManageAccounts' | 'canManageVerifications')[];
};

export type AdminUser = {
  id: string;
  email: string;
  displayName?: string;
  roles: AdminRole[];
  permissions: AdminPermissions;
  isFirstLogin: boolean;
  createdAt: Date | null;
  createdBy: string;
  lastLogin: Date | null;
  lastActivity?: Date | null;
  isActive: boolean;
  status?: "active" | "inactive";
};

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  master: {
    canManageNews: true,
    canManageGames: true,
    canManageTeams: true,
    canManageUsers: true,
    canManageLeague: true,
    canManagePlayers: true,
    canManageReferees: true,
    canManageVenues: true,
    canManagePartners: true,
    canManageCommittee: true,
    canManageSales: true,
    canManageAdmins: true,
  },
  league_manager: {
    canManageNews: true,
    canManageGames: true,
    canManageTeams: true,
    canManageUsers: true,
    canManageLeague: true,
    canManagePlayers: true,
    canManageReferees: true,
    canManageVenues: true,
    canManagePartners: true,
    canManageCommittee: true,
    canManageSales: true,
    canManageAdmins: false,
  },
  news_editor: {
    canManageNews: true,
    canManageGames: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageSales: false,
    canManageAdmins: false,
  },
  game_scheduler: {
    canManageNews: false,
    canManageGames: true,
    canManageTeams: false,
    canManageUsers: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageSales: false,
    canManageAdmins: false,
  },
  team_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: true,
    canManageUsers: false,
    canManageLeague: false,
    canManagePlayers: true,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageSales: false,
    canManageAdmins: false,
  },
  referee_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: true,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageSales: false,
    canManageAdmins: false,
  },
  venue_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: true,
    canManagePartners: false,
    canManageCommittee: false,
    canManageSales: false,
    canManageAdmins: false,
  },
  partner_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: true,
    canManageCommittee: true,
    canManageSales: false,
    canManageAdmins: false,
  },
};

export function mergePermissions(roles: AdminRole[]): AdminPermissions {
  const merged: AdminPermissions = {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageSales: false,
    canManageAdmins: false,
  };

  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (rolePerms) {
      Object.keys(rolePerms).forEach((key) => {
        if (rolePerms[key as keyof AdminPermissions]) {
          merged[key as keyof AdminPermissions] = true;
        }
      });
    }
  }

  return merged;
}
