"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAdmin } from "../layout";

import { collection, query, orderBy, limit, onSnapshot, getDocs, writeBatch } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import type { AuditLog } from "@/types/auditLog";
import { formatAuditLogDisplay } from "@/lib/auditLog";

const translations = {
  en: {
    title: "Activity Log",
    subtitle: "Complete audit trail of all admin actions",
    totalLogs: "Total Logs",
    activeAdmins: "Active Admins",
    mobileSessions: "Mobile Sessions",
    noLogs: "No activity recorded yet",
    noLogsDesc: "The audit log tracks all admin actions automatically. Actions will appear here once they occur.",
    by: "by",
    accessDenied: "Access Denied",
    accessDeniedDesc: "Only master administrators can view the activity log.",
    loading: "Loading...",
    testLog: "Test Log",
    testLogCreated: "Test log created!",
    filterByAdmin: "Filter by admin",
    allAdmins: "All admins",
    details: "Details",
    noDetails: "No additional details",
    showing: "Showing",
    of: "of",
    logs: "logs",
    resetLogs: "Reset Logs",
    resetLogsConfirm: "Are you sure you want to delete ALL audit logs? This cannot be undone!",
    resetting: "Resetting...",
    resetSuccess: "logs deleted successfully",
  },
  fr: {
    title: "Journal d'activité",
    subtitle: "Historique complet de toutes les actions administratives",
    totalLogs: "Total des logs",
    activeAdmins: "Admins actifs",
    mobileSessions: "Sessions mobiles",
    noLogs: "Aucune activité enregistrée",
    noLogsDesc: "Le journal d'activité suit automatiquement toutes les actions des administrateurs. Les actions apparaîtront ici une fois effectuées.",
    by: "par",
    accessDenied: "Accès refusé",
    accessDeniedDesc: "Seuls les administrateurs principaux peuvent voir le journal d'activité.",
    loading: "Chargement...",
    testLog: "Test Log",
    testLogCreated: "Log de test créé !",
    filterByAdmin: "Filtrer par admin",
    allAdmins: "Tous les admins",
    details: "Détails",
    noDetails: "Aucun détail supplémentaire",
    showing: "Affichage",
    of: "sur",
    logs: "logs",
    resetLogs: "Réinitialiser",
    resetLogsConfirm: "Êtes-vous sûr de vouloir supprimer TOUS les logs d'audit? Cette action est irréversible!",
    resetting: "Réinitialisation...",
    resetSuccess: "logs supprimés avec succès",
  },
};

// Format details object into readable text
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatDetails(log: AuditLog, _language: "en" | "fr"): string[] {
  const details: string[] = [];
  const d = log.details || {};
  
  // Common detail fields
  if (d.teamName) details.push(`Team: ${d.teamName}`);
  if (d.jerseyNumber) details.push(`#${d.jerseyNumber}`);
  if (d.position) details.push(`Position: ${d.position}`);
  if (d.height) details.push(`Height: ${d.height}`);
  if (d.weight) details.push(`Weight: ${d.weight}`);
  
  // Game details
  if (d.homeTeam) details.push(`Home: ${d.homeTeam}`);
  if (d.awayTeam) details.push(`Away: ${d.awayTeam}`);
  if (d.gameDate) details.push(`Date: ${d.gameDate}`);
  if (d.venue) details.push(`Venue: ${d.venue}`);
  if (d.score) details.push(`Score: ${d.score}`);
  if (d.homeScore !== undefined && d.awayScore !== undefined) {
    details.push(`Score: ${d.homeScore} - ${d.awayScore}`);
  }
  
  // Referee details
  if (d.referees) details.push(`Refs: ${Array.isArray(d.referees) ? d.referees.join(', ') : d.referees}`);
  
  // News details
  if (d.newsTitle) details.push(`Title: ${d.newsTitle}`);
  if (d.category) details.push(`Category: ${d.category}`);
  
  // Admin details
  if (d.roles) details.push(`Roles: ${Array.isArray(d.roles) ? d.roles.join(', ') : d.roles}`);
  if (d.permissions) details.push(`Permissions: ${Array.isArray(d.permissions) ? d.permissions.join(', ') : d.permissions}`);
  if (d.email) details.push(`Email: ${d.email}`);
  if (d.displayName) details.push(`Name: ${d.displayName}`);
  
  // Transfer details
  if (d.fromTeam) details.push(`From: ${d.fromTeam}`);
  if (d.toTeam) details.push(`To: ${d.toTeam}`);
  
  // Stats details
  if (d.points !== undefined) details.push(`Points: ${d.points}`);
  if (d.rebounds !== undefined) details.push(`Rebounds: ${d.rebounds}`);
  if (d.assists !== undefined) details.push(`Assists: ${d.assists}`);
  if (d.steals !== undefined) details.push(`Steals: ${d.steals}`);
  if (d.blocks !== undefined) details.push(`Blocks: ${d.blocks}`);
  
  // Venue details
  if (d.address) details.push(`Address: ${d.address}`);
  if (d.city) details.push(`City: ${d.city}`);
  if (d.capacity) details.push(`Capacity: ${d.capacity}`);
  
  // Partner details
  if (d.website) details.push(`Website: ${d.website}`);
  if (d.tier) details.push(`Tier: ${d.tier}`);
  
  // Committee details
  if (d.role) details.push(`Role: ${d.role}`);
  if (d.phone) details.push(`Phone: ${d.phone}`);
  
  // Changes tracked
  if (d.changes) {
    if (typeof d.changes === 'object') {
      Object.entries(d.changes).forEach(([key, value]) => {
        details.push(`${key}: ${value}`);
      });
    } else {
      details.push(`Changes: ${d.changes}`);
    }
  }
  
  // Raw fields for anything else
  if (d.field) details.push(`Field: ${d.field}`);
  if (d.oldValue !== undefined) details.push(`Old: ${d.oldValue}`);
  if (d.newValue !== undefined) details.push(`New: ${d.newValue}`);
  
  return details;
}

export default function ActivityLogPage() {
  const { currentAdminUser, language } = useAdmin();
  const t = translations[language];
  
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Check master admin access
  const isMaster = currentAdminUser?.roles?.includes('master');

  // Get unique admins from logs
  const uniqueAdmins = useMemo(() => {
    const admins = new Map<string, string>();
    auditLogs.forEach(log => {
      if (log.userEmail && !admins.has(log.userEmail)) {
        admins.set(log.userEmail, log.userEmail.split('@')[0]);
      }
    });
    return Array.from(admins.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [auditLogs]);

  // Filter logs by selected admin
  const filteredLogs = useMemo(() => {
    if (selectedAdmin === "all") return auditLogs;
    return auditLogs.filter(log => log.userEmail === selectedAdmin);
  }, [auditLogs, selectedAdmin]);

  // Fetch audit logs (500 most recent)
  useEffect(() => {
    if (!isMaster) {
      setLoading(false);
      return;
    }

    const auditQuery = query(
      collection(firebaseDB, "auditLogs"), 
      orderBy("timestamp", "desc"), 
      limit(500)
    );
    
    const unsubscribe = onSnapshot(auditQuery, (snapshot) => {
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() ?? new Date(),
      } as AuditLog));
      setAuditLogs(logs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isMaster]);

  // Reset all audit logs
  const handleResetLogs = async () => {
    if (!confirm(t.resetLogsConfirm)) return;
    
    setResetting(true);
    try {
      const logsSnap = await getDocs(collection(firebaseDB, "auditLogs"));
      const batchSize = 500;
      let deleted = 0;
      
      // Delete in batches of 500 (Firestore limit)
      const docs = logsSnap.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(firebaseDB);
        const chunk = docs.slice(i, i + batchSize);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += chunk.length;
      }
      
      alert(`✓ ${deleted} ${t.resetSuccess}`);
    } catch (error) {
      console.error("Error resetting logs:", error);
      alert("Error resetting logs");
    } finally {
      setResetting(false);
    }
  };

  // Access denied for non-master admins
  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl mb-4">
          🔒
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t.accessDenied}</h1>
        <p className="text-slate-400">{t.accessDeniedDesc}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const mobileCount = filteredLogs.filter(l => l.details?.deviceInfo?.isMobile).length;
  const uniqueUsers = new Set(filteredLogs.map(l => l.userEmail)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{t.subtitle}</p>
        </div>
        
        {/* Admin Filter & Reset */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">{t.filterByAdmin}:</label>
            <select
              value={selectedAdmin}
              onChange={(e) => setSelectedAdmin(e.target.value)}
              className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="all">{t.allAdmins} ({uniqueAdmins.length})</option>
              {uniqueAdmins.map(([email, name]) => (
                <option key={email} value={email}>{name}</option>
              ))}
            </select>
          </div>
          
          {/* Reset Button */}
          <button
            onClick={handleResetLogs}
            disabled={resetting || auditLogs.length === 0}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {resetting ? t.resetting : t.resetLogs}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
          <p className="text-xs uppercase tracking-wider text-sky-400">{t.totalLogs}</p>
          <p className="text-3xl font-bold text-white mt-2">{filteredLogs.length}</p>
          <p className="text-xs text-slate-400 mt-1">
            {selectedAdmin !== "all" ? `${t.showing} ${filteredLogs.length} ${t.of} ${auditLogs.length}` : "Last 250 actions"}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-wider text-emerald-400">{t.activeAdmins}</p>
          <p className="text-3xl font-bold text-white mt-2">{uniqueUsers}</p>
          <p className="text-xs text-slate-400 mt-1">Unique accounts</p>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
          <p className="text-xs uppercase tracking-wider text-purple-400">{t.mobileSessions}</p>
          <p className="text-3xl font-bold text-white mt-2">{mobileCount}</p>
          <p className="text-xs text-slate-400 mt-1">Mobile device actions</p>
        </div>
      </div>

      {/* Log List */}
      {filteredLogs.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-6 text-center">
          <p className="text-sm text-yellow-400 mb-3">⚠️ {t.noLogs}</p>
          <p className="text-xs text-slate-400">{t.noLogsDesc}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-slate-800/50 flex items-center justify-between">
            <span className="text-sm font-medium text-white">Recent Activity</span>
            <span className="text-xs text-slate-400">{filteredLogs.length} {t.logs}</span>
          </div>
          <div className="max-h-[700px] overflow-y-auto divide-y divide-white/5">
            {filteredLogs.map((log) => {
              const actionColor = log.action.includes("deleted") || log.action.includes("logout") 
                ? "text-rose-400" 
                : log.action.includes("created") || log.action.includes("added") || log.action.includes("login") 
                  ? "text-emerald-400"
                  : "text-sky-400";
              const bgColor = log.action.includes("deleted") || log.action.includes("logout") 
                ? "bg-rose-500/5" 
                : log.action.includes("created") || log.action.includes("added") || log.action.includes("login") 
                  ? "bg-emerald-500/5"
                  : "bg-sky-500/5";
              
              const deviceInfo = log.details?.deviceInfo;
              const sessionId = log.details?.sessionId;
              const detailsList = formatDetails(log, language);
              const isExpanded = expandedLogId === log.id;
              
              return (
                <div
                  key={log.id}
                  className={`px-4 py-3 ${bgColor} hover:bg-white/5 transition-colors cursor-pointer`}
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm ${actionColor}`}>
                          {formatAuditLogDisplay(log)}
                        </p>
                        {detailsList.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                            +{detailsList.length} {t.details.toLowerCase()}
                          </span>
                        )}
                        <span className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {t.by} {log.userEmail?.split('@')[0] || 'unknown'} · {log.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-600 flex-shrink-0 px-2 py-1 bg-white/5 rounded">
                      {log.targetType}
                    </span>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      {/* Action Details */}
                      {detailsList.length > 0 ? (
                        <div className="mb-3">
                          <p className="text-[10px] uppercase tracking-wider text-orange-400 mb-2">{t.details}</p>
                          <div className="flex flex-wrap gap-2">
                            {detailsList.map((detail, idx) => (
                              <span 
                                key={idx} 
                                className="px-2 py-1 rounded bg-orange-500/10 text-orange-300 text-xs border border-orange-500/20"
                              >
                                {detail}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mb-3">{t.noDetails}</p>
                      )}
                      
                      {/* Target Info */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] mb-3">
                        <div className="px-2 py-1 rounded bg-white/5">
                          <span className="text-slate-500">Target ID:</span>{" "}
                          <span className="text-white font-mono">{log.targetId || "N/A"}</span>
                        </div>
                        <div className="px-2 py-1 rounded bg-white/5">
                          <span className="text-slate-500">Target:</span>{" "}
                          <span className="text-white">{log.targetName || log.targetType}</span>
                        </div>
                        <div className="px-2 py-1 rounded bg-white/5">
                          <span className="text-slate-500">User ID:</span>{" "}
                          <span className="text-white font-mono">{log.userId?.slice(0, 12)}...</span>
                        </div>
                      </div>
                      
                      {/* Device and Session Info */}
                      {deviceInfo && (
                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                          <span className="px-2 py-0.5 rounded bg-white/5">
                            {deviceInfo.browser || 'Unknown Browser'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/5">
                            {deviceInfo.platform || 'Unknown OS'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/5">
                            {deviceInfo.isMobile ? '📱 Mobile' : '💻 Desktop'}
                          </span>
                          {deviceInfo.screenResolution && (
                            <span className="px-2 py-0.5 rounded bg-white/5">
                              {deviceInfo.screenResolution}
                            </span>
                          )}
                          {deviceInfo.timezone && (
                            <span className="px-2 py-0.5 rounded bg-white/5">
                              🌍 {deviceInfo.timezone}
                            </span>
                          )}
                          {sessionId && (
                            <span className="px-2 py-0.5 rounded bg-white/5 font-mono">
                              Session: {sessionId.slice(-8)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
