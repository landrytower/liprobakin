import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseDB } from "./firebase";
import type { AuditAction } from "@/types/auditLog";

// Generate unique session ID
export const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get comprehensive device and browser information
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  
  if (ua.includes("Chrome") && !ua.includes("Edge")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

  return {
    userAgent: ua,
    platform: navigator.platform,
    browser: browser,
    isMobile: /Mobile|Android|iPhone|iPad/i.test(ua),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
};

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
    const sessionId = sessionStorage.getItem('sessionId') || generateSessionId();
    
    const logData = {
      action,
      userId,
      userEmail,
      targetType,
      targetId: targetId || null,
      targetName: targetName || null,
      details: details || {},
      sessionId,
      deviceInfo: getDeviceInfo(),
      timestamp: serverTimestamp(),
    };
    
    console.log("📝 Creating audit log:", { action, userId, userEmail, targetType, targetId, targetName });
    
    const docRef = await addDoc(collection(firebaseDB, "auditLogs"), logData);
    
    console.log("✅ Audit log created successfully:", docRef.id);
  } catch (error) {
    console.error("❌ Failed to log audit action:", error);
    console.error("Error details:", {
      action,
      userId,
      userEmail,
      targetType,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    // Don't throw - audit logging should not break the main flow
  }
}

// Log user session start
export async function logSessionStart(userId: string, userEmail: string): Promise<string> {
  try {
    const sessionId = generateSessionId();
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('sessionStartTime', Date.now().toString());
    
    await addDoc(collection(firebaseDB, "userSessions"), {
      userId,
      userEmail,
      sessionId,
      action: "login",
      deviceInfo: getDeviceInfo(),
      startTime: serverTimestamp(),
      lastActivity: serverTimestamp(),
      active: true,
    });

    return sessionId;
  } catch (error) {
    console.error("Failed to log session start:", error);
    return generateSessionId();
  }
}

// Log session activity (heartbeat every few minutes)
export async function logSessionActivity(userId: string, userEmail: string, sessionId: string): Promise<void> {
  try {
    const startTime = parseInt(sessionStorage.getItem('sessionStartTime') || Date.now().toString());
    const sessionDuration = Math.floor((Date.now() - startTime) / 1000); // seconds
    
    await addDoc(collection(firebaseDB, "sessionActivity"), {
      userId,
      userEmail,
      sessionId,
      sessionDuration,
      deviceInfo: getDeviceInfo(),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log session activity:", error);
  }
}

// Log session end
export async function logSessionEnd(userId: string, userEmail: string, sessionId: string): Promise<void> {
  try {
    const startTime = parseInt(sessionStorage.getItem('sessionStartTime') || Date.now().toString());
    const sessionDuration = Math.floor((Date.now() - startTime) / 1000);
    
    await addDoc(collection(firebaseDB, "userSessions"), {
      userId,
      userEmail,
      sessionId,
      action: "logout",
      deviceInfo: getDeviceInfo(),
      endTime: serverTimestamp(),
      sessionDuration: sessionDuration,
      sessionDurationFormatted: `${Math.floor(sessionDuration / 60)} minutes ${sessionDuration % 60} seconds`,
      active: false,
    });

    sessionStorage.removeItem('sessionId');
    sessionStorage.removeItem('sessionStartTime');
  } catch (error) {
    console.error("Failed to log session end:", error);
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
    admin_user_created: "created admin user",
    admin_roles_updated: "updated admin roles",
    admin_user_deactivated: "deactivated admin user",
    admin_user_reactivated: "reactivated admin user",
    admin_user_deleted: "deleted admin user",
    admin_password_changed: "changed admin password",
    user_login: "logged in",
    user_logout: "logged out",
    stats_reset: "reset statistics",
    data_exported: "exported data",
    system_test: "created test log entry",
    system_initialized: "initialized audit log system",
  };

  const action = actionMap[log.action] || log.action;
  const target = log.targetName || `${log.targetType} #${log.targetId}`;
  
  return `${action} "${target}"`;
}
