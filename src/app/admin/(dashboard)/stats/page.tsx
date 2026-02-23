"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useAdmin } from "../layout";
import { firebaseDB } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { logAuditAction } from "@/lib/auditLog";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Game = {
  id: string;
  homeTeamId: string; homeTeamName: string; homeTeamLogo?: string;
  awayTeamId: string; awayTeamName: string; awayTeamLogo?: string;
  date: string; time: string; venue: string; gender: string;
  fibaLiveStatsUrl?: string;
  playerStats?: Array<Record<string, unknown>>;
  completed?: boolean; winnerTeamId?: string; winnerScore?: number; loserScore?: number;
};

type Player = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  jerseyNumber?: string;
  number?: string | number;
  position?: string;
  photoURL?: string;
};

type PlayerStat = {
  playerId: string;
  name: string;
  jerseyNumber?: string;
  dnp: boolean;  // Did Not Play
  points: number;
  minutes: string;  // Format: "MM:SS"
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  foulsDrawn: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  twoPointsMade: number;
  twoPointsAttempted: number;
  threePointsMade: number;
  threePointsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  plusMinus: number;
};

type StatField = Exclude<keyof PlayerStat, "playerId" | "name" | "jerseyNumber" | "dnp">;

type StatColumn = {
  field: StatField;
  label: string;
  readOnly?: boolean;
  isTimeField?: boolean;  // For MM:SS format fields like minutes
};

type ImportedPlayerStat = {
  team: "home" | "away";
  jerseyNumber?: string;
  playerName: string;
  stats: Record<StatField, number>;
};

type NormalizedFibaImport = {
  homeScore: number;
  awayScore: number;
  players: ImportedPlayerStat[];
};

type ResolvedTeamIds = {
  home: string;
  away: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "Game Statistics",
    subtitle: "Collect and manage game stats",
    availableGames: "Available Games",
    readyForStats: "Games ready for stats collection",
    noGames: "No games available",
    gamesNote: "Games appear 45 minutes after start time",
    homeTeam: "Home", awayTeam: "Away",
    collectStats: "Collect", editStats: "Edit",
    selectWinner: "Tap the winning team",
    winner: "WINNER",
    loser: "LOSER",
    finalScore: "Final Score",
    save: "Save Game Stats", cancel: "Cancel",
    done: "Done",
    complete: "Complete",
    points: "PTS", rebounds: "REB", assists: "AST", steals: "STL", blocks: "BLK", fouls: "PF", minutes: "MIN",
    offensiveRebounds: "OREB", defensiveRebounds: "DREB", turnovers: "TOV", foulsDrawn: "FD",
    fieldGoalsMade: "FGM", fieldGoalsAttempted: "FGA", twoPointsMade: "2PM", twoPointsAttempted: "2PA",
    threePointsMade: "3PM", threePointsAttempted: "3PA", freeThrowsMade: "FTM", freeThrowsAttempted: "FTA", plusMinus: "+/-",
    dnp: "DNP",
    playerStats: "Player Statistics",
    loadingPlayers: "Loading players...",
    step1: "1. Select Winner",
    step2: "2. Enter Score",
    step3: "3. Player Stats",
    option1: "Option 1: Auto Pull (FIBA Live Stats)",
    option2: "Option 2: Manual Entry",
    sourceUrl: "Source URL",
    pullNow: "Pull Now",
    pulling: "Pulling...",
    pullSuccess: "Live stats imported. Review and save.",
    pullError: "Unable to import from source.",
    awayScore: "Away Score",
    homeScore: "Home Score",
  },
  fr: {
    title: "Statistiques des Matchs",
    subtitle: "Collecter et gérer les statistiques",
    availableGames: "Matchs Disponibles",
    readyForStats: "Matchs prêts pour la collecte de statistiques",
    noGames: "Aucun match disponible",
    gamesNote: "Les matchs apparaissent 45 minutes après le début",
    homeTeam: "Domicile", awayTeam: "Extérieur",
    collectStats: "Collecter", editStats: "Modifier",
    selectWinner: "Cliquez sur l'équipe gagnante",
    winner: "GAGNANT",
    loser: "PERDANT",
    finalScore: "Score Final",
    save: "Enregistrer", cancel: "Annuler",
    done: "Terminé",
    complete: "Terminé",
    // Column labels matching FIBA stats sheet
    minutes: "MIN",
    fieldGoalsMade: "Tirs R", fieldGoalsAttempted: "Tirs T",  // Tirs Tot. (Réussis/Tentés)
    twoPointsMade: "2PM", twoPointsAttempted: "2PA",          // 2 Points
    threePointsMade: "3PM", threePointsAttempted: "3PA",      // 3 pts
    freeThrowsMade: "LF R", freeThrowsAttempted: "LF T",      // LF (Lancers Francs R/T)
    offensiveRebounds: "RO", defensiveRebounds: "RD", rebounds: "TOT",  // Rebonds
    assists: "PD",        // Passes Décisives
    turnovers: "BP",      // Balles Perdues
    steals: "IN",         // Interceptions
    blocks: "Ctr",        // Contres
    fouls: "F", foulsDrawn: "FP",  // Fautes (F, FP)
    plusMinus: "+/-",
    points: "PTS",
    dnp: "NPJ",  // N'a Pas Joué
    playerStats: "Statistiques Joueurs",
    loadingPlayers: "Chargement des joueurs...",
    step1: "1. Sélectionnez le Gagnant",
    step2: "2. Entrez le Score",
    step3: "3. Stats des Joueurs",
    option1: "Option 1 : Import Auto (FIBA Live Stats)",
    option2: "Option 2 : Saisie Manuelle",
    sourceUrl: "URL source",
    pullNow: "Importer",
    pulling: "Importation...",
    pullSuccess: "Stats importées. Vérifiez puis enregistrez.",
    pullError: "Impossible d'importer depuis la source.",
    awayScore: "Score Visiteur",
    homeScore: "Score Domicile",
  },
};

// Field order: Min | Tirs Tot. | 2 Points | 3 pts | LF | Rebonds | PD | BP | IN | Ctr | Fautes | +/- | PTS
const PLAYER_STAT_FIELDS: StatField[] = [
  "minutes",
  "fieldGoalsMade",
  "fieldGoalsAttempted",
  "twoPointsMade",
  "twoPointsAttempted",
  "threePointsMade",
  "threePointsAttempted",
  "freeThrowsMade",
  "freeThrowsAttempted",
  "offensiveRebounds",
  "defensiveRebounds",
  "rebounds",
  "assists",
  "turnovers",
  "steals",
  "blocks",
  "fouls",
  "foulsDrawn",
  "plusMinus",
  "points",
];

const createEmptyPlayerStat = (player: Player): PlayerStat => ({
  playerId: player.id,
  name: player.name || "Unknown Player",
  jerseyNumber: player.jerseyNumber,
  dnp: false,  // Did Not Play
  points: 0,
  minutes: "",  // Format: "MM:SS"
  rebounds: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  foulsDrawn: 0,
  fieldGoalsMade: 0,
  fieldGoalsAttempted: 0,
  twoPointsMade: 0,
  twoPointsAttempted: 0,
  threePointsMade: 0,
  threePointsAttempted: 0,
  freeThrowsMade: 0,
  freeThrowsAttempted: 0,
  plusMinus: 0,
});

const safeRatio = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : 0);

const safePercent = (made: number, attempted: number) => (attempted > 0 ? (made / attempted) * 100 : 0);

const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

function validateFibaPlayerStat(stat: PlayerStat): { valid: true; calculatedPoints: number } | { valid: false; reason: string } {
  const twoPM = Number(stat.twoPointsMade || 0);
  const twoPA = Number(stat.twoPointsAttempted || 0);
  const threePM = Number(stat.threePointsMade || 0);
  const threePA = Number(stat.threePointsAttempted || 0);
  const ftM = Number(stat.freeThrowsMade || 0);
  const ftA = Number(stat.freeThrowsAttempted || 0);
  const pts = Number(stat.points || 0);
  const fgm = Number(stat.fieldGoalsMade || 0);
  const fga = Number(stat.fieldGoalsAttempted || 0);

  const values = [twoPM, twoPA, threePM, threePA, ftM, ftA, pts, fgm, fga];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return { valid: false, reason: "Negative or invalid values are not allowed." };
  }

  if (twoPM > twoPA) return { valid: false, reason: "2PM cannot exceed 2PA." };
  if (threePM > threePA) return { valid: false, reason: "3PM cannot exceed 3PA." };
  if (ftM > ftA) return { valid: false, reason: "FTM cannot exceed FTA." };

  const calculatedPoints = twoPM * 2 + threePM * 3 + ftM;
  if (pts !== calculatedPoints) {
    return { valid: false, reason: `PTS must equal (2PM×2)+(3PM×3)+FTM. Expected ${calculatedPoints}, got ${pts}.` };
  }

  const expectedFGA = twoPA + threePA;
  if (fga !== expectedFGA) {
    return { valid: false, reason: `FGA must equal 2PA+3PA. Expected ${expectedFGA}, got ${fga}.` };
  }

  const expectedFGM = twoPM + threePM;
  if (fgm !== expectedFGM) {
    return { valid: false, reason: `FGM must equal 2PM+3PM. Expected ${expectedFGM}, got ${fgm}.` };
  }

  return { valid: true, calculatedPoints };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Check if game is 45+ min past start
// ─────────────────────────────────────────────────────────────────────────────

function isGamePast45Min(game: Game): boolean {
  try {
    const gameDateTime = new Date(`${game.date}T${game.time || "00:00"}`);
    const now = new Date();
    const diffMs = now.getTime() - gameDateTime.getTime();
    return diffMs >= 45 * 60 * 1000;
  } catch {
    return false;
  }
}

function normalizeTeamName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePersonName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStoredStatValue(entry: Record<string, unknown>, aliases: string[]): number {
  for (const alias of aliases) {
    if (entry[alias] !== undefined && entry[alias] !== null) {
      const parsed = Number(entry[alias]);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  return 0;
}

export default function StatsPage() {
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];
  // Column order matches FIBA stats sheet: Min | Tirs Tot. | 2 Points | 3 pts | LF | Rebonds | PD | BP | IN | Ctr | Fautes | +/- | PTS
  const statColumns = useMemo<StatColumn[]>(
    () => [
      // Min (MM:SS format)
      { field: "minutes" as const, label: copy.minutes, isTimeField: true },
      // Tirs Tot. (Total Shots = 2PM+3PM / 2PA+3PA) - calculated readOnly
      { field: "fieldGoalsMade" as const, label: copy.fieldGoalsMade, readOnly: true },
      { field: "fieldGoalsAttempted" as const, label: copy.fieldGoalsAttempted, readOnly: true },
      // 2 Points
      { field: "twoPointsMade" as const, label: copy.twoPointsMade },
      { field: "twoPointsAttempted" as const, label: copy.twoPointsAttempted },
      // 3 pts
      { field: "threePointsMade" as const, label: copy.threePointsMade },
      { field: "threePointsAttempted" as const, label: copy.threePointsAttempted },
      // LF (Free Throws / Lancers Francs)
      { field: "freeThrowsMade" as const, label: copy.freeThrowsMade },
      { field: "freeThrowsAttempted" as const, label: copy.freeThrowsAttempted },
      // Rebonds (RO, RD, TOT)
      { field: "offensiveRebounds" as const, label: copy.offensiveRebounds },
      { field: "defensiveRebounds" as const, label: copy.defensiveRebounds },
      { field: "rebounds" as const, label: copy.rebounds, readOnly: true },
      // PD (Assists / Passes Décisives)
      { field: "assists" as const, label: copy.assists },
      // BP (Turnovers / Balles Perdues)
      { field: "turnovers" as const, label: copy.turnovers },
      // IN (Steals / Interceptions)
      { field: "steals" as const, label: copy.steals },
      // Ctr (Blocks / Contres)
      { field: "blocks" as const, label: copy.blocks },
      // Fautes (F, FP)
      { field: "fouls" as const, label: copy.fouls },
      { field: "foulsDrawn" as const, label: copy.foulsDrawn },
      // +/-
      { field: "plusMinus" as const, label: copy.plusMinus },
      // PTS (calculated)
      { field: "points" as const, label: copy.points, readOnly: true },
    ],
    [copy]
  );
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Inline editing state
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Player stats state
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeStats, setHomeStats] = useState<Record<string, PlayerStat>>({});
  const [awayStats, setAwayStats] = useState<Record<string, PlayerStat>>({});
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [resolvedTeamIds, setResolvedTeamIds] = useState<ResolvedTeamIds | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [popupError, setPopupError] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, boolean>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});  // Track which fields have been touched
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showValidationError = useCallback((message: string, cellKey?: string) => {
    setPopupError(message);
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }
    popupTimeoutRef.current = setTimeout(() => {
      setPopupError(null);
    }, 7000);

    if (cellKey) {
      setCellErrors((prev) => ({ ...prev, [cellKey]: true }));
      setTimeout(() => {
        setCellErrors((prev) => {
          const next = { ...prev };
          delete next[cellKey];
          return next;
        });
      }, 7000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  const getCellKey = useCallback((isHome: boolean, playerId: string, field: StatField) => {
    return `${isHome ? "home" : "away"}:${playerId}:${field}`;
  }, []);

  const normalizeDerivedStats = useCallback((stat: PlayerStat): PlayerStat => {
    const twoPointsMade = Math.max(0, Number(stat.twoPointsMade || 0));
    const twoPointsAttempted = Math.max(0, Number(stat.twoPointsAttempted || 0));
    const threePointsMade = Math.max(0, Number(stat.threePointsMade || 0));
    const threePointsAttempted = Math.max(0, Number(stat.threePointsAttempted || 0));
    const freeThrowsMade = Math.max(0, Number(stat.freeThrowsMade || 0));
    const freeThrowsAttempted = Math.max(0, Number(stat.freeThrowsAttempted || 0));
    const offensiveRebounds = Math.max(0, Number(stat.offensiveRebounds || 0));
    const defensiveRebounds = Math.max(0, Number(stat.defensiveRebounds || 0));

    return {
      ...stat,
      twoPointsMade,
      twoPointsAttempted,
      threePointsMade,
      threePointsAttempted,
      freeThrowsMade,
      freeThrowsAttempted,
      fieldGoalsMade: twoPointsMade + threePointsMade,
      fieldGoalsAttempted: twoPointsAttempted + threePointsAttempted,
      points: twoPointsMade * 2 + threePointsMade * 3 + freeThrowsMade,
      offensiveRebounds,
      defensiveRebounds,
      rebounds: offensiveRebounds + defensiveRebounds,
    };
  }, []);

  const statInputValue = useCallback((value: number | string | undefined, isTimeField?: boolean, hasTouched?: boolean): string => {
    if (isTimeField) {
      // For time fields like minutes, return as-is or empty
      return typeof value === 'string' ? value : '';
    }
    const numeric = Number(value ?? 0);
    // Show 0 as "0" if value was explicitly set, otherwise show empty for untouched fields
    if (numeric === 0) {
      return hasTouched ? "0" : "";
    }
    return String(numeric);
  }, []);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const cutoffMs = now.getTime() - 45 * 60 * 1000;
      const snap = await getDocs(query(collection(firebaseDB, "games"), orderBy("date", "desc")));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Game));

      const visibleGames = list.filter((game) => {
        if (game.completed || (game as unknown as { status?: string }).status === "completed" || game.winnerScore !== undefined) {
          return true;
        }

        const gameDateTime = new Date(`${game.date}T${game.time || "00:00"}`);
        return Number.isFinite(gameDateTime.getTime()) && gameDateTime.getTime() <= cutoffMs;
      });

      setGames(visibleGames.slice(0, 80));
    } catch (error) { console.error("Error fetching games:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  // Fetch players for both teams when game is expanded
  const fetchRosters = useCallback(async (game: Game) => {
    setLoadingPlayers(true);
    try {
      const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
      const teams = teamsSnap.docs.map((teamDoc) => {
        const data = teamDoc.data() as { name?: string; city?: string };
        const name = (data.name || "").trim();
        const city = (data.city || "").trim();
        const fullName = city ? `${city} ${name}`.trim() : name;
        return {
          id: teamDoc.id,
          name,
          fullName,
          normalizedName: normalizeTeamName(name),
          normalizedFullName: normalizeTeamName(fullName),
        };
      });

      const resolveTeamId = (teamId: string, teamName: string) => {
        if (teams.some((team) => team.id === teamId)) {
          return teamId;
        }

        const normalized = normalizeTeamName(teamName || "");
        if (!normalized) {
          return teamId;
        }

        const byName = teams.find(
          (team) => team.normalizedName === normalized || team.normalizedFullName === normalized
        );

        return byName?.id || teamId;
      };

      const homeTeamId = resolveTeamId(game.homeTeamId, game.homeTeamName);
      const awayTeamId = resolveTeamId(game.awayTeamId, game.awayTeamName);
      setResolvedTeamIds({ home: homeTeamId, away: awayTeamId });

      const [homeSnap, awaySnap] = await Promise.all([
        getDocs(collection(firebaseDB, `teams/${homeTeamId}/roster`)),
        getDocs(collection(firebaseDB, `teams/${awayTeamId}/roster`)),
      ]);
      
      const mapRosterPlayer = (playerDoc: { id: string; data: () => unknown }): Player => {
        const data = playerDoc.data() as Player;
        const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
        const displayName = (data.name || "").trim() || fullName || "Unknown Player";
        const jersey = data.jerseyNumber || (data.number !== undefined && data.number !== null ? String(data.number) : undefined);

        return {
          id: playerDoc.id,
          name: displayName,
          firstName: data.firstName,
          lastName: data.lastName,
          jerseyNumber: jersey,
          number: data.number,
          position: data.position,
          photoURL: data.photoURL,
        };
      };

      const homeList = homeSnap.docs.map(mapRosterPlayer);
      const awayList = awaySnap.docs.map(mapRosterPlayer);
      
      setHomePlayers(homeList);
      setAwayPlayers(awayList);
      
      // Initialize stats
      const initHomeStats: Record<string, PlayerStat> = {};
      homeList.forEach((p) => {
        initHomeStats[p.id] = createEmptyPlayerStat(p);
      });
      
      const initAwayStats: Record<string, PlayerStat> = {};
      awayList.forEach((p) => {
        initAwayStats[p.id] = createEmptyPlayerStat(p);
      });

      const savedStats = Array.isArray(game.playerStats) ? game.playerStats : [];
      const statAliasMap: Record<StatField, string[]> = {
        points: ["points", "pts"],
        minutes: ["minutes", "min"],
        rebounds: ["rebounds", "reb"],
        offensiveRebounds: ["offensiveRebounds", "oreb"],
        defensiveRebounds: ["defensiveRebounds", "dreb"],
        assists: ["assists", "ast"],
        steals: ["steals", "stl"],
        blocks: ["blocks", "blk"],
        turnovers: ["turnovers", "to"],
        fouls: ["fouls", "pf"],
        foulsDrawn: ["foulsDrawn", "fd"],
        fieldGoalsMade: ["fieldGoalsMade", "fgm"],
        fieldGoalsAttempted: ["fieldGoalsAttempted", "fga"],
        twoPointsMade: ["twoPointsMade", "two_pm"],
        twoPointsAttempted: ["twoPointsAttempted", "two_pa"],
        threePointsMade: ["threePointsMade", "three_pm"],
        threePointsAttempted: ["threePointsAttempted", "three_pa"],
        freeThrowsMade: ["freeThrowsMade", "ft_m"],
        freeThrowsAttempted: ["freeThrowsAttempted", "ft_a"],
        plusMinus: ["plusMinus", "plus_minus"],
      };

      savedStats.forEach((entry) => {
        const statEntry = entry as Record<string, unknown>;
        const savedPlayerId = String(statEntry.playerId || "");
        const savedJersey = String(statEntry.jerseyNumber || statEntry.number || "").trim();
        const savedName = normalizePersonName(String(statEntry.playerName || ""));
        const savedTeamId = String(statEntry.teamId || "");

        const findPlayerByFallback = (players: Player[]) =>
          players.find((player) => {
            const playerJersey = String(player.jerseyNumber || player.number || "").trim();
            if (savedJersey && playerJersey && savedJersey === playerJersey) {
              return true;
            }
            if (savedName && normalizePersonName(player.name || "") === savedName) {
              return true;
            }
            return false;
          });

        let targetPlayerId = savedPlayerId;
        let targetStats: Record<string, PlayerStat> | null = null;

        if (savedTeamId === homeTeamId) {
          targetStats = initHomeStats;
        } else if (savedTeamId === awayTeamId) {
          targetStats = initAwayStats;
        }

        if (!targetStats || !targetPlayerId || !targetStats[targetPlayerId]) {
          const fallbackHome = findPlayerByFallback(homeList);
          if (fallbackHome) {
            targetPlayerId = fallbackHome.id;
            targetStats = initHomeStats;
          } else {
            const fallbackAway = findPlayerByFallback(awayList);
            if (fallbackAway) {
              targetPlayerId = fallbackAway.id;
              targetStats = initAwayStats;
            }
          }
        }

        if (!targetStats || !targetPlayerId || !targetStats[targetPlayerId]) {
          return;
        }

        const updatedStat = { ...targetStats[targetPlayerId] };
        PLAYER_STAT_FIELDS.forEach((field) => {
          if (field === "minutes") {
            // Minutes is stored as string (MM:SS format)
            const rawMinutes = getStoredStatValue(statEntry, statAliasMap[field]);
            updatedStat.minutes = rawMinutes > 0 ? String(Math.floor(rawMinutes)) + ":00" : "";
          } else {
            // Use type assertion for numeric stat fields
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updatedStat as any)[field] = getStoredStatValue(statEntry, statAliasMap[field]);
          }
        });
        targetStats[targetPlayerId] = normalizeDerivedStats(updatedStat);
      });
      
      setHomeStats(initHomeStats);
      setAwayStats(initAwayStats);
    } catch (error) {
      console.error("Error fetching rosters:", error);
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

  const expandGame = useCallback((game: Game) => {
    if (expandedGameId === game.id) {
      setExpandedGameId(null);
      setResolvedTeamIds(null);
      setImportMessage(null);
      return;
    }
    
    setExpandedGameId(game.id);
    setWinnerId(game.winnerTeamId || "");
    setCellErrors({});
    setPopupError(null);
    
    // Set scores based on winner
    if ((game.completed || (game as unknown as { status?: string }).status === "completed") && game.winnerTeamId) {
      if (game.winnerTeamId === game.homeTeamId) {
        setHomeScore(game.winnerScore?.toString() || "");
        setAwayScore(game.loserScore?.toString() || "");
      } else {
        setAwayScore(game.winnerScore?.toString() || "");
        setHomeScore(game.loserScore?.toString() || "");
      }
    } else {
      setAwayScore("");
      setHomeScore("");
    }

    setImportUrl(game.fibaLiveStatsUrl || "");
    setImportMessage(null);
    
    fetchRosters(game);
  }, [expandedGameId, fetchRosters, normalizeDerivedStats]);

  const handleSelectWinner = (teamId: string) => {
    setWinnerId(teamId);
  };

  const updatePlayerStat = (playerId: string, isHome: boolean, field: StatField, rawValue: string, playerName: string, isTimeField?: boolean) => {
    // For time fields (like minutes), keep as string; for others, parse as number
    const value = isTimeField ? rawValue : (rawValue === "" ? 0 : (Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0));

    const applyUpdate = (prev: Record<string, PlayerStat>) => {
      const current = prev[playerId] || createEmptyPlayerStat({ id: playerId, name: playerName });
      let next = { ...current, [field]: value } as PlayerStat;

      const attemptsByMade: Partial<Record<StatField, StatField>> = {
        twoPointsMade: "twoPointsAttempted",
        threePointsMade: "threePointsAttempted",
        freeThrowsMade: "freeThrowsAttempted",
      };
      const madeByAttempts: Partial<Record<StatField, StatField>> = {
        twoPointsAttempted: "twoPointsMade",
        threePointsAttempted: "threePointsMade",
        freeThrowsAttempted: "freeThrowsMade",
      };

      const attemptField = attemptsByMade[field];
      if (attemptField) {
        const attempts = Number(next[attemptField] || 0);
        if (Number(value) > attempts) {
          next[field] = 0 as never;
          showValidationError(`${playerName}: ${field} cannot exceed ${attemptField}.`, getCellKey(isHome, playerId, field));
        }
      }

      const madeField = madeByAttempts[field];
      if (madeField) {
        const makes = Number(next[madeField] || 0);
        if (makes > Number(next[field] || 0)) {
          next[madeField] = 0 as never;
          showValidationError(`${playerName}: ${madeField} cannot exceed ${field}.`, getCellKey(isHome, playerId, madeField));
        }
      }

      next = normalizeDerivedStats(next);
      return {
        ...prev,
        [playerId]: next,
      };
    };

    if (isHome) {
      setHomeStats(applyUpdate);
    } else {
      setAwayStats(applyUpdate);
    }
    
    // Mark field as touched
    const touchKey = `${isHome ? 'home' : 'away'}_${playerId}_${field}`;
    setTouchedFields(prev => ({ ...prev, [touchKey]: true }));
  };

  const togglePlayerDNP = (playerId: string, isHome: boolean) => {
    const applyUpdate = (prev: Record<string, PlayerStat>) => {
      const current = prev[playerId];
      if (!current) return prev;
      return {
        ...prev,
        [playerId]: { ...current, dnp: !current.dnp },
      };
    };

    if (isHome) {
      setHomeStats(applyUpdate);
    } else {
      setAwayStats(applyUpdate);
    }
  };

  const applyImportedStats = useCallback(
    (normalized: NormalizedFibaImport, game: Game) => {
      const nextHomeStats = { ...homeStats };
      const nextAwayStats = { ...awayStats };

      const mapImportedPlayer = (players: Player[], side: "home" | "away", target: Record<string, PlayerStat>) => {
        const sidePlayers = normalized.players.filter((player) => player.team === side);
        sidePlayers.forEach((entry) => {
          const jersey = (entry.jerseyNumber || "").trim();
          const normalizedName = normalizePersonName(entry.playerName || "");

          const matched = players.find((player) => {
            const playerJersey = (player.jerseyNumber || (player.number !== undefined ? String(player.number) : "")).trim();
            if (jersey && playerJersey && jersey === playerJersey) {
              return true;
            }
            return normalizePersonName(player.name || "") === normalizedName;
          });

          if (!matched || !target[matched.id]) {
            return;
          }

          const updated = { ...target[matched.id] };
          PLAYER_STAT_FIELDS.forEach((field) => {
            if (field === "minutes") {
              // Minutes is stored as string (MM:SS format)
              const rawMinutes = Number(entry.stats[field] || 0);
              updated.minutes = rawMinutes > 0 ? String(Math.floor(rawMinutes)) + ":00" : "";
            } else {
              // Use type assertion for numeric stat fields
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (updated as any)[field] = Number(entry.stats[field] || 0);
            }
          });
          target[matched.id] = normalizeDerivedStats(updated);
        });
      };

      mapImportedPlayer(homePlayers, "home", nextHomeStats);
      mapImportedPlayer(awayPlayers, "away", nextAwayStats);

      setHomeStats(nextHomeStats);
      setAwayStats(nextAwayStats);
      setHomeScore(String(normalized.homeScore || 0));
      setAwayScore(String(normalized.awayScore || 0));

      if ((normalized.homeScore || 0) > (normalized.awayScore || 0)) {
        setWinnerId(game.homeTeamId);
      } else if ((normalized.awayScore || 0) > (normalized.homeScore || 0)) {
        setWinnerId(game.awayTeamId);
      }
    },
    [homePlayers, awayPlayers, homeStats, awayStats, normalizeDerivedStats]
  );

  const handlePullFibaStats = useCallback(async () => {
    const game = games.find((g) => g.id === expandedGameId);
    const sourceUrl = importUrl.trim() || game?.fibaLiveStatsUrl || "";

    if (!game || !sourceUrl) {
      setImportMessage({ type: "error", text: copy.pullError });
      return;
    }

    setImporting(true);
    setImportMessage(null);

    try {
      const response = await fetch("/api/stats/fiba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });

      const data = (await response.json()) as { normalized?: NormalizedFibaImport; error?: string };
      if (!response.ok || !data.normalized) {
        throw new Error(data.error || "Import failed");
      }

      applyImportedStats(data.normalized, game);
      setImportMessage({ type: "success", text: copy.pullSuccess });
      setImportUrl(sourceUrl);
    } catch (error) {
      console.error("FIBA import error:", error);
      setImportMessage({ type: "error", text: copy.pullError });
    } finally {
      setImporting(false);
    }
  }, [expandedGameId, games, importUrl, copy.pullError, copy.pullSuccess, applyImportedStats]);

  const buildStoredPlayerStat = useCallback((stat: PlayerStat, teamId: string, teamName: string, gameId: string) => {
    const fieldGoalsMade = stat.fieldGoalsMade || stat.twoPointsMade + stat.threePointsMade;
    const fieldGoalsAttempted = stat.fieldGoalsAttempted || stat.twoPointsAttempted + stat.threePointsAttempted;
    const rebounds = stat.rebounds || stat.offensiveRebounds + stat.defensiveRebounds;
    const missedFieldGoals = Math.max(fieldGoalsAttempted - fieldGoalsMade, 0);
    const missedFreeThrows = Math.max(stat.freeThrowsAttempted - stat.freeThrowsMade, 0);
    const efficiency =
      stat.points +
      rebounds +
      stat.assists +
      stat.steals +
      stat.blocks -
      missedFieldGoals -
      missedFreeThrows -
      stat.turnovers;

    return {
      playerId: stat.playerId,
      playerName: stat.name,
      teamId,
      teamName,
      gameId,
      number: Number(stat.jerseyNumber || 0),
      jerseyNumber: Number(stat.jerseyNumber || 0),
      points: stat.points,
      pts: stat.points,
      minutes: stat.minutes,
      min: stat.minutes,
      rebounds,
      reb: rebounds,
      offensiveRebounds: stat.offensiveRebounds,
      oreb: stat.offensiveRebounds,
      defensiveRebounds: stat.defensiveRebounds,
      dreb: stat.defensiveRebounds,
      assists: stat.assists,
      ast: stat.assists,
      steals: stat.steals,
      stl: stat.steals,
      blocks: stat.blocks,
      blk: stat.blocks,
      turnovers: stat.turnovers,
      to: stat.turnovers,
      fouls: stat.fouls,
      pf: stat.fouls,
      foulsDrawn: stat.foulsDrawn,
      fd: stat.foulsDrawn,
      fieldGoalsMade,
      fgm: fieldGoalsMade,
      fieldGoalsAttempted,
      fga: fieldGoalsAttempted,
      fieldGoalsPct: roundOneDecimal(safePercent(fieldGoalsMade, fieldGoalsAttempted)),
      fg_pct: roundOneDecimal(safePercent(fieldGoalsMade, fieldGoalsAttempted)),
      twoPointsMade: stat.twoPointsMade,
      two_pm: stat.twoPointsMade,
      twoPointsAttempted: stat.twoPointsAttempted,
      two_pa: stat.twoPointsAttempted,
      twoPointsPct: roundOneDecimal(safePercent(stat.twoPointsMade, stat.twoPointsAttempted)),
      two_pct: roundOneDecimal(safePercent(stat.twoPointsMade, stat.twoPointsAttempted)),
      threePointsMade: stat.threePointsMade,
      three_pm: stat.threePointsMade,
      threePointsAttempted: stat.threePointsAttempted,
      three_pa: stat.threePointsAttempted,
      threePointsPct: roundOneDecimal(safePercent(stat.threePointsMade, stat.threePointsAttempted)),
      three_pct: roundOneDecimal(safePercent(stat.threePointsMade, stat.threePointsAttempted)),
      freeThrowsMade: stat.freeThrowsMade,
      ft_m: stat.freeThrowsMade,
      freeThrowsAttempted: stat.freeThrowsAttempted,
      ft_a: stat.freeThrowsAttempted,
      freeThrowsPct: roundOneDecimal(safePercent(stat.freeThrowsMade, stat.freeThrowsAttempted)),
      ft_pct: roundOneDecimal(safePercent(stat.freeThrowsMade, stat.freeThrowsAttempted)),
      plusMinus: stat.plusMinus,
      plus_minus: stat.plusMinus,
      efficiency,
      eff: efficiency,
      astToTurnoverRatio: roundOneDecimal(safeRatio(stat.assists, stat.turnovers)),
      ast_to_ratio: roundOneDecimal(safeRatio(stat.assists, stat.turnovers)),
    };
  }, []);

  const recalculateTeamRosterStats = useCallback(async (teamId: string) => {
    const rosterSnap = await getDocs(collection(firebaseDB, `teams/${teamId}/roster`));
    const gamesSnap = await getDocs(collection(firebaseDB, "games"));

    const playerTotals = new Map<string, {
      games: number;
      points: number;
      minutes: number;
      rebounds: number;
      assists: number;
      steals: number;
      blocks: number;
      turnovers: number;
      fouls: number;
      foulsDrawn: number;
      offensiveRebounds: number;
      defensiveRebounds: number;
      fieldGoalsMade: number;
      fieldGoalsAttempted: number;
      twoPointsMade: number;
      twoPointsAttempted: number;
      threePointsMade: number;
      threePointsAttempted: number;
      freeThrowsMade: number;
      freeThrowsAttempted: number;
      plusMinus: number;
      efficiency: number;
    }>();

    const teamStats: Record<string, unknown>[] = [];
    gamesSnap.docs.forEach((gameDoc) => {
      const gameData = gameDoc.data() as Record<string, unknown>;
      const playerStats = Array.isArray(gameData.playerStats)
        ? (gameData.playerStats as Record<string, unknown>[])
        : [];

      playerStats.forEach((entry) => {
        if (String(entry.teamId || "") === teamId) {
          teamStats.push(entry);
        }
      });
    });

    teamStats.forEach((stat) => {
      const playerId = String(stat.playerId || "");
      if (!playerId) return;

      const current = playerTotals.get(playerId) || {
        games: 0,
        points: 0,
        minutes: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        foulsDrawn: 0,
        offensiveRebounds: 0,
        defensiveRebounds: 0,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        twoPointsMade: 0,
        twoPointsAttempted: 0,
        threePointsMade: 0,
        threePointsAttempted: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        plusMinus: 0,
        efficiency: 0,
      };

      const points = Number(stat.pts ?? stat.points ?? 0);
      const minutes = Number(stat.min ?? stat.minutes ?? 0);
      const offensiveRebounds = Number(stat.oreb ?? stat.offensiveRebounds ?? 0);
      const defensiveRebounds = Number(stat.dreb ?? stat.defensiveRebounds ?? 0);
      const rebounds = Number(stat.reb ?? stat.rebounds ?? (offensiveRebounds + defensiveRebounds));
      const assists = Number(stat.ast ?? stat.assists ?? 0);
      const steals = Number(stat.stl ?? stat.steals ?? 0);
      const blocks = Number(stat.blk ?? stat.blocks ?? 0);
      const turnovers = Number(stat.to ?? stat.turnovers ?? 0);
      const fouls = Number(stat.pf ?? stat.fouls ?? 0);
      const foulsDrawn = Number(stat.fd ?? stat.foulsDrawn ?? 0);
      const fieldGoalsMade = Number(stat.fgm ?? stat.fieldGoalsMade ?? ((Number(stat.two_pm || 0) + Number(stat.three_pm || 0))));
      const fieldGoalsAttempted = Number(stat.fga ?? stat.fieldGoalsAttempted ?? ((Number(stat.two_pa || 0) + Number(stat.three_pa || 0))));
      const twoPointsMade = Number(stat.two_pm ?? stat.twoPointsMade ?? 0);
      const twoPointsAttempted = Number(stat.two_pa ?? stat.twoPointsAttempted ?? 0);
      const threePointsMade = Number(stat.three_pm ?? stat.threePointsMade ?? 0);
      const threePointsAttempted = Number(stat.three_pa ?? stat.threePointsAttempted ?? 0);
      const freeThrowsMade = Number(stat.ft_m ?? stat.freeThrowsMade ?? 0);
      const freeThrowsAttempted = Number(stat.ft_a ?? stat.freeThrowsAttempted ?? 0);
      const plusMinus = Number(stat.plus_minus ?? stat.plusMinus ?? 0);
      const efficiency = Number(
        stat.eff ??
          stat.efficiency ??
          points + rebounds + assists + steals + blocks -
            Math.max(fieldGoalsAttempted - fieldGoalsMade, 0) -
            Math.max(freeThrowsAttempted - freeThrowsMade, 0) -
            turnovers
      );

      playerTotals.set(playerId, {
        games: current.games + 1,
        points: current.points + points,
        minutes: current.minutes + minutes,
        rebounds: current.rebounds + rebounds,
        assists: current.assists + assists,
        steals: current.steals + steals,
        blocks: current.blocks + blocks,
        turnovers: current.turnovers + turnovers,
        fouls: current.fouls + fouls,
        foulsDrawn: current.foulsDrawn + foulsDrawn,
        offensiveRebounds: current.offensiveRebounds + offensiveRebounds,
        defensiveRebounds: current.defensiveRebounds + defensiveRebounds,
        fieldGoalsMade: current.fieldGoalsMade + fieldGoalsMade,
        fieldGoalsAttempted: current.fieldGoalsAttempted + fieldGoalsAttempted,
        twoPointsMade: current.twoPointsMade + twoPointsMade,
        twoPointsAttempted: current.twoPointsAttempted + twoPointsAttempted,
        threePointsMade: current.threePointsMade + threePointsMade,
        threePointsAttempted: current.threePointsAttempted + threePointsAttempted,
        freeThrowsMade: current.freeThrowsMade + freeThrowsMade,
        freeThrowsAttempted: current.freeThrowsAttempted + freeThrowsAttempted,
        plusMinus: current.plusMinus + plusMinus,
        efficiency: current.efficiency + efficiency,
      });
    });

    const batch = writeBatch(firebaseDB);

    rosterSnap.docs.forEach((playerDoc) => {
      const totals = playerTotals.get(playerDoc.id);
      const gamesPlayed = totals?.games || 0;

      const averages = {
        pts: roundOneDecimal(safeRatio(totals?.points || 0, gamesPlayed)).toFixed(1),
        min: roundOneDecimal(safeRatio(totals?.minutes || 0, gamesPlayed)).toFixed(1),
        reb: roundOneDecimal(safeRatio(totals?.rebounds || 0, gamesPlayed)).toFixed(1),
        ast: roundOneDecimal(safeRatio(totals?.assists || 0, gamesPlayed)).toFixed(1),
        stl: roundOneDecimal(safeRatio(totals?.steals || 0, gamesPlayed)).toFixed(1),
        blk: roundOneDecimal(safeRatio(totals?.blocks || 0, gamesPlayed)).toFixed(1),
        oreb: roundOneDecimal(safeRatio(totals?.offensiveRebounds || 0, gamesPlayed)).toFixed(1),
        dreb: roundOneDecimal(safeRatio(totals?.defensiveRebounds || 0, gamesPlayed)).toFixed(1),
        to: roundOneDecimal(safeRatio(totals?.turnovers || 0, gamesPlayed)).toFixed(1),
        pf: roundOneDecimal(safeRatio(totals?.fouls || 0, gamesPlayed)).toFixed(1),
        fd: roundOneDecimal(safeRatio(totals?.foulsDrawn || 0, gamesPlayed)).toFixed(1),
        fgm: roundOneDecimal(safeRatio(totals?.fieldGoalsMade || 0, gamesPlayed)).toFixed(1),
        fga: roundOneDecimal(safeRatio(totals?.fieldGoalsAttempted || 0, gamesPlayed)).toFixed(1),
        two_pm: roundOneDecimal(safeRatio(totals?.twoPointsMade || 0, gamesPlayed)).toFixed(1),
        two_pa: roundOneDecimal(safeRatio(totals?.twoPointsAttempted || 0, gamesPlayed)).toFixed(1),
        three_pm: roundOneDecimal(safeRatio(totals?.threePointsMade || 0, gamesPlayed)).toFixed(1),
        three_pa: roundOneDecimal(safeRatio(totals?.threePointsAttempted || 0, gamesPlayed)).toFixed(1),
        ft_m: roundOneDecimal(safeRatio(totals?.freeThrowsMade || 0, gamesPlayed)).toFixed(1),
        ft_a: roundOneDecimal(safeRatio(totals?.freeThrowsAttempted || 0, gamesPlayed)).toFixed(1),
        plus_minus: roundOneDecimal(safeRatio(totals?.plusMinus || 0, gamesPlayed)).toFixed(1),
        fgPct: roundOneDecimal(safePercent(totals?.fieldGoalsMade || 0, totals?.fieldGoalsAttempted || 0)).toFixed(1),
        twoPct: roundOneDecimal(safePercent(totals?.twoPointsMade || 0, totals?.twoPointsAttempted || 0)).toFixed(1),
        threePct: roundOneDecimal(safePercent(totals?.threePointsMade || 0, totals?.threePointsAttempted || 0)).toFixed(1),
        ftPct: roundOneDecimal(safePercent(totals?.freeThrowsMade || 0, totals?.freeThrowsAttempted || 0)).toFixed(1),
        eff: roundOneDecimal(safeRatio(totals?.efficiency || 0, gamesPlayed)).toFixed(1),
        astToTurnoverRatio: roundOneDecimal(safeRatio(totals?.assists || 0, totals?.turnovers || 0)).toFixed(1),
      };

      batch.update(playerDoc.ref, {
        gamesPlayed,
        stats: {
          pts: averages.pts,
          reb: averages.reb,
          ast: averages.ast,
          stl: averages.stl,
          blk: averages.blk,
          min: averages.min,
          oreb: averages.oreb,
          dreb: averages.dreb,
          to: averages.to,
          pf: averages.pf,
          fd: averages.fd,
          fgm: averages.fgm,
          fga: averages.fga,
          fgPct: averages.fgPct,
          two_pm: averages.two_pm,
          two_pa: averages.two_pa,
          twoPct: averages.twoPct,
          three_pm: averages.three_pm,
          three_pa: averages.three_pa,
          threePct: averages.threePct,
          ft_m: averages.ft_m,
          ft_a: averages.ft_a,
          ftPct: averages.ftPct,
          eff: averages.eff,
          plus_minus: averages.plus_minus,
          astToTurnoverRatio: averages.astToTurnoverRatio,
        },
        statsTotals: {
          pts: totals?.points || 0,
          min: totals?.minutes || 0,
          reb: totals?.rebounds || 0,
          oreb: totals?.offensiveRebounds || 0,
          dreb: totals?.defensiveRebounds || 0,
          ast: totals?.assists || 0,
          stl: totals?.steals || 0,
          blk: totals?.blocks || 0,
          to: totals?.turnovers || 0,
          pf: totals?.fouls || 0,
          fd: totals?.foulsDrawn || 0,
          fgm: totals?.fieldGoalsMade || 0,
          fga: totals?.fieldGoalsAttempted || 0,
          two_pm: totals?.twoPointsMade || 0,
          two_pa: totals?.twoPointsAttempted || 0,
          three_pm: totals?.threePointsMade || 0,
          three_pa: totals?.threePointsAttempted || 0,
          ft_m: totals?.freeThrowsMade || 0,
          ft_a: totals?.freeThrowsAttempted || 0,
          plus_minus: totals?.plusMinus || 0,
          eff: totals?.efficiency || 0,
        },
        statsUpdatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }, []);

  const recalculateTeamRecords = useCallback(async (teamIds: string[]) => {
    const uniqueTeamIds = Array.from(new Set(teamIds.filter(Boolean)));
    if (uniqueTeamIds.length === 0) return;

    const records = new Map<string, { wins: number; losses: number }>();
    uniqueTeamIds.forEach((teamId) => {
      records.set(teamId, { wins: 0, losses: 0 });
    });

    const gamesSnap = await getDocs(collection(firebaseDB, "games"));
    gamesSnap.docs.forEach((gameDoc) => {
      const gameData = gameDoc.data() as Record<string, unknown>;
      const homeTeamId = String(gameData.homeTeamId || "");
      const awayTeamId = String(gameData.awayTeamId || "");
      if (!homeTeamId || !awayTeamId) return;

      const homeScore = Number(gameData.homeScore);
      const awayScore = Number(gameData.awayScore);
      const hasValidScores = Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore !== awayScore;

      const explicitWinnerId = String(gameData.winnerTeamId || gameData.winnerId || "");
      const winnerId =
        explicitWinnerId ||
        (hasValidScores ? (homeScore > awayScore ? homeTeamId : awayTeamId) : "");

      const isCompleted =
        gameData.completed === true ||
        gameData.status === "completed" ||
        Boolean(winnerId);

      if (!isCompleted || !winnerId) return;

      [homeTeamId, awayTeamId].forEach((teamId) => {
        const record = records.get(teamId);
        if (!record) return;
        if (teamId === winnerId) {
          record.wins += 1;
        } else {
          record.losses += 1;
        }
      });
    });

    await Promise.all(
      uniqueTeamIds.map((teamId) => {
        const record = records.get(teamId) || { wins: 0, losses: 0 };
        return updateDoc(doc(firebaseDB, "teams", teamId), {
          wins: record.wins,
          losses: record.losses,
          updatedAt: serverTimestamp(),
        });
      })
    );
  }, []);

  const saveGameStats = async () => {
    const game = games.find((g) => g.id === expandedGameId);
    if (!game || !winnerId || !awayScore || !homeScore) return;

    const parsedHomeScore = Number(homeScore);
    const parsedAwayScore = Number(awayScore);
    if (!Number.isFinite(parsedHomeScore) || !Number.isFinite(parsedAwayScore) || parsedHomeScore < 0 || parsedAwayScore < 0) {
      setImportMessage({ type: "error", text: "Scores must be valid non-negative numbers." });
      return;
    }
    if (parsedHomeScore === parsedAwayScore) {
      setImportMessage({ type: "error", text: "Tie games are not allowed. Winner score must be higher." });
      return;
    }
    const winnerMustBeHome = parsedHomeScore > parsedAwayScore;
    const expectedWinnerId = winnerMustBeHome ? game.homeTeamId : game.awayTeamId;
    if (winnerId !== expectedWinnerId) {
      setImportMessage({ type: "error", text: "Winner selection must match final score." });
      return;
    }

    const homeInvalid = Object.values(homeStats)
      .map((stat) => ({ stat, validation: validateFibaPlayerStat(stat) }))
      .find((entry) => !entry.validation.valid);
    if (homeInvalid && !homeInvalid.validation.valid) {
      setImportMessage({
        type: "error",
        text: `${homeInvalid.stat.name}: ${homeInvalid.validation.reason}`,
      });
      return;
    }

    const awayInvalid = Object.values(awayStats)
      .map((stat) => ({ stat, validation: validateFibaPlayerStat(stat) }))
      .find((entry) => !entry.validation.valid);
    if (awayInvalid && !awayInvalid.validation.valid) {
      setImportMessage({
        type: "error",
        text: `${awayInvalid.stat.name}: ${awayInvalid.validation.reason}`,
      });
      return;
    }
    
    setSaving(true);
    try {
      setImportMessage(null);
      const homeTeamId = resolvedTeamIds?.home || game.homeTeamId;
      const awayTeamId = resolvedTeamIds?.away || game.awayTeamId;
      const resolvedWinnerId = winnerId === game.homeTeamId ? homeTeamId : winnerId === game.awayTeamId ? awayTeamId : winnerId;
      const loserId = resolvedWinnerId === homeTeamId ? awayTeamId : homeTeamId;
      const winnerName = winnerId === game.homeTeamId ? game.homeTeamName : game.awayTeamName;
      const loserName = winnerId === game.homeTeamId ? game.awayTeamName : game.homeTeamName;
      const winScore = winnerId === game.homeTeamId ? parsedHomeScore : parsedAwayScore;
      const loseScore = winnerId === game.homeTeamId ? parsedAwayScore : parsedHomeScore;
      const homeTeamPlayerStats = Object.values(homeStats).map((stat) => buildStoredPlayerStat(stat, homeTeamId, game.homeTeamName, game.id));
      const awayTeamPlayerStats = Object.values(awayStats).map((stat) => buildStoredPlayerStat(stat, awayTeamId, game.awayTeamName, game.id));
      const combinedPlayerStats = [...homeTeamPlayerStats, ...awayTeamPlayerStats];
      
      const batch = writeBatch(firebaseDB);
      
      // Update game document
      const gameRef = doc(firebaseDB, "games", game.id);
      batch.update(gameRef, {
        status: "completed",
        completed: true,
        winnerId: resolvedWinnerId,
        winnerTeamId: resolvedWinnerId,
        loserTeamId: loserId,
        winnerScore: winScore,
        loserScore: loseScore,
        homeScore: parsedHomeScore,
        awayScore: parsedAwayScore,
        completedAt: serverTimestamp(),
        playerStats: combinedPlayerStats,
        updatedAt: serverTimestamp(),
      });
      
      // Save player stats for home team
      homeTeamPlayerStats.forEach((stat) => {
        const statRef = doc(firebaseDB, `games/${game.id}/playerStats`, stat.playerId);
        batch.set(statRef, {
          ...stat,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      
      // Save player stats for away team
      awayTeamPlayerStats.forEach((stat) => {
        const statRef = doc(firebaseDB, `games/${game.id}/playerStats`, stat.playerId);
        batch.set(statRef, {
          ...stat,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      
      await batch.commit();
      await Promise.all([
        recalculateTeamRosterStats(homeTeamId),
        recalculateTeamRosterStats(awayTeamId),
        recalculateTeamRecords([homeTeamId, awayTeamId]),
      ]);
      
      await logAuditAction(
        "game_stats_recorded",
        currentAdminUser?.id || "unknown",
        currentAdminUser?.email || "unknown",
        "game",
        game.id,
        `${game.awayTeamName} vs ${game.homeTeamName}`,
        {
          winnerTeam: winnerName,
          loserTeam: loserName,
          score: `${winScore}-${loseScore}`,
          gameDate: game.date,
          venue: game.venue,
          playerStatsCount: combinedPlayerStats.length,
        }
      );
      
      setExpandedGameId(null);
      setResolvedTeamIds(null);
      fetchGames();
    } catch (error) {
      console.error("Error saving game stats:", error);
    } finally {
      setSaving(false);
    }
  };

  const canManageStats = currentAdminUser?.permissions?.canManageGames;

  // Memoize expanded game
  const expandedGame = useMemo(() => games.find((g) => g.id === expandedGameId), [games, expandedGameId]);

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <div className="space-y-6">
      {popupError && (
        <div className="fixed right-4 top-4 z-[100] max-w-md rounded-xl border border-red-500/60 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-2xl">
          {popupError}
        </div>
      )}
      <div><h1 className="text-2xl font-bold text-white">{copy.title}</h1><p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p></div>

      {/* Available Games */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-white">{copy.availableGames}</h2><p className="text-xs text-slate-400">{copy.readyForStats}</p></div>
          <div className="rounded-xl bg-emerald-500/10 px-4 py-2 border border-emerald-500/30"><span className="text-lg font-bold text-emerald-300">{games.length}</span><span className="text-xs text-slate-400 ml-1">games</span></div>
        </div>

        {games.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-16 text-center">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-base font-semibold text-slate-300">{copy.noGames}</p>
            <p className="text-sm text-slate-500 mt-2">{copy.gamesNote}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => {
              const isExpanded = expandedGameId === game.id;
              const isDone = game.completed && isGamePast45Min(game);
              
              return (
                <div key={game.id} className={`rounded-2xl border overflow-hidden transition-all ${
                  isDone
                    ? "border-emerald-500/50 bg-emerald-900/20"
                    : isExpanded
                    ? "border-orange-500/50 bg-slate-900/80"
                    : game.completed
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-blue-500/30 bg-blue-500/5"
                }`}>
                  {/* Game Header - Clickable */}
                  <button
                    type="button"
                    onClick={() => canManageStats && expandGame(game)}
                    disabled={!canManageStats}
                    className="w-full text-left p-5 hover:bg-white/5 transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-4">
                      {/* Away Team */}
                      <div className="flex-1 flex items-center gap-3">
                        {game.awayTeamLogo && (
                          <Image src={game.awayTeamLogo} alt={game.awayTeamName} width={48} height={48} className="rounded-xl ring-2 ring-white/10" unoptimized />
                        )}
                        <div>
                          <div className="font-bold text-white">{game.awayTeamName}</div>
                          <div className="text-xs text-slate-400">{copy.awayTeam}</div>
                        </div>
                      </div>

                      {/* Score / VS */}
                      {isDone ? (
                        <div className="flex flex-col items-center px-6">
                          <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">{copy.done}</div>
                          <div className="flex items-center gap-3">
                            <span className={`text-3xl font-black ${game.winnerTeamId === game.awayTeamId ? "text-emerald-400" : "text-slate-500"}`}>
                              {game.winnerTeamId === game.awayTeamId ? game.winnerScore : game.loserScore}
                            </span>
                            <span className="text-lg text-slate-600">-</span>
                            <span className={`text-3xl font-black ${game.winnerTeamId === game.homeTeamId ? "text-emerald-400" : "text-slate-500"}`}>
                              {game.winnerTeamId === game.homeTeamId ? game.winnerScore : game.loserScore}
                            </span>
                          </div>
                        </div>
                      ) : game.completed ? (
                        <div className="flex items-center gap-2 px-4">
                          <span className={`text-2xl font-black ${game.winnerTeamId === game.awayTeamId ? "text-emerald-400" : "text-slate-500"}`}>
                            {game.winnerTeamId === game.awayTeamId ? game.winnerScore : game.loserScore}
                          </span>
                          <span className="text-lg text-slate-600">-</span>
                          <span className={`text-2xl font-black ${game.winnerTeamId === game.homeTeamId ? "text-emerald-400" : "text-slate-500"}`}>
                            {game.winnerTeamId === game.homeTeamId ? game.winnerScore : game.loserScore}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-slate-500 px-6">VS</div>
                      )}

                      {/* Home Team */}
                      <div className="flex-1 flex items-center gap-3 flex-row-reverse">
                        {game.homeTeamLogo && (
                          <Image src={game.homeTeamLogo} alt={game.homeTeamName} width={48} height={48} className="rounded-xl ring-2 ring-white/10" unoptimized />
                        )}
                        <div className="text-right">
                          <div className="font-bold text-white">{game.homeTeamName}</div>
                          <div className="text-xs text-slate-400">{copy.homeTeam}</div>
                        </div>
                      </div>

                      {/* Date/Venue and Button */}
                      <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">{game.date} • {game.time}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[150px]">{game.venue}</div>
                        </div>
                        <div className={`rounded-xl px-4 py-2 font-bold text-sm ${
                          isDone
                            ? "bg-emerald-500/30 text-emerald-300"
                            : isExpanded
                            ? "bg-orange-500/20 text-orange-300"
                            : game.completed
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}>
                          {isDone ? copy.done : isExpanded ? "▲" : game.completed ? copy.editStats : copy.collectStats}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Inline Stats Collection */}
                  {isExpanded && expandedGame && (
                    <div className="border-t border-white/10 bg-slate-900/60">
                      <div className="p-6 border-b border-white/10 space-y-3">
                        <h3 className="text-sm font-bold text-orange-400">{copy.option1}</h3>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            type="url"
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            placeholder="https://..."
                            title={copy.sourceUrl}
                            className="flex-1 px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-sm"
                          />
                          <button
                            type="button"
                            onClick={handlePullFibaStats}
                            disabled={importing}
                            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50"
                          >
                            {importing ? copy.pulling : copy.pullNow}
                          </button>
                        </div>
                        {importMessage && (
                          <p className={`text-xs ${importMessage.type === "success" ? "text-emerald-300" : "text-red-300"}`}>
                            {importMessage.text}
                          </p>
                        )}
                      </div>

                      {/* Step 1: Select Winner */}
                      <div className="p-6 border-b border-white/10">
                        <h3 className="text-sm font-bold text-orange-400 mb-2">{copy.option2}</h3>
                        <h3 className="text-sm font-bold text-orange-400 mb-3">{copy.step1}</h3>
                        <p className="text-xs text-slate-400 mb-4">{copy.selectWinner}</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                          {/* Away Team Button */}
                          <button
                            type="button"
                            onClick={() => handleSelectWinner(expandedGame.awayTeamId)}
                            className={`p-3 rounded-xl border-2 transition-all ${
                              winnerId === expandedGame.awayTeamId
                                ? "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/50"
                                : "border-white/20 bg-slate-800/40 hover:border-white/40 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {expandedGame.awayTeamLogo ? (
                                <Image src={expandedGame.awayTeamLogo} alt={expandedGame.awayTeamName} width={40} height={40} className="rounded-lg ring-1 ring-white/20" unoptimized />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-slate-700" />
                              )}
                              <div className="min-w-0 text-left">
                                <div className="truncate text-white font-semibold">{expandedGame.awayTeamName}</div>
                                <div className="text-xs text-slate-400">{copy.awayTeam}</div>
                              </div>
                              {winnerId === expandedGame.awayTeamId && (
                                <div className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {copy.winner}
                                </div>
                              )}
                            </div>
                          </button>

                          {/* Home Team Button */}
                          <button
                            type="button"
                            onClick={() => handleSelectWinner(expandedGame.homeTeamId)}
                            className={`p-3 rounded-xl border-2 transition-all ${
                              winnerId === expandedGame.homeTeamId
                                ? "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/50"
                                : "border-white/20 bg-slate-800/40 hover:border-white/40 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {expandedGame.homeTeamLogo ? (
                                <Image src={expandedGame.homeTeamLogo} alt={expandedGame.homeTeamName} width={40} height={40} className="rounded-lg ring-1 ring-white/20" unoptimized />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-slate-700" />
                              )}
                              <div className="min-w-0 text-left">
                                <div className="truncate text-white font-semibold">{expandedGame.homeTeamName}</div>
                                <div className="text-xs text-slate-400">{copy.homeTeam}</div>
                              </div>
                              {winnerId === expandedGame.homeTeamId && (
                                <div className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {copy.winner}
                                </div>
                              )}
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Step 2: Enter Score */}
                      {winnerId && (
                        <div className="p-6 border-b border-white/10">
                          <h3 className="text-sm font-bold text-orange-400 mb-4">{copy.step2}</h3>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="text-center">
                              <label className="text-xs text-slate-400 block mb-2">{expandedGame.awayTeamName}</label>
                              <input
                                type="number"
                                min="0"
                                value={awayScore}
                                onChange={(e) => setAwayScore(e.target.value)}
                                placeholder="0"
                                className={`w-full px-4 py-4 bg-slate-800 border-2 rounded-xl text-white text-3xl text-center font-black ${
                                  winnerId === expandedGame.awayTeamId
                                    ? "border-emerald-500/50"
                                    : "border-red-500/30"
                                }`}
                              />
                            </div>
                            <div className="text-center">
                              <label className="text-xs text-slate-400 block mb-2">{expandedGame.homeTeamName}</label>
                              <input
                                type="number"
                                min="0"
                                value={homeScore}
                                onChange={(e) => setHomeScore(e.target.value)}
                                placeholder="0"
                                className={`w-full px-4 py-4 bg-slate-800 border-2 rounded-xl text-white text-3xl text-center font-black ${
                                  winnerId === expandedGame.homeTeamId
                                    ? "border-emerald-500/50"
                                    : "border-red-500/30"
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Player Stats */}
                      {winnerId && awayScore && homeScore && (
                        <div className="p-6 border-b border-white/10">
                          <h3 className="text-sm font-bold text-orange-400 mb-4">{copy.step3}</h3>
                          
                          {loadingPlayers ? (
                            <div className="text-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto mb-2"></div>
                              <p className="text-xs text-slate-400">{copy.loadingPlayers}</p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {/* Away Team Players */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  {expandedGame.awayTeamLogo && (
                                    <Image src={expandedGame.awayTeamLogo} alt="" width={24} height={24} className="rounded" unoptimized />
                                  )}
                                  <h4 className="font-semibold text-white">{expandedGame.awayTeamName}</h4>
                                  <span className="text-xs text-slate-400">({awayPlayers.length} players)</span>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-white/10">
                                        <th className="text-left p-3">#</th>
                                        <th className="text-left p-3">Player</th>
                                        <th className="text-center p-2 w-12">{copy.dnp}</th>
                                        {statColumns.map((column) => (
                                          <th key={column.field} className="text-center p-2 w-14">{column.label}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {awayPlayers.map((player) => {
                                        const playerStat = awayStats[player.id];
                                        const isDNP = playerStat?.dnp || false;
                                        return (
                                        <tr key={player.id} className={`border-b border-white/5 hover:bg-white/5 ${isDNP ? 'opacity-50' : ''}`}>
                                          <td className="p-3 text-slate-400 font-mono">{player.jerseyNumber || "-"}</td>
                                          <td className="p-3 text-white font-medium">{player.name}</td>
                                          <td className="p-1 text-center">
                                            <button
                                              type="button"
                                              onClick={() => togglePlayerDNP(player.id, false)}
                                              className={`w-8 h-8 rounded text-xs font-bold transition-colors ${isDNP ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                              title={isDNP ? "Click to mark as played" : "Click to mark as DNP"}
                                            >
                                              {isDNP ? '✓' : '—'}
                                            </button>
                                          </td>
                                          {statColumns.map((column) => (
                                            <td key={column.field} className="p-1">
                                              {(() => {
                                                const cellKey = getCellKey(false, player.id, column.field);
                                                const touchKey = `away_${player.id}_${column.field}`;
                                                const hasError = Boolean(cellErrors[cellKey]);
                                                const hasTouched = Boolean(touchedFields[touchKey]);
                                                const maxValue = column.field === "twoPointsMade"
                                                  ? Number(playerStat?.twoPointsAttempted || 0)
                                                  : column.field === "threePointsMade"
                                                  ? Number(playerStat?.threePointsAttempted || 0)
                                                  : column.field === "freeThrowsMade"
                                                  ? Number(playerStat?.freeThrowsAttempted || 0)
                                                  : undefined;

                                                return (
                                              <input
                                                type={column.isTimeField ? "text" : "number"}
                                                placeholder={column.isTimeField ? "00:00" : "0"}
                                                min={column.field === "plusMinus" || column.isTimeField ? undefined : "0"}
                                                max={maxValue !== undefined ? String(maxValue) : undefined}
                                                title={`${player.name} ${column.field}`}
                                                value={statInputValue(playerStat?.[column.field], column.isTimeField, hasTouched)}
                                                onChange={(e) => updatePlayerStat(player.id, false, column.field, e.target.value, player.name || "Player", column.isTimeField)}
                                                disabled={column.readOnly || isDNP}
                                                className={`${column.isTimeField ? 'w-14' : 'w-12'} px-2 py-1 border rounded text-center text-sm ${column.readOnly || isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${hasError ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                                );
                                              })()}
                                            </td>
                                          ))}
                                        </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Home Team Players */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  {expandedGame.homeTeamLogo && (
                                    <Image src={expandedGame.homeTeamLogo} alt="" width={24} height={24} className="rounded" unoptimized />
                                  )}
                                  <h4 className="font-semibold text-white">{expandedGame.homeTeamName}</h4>
                                  <span className="text-xs text-slate-400">({homePlayers.length} players)</span>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-white/10">
                                        <th className="text-left p-3">#</th>
                                        <th className="text-left p-3">Player</th>
                                        <th className="text-center p-2 w-12">{copy.dnp}</th>
                                        {statColumns.map((column) => (
                                          <th key={column.field} className="text-center p-2 w-14">{column.label}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {homePlayers.map((player) => {
                                        const playerStat = homeStats[player.id];
                                        const isDNP = playerStat?.dnp || false;
                                        return (
                                        <tr key={player.id} className={`border-b border-white/5 hover:bg-white/5 ${isDNP ? 'opacity-50' : ''}`}>
                                          <td className="p-3 text-slate-400 font-mono">{player.jerseyNumber || "-"}</td>
                                          <td className="p-3 text-white font-medium">{player.name}</td>
                                          <td className="p-1 text-center">
                                            <button
                                              type="button"
                                              onClick={() => togglePlayerDNP(player.id, true)}
                                              className={`w-8 h-8 rounded text-xs font-bold transition-colors ${isDNP ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                              title={isDNP ? "Click to mark as played" : "Click to mark as DNP"}
                                            >
                                              {isDNP ? '✓' : '—'}
                                            </button>
                                          </td>
                                          {statColumns.map((column) => (
                                            <td key={column.field} className="p-1">
                                              {(() => {
                                                const cellKey = getCellKey(true, player.id, column.field);
                                                const touchKey = `home_${player.id}_${column.field}`;
                                                const hasError = Boolean(cellErrors[cellKey]);
                                                const hasTouched = Boolean(touchedFields[touchKey]);
                                                const maxValue = column.field === "twoPointsMade"
                                                  ? Number(playerStat?.twoPointsAttempted || 0)
                                                  : column.field === "threePointsMade"
                                                  ? Number(playerStat?.threePointsAttempted || 0)
                                                  : column.field === "freeThrowsMade"
                                                  ? Number(playerStat?.freeThrowsAttempted || 0)
                                                  : undefined;

                                                return (
                                              <input
                                                type={column.isTimeField ? "text" : "number"}
                                                placeholder={column.isTimeField ? "00:00" : "0"}
                                                min={column.field === "plusMinus" || column.isTimeField ? undefined : "0"}
                                                max={maxValue !== undefined ? String(maxValue) : undefined}
                                                title={`${player.name} ${column.field}`}
                                                value={statInputValue(playerStat?.[column.field], column.isTimeField, hasTouched)}
                                                onChange={(e) => updatePlayerStat(player.id, true, column.field, e.target.value, player.name || "Player", column.isTimeField)}
                                                disabled={column.readOnly || isDNP}
                                                className={`${column.isTimeField ? 'w-14' : 'w-12'} px-2 py-1 border rounded text-center text-sm ${column.readOnly || isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${hasError ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                                );
                                              })()}
                                            </td>
                                          ))}
                                        </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="p-4 flex gap-3">
                        <button
                          onClick={() => setExpandedGameId(null)}
                          className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition"
                        >
                          {copy.cancel}
                        </button>
                        <button
                          onClick={saveGameStats}
                          disabled={saving || !winnerId || !awayScore || !homeScore}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {saving ? "..." : copy.save}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
