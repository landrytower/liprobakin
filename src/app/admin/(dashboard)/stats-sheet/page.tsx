"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// PDF STATS SHEET DOWNLOAD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { firebaseDB } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  isActive: boolean;
}

interface Team {
  id: string;
  name: string;
  logo?: string;
  gender: "men" | "women";
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function StatsSheetPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [uploadToStorage, setUploadToStorage] = useState(false);

  const functions = getFunctions();

  // ─── Load Seasons ──────────────────────────────────────────────────────────

  useEffect(() => {
    const q = query(
      collection(firebaseDB, "seasons"),
      orderBy("startDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        isActive: doc.data().isActive,
      })) as Season[];

      setSeasons(data);

      // Auto-select active season
      const activeSeason = data.find((s) => s.isActive);
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id);
      }
    });

    return () => unsubscribe();
  }, []);

  // ─── Load Teams ────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(firebaseDB, "teams"), orderBy("name", "asc")),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          logo: doc.data().logo,
          gender: doc.data().gender || "men",
        })) as Team[];

        setTeams(data);
      }
    );

    return () => unsubscribe();
  }, []);

  // ─── Generate PDF ──────────────────────────────────────────────────────────

  const handleGeneratePDF = async () => {
    if (!selectedSeasonId || !selectedTeamId) {
      alert("Please select both a season and a team");
      return;
    }

    setGenerating(true);
    try {
      const generateStatsPDF = httpsCallable(functions, "generateStatsPDF");
      const result = await generateStatsPDF({
        teamId: selectedTeamId,
        seasonId: selectedSeasonId,
        uploadToStorage,
      });

      const data = result.data as {
        success: boolean;
        pdf: string;
        fileName: string;
        downloadUrl?: string;
      };

      if (data.success && data.pdf) {
        // Convert base64 to blob and download
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.fileName || "stats-sheet.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          Reports
        </p>
        <h1 className="text-2xl font-semibold text-white">
          Stats Sheet Generator
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Generate college-style PDF stats sheets for teams
        </p>
      </div>

      {/* Selection Form */}
      <div className="bg-black/30 rounded-2xl border border-white/10 p-6 max-w-xl">
        <div className="space-y-4">
          {/* Season Selector */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Season</label>
            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white"
            >
              <option value="">Select Season</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} {season.isActive ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Team Selector */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Team</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white"
            >
              <option value="">Select Team</option>
              <optgroup label="Men's Teams">
                {teams
                  .filter((t) => t.gender === "men")
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Women's Teams">
                {teams
                  .filter((t) => t.gender === "women")
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Upload Option */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="uploadToStorage"
              checked={uploadToStorage}
              onChange={(e) => setUploadToStorage(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-800 border-white/20"
            />
            <label htmlFor="uploadToStorage" className="text-sm text-slate-300">
              Also save to Firebase Storage
            </label>
          </div>
        </div>

        {/* Selected Team Preview */}
        {selectedTeam && (
          <div className="mt-6 p-4 bg-slate-900/50 rounded-xl border border-white/5">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-xl bg-slate-800 overflow-hidden">
                {selectedTeam.logo ? (
                  <Image
                    src={selectedTeam.logo}
                    alt={selectedTeam.name}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🏀
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedTeam.name}
                </h3>
                <p className="text-sm text-slate-400">
                  {seasons.find((s) => s.id === selectedSeasonId)?.name ||
                    "No season selected"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGeneratePDF}
          disabled={generating || !selectedSeasonId || !selectedTeamId}
          className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Generating PDF...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download Stats Sheet (PDF)
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 max-w-xl">
        <div className="flex items-start gap-3">
          <div className="text-blue-400 text-xl">ℹ️</div>
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">About Stats Sheets</p>
            <p className="text-blue-300/80">
              The generated PDF includes a college-style stats table with all
              player statistics for the selected season, including:
            </p>
            <ul className="mt-2 space-y-1 text-blue-300/80 list-disc list-inside">
              <li>Games played and games started</li>
              <li>Field goals, 3-pointers, and free throws (made/attempted/%)</li>
              <li>Offensive, defensive, and total rebounds</li>
              <li>Assists, turnovers, steals, and blocks</li>
              <li>Personal fouls and disqualifications</li>
              <li>Total and average points per game</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
