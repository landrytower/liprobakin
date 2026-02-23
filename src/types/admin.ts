export type AdminRole = 
  | "master" 
  | "league_manager"
  | "media_manager"
  | "eubakin_manager"
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
  canManageUsers: boolean;         // 👥 USERS (parent for Accounts & Verifications)
  canManageAccounts: boolean;      // 👥 ACCOUNTS (sub-permission)
  canManageVerifications: boolean; // ✓ VERIFICATIONS (sub-permission)
  canManageGames: boolean;         // 🗓️ GAMES (parent for Matches & Statistics)
  canManageMatches: boolean;       // 🏟️ MATCHS (sub-permission)
  canManageStatistics: boolean;    // 📊 STATISTIQUES (sub-permission)
  canManageLeague: boolean;        // ⚙️ LIGUE (parent)
  canManageAdmins: boolean;        // 👥 ADMINISTRATEURS
  canManagePlayers: boolean;
  canManageReferees: boolean;      // Sub-permission under League
  canManageVenues: boolean;
  canManageEubakin: boolean;       // Sub-permission under League
  canManagePartners: boolean;      // Sub-permission under League
  canManageCommittee: boolean;     // Sub-permission under League (membre du comité)
  canManageCommission: boolean;    // Sub-permission under League (commission - one level down from committee)
  canManageGameMedia: boolean;     // Sub-permission under League (game photos/highlights)
  canManageSales: boolean;         // Sub-permission under League
  canViewTraffic: boolean;         // 📊 TRAFFIC ANALYTICS
};

// Sub-permission keys for each main category
export type PermissionSubCategories = {
  canManageLeague: ('canManageReferees' | 'canManageCommittee' | 'canManageCommission' | 'canManagePartners' | 'canManageSales' | 'canManageEubakin' | 'canManageGameMedia')[];
  canManageGames: ('canManageMatches' | 'canManageStatistics')[];
  canManageUsers: ('canManageAccounts' | 'canManageVerifications')[];
};

export type AdminUser = {
  id: string;
  email: string;
  displayName?: string;
  photo?: string;
  profilePicturePrompted?: boolean;
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
    canManageMatches: true,
    canManageStatistics: true,
    canManageTeams: true,
    canManageUsers: true,
    canManageAccounts: true,
    canManageVerifications: true,
    canManageLeague: true,
    canManagePlayers: true,
    canManageReferees: true,
    canManageVenues: true,
    canManageEubakin: true,
    canManagePartners: true,
    canManageCommittee: true,
    canManageCommission: true,
    canManageGameMedia: true,
    canManageSales: true,
    canManageAdmins: true,
    canViewTraffic: true,
  },
  league_manager: {
    canManageNews: true,
    canManageGames: true,
    canManageMatches: true,
    canManageStatistics: true,
    canManageTeams: true,
    canManageUsers: true,
    canManageAccounts: true,
    canManageVerifications: true,
    canManageLeague: true,
    canManagePlayers: true,
    canManageReferees: true,
    canManageVenues: true,
    canManageEubakin: true,
    canManagePartners: true,
    canManageCommittee: true,
    canManageCommission: true,
    canManageGameMedia: true,
    canManageSales: true,
    canManageAdmins: false,
    canViewTraffic: true,
  },
  media_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageMatches: false,
    canManageStatistics: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: true,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManageEubakin: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageCommission: false,
    canManageGameMedia: true,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
  },
  news_editor: {
    canManageNews: true,
    canManageGames: false,
    canManageMatches: false,
    canManageStatistics: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManageEubakin: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageCommission: false,
    canManageGameMedia: false,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
  },
  eubakin_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageMatches: false,
    canManageStatistics: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManageEubakin: true,
    canManagePartners: false,
    canManageCommittee: false,
    canManageCommission: false,
    canManageGameMedia: false,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
  },
  game_scheduler: {
    canManageNews: false,
    canManageGames: true,
    canManageMatches: true,
    canManageStatistics: true,
    canManageTeams: false,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManageEubakin: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageCommission: false,
    canManageGameMedia: false,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
  },
  team_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageMatches: false,
    canManageStatistics: false,
    canManageTeams: true,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: false,
    canManagePlayers: true,
    canManageReferees: false,
    canManageVenues: false,
    canManageEubakin: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageCommission: false,
    canManageGameMedia: false,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
  },
  referee_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageMatches: false,
    canManageStatistics: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: true,
    canManageVenues: false,
    canManageEubakin: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageCommission: false,
    canManageGameMedia: false,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
  },
  venue_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageMatches: false,
    canManageStatistics: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: true,
    canManageEubakin: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageCommission: false,
    canManageGameMedia: false,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
  },
  partner_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageMatches: false,
    canManageStatistics: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManageEubakin: false,
    canManagePartners: true,
    canManageCommittee: true,
    canManageCommission: true,
    canManageGameMedia: false,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
  },
};

export function mergePermissions(roles: AdminRole[]): AdminPermissions {
  const merged: AdminPermissions = {
    canManageNews: false,
    canManageGames: false,
    canManageMatches: false,
    canManageStatistics: false,
    canManageTeams: false,
    canManageUsers: false,
    canManageAccounts: false,
    canManageVerifications: false,
    canManageLeague: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManageEubakin: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageCommission: false,
    canManageGameMedia: false,
    canManageSales: false,
    canManageAdmins: false,
    canViewTraffic: false,
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
