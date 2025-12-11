export type AuditAction =
  | "team_created"
  | "team_updated"
  | "team_deleted"
  | "player_added"
  | "player_updated"
  | "player_deleted"
  | "player_transferred"
  | "coach_added"
  | "coach_updated"
  | "coach_deleted"
  | "game_created"
  | "game_updated"
  | "game_deleted"
  | "game_stats_updated"
  | "news_created"
  | "news_updated"
  | "news_deleted"
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
  | "admin_created"
  | "admin_role_changed"
  | "admin_deleted";

export type AuditLog = {
  id: string;
  action: AuditAction;
  userId: string;
  userEmail: string;
  targetType: "team" | "player" | "coach" | "game" | "news" | "referee" | "venue" | "partner" | "committee" | "admin";
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
