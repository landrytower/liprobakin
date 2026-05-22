"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useAdmin } from "../layout";
import { firebaseDB } from "@/lib/firebase";
import { formatTeamDisplayName } from "@/lib/team-name";
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch, deleteDoc, where } from "firebase/firestore";
import { logAuditAction } from "@/lib/auditLog";
import { parseCongoDateTime } from "@/lib/congo-time";
import { recomputeHomeProjectorCache } from "@/lib/homeProjectorCache";

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
  winByForfeit?: boolean;
  forfeitCaptainId?: string;
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
  started: boolean;
  points: number;
  minutes: string;  // Format: "MM:SS"
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  blockedAgainst: number;
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

type StatField = Exclude<keyof PlayerStat, "playerId" | "name" | "jerseyNumber" | "dnp" | "started">;

type ImportedPlayerStat = {
  team: "home" | "away";
  jerseyNumber?: string;
  playerName: string;
  stats: Record<StatField, number>;
  dnp?: boolean;
  started?: boolean;
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
    deleteGame: "Delete",
    deleteGameConfirm: "Are you sure you want to delete this game? This will remove game stats and cannot be undone.",
    deleteGameSuccess: "Game deleted successfully.",
    deleteGameError: "Failed to delete game.",
    selectWinner: "Tap the winning team",
    winner: "WINNER",
    loser: "LOSER",
    finalScore: "Final Score",
    save: "Save Game Stats", cancel: "Cancel",
    saving: "Saving...",
    done: "Done",
    startersRequired: "Starters are optional (max 5 per team).",
    starterLimitReached: "You can only select 5 starters.",
    starterTooltip: "Starter (max 5 per team)",
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
    option3: "Option 3: Import from Photo (Stats Sheet)",
    option2: "Option 2: Manual Entry",
    sourceUrl: "Source URL",
    pullNow: "Pull Now",
    pulling: "Pulling...",
    pullSuccess: "Live stats imported. Review and save.",
    pullError: "Unable to import from source.",
    photoPick: "Choose photo",
    photoImport: "Import Photo",
    photoImporting: "Reading...",
    photoHelp: "Upload a clear photo/screenshot of the printed stats sheet.",
    pdfPick: "Choose PDF",
    pdfImport: "Import PDF",
    pdfHelp: "Or upload a PDF of the printed stats sheet (page 1 will be read).",
    pdfMissing: "Please choose a stats-sheet PDF.",
    photoMissing: "Please choose a stats-sheet photo.",
    photoNoRoster: "Load the game rosters first.",
    photoParsed: "Imported. Review the stats then save.",
    photoParsedWithUnmatched: "Imported stats, but some players were not matched.",
    photoError: "Unable to import from this file. If it looks clear, the layout may not match the expected stats-sheet format.",
    sheetNoRows: "We found text but couldn't detect player rows. Make sure the sheet includes MIN (mm:ss) and shooting columns like 3/8.",
    sheetNoMatches: "We detected rows, but none matched your rosters. Check player names/jersey numbers and make sure rosters are loaded.",
    awayScore: "Away Score",
    homeScore: "Home Score",
    forfeitWin: "Win by Forfeit",
    forfeitTitle: "Win by forfeit",
    forfeitPickWinner: "Select winning team",
    forfeitPickCaptain: "Select captain",
    forfeitCaptain: "Captain",
    forfeitConfirm: "Confirm Forfeit Result",
    forfeitNote: "Final score will be set to 20–0. Captain receives all 20 points.",
    forfeitMissing: "Select winner team and captain.",
    clearStats: "Clear Stats",
    clearStatsConfirm: "Delete all player stats for this game? The game score and result will be kept.",
    clearStatsSuccess: "Player stats cleared.",
    clearStatsError: "Failed to clear player stats.",
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
    deleteGame: "Supprimer",
    deleteGameConfirm: "Voulez-vous vraiment supprimer ce match ? Les statistiques seront supprimées et cette action est irréversible.",
    deleteGameSuccess: "Match supprimé avec succès.",
    deleteGameError: "Échec de la suppression du match.",
    selectWinner: "Cliquez sur l'équipe gagnante",
    winner: "GAGNANT",
    loser: "PERDANT",
    finalScore: "Score Final",
    save: "Enregistrer", cancel: "Annuler",
    saving: "Enregistrement...",
    done: "Terminé",
    startersRequired: "Les titulaires sont optionnels (max 5 par équipe).",
    starterLimitReached: "Vous ne pouvez sélectionner que 5 titulaires.",
    starterTooltip: "Titulaire (max 5 par équipe)",
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
    option3: "Option 3 : Importer une photo (Feuille de stats)",
    option2: "Option 2 : Saisie Manuelle",
    sourceUrl: "URL source",
    pullNow: "Importer",
    pulling: "Importation...",
    pullSuccess: "Stats importées. Vérifiez puis enregistrez.",
    pullError: "Impossible d'importer depuis la source.",
    photoPick: "Choisir une photo",
    photoImport: "Importer la photo",
    photoImporting: "Lecture...",
    photoHelp: "Ajoutez une photo/screenshot claire de la feuille de stats imprimée.",
    pdfPick: "Choisir un PDF",
    pdfImport: "Importer le PDF",
    pdfHelp: "Ou ajoutez un PDF de la feuille de stats imprimée (page 1 sera lue).",
    pdfMissing: "Veuillez choisir un PDF de la feuille de stats.",
    photoMissing: "Veuillez choisir une photo de la feuille de stats.",
    photoNoRoster: "Chargez d'abord les rosters du match.",
    photoParsed: "Importé. Vérifiez puis enregistrez.",
    photoParsedWithUnmatched: "Stats importées, mais certains joueurs n'ont pas été reconnus.",
    photoError: "Impossible d'importer ce fichier. S'il est clair, la mise en page ne correspond peut-être pas au format attendu.",
    sheetNoRows: "Texte trouvé, mais aucune ligne joueur détectée. Assurez-vous que la feuille contient MIN (mm:ss) et des colonnes de tirs comme 3/8.",
    sheetNoMatches: "Lignes détectées, mais aucun joueur n'a été associé aux rosters. Vérifiez les noms/numéros et chargez les rosters.",
    awayScore: "Score Visiteur",
    homeScore: "Score Domicile",
    forfeitWin: "Victoire par forfait",
    forfeitTitle: "Victoire par forfait",
    forfeitPickWinner: "Sélectionnez l'équipe gagnante",
    forfeitPickCaptain: "Sélectionnez la capitaine",
    forfeitCaptain: "Capitaine",
    forfeitConfirm: "Confirmer le forfait",
    forfeitNote: "Le score final sera 20–0. La capitaine reçoit les 20 points.",
    forfeitMissing: "Sélectionnez l'équipe gagnante et la capitaine.",
    clearStats: "Effacer Stats",
    clearStatsConfirm: "Supprimer toutes les statistiques joueurs de ce match ? Le score et le résultat seront conservés.",
    clearStatsSuccess: "Statistiques joueurs effacées.",
    clearStatsError: "Impossible d'effacer les statistiques joueurs.",
  },
};

type ParsedSheetRow = {
  rawLine: string;
  playerName: string;
  stats: Partial<Record<StatField, number>>;
  dnp?: boolean;
  started?: boolean;
};

const stripDiacritics = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();

const safeNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[-+]?\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseSlashStat = (token: string): { made: number; att: number } | null => {
  const match = token.trim().match(/^(\d+)\/(\d+)$/);
  if (!match) return null;
  const made = Number(match[1]);
  const att = Number(match[2]);
  if (!Number.isFinite(made) || !Number.isFinite(att)) return null;
  return { made, att };
};

// Jaro-Winkler for fuzzy player-name matching.
const jaroWinkler = (a: string, b: string): number => {
  if (a === b) return 1;
  const len1 = a.length;
  const len2 = b.length;
  if (!len1 || !len2) return 0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (a[i] !== b[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (!matches) return 0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const transpositions = t / 2;

  const m = matches;
  const jaro = (m / len1 + m / len2 + (m - transpositions) / m) / 3;

  let prefix = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, len1, len2); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
};

const parseStatsSheetText = (rawText: string): ParsedSheetRow[] => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rows: ParsedSheetRow[] = [];

  for (const line of lines) {
    const isDnpLine = /\b(NPJ|DNP)\b/i.test(line);
    if (!isDnpLine && (!/\b\d{1,2}:\d{2}\b/.test(line) || !/\b\d+\/\d+\b/.test(line))) {
      continue;
    }

    const tokens = line.split(" ").map((token) => token.trim()).filter(Boolean);
    const dnpIndex = tokens.findIndex((token) => /^(NPJ|DNP)\b/i.test(token));
    const minuteIndex = tokens.findIndex((token) => /^\d{1,2}:\d{2}$/.test(token));

    const isStarterLine = /[★]/.test(line) || tokens.some((t) => t === "*" || /^\*\d*$/.test(t));

    if (isDnpLine && minuteIndex < 0) {
      const before = tokens.slice(0, dnpIndex >= 0 ? dnpIndex : tokens.length);
      const nameTokens = before.filter((token, index) => {
        if (index === 0 && /^#?\d+$/.test(token)) return false;
        return !/^\d+$/.test(token);
      });
      const cleaned = nameTokens
        .map((t) => t.replace(/[★]/g, "").replace(/^\*/, ""))
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => !/^\d+$/.test(t));
      const playerName = cleaned.join(" ").trim();
      if (!playerName) continue;

      const stats: Partial<Record<StatField, number>> = {
        minutes: 0,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        twoPointsMade: 0,
        twoPointsAttempted: 0,
        threePointsMade: 0,
        threePointsAttempted: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        offensiveRebounds: 0,
        defensiveRebounds: 0,
        rebounds: 0,
        assists: 0,
        turnovers: 0,
        steals: 0,
        blocks: 0,
        blockedAgainst: 0,
        fouls: 0,
        foulsDrawn: 0,
        plusMinus: 0,
        points: 0,
      };

      rows.push({ rawLine: line, playerName, stats, dnp: true, started: isStarterLine ? true : undefined });
      continue;
    }

    if (minuteIndex <= 0) continue;

    const before = tokens.slice(0, minuteIndex);
    const after = tokens.slice(minuteIndex + 1);

    const nameTokens = before.filter((token, index) => {
      if (index === 0 && /^#?\d+$/.test(token)) return false;
      return !/^\d+$/.test(token);
    });
    const cleaned = nameTokens
      .map((t) => t.replace(/[★]/g, "").replace(/^\*/, ""))
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => !/^\d+$/.test(t));
    const playerName = cleaned.join(" ").trim();
    if (!playerName) continue;

    const [mmPart, ssPart] = tokens[minuteIndex].split(":");
    const minutesPart = safeNumber(mmPart || "") ?? 0;
    const secondsPart = safeNumber(ssPart || "") ?? 0;
    const totalSeconds = Math.max(minutesPart, 0) * 60 + Math.min(Math.max(secondsPart, 0), 59);
    const isZeroTime = /^0{1,2}:0{2}$/.test(tokens[minuteIndex]);

    const slashTokens: Array<{ value: { made: number; att: number }; index: number }> = [];
    after.forEach((token, idx) => {
      const parsed = parseSlashStat(token);
      if (parsed) {
        slashTokens.push({ value: parsed, index: idx });
      }
    });
    if (slashTokens.length < 3) {
      if (isDnpLine) {
        const stats: Partial<Record<StatField, number>> = {
          minutes: 0,
          fieldGoalsMade: 0,
          fieldGoalsAttempted: 0,
          twoPointsMade: 0,
          twoPointsAttempted: 0,
          threePointsMade: 0,
          threePointsAttempted: 0,
          freeThrowsMade: 0,
          freeThrowsAttempted: 0,
          offensiveRebounds: 0,
          defensiveRebounds: 0,
          rebounds: 0,
          assists: 0,
          turnovers: 0,
          steals: 0,
          blocks: 0,
          blockedAgainst: 0,
          fouls: 0,
          foulsDrawn: 0,
          plusMinus: 0,
          points: 0,
        };

        rows.push({ rawLine: line, playerName, stats, dnp: true, started: isStarterLine ? true : undefined });
      }
      continue;
    }

    const usedSlash = slashTokens.slice(0, Math.min(4, slashTokens.length));
    const lastSlashIndex = usedSlash[usedSlash.length - 1].index;
    const tailTokens = after.slice(lastSlashIndex + 1);

    const numbers = tailTokens
      .map((token) => token.replace(/%$/, ""))
      .map((token) => safeNumber(token))
      .filter((value): value is number => value !== null);

    if (numbers.length < 11) continue;

    const stats: Partial<Record<StatField, number>> = {
      // Store time as total seconds so we can faithfully round-trip to MM:SS.
      minutes: totalSeconds,
      offensiveRebounds: numbers[0] ?? 0,
      defensiveRebounds: numbers[1] ?? 0,
      rebounds: numbers[2] ?? 0,
      assists: numbers[3] ?? 0,
      turnovers: numbers[4] ?? 0,
      steals: numbers[5] ?? 0,
      blocks: numbers[6] ?? 0,
      blockedAgainst: numbers[7] ?? 0,
      fouls: numbers[8] ?? 0,
      foulsDrawn: numbers[9] ?? 0,
      plusMinus: numbers[10] ?? 0,
      points: numbers[numbers.length - 1] ?? 0,
    };

    const totalFg = usedSlash[0]?.value;
    const maybeTwoPt = usedSlash.length === 4 ? usedSlash[1].value : null;
    const threePt = usedSlash.length === 4 ? usedSlash[2].value : usedSlash[1].value;
    const ft = usedSlash.length === 4 ? usedSlash[3].value : usedSlash[2].value;

    stats.fieldGoalsMade = totalFg?.made ?? 0;
    stats.fieldGoalsAttempted = totalFg?.att ?? 0;
    stats.threePointsMade = threePt?.made ?? 0;
    stats.threePointsAttempted = threePt?.att ?? 0;
    stats.freeThrowsMade = ft?.made ?? 0;
    stats.freeThrowsAttempted = ft?.att ?? 0;

    if (maybeTwoPt) {
      stats.twoPointsMade = maybeTwoPt.made;
      stats.twoPointsAttempted = maybeTwoPt.att;
    } else {
      stats.twoPointsMade = Math.max((stats.fieldGoalsMade ?? 0) - (stats.threePointsMade ?? 0), 0);
      stats.twoPointsAttempted = Math.max((stats.fieldGoalsAttempted ?? 0) - (stats.threePointsAttempted ?? 0), 0);
    }

    const inferredDnp =
      isZeroTime &&
      [
        stats.points,
        stats.offensiveRebounds,
        stats.defensiveRebounds,
        stats.rebounds,
        stats.assists,
        stats.turnovers,
        stats.steals,
        stats.blocks,
        stats.blockedAgainst,
        stats.fouls,
        stats.foulsDrawn,
        stats.plusMinus,
        stats.fieldGoalsMade,
        stats.fieldGoalsAttempted,
        stats.twoPointsMade,
        stats.twoPointsAttempted,
        stats.threePointsMade,
        stats.threePointsAttempted,
        stats.freeThrowsMade,
        stats.freeThrowsAttempted,
      ].every((value) => (Number(value ?? 0) || 0) === 0);

    const finalDnp = Boolean(isDnpLine) || inferredDnp;

    if (finalDnp) {
      stats.minutes = 0;
      stats.points = 0;
    }

    rows.push({
      rawLine: line,
      playerName,
      stats,
      dnp: finalDnp ? true : undefined,
      started: isStarterLine ? true : undefined,
    });
  }

  return rows;
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
  "blockedAgainst",
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
  started: false,
  points: 0,
  minutes: "",  // Format: "MM:SS"
  rebounds: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  blockedAgainst: 0,
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
    const gameDateTime = parseCongoDateTime(game.date, game.time || "00:00") || new Date(`${game.date}T${game.time || "00:00"}`);
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

type ParsedFinalScore = {
  teamA: string;
  scoreA: number;
  teamB: string;
  scoreB: number;
};

function parseFinalScoreFromText(rawText: string): ParsedFinalScore | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Usually in the header, so search early lines first.
  const scan = lines.slice(0, 30);
  for (const line of scan) {
    // Avoid matching the quarter breakdown line, which is often parenthetical like: (16-22, 10-12, ...)
    if (/^[\(\[]\s*\d{1,3}\s*[–\-]\s*\d{1,3}/.test(line)) {
      continue;
    }

    // Examples: "TEAM A 73 – 67 TEAM B" or "TEAM A 73-67 TEAM B"
    const match = line.match(/^(.*?)(\d{1,3})\s*[–\-]\s*(\d{1,3})(.*)$/);
    if (!match) continue;
    const left = String(match[1] || "").trim();
    const right = String(match[4] || "").trim();
    const scoreA = safeNumber(match[2]) ?? null;
    const scoreB = safeNumber(match[3]) ?? null;
    if (scoreA === null || scoreB === null) continue;
    if (!left || !right) continue;
    // Require letters on both sides to ensure we captured team names.
    if (!/[a-z]/i.test(left) || !/[a-z]/i.test(right)) continue;
    return { teamA: left, scoreA, teamB: right, scoreB };
  }

  return null;
}

function resolveFinalScoreToHomeAway(
  parsed: ParsedFinalScore,
  game: Pick<Game, "homeTeamName" | "awayTeamName">
): { homeScore: number; awayScore: number } | null {
  const homeName = stripDiacritics(normalizeTeamName(game.homeTeamName || ""));
  const awayName = stripDiacritics(normalizeTeamName(game.awayTeamName || ""));
  const teamA = stripDiacritics(normalizeTeamName(parsed.teamA));
  const teamB = stripDiacritics(normalizeTeamName(parsed.teamB));

  if (!homeName || !awayName || !teamA || !teamB) return null;

  const sim = (a: string, b: string): number => {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.95;
    return jaroWinkler(a, b);
  };

  const direct = sim(teamA, homeName) + sim(teamB, awayName);
  const swapped = sim(teamA, awayName) + sim(teamB, homeName);

  if (direct >= swapped) {
    // Basic sanity: require at least some resemblance to avoid wrong auto-fill.
    if (sim(teamA, homeName) < 0.6 && sim(teamB, awayName) < 0.6) return null;
    return { homeScore: parsed.scoreA, awayScore: parsed.scoreB };
  }

  if (sim(teamA, awayName) < 0.6 && sim(teamB, homeName) < 0.6) return null;
  return { homeScore: parsed.scoreB, awayScore: parsed.scoreA };
}

function normalizePersonName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPersonNameKeys(value: string): string[] {
  const normalized = stripDiacritics(normalizePersonName(value));
  const rawTokens = normalized.split(" ").map((t) => t.trim()).filter(Boolean);
  const tokens = rawTokens.filter((t) => !/^\d+$/.test(t));
  if (tokens.length === 0) return [];

  const guessLastName = (): string => {
    if (tokens.length === 1) return tokens[0];
    const lastToken = tokens[tokens.length - 1];
    // Sheets often use LASTNAME Initial; in that case the last token is just the initial.
    if (lastToken.length === 1) {
      return tokens.slice(0, -1).join(" ").trim();
    }
    return lastToken;
  };

  const keys = new Set<string>();
  const base = tokens.join(" ");
  keys.add(base);

  const lastNameOnly = guessLastName();
  if (lastNameOnly) keys.add(lastNameOnly);

  if (tokens.length >= 2) {
    keys.add([...tokens].reverse().join(" "));

    // Common sheet format: LASTNAME F (initial)
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    const firstInitial = firstToken?.[0] ? firstToken[0] : "";
    const lastInitial = lastToken?.[0] ? lastToken[0] : "";
    if (firstInitial) keys.add(`${lastToken} ${firstInitial}`.trim());
    if (lastInitial) keys.add(`${firstToken} ${lastInitial}`.trim());
  }

  return Array.from(keys).filter(Boolean);
}

function isLastNameOnly(value: string): boolean {
  const normalized = stripDiacritics(normalizePersonName(value));
  const rawTokens = normalized.split(" ").map((t) => t.trim()).filter(Boolean);
  const tokens = rawTokens.filter((t) => !/^\d+$/.test(t));
  return tokens.length === 1;
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
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Inline editing state
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [clearingStatsGameId, setClearingStatsGameId] = useState<string | null>(null);

  // Forfeit flow state
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeitWinnerSide, setForfeitWinnerSide] = useState<"home" | "away" | "">("");
  const [forfeitCaptainId, setForfeitCaptainId] = useState("");
  
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
  const [statsSheetPdf, setStatsSheetPdf] = useState<File | null>(null);
  const [statsSheetImporting, setStatsSheetImporting] = useState(false);
  const [statsSheetProgress, setStatsSheetProgress] = useState(0);
  const [statsSheetMessage, setStatsSheetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [popupError, setPopupError] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, boolean>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});  // Track which fields have been touched
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualEntryRef = useRef<HTMLDivElement | null>(null);

  const homeStarterCount = useMemo(() => {
    return homePlayers.reduce((acc, player) => {
      const stat = homeStats[player.id];
      if (!stat || stat.dnp) return acc;
      return acc + (stat.started ? 1 : 0);
    }, 0);
  }, [homePlayers, homeStats]);

  const awayStarterCount = useMemo(() => {
    return awayPlayers.reduce((acc, player) => {
      const stat = awayStats[player.id];
      if (!stat || stat.dnp) return acc;
      return acc + (stat.started ? 1 : 0);
    }, 0);
  }, [awayPlayers, awayStats]);

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
    const rawFieldGoalsMade = Math.max(0, Number(stat.fieldGoalsMade || 0));
    const rawFieldGoalsAttempted = Math.max(0, Number(stat.fieldGoalsAttempted || 0));
    const threePointsMade = Math.max(0, Number(stat.threePointsMade || 0));
    const threePointsAttempted = Math.max(0, Number(stat.threePointsAttempted || 0));
    const freeThrowsMade = Math.max(0, Number(stat.freeThrowsMade || 0));
    const freeThrowsAttempted = Math.max(0, Number(stat.freeThrowsAttempted || 0));
    const fieldGoalsMade = rawFieldGoalsMade;
    const fieldGoalsAttempted = rawFieldGoalsAttempted;
    const twoPointsMade = Math.max(0, fieldGoalsMade - threePointsMade);
    const twoPointsAttempted = Math.max(0, fieldGoalsAttempted - threePointsAttempted);
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
      fieldGoalsMade,
      fieldGoalsAttempted,
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
    if (value === "") {
      return "";
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

        const gameDateTime = parseCongoDateTime(game.date, game.time || "00:00") || new Date(`${game.date}T${game.time || "00:00"}`);
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
        const fullName = formatTeamDisplayName(city, name);
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

      const sortByNumber = (players: Player[]) =>
        [...players].sort((a, b) => {
          const aNum = Number.parseInt(String(a.jerseyNumber || a.number || ""), 10);
          const bNum = Number.parseInt(String(b.jerseyNumber || b.number || ""), 10);
          const aValue = Number.isFinite(aNum) ? aNum : Number.MAX_SAFE_INTEGER;
          const bValue = Number.isFinite(bNum) ? bNum : Number.MAX_SAFE_INTEGER;
          if (aValue !== bValue) return aValue - bValue;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });

      const homeList = sortByNumber(homeSnap.docs.map(mapRosterPlayer));
      const awayList = sortByNumber(awaySnap.docs.map(mapRosterPlayer));
      
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
        blockedAgainst: ["blockedAgainst", "blocked_against", "contreSubi", "contre_subi", "cs"],
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

      const readStoredMinutes = (statEntry: Record<string, unknown>, aliases: string[]) => {
        for (const alias of aliases) {
          const raw = statEntry[alias];
          if (typeof raw === "string" && raw.trim()) {
            return raw.trim();
          }
          if (typeof raw === "number" && Number.isFinite(raw)) {
            return raw > 0 ? `${Math.floor(raw)}:00` : "";
          }
        }
        return "";
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
            updatedStat.minutes = readStoredMinutes(statEntry, statAliasMap[field]);
            return;
          }
          // Use type assertion for numeric stat fields
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (updatedStat as any)[field] = getStoredStatValue(statEntry, statAliasMap[field]);
        });
        // Read DNP flag separately (boolean, not numeric)
        if (statEntry.dnp === true) {
          updatedStat.dnp = true;
        }
        if (statEntry.started === true) {
          updatedStat.started = true;
        }
        targetStats[targetPlayerId] = normalizeDerivedStats(updatedStat);
      });
      
      setHomeStats(initHomeStats);
      setAwayStats(initAwayStats);
    } catch (error) {
      console.error("Error fetching rosters:", error);
    } finally {
      setLoadingPlayers(false);
    }
  }, [normalizeDerivedStats]);

  const expandGame = useCallback((game: Game) => {
    if (expandedGameId === game.id) {
      setExpandedGameId(null);
      setResolvedTeamIds(null);
      setImportMessage(null);
      setStatsSheetMessage(null);
      setStatsSheetPdf(null);
      setStatsSheetProgress(0);
      setForfeitOpen(false);
      setForfeitWinnerSide("");
      setForfeitCaptainId("");
      return;
    }
    
    setExpandedGameId(game.id);
    setWinnerId(game.winnerTeamId || "");
    setCellErrors({});
    setPopupError(null);
    setForfeitOpen(false);
    setForfeitWinnerSide("");
    setForfeitCaptainId("");
    
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
    setStatsSheetMessage(null);
    setStatsSheetProgress(0);
    setStatsSheetPdf(null);
    
    fetchRosters(game);
  }, [expandedGameId, fetchRosters]);

  const applyStatsSheetTextImport = useCallback((text: string) => {
    const rows = parseStatsSheetText(text);

    if (rows.length === 0) {
      setStatsSheetMessage({ type: "error", text: copy.sheetNoRows });
      return;
    }

    const buildRosterCandidates = (side: "home" | "away", players: Player[]) =>
      players
        .map((player) => {
          const jersey = String(player.jerseyNumber || player.number || "").trim();
          const name = String(player.name || "").trim();
          const keys = buildPersonNameKeys(name);
          return {
            side,
            player,
            jersey,
            name,
            keys,
          };
        })
        .filter((entry) => entry.keys.length > 0);

    const candidates = [
      ...buildRosterCandidates("home", homePlayers),
      ...buildRosterCandidates("away", awayPlayers),
    ];

    const importedPlayers: ImportedPlayerStat[] = [];
    const unmatchedRows: ParsedSheetRow[] = [];

    const threshold = 0.88;

    rows.forEach((row) => {
      const rowKeys = buildPersonNameKeys(row.playerName);
      if (rowKeys.length === 0) {
        unmatchedRows.push(row);
        return;
      }

      // Safety: if the sheet row contains only a last name and that last name matches multiple
      // roster players, do not guess — leave it for manual entry.
      if (isLastNameOnly(row.playerName)) {
        const lastName = rowKeys[0];
        const sameLastName = candidates.filter((candidate) => candidate.keys.includes(lastName));
        if (sameLastName.length === 1) {
          const bestCandidate = sameLastName[0];

          const emptyStats = PLAYER_STAT_FIELDS.reduce<Record<StatField, number>>((acc, field) => {
            acc[field] = 0;
            return acc;
          }, {} as Record<StatField, number>);

          const mergedStats = {
            ...emptyStats,
            ...row.stats,
          };

          importedPlayers.push({
            team: bestCandidate.side,
            jerseyNumber: bestCandidate.jersey || undefined,
            playerName: bestCandidate.name,
            stats: mergedStats,
            dnp: row.dnp,
            started: row.started,
          });
          return;
        }

        unmatchedRows.push(row);
        return;
      }

      let bestScore = 0;
      let bestCandidate: (typeof candidates)[number] | null = null;

      for (const candidate of candidates) {
        let candidateBest = 0;
        for (const candidateKey of candidate.keys) {
          for (const rowKey of rowKeys) {
            if (candidateKey === rowKey) {
              candidateBest = 1;
              break;
            }
            if (candidateKey.includes(rowKey) || rowKey.includes(candidateKey)) {
              candidateBest = Math.max(candidateBest, 0.95);
              continue;
            }
            candidateBest = Math.max(candidateBest, jaroWinkler(candidateKey, rowKey));
          }
          if (candidateBest >= 1) break;
        }

        if (candidateBest > bestScore) {
          bestScore = candidateBest;
          bestCandidate = candidate;
        }
        if (bestScore >= 1) break;
      }

      if (!bestCandidate || bestScore < threshold) {
        unmatchedRows.push(row);
        return;
      }

      const emptyStats = PLAYER_STAT_FIELDS.reduce<Record<StatField, number>>((acc, field) => {
        acc[field] = 0;
        return acc;
      }, {} as Record<StatField, number>);

      const mergedStats = {
        ...emptyStats,
        ...row.stats,
      };

      importedPlayers.push({
        team: bestCandidate.side,
        jerseyNumber: bestCandidate.jersey || undefined,
        playerName: bestCandidate.name,
        stats: mergedStats,
        dnp: row.dnp,
        started: row.started,
      });
    });

    if (importedPlayers.length === 0) {
      setStatsSheetMessage({ type: "error", text: copy.sheetNoMatches });
      return;
    }

    // Apply imported player stats without overwriting scores/winner.
    const nextHomeStats = { ...homeStats };
    const nextAwayStats = { ...awayStats };

    const isEffectivelyZeroMinutes = (minutes: string | undefined): boolean => {
      const value = String(minutes || "").trim();
      if (!value) return true;
      return /^0{1,2}:0{2}$/.test(value);
    };

    const hasAnyEnteredStats = (stat: PlayerStat): boolean => {
      if (!stat) return false;
      if (!isEffectivelyZeroMinutes(stat.minutes)) return true;
      for (const field of PLAYER_STAT_FIELDS) {
        if (field === "minutes") continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (stat as any)[field];
        const num = typeof raw === "number" ? raw : Number(raw ?? 0);
        if (Number.isFinite(num) && num !== 0) return true;
      }
      return false;
    };

    const applyImportedPlayer = (
      players: Player[],
      side: "home" | "away",
      target: Record<string, PlayerStat>,
      updatedIds: Set<string>,
      starterIds: Set<string>
    ) => {
      const sidePlayers = importedPlayers.filter((player) => player.team === side);
      sidePlayers.forEach((entry) => {
        const jersey = (entry.jerseyNumber || "").trim();
        const entryKeys = buildPersonNameKeys(entry.playerName || "");

        let bestPlayer: Player | null = null;
        let bestScore = 0;

        for (const player of players) {
          const playerKeys = buildPersonNameKeys(player.name || "");
          if (playerKeys.length === 0 || entryKeys.length === 0) continue;

          let score = 0;
          for (const key of playerKeys) {
            if (entryKeys.includes(key)) {
              score = 1;
              break;
            }
          }

          if (score < 1) {
            for (const playerKey of playerKeys) {
              for (const entryKey of entryKeys) {
                score = Math.max(score, jaroWinkler(playerKey, entryKey));
              }
            }
          }

          // Jersey can help, but name is primary (numbers can change).
          const playerJersey = (player.jerseyNumber || (player.number !== undefined ? String(player.number) : "")).trim();
          if (jersey && playerJersey && jersey === playerJersey) {
            score = Math.max(score, 0.92);
          }

          if (score > bestScore) {
            bestScore = score;
            bestPlayer = player;
            if (bestScore >= 1) break;
          }
        }

        const matched = bestScore >= 0.88 ? bestPlayer : null;

        if (!matched || !target[matched.id]) {
          return;
        }

        const updated = { ...target[matched.id] };
        updated.dnp = Boolean(entry.dnp);
        // Starters are marked on the PDF with a star.
        updated.started = updated.dnp ? false : Boolean(entry.started);
        PLAYER_STAT_FIELDS.forEach((field) => {
          if (field === "minutes") {
            const rawSeconds = Number(entry.stats[field] || 0);
            if (rawSeconds > 0) {
              const totalSeconds = Math.max(0, Math.floor(rawSeconds));
              const mm = Math.floor(totalSeconds / 60);
              const ss = totalSeconds % 60;
              updated.minutes = `${mm}:${String(ss).padStart(2, "0")}`;
            } else {
              updated.minutes = "";
            }
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updated as any)[field] = Number(entry.stats[field] || 0);
          }
        });
        target[matched.id] = normalizeDerivedStats(updated);
        updatedIds.add(matched.id);

        if (!updated.dnp && updated.started) {
          starterIds.add(matched.id);
        }
      });
    };

    const updatedHomeIds = new Set<string>();
    const updatedAwayIds = new Set<string>();
    const homeStarterIds = new Set<string>();
    const awayStarterIds = new Set<string>();

    applyImportedPlayer(homePlayers, "home", nextHomeStats, updatedHomeIds, homeStarterIds);
    applyImportedPlayer(awayPlayers, "away", nextAwayStats, updatedAwayIds, awayStarterIds);

    const parseMmSsToSeconds = (value: string | undefined): number => {
      const text = String(value || "").trim();
      const match = text.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return 0;
      const mm = Number(match[1]);
      const ss = Number(match[2]);
      if (!Number.isFinite(mm) || !Number.isFinite(ss)) return 0;
      return Math.max(0, mm) * 60 + Math.min(Math.max(0, ss), 59);
    };

    const ensureExactlyFiveStarters = (players: Player[], target: Record<string, PlayerStat>, starterIdsFromPdf: Set<string>) => {
      const eligible = players
        .map((player) => ({ player, stat: target[player.id] }))
        .filter((entry) => Boolean(entry.stat) && !entry.stat!.dnp);

      if (eligible.length === 0) return;

      // Start with PDF-starred players (if any).
      let starterIds = new Set<string>();
      if (starterIdsFromPdf.size > 0) {
        eligible.forEach(({ player }) => {
          if (starterIdsFromPdf.has(player.id)) starterIds.add(player.id);
        });
      }

      const byMinutesDesc = [...eligible]
        .sort((a, b) => parseMmSsToSeconds(b.stat!.minutes) - parseMmSsToSeconds(a.stat!.minutes))
        .map((e) => e.player.id);

      // If PDF gave more than 5, keep the top-5 by minutes.
      if (starterIds.size > 5) {
        const trimmed = new Set<string>();
        for (const id of byMinutesDesc) {
          if (!starterIds.has(id)) continue;
          trimmed.add(id);
          if (trimmed.size >= 5) break;
        }
        starterIds = trimmed;
      }

      // If PDF gave fewer than 5 (or none), keep as-is (starters are optional).

      // Apply to grid.
      players.forEach((player) => {
        const stat = target[player.id];
        if (!stat) return;
        if (stat.dnp) {
          stat.started = false;
          return;
        }
        stat.started = starterIds.has(player.id);
      });
    };

    ensureExactlyFiveStarters(homePlayers, nextHomeStats, homeStarterIds);
    ensureExactlyFiveStarters(awayPlayers, nextAwayStats, awayStarterIds);

    // If a roster player wasn't listed in the PDF and still has no stats entered,
    // mark them as DNP so admins don't have to do it manually.
    const markMissingAsDnp = (players: Player[], target: Record<string, PlayerStat>, updatedIds: Set<string>) => {
      players.forEach((player) => {
        const stat = target[player.id];
        if (!stat) return;
        if (updatedIds.has(player.id)) return;
        if (hasAnyEnteredStats(stat)) return;

        target[player.id] = {
          ...stat,
          dnp: true,
          started: false,
          minutes: "",
        };
      });
    };

    markMissingAsDnp(homePlayers, nextHomeStats, updatedHomeIds);
    markMissingAsDnp(awayPlayers, nextAwayStats, updatedAwayIds);

    setHomeStats(nextHomeStats);
    setAwayStats(nextAwayStats);

    setStatsSheetMessage({
      type: "success",
      text: unmatchedRows.length > 0 ? copy.photoParsedWithUnmatched : copy.photoParsed,
    });
  }, [awayPlayers, awayStats, copy.sheetNoMatches, copy.sheetNoRows, copy.photoParsed, copy.photoParsedWithUnmatched, homePlayers, homeStats, normalizeDerivedStats]);

  const openForfeitModal = useCallback(() => {
    setForfeitOpen(true);
    setForfeitWinnerSide("");
    setForfeitCaptainId("");
    setImportMessage(null);
  }, []);

  const handleSelectWinner = (teamId: string) => {
    setWinnerId(teamId);
  };

  const updatePlayerStat = (
    playerId: string,
    isHome: boolean,
    field: StatField,
    rawValue: string,
    playerName: string,
    isTimeField?: boolean,
    shouldValidate: boolean = true
  ) => {
    // For time fields (like minutes), keep as string; for others, parse as number
    const value = isTimeField ? rawValue : (rawValue === "" ? "" : (Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0));
    const shouldRunValidation = shouldValidate && !(rawValue === "" && !isTimeField);

    const applyUpdate = (prev: Record<string, PlayerStat>) => {
      const current = prev[playerId] || createEmptyPlayerStat({ id: playerId, name: playerName });
      let next = { ...current, [field]: value } as PlayerStat;

      const attemptsByMade: Partial<Record<StatField, StatField>> = {
        fieldGoalsMade: "fieldGoalsAttempted",
        twoPointsMade: "twoPointsAttempted",
        threePointsMade: "threePointsAttempted",
        freeThrowsMade: "freeThrowsAttempted",
      };
      const madeByAttempts: Partial<Record<StatField, StatField>> = {
        fieldGoalsAttempted: "fieldGoalsMade",
        twoPointsAttempted: "twoPointsMade",
        threePointsAttempted: "threePointsMade",
        freeThrowsAttempted: "freeThrowsMade",
      };

      if (shouldRunValidation) {
        const attemptField = attemptsByMade[field];
        if (attemptField) {
          const attempts = Number(next[attemptField] || 0);
          if (attempts > 0 && Number(value) > attempts) {
            next[field] = 0 as never;
            next[attemptField] = 0 as never;
            const message = field === "twoPointsMade"
              ? "twoPointsMade cannot exceed twoPointsAttempted."
              : field === "threePointsMade"
              ? "3PointsMade cannot exceed 3PointsAttempted."
              : `${field} cannot exceed ${attemptField}.`;
            showValidationError(`${playerName}: ${message}`, getCellKey(isHome, playerId, field));
          }
        }

        const madeField = madeByAttempts[field];
        if (madeField) {
          const attempts = Number(next[field] || 0);
          const makes = Number(next[madeField] || 0);
          if (attempts > 0 && makes > attempts) {
            next[madeField] = 0 as never;
            next[field] = 0 as never;
            const message = madeField === "twoPointsMade"
              ? "twoPointsMade cannot exceed twoPointsAttempted."
              : madeField === "threePointsMade"
              ? "3PointsMade cannot exceed 3PointsAttempted."
              : `${madeField} cannot exceed ${field}.`;
            showValidationError(`${playerName}: ${message}`, getCellKey(isHome, playerId, madeField));
          }
        }
      }

      if (shouldRunValidation) {
        const derivedTotals = normalizeDerivedStats(next);
        const fgMade = Number(derivedTotals.fieldGoalsMade || 0);
        const fgAtt = Number(derivedTotals.fieldGoalsAttempted || 0);
        const threeMade = Number(derivedTotals.threePointsMade || 0);
        const threeAtt = Number(derivedTotals.threePointsAttempted || 0);
        if (threeMade > fgMade) {
          next.threePointsMade = fgMade as never;
          showValidationError(`${playerName}: 3PM cannot exceed Tirs Tot. R.`, getCellKey(isHome, playerId, "threePointsMade"));
        }
        if (threeAtt > fgAtt) {
          next.threePointsAttempted = fgAtt as never;
          showValidationError(`${playerName}: 3PA cannot exceed Tirs Tot. T.`, getCellKey(isHome, playerId, "threePointsAttempted"));
        }
      }

      if (!isTimeField && rawValue === "") {
        const normalized = normalizeDerivedStats({
          ...next,
          [field]: 0 as never,
        } as PlayerStat);
        (normalized as Record<string, unknown>)[field] = "";
        return {
          ...prev,
          [playerId]: normalized,
        };
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
    
    // Mark field as touched (allow clearing back to empty)
    const touchKey = `${isHome ? 'home' : 'away'}_${playerId}_${field}`;
    if (!isTimeField && rawValue === "") {
      setTouchedFields((prev) => {
        const next = { ...prev };
        delete next[touchKey];
        return next;
      });
      const cellKey = getCellKey(isHome, playerId, field);
      setCellErrors((prev) => {
        if (!prev[cellKey]) return prev;
        const next = { ...prev };
        delete next[cellKey];
        return next;
      });
      return;
    }
    setTouchedFields(prev => ({ ...prev, [touchKey]: true }));
  };

  const togglePlayerDNP = (playerId: string, isHome: boolean) => {
    const applyUpdate = (prev: Record<string, PlayerStat>) => {
      const current = prev[playerId];
      if (!current) return prev;
      const nextDnp = !current.dnp;
      return {
        ...prev,
        [playerId]: { ...current, dnp: nextDnp, started: nextDnp ? false : current.started },
      };
    };

    if (isHome) {
      setHomeStats(applyUpdate);
    } else {
      setAwayStats(applyUpdate);
    }
  };

  const togglePlayerStarter = (playerId: string, isHome: boolean) => {
    const starterCount = isHome ? homeStarterCount : awayStarterCount;

    const applyUpdate = (prev: Record<string, PlayerStat>) => {
      const current = prev[playerId];
      if (!current) return prev;

      const nextStarted = !current.started;
      if (nextStarted && starterCount >= 5) {
        showValidationError(copy.starterLimitReached);
        return prev;
      }

      return {
        ...prev,
        [playerId]: {
          ...current,
          started: nextStarted,
          dnp: nextStarted ? false : current.dnp,
        },
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

  const handleImportFromStatsSheetPdf = useCallback(async () => {
    const game = games.find((g) => g.id === expandedGameId);

    if (!game) {
      setStatsSheetMessage({ type: "error", text: copy.photoError });
      return;
    }

    if (!statsSheetPdf) {
      setStatsSheetMessage({ type: "error", text: copy.pdfMissing });
      return;
    }

    if (homePlayers.length === 0 && awayPlayers.length === 0) {
      setStatsSheetMessage({ type: "error", text: copy.photoNoRoster });
      return;
    }

    setStatsSheetImporting(true);
    setStatsSheetProgress(0);
    setStatsSheetMessage(null);

    let worker: Awaited<ReturnType<(typeof import("tesseract.js"))['createWorker']>> | null = null;
    try {
      const applyFinalScoreIfPresent = (text: string) => {
        const parsed = parseFinalScoreFromText(text);
        if (!parsed) return;
        const resolved = resolveFinalScoreToHomeAway(parsed, game);
        if (!resolved) return;

        setHomeScore(String(resolved.homeScore));
        setAwayScore(String(resolved.awayScore));
        if (resolved.homeScore > resolved.awayScore) {
          setWinnerId(game.homeTeamId);
        } else if (resolved.awayScore > resolved.homeScore) {
          setWinnerId(game.awayTeamId);
        }

        requestAnimationFrame(() => {
          manualEntryRef.current?.scrollIntoView({ block: "start" });
        });
      };

      const pdfArrayBuffer = await statsSheetPdf.arrayBuffer();
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // Configure the PDF.js worker so getDocument can render in the browser.
      // Using a local worker file keeps it compatible with Vercel/Next bundling.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pdfjs as any).GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const pdf = await pdfjs.getDocument({ data: pdfArrayBuffer }).promise;
      const page = await pdf.getPage(1);

      // If the PDF has selectable text, prefer extracting it directly (more accurate than OCR).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textContent = await (page as any).getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: any[] = Array.isArray(textContent?.items) ? textContent.items : [];

        const positioned = items
          .map((item) => {
            const str = item && typeof item.str === "string" ? String(item.str).trim() : "";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transform = item && Array.isArray((item as any).transform) ? (item as any).transform : null;
            if (!str) return null;
            if (!transform || transform.length < 6) return null;
            const x = Number(transform[4]);
            const y = Number(transform[5]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return { str, x, y };
          })
          .filter((value): value is { str: string; x: number; y: number } => Boolean(value));

        // Group by approximate row position (y), then order left-to-right by x.
        const yTolerance = 2; // PDF points; small bucket to merge same-row items
        const byRow = new Map<number, Array<{ str: string; x: number }>>();
        for (const item of positioned) {
          const yKey = Math.round(item.y / yTolerance) * yTolerance;
          const existing = byRow.get(yKey) ?? [];
          existing.push({ str: item.str, x: item.x });
          byRow.set(yKey, existing);
        }

        const extractedText = Array.from(byRow.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([, rowItems]) => {
            return rowItems
              .sort((a, b) => a.x - b.x)
              .map((r) => r.str)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
          })
          .filter(Boolean)
          .join("\n");

        if (extractedText.trim().length >= 200) {
          applyFinalScoreIfPresent(extractedText);
          applyStatsSheetTextImport(extractedText);
          page.cleanup();
          pdf.cleanup();
          return;
        }
      } catch {
        // Fall back to OCR for scanned PDFs.
      }

      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to create canvas context");
      }

      // Slightly higher render scale improves OCR on scanned PDFs.
      const ocrViewport = page.getViewport({ scale: 2.5 });
      canvas.width = Math.ceil(ocrViewport.width);
      canvas.height = Math.ceil(ocrViewport.height);

      await page.render({ canvas, canvasContext: ctx, viewport: ocrViewport }).promise;
      page.cleanup();
      pdf.cleanup();

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Unable to render PDF page"));
            return;
          }
          resolve(blob);
        }, "image/png");
      });

      const pngFile = new File([pngBlob], "stats-sheet-page-1.png", { type: "image/png" });

      const Tesseract = await import("tesseract.js");
      worker = await Tesseract.createWorker("eng", 1, {
        logger: (message) => {
          if (typeof message?.progress === "number") {
            setStatsSheetProgress(message.progress);
          }
        },
      });

      await worker.load();
      await worker.reinitialize("eng");
      await worker.setParameters({ preserve_interword_spaces: "1" });

      const result = await worker.recognize(pngFile);
      const text = result?.data?.text ? String(result.data.text) : "";
      applyFinalScoreIfPresent(text);
      applyStatsSheetTextImport(text);
    } catch (error) {
      console.error("Stats sheet PDF import error:", error);
      setStatsSheetMessage({ type: "error", text: copy.photoError });
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // ignore
        }
      }
      setStatsSheetImporting(false);
    }
  }, [applyStatsSheetTextImport, copy.pdfMissing, copy.photoError, copy.photoNoRoster, expandedGameId, games, homePlayers.length, awayPlayers.length, statsSheetPdf]);

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
      dnp: stat.dnp || false,
      started: stat.started || false,
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
      blockedAgainst: stat.blockedAgainst,
      cs: stat.blockedAgainst,
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
      blockedAgainst: number;
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
        blockedAgainst: 0,
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
      const blockedAgainst = Number(stat.cs ?? stat.blockedAgainst ?? 0);
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
        blockedAgainst: current.blockedAgainst + blockedAgainst,
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
        cs: roundOneDecimal(safeRatio(totals?.blockedAgainst || 0, gamesPlayed)).toFixed(1),
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
          cs: averages.cs,
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
          cs: totals?.blockedAgainst || 0,
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

    const records = new Map<string, { wins: number; losses: number; totalPoints: number }>();
    uniqueTeamIds.forEach((teamId) => {
      records.set(teamId, { wins: 0, losses: 0, totalPoints: 0 });
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

      // Track wins/losses and total points scored
      [homeTeamId, awayTeamId].forEach((teamId) => {
        const record = records.get(teamId);
        if (!record) return;
        if (teamId === winnerId) {
          record.wins += 1;
        } else {
          record.losses += 1;
        }
        // Add points scored by this team
        if (teamId === homeTeamId && Number.isFinite(homeScore)) {
          record.totalPoints += homeScore;
        } else if (teamId === awayTeamId && Number.isFinite(awayScore)) {
          record.totalPoints += awayScore;
        }
      });
    });

    await Promise.all(
      uniqueTeamIds.map((teamId) => {
        const record = records.get(teamId) || { wins: 0, losses: 0, totalPoints: 0 };
        return updateDoc(doc(firebaseDB, "teams", teamId), {
          wins: record.wins,
          losses: record.losses,
          totalPoints: record.totalPoints,
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
      await recomputeHomeProjectorCache();

      try {
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
      } catch (auditError) {
        console.error("Game saved but audit log failed:", auditError);
      }

      await fetchGames();
      setImportMessage({
        type: "success",
        text: language === "fr" ? "Les statistiques du match ont été enregistrées." : "Game stats saved successfully.",
      });
      setExpandedGameId(null);
      setResolvedTeamIds(null);
    } catch (error) {
      console.error("Error saving game stats:", error);
      setImportMessage({
        type: "error",
        text: language === "fr" ? "Impossible d'enregistrer les statistiques du match." : "Failed to save game stats.",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveForfeitWin = async () => {
    const game = games.find((g) => g.id === expandedGameId);
    if (!game) return;

    if ((forfeitWinnerSide !== "home" && forfeitWinnerSide !== "away") || !forfeitCaptainId) {
      setImportMessage({ type: "error", text: copy.forfeitMissing });
      return;
    }

    const homeTeamId = resolvedTeamIds?.home || game.homeTeamId;
    const awayTeamId = resolvedTeamIds?.away || game.awayTeamId;
    const winnerTeamId = forfeitWinnerSide === "home" ? homeTeamId : awayTeamId;
    const loserTeamId = forfeitWinnerSide === "home" ? awayTeamId : homeTeamId;
    const winnerTeamName = forfeitWinnerSide === "home" ? game.homeTeamName : game.awayTeamName;
    const loserTeamName = forfeitWinnerSide === "home" ? game.awayTeamName : game.homeTeamName;

    const roster = forfeitWinnerSide === "home" ? homePlayers : awayPlayers;
    const captain = roster.find((p) => p.id === forfeitCaptainId);
    if (!captain) {
      setImportMessage({ type: "error", text: copy.forfeitMissing });
      return;
    }

    const captainName = (captain.name || `${captain.firstName || ""} ${captain.lastName || ""}`.trim() || "Captain").trim();
    const captainNumber = String(captain.jerseyNumber ?? captain.number ?? "");

    const captainStat: PlayerStat = {
      playerId: captain.id,
      name: captainName,
      jerseyNumber: captainNumber,
      dnp: false,
      started: true,
      points: 20,
      minutes: "00:00",
      rebounds: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      blockedAgainst: 0,
      turnovers: 0,
      fouls: 0,
      foulsDrawn: 0,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      twoPointsMade: 10,
      twoPointsAttempted: 10,
      threePointsMade: 0,
      threePointsAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      plusMinus: 0,
    };

    const storedCaptainStat = buildStoredPlayerStat(captainStat, winnerTeamId, winnerTeamName, game.id);
    const homeScoreValue = forfeitWinnerSide === "home" ? 20 : 0;
    const awayScoreValue = forfeitWinnerSide === "away" ? 20 : 0;

    setSaving(true);
    try {
      setImportMessage(null);

      const existingStatsSnap = await getDocs(collection(firebaseDB, `games/${game.id}/playerStats`));
      const existingPlayerGameStatsSnap = await getDocs(
        query(collection(firebaseDB, "playerGameStats"), where("gameId", "==", game.id))
      );
      const batch = writeBatch(firebaseDB);
      existingStatsSnap.docs.forEach((statDoc) => batch.delete(statDoc.ref));
      existingPlayerGameStatsSnap.docs.forEach((statDoc) => batch.delete(statDoc.ref));

      const gameRef = doc(firebaseDB, "games", game.id);
      batch.update(gameRef, {
        status: "completed",
        completed: true,
        winnerId: winnerTeamId,
        winnerTeamId: winnerTeamId,
        loserTeamId: loserTeamId,
        winnerScore: 20,
        loserScore: 0,
        homeScore: homeScoreValue,
        awayScore: awayScoreValue,
        completedAt: serverTimestamp(),
        playerStats: [storedCaptainStat],
        winByForfeit: true,
        forfeitCaptainId: captain.id,
        forfeitCaptainName: captainName,
        updatedAt: serverTimestamp(),
      });

      const statRef = doc(firebaseDB, `games/${game.id}/playerStats`, storedCaptainStat.playerId);
      batch.set(statRef, {
        ...storedCaptainStat,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Keep playerGameStats in sync so any averages/leaderboards using it include the forfeit result.
      const playerGameStatsRef = doc(collection(firebaseDB, "playerGameStats"));
      batch.set(playerGameStatsRef, {
        gameId: game.id,
        playerId: captain.id,
        teamId: winnerTeamId,
        playerName: captainName,
        minutes: 0,
        started: true,
        fieldGoalsMade: 10,
        fieldGoalsAttempted: 10,
        threePtMade: 0,
        threePtAttempted: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        reboundsOff: 0,
        reboundsDef: 0,
        assists: 0,
        turnovers: 0,
        blocks: 0,
        steals: 0,
        personalFouls: 0,
        disqualifications: 0,
        winByForfeit: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      await Promise.all([
        recalculateTeamRosterStats(homeTeamId),
        recalculateTeamRosterStats(awayTeamId),
        recalculateTeamRecords([homeTeamId, awayTeamId]),
      ]);
      await recomputeHomeProjectorCache();

      try {
        await logAuditAction(
          "game_stats_recorded",
          currentAdminUser?.id || "unknown",
          currentAdminUser?.email || "unknown",
          "game",
          game.id,
          `${game.awayTeamName} vs ${game.homeTeamName}`,
          {
            operation: "forfeit",
            winnerTeam: winnerTeamName,
            loserTeam: loserTeamName,
            score: "20-0",
            captainId: captain.id,
            captainName,
            gameDate: game.date,
            venue: game.venue,
          }
        );
      } catch (auditError) {
        console.error("Forfeit saved but audit log failed:", auditError);
      }

      await fetchGames();
      setImportMessage({
        type: "success",
        text: language === "fr" ? "Le forfait a été enregistré." : "Forfeit saved successfully.",
      });
      setForfeitOpen(false);
      setForfeitWinnerSide("");
      setForfeitCaptainId("");
      setExpandedGameId(null);
      setResolvedTeamIds(null);
    } catch (error) {
      console.error("Error saving forfeit result:", error);
      setImportMessage({
        type: "error",
        text: language === "fr" ? "Impossible d'enregistrer le forfait." : "Failed to save forfeit result.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGame = async (game: Game) => {
    if (!currentAdminUser?.permissions?.canManageGames) return;
    if (!window.confirm(copy.deleteGameConfirm)) return;

    setDeletingGameId(game.id);
    try {
      const nestedPlayerStatsSnap = await getDocs(collection(firebaseDB, `games/${game.id}/playerStats`));
      if (!nestedPlayerStatsSnap.empty) {
        const nestedBatch = writeBatch(firebaseDB);
        nestedPlayerStatsSnap.docs.forEach((statDoc) => nestedBatch.delete(statDoc.ref));
        await nestedBatch.commit();
      }

      const sharedPlayerStatsSnap = await getDocs(
        query(collection(firebaseDB, "playerGameStats"), where("gameId", "==", game.id))
      );
      if (!sharedPlayerStatsSnap.empty) {
        const sharedBatch = writeBatch(firebaseDB);
        sharedPlayerStatsSnap.docs.forEach((statDoc) => sharedBatch.delete(statDoc.ref));
        await sharedBatch.commit();
      }

      await deleteDoc(doc(firebaseDB, "games", game.id));

      await Promise.all([
        recalculateTeamRosterStats(game.homeTeamId),
        recalculateTeamRosterStats(game.awayTeamId),
        recalculateTeamRecords([game.homeTeamId, game.awayTeamId]),
      ]);
      await recomputeHomeProjectorCache();

      await logAuditAction(
        "game_deleted",
        currentAdminUser.id,
        currentAdminUser.email || "unknown",
        "game",
        game.id,
        `${game.awayTeamName} @ ${game.homeTeamName}`,
        {
          operation: "stats_page_delete",
          homeTeam: game.homeTeamName,
          awayTeam: game.awayTeamName,
          gameDate: game.date,
          venue: game.venue,
        }
      );

      if (expandedGameId === game.id) {
        setExpandedGameId(null);
        setResolvedTeamIds(null);
      }

      await fetchGames();
      window.alert(copy.deleteGameSuccess);
    } catch (error) {
      console.error("Error deleting game:", error);
      window.alert(copy.deleteGameError);
    } finally {
      setDeletingGameId(null);
    }
  };

  const handleClearStats = async (game: Game) => {
    if (!currentAdminUser?.permissions?.canManageGames) return;
    if (!window.confirm(copy.clearStatsConfirm)) return;

    setClearingStatsGameId(game.id);
    try {
      const [sharedStatsSnap, nestedStatsSnap] = await Promise.all([
        getDocs(query(collection(firebaseDB, "playerGameStats"), where("gameId", "==", game.id))),
        getDocs(collection(firebaseDB, `games/${game.id}/playerStats`)),
      ]);

      if (!sharedStatsSnap.empty || !nestedStatsSnap.empty) {
        const batch = writeBatch(firebaseDB);
        sharedStatsSnap.docs.forEach((d) => batch.delete(d.ref));
        nestedStatsSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      await Promise.all([
        recalculateTeamRosterStats(game.homeTeamId),
        recalculateTeamRosterStats(game.awayTeamId),
        recalculateTeamRecords([game.homeTeamId, game.awayTeamId]),
      ]);
      await recomputeHomeProjectorCache();

      await logAuditAction(
        "player_stats_reset",
        currentAdminUser.id,
        currentAdminUser.email || "unknown",
        "game",
        game.id,
        `${game.awayTeamName} @ ${game.homeTeamName}`,
        {
          operation: "clear_player_stats",
          homeTeam: game.homeTeamName,
          awayTeam: game.awayTeamName,
          gameDate: game.date,
          deletedPlayerGameStats: sharedStatsSnap.size,
          deletedNestedStats: nestedStatsSnap.size,
        }
      );

      window.alert(copy.clearStatsSuccess);
    } catch (error) {
      console.error("Error clearing stats:", error);
      window.alert(copy.clearStatsError);
    } finally {
      setClearingStatsGameId(null);
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
          <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-8 sm:p-16 text-center">
            <div className="text-4xl sm:text-5xl mb-4">📊</div>
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
                  <div
                    role="button"
                    tabIndex={canManageStats ? 0 : -1}
                    onClick={() => canManageStats && expandGame(game)}
                    onKeyDown={(event) => {
                      if (!canManageStats) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        expandGame(game);
                      }
                    }}
                    className={`w-full text-left p-5 transition ${canManageStats ? "hover:bg-white/5 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Away Team */}
                      <div className="flex-1 flex items-center gap-3">
                        {game.awayTeamLogo && (
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900 p-1 ring-2 ring-white/10">
                            <Image
                              src={game.awayTeamLogo}
                              alt={game.awayTeamName}
                              width={48}
                              height={48}
                              className="h-full w-full object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white">{game.awayTeamName}</div>
                          <div className="text-xs text-slate-400">{copy.awayTeam}</div>
                        </div>
                      </div>

                      {/* Score / VS */}
                      {isDone ? (
                        <div className="flex flex-col items-center px-3 sm:px-6">
                          <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">{copy.done}</div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className={`text-2xl sm:text-3xl font-black ${game.winnerTeamId === game.awayTeamId ? "text-emerald-400" : "text-slate-500"}`}>
                              {game.winnerTeamId === game.awayTeamId ? game.winnerScore : game.loserScore}
                            </span>
                            <span className="text-lg text-slate-600">-</span>
                            <span className={`text-2xl sm:text-3xl font-black ${game.winnerTeamId === game.homeTeamId ? "text-emerald-400" : "text-slate-500"}`}>
                              {game.winnerTeamId === game.homeTeamId ? game.winnerScore : game.loserScore}
                            </span>
                          </div>
                        </div>
                      ) : game.completed ? (
                        <div className="flex items-center gap-2 px-2 sm:px-4">
                          <span className={`text-xl sm:text-2xl font-black ${game.winnerTeamId === game.awayTeamId ? "text-emerald-400" : "text-slate-500"}`}>
                            {game.winnerTeamId === game.awayTeamId ? game.winnerScore : game.loserScore}
                          </span>
                          <span className="text-lg text-slate-600">-</span>
                          <span className={`text-xl sm:text-2xl font-black ${game.winnerTeamId === game.homeTeamId ? "text-emerald-400" : "text-slate-500"}`}>
                            {game.winnerTeamId === game.homeTeamId ? game.winnerScore : game.loserScore}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-slate-500 px-6">VS</div>
                      )}

                      {/* Home Team */}
                      <div className="flex-1 flex items-center gap-3 flex-row-reverse">
                        {game.homeTeamLogo && (
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900 p-1 ring-2 ring-white/10">
                            <Image
                              src={game.homeTeamLogo}
                              alt={game.homeTeamName}
                              width={48}
                              height={48}
                              className="h-full w-full object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="text-right">
                          <div className="font-bold text-white">{game.homeTeamName}</div>
                          <div className="text-xs text-slate-400">{copy.homeTeam}</div>
                        </div>
                      </div>

                      {/* Date/Venue and Button */}
                      <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">{(() => { const d = parseCongoDateTime(game.date, game.time); return d ? `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `${game.date} • ${game.time}`; })()}</div>
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
                        {canManageStats && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGame(game);
                            }}
                            disabled={deletingGameId === game.id}
                            className="rounded-xl px-3 py-2 text-xs font-bold border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                            aria-label={copy.deleteGame}
                            title={copy.deleteGame}
                          >
                            {deletingGameId === game.id ? "..." : copy.deleteGame}
                          </button>
                        )}
                        {canManageStats && game.completed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearStats(game);
                            }}
                            disabled={clearingStatsGameId === game.id}
                            className="rounded-xl px-3 py-2 text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                            aria-label={copy.clearStats}
                            title={copy.clearStats}
                          >
                            {clearingStatsGameId === game.id ? "..." : copy.clearStats}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

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

                        <div className="pt-3 border-t border-white/10 space-y-2">
                          <p className="text-xs text-slate-400">{copy.pdfHelp}</p>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={(e) => setStatsSheetPdf(e.target.files?.[0] ?? null)}
                              className="flex-1 px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-600"
                              aria-label={copy.pdfPick}
                            />
                            <button
                              type="button"
                              onClick={handleImportFromStatsSheetPdf}
                              disabled={statsSheetImporting || !statsSheetPdf}
                              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {statsSheetImporting
                                ? `${copy.photoImporting}${statsSheetProgress > 0 ? ` ${Math.round(statsSheetProgress * 100)}%` : ""}`
                                : copy.pdfImport}
                            </button>
                          </div>
                          {statsSheetMessage && (
                            <p className={`text-xs ${statsSheetMessage.type === "success" ? "text-emerald-300" : "text-red-300"}`}>
                              {statsSheetMessage.text}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Step 1: Select Winner */}
                      <div ref={manualEntryRef} className="p-6 border-b border-white/10">
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
                        <div className="p-4 sm:p-6 border-b border-white/10">
                          <h3 className="text-sm font-bold text-orange-400 mb-4">{copy.step2}</h3>
                          <div className="grid grid-cols-2 gap-3 sm:gap-6">
                            <div className="text-center">
                              <label className="text-xs text-slate-400 block mb-2 truncate">{expandedGame.awayTeamName}</label>
                              <input
                                type="number"
                                min="0"
                                value={awayScore}
                                onChange={(e) => setAwayScore(e.target.value)}
                                placeholder="0"
                                className={`w-full px-3 sm:px-4 py-3 sm:py-4 bg-slate-800 border-2 rounded-xl text-white text-2xl sm:text-3xl text-center font-black ${
                                  winnerId === expandedGame.awayTeamId
                                    ? "border-emerald-500/50"
                                    : "border-red-500/30"
                                }`}
                              />
                            </div>
                            <div className="text-center">
                              <label className="text-xs text-slate-400 block mb-2 truncate">{expandedGame.homeTeamName}</label>
                              <input
                                type="number"
                                min="0"
                                value={homeScore}
                                onChange={(e) => setHomeScore(e.target.value)}
                                placeholder="0"
                                className={`w-full px-3 sm:px-4 py-3 sm:py-4 bg-slate-800 border-2 rounded-xl text-white text-2xl sm:text-3xl text-center font-black ${
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
                                <div className="bg-slate-800/50 rounded-xl overflow-x-auto stats-compact">
                                  <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-20 bg-slate-900/95">
                                      <tr className="text-slate-400 border-b border-white/10">
                                        <th rowSpan={2} className="text-left p-3">#</th>
                                        <th rowSpan={2} className="text-left p-3">Player</th>
                                        <th rowSpan={2} className="text-center p-2 w-12">{copy.dnp}</th>
                                        <th rowSpan={2} className="text-center p-2 w-14">MIN</th>
                                        <th colSpan={2} className="text-center p-2">Tirs Tot.</th>
                                        <th colSpan={2} className="text-center p-2">3 pts</th>
                                        <th colSpan={2} className="text-center p-2">LF</th>
                                        <th colSpan={3} className="text-center p-2">Rebonds</th>
                                        <th rowSpan={2} className="text-center p-2">PD</th>
                                        <th rowSpan={2} className="text-center p-2">BP</th>
                                        <th rowSpan={2} className="text-center p-2">IN</th>
                                        <th colSpan={2} className="text-center p-2">Contres</th>
                                        <th colSpan={2} className="text-center p-2">Fautes</th>
                                        <th rowSpan={2} className="text-center p-2">+/-</th>
                                        <th rowSpan={2} className="text-center p-2">Ev</th>
                                        <th rowSpan={2} className="text-center p-2">PTS</th>
                                      </tr>
                                      <tr className="text-slate-400 border-b border-white/10">
                                        <th className="text-center p-2">R/T</th>
                                        <th className="text-center p-2">%</th>
                                        <th className="text-center p-2">R/T</th>
                                        <th className="text-center p-2">%</th>
                                        <th className="text-center p-2">R/T</th>
                                        <th className="text-center p-2">%</th>
                                        <th className="text-center p-2">RO</th>
                                        <th className="text-center p-2">RD</th>
                                        <th className="text-center p-2">TOT</th>
                                        <th className="text-center p-2">Ctr</th>
                                        <th className="text-center p-2">CS</th>
                                        <th className="text-center p-2">F</th>
                                        <th className="text-center p-2">FP</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {awayPlayers.map((player) => {
                                        const playerStat = awayStats[player.id];
                                        const stat = playerStat || createEmptyPlayerStat(player);
                                        const isDNP = playerStat?.dnp || false;
                                        const disableStarterToggle = isDNP || (!stat.started && awayStarterCount >= 5);
                                        const fgMade = Number(stat.fieldGoalsMade ?? 0);
                                        const fgAtt = Number(stat.fieldGoalsAttempted ?? 0);
                                        const threeMade = Number(stat.threePointsMade ?? 0);
                                        const threeAtt = Number(stat.threePointsAttempted ?? 0);
                                        const ftMade = Number(stat.freeThrowsMade ?? 0);
                                        const ftAtt = Number(stat.freeThrowsAttempted ?? 0);
                                        const fgPct = Math.round(safePercent(fgMade, fgAtt));
                                        const threePct = Math.round(safePercent(threeMade, threeAtt));
                                        const ftPct = Math.round(safePercent(ftMade, ftAtt));
                                        const evaluation = stat.points + stat.rebounds + stat.assists + stat.steals + stat.blocks -
                                          Math.max(stat.fieldGoalsAttempted - stat.fieldGoalsMade, 0) -
                                          Math.max(stat.freeThrowsAttempted - stat.freeThrowsMade, 0) -
                                          stat.turnovers;
                                        const getTouched = (field: StatField) => Boolean(touchedFields[`away_${player.id}_${field}`]);
                                        const getError = (field: StatField) => Boolean(cellErrors[getCellKey(false, player.id, field)]);
                                        return (
                                        <tr key={player.id} className={`border-b border-white/5 hover:bg-white/5 ${isDNP ? 'opacity-50' : ''}`}>
                                          <td className="p-3 text-slate-400 font-mono">{player.jerseyNumber || "-"}</td>
                                          <td className="p-3 text-white font-medium">
                                            <div className="flex items-center gap-2">
                                              <span className="min-w-0 truncate">{player.name}</span>
                                              <button
                                                type="button"
                                                onClick={() => togglePlayerStarter(player.id, false)}
                                                disabled={disableStarterToggle}
                                                className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                                                  stat.started
                                                    ? "bg-orange-500/20 text-orange-300"
                                                    : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                                                } ${disableStarterToggle ? "opacity-40 cursor-not-allowed hover:bg-slate-700" : ""}`}
                                                title={copy.starterTooltip}
                                              >
                                                ★
                                              </button>
                                            </div>
                                          </td>
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
                                          <td className="p-1">
                                            <input
                                              type="text"
                                              placeholder="00:00"
                                              title={`${player.name} minutes`}
                                              value={statInputValue(stat.minutes, true, getTouched("minutes"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "minutes", e.target.value, player.name || "Player", true)}
                                              disabled={isDNP}
                                              className={`w-14 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("minutes") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <div className="flex items-center justify-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={stat.fieldGoalsAttempted || undefined}
                                                title={`${player.name} fieldGoalsMade`}
                                                value={statInputValue(stat.fieldGoalsMade, false, getTouched("fieldGoalsMade"))}
                                                onChange={(e) => updatePlayerStat(player.id, false, "fieldGoalsMade", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, false, "fieldGoalsMade", String(stat.fieldGoalsMade ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("fieldGoalsMade") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                              <span className="text-xs text-slate-500">/</span>
                                              <input
                                                type="number"
                                                min="0"
                                                title={`${player.name} fieldGoalsAttempted`}
                                                value={statInputValue(stat.fieldGoalsAttempted, false, getTouched("fieldGoalsAttempted"))}
                                                onChange={(e) => updatePlayerStat(player.id, false, "fieldGoalsAttempted", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, false, "fieldGoalsAttempted", String(stat.fieldGoalsAttempted ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("fieldGoalsAttempted") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                            </div>
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{fgPct}%</td>
                                          <td className="p-1">
                                            <div className="flex items-center justify-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={stat.threePointsAttempted || undefined}
                                                title={`${player.name} threePointsMade`}
                                                value={statInputValue(stat.threePointsMade, false, getTouched("threePointsMade"))}
                                                onChange={(e) => updatePlayerStat(player.id, false, "threePointsMade", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, false, "threePointsMade", String(stat.threePointsMade ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("threePointsMade") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                              <span className="text-xs text-slate-500">/</span>
                                              <input
                                                type="number"
                                                min="0"
                                                title={`${player.name} threePointsAttempted`}
                                                value={statInputValue(stat.threePointsAttempted, false, getTouched("threePointsAttempted"))}
                                                onChange={(e) => updatePlayerStat(player.id, false, "threePointsAttempted", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, false, "threePointsAttempted", String(stat.threePointsAttempted ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("threePointsAttempted") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                            </div>
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{threePct}%</td>
                                          <td className="p-1">
                                            <div className="flex items-center justify-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={stat.freeThrowsAttempted || undefined}
                                                title={`${player.name} freeThrowsMade`}
                                                value={statInputValue(stat.freeThrowsMade, false, getTouched("freeThrowsMade"))}
                                                onChange={(e) => updatePlayerStat(player.id, false, "freeThrowsMade", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, false, "freeThrowsMade", String(stat.freeThrowsMade ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("freeThrowsMade") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                              <span className="text-xs text-slate-500">/</span>
                                              <input
                                                type="number"
                                                min="0"
                                                title={`${player.name} freeThrowsAttempted`}
                                                value={statInputValue(stat.freeThrowsAttempted, false, getTouched("freeThrowsAttempted"))}
                                                onChange={(e) => updatePlayerStat(player.id, false, "freeThrowsAttempted", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, false, "freeThrowsAttempted", String(stat.freeThrowsAttempted ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("freeThrowsAttempted") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                            </div>
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{ftPct}%</td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} offensiveRebounds`}
                                              value={statInputValue(stat.offensiveRebounds, false, getTouched("offensiveRebounds"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "offensiveRebounds", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("offensiveRebounds") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} defensiveRebounds`}
                                              value={statInputValue(stat.defensiveRebounds, false, getTouched("defensiveRebounds"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "defensiveRebounds", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("defensiveRebounds") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{stat.rebounds}</td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} assists`}
                                              value={statInputValue(stat.assists, false, getTouched("assists"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "assists", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("assists") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} turnovers`}
                                              value={statInputValue(stat.turnovers, false, getTouched("turnovers"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "turnovers", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("turnovers") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} steals`}
                                              value={statInputValue(stat.steals, false, getTouched("steals"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "steals", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("steals") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} blocks`}
                                              value={statInputValue(stat.blocks, false, getTouched("blocks"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "blocks", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("blocks") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} blockedAgainst`}
                                              value={statInputValue(stat.blockedAgainst, false, getTouched("blockedAgainst"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "blockedAgainst", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("blockedAgainst") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} fouls`}
                                              value={statInputValue(stat.fouls, false, getTouched("fouls"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "fouls", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("fouls") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} foulsDrawn`}
                                              value={statInputValue(stat.foulsDrawn, false, getTouched("foulsDrawn"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "foulsDrawn", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("foulsDrawn") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              title={`${player.name} plusMinus`}
                                              value={statInputValue(stat.plusMinus, false, getTouched("plusMinus"))}
                                              onChange={(e) => updatePlayerStat(player.id, false, "plusMinus", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-12 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("plusMinus") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{evaluation}</td>
                                          <td className="p-1 text-center text-xs font-semibold text-white">{stat.points}</td>
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
                                <div className="bg-slate-800/50 rounded-xl overflow-x-auto stats-compact">
                                  <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-20 bg-slate-900/95">
                                      <tr className="text-slate-400 border-b border-white/10">
                                        <th rowSpan={2} className="text-left p-3">#</th>
                                        <th rowSpan={2} className="text-left p-3">Player</th>
                                        <th rowSpan={2} className="text-center p-2 w-12">{copy.dnp}</th>
                                        <th rowSpan={2} className="text-center p-2 w-14">MIN</th>
                                        <th colSpan={2} className="text-center p-2">Tirs Tot.</th>
                                        <th colSpan={2} className="text-center p-2">3 pts</th>
                                        <th colSpan={2} className="text-center p-2">LF</th>
                                        <th colSpan={3} className="text-center p-2">Rebonds</th>
                                        <th rowSpan={2} className="text-center p-2">PD</th>
                                        <th rowSpan={2} className="text-center p-2">BP</th>
                                        <th rowSpan={2} className="text-center p-2">IN</th>
                                        <th colSpan={2} className="text-center p-2">Contres</th>
                                        <th colSpan={2} className="text-center p-2">Fautes</th>
                                        <th rowSpan={2} className="text-center p-2">+/-</th>
                                        <th rowSpan={2} className="text-center p-2">Ev</th>
                                        <th rowSpan={2} className="text-center p-2">PTS</th>
                                      </tr>
                                      <tr className="text-slate-400 border-b border-white/10">
                                        <th className="text-center p-2">R/T</th>
                                        <th className="text-center p-2">%</th>
                                        <th className="text-center p-2">R/T</th>
                                        <th className="text-center p-2">%</th>
                                        <th className="text-center p-2">R/T</th>
                                        <th className="text-center p-2">%</th>
                                        <th className="text-center p-2">RO</th>
                                        <th className="text-center p-2">RD</th>
                                        <th className="text-center p-2">TOT</th>
                                        <th className="text-center p-2">Ctr</th>
                                        <th className="text-center p-2">CS</th>
                                        <th className="text-center p-2">F</th>
                                        <th className="text-center p-2">FP</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {homePlayers.map((player) => {
                                        const playerStat = homeStats[player.id];
                                        const stat = playerStat || createEmptyPlayerStat(player);
                                        const isDNP = playerStat?.dnp || false;
                                        const disableStarterToggle = isDNP || (!stat.started && homeStarterCount >= 5);
                                        const fgMade = Number(stat.fieldGoalsMade ?? 0);
                                        const fgAtt = Number(stat.fieldGoalsAttempted ?? 0);
                                        const threeMade = Number(stat.threePointsMade ?? 0);
                                        const threeAtt = Number(stat.threePointsAttempted ?? 0);
                                        const ftMade = Number(stat.freeThrowsMade ?? 0);
                                        const ftAtt = Number(stat.freeThrowsAttempted ?? 0);
                                        const fgPct = Math.round(safePercent(fgMade, fgAtt));
                                        const threePct = Math.round(safePercent(threeMade, threeAtt));
                                        const ftPct = Math.round(safePercent(ftMade, ftAtt));
                                        const evaluation = stat.points + stat.rebounds + stat.assists + stat.steals + stat.blocks -
                                          Math.max(stat.fieldGoalsAttempted - stat.fieldGoalsMade, 0) -
                                          Math.max(stat.freeThrowsAttempted - stat.freeThrowsMade, 0) -
                                          stat.turnovers;
                                        const getTouched = (field: StatField) => Boolean(touchedFields[`home_${player.id}_${field}`]);
                                        const getError = (field: StatField) => Boolean(cellErrors[getCellKey(true, player.id, field)]);
                                        return (
                                        <tr key={player.id} className={`border-b border-white/5 hover:bg-white/5 ${isDNP ? 'opacity-50' : ''}`}>
                                          <td className="p-3 text-slate-400 font-mono">{player.jerseyNumber || "-"}</td>
                                          <td className="p-3 text-white font-medium">
                                            <div className="flex items-center gap-2">
                                              <span className="min-w-0 truncate">{player.name}</span>
                                              <button
                                                type="button"
                                                onClick={() => togglePlayerStarter(player.id, true)}
                                                disabled={disableStarterToggle}
                                                className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                                                  stat.started
                                                    ? "bg-orange-500/20 text-orange-300"
                                                    : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                                                } ${disableStarterToggle ? "opacity-40 cursor-not-allowed hover:bg-slate-700" : ""}`}
                                                title={copy.starterTooltip}
                                              >
                                                ★
                                              </button>
                                            </div>
                                          </td>
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
                                          <td className="p-1">
                                            <input
                                              type="text"
                                              placeholder="00:00"
                                              title={`${player.name} minutes`}
                                              value={statInputValue(stat.minutes, true, getTouched("minutes"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "minutes", e.target.value, player.name || "Player", true)}
                                              disabled={isDNP}
                                              className={`w-14 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("minutes") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <div className="flex items-center justify-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={stat.fieldGoalsAttempted || undefined}
                                                title={`${player.name} fieldGoalsMade`}
                                                value={statInputValue(stat.fieldGoalsMade, false, getTouched("fieldGoalsMade"))}
                                                onChange={(e) => updatePlayerStat(player.id, true, "fieldGoalsMade", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, true, "fieldGoalsMade", String(stat.fieldGoalsMade ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("fieldGoalsMade") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                              <span className="text-xs text-slate-500">/</span>
                                              <input
                                                type="number"
                                                min="0"
                                                title={`${player.name} fieldGoalsAttempted`}
                                                value={statInputValue(stat.fieldGoalsAttempted, false, getTouched("fieldGoalsAttempted"))}
                                                onChange={(e) => updatePlayerStat(player.id, true, "fieldGoalsAttempted", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, true, "fieldGoalsAttempted", String(stat.fieldGoalsAttempted ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("fieldGoalsAttempted") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                            </div>
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{fgPct}%</td>
                                          <td className="p-1">
                                            <div className="flex items-center justify-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={stat.threePointsAttempted || undefined}
                                                title={`${player.name} threePointsMade`}
                                                value={statInputValue(stat.threePointsMade, false, getTouched("threePointsMade"))}
                                                onChange={(e) => updatePlayerStat(player.id, true, "threePointsMade", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, true, "threePointsMade", String(stat.threePointsMade ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("threePointsMade") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                              <span className="text-xs text-slate-500">/</span>
                                              <input
                                                type="number"
                                                min="0"
                                                title={`${player.name} threePointsAttempted`}
                                                value={statInputValue(stat.threePointsAttempted, false, getTouched("threePointsAttempted"))}
                                                onChange={(e) => updatePlayerStat(player.id, true, "threePointsAttempted", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, true, "threePointsAttempted", String(stat.threePointsAttempted ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("threePointsAttempted") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                            </div>
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{threePct}%</td>
                                          <td className="p-1">
                                            <div className="flex items-center justify-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={stat.freeThrowsAttempted || undefined}
                                                title={`${player.name} freeThrowsMade`}
                                                value={statInputValue(stat.freeThrowsMade, false, getTouched("freeThrowsMade"))}
                                                onChange={(e) => updatePlayerStat(player.id, true, "freeThrowsMade", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, true, "freeThrowsMade", String(stat.freeThrowsMade ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("freeThrowsMade") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                              <span className="text-xs text-slate-500">/</span>
                                              <input
                                                type="number"
                                                min="0"
                                                title={`${player.name} freeThrowsAttempted`}
                                                value={statInputValue(stat.freeThrowsAttempted, false, getTouched("freeThrowsAttempted"))}
                                                onChange={(e) => updatePlayerStat(player.id, true, "freeThrowsAttempted", e.target.value, player.name || "Player", undefined, false)}
                                                onBlur={() => updatePlayerStat(player.id, true, "freeThrowsAttempted", String(stat.freeThrowsAttempted ?? ""), player.name || "Player")}
                                                disabled={isDNP}
                                                className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("freeThrowsAttempted") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                              />
                                            </div>
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{ftPct}%</td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} offensiveRebounds`}
                                              value={statInputValue(stat.offensiveRebounds, false, getTouched("offensiveRebounds"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "offensiveRebounds", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("offensiveRebounds") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} defensiveRebounds`}
                                              value={statInputValue(stat.defensiveRebounds, false, getTouched("defensiveRebounds"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "defensiveRebounds", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("defensiveRebounds") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{stat.rebounds}</td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} assists`}
                                              value={statInputValue(stat.assists, false, getTouched("assists"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "assists", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("assists") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} turnovers`}
                                              value={statInputValue(stat.turnovers, false, getTouched("turnovers"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "turnovers", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("turnovers") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} steals`}
                                              value={statInputValue(stat.steals, false, getTouched("steals"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "steals", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("steals") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} blocks`}
                                              value={statInputValue(stat.blocks, false, getTouched("blocks"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "blocks", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("blocks") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} blockedAgainst`}
                                              value={statInputValue(stat.blockedAgainst, false, getTouched("blockedAgainst"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "blockedAgainst", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("blockedAgainst") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} fouls`}
                                              value={statInputValue(stat.fouls, false, getTouched("fouls"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "fouls", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("fouls") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              min="0"
                                              title={`${player.name} foulsDrawn`}
                                              value={statInputValue(stat.foulsDrawn, false, getTouched("foulsDrawn"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "foulsDrawn", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-10 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("foulsDrawn") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1">
                                            <input
                                              type="number"
                                              title={`${player.name} plusMinus`}
                                              value={statInputValue(stat.plusMinus, false, getTouched("plusMinus"))}
                                              onChange={(e) => updatePlayerStat(player.id, true, "plusMinus", e.target.value, player.name || "Player")}
                                              disabled={isDNP}
                                              className={`w-12 px-2 py-1 border rounded text-center text-sm ${isDNP ? "bg-slate-900/70 text-slate-300 border-slate-600/40" : "bg-slate-700 text-white"} ${getError("plusMinus") ? "border-red-500 ring-1 ring-red-500/70" : "border-white/10"}`}
                                            />
                                          </td>
                                          <td className="p-1 text-center text-xs text-slate-300">{evaluation}</td>
                                          <td className="p-1 text-center text-xs font-semibold text-white">{stat.points}</td>
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
                      {forfeitOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-lg font-bold text-white">{copy.forfeitTitle}</h3>
                                <p className="mt-1 text-sm text-slate-400">{copy.forfeitNote}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setForfeitOpen(false);
                                  setForfeitWinnerSide("");
                                  setForfeitCaptainId("");
                                }}
                                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition"
                              >
                                {copy.cancel}
                              </button>
                            </div>

                            <div className="mt-4 space-y-4">
                              <div>
                                <p className="mb-2 text-sm font-semibold text-white">{copy.forfeitPickWinner}</p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setForfeitWinnerSide("away");
                                      setForfeitCaptainId("");
                                    }}
                                    className={`rounded-xl border px-3 py-3 text-left transition ${
                                      forfeitWinnerSide === "away"
                                        ? "border-orange-500/60 bg-orange-500/10 text-white"
                                        : "border-white/10 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
                                    }`}
                                  >
                                    <div className="text-xs uppercase tracking-wider text-slate-400">{copy.awayTeam}</div>
                                    <div className="mt-1 font-semibold">{game.awayTeamName}</div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setForfeitWinnerSide("home");
                                      setForfeitCaptainId("");
                                    }}
                                    className={`rounded-xl border px-3 py-3 text-left transition ${
                                      forfeitWinnerSide === "home"
                                        ? "border-orange-500/60 bg-orange-500/10 text-white"
                                        : "border-white/10 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
                                    }`}
                                  >
                                    <div className="text-xs uppercase tracking-wider text-slate-400">{copy.homeTeam}</div>
                                    <div className="mt-1 font-semibold">{game.homeTeamName}</div>
                                  </button>
                                </div>
                              </div>

                              <div>
                                <p className="mb-2 text-sm font-semibold text-white">{copy.forfeitPickCaptain}</p>
                                <select
                                  value={forfeitCaptainId}
                                  onChange={(e) => setForfeitCaptainId(e.target.value)}
                                  disabled={loadingPlayers || saving || (forfeitWinnerSide !== "home" && forfeitWinnerSide !== "away")}
                                  aria-label={copy.forfeitPickCaptain}
                                  title={copy.forfeitPickCaptain}
                                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 text-sm text-white outline-none disabled:opacity-60"
                                >
                                  <option value="">{loadingPlayers ? copy.loadingPlayers : copy.forfeitCaptain}</option>
                                  {(forfeitWinnerSide === "home" ? homePlayers : forfeitWinnerSide === "away" ? awayPlayers : []).map((player) => {
                                    const name = (player.name || `${player.firstName || ""} ${player.lastName || ""}`.trim() || "Player").trim();
                                    const number = String(player.jerseyNumber ?? player.number ?? "").trim();
                                    return (
                                      <option key={player.id} value={player.id}>
                                        {number ? `#${number} ` : ""}{name}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              <div className="flex gap-3 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForfeitOpen(false);
                                    setForfeitWinnerSide("");
                                    setForfeitCaptainId("");
                                  }}
                                  className="flex-1 rounded-xl border border-white/10 bg-slate-900/60 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
                                >
                                  {copy.cancel}
                                </button>
                                <button
                                  type="button"
                                  onClick={saveForfeitWin}
                                  disabled={saving || !forfeitCaptainId || (forfeitWinnerSide !== "home" && forfeitWinnerSide !== "away")}
                                  className="flex-1 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                  {saving ? "..." : copy.forfeitConfirm}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-4 flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => {
                            setExpandedGameId(null);
                            setResolvedTeamIds(null);
                            setImportMessage(null);
                            setForfeitOpen(false);
                            setForfeitWinnerSide("");
                            setForfeitCaptainId("");
                          }}
                          className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition"
                        >
                          {copy.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={openForfeitModal}
                          disabled={saving || loadingPlayers}
                          className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {copy.forfeitWin}
                        </button>
                        <button
                          onClick={saveGameStats}
                          disabled={saving || forfeitOpen || !winnerId || !awayScore || !homeScore}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            {saving ? (
                              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                            ) : null}
                            <span>{saving ? copy.saving : copy.save}</span>
                          </span>
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
