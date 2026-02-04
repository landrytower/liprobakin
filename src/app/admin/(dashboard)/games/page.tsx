"use client";

import React, { useState, useEffect, FormEvent, useMemo } from "react";
import Image from "next/image";
import { useAdmin } from "../layout";
import { firebaseDB } from "@/lib/firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

// ============================================================================
// TYPES
// ============================================================================

type GenderKey = "men" | "women";

type Team = {
  id: string;
  name: string;
  gender: GenderKey;
  logo: string;
  wins: number;
  losses: number;
};

type Venue = {
  id: string;
  name: string;
  city: string;
  capacity?: number;
};

type Referee = {
  id: string;
  firstName: string;
  lastName: string;
};

type Matchday = {
  id: string;
  week: number;
  startDate: string;
  endDate: string;
  gender: GenderKey | "all";
  seasonId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type Game = {
  id: string;
  gender: GenderKey;
  week: number;
  seasonId: string;
  homeTeamId: string;
  homeTeamName: string;
  homeTeamLogo: string;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamLogo: string;
  date: string;
  time: string;
  venue: string;
  venueCity?: string;
  status: "scheduled" | "live" | "completed" | "postponed" | "cancelled";
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
  referees?: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  archivedAt?: Date | null;
};

type GameFormState = {
  id?: string;
  gender: GenderKey;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  venue: string;
  refereeIds: string[];
};

type MatchdayFormState = {
  id?: string;
  week: number;
  startDate: string;
  endDate: string;
  gender: GenderKey | "all";
};

type ViewMode = "schedule" | "archive" | "matchday" | "calendar";
type FilterGender = "all" | "men" | "women";
type CalendarViewType = "list" | "calendar";

// ============================================================================
// TRANSLATIONS
// ============================================================================

const translations = {
  en: {
    title: "Game Management",
    subtitle: "Schedule, manage and archive games by matchday",
    scheduleView: "Schedule",
    archiveView: "Archive",
    matchdayView: "By Matchday",
    calendarView: "Calendar",
    listView: "List",
    allGenders: "All",
    mensLeague: "Men's",
    womensLeague: "Women's",
    scheduleGame: "Schedule Game",
    editGame: "Edit Game",
    cancelEdit: "Cancel",
    saveGame: "Save Game",
    updateGame: "Update Game",
    deleteGame: "Delete",
    week: "Matchday",
    selectWeek: "Select Matchday",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selectTeam: "Select team...",
    date: "Date",
    time: "Time",
    venue: "Venue",
    selectVenue: "Select venue...",
    referees: "Referees",
    selectReferees: "Assign referees (optional)",
    noGamesScheduled: "No games scheduled",
    noGamesForWeek: "No games for this matchday",
    scheduledGames: "Scheduled Games",
    upcomingGames: "Upcoming Games",
    pastGames: "Completed Games",
    liveGames: "Live Games",
    gameStatus: {
      scheduled: "Scheduled",
      live: "Live",
      completed: "Final",
      postponed: "Postponed",
      cancelled: "Cancelled",
    },
    vs: "vs",
    at: "@",
    confirmDelete: "Are you sure you want to delete this game?",
    errorSelectBothTeams: "Please select both teams",
    errorSameTeam: "Home and away teams must be different",
    errorRequiredFields: "Date, time and venue are required",
    successCreated: "Game scheduled successfully",
    successUpdated: "Game updated successfully",
    successDeleted: "Game deleted successfully",
    loading: "Loading...",
    enterScore: "Enter Score",
    homeScore: "Home Score",
    awayScore: "Away Score",
    saveScore: "Save Score",
    markComplete: "Mark Complete",
    quickActions: "Quick Actions",
    bulkSchedule: "Bulk Schedule",
    exportSchedule: "Export",
    seasonArchive: "Season Archive",
    currentSeason: "2024-25 Season",
    totalGames: "Total Games",
    completed: "Completed",
    upcoming: "Upcoming",
    createMatchday: "Create Matchday",
    editMatchday: "Edit Matchday",
    matchdayNumber: "Matchday Number",
    startDate: "Start Date",
    endDate: "End Date",
    saveMatchday: "Save Matchday",
    deleteMatchday: "Delete Matchday",
    viewGames: "View Games",
    noMatchdays: "No matchdays created yet",
    createMatchdayDesc: "Create matchdays to organize games by week with date ranges",
    matchday: "Matchday",
    gamesInMatchday: "Games in this matchday",
    backToMatchdays: "Back to Matchdays",
    matchdayDateRange: "Date Range",
    noGamesForDate: "No games scheduled for this date",
    selectDate: "Select a date to view games",
    downloadPDF: "Download PDF",
  },
  fr: {
    title: "Gestion des Matchs",
    subtitle: "Planifier, gérer et archiver les matchs par journée",
    scheduleView: "Calendrier",
    archiveView: "Archives",
    matchdayView: "Par Journée",
    calendarView: "Calendrier",
    listView: "Liste",
    allGenders: "Tous",
    mensLeague: "Hommes",
    womensLeague: "Femmes",
    scheduleGame: "Programmer un Match",
    editGame: "Modifier le Match",
    cancelEdit: "Annuler",
    saveGame: "Enregistrer",
    updateGame: "Mettre à jour",
    deleteGame: "Supprimer",
    week: "Journée",
    selectWeek: "Sélectionner la Journée",
    homeTeam: "Équipe Locale",
    awayTeam: "Équipe Visiteur",
    selectTeam: "Sélectionner...",
    date: "Date",
    time: "Heure",
    venue: "Lieu",
    selectVenue: "Sélectionner...",
    referees: "Arbitres",
    selectReferees: "Assigner des arbitres (optionnel)",
    noGamesScheduled: "Aucun match programmé",
    noGamesForWeek: "Aucun match pour cette journée",
    scheduledGames: "Matchs Programmés",
    upcomingGames: "Matchs à Venir",
    pastGames: "Matchs Terminés",
    liveGames: "Matchs en Direct",
    gameStatus: {
      scheduled: "Programmé",
      live: "En Direct",
      completed: "Terminé",
      postponed: "Reporté",
      cancelled: "Annulé",
    },
    vs: "vs",
    at: "@",
    confirmDelete: "Êtes-vous sûr de vouloir supprimer ce match?",
    errorSelectBothTeams: "Veuillez sélectionner les deux équipes",
    errorSameTeam: "Les équipes doivent être différentes",
    errorRequiredFields: "La date, l'heure et le lieu sont requis",
    successCreated: "Match programmé avec succès",
    successUpdated: "Match mis à jour avec succès",
    successDeleted: "Match supprimé avec succès",
    loading: "Chargement...",
    enterScore: "Entrer le Score",
    homeScore: "Score Local",
    awayScore: "Score Visiteur",
    saveScore: "Enregistrer",
    markComplete: "Terminer",
    quickActions: "Actions Rapides",
    bulkSchedule: "Planification en Lot",
    exportSchedule: "Exporter",
    seasonArchive: "Archive de la Saison",
    currentSeason: "Saison 2024-25",
    totalGames: "Total des Matchs",
    completed: "Terminés",
    upcoming: "À Venir",
    createMatchday: "Créer une Journée",
    editMatchday: "Modifier la Journée",
    matchdayNumber: "Numéro de Journée",
    startDate: "Date de Début",
    endDate: "Date de Fin",
    saveMatchday: "Enregistrer",
    deleteMatchday: "Supprimer la Journée",
    viewGames: "Voir les Matchs",
    noMatchdays: "Aucune journée créée",
    createMatchdayDesc: "Créer des journées pour organiser les matchs par semaine avec des plages de dates",
    matchday: "Journée",
    gamesInMatchday: "Matchs de cette journée",
    backToMatchdays: "Retour aux Journées",
    matchdayDateRange: "Période",
    noGamesForDate: "Aucun match programmé pour cette date",
    selectDate: "Sélectionnez une date pour afficher les matchs",
    downloadPDF: "Télécharger PDF",
  },
};

const initialFormState: GameFormState = {
  gender: "men",
  week: 1,
  homeTeamId: "",
  awayTeamId: "",
  date: "",
  time: "",
  venue: "",
  refereeIds: [],
};

const initialMatchdayFormState: MatchdayFormState = {
  week: 1,
  startDate: "",
  endDate: "",
  gender: "all",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GamesPage() {
  const { language, currentAdminUser } = useAdmin();
  const t = translations[language];

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("matchday");
  const [calendarViewType, setCalendarViewType] = useState<CalendarViewType>("calendar");
  const [filterGender, setFilterGender] = useState<FilterGender>("all");
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedMatchday, setSelectedMatchday] = useState<Matchday | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Data state
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [formState, setFormState] = useState<GameFormState>(initialFormState);
  const [matchdayFormVisible, setMatchdayFormVisible] = useState(false);
  const [matchdayFormState, setMatchdayFormState] = useState<MatchdayFormState>(initialMatchdayFormState);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Score entry state
  const [scoreEntryGame, setScoreEntryGame] = useState<Game | null>(null);
  const [scoreForm, setScoreForm] = useState({ homeScore: "", awayScore: "" });

  // Current season (could be dynamic)
  const currentSeasonId = "2024-25";

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch games
  useEffect(() => {
    const gamesQuery = query(
      collection(firebaseDB, "games"),
      orderBy("date", "asc")
    );

    const unsubscribe = onSnapshot(gamesQuery, (snapshot) => {
      const fetchedGames: Game[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          gender: data.gender || "men",
          week: data.week || 1,
          seasonId: data.seasonId || currentSeasonId,
          homeTeamId: data.homeTeamId,
          homeTeamName: data.homeTeamName,
          homeTeamLogo: data.homeTeamLogo,
          awayTeamId: data.awayTeamId,
          awayTeamName: data.awayTeamName,
          awayTeamLogo: data.awayTeamLogo,
          date: data.date,
          time: data.time,
          venue: data.venue,
          venueCity: data.venueCity,
          status: data.status || (data.winnerScore ? "completed" : "scheduled"),
          homeScore: data.homeScore ?? data.winnerScore,
          awayScore: data.awayScore ?? data.loserScore,
          winnerId: data.winnerId || data.winnerTeamId,
          referees: data.referees || [],
          createdAt: data.createdAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
          archivedAt: data.archivedAt?.toDate?.() || null,
        };
      });
      setGames(fetchedGames);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch matchdays
  useEffect(() => {
    const matchdaysQuery = query(
      collection(firebaseDB, "matchdays"),
      orderBy("week", "asc")
    );

    const unsubscribe = onSnapshot(matchdaysQuery, (snapshot) => {
      const fetchedMatchdays: Matchday[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          week: data.week || 1,
          startDate: data.startDate || "",
          endDate: data.endDate || "",
          gender: data.gender || "all",
          seasonId: data.seasonId || currentSeasonId,
          createdAt: data.createdAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
        };
      });
      setMatchdays(fetchedMatchdays);
    });

    return () => unsubscribe();
  }, []);

  // Fetch teams
  useEffect(() => {
    const teamsQuery = query(collection(firebaseDB, "teams"), orderBy("name"));
    const unsubscribe = onSnapshot(teamsQuery, (snapshot) => {
      setTeams(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().name,
          gender: docSnap.data().gender || "men",
          logo: docSnap.data().logo || "",
          wins: docSnap.data().wins || 0,
          losses: docSnap.data().losses || 0,
        }))
      );
    });
    return () => unsubscribe();
  }, []);

  // Fetch venues
  useEffect(() => {
    const venuesQuery = query(collection(firebaseDB, "venues"), orderBy("name"));
    const unsubscribe = onSnapshot(venuesQuery, (snapshot) => {
      setVenues(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().name,
          city: docSnap.data().city || "",
          capacity: docSnap.data().capacity,
        }))
      );
    });
    return () => unsubscribe();
  }, []);

  // Fetch referees
  useEffect(() => {
    const refereesQuery = query(collection(firebaseDB, "referees"), orderBy("lastName"));
    const unsubscribe = onSnapshot(refereesQuery, (snapshot) => {
      setReferees(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          firstName: docSnap.data().firstName,
          lastName: docSnap.data().lastName,
        }))
      );
    });
    return () => unsubscribe();
  }, []);

  // ============================================================================
  // COMPUTED DATA
  // ============================================================================

  // Filter teams by selected gender
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => team.gender === formState.gender);
  }, [teams, formState.gender]);

  // Filter games based on current view and filters
  const filteredGames = useMemo(() => {
    let result = games;

    // Filter by gender
    if (filterGender !== "all") {
      result = result.filter((g) => g.gender === filterGender);
    }

    // Filter by week in matchday view (when viewing games list)
    if (viewMode === "matchday" && selectedMatchday) {
      // Filter games by date range of the selected matchday
      result = result.filter((g) => {
        const gameDate = g.date;
        return gameDate >= selectedMatchday.startDate && gameDate <= selectedMatchday.endDate;
      });
      // Also filter by matchday gender if not "all"
      if (selectedMatchday.gender !== "all") {
        result = result.filter((g) => g.gender === selectedMatchday.gender);
      }
    } else if (viewMode === "matchday" && !selectedMatchday) {
      // If no matchday is selected, filter by selected week number
      result = result.filter((g) => g.week === selectedWeek);
    }

    return result;
  }, [games, filterGender, viewMode, selectedWeek, selectedMatchday]);

  // Group games by date (for schedule view)
  const gamesByDate = useMemo(() => {
    const grouped: Record<string, Game[]> = {};
    filteredGames.forEach((game) => {
      if (!grouped[game.date]) {
        grouped[game.date] = [];
      }
      grouped[game.date].push(game);
    });
    return grouped;
  }, [filteredGames]);

  // Group games by week (for archive view)
  const gamesByWeek = useMemo(() => {
    const grouped: Record<number, Game[]> = {};
    filteredGames.forEach((game) => {
      if (!grouped[game.week]) {
        grouped[game.week] = [];
      }
      grouped[game.week].push(game);
    });
    return grouped;
  }, [filteredGames]);

  // Stats
  const stats = useMemo(() => {
    const total = games.length;
    const completed = games.filter((g) => g.status === "completed").length;
    const upcoming = games.filter((g) => g.status === "scheduled").length;
    return { total, completed, upcoming };
  }, [games]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const resetForm = () => {
    setFormState(initialFormState);
    setFormVisible(false);
    setStatusMessage(null);
  };

  const resetMatchdayForm = () => {
    setMatchdayFormState(initialMatchdayFormState);
    setMatchdayFormVisible(false);
  };

  const handleEditMatchday = (matchday: Matchday) => {
    setMatchdayFormState({
      id: matchday.id,
      week: matchday.week,
      startDate: matchday.startDate,
      endDate: matchday.endDate,
      gender: matchday.gender,
    });
    setMatchdayFormVisible(true);
  };

  const handleSubmitMatchday = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentAdminUser) return;

    if (!matchdayFormState.startDate || !matchdayFormState.endDate) {
      setStatusMessage({ type: "error", message: "Please select start and end dates" });
      return;
    }

    if (matchdayFormState.startDate > matchdayFormState.endDate) {
      setStatusMessage({ type: "error", message: "Start date must be before end date" });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        week: matchdayFormState.week,
        startDate: matchdayFormState.startDate,
        endDate: matchdayFormState.endDate,
        gender: matchdayFormState.gender,
        seasonId: currentSeasonId,
        updatedAt: serverTimestamp(),
      };

      if (matchdayFormState.id) {
        await updateDoc(doc(firebaseDB, "matchdays", matchdayFormState.id), payload);
        setStatusMessage({ type: "success", message: "Matchday updated successfully" });
      } else {
        await addDoc(collection(firebaseDB, "matchdays"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setStatusMessage({ type: "success", message: "Matchday created successfully" });
      }

      resetMatchdayForm();
    } catch (error) {
      console.error("Error saving matchday:", error);
      setStatusMessage({ type: "error", message: "Failed to save matchday" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMatchday = async (matchday: Matchday) => {
    if (!window.confirm("Are you sure you want to delete this matchday?")) return;

    try {
      await deleteDoc(doc(firebaseDB, "matchdays", matchday.id));
      setStatusMessage({ type: "success", message: "Matchday deleted successfully" });
      if (selectedMatchday?.id === matchday.id) {
        setSelectedMatchday(null);
      }
    } catch (error) {
      console.error("Error deleting matchday:", error);
      setStatusMessage({ type: "error", message: "Failed to delete matchday" });
    }
  };

  const handleEditGame = (game: Game) => {
    setFormState({
      id: game.id,
      gender: game.gender,
      week: game.week,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      date: game.date,
      time: game.time,
      venue: game.venue,
      refereeIds: game.referees || [],
    });
    setFormVisible(true);
    setStatusMessage({ type: "info", message: t.editGame });
  };

  const handleSubmitGame = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentAdminUser) return;

    // Validation
    if (!formState.homeTeamId || !formState.awayTeamId) {
      setStatusMessage({ type: "error", message: t.errorSelectBothTeams });
      return;
    }
    if (formState.homeTeamId === formState.awayTeamId) {
      setStatusMessage({ type: "error", message: t.errorSameTeam });
      return;
    }
    if (!formState.date || !formState.time || !formState.venue) {
      setStatusMessage({ type: "error", message: t.errorRequiredFields });
      return;
    }

    setSubmitting(true);

    try {
      const homeTeam = teams.find((team) => team.id === formState.homeTeamId);
      const awayTeam = teams.find((team) => team.id === formState.awayTeamId);
      const selectedVenue = venues.find((v) => v.name === formState.venue);

      if (!homeTeam || !awayTeam) {
        setStatusMessage({ type: "error", message: t.errorSelectBothTeams });
        return;
      }

      const payload = {
        gender: formState.gender,
        week: formState.week,
        seasonId: currentSeasonId,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        homeTeamLogo: homeTeam.logo,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        awayTeamLogo: awayTeam.logo,
        date: formState.date,
        time: formState.time,
        venue: formState.venue,
        venueCity: selectedVenue?.city || "",
        referees: formState.refereeIds,
        status: "scheduled",
        updatedAt: serverTimestamp(),
      };

      if (formState.id) {
        await updateDoc(doc(firebaseDB, "games", formState.id), payload);
        setStatusMessage({ type: "success", message: t.successUpdated });
      } else {
        await addDoc(collection(firebaseDB, "games"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setStatusMessage({ type: "success", message: t.successCreated });
      }

      resetForm();
    } catch (error) {
      console.error("Error saving game:", error);
      setStatusMessage({ type: "error", message: "Failed to save game" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGame = async (game: Game) => {
    if (!window.confirm(t.confirmDelete)) return;

    try {
      await deleteDoc(doc(firebaseDB, "games", game.id));
      setStatusMessage({ type: "success", message: t.successDeleted });
    } catch (error) {
      console.error("Error deleting game:", error);
      setStatusMessage({ type: "error", message: "Failed to delete game" });
    }
  };

  const handleSaveScore = async () => {
    if (!scoreEntryGame) return;

    const homeScore = parseInt(scoreForm.homeScore);
    const awayScore = parseInt(scoreForm.awayScore);

    if (isNaN(homeScore) || isNaN(awayScore)) {
      setStatusMessage({ type: "error", message: "Please enter valid scores" });
      return;
    }

    try {
      const winnerId = homeScore > awayScore ? scoreEntryGame.homeTeamId : scoreEntryGame.awayTeamId;

      await updateDoc(doc(firebaseDB, "games", scoreEntryGame.id), {
        homeScore,
        awayScore,
        winnerId,
        status: "completed",
        updatedAt: serverTimestamp(),
        archivedAt: serverTimestamp(),
      });

      // Update team records
      const winnerRef = doc(firebaseDB, "teams", winnerId);
      const loserRef = doc(firebaseDB, "teams", winnerId === scoreEntryGame.homeTeamId ? scoreEntryGame.awayTeamId : scoreEntryGame.homeTeamId);

      const winnerTeam = teams.find((team) => team.id === winnerId);
      const loserTeam = teams.find((team) => team.id !== winnerId && (team.id === scoreEntryGame.homeTeamId || team.id === scoreEntryGame.awayTeamId));

      if (winnerTeam) {
        await updateDoc(winnerRef, { wins: (winnerTeam.wins || 0) + 1 });
      }
      if (loserTeam) {
        await updateDoc(loserRef, { losses: (loserTeam.losses || 0) + 1 });
      }

      setScoreEntryGame(null);
      setScoreForm({ homeScore: "", awayScore: "" });
      setStatusMessage({ type: "success", message: "Score saved and game archived" });
    } catch (error) {
      console.error("Error saving score:", error);
      setStatusMessage({ type: "error", message: "Failed to save score" });
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.text(language === "fr" ? "Liste des Matchs" : "Games List", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // Date/Matchday info
    doc.setFontSize(12);
    if (selectedMatchday) {
      doc.text(
        `${t.week} ${selectedMatchday.week} - ${selectedMatchday.startDate} ${language === "fr" ? "à" : "to"} ${selectedMatchday.endDate}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );
    } else if (selectedDate) {
      const dateFormatted = new Date(selectedDate + "T00:00:00").toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      doc.text(`${dateFormatted}`, pageWidth / 2, yPosition, { align: "center" });
    }
    yPosition += 12;

    // Games table data
    const tableData = filteredGames.map((game, idx) => [
      idx + 1,
      game.homeTeamName,
      game.awayTeamName,
      formatDate(game.date),
      game.time,
      game.venue,
      game.status ? t.gameStatus[game.status] : "Unknown",
      game.homeScore !== undefined && game.awayScore !== undefined ? `${game.homeScore}-${game.awayScore}` : "-",
    ]);

    // Add table using autotable
    autoTable(doc, {
      head: [
        [
          "#",
          language === "fr" ? "Équipe Locale" : "Home Team",
          language === "fr" ? "Équipe Visiteur" : "Away Team",
          language === "fr" ? "Date" : "Date",
          language === "fr" ? "Heure" : "Time",
          language === "fr" ? "Lieu" : "Venue",
          language === "fr" ? "Statut" : "Status",
          language === "fr" ? "Score" : "Score",
        ],
      ],
      body: tableData,
      startY: yPosition,
      margin: { top: 20, right: 10, bottom: 10, left: 10 },
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [255, 140, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240],
      },
    });

    // Add timestamp at the bottom
    const currentDate = new Date();
    const timestamp = currentDate.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }) + " " + currentDate.toLocaleTimeString(language === "fr" ? "fr-FR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128); // Grey color
    doc.text(
      `${language === "fr" ? "Téléchargé le" : "Downloaded"}: ${timestamp}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    // Download the PDF
    const filename = selectedMatchday
      ? `games_week${selectedMatchday.week}_${new Date().getTime()}.pdf`
      : `games_${selectedDate}_${new Date().getTime()}.pdf`;
    doc.save(filename);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: Game["status"]) => {
    const styles: Record<Game["status"], string> = {
      scheduled: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      live: "bg-red-500/20 text-red-300 border-red-500/30 animate-pulse",
      completed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
      postponed: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      cancelled: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}>
        {status === "live" && <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
        {t.gameStatus[status]}
      </span>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{t.totalGames}</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
            <p className="text-[10px] uppercase tracking-wider text-green-500/70">{t.completed}</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.upcoming}</p>
            <p className="text-[10px] uppercase tracking-wider text-blue-500/70">{t.upcoming}</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            statusMessage.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-300"
              : statusMessage.type === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-blue-500/30 bg-blue-500/10 text-blue-300"
          }`}
        >
          {statusMessage.message}
        </div>
      )}

      {/* View Mode & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* View Mode Tabs */}
        <div className="flex rounded-xl bg-slate-900/60 border border-white/10 p-1">
          <button
            onClick={() => setViewMode("matchday")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === "matchday" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.matchdayView}
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === "calendar" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.calendarView}
          </button>
          <button
            onClick={() => setViewMode("schedule")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === "schedule" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.scheduleView}
          </button>
          <button
            onClick={() => setViewMode("archive")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === "archive" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.archiveView}
          </button>
        </div>

        {/* Gender Filter - Hidden when viewing matchday grid, shown otherwise */}
        {!(viewMode === "matchday" && !selectedMatchday) && (
          <div className="flex rounded-xl bg-slate-900/60 border border-white/10 p-1">
            <button
              onClick={() => setFilterGender("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterGender === "all" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {t.allGenders}
            </button>
            <button
              onClick={() => setFilterGender("men")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterGender === "men" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {t.mensLeague}
            </button>
            <button
              onClick={() => setFilterGender("women")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterGender === "women" ? "bg-pink-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {t.womensLeague}
            </button>
          </div>
        )}

        {/* Create Matchday Button (only in matchday view when no matchday selected) */}
        {viewMode === "matchday" && !selectedMatchday && (
          <button
            onClick={() => {
              setMatchdayFormState(initialMatchdayFormState);
              setMatchdayFormVisible(true);
            }}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition"
          >
            + {t.createMatchday}
          </button>
        )}

        {/* Schedule Button (show when matchday is selected) */}
        {viewMode === "matchday" && selectedMatchday && (
          <button
            onClick={() => {
              setFormState({ ...initialFormState, week: selectedMatchday.week });
              setFormVisible(true);
            }}
            className="ml-auto rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition"
          >
            + {t.scheduleGame}
          </button>
        )}

        {/* Schedule Button for non-matchday views */}
        {viewMode !== "matchday" && (
          <button
            onClick={() => {
              setFormState({ ...initialFormState, week: selectedWeek });
              setFormVisible(true);
            }}
            className="ml-auto rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition"
          >
            + {t.scheduleGame}
          </button>
        )}

        {/* Download PDF Button */}
        {(viewMode === "matchday" && selectedMatchday && filteredGames.length > 0) ||
        (viewMode === "calendar" && selectedDate && filteredGames.length > 0) ? (
          <button
            onClick={handleDownloadPDF}
            className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {t.downloadPDF}
          </button>
        ) : null}
      </div>

      {/* Matchday Form Modal */}
      {matchdayFormVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">
              {matchdayFormState.id ? t.editMatchday : t.createMatchday}
            </h2>

            <form onSubmit={handleSubmitMatchday} className="space-y-5">
              {/* Matchday Number */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.matchdayNumber}</label>
                <select
                  value={matchdayFormState.week}
                  onChange={(e) => setMatchdayFormState((prev) => ({ ...prev, week: parseInt(e.target.value) }))}
                  aria-label={t.matchdayNumber}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-orange-500"
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((week) => (
                    <option key={week} value={week}>
                      {t.week} {week}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">League</label>
                <div className="flex rounded-lg bg-slate-950/60 border border-white/10 p-1">
                  <button
                    type="button"
                    onClick={() => setMatchdayFormState((prev) => ({ ...prev, gender: "all" }))}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      matchdayFormState.gender === "all" ? "bg-slate-700 text-white" : "text-slate-400"
                    }`}
                  >
                    {t.allGenders}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchdayFormState((prev) => ({ ...prev, gender: "men" }))}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      matchdayFormState.gender === "men" ? "bg-blue-500 text-white" : "text-slate-400"
                    }`}
                  >
                    {t.mensLeague}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchdayFormState((prev) => ({ ...prev, gender: "women" }))}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      matchdayFormState.gender === "women" ? "bg-pink-500 text-white" : "text-slate-400"
                    }`}
                  >
                    {t.womensLeague}
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.startDate}</label>
                  <input
                    type="date"
                    value={matchdayFormState.startDate}
                    onChange={(e) => setMatchdayFormState((prev) => ({ ...prev, startDate: e.target.value }))}
                    aria-label={t.startDate}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.endDate}</label>
                  <input
                    type="date"
                    value={matchdayFormState.endDate}
                    onChange={(e) => setMatchdayFormState((prev) => ({ ...prev, endDate: e.target.value }))}
                    aria-label={t.endDate}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-orange-500"
                    required
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition disabled:opacity-50"
                >
                  {submitting ? t.loading : t.saveMatchday}
                </button>
                <button
                  type="button"
                  onClick={resetMatchdayForm}
                  className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
                >
                  {t.cancelEdit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Game Form Modal */}
      {formVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">
              {formState.id ? t.editGame : t.scheduleGame}
            </h2>

            <form onSubmit={handleSubmitGame} className="space-y-5">
              {/* Gender & Week Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Gender */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">League</label>
                  <div className="flex rounded-lg bg-slate-950/60 border border-white/10 p-1">
                    <button
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, gender: "men", homeTeamId: "", awayTeamId: "" }))}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                        formState.gender === "men" ? "bg-blue-500 text-white" : "text-slate-400"
                      }`}
                    >
                      {t.mensLeague}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, gender: "women", homeTeamId: "", awayTeamId: "" }))}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                        formState.gender === "women" ? "bg-pink-500 text-white" : "text-slate-400"
                      }`}
                    >
                      {t.womensLeague}
                    </button>
                  </div>
                </div>

                {/* Week */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.week}</label>
                  <select
                    value={formState.week}
                    onChange={(e) => setFormState((prev) => ({ ...prev, week: parseInt(e.target.value) }))}
                    aria-label={t.week}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-orange-500"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((week) => (
                      <option key={week} value={week}>
                        {t.week} {week}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Teams Selection */}
              <div className="space-y-4">
                {/* Home Team */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.homeTeam}</label>
                  <select
                    value={formState.homeTeamId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, homeTeamId: e.target.value }))}
                    aria-label={t.homeTeam}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:border-orange-500"
                    required
                  >
                    <option value="">{t.selectTeam}</option>
                    {filteredTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* VS Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <span className="text-sm font-bold text-slate-500">{t.vs}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                </div>

                {/* Away Team */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.awayTeam}</label>
                  <select
                    value={formState.awayTeamId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, awayTeamId: e.target.value }))}
                    aria-label={t.awayTeam}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:border-orange-500"
                    required
                  >
                    <option value="">{t.selectTeam}</option>
                    {filteredTeams
                      .filter((team) => team.id !== formState.homeTeamId)
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Date, Time, Venue */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.date}</label>
                  <input
                    type="date"
                    value={formState.date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                    aria-label={t.date}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.time}</label>
                  <input
                    type="time"
                    value={formState.time}
                    onChange={(e) => setFormState((prev) => ({ ...prev, time: e.target.value }))}
                    aria-label={t.time}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.venue}</label>
                  <select
                    value={formState.venue}
                    onChange={(e) => setFormState((prev) => ({ ...prev, venue: e.target.value }))}
                    aria-label={t.venue}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-orange-500"
                    required
                  >
                    <option value="">{t.selectVenue}</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.name}>
                        {venue.name} ({venue.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Referees (Optional) */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t.referees}</label>
                <select
                  multiple
                  value={formState.refereeIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                    setFormState((prev) => ({ ...prev, refereeIds: selected }));
                  }}
                  aria-label={t.referees}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-orange-500 min-h-[80px]"
                >
                  {referees.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.firstName} {ref.lastName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">{t.selectReferees}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition disabled:opacity-50"
                >
                  {submitting ? t.loading : formState.id ? t.updateGame : t.saveGame}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
                >
                  {t.cancelEdit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Score Entry Modal */}
      {scoreEntryGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">{t.enterScore}</h2>

            <div className="space-y-4">
              {/* Teams Display */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-white/10">
                <div className="flex items-center gap-2">
                  {scoreEntryGame.homeTeamLogo && (
                    <Image src={scoreEntryGame.homeTeamLogo} alt="" width={32} height={32} className="rounded-full" unoptimized />
                  )}
                  <span className="font-semibold text-white">{scoreEntryGame.homeTeamName}</span>
                </div>
                <span className="text-slate-500">{t.vs}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{scoreEntryGame.awayTeamName}</span>
                  {scoreEntryGame.awayTeamLogo && (
                    <Image src={scoreEntryGame.awayTeamLogo} alt="" width={32} height={32} className="rounded-full" unoptimized />
                  )}
                </div>
              </div>

              {/* Score Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">{t.homeScore}</label>
                  <input
                    type="number"
                    value={scoreForm.homeScore}
                    onChange={(e) => setScoreForm((prev) => ({ ...prev, homeScore: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-2xl text-center font-bold text-white focus:border-orange-500"
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">{t.awayScore}</label>
                  <input
                    type="number"
                    value={scoreForm.awayScore}
                    onChange={(e) => setScoreForm((prev) => ({ ...prev, awayScore: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-2xl text-center font-bold text-white focus:border-orange-500"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveScore}
                  className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition"
                >
                  {t.saveScore}
                </button>
                <button
                  onClick={() => {
                    setScoreEntryGame(null);
                    setScoreForm({ homeScore: "", awayScore: "" });
                  }}
                  className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
                >
                  {t.cancelEdit}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Games Display */}
      {viewMode === "matchday" && (
        <div className="space-y-4">
          {/* Show matchday list or games within selected matchday */}
          {!selectedMatchday ? (
            <>
              {/* Matchday Grid */}
              {matchdays.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{t.noMatchdays}</h3>
                  <p className="text-slate-400 mb-4">{t.createMatchdayDesc}</p>
                  <button
                    onClick={() => setMatchdayFormVisible(true)}
                    className="rounded-lg bg-indigo-500 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition"
                  >
                    + {t.createMatchday}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {matchdays
                    .sort((a, b) => a.week - b.week)
                    .map((matchday) => {
                      // Count games in this matchday
                      const matchdayGames = games.filter((g) => {
                        if (!matchday.startDate || !matchday.endDate) return false;
                        const gameDate = g.date;
                        return gameDate >= matchday.startDate && gameDate <= matchday.endDate;
                      });
                      const startFormatted = matchday.startDate ? new Date(matchday.startDate + "T00:00:00").toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric" }) : "";
                      const endFormatted = matchday.endDate ? new Date(matchday.endDate + "T00:00:00").toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric" }) : "";

                      return (
                        <div
                          key={matchday.id}
                          className="group relative rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 cursor-pointer hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
                          onClick={() => setSelectedMatchday(matchday)}
                        >
                          {/* Edit/Delete buttons */}
                          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditMatchday(matchday);
                              }}
                              className="rounded-lg bg-slate-800/80 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                              title={t.editMatchday}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMatchday(matchday);
                              }}
                              className="rounded-lg bg-slate-800/80 p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition"
                              title={t.deleteMatchday}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>

                          {/* Matchday Content */}
                          <div className="text-center">
                            <p className="text-xs uppercase tracking-[0.2em] text-indigo-400 mb-1">{t.matchday}</p>
                            <h3 className="text-3xl font-bold text-white mb-3">{matchday.week}</h3>
                            <div className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-3 py-1 text-sm text-slate-300">
                              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {startFormatted} - {endFormatted}
                            </div>
                            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {matchdayGames.length} {matchdayGames.length === 1 ? (language === "fr" ? "match" : "game") : (language === "fr" ? "matchs" : "games")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Selected Matchday Header with Back Button */}
              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSelectedMatchday(null)}
                      className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white hover:border-white/20 transition"
                      title={t.backToMatchdays}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">{t.matchday}</p>
                      <h2 className="text-2xl font-bold text-white mt-1">{t.week} {selectedMatchday.week}</h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">
                      {selectedMatchday.startDate && new Date(selectedMatchday.startDate + "T00:00:00").toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { month: "long", day: "numeric" })}
                      {" "}-{" "}
                      {selectedMatchday.endDate && new Date(selectedMatchday.endDate + "T00:00:00").toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { month: "long", day: "numeric" })}
                    </p>
                    <p className="text-sm font-medium text-white mt-1">
                      {filteredGames.length} {filteredGames.length === 1 ? (language === "fr" ? "match programmé" : "game scheduled") : (language === "fr" ? "matchs programmés" : "games scheduled")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Games List for Selected Matchday */}
              {filteredGames.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-12 text-center">
                  <p className="text-slate-400">{t.noGamesForWeek}</p>
                  <button
                    onClick={() => {
                      setFormState({ ...initialFormState, week: selectedMatchday.week });
                      setFormVisible(true);
                    }}
                    className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition"
                  >
                    + {t.scheduleGame}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredGames.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      t={t}
                      formatDate={formatDate}
                      getStatusBadge={getStatusBadge}
                      onEdit={handleEditGame}
                      onDelete={handleDeleteGame}
                      onEnterScore={() => {
                        setScoreEntryGame(game);
                        setScoreForm({
                          homeScore: game.homeScore?.toString() || "",
                          awayScore: game.awayScore?.toString() || "",
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {viewMode === "schedule" && (
        <div className="space-y-6">
          {Object.keys(gamesByDate).length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-12 text-center">
              <p className="text-slate-400">{t.noGamesScheduled}</p>
            </div>
          ) : (
            Object.entries(gamesByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, dateGames]) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white">{formatDate(date)}</h3>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                      {dateGames.length} {dateGames.length === 1 ? "game" : "games"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {dateGames.map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        t={t}
                        formatDate={formatDate}
                        getStatusBadge={getStatusBadge}
                        onEdit={handleEditGame}
                        onDelete={handleDeleteGame}
                        onEnterScore={() => {
                          setScoreEntryGame(game);
                          setScoreForm({
                            homeScore: game.homeScore?.toString() || "",
                            awayScore: game.awayScore?.toString() || "",
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {viewMode === "archive" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-6">
            <h2 className="text-xl font-bold text-white">{t.seasonArchive}</h2>
            <p className="text-sm text-slate-400 mt-1">{t.currentSeason}</p>
          </div>

          {Object.keys(gamesByWeek).length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-12 text-center">
              <p className="text-slate-400">{t.noGamesScheduled}</p>
            </div>
          ) : (
            Object.entries(gamesByWeek)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([week, weekGames]) => {
                const completedCount = weekGames.filter((g) => g.status === "completed").length;
                return (
                  <details key={week} className="group rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
                    <summary className="flex items-center justify-between cursor-pointer p-5 hover:bg-slate-800/40 transition">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                          {week}
                        </span>
                        <div>
                          <h3 className="font-semibold text-white">{t.week} {week}</h3>
                          <p className="text-xs text-slate-500">
                            {weekGames.length} games • {completedCount} completed
                          </p>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-5 pb-5 space-y-2">
                      {weekGames.map((game) => (
                        <GameCard
                          key={game.id}
                          game={game}
                          t={t}
                          formatDate={formatDate}
                          getStatusBadge={getStatusBadge}
                          onEdit={handleEditGame}
                          onDelete={handleDeleteGame}
                          onEnterScore={() => {
                            setScoreEntryGame(game);
                            setScoreForm({
                              homeScore: game.homeScore?.toString() || "",
                              awayScore: game.awayScore?.toString() || "",
                            });
                          }}
                          compact
                        />
                      ))}
                    </div>
                  </details>
                );
              })
          )}
        </div>
      )}

      {viewMode === "calendar" && (
        <div className="space-y-6">
          {/* Calendar Header */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">{t.calendarView}</p>
                <h2 className="text-2xl font-bold text-white mt-1">
                  {currentMonth.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white hover:border-white/20 transition"
                  title={language === "fr" ? "Mois précédent" : "Previous month"}
                  aria-label={language === "fr" ? "Mois précédent" : "Previous month"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white hover:border-white/20 transition"
                  title={language === "fr" ? "Mois suivant" : "Next month"}
                  aria-label={language === "fr" ? "Mois suivant" : "Next month"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Calendar and Games Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar Grid */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
                      {language === "fr" ? (["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day)]) : day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {(() => {
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const days = [];

                    // Empty cells for days before month starts
                    for (let i = 0; i < firstDay; i++) {
                      days.push(null);
                    }

                    // Days of the month
                    for (let i = 1; i <= daysInMonth; i++) {
                      days.push(i);
                    }

                    return days.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="aspect-square" />;
                      }

                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const dayGames = games.filter((g) => g.date === dateStr);
                      const isSelected = selectedDate === dateStr;

                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                          className={`aspect-square rounded-lg text-sm font-medium transition ${
                            isSelected
                              ? "bg-indigo-500 text-white border-indigo-500"
                              : dayGames.length > 0
                              ? "bg-slate-800 border-orange-500/50 text-white hover:border-orange-500 border"
                              : "bg-slate-800/40 text-slate-500 hover:bg-slate-800/60"
                          } border relative`}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span>{day}</span>
                            {dayGames.length > 0 && <span className="text-xs text-orange-400 mt-1">{dayGames.length}</span>}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Games for Selected Date */}
            <div className="lg:col-span-2">
              {selectedDate ? (
                <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">{t.selectDate}</p>
                    <h3 className="text-2xl font-bold text-white mt-1">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </h3>
                  </div>

                  {(() => {
                    const dateGames = games.filter((g) => g.date === selectedDate);
                    return dateGames.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-slate-800/40 p-8 text-center">
                        <p className="text-slate-400">{t.noGamesForDate}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dateGames.map((game) => (
                          <GameCard
                            key={game.id}
                            game={game}
                            t={t}
                            formatDate={formatDate}
                            getStatusBadge={getStatusBadge}
                            onEdit={handleEditGame}
                            onDelete={handleDeleteGame}
                            onEnterScore={() => {
                              setScoreEntryGame(game);
                              setScoreForm({
                                homeScore: game.homeScore?.toString() || "",
                                awayScore: game.awayScore?.toString() || "",
                              });
                            }}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{t.selectDate}</h3>
                  <p className="text-slate-400">{t.noGamesForDate}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* GAME CARD COMPONENT */}
      {/* ============================================================================ */}
    </div>
  );
}

// ============================================================================
// GAME CARD COMPONENT
// ============================================================================

type GameCardProps = {
  game: Game;
  t: typeof translations["en"];
  formatDate: (date: string) => string;
  getStatusBadge: (status: Game["status"]) => React.ReactNode;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
  onEnterScore: () => void;
  compact?: boolean;
};

function GameCard({ game, t, formatDate, getStatusBadge, onEdit, onDelete, onEnterScore, compact }: GameCardProps) {
  const isCompleted = game.status === "completed";

  return (
    <div
      className={`rounded-xl border transition-all ${
        isCompleted
          ? "border-slate-700/40 bg-slate-900/40"
          : game.status === "live"
          ? "border-red-500/40 bg-red-500/5"
          : "border-white/10 bg-slate-950/60 hover:border-white/20"
      } ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Teams & Score */}
        <div className="flex items-center gap-4 flex-1">
          {/* Week Badge */}
          <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-[10px] text-indigo-400 uppercase">J{game.week}</span>
            <span className="text-xs font-bold text-indigo-300">{game.gender === "men" ? "M" : "F"}</span>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {game.awayTeamLogo && (
              <Image src={game.awayTeamLogo} alt="" width={compact ? 28 : 36} height={compact ? 28 : 36} className="rounded-full flex-shrink-0" unoptimized />
            )}
            <div className="min-w-0">
              <p className={`font-semibold text-white truncate ${compact ? "text-sm" : ""}`}>{game.awayTeamName}</p>
              {!compact && <p className="text-[10px] text-slate-500 uppercase">{t.awayTeam}</p>}
            </div>
            {isCompleted && (
              <span className={`font-bold ${game.winnerId === game.awayTeamId ? "text-green-400" : "text-slate-400"} ${compact ? "text-lg" : "text-xl"}`}>
                {game.awayScore}
              </span>
            )}
          </div>

          {/* VS / Score */}
          <div className="flex-shrink-0 text-center">
            {isCompleted ? (
              <span className="text-xs text-slate-600 uppercase">{t.gameStatus.completed}</span>
            ) : (
              <span className="text-sm text-slate-500">{t.at}</span>
            )}
          </div>

          {/* Home Team */}
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            {isCompleted && (
              <span className={`font-bold ${game.winnerId === game.homeTeamId ? "text-green-400" : "text-slate-400"} ${compact ? "text-lg" : "text-xl"}`}>
                {game.homeScore}
              </span>
            )}
            <div className="min-w-0 text-right">
              <p className={`font-semibold text-white truncate ${compact ? "text-sm" : ""}`}>{game.homeTeamName}</p>
              {!compact && <p className="text-[10px] text-slate-500 uppercase">{t.homeTeam}</p>}
            </div>
            {game.homeTeamLogo && (
              <Image src={game.homeTeamLogo} alt="" width={compact ? 28 : 36} height={compact ? 28 : 36} className="rounded-full flex-shrink-0" unoptimized />
            )}
          </div>
        </div>

        {/* Game Info & Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Date/Time/Venue */}
          <div className="hidden md:block text-right">
            <p className="text-sm text-slate-300">{formatDate(game.date)}</p>
            <p className="text-xs text-slate-500">{game.time} • {game.venue}</p>
          </div>

          {/* Status Badge */}
          {getStatusBadge(game.status)}

          {/* Actions */}
          <div className="flex gap-1">
            {!isCompleted && (
              <button
                onClick={onEnterScore}
                className="rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 transition"
                title={t.enterScore}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onEdit(game)}
              className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white hover:border-white/20 transition"
              title={t.editGame}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {!isCompleted && (
              <button
                onClick={() => onDelete(game)}
                className="rounded-lg border border-rose-500/30 p-2 text-rose-400 hover:bg-rose-500/10 transition"
                title={t.deleteGame}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Info Row */}
      <div className="md:hidden mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
        <span>{formatDate(game.date)} • {game.time}</span>
        <span>{game.venue}</span>
      </div>
    </div>
  );
}
