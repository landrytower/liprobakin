export type AdminRole = 
  | "master" 
  | "league_manager"
  | "news_editor" 
  | "game_scheduler" 
  | "team_manager" 
  | "referee_manager"
  | "venue_manager"
  | "partner_manager";

export type AdminPermissions = {
  canManageNews: boolean;
  canManageGames: boolean;
  canManageTeams: boolean;
  canManagePlayers: boolean;
  canManageReferees: boolean;
  canManageVenues: boolean;
  canManagePartners: boolean;
  canManageCommittee: boolean;
  canManageAdmins: boolean;
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
    canManagePlayers: true,
    canManageReferees: true,
    canManageVenues: true,
    canManagePartners: true,
    canManageCommittee: true,
    canManageAdmins: true,
  },
  league_manager: {
    canManageNews: true,
    canManageGames: true,
    canManageTeams: true,
    canManagePlayers: true,
    canManageReferees: true,
    canManageVenues: true,
    canManagePartners: true,
    canManageCommittee: true,
    canManageAdmins: false,
  },
  news_editor: {
    canManageNews: true,
    canManageGames: false,
    canManageTeams: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageAdmins: false,
  },
  game_scheduler: {
    canManageNews: false,
    canManageGames: true,
    canManageTeams: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageAdmins: false,
  },
  team_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: true,
    canManagePlayers: true,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageAdmins: false,
  },
  referee_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: false,
    canManagePlayers: false,
    canManageReferees: true,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
    canManageAdmins: false,
  },
  venue_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: true,
    canManagePartners: false,
    canManageCommittee: false,
    canManageAdmins: false,
  },
  partner_manager: {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: true,
    canManageCommittee: true,
    canManageAdmins: false,
  },
};

export function mergePermissions(roles: AdminRole[]): AdminPermissions {
  const merged: AdminPermissions = {
    canManageNews: false,
    canManageGames: false,
    canManageTeams: false,
    canManagePlayers: false,
    canManageReferees: false,
    canManageVenues: false,
    canManagePartners: false,
    canManageCommittee: false,
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
