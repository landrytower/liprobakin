"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// SEASON MANAGEMENT ADMIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from "react";
import { firebaseDB } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function SeasonManagementPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Create season modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });
  
  // Reset confirmation modal
  const [resetConfirm, setResetConfirm] = useState<{
    seasonId: string;
    seasonName: string;
  } | null>(null);
  const [preserveGames, setPreserveGames] = useState(true);

  const functions = getFunctions();

  // ─── Subscribe to Seasons ──────────────────────────────────────────────────

  useEffect(() => {
    const q = query(
      collection(firebaseDB, "seasons"),
      orderBy("startDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Season[];
      setSeasons(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleCreateSeason = async () => {
    if (!createForm.name || !createForm.startDate || !createForm.endDate) {
      alert("Please fill in all fields");
      return;
    }

    setActionLoading("create");
    try {
      const createSeason = httpsCallable(functions, "createSeason");
      await createSeason({
        name: createForm.name,
        startDate: createForm.startDate,
        endDate: createForm.endDate,
      });
      setShowCreateModal(false);
      setCreateForm({ name: "", startDate: "", endDate: "" });
    } catch (error) {
      console.error("Error creating season:", error);
      alert("Failed to create season");
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivateSeason = async (seasonId: string) => {
    setActionLoading(seasonId);
    try {
      const activateSeason = httpsCallable(functions, "activateSeason");
      await activateSeason({ seasonId });
    } catch (error) {
      console.error("Error activating season:", error);
      alert("Failed to activate season");
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchiveSeason = async (seasonId: string) => {
    if (!confirm("Are you sure you want to archive this season?")) return;

    setActionLoading(seasonId);
    try {
      const archiveSeason = httpsCallable(functions, "archiveSeason");
      await archiveSeason({ seasonId });
    } catch (error) {
      console.error("Error archiving season:", error);
      alert("Failed to archive season");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetRecords = async () => {
    if (!resetConfirm) return;

    setActionLoading(resetConfirm.seasonId);
    try {
      const resetSeasonRecords = httpsCallable(functions, "resetSeasonRecords");
      await resetSeasonRecords({
        seasonId: resetConfirm.seasonId,
        preserveGames,
      });
      setResetConfirm(null);
    } catch (error) {
      console.error("Error resetting records:", error);
      alert("Failed to reset records");
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            League Management
          </p>
          <h1 className="text-2xl font-semibold text-white">Seasons</h1>
          <p className="text-slate-400 text-sm mt-1">
            Create, activate, and manage league seasons
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl font-medium text-sm transition"
        >
          + Create Season
        </button>
      </div>

      {/* Seasons List */}
      <div className="space-y-3">
        {seasons.length === 0 ? (
          <div className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-xl">
            No seasons created yet
          </div>
        ) : (
          seasons.map((season) => (
            <div
              key={season.id}
              className={`p-4 rounded-xl border transition-all ${
                season.isActive
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-black/20 border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Status Badge */}
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      season.isActive
                        ? "bg-green-500/20 text-green-400"
                        : "bg-slate-700/50 text-slate-400"
                    }`}
                  >
                    {season.isActive ? "Active" : "Archived"}
                  </div>

                  {/* Season Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {season.name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {season.startDate?.toDate().toLocaleDateString()} -{" "}
                      {season.endDate?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!season.isActive && (
                    <button
                      onClick={() => handleActivateSeason(season.id)}
                      disabled={actionLoading === season.id}
                      className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      {actionLoading === season.id ? "..." : "Activate"}
                    </button>
                  )}

                  {season.isActive && (
                    <button
                      onClick={() => handleArchiveSeason(season.id)}
                      disabled={actionLoading === season.id}
                      className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      {actionLoading === season.id ? "..." : "Archive"}
                    </button>
                  )}

                  <button
                    onClick={() =>
                      setResetConfirm({
                        seasonId: season.id,
                        seasonName: season.name,
                      })
                    }
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition"
                  >
                    Reset Records
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Season Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">
              Create New Season
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Season Name
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., 2025-26 Season"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSeason}
                disabled={actionLoading === "create"}
                className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition disabled:opacity-50"
              >
                {actionLoading === "create" ? "Creating..." : "Create Season"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-md">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-xl font-semibold text-white">
                Reset Season Records
              </h2>
              <p className="text-slate-400 mt-2">
                This will reset all wins, losses, and stats for{" "}
                <strong className="text-white">{resetConfirm.seasonName}</strong>
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveGames}
                  onChange={(e) => setPreserveGames(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-white/20"
                />
                <div>
                  <div className="text-white font-medium">Preserve Games</div>
                  <div className="text-sm text-slate-400">
                    Keep game schedule but reset scores to scheduled status
                  </div>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setResetConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleResetRecords}
                disabled={actionLoading === resetConfirm.seasonId}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition disabled:opacity-50"
              >
                {actionLoading === resetConfirm.seasonId
                  ? "Resetting..."
                  : "Reset Records"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
