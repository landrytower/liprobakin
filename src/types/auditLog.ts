export type AuditAction =
  | "user_login"
  | "user_logout"
  | "team_created"
  | "team_updated"
  | "team_deleted"
  | "player_added"
  | "player_updated"
  | "player_deleted"
  | "player_transferred"
  | "player_stats_reset"
  | "player_stats_modified"
  | "coach_added"
  | "coach_updated"
  | "coach_deleted"
  | "game_created"
  | "game_updated"
  | "game_deleted"
  | "game_stats_updated"
  | "game_stats_recorded"
  | "news_created"
  | "news_updated"
  | "news_deleted"
  | "article_created"
  | "article_updated"
  | "article_deleted"
  | "referee_added"
  | "referee_updated"
  | "referee_deleted"
  | "venue_added"
  | "venue_updated"
  | "venue_deleted"
  | "partner_added"
  | "partner_updated"
  | "partner_deleted"
  | "committee_added"
  | "committee_updated"
  | "committee_deleted"
  | "account_updated"
  | "account_deleted"
  | "verification_approved"
  | "verification_rejected"
  | "admin_created"
  | "admin_deleted"
  | "admin_user_created"
  | "admin_roles_updated"
  | "admin_permissions_updated"
  | "admin_user_deactivated"
  | "admin_user_reactivated"
  | "admin_user_deleted"
  | "admin_password_changed"
  | "stats_reset"
  | "all_stats_reset"
  | "team_stats_reset"
  | "database_reset"
  | "data_exported"
  | "system_test"
  | "system_initialized";

export type AuditLog = {
  id: string;
  action: AuditAction;
  userId: string;
  userEmail: string;
  targetType: "team" | "player" | "coach" | "game" | "news" | "referee" | "venue" | "partner" | "committee" | "admin" | "user" | "verification" | "system";
  targetId?: string;
  targetName?: string;
  details?: Record<string, any>;
  timestamp: Date;
};

export type AuditLogDisplay = AuditLog & {
  displayText: string;
  icon: string;
  color: string;
};
