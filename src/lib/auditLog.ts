import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseDB } from "./firebase";
import type { AuditAction } from "@/types/auditLog";

export async function logAuditAction(
  action: AuditAction,
  userId: string,
  userEmail: string,
  targetType: "team" | "player" | "coach" | "game" | "news" | "referee" | "venue" | "partner" | "committee" | "admin",
  targetId?: string,
  targetName?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await addDoc(collection(firebaseDB, "auditLogs"), {
      action,
      userId,
      userEmail,
      targetType,
      targetId: targetId || null,
      targetName: targetName || null,
      details: details || {},
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log audit action:", error);
    // Don't throw - audit logging should not break the main flow
  }
}

export function formatAuditLogDisplay(log: any): string {
  const actionMap: Record<string, string> = {
    team_created: "created team",
    team_updated: "updated team",
    team_deleted: "deleted team",
    player_added: "added player",
    player_updated: "updated player",
    player_deleted: "deleted player",
    player_transferred: "transferred player",
    coach_added: "added coach",
    coach_updated: "updated coach",
    coach_deleted: "deleted coach",
    game_created: "scheduled game",
    game_updated: "updated game",
    game_deleted: "deleted game",
    game_stats_updated: "updated game stats",
    news_created: "published news",
    news_updated: "updated news",
    news_deleted: "deleted news",
    referee_added: "added referee",
    referee_updated: "updated referee",
    referee_deleted: "deleted referee",
    venue_added: "added venue",
    venue_updated: "updated venue",
    venue_deleted: "deleted venue",
    partner_added: "added partner",
    partner_updated: "updated partner",
    partner_deleted: "deleted partner",
    committee_added: "added committee member",
    committee_updated: "updated committee member",
    committee_deleted: "deleted committee member",
    admin_created: "created admin user",
    admin_role_changed: "changed admin role",
    admin_deleted: "deleted admin user",
  };

  const action = actionMap[log.action] || log.action;
  const target = log.targetName || `${log.targetType} #${log.targetId}`;
  
  return `${action} "${target}"`;
}
