"use client";

import type { FormEvent, ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { firebaseAuth, firebaseDB, firebaseStorage } from "@/lib/firebase";
import { franchises as menFranchises, franchisesWomen, type GenderKey } from "@/data/febaco";
import { countries, flagFromCode } from "@/data/countries";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import type { AdminUser, AdminRole } from "@/types/admin";
import type { AuditLog } from "@/types/auditLog";
import { 
  createAdminAccount, 
  getAllAdminUsers, 
  updateAdminRoles, 
  deactivateAdminUser, 
  reactivateAdminUser,
  deleteAdminUser,
  getAdminUser,
  recordLastLogin,
  updateAdminProfile,
  updateLastActivity
} from "@/lib/adminAuth";
import { logAuditAction, formatAuditLogDisplay } from "@/lib/auditLog";

type AdminNewsArticle = {
  id: string;
  title: string;
  summary: string;
  category: string;
  headline: string;
  imageUrl?: string;
  createdAt: Date | null;
};

type NewsFormState = {
  id?: string;
  title: string;
  summary: string;
  category: string;
  headline: string;
  imageUrl?: string;
};

type StatusKind = "success" | "error" | "info";

type StatusCallout = {
  type: StatusKind;
  message: string;
};

type AdminTeam = {
  id: string;
  name: string;
  city: string;
  gender: "men" | "women";
  colors: string[];
  logo: string;
  wins: number;
  losses: number;
  totalPoints: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  nationality?: string;
  nationality2?: string;
};

type DirectoryTeam = AdminTeam & {
  source: "firestore" | "static";
};

type TeamFormState = {
  id?: string;
  name: string;
  city: string;
  gender: "men" | "women";
  colorsInput: string;
  logo: string;
  nationality: string;
  nationality2: string;
};

type AdminRosterPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  number: number | null;
  playerLicense: string;
  height: string;
  dateOfBirth?: string;
  position?: string;
  nationality?: string;
  nationality2?: string;
  headshot?: string;
  stats: {
    pts: string;
    reb: string;
    stl: string;
  };
};

type RosterFormState = {
  id?: string;
  firstName: string;
  lastName: string;
  number: string;
  playerLicense: string;
  height: string;
  dateOfBirth: string;
  position: string;
  nationality: string;
  nationality2: string;
  nationality2Enabled?: boolean;
  headshot: string;
  pts: string;
  reb: string;
  stl: string;
};

type CoachStaffRole = "head_coach" | "assistant_coach" | "staff";

type CoachStaff = {
  id: string;
  firstName: string;
  lastName: string;
  role: CoachStaffRole;
  headshot?: string;
};

type CoachStaffFormState = {
  id?: string;
  firstName: string;
  lastName: string;
  role: CoachStaffRole;
  headshot: string;
};

type AdminGame = {
  id: string;
  gender: "men" | "women";
  homeTeamId: string;
  homeTeamName: string;
  homeTeamLogo: string;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamLogo: string;
  date: string;
  time: string;
  venue: string;
  refereeHomeTeam1?: string;
  refereeHomeTeam2?: string;
  refereeAwayTeam?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type GameFormState = {
  id?: string;
  gender: "men" | "women";
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  venue: string;
  refereeHomeTeam1: string;
  refereeHomeTeam2: string;
  refereeAwayTeam: string;
};

type CompletedGame = AdminGame & {
  winnerTeamId?: string;
  winnerScore?: number;
  loserTeamId?: string;
  loserScore?: number;
  playerStats?: {
    playerId: string;
    playerName: string;
    two_pm?: number;
    two_pa?: number;
    three_pm?: number;
    three_pa?: number;
    ft_m?: number;
    ft_a?: number;
    pts: number;
    ast: number;
    oreb?: number;
    dreb?: number;
    reb: number;
    stl: number;
    blk: number;
    min?: number;
    pf?: number;
    to?: number;
  }[];
  completed: boolean;
};

type GameStatsFormState = {
  gameId: string;
  winnerTeamId: string;
  loserTeamId: string;
  winnerScore: string;
  loserScore: string;
};

type TrafficAction = "player_added" | "player_deleted" | "player_transferred";

type TeamTrafficEntry = {
  id: string;
  action: TrafficAction;
  teamId: string;
  teamName: string;
  teamGender: GenderKey;
  playerId: string;
  playerName: string;
  jerseyNumber: number | null;
  performedBy: string | null;
  createdAt: Date | null;
  // For transfers only:
  targetTeamId?: string;
  targetTeamName?: string;
};

type Referee = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  certificationLevel?: string;
  createdAt: Date | null;
};

type RefereeFormState = {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  certificationLevel: string;
};

type CommitteeMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email?: string;
  phone?: string;
  photo?: string;
  createdAt: Date | null;
};

type CommitteeFormState = {
  id?: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  photo?: string;
};

type Venue = {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity?: string;
  courts?: number;
  createdAt: Date | null;
};

type VenueFormState = {
  id?: string;
  name: string;
  address: string;
  city: string;
  capacity: string;
  courts: string;
};

type Partner = {
  id: string;
  name: string;
  logo: string;
  createdAt: Date | null;
};

type PartnerFormState = {
  id?: string;
  name: string;
  logo: string;
};

const statusClassMap: Record<StatusKind, string> = {
  success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  error: "border-rose-400/40 bg-rose-500/10 text-rose-100",
  info: "border-sky-400/40 bg-sky-500/10 text-sky-100",
};

const mapFranchiseToAdminTeam = (
  franchise: { city: string; name: string; colors: string[] | [string, string]; logo?: string },
  gender: GenderKey,
  index: number,
): AdminTeam => ({
  id: `${gender}-${index}`,
  name: franchise.name,
  city: franchise.city,
  gender,
  colors: (Array.isArray(franchise.colors) ? franchise.colors : []).filter((tone): tone is string => typeof tone === "string" && tone.length > 0),
  logo: franchise.logo ?? "",
  wins: 0,
  losses: 0,
  totalPoints: 0,
  createdAt: null,
  updatedAt: null,
});

const staticTeamCatalog: AdminTeam[] = [
  ...menFranchises.map((team, index) => mapFranchiseToAdminTeam(team, "men", index)),
  ...franchisesWomen.map((team, index) => mapFranchiseToAdminTeam(team, "women", index)),
].sort((a, b) => a.name.localeCompare(b.name));

const getTeamKey = (team: Pick<AdminTeam, "gender" | "name">) => `${team.gender}-${team.name.trim().toLowerCase()}`;

const initialFormState: NewsFormState = {
  title: "",
  summary: "",
  category: "",
  headline: "",
  imageUrl: "",
};

const initialTeamFormState: TeamFormState = {
  name: "",
  city: "",
  gender: "men",
  colorsInput: "",
  logo: "",
  nationality: "DRC",
  nationality2: "",
};

const initialRosterFormState: RosterFormState = {
  firstName: "",
  lastName: "",
  number: "",
  playerLicense: "",
  height: "",
  dateOfBirth: "",
  position: "",
  nationality: "DRC",
  nationality2: "",
  nationality2Enabled: false,
  headshot: "",
  pts: "",
  reb: "",
  stl: "",
};

const initialCoachStaffFormState: CoachStaffFormState = {
  firstName: "",
  lastName: "",
  role: "staff",
  headshot: "",
};

const initialGameFormState: GameFormState = {
  gender: "men",
  homeTeamId: "",
  awayTeamId: "",
  date: "",
  time: "",
  venue: "",
  refereeHomeTeam1: "",
  refereeHomeTeam2: "",
  refereeAwayTeam: "",
};

const sanitizeFilename = (filename: string) => filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-");

const buildImagePath = (filename: string) => `news-images/${Date.now()}-${sanitizeFilename(filename)}`;
const buildTeamLogoPath = (filename: string) => `team-logos/${Date.now()}-${sanitizeFilename(filename)}`;
const buildPlayerHeadshotPath = (filename: string) => `player-headshots/${Date.now()}-${sanitizeFilename(filename)}`;
const buildCoachHeadshotPath = (filename: string) => `coach-headshots/${Date.now()}-${sanitizeFilename(filename)}`;

const getDateField = (value: unknown): Date | null => {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const mapSnapshotToArticle = (snapshot: DocumentSnapshot<DocumentData>): AdminNewsArticle => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: data?.title ?? "",
    summary: data?.summary ?? "",
    category: data?.category ?? "News",
    headline: data?.headline ?? "",
    imageUrl: data?.imageUrl ?? "",
    createdAt: getDateField(data?.createdAt),
  };
};

const mapSnapshotToTeam = (snapshot: DocumentSnapshot<DocumentData>): AdminTeam => {
  const data = snapshot.data();
  const sourceColors = Array.isArray(data?.colors) ? (data?.colors as unknown[]) : [];
  const colors = sourceColors.filter((tone: unknown): tone is string => typeof tone === "string" && tone.length > 0);
  return {
    id: snapshot.id,
    name: data?.name ?? "",
    city: data?.city ?? "",
    gender: data?.gender === "women" ? "women" : "men",
    colors,
    logo: data?.logo ?? "",
    wins: typeof data?.wins === "number" ? data.wins : 0,
    losses: typeof data?.losses === "number" ? data.losses : 0,
    totalPoints: typeof data?.totalPoints === "number" ? data.totalPoints : 0,
    createdAt: getDateField(data?.createdAt),
    updatedAt: getDateField(data?.updatedAt),
  };
};

const mapSnapshotToRosterPlayer = (snapshot: DocumentSnapshot<DocumentData>): AdminRosterPlayer => {
  const data = snapshot.data();
  const stats = (data?.stats ?? {}) as Record<string, string>;
  return {
    id: snapshot.id,
    firstName: data?.firstName ?? "",
    lastName: data?.lastName ?? "",
    number: typeof data?.number === "number" ? data.number : null,
    playerLicense: data?.playerLicense ?? "",
    height: data?.height ?? "",
    dateOfBirth: data?.dateOfBirth ?? "",
    nationality: data?.nationality ?? undefined,
    nationality2: data?.nationality2 ?? undefined,
    headshot: data?.headshot ?? "",
    stats: {
      pts: stats?.pts ?? "",
      reb: stats?.reb ?? "",
      stl: stats?.stl ?? "",
    },
  };
};

const mapSnapshotToGame = (snapshot: DocumentSnapshot<DocumentData>): AdminGame => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    gender: data?.gender === "women" ? "women" : "men",
    homeTeamId: data?.homeTeamId ?? "",
    homeTeamName: data?.homeTeamName ?? "",
    homeTeamLogo: data?.homeTeamLogo ?? "",
    awayTeamId: data?.awayTeamId ?? "",
    awayTeamName: data?.awayTeamName ?? "",
    awayTeamLogo: data?.awayTeamLogo ?? "",
    date: data?.date ?? "",
    time: data?.time ?? "",
    venue: data?.venue ?? "",
    refereeHomeTeam1: data?.refereeHomeTeam1 ?? "",
    refereeHomeTeam2: data?.refereeHomeTeam2 ?? "",
    refereeAwayTeam: data?.refereeAwayTeam ?? "",
    createdAt: getDateField(data?.createdAt),
    updatedAt: getDateField(data?.updatedAt),
  };
};

const mapSnapshotToTrafficEntry = (snapshot: DocumentSnapshot<DocumentData>): TeamTrafficEntry => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    action: data?.action === "player_deleted" ? "player_deleted" : "player_added",
    teamId: data?.teamId ?? "",
    teamName: data?.teamName ?? "Unknown team",
    teamGender: data?.teamGender === "women" ? "women" : "men",
    playerId: data?.playerId ?? "",
    playerName: data?.playerName ?? "Unknown player",
    jerseyNumber: typeof data?.jerseyNumber === "number" ? data.jerseyNumber : null,
    performedBy: data?.performedBy ?? null,
    createdAt: getDateField(data?.createdAt),
  };
};

const formatAdminPublishedLabel = (date: Date | null) => {
  if (!date) {
    return "Draft";
  }
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
 
export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [news, setNews] = useState<AdminNewsArticle[]>([]);
  const [form, setForm] = useState<NewsFormState>(initialFormState);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusCallout | null>(null);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [teamForm, setTeamForm] = useState<TeamFormState>(initialTeamFormState);
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);
  const [teamLogoPreview, setTeamLogoPreview] = useState<string>("");
  const [teamFormExpanded, setTeamFormExpanded] = useState(false);
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [bulkImportingTemplates, setBulkImportingTemplates] = useState(false);
  const [teamStatus, setTeamStatus] = useState<StatusCallout | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [roster, setRoster] = useState<AdminRosterPlayer[]>([]);
  const [rosterForm, setRosterForm] = useState<RosterFormState>(initialRosterFormState);
  const [rosterSubmitting, setRosterSubmitting] = useState(false);
  const [rosterStatus, setRosterStatus] = useState<StatusCallout | null>(null);
  const [teamGenderFilter, setTeamGenderFilter] = useState<GenderKey>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adminTeamGenderFilter');
      return (saved === 'women' ? 'women' : 'men') as GenderKey;
    }
    return 'men';
  });
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [teamCurrentPage, setTeamCurrentPage] = useState(1);
  const teamsPerPage = 6;
  const [rosterFormVisible, setRosterFormVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferPlayerId, setTransferPlayerId] = useState<string | null>(null);
  const [transferPlayerName, setTransferPlayerName] = useState<string>("");
  const [transferSourceTeamId, setTransferSourceTeamId] = useState<string>("");
  const [transferSourceTeamName, setTransferSourceTeamName] = useState<string>("");
  const [transferTargetTeamId, setTransferTargetTeamId] = useState<string>("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [coachStaffList, setCoachStaffList] = useState<CoachStaff[]>([]);
  const [coachStaffForm, setCoachStaffForm] = useState<CoachStaffFormState | null>(null);
  const [coachStaffFormVisible, setCoachStaffFormVisible] = useState(false);
  const [coachHeadshotFile, setCoachHeadshotFile] = useState<File | null>(null);
  const [coachHeadshotPreview, setCoachHeadshotPreview] = useState<string>("");
  const [coachStaffSubmitting, setCoachStaffSubmitting] = useState(false);
  const coachHeadshotPreviewBlobRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stories' | 'teams' | 'traffic' | 'games' | 'stats' | 'league' | 'admins'>('stories');
  const [language, setLanguage] = useState<'en' | 'fr'>('fr');
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [showOnlineAdminsDropdown, setShowOnlineAdminsDropdown] = useState(false);
  const [adminFormVisible, setAdminFormVisible] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRoles, setNewAdminRoles] = useState<AdminRole[]>([]);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminStatus, setAdminStatus] = useState<StatusCallout | null>(null);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<StatusCallout | null>(null);
  const [editingAdminRoles, setEditingAdminRoles] = useState<AdminRole[]>([]);
  const [storyEditorOpen, setStoryEditorOpen] = useState(false);
  const [showStoryPreview, setShowStoryPreview] = useState(false);
  const [teamAssistantOpen, setTeamAssistantOpen] = useState(false);
  const [trafficModuleOpen, setTrafficModuleOpen] = useState(false);
  const [gamePlannerOpen, setGamePlannerOpen] = useState(false);
  const [gameStatsAssistantOpen, setGameStatsAssistantOpen] = useState(false);
  const [leagueGestionOpen, setLeagueGestionOpen] = useState(false);
  const [playerHeadshotFile, setPlayerHeadshotFile] = useState<File | null>(null);
  const [playerHeadshotPreview, setPlayerHeadshotPreview] = useState<string>("");
  const [games, setGames] = useState<AdminGame[]>([]);
  const [gameForm, setGameForm] = useState<GameFormState>(initialGameFormState);
  const [gameFormVisible, setGameFormVisible] = useState(false);
  const [gameSubmitting, setGameSubmitting] = useState(false);
  const [gameStatus, setGameStatus] = useState<StatusCallout | null>(null);
  const [gameTeamSearch, setGameTeamSearch] = useState("");
  const [completedGames, setCompletedGames] = useState<CompletedGame[]>([]);
  const [selectedCompletedGame, setSelectedCompletedGame] = useState<CompletedGame | null>(null);
  const [gameStatsForm, setGameStatsForm] = useState<GameStatsFormState | null>(null);
  const [winnerRoster, setWinnerRoster] = useState<AdminRosterPlayer[]>([]);
  const [loserRoster, setLoserRoster] = useState<AdminRosterPlayer[]>([]);
  const [playerStatsMap, setPlayerStatsMap] = useState<Record<string, { two_pm: string; two_pa: string; three_pm: string; three_pa: string; ft_m: string; ft_a: string; ast: string; oreb: string; dreb: string; reb: string; stl: string; blk: string; min: string; pf: string; to: string; fls: string }>>({});
  const [loserStatsMap, setLoserStatsMap] = useState<Record<string, { two_pm: string; two_pa: string; three_pm: string; three_pa: string; ft_m: string; ft_a: string; ast: string; oreb: string; dreb: string; reb: string; stl: string; blk: string; min: string; pf: string; to: string; fls: string }>>({});
  const [statsSubmitting, setStatsSubmitting] = useState(false);
  const [statsStatus, setStatsStatus] = useState<StatusCallout | null>(null);
  const [trafficEvents, setTrafficEvents] = useState<TeamTrafficEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [refereeForm, setRefereeForm] = useState<RefereeFormState>({ firstName: "", lastName: "", phone: "", certificationLevel: "" });
  const [refereeFormVisible, setRefereeFormVisible] = useState(false);
  const [refereeSubmitting, setRefereeSubmitting] = useState(false);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [committeeForm, setCommitteeForm] = useState<CommitteeFormState>({ firstName: "", lastName: "", role: "", email: "", phone: "" });
  const [committeeFormVisible, setCommitteeFormVisible] = useState(false);
  const [committeePhotoFile, setCommitteePhotoFile] = useState<File | null>(null);
  const [committeePhotoPreview, setCommitteePhotoPreview] = useState<string>("");
  const [committeeSubmitting, setCommitteeSubmitting] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueForm, setVenueForm] = useState<VenueFormState>({ name: "", address: "", city: "", capacity: "", courts: "" });
  const [venueFormVisible, setVenueFormVisible] = useState(false);
  const [venueSubmitting, setVenueSubmitting] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerForm, setPartnerForm] = useState<PartnerFormState>({ name: "", logo: "" });
  const [partnerFormVisible, setPartnerFormVisible] = useState(false);
  const [partnerLogoFile, setPartnerLogoFile] = useState<File | null>(null);
  const [partnerLogoPreview, setPartnerLogoPreview] = useState<string>("");
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);
  const [leagueGestionStatus, setLeagueGestionStatus] = useState<StatusCallout | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetStatus, setResetStatus] = useState<StatusCallout | null>(null);
  const newsPreviewBlobRef = useRef<string | null>(null);
  const teamLogoPreviewBlobRef = useRef<string | null>(null);
  const playerHeadshotPreviewBlobRef = useRef<string | null>(null);
  // Sync Firestore teams with franchise list for display
  const franchiseTeams = useMemo(() => {
    // Only show Firestore teams (editable teams with roster management)
    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }, [teams]);
  // Gender filter for team editor
  const filteredFranchiseTeams = useMemo(() => {
    const filtered = franchiseTeams.filter((team) => {
      const matchesGender = team.gender === teamGenderFilter;
      const matchesSearch = teamSearchQuery.trim() === "" || 
        team.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
        (team.city && team.city.toLowerCase().includes(teamSearchQuery.toLowerCase()));
      return matchesGender && matchesSearch;
    });
    return filtered;
  }, [franchiseTeams, teamGenderFilter, teamSearchQuery]);

  // Paginated teams
  const paginatedTeams = useMemo(() => {
    const startIndex = (teamCurrentPage - 1) * teamsPerPage;
    const endIndex = startIndex + teamsPerPage;
    return filteredFranchiseTeams.slice(startIndex, endIndex);
  }, [filteredFranchiseTeams, teamCurrentPage, teamsPerPage]);

  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) ?? null, [teams, selectedTeamId]);

  const totalTeamPages = Math.ceil(filteredFranchiseTeams.length / teamsPerPage);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setTeamCurrentPage(1);
  }, [teamGenderFilter, teamSearchQuery]);

  // Directory teams with template/firestore source distinction
  const directoryTeams = useMemo(() => {
    const firestoreTeams: DirectoryTeam[] = teams.map((team) => ({ ...team, source: "firestore" }));
    const firestoreKeys = new Set(firestoreTeams.map((team) => getTeamKey(team)));
    const missingStaticTeams = staticTeamCatalog.filter((team) => !firestoreKeys.has(getTeamKey(team)));
    const templateTeams: DirectoryTeam[] = missingStaticTeams.map((team) => ({ ...team, source: "static" }));
    return [...firestoreTeams, ...templateTeams].sort((a, b) => a.name.localeCompare(b.name));
  }, [teams]);

  const missingStaticTeams = useMemo(() => {
    const firestoreKeys = new Set(teams.map((team) => getTeamKey(team)));
    return staticTeamCatalog.filter((team) => !firestoreKeys.has(getTeamKey(team)));
  }, [teams]);

  // Translations
  const t = {
    adminDashboard: language === 'fr' ? 'Tableau de bord administrateur' : 'Admin Dashboard',
    contentManagement: language === 'fr' ? 'Système de gestion de contenu' : 'Content Management System',
    changePassword: language === 'fr' ? 'CHANGER LE MOT DE PASSE' : 'CHANGE PASSWORD',
    signOut: language === 'fr' ? 'SE DÉCONNECTER' : 'SIGN OUT',
    stories: language === 'fr' ? 'HISTOIRES' : 'STORIES',
    teams: language === 'fr' ? 'ÉQUIPES' : 'TEAMS',
    traffic: language === 'fr' ? 'TRAFIC' : 'TRAFFIC',
    games: language === 'fr' ? 'MATCHS' : 'GAMES',
    stats: language === 'fr' ? 'STATISTIQUES' : 'STATS',
    league: language === 'fr' ? 'LIGUE' : 'LEAGUE',
    admins: language === 'fr' ? 'ADMINISTRATEURS' : 'ADMINS',
    databaseReset: language === 'fr' ? 'Réinitialisation de la base de données' : 'Database Reset',
    resetDescription: language === 'fr' ? 'Supprimer tous les matchs, classements et réinitialiser toutes les statistiques des équipes/joueurs à 0.' : 'Delete all games, standings, and reset all team/player stats to 0.',
    resetAllStats: language === 'fr' ? 'Réinitialiser toutes les stats' : 'Reset All Stats',
    resetting: language === 'fr' ? 'Réinitialisation...' : 'Resetting...',
    createStory: language === 'fr' ? 'Créer une histoire' : 'Create Story',
    editStory: language === 'fr' ? 'Modifier l\'histoire' : 'Edit Story',
    newStory: language === 'fr' ? '+ Nouvelle histoire' : '+ New Story',
    title: language === 'fr' ? 'Titre' : 'Title',
    category: language === 'fr' ? 'Catégorie' : 'Category',
    headline: language === 'fr' ? 'Titre principal' : 'Headline',
    summary: language === 'fr' ? 'Résumé' : 'Summary',
    coverPhoto: language === 'fr' ? 'Photo de couverture' : 'Cover Photo',
    chooseFile: language === 'fr' ? 'Choisir un fichier' : 'Choose File',
    noFileChosen: language === 'fr' ? 'Aucun fichier choisi' : 'No file chosen',
    publish: language === 'fr' ? 'Publier' : 'Publish',
    update: language === 'fr' ? 'Mettre à jour' : 'Update',
    clear: language === 'fr' ? 'Effacer' : 'Clear',
    saving: language === 'fr' ? 'Enregistrement...' : 'Saving...',
    publishedStories: language === 'fr' ? 'Histoires publiées' : 'Published Stories',
    noStoriesYet: language === 'fr' ? 'Aucune histoire publiée.' : 'No stories published yet.',
    createFirstStory: language === 'fr' ? 'Créez votre première histoire ci-dessus.' : 'Create your first story above.',
    noImage: language === 'fr' ? 'Pas d\'image' : 'No image',
    edit: language === 'fr' ? 'Modifier' : 'Edit',
    delete: language === 'fr' ? 'Supprimer' : 'Delete',
    previewStory: language === 'fr' ? 'Aperçu de l\'histoire' : 'Preview Story',
    previewDescription: language === 'fr' ? 'Voici comment votre histoire apparaîtra sur la page principale' : 'This is how your story will appear on the main page',
    justNow: language === 'fr' ? 'À l\'instant' : 'Just now',
    confirmPublish: language === 'fr' ? 'Confirmer et publier' : 'Confirm & Publish',
    confirmUpdate: language === 'fr' ? 'Confirmer la mise à jour' : 'Confirm Update',
    publishing: language === 'fr' ? 'Publication...' : 'Publishing...',
    signIn: language === 'fr' ? 'Se connecter' : 'Sign in',
    signingIn: language === 'fr' ? 'Connexion...' : 'Signing in...',
    emailAddress: language === 'fr' ? 'Adresse e-mail' : 'Email Address',
    password: language === 'fr' ? 'Mot de passe' : 'Password',
    useCredentials: language === 'fr' ? 'Utilisez vos identifiants Firebase admin.' : 'Use your Firebase admin credentials to unlock the news editor.',
    accessRequired: language === 'fr' ? 'Accès requis' : 'Access Required',
    notAuthorized: language === 'fr' ? 'Votre compte n\'est pas autorisé. Contactez un administrateur principal.' : 'Your account is not authorized for admin access. Please contact a master administrator to grant you permissions.',
    adminUserManagement: language === 'fr' ? 'Gestion des utilisateurs admin' : 'Admin User Management',
    createAdminAccounts: language === 'fr' ? 'Créer des comptes admin, attribuer des rôles et gérer les autorisations.' : 'Create admin accounts, assign roles, and manage access permissions.',
    createNewAdmin: language === 'fr' ? '+ Créer un nouvel admin' : '+ Create New Admin',
    allAdminUsers: language === 'fr' ? 'Tous les utilisateurs admin' : 'All Admin Users',
    displayName: language === 'fr' ? 'Nom d\'affichage' : 'Display Name',
    assignRoles: language === 'fr' ? 'Attribuer des rôles' : 'Assign Roles',
    createAdminAccount: language === 'fr' ? 'Créer un compte admin' : 'Create Admin Account',
    creating: language === 'fr' ? 'Création...' : 'Creating...',
    cancel: language === 'fr' ? 'Annuler' : 'Cancel',
    lastLogin: language === 'fr' ? 'Dernière connexion' : 'Last login',
    newPassword: language === 'fr' ? 'Nouveau mot de passe' : 'New Password',
    confirmPassword: language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm Password',
    changing: language === 'fr' ? 'Modification...' : 'Changing...',
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (next) => {
      setUser(next);
      if (next) {
        console.log("🔐 User logged in:", next.email, "UID:", next.uid);
        // Load admin user data with retry logic
        let adminData = await getAdminUser(next.uid);
        
        // If no admin data found, wait a moment and retry (handles race condition)
        if (!adminData) {
          console.log("⏳ Admin data not found, retrying in 1 second...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          adminData = await getAdminUser(next.uid);
        }
        
        console.log("📄 Admin data loaded:", adminData ? `Found (${adminData.roles.join(', ')})` : "NOT FOUND");
        setCurrentAdminUser(adminData);
        // Record last login
        if (adminData) {
          await recordLastLogin(next.uid);
        }
      } else {
        console.log("🚪 User logged out");
        setCurrentAdminUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Update current user's activity every 2 minutes
  useEffect(() => {
    if (!user?.uid) return;
    
    const updateActivity = () => {
      updateLastActivity(user.uid);
    };
    
    // Update immediately
    updateActivity();
    
    // Update every 2 minutes
    const interval = setInterval(updateActivity, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  // Update current user's activity every 2 minutes
  useEffect(() => {
    if (!user?.uid) return;
    
    const updateActivity = () => {
      updateLastActivity(user.uid);
    };
    
    // Update immediately
    updateActivity();
    
    // Update every 2 minutes
    const interval = setInterval(updateActivity, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  // Real-time listener for all admin users to see who's online
  useEffect(() => {
    if (!currentAdminUser) {
      setAdminUsers([]);
      return;
    }
    
    // Set up real-time listener for immediate updates
    const unsubscribe = onSnapshot(
      collection(firebaseDB, "adminUsers"),
      (snapshot) => {
        const users = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            email: data.email,
            displayName: data.displayName,
            roles: data.roles || [],
            permissions: data.permissions || {},
            isFirstLogin: data.isFirstLogin ?? true,
            createdAt: data.createdAt?.toDate() ?? null,
            createdBy: data.createdBy,
            lastLogin: data.lastLogin?.toDate() ?? null,
            lastActivity: data.lastActivity?.toDate() ?? null,
            isActive: data.isActive ?? true,
          };
        });
        setAdminUsers(users);
      },
      (error) => {
        console.error("Error listening to admin users:", error);
      }
    );
    
    return () => unsubscribe();
  }, [currentAdminUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showOnlineAdminsDropdown && !target.closest('.relative')) {
        setShowOnlineAdminsDropdown(false);
      }
    };

    if (showOnlineAdminsDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showOnlineAdminsDropdown]);

  // Set default active tab based on permissions
  useEffect(() => {
    if (!currentAdminUser) return;

    const perms = currentAdminUser.permissions;
    
    // Set first available tab as active
    if (perms.canManageNews && activeTab !== 'stories') {
      setActiveTab('stories');
    } else if (!perms.canManageNews && perms.canManageTeams && (activeTab === 'stories' || activeTab === 'traffic')) {
      setActiveTab('teams');
    } else if (!perms.canManageNews && !perms.canManageTeams && perms.canManageGames && (activeTab === 'stories' || activeTab === 'teams' || activeTab === 'traffic' || activeTab === 'stats')) {
      setActiveTab('games');
    } else if (!perms.canManageNews && !perms.canManageTeams && !perms.canManageGames && 
               (perms.canManageReferees || perms.canManageVenues || perms.canManagePartners) && 
               activeTab !== 'league') {
      setActiveTab('league');
    } else if (!perms.canManageNews && !perms.canManageTeams && !perms.canManageGames && 
               !perms.canManageReferees && !perms.canManageVenues && !perms.canManagePartners && 
               perms.canManageAdmins) {
      setActiveTab('admins');
    }
  }, [currentAdminUser]);

  useEffect(() => {
    const newsQuery = query(collection(firebaseDB, "news"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(newsQuery, (snapshot) => {
      setNews(snapshot.docs.map(mapSnapshotToArticle));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const teamsQuery = query(collection(firebaseDB, "teams"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(teamsQuery, (snapshot) => {
      setTeams(snapshot.docs.map(mapSnapshotToTeam));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setRoster([]);
      return;
    }
    const rosterQuery = query(collection(firebaseDB, "teams", selectedTeamId, "roster"), orderBy("number", "asc"));
    const unsubscribe = onSnapshot(rosterQuery, (snapshot) => {
      setRoster(snapshot.docs.map(mapSnapshotToRosterPlayer));
    });
    return () => unsubscribe();
  }, [selectedTeamId]);

  useEffect(() => {
    const gamesQuery = query(collection(firebaseDB, "games"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(gamesQuery, (snapshot) => {
      setGames(snapshot.docs.map(mapSnapshotToGame));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const trafficQuery = query(collection(firebaseDB, "teamTraffic"), orderBy("createdAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(trafficQuery, (snapshot) => {
      setTrafficEvents(snapshot.docs.map(mapSnapshotToTrafficEntry));
    });
    return () => unsubscribe();
  }, []);

  // Sync audit logs
  useEffect(() => {
    const auditQuery = query(collection(firebaseDB, "auditLogs"), orderBy("timestamp", "desc"), limit(100));
    const unsubscribe = onSnapshot(auditQuery, (snapshot) => {
      setAuditLogs(snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() ?? new Date(),
      } as AuditLog)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const refereesQuery = query(collection(firebaseDB, "referees"), orderBy("lastName", "asc"));
    const unsubscribe = onSnapshot(refereesQuery, (snapshot) => {
      setReferees(snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() ?? null,
      } as Referee)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const committeeQuery = query(collection(firebaseDB, "committee"), orderBy("firstName", "asc"));
    const unsubscribe = onSnapshot(committeeQuery, (snapshot) => {
      setCommitteeMembers(snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() ?? null,
      } as CommitteeMember)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const venuesQuery = query(collection(firebaseDB, "venues"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(venuesQuery, (snapshot) => {
      setVenues(snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() ?? null,
      } as Venue)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const partnersQuery = query(collection(firebaseDB, "partners"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(partnersQuery, (snapshot) => {
      setPartners(snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() ?? null,
      } as Partner)));
    });
    return () => unsubscribe();
  }, []);

  // Sync completed games (started more than 45 minutes ago, within last week)
  useEffect(() => {
    const gamesQuery = query(collection(firebaseDB, "games"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(gamesQuery, (snapshot) => {
      const now = new Date();
      const fortyFiveMinutesAgo = new Date(now.getTime() - 45 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const completed = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const gameDateTime = new Date(`${data.date}T${data.time}`);
          return {
            ...mapSnapshotToGame(doc),
            gameDateTime,
            winnerTeamId: data.winnerTeamId,
            winnerScore: data.winnerScore,
            loserTeamId: data.loserTeamId,
            loserScore: data.loserScore,
            playerStats: data.playerStats ?? [],
            completed: !!data.winnerTeamId && !!data.winnerScore,
          };
        })
        .filter((game) => 
          game.gameDateTime <= fortyFiveMinutesAgo && 
          game.gameDateTime >= oneWeekAgo
        );
      
      setCompletedGames(completed);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedTeamId && !teams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(null);
      setRoster([]);
      setCoachStaffList([]);
    }
  }, [teams, selectedTeamId]);

  // Load roster and coach/staff when team is selected
  useEffect(() => {
    if (!selectedTeamId) {
      setRoster([]);
      setCoachStaffList([]);
      return;
    }
    
    const rosterRef = collection(firebaseDB, `teams/${selectedTeamId}/roster`);
    const unsubscribeRoster = onSnapshot(rosterRef, (snapshot) => {
      setRoster(snapshot.docs.map(mapSnapshotToRosterPlayer));
    });

    const coachStaffRef = collection(firebaseDB, `teams/${selectedTeamId}/coachStaff`);
    const unsubscribeCoachStaff = onSnapshot(coachStaffRef, (snapshot) => {
      const coaches = snapshot.docs.map((doc) => ({
        id: doc.id,
        firstName: doc.data()?.firstName ?? "",
        lastName: doc.data()?.lastName ?? "",
        role: doc.data()?.role ?? "staff",
        headshot: doc.data()?.headshot ?? "",
      }));
      // Sort: head_coach first, then assistant_coach, then staff
      coaches.sort((a, b) => {
        const order: Record<CoachStaffRole, number> = { head_coach: 0, assistant_coach: 1, staff: 2 };
        return (order[a.role as CoachStaffRole] ?? 3) - (order[b.role as CoachStaffRole] ?? 3);
      });
      setCoachStaffList(coaches);
    });

    return () => {
      unsubscribeRoster();
      unsubscribeCoachStaff();
    };
  }, [selectedTeamId]);

  useEffect(() => {
    return () => {
      if (newsPreviewBlobRef.current) {
        URL.revokeObjectURL(newsPreviewBlobRef.current);
      }
      if (teamLogoPreviewBlobRef.current) {
        URL.revokeObjectURL(teamLogoPreviewBlobRef.current);
      }
    };
  }, []);

  const updateNewsPreview = (url: string) => {
    if (newsPreviewBlobRef.current && newsPreviewBlobRef.current.startsWith("blob:") && newsPreviewBlobRef.current !== url) {
      URL.revokeObjectURL(newsPreviewBlobRef.current);
    }
    if (url.startsWith("blob:")) {
      newsPreviewBlobRef.current = url;
    } else {
      newsPreviewBlobRef.current = null;
    }
    setImagePreview(url);
  };

  const updateTeamLogoPreview = (url: string) => {
    if (
      teamLogoPreviewBlobRef.current &&
      teamLogoPreviewBlobRef.current.startsWith("blob:") &&
      teamLogoPreviewBlobRef.current !== url
    ) {
      URL.revokeObjectURL(teamLogoPreviewBlobRef.current);
    }
    if (url.startsWith("blob:")) {
      teamLogoPreviewBlobRef.current = url;
    } else {
      teamLogoPreviewBlobRef.current = null;
    }
    setTeamLogoPreview(url);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authForm.email || !authForm.password) {
      setAuthError("Both email and password are required.");
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, authForm.email, authForm.password);
    } catch (error) {
      console.error(error);
      setAuthError("Unable to sign in. Double-check the credentials.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(firebaseAuth);
      setStatus({ type: "info", message: "Signed out. Come back soon." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Unable to sign out. Try again." });
    }
  };

  const resetForm = () => {
    setForm(initialFormState);
    setSelectedImageFile(null);
    updateNewsPreview("");
  };

  const handleEdit = (article: AdminNewsArticle) => {
    setForm({
      id: article.id,
      title: article.title,
      summary: article.summary,
      category: article.category,
      headline: article.headline,
      imageUrl: article.imageUrl ?? "",
    });
    setSelectedImageFile(null);
    updateNewsPreview(article.imageUrl ?? "");
    setStatus({ type: "info", message: "Loaded the story for editing." });
  };

  const handleDelete = async (article: AdminNewsArticle) => {
    if (!user) {
      setStatus({ type: "error", message: "Sign in to delete a story." });
      return;
    }
    if (!window.confirm("Are you sure you want to delete this news item?")) {
      return;
    }
    setStatus({ type: "info", message: "Removing the story from Firestore..." });
    try {
      // Delete the article document from Firestore
      await deleteDoc(doc(firebaseDB, "news", article.id));
      
      // Delete the article image from Storage if it exists
      if (article.imageUrl) {
        try {
          const imageRef = storageRef(firebaseStorage, article.imageUrl);
          await deleteObject(imageRef);
        } catch (storageError) {
          console.warn("Failed to delete article image from storage:", storageError);
          // Continue even if storage deletion fails
        }
      }
      
      setStatus({ type: "success", message: "Story removed." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "We could not delete that story." });
    }
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedImageFile(file);
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      updateNewsPreview(previewUrl);
    } else {
      updateNewsPreview(form.imageUrl ?? "");
    }
  };

  const handleSubmitNews = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.headline.trim() || !form.summary.trim()) {
      setStatus({ type: "error", message: "Title, headline, and summary are required." });
      return;
    }
    // Show preview instead of publishing directly
    setShowStoryPreview(true);
  };

  const handleConfirmPublish = async () => {
    setSubmitting(true);
    setShowStoryPreview(false);
    setStatus({ type: "info", message: form.id ? "Updating story..." : "Publishing story..." });

    try {
      let finalImage = form.imageUrl ?? "";
      if (selectedImageFile) {
        const path = buildImagePath(selectedImageFile.name);
        const storageRefInstance = storageRef(firebaseStorage, path);
        const uploadSnapshot = await uploadBytes(storageRefInstance, selectedImageFile);
        finalImage = await getDownloadURL(uploadSnapshot.ref);
      }

      const payload = {
        title: form.title.trim(),
        headline: form.headline.trim(),
        summary: form.summary.trim(),
        category: form.category.trim() || "News",
        imageUrl: finalImage,
      };

      if (form.id) {
        await updateDoc(doc(firebaseDB, "news", form.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        if (user) {
          await logAuditAction("news_updated", user.uid, user.email || "unknown", "news", form.id, payload.title);
        }
        setStatus({ type: "success", message: "Story updated successfully." });
      } else {
        const newNewsRef = await addDoc(collection(firebaseDB, "news"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (user) {
          await logAuditAction("news_created", user.uid, user.email || "unknown", "news", newNewsRef.id, payload.title);
        }
        setStatus({ type: "success", message: "Story published to Firestore." });
      }
      resetForm();
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Something went wrong while saving the story." });
    } finally {
      setSubmitting(false);
    }
  };

  const updateFormField = (field: keyof NewsFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateTeamFormField = (field: keyof TeamFormState, value: string) => {
    setTeamForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (field === "logo" && !teamLogoFile) {
      updateTeamLogoPreview(value);
    }
  };

  const resetTeamForm = () => {
    setTeamForm(initialTeamFormState);
    setTeamLogoFile(null);
    updateTeamLogoPreview("");
  };

  const closeTeamForm = () => {
    resetTeamForm();
    setTeamFormExpanded(false);
  };

  const handleEditTeam = (team: AdminTeam) => {
    setTeamFormExpanded(true);
    setTeamForm({
      id: team.id,
      name: team.name,
      city: team.city,
      gender: team.gender,
      colorsInput: team.colors.join(", "),
      logo: team.logo,
      nationality: team.nationality || "DRC",
      nationality2: team.nationality2 || "",
    });
    setTeamLogoFile(null);
    updateTeamLogoPreview(team.logo ?? "");
    setTeamStatus({ type: "info", message: `Editing ${team.name}.` });
  };

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setRosterForm(initialRosterFormState);
    setRosterFormVisible(false);
    setPlayerHeadshotFile(null);
    if (playerHeadshotPreviewBlobRef.current) {
      URL.revokeObjectURL(playerHeadshotPreviewBlobRef.current);
      playerHeadshotPreviewBlobRef.current = null;
    }
    setPlayerHeadshotPreview("");
    setRosterStatus(null);
  };

  const handleTeamLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setTeamLogoFile(file);
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      updateTeamLogoPreview(previewUrl);
    } else {
      updateTeamLogoPreview(teamForm.logo ?? "");
    }
  };

  const clearTeamLogoSelection = () => {
    setTeamLogoFile(null);
    const fallback = teamForm.logo.trim();
    updateTeamLogoPreview(fallback);
  };

  const handlePlayerHeadshotChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPlayerHeadshotFile(file);
    if (file) {
      if (playerHeadshotPreviewBlobRef.current) {
        URL.revokeObjectURL(playerHeadshotPreviewBlobRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      playerHeadshotPreviewBlobRef.current = previewUrl;
      setPlayerHeadshotPreview(previewUrl);
    } else {
      if (playerHeadshotPreviewBlobRef.current) {
        URL.revokeObjectURL(playerHeadshotPreviewBlobRef.current);
        playerHeadshotPreviewBlobRef.current = null;
      }
      setPlayerHeadshotPreview(rosterForm.headshot ?? "");
    }
  };

  const clearPlayerHeadshotSelection = () => {
    setPlayerHeadshotFile(null);
    if (playerHeadshotPreviewBlobRef.current) {
      URL.revokeObjectURL(playerHeadshotPreviewBlobRef.current);
      playerHeadshotPreviewBlobRef.current = null;
    }
    const fallback = rosterForm.headshot?.trim() ?? "";
    setPlayerHeadshotPreview(fallback);
  };

  const handleUseStaticTeam = (team: AdminTeam) => {
    setTeamFormExpanded(true);
    setTeamForm({
      id: undefined,
      name: team.name,
      city: team.city,
      gender: team.gender,
      colorsInput: team.colors.join(", "),
      logo: team.logo,
      nationality: team.nationality || "DRC",
      nationality2: team.nationality2 || "",
    });
    setTeamLogoFile(null);
    updateTeamLogoPreview(team.logo ?? "");
    setTeamStatus({
      type: "info",
      message: `Loaded ${team.name}. Review the fields and click Add team to store it in Firestore.`,
    });
  };

  const handleBulkImportStaticTeams = async () => {
    if (!user) {
      setTeamStatus({ type: "error", message: "Sign in to import teams." });
      return;
    }
    if (!missingStaticTeams.length) {
      setTeamStatus({ type: "info", message: "All Febaco templates already live in Firestore." });
      return;
    }

    setBulkImportingTemplates(true);
    setTeamStatus({ type: "info", message: "Syncing Febaco templates to Firestore..." });

    try {
      await Promise.all(
        missingStaticTeams.map((team) =>
          addDoc(collection(firebaseDB, "teams"), {
            name: team.name,
            city: team.city,
            gender: team.gender,
            colors: team.colors,
            logo: team.logo,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        ),
      );
      setTeamStatus({ type: "success", message: `Imported ${missingStaticTeams.length} templates.` });
    } catch (error) {
      console.error(error);
      setTeamStatus({ type: "error", message: "Unable to import template teams." });
    } finally {
      setBulkImportingTemplates(false);
    }
  };

  const handleResetAllStats = async () => {
    if (!user) {
      setResetStatus({ type: "error", message: "Sign in to reset stats." });
      return;
    }

    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete ALL games and reset ALL team stats to 0-0.\n\n" +
      "This includes:\n" +
      "• All game records\n" +
      "• All team wins/losses\n" +
      "• All team total points\n" +
      "• All player stats and averages\n\n" +
      "This action CANNOT be undone!\n\n" +
      "Are you absolutely sure you want to continue?"
    );

    if (!confirmed) {
      return;
    }

    setResetSubmitting(true);
    setResetStatus({ type: "info", message: "Resetting all stats..." });

    try {
      // 1. Delete all games
      const gamesSnapshot = await getDocs(collection(firebaseDB, "games"));
      const gameDeletePromises = gamesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(gameDeletePromises);

      // 2. Delete all standings
      const standingsSnapshot = await getDocs(collection(firebaseDB, "standings"));
      const standingsDeletePromises = standingsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(standingsDeletePromises);

      // 3. Reset all team stats
      const teamsSnapshot = await getDocs(collection(firebaseDB, "teams"));
      const teamResetPromises = teamsSnapshot.docs.map(async (teamDoc) => {
        // Reset team stats
        await updateDoc(teamDoc.ref, {
          wins: 0,
          losses: 0,
          totalPoints: 0,
          updatedAt: serverTimestamp(),
        });

        // Reset all player stats in roster
        const rosterSnapshot = await getDocs(collection(firebaseDB, `teams/${teamDoc.id}/roster`));
        const playerResetPromises = rosterSnapshot.docs.map(playerDoc => 
          updateDoc(playerDoc.ref, {
            stats: {
              pts: "0.0",
              reb: "0.0",
              ast: "0.0",
              stl: "0.0",
              blk: "0.0",
            },
            gamesPlayed: 0,
            updatedAt: serverTimestamp(),
          })
        );
        await Promise.all(playerResetPromises);
      });
      await Promise.all(teamResetPromises);

      setResetStatus({ 
        type: "success", 
        message: `✓ Reset complete! Deleted ${gamesSnapshot.docs.length} games and reset ${teamsSnapshot.docs.length} teams to 0-0.` 
      });
      setResetConfirmOpen(false);
    } catch (error) {
      console.error("Reset error:", error);
      setResetStatus({ type: "error", message: "Failed to reset stats. Check console for details." });
    } finally {
      setResetSubmitting(false);
    }
  };


  // Update all games that reference this team with new team data
  const updateGamesWithTeamData = async (teamId: string, teamName: string, teamLogo: string) => {
    try {
      const gamesSnapshot = await getDocs(collection(firebaseDB, "games"));
      const batch = writeBatch(firebaseDB);
      let updateCount = 0;

      gamesSnapshot.docs.forEach((gameDoc) => {
        const gameData = gameDoc.data();
        const updates: any = {};

        // Update home team data if this game uses this team as home
        if (gameData.homeTeamId === teamId) {
          updates.homeTeamName = teamName;
          updates.homeTeamLogo = teamLogo;
          updateCount++;
        }

        // Update away team data if this game uses this team as away
        if (gameData.awayTeamId === teamId) {
          updates.awayTeamName = teamName;
          updates.awayTeamLogo = teamLogo;
          updateCount++;
        }

        // If there are updates, add to batch
        if (Object.keys(updates).length > 0) {
          batch.update(doc(firebaseDB, "games", gameDoc.id), {
            ...updates,
            updatedAt: serverTimestamp(),
          });
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`✓ Updated ${updateCount} game references for team: ${teamName}`);
      }

      return updateCount;
    } catch (error) {
      console.error("Error updating games with team data:", error);
      throw error;
    }
  };

  const handleSubmitTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setTeamStatus({ type: "error", message: "Sign in to manage teams." });
      return;
    }

    const name = teamForm.name.trim();
    const city = teamForm.city.trim();
    let logo = teamForm.logo.trim();
    const colors = teamForm.colorsInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!name) {
      setTeamStatus({ type: "error", message: "A team name is required." });
      return;
    }

    setTeamSubmitting(true);
    setTeamStatus({ type: "info", message: teamForm.id ? "Updating team and related games..." : "Creating team..." });

    const payload: any = {
      name,
      city,
      gender: teamForm.gender,
      colors,
      logo,
      nationality: teamForm.nationality || "DRC",
    };
    
    // Only add nationality2 if it has a value
    if (teamForm.nationality2 && teamForm.nationality2.trim() !== "") {
      payload.nationality2 = teamForm.nationality2;
    }

    try {
      if (teamLogoFile) {
        const path = buildTeamLogoPath(teamLogoFile.name);
        const storageRefInstance = storageRef(firebaseStorage, path);
        const uploadSnapshot = await uploadBytes(storageRefInstance, teamLogoFile);
        logo = await getDownloadURL(uploadSnapshot.ref);
        payload.logo = logo;
      }
      if (teamForm.id) {
        // Create update payload
        const updatePayload: any = {
          name: payload.name,
          city: payload.city,
          gender: payload.gender,
          colors: payload.colors,
          logo: payload.logo,
          nationality: payload.nationality,
          updatedAt: serverTimestamp(),
        };
        
        // Handle nationality2: either set it or remove it
        if (teamForm.nationality2 && teamForm.nationality2.trim() !== "") {
          updatePayload.nationality2 = teamForm.nationality2;
        } else {
          // Remove the field if it's empty
          updatePayload.nationality2 = deleteField();
        }
        
        await updateDoc(doc(firebaseDB, "teams", teamForm.id), updatePayload);
        await logAuditAction("team_updated", user.uid, user.email || "unknown", "team", teamForm.id, name);
        
        // Update all games that reference this team (so logo/name changes propagate everywhere)
        const gamesUpdated = await updateGamesWithTeamData(teamForm.id, name, logo);
        
        const successMsg = gamesUpdated > 0 
          ? `✓ Team "${name}" updated! ${gamesUpdated} game${gamesUpdated > 1 ? 's' : ''} synced.`
          : `✓ Team "${name}" updated successfully!`;
        
        setTeamStatus({ type: "success", message: successMsg });
        
        // Update the form with the new values (keeping form open so user can see changes)
        setTeamForm({
          ...teamForm,
          name,
          city,
          colorsInput: colors.join(", "),
          logo,
          nationality: payload.nationality,
          nationality2: teamForm.nationality2,
        });
        setTeamLogoFile(null);
        updateTeamLogoPreview(logo);
      } else {
        const newTeamRef = await addDoc(collection(firebaseDB, "teams"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAuditAction("team_created", user.uid, user.email || "unknown", "team", newTeamRef.id, name);
        setTeamStatus({ type: "success", message: `✓ Team "${name}" created successfully!` });
        setSelectedTeamId(newTeamRef.id);
        resetTeamForm();
      }
    } catch (error) {
      console.error("Team save error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unable to save team changes.";
      setTeamStatus({ type: "error", message: `❌ Error: ${errorMessage}` });
    } finally {
      setTeamSubmitting(false);
    }
  };

  const handleDeleteTeam = async (team: AdminTeam) => {
    if (!user) {
      setTeamStatus({ type: "error", message: "Sign in to delete teams." });
      return;
    }
    if (!window.confirm(`Delete ${team.name}? This removes the roster too.`)) {
      return;
    }

    setTeamStatus({ type: "info", message: "Deleting team..." });

    try {
      const batch = writeBatch(firebaseDB);
      const teamDocRef = doc(firebaseDB, "teams", team.id);
      const rosterCollectionRef = collection(firebaseDB, "teams", team.id, "roster");
      const rosterSnapshot = await getDocs(rosterCollectionRef);
      
      // Delete all player headshots from Storage
      const deletePromises: Promise<void>[] = [];
      rosterSnapshot.forEach((playerDoc) => {
        const playerData = playerDoc.data();
        if (playerData.headshot) {
          const headshotRef = storageRef(firebaseStorage, playerData.headshot);
          deletePromises.push(
            deleteObject(headshotRef).catch((err) => {
              console.warn(`Failed to delete headshot for player ${playerDoc.id}:`, err);
            })
          );
        }
        batch.delete(playerDoc.ref);
      });
      
      // Delete team logo from Storage if it exists
      if (team.logo) {
        const logoRef = storageRef(firebaseStorage, team.logo);
        deletePromises.push(
          deleteObject(logoRef).catch((err) => {
            console.warn(`Failed to delete team logo:`, err);
          })
        );
      }
      
      // Wait for all storage deletions to complete
      await Promise.all(deletePromises);
      
      batch.delete(teamDocRef);
      await batch.commit();
      await logAuditAction("team_deleted", user.uid, user.email || "unknown", "team", team.id, team.name);
      setTeamStatus({ type: "success", message: "Team removed." });
      if (teamForm.id === team.id) {
        resetTeamForm();
      }
      if (selectedTeamId === team.id) {
        setSelectedTeamId(null);
        setRoster([]);
        resetRosterForm();
      }
    } catch (error) {
      console.error(error);
      setTeamStatus({ type: "error", message: "Unable to delete the team." });
    }
  };

  const resetRosterForm = () => {
    // Don't clear team selection or hide form - just reset the form fields
    setRosterForm(initialRosterFormState);
    setPlayerHeadshotFile(null);
    if (playerHeadshotPreviewBlobRef.current) {
      URL.revokeObjectURL(playerHeadshotPreviewBlobRef.current);
      playerHeadshotPreviewBlobRef.current = null;
    }
    setPlayerHeadshotPreview("");
  };

  const handleEditRosterPlayer = (player: AdminRosterPlayer) => {
    setRosterForm({
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      number: player.number !== null ? String(player.number) : "",
      playerLicense: player.playerLicense,
      height: player.height,
      dateOfBirth: player.dateOfBirth ?? "",
      position: player.position ?? "",
        nationality: player.nationality ?? "DRC",
        nationality2: player.nationality2 ?? "",
        nationality2Enabled: !!player.nationality2,
      headshot: player.headshot ?? "",
      pts: player.stats.pts,
      reb: player.stats.reb,
      stl: player.stats.stl,
    });
    setPlayerHeadshotFile(null);
    setPlayerHeadshotPreview(player.headshot ?? "");
    setRosterFormVisible(true);
    setRosterStatus({ type: "info", message: `Editing ${player.firstName} ${player.lastName}.` });
  };

  const recordTrafficEvent = async (
    action: TrafficAction,
    details: {
      teamId: string;
      teamName: string;
      teamGender: GenderKey;
      playerId: string;
      playerName: string;
      jerseyNumber: number | null;
      targetTeamId?: string;
      targetTeamName?: string;
    },
  ) => {
    if (!details.teamId) {
      return;
    }

    try {
      await addDoc(collection(firebaseDB, "teamTraffic"), {
        action,
        ...details,
        performedBy: user?.email ?? null,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to record traffic event", error);
    }
  };

  const handleSubmitRosterPlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setRosterStatus({ type: "error", message: "Sign in to manage roster entries." });
      return;
    }
    if (!selectedTeamId) {
      setRosterStatus({ type: "error", message: "Select a team before editing its roster." });
      return;
    }

    const firstName = rosterForm.firstName.trim();
    const lastName = rosterForm.lastName.trim();
    const playerLicense = rosterForm.playerLicense.trim();
    const height = rosterForm.height.trim();
    const dateOfBirth = rosterForm.dateOfBirth.trim();
    const position = rosterForm.position.trim();
    const pts = rosterForm.pts.trim();
    const reb = rosterForm.reb.trim();
    const stl = rosterForm.stl.trim();
    let headshot = rosterForm.headshot.trim();
    const jerseyNumber = Number.parseInt(rosterForm.number, 10);

    if (!firstName) {
      setRosterStatus({ type: "error", message: "First name is required." });
      return;
    }
    if (!lastName) {
      setRosterStatus({ type: "error", message: "Last name is required." });
      return;
    }
    if (!playerLicense && !rosterForm.id) {
      setRosterStatus({ type: "error", message: "Player license is required for new players." });
      return;
    }
    if (!Number.isFinite(jerseyNumber)) {
      setRosterStatus({ type: "error", message: "Enter a valid jersey number." });
      return;
    }
    if (!position) {
      setRosterStatus({ type: "error", message: "Position is required." });
      return;
    }

    setRosterSubmitting(true);
    setRosterStatus({ type: "info", message: rosterForm.id ? "Updating player..." : "Adding player..." });

    const payload: any = {
      firstName,
      lastName,
      number: jerseyNumber,
      playerLicense: playerLicense || rosterForm.playerLicense,
      height,
      dateOfBirth,
      position,
      nationality: rosterForm.nationality || "DRC",
      headshot,
      stats: {
        pts,
        reb,
        stl,
      },
      updatedAt: serverTimestamp(),
    };
    
    // Only add nationality2 if it has a value
    if (rosterForm.nationality2 && rosterForm.nationality2.trim() !== "") {
      payload.nationality2 = rosterForm.nationality2;
    }

    try {
      if (playerHeadshotFile) {
        const path = buildPlayerHeadshotPath(playerHeadshotFile.name);
        const storageRefInstance = storageRef(firebaseStorage, path);
        const uploadSnapshot = await uploadBytes(storageRefInstance, playerHeadshotFile);
        headshot = await getDownloadURL(uploadSnapshot.ref);
        payload.headshot = headshot;
      }
      const rosterCollectionRef = collection(firebaseDB, "teams", selectedTeamId, "roster");
      if (rosterForm.id) {
        await updateDoc(doc(firebaseDB, "teams", selectedTeamId, "roster", rosterForm.id), payload);
        await logAuditAction("player_updated", user.uid, user.email || "unknown", "player", rosterForm.id, `${firstName} ${lastName}`, { teamName: selectedTeam?.name, jerseyNumber });
        setRosterStatus({ type: "success", message: "Player updated." });
      } else {
        const newPlayerRef = await addDoc(rosterCollectionRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
        await logAuditAction("player_added", user.uid, user.email || "unknown", "player", newPlayerRef.id, `${firstName} ${lastName}`, { teamName: selectedTeam?.name, jerseyNumber });
        setRosterStatus({ type: "success", message: "Player added." });
        if (selectedTeamId) {
          await recordTrafficEvent("player_added", {
            teamId: selectedTeamId,
            teamName: selectedTeam?.name ?? "Unknown team",
            teamGender: selectedTeam?.gender ?? "men",
            playerId: newPlayerRef.id,
            playerName: `${firstName} ${lastName}`,
            jerseyNumber,
          });
        }
      }
      resetRosterForm();
    } catch (error) {
      console.error(error);
      setRosterStatus({ type: "error", message: "Unable to save the player." });
    } finally {
      setRosterSubmitting(false);
    }
  };

  const handleDeleteRosterPlayer = async (player: AdminRosterPlayer) => {
    if (!user) {
      setRosterStatus({ type: "error", message: "Sign in to delete players." });
      return;
    }
    if (!selectedTeamId) {
      setRosterStatus({ type: "error", message: "Select a team first." });
      return;
    }
    if (!window.confirm(`Remove ${player.firstName} ${player.lastName} from the roster?`)) {
      return;
    }

    setRosterStatus({ type: "info", message: "Deleting player..." });

    try {
      // Delete the player document from Firestore
      await deleteDoc(doc(firebaseDB, "teams", selectedTeamId, "roster", player.id));
      await logAuditAction("player_deleted", user.uid, user.email || "unknown", "player", player.id, `${player.firstName} ${player.lastName}`, { teamName: selectedTeam?.name, jerseyNumber: player.number });
      
      // Delete the headshot image from Storage if it exists
      if (player.headshot) {
        try {
          const headshotRef = storageRef(firebaseStorage, player.headshot);
          await deleteObject(headshotRef);
        } catch (storageError) {
          console.warn("Failed to delete headshot from storage:", storageError);
          // Continue even if storage deletion fails
        }
      }
      
      if (selectedTeamId) {
        await recordTrafficEvent("player_deleted", {
          teamId: selectedTeamId,
          teamName: selectedTeam?.name ?? "Unknown team",
          teamGender: selectedTeam?.gender ?? "men",
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          jerseyNumber: player.number ?? null,
        });
      }

      setRosterStatus({ type: "success", message: "Player removed." });
      if (rosterForm.id === player.id) {
        resetRosterForm();
      }
    } catch (error) {
      console.error(error);
      setRosterStatus({ type: "error", message: "Unable to delete the player." });
    }
  };

  const handleInitiateTransfer = (player: AdminRosterPlayer) => {
    if (!selectedTeamId || !selectedTeam) {
      setRosterStatus({ type: "error", message: "Select a team first." });
      return;
    }
    setTransferPlayerId(player.id);
    setTransferPlayerName(`${player.firstName} ${player.lastName}`);
    setTransferSourceTeamId(selectedTeamId);
    setTransferSourceTeamName(selectedTeam.name);
    setTransferTargetTeamId("");
    setTransferModalVisible(true);
  };

  const handleConfirmTransfer = async () => {
    if (!user) {
      setRosterStatus({ type: "error", message: "Sign in to transfer players." });
      return;
    }
    if (!transferPlayerId || !transferSourceTeamId || !transferTargetTeamId) {
      setRosterStatus({ type: "error", message: "Missing transfer details." });
      return;
    }
    if (transferSourceTeamId === transferTargetTeamId) {
      setRosterStatus({ type: "error", message: "Cannot transfer to the same team." });
      return;
    }

    setTransferSubmitting(true);
    setRosterStatus({ type: "info", message: "Transferring player..." });

    try {
      // Get the player document from source team
      const sourcePlayerRef = doc(firebaseDB, "teams", transferSourceTeamId, "roster", transferPlayerId);
      const sourcePlayerSnap = await getDoc(sourcePlayerRef);
      
      if (!sourcePlayerSnap.exists()) {
        throw new Error("Player not found in source team.");
      }

      const playerData = sourcePlayerSnap.data();

      // Add player to target team
      const targetPlayerRef = doc(firebaseDB, "teams", transferTargetTeamId, "roster", transferPlayerId);
      await setDoc(targetPlayerRef, playerData);

      // Delete player from source team
      await deleteDoc(sourcePlayerRef);

      // Find target team name
      const targetTeam = teams.find((t) => t.id === transferTargetTeamId);
      const targetTeamName = targetTeam?.name ?? "Unknown team";

      // Log transfer event
      await recordTrafficEvent("player_transferred", {
        teamId: transferSourceTeamId,
        teamName: transferSourceTeamName,
        teamGender: selectedTeam?.gender ?? "men",
        playerId: transferPlayerId,
        playerName: transferPlayerName,
        jerseyNumber: playerData?.number ?? null,
        targetTeamId: transferTargetTeamId,
        targetTeamName,
      });

      setRosterStatus({ type: "success", message: `${transferPlayerName} transferred successfully.` });
      setTransferModalVisible(false);
      setTransferPlayerId(null);
      setTransferPlayerName("");
      setTransferSourceTeamId("");
      setTransferSourceTeamName("");
      setTransferTargetTeamId("");
    } catch (error) {
      console.error(error);
      setRosterStatus({ type: "error", message: "Transfer failed." });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleCancelTransfer = () => {
    setTransferModalVisible(false);
    setTransferPlayerId(null);
    setTransferPlayerName("");
    setTransferSourceTeamId("");
    setTransferSourceTeamName("");
    setTransferTargetTeamId("");
  };

  // League Gestion handlers
  const handleSubmitReferee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setLeagueGestionStatus({ type: "error", message: "Sign in to manage referees." });
      return;
    }

    const firstName = refereeForm.firstName.trim();
    const lastName = refereeForm.lastName.trim();
    if (!firstName || !lastName) {
      setLeagueGestionStatus({ type: "error", message: "First and last name required." });
      return;
    }

    setRefereeSubmitting(true);
    setLeagueGestionStatus({ type: "info", message: "Saving referee..." });

    try {
      const refereeData = {
        firstName,
        lastName,
        phone: refereeForm.phone.trim() || null,
        certificationLevel: refereeForm.certificationLevel.trim() || null,
        createdAt: refereeForm.id ? undefined : serverTimestamp(),
      };

      if (refereeForm.id) {
        await updateDoc(doc(firebaseDB, "referees", refereeForm.id), refereeData);
        await logAuditAction("referee_updated", user.uid, user.email || "unknown", "referee", refereeForm.id, `${firstName} ${lastName}`);
        setLeagueGestionStatus({ type: "success", message: "Referee updated." });
      } else {
        const newRefereeRef = await addDoc(collection(firebaseDB, "referees"), refereeData);
        await logAuditAction("referee_added", user.uid, user.email || "unknown", "referee", newRefereeRef.id, `${firstName} ${lastName}`);
        setLeagueGestionStatus({ type: "success", message: "Referee added." });
      }

      setRefereeForm({ firstName: "", lastName: "", phone: "", certificationLevel: "" });
      setRefereeFormVisible(false);
    } catch (error) {
      console.error(error);
      setLeagueGestionStatus({ type: "error", message: "Failed to save referee." });
    } finally {
      setRefereeSubmitting(false);
    }
  };

  const handleEditReferee = (referee: Referee) => {
    setRefereeForm({
      id: referee.id,
      firstName: referee.firstName,
      lastName: referee.lastName,
      phone: referee.phone ?? "",
      certificationLevel: referee.certificationLevel ?? "",
    });
    setRefereeFormVisible(true);
  };

  const handleDeleteReferee = async (referee: Referee) => {
    if (!user) {
      setLeagueGestionStatus({ type: "error", message: "Sign in to delete referees." });
      return;
    }
    if (!window.confirm(`Delete referee ${referee.firstName} ${referee.lastName}?`)) {
      return;
    }

    setLeagueGestionStatus({ type: "info", message: "Deleting referee..." });
    try {
      await deleteDoc(doc(firebaseDB, "referees", referee.id));
      await logAuditAction("referee_deleted", user.uid, user.email || "unknown", "referee", referee.id, `${referee.firstName} ${referee.lastName}`);
      setLeagueGestionStatus({ type: "success", message: "Referee deleted." });
    } catch (error) {
      console.error(error);
      setLeagueGestionStatus({ type: "error", message: "Failed to delete referee." });
    }
  };

  const handleSubmitCommittee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setLeagueGestionStatus({ type: "error", message: "Sign in to manage committee." });
      return;
    }

    const firstName = committeeForm.firstName.trim();
    const lastName = committeeForm.lastName.trim();
    const role = committeeForm.role.trim();
    if (!firstName || !lastName || !role) {
      setLeagueGestionStatus({ type: "error", message: "First name, last name, and role required." });
      return;
    }

    setCommitteeSubmitting(true);
    setLeagueGestionStatus({ type: "info", message: "Saving committee member..." });

    try {
      let photoUrl = committeeForm.photo;

      if (committeePhotoFile) {
        const photoRef = storageRef(firebaseStorage, `committee/${Date.now()}_${committeePhotoFile.name}`);
        await uploadBytes(photoRef, committeePhotoFile);
        photoUrl = await getDownloadURL(photoRef);
      }

      const committeeData = {
        firstName,
        lastName,
        role,
        email: committeeForm.email.trim() || null,
        phone: committeeForm.phone.trim() || null,
        photo: photoUrl || null,
        createdAt: committeeForm.id ? undefined : serverTimestamp(),
      };

      if (committeeForm.id) {
        await updateDoc(doc(firebaseDB, "committee", committeeForm.id), committeeData);
        await logAuditAction("committee_updated", user.uid, user.email || "unknown", "committee", committeeForm.id, `${firstName} ${lastName}`);
        setLeagueGestionStatus({ type: "success", message: "Committee member updated." });
      } else {
        const newCommitteeRef = await addDoc(collection(firebaseDB, "committee"), committeeData);
        await logAuditAction("committee_added", user.uid, user.email || "unknown", "committee", newCommitteeRef.id, `${firstName} ${lastName}`);
        setLeagueGestionStatus({ type: "success", message: "Committee member added." });
      }

      setCommitteeForm({ firstName: "", lastName: "", role: "", email: "", phone: "" });
      setCommitteePhotoFile(null);
      setCommitteePhotoPreview("");
      setCommitteeFormVisible(false);
    } catch (error) {
      console.error(error);
      setLeagueGestionStatus({ type: "error", message: "Failed to save committee member." });
    } finally {
      setCommitteeSubmitting(false);
    }
  };

  const handleEditCommittee = (member: CommitteeMember) => {
    setCommitteeForm({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
      email: member.email ?? "",
      phone: member.phone ?? "",
      photo: member.photo,
    });
    if (member.photo) {
      setCommitteePhotoPreview(member.photo);
    }
    setCommitteeFormVisible(true);
  };

  const handleDeleteCommittee = async (member: CommitteeMember) => {
    if (!user) {
      setLeagueGestionStatus({ type: "error", message: "Sign in to delete committee members." });
      return;
    }
    if (!window.confirm(`Delete committee member ${member.firstName} ${member.lastName}?`)) {
      return;
    }

    setLeagueGestionStatus({ type: "info", message: "Deleting committee member..." });
    try {
      if (member.photo) {
        try {
          const photoRef = storageRef(firebaseStorage, member.photo);
          await deleteObject(photoRef);
        } catch (err) {
          console.warn("Failed to delete photo from storage:", err);
        }
      }
      await deleteDoc(doc(firebaseDB, "committee", member.id));
      await logAuditAction("committee_deleted", user.uid, user.email || "unknown", "committee", member.id, `${member.firstName} ${member.lastName}`);
      setLeagueGestionStatus({ type: "success", message: "Committee member deleted." });
    } catch (error) {
      console.error(error);
      setLeagueGestionStatus({ type: "error", message: "Failed to delete committee member." });
    }
  };

  const handleCommitteePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCommitteePhotoFile(file);
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setCommitteePhotoPreview(previewUrl);
    } else {
      setCommitteePhotoPreview("");
    }
  };

  const handleSubmitVenue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setLeagueGestionStatus({ type: "error", message: "Sign in to manage venues." });
      return;
    }

    const name = venueForm.name.trim();
    const address = venueForm.address.trim();
    const city = venueForm.city.trim();
    if (!name || !address || !city) {
      setLeagueGestionStatus({ type: "error", message: "Name, address, and city required." });
      return;
    }

    setVenueSubmitting(true);
    setLeagueGestionStatus({ type: "info", message: "Saving venue..." });

    try {
      const venueData = {
        name,
        address,
        city,
        capacity: venueForm.capacity.trim() || null,
        courts: venueForm.courts ? parseInt(venueForm.courts, 10) : null,
        createdAt: venueForm.id ? undefined : serverTimestamp(),
      };

      if (venueForm.id) {
        await updateDoc(doc(firebaseDB, "venues", venueForm.id), venueData);
        await logAuditAction("venue_updated", user.uid, user.email || "unknown", "venue", venueForm.id, name);
        setLeagueGestionStatus({ type: "success", message: "Venue updated." });
      } else {
        const newVenueRef = await addDoc(collection(firebaseDB, "venues"), venueData);
        await logAuditAction("venue_added", user.uid, user.email || "unknown", "venue", newVenueRef.id, name);
        setLeagueGestionStatus({ type: "success", message: "Venue added." });
      }

      setVenueForm({ name: "", address: "", city: "", capacity: "", courts: "" });
      setVenueFormVisible(false);
    } catch (error) {
      console.error(error);
      setLeagueGestionStatus({ type: "error", message: "Failed to save venue." });
    } finally {
      setVenueSubmitting(false);
    }
  };

  const handleEditVenue = (venue: Venue) => {
    setVenueForm({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      city: venue.city,
      capacity: venue.capacity ?? "",
      courts: venue.courts ? String(venue.courts) : "",
    });
    setVenueFormVisible(true);
  };

  const handleDeleteVenue = async (venue: Venue) => {
    if (!user) {
      setLeagueGestionStatus({ type: "error", message: "Sign in to delete venues." });
      return;
    }
    if (!window.confirm(`Delete venue ${venue.name}?`)) {
      return;
    }

    setLeagueGestionStatus({ type: "info", message: "Deleting venue..." });
    try {
      await deleteDoc(doc(firebaseDB, "venues", venue.id));
      await logAuditAction("venue_deleted", user.uid, user.email || "unknown", "venue", venue.id, venue.name);
      setLeagueGestionStatus({ type: "success", message: "Venue deleted." });
    } catch (error) {
      console.error(error);
      setLeagueGestionStatus({ type: "error", message: "Failed to delete venue." });
    }
  };

  const handlePartnerLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPartnerLogoFile(file);
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setPartnerLogoPreview(previewUrl);
    } else {
      setPartnerLogoPreview(partnerForm.logo);
    }
  };

  const handleSubmitPartner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setLeagueGestionStatus({ type: "error", message: "Sign in to manage partners." });
      return;
    }

    const name = partnerForm.name.trim();
    if (!name) {
      setLeagueGestionStatus({ type: "error", message: "Partner name required." });
      return;
    }

    if (!partnerForm.id && !partnerLogoFile) {
      setLeagueGestionStatus({ type: "error", message: "Partner logo required." });
      return;
    }

    setPartnerSubmitting(true);
    setLeagueGestionStatus({ type: "info", message: "Saving partner..." });

    try {
      let logoUrl = partnerForm.logo;

      if (partnerLogoFile) {
        const logoRef = storageRef(firebaseStorage, `partners/${Date.now()}_${partnerLogoFile.name}`);
        await uploadBytes(logoRef, partnerLogoFile);
        logoUrl = await getDownloadURL(logoRef);
      }

      const partnerData = {
        name,
        logo: logoUrl,
        createdAt: partnerForm.id ? undefined : serverTimestamp(),
      };

      if (partnerForm.id) {
        await updateDoc(doc(firebaseDB, "partners", partnerForm.id), partnerData);
        await logAuditAction("partner_updated", user.uid, user.email || "unknown", "partner", partnerForm.id, name);
        setLeagueGestionStatus({ type: "success", message: "Partner updated." });
      } else {
        const newPartnerRef = await addDoc(collection(firebaseDB, "partners"), partnerData);
        await logAuditAction("partner_added", user.uid, user.email || "unknown", "partner", newPartnerRef.id, name);
        setLeagueGestionStatus({ type: "success", message: "Partner added." });
      }

      setPartnerForm({ name: "", logo: "" });
      setPartnerLogoFile(null);
      setPartnerLogoPreview("");
      setPartnerFormVisible(false);
    } catch (error) {
      console.error(error);
      setLeagueGestionStatus({ type: "error", message: "Failed to save partner." });
    } finally {
      setPartnerSubmitting(false);
    }
  };

  const handleEditPartner = (partner: Partner) => {
    setPartnerForm({
      id: partner.id,
      name: partner.name,
      logo: partner.logo,
    });
    setPartnerLogoPreview(partner.logo);
    setPartnerFormVisible(true);
  };

  const handleDeletePartner = async (partner: Partner) => {
    if (!user) {
      setLeagueGestionStatus({ type: "error", message: "Sign in to delete partners." });
      return;
    }
    if (!window.confirm(`Delete partner ${partner.name}?`)) {
      return;
    }

    setLeagueGestionStatus({ type: "info", message: "Deleting partner..." });
    try {
      if (partner.logo) {
        try {
          const logoRef = storageRef(firebaseStorage, partner.logo);
          await deleteObject(logoRef);
        } catch (err) {
          console.warn("Failed to delete logo from storage:", err);
        }
      }
      await deleteDoc(doc(firebaseDB, "partners", partner.id));
      await logAuditAction("partner_deleted", user.uid, user.email || "unknown", "partner", partner.id, partner.name);
      setLeagueGestionStatus({ type: "success", message: "Partner deleted." });
    } catch (error) {
      console.error(error);
      setLeagueGestionStatus({ type: "error", message: "Failed to delete partner." });
    }
  };

  // Coach/Staff management handlers
  const handleCoachHeadshotChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCoachHeadshotFile(file);
    if (file) {
      if (coachHeadshotPreviewBlobRef.current) {
        URL.revokeObjectURL(coachHeadshotPreviewBlobRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      coachHeadshotPreviewBlobRef.current = previewUrl;
      setCoachHeadshotPreview(previewUrl);
    } else {
      if (coachHeadshotPreviewBlobRef.current) {
        URL.revokeObjectURL(coachHeadshotPreviewBlobRef.current);
        coachHeadshotPreviewBlobRef.current = null;
      }
      setCoachHeadshotPreview(coachStaffForm?.headshot ?? "");
    }
  };

  const openCoachStaffForm = (role: CoachStaffRole) => {
    // Check role limitations
    const headCoachCount = coachStaffList.filter(c => c.role === "head_coach").length;
    const assistantCoachCount = coachStaffList.filter(c => c.role === "assistant_coach").length;

    if (role === "head_coach" && headCoachCount >= 1) {
      setRosterStatus({ type: "error", message: "Team already has a head coach." });
      return;
    }
    if (role === "assistant_coach" && assistantCoachCount >= 2) {
      setRosterStatus({ type: "error", message: "Team already has 2 assistant coaches." });
      return;
    }

    setCoachStaffForm({ ...initialCoachStaffFormState, role });
    setCoachStaffFormVisible(true);
    setRosterStatus(null);
  };

  const resetCoachStaffForm = () => {
    setCoachStaffForm(null);
    setCoachStaffFormVisible(false);
    setCoachHeadshotFile(null);
    if (coachHeadshotPreviewBlobRef.current) {
      URL.revokeObjectURL(coachHeadshotPreviewBlobRef.current);
      coachHeadshotPreviewBlobRef.current = null;
    }
    setCoachHeadshotPreview("");
    setRosterStatus(null);
  };

  const handleSubmitCoachStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setRosterStatus({ type: "error", message: "Sign in to manage staff." });
      return;
    }
    if (!selectedTeamId) {
      setRosterStatus({ type: "error", message: "Select a team first." });
      return;
    }
    if (!coachStaffForm) return;

    const firstName = coachStaffForm.firstName.trim();
    const lastName = coachStaffForm.lastName.trim();
    let headshot = coachStaffForm.headshot.trim();

    if (!firstName || !lastName) {
      setRosterStatus({ type: "error", message: "First and last name are required." });
      return;
    }

    setCoachStaffSubmitting(true);
    setRosterStatus({ type: "info", message: coachStaffForm.id ? "Updating..." : "Adding..." });

    const payload = {
      firstName,
      lastName,
      role: coachStaffForm.role,
      headshot,
      updatedAt: serverTimestamp(),
    };

    try {
      if (coachHeadshotFile) {
        const path = buildCoachHeadshotPath(coachHeadshotFile.name);
        const storageRefInstance = storageRef(firebaseStorage, path);
        const uploadSnapshot = await uploadBytes(storageRefInstance, coachHeadshotFile);
        headshot = await getDownloadURL(uploadSnapshot.ref);
        payload.headshot = headshot;
      }

      const coachStaffCollectionRef = collection(firebaseDB, "teams", selectedTeamId, "coachStaff");
      if (coachStaffForm.id) {
        await updateDoc(doc(firebaseDB, "teams", selectedTeamId, "coachStaff", coachStaffForm.id), payload);
        await logAuditAction("coach_updated", user.uid, user.email || "unknown", "coach", coachStaffForm.id, `${firstName} ${lastName}`, { teamName: selectedTeam?.name, role: coachStaffForm.role });
        setRosterStatus({ type: "success", message: "Staff member updated." });
      } else {
        const newCoachRef = await addDoc(coachStaffCollectionRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
        await logAuditAction("coach_added", user.uid, user.email || "unknown", "coach", newCoachRef.id, `${firstName} ${lastName}`, { teamName: selectedTeam?.name, role: coachStaffForm.role });
        setRosterStatus({ type: "success", message: "Staff member added." });
      }
      resetCoachStaffForm();
    } catch (error) {
      console.error(error);
      setRosterStatus({ type: "error", message: "Unable to save staff member." });
    } finally {
      setCoachStaffSubmitting(false);
    }
  };

  const handleEditCoachStaff = (member: CoachStaff) => {
    setCoachStaffForm({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
      headshot: member.headshot ?? "",
    });
    setCoachHeadshotPreview(member.headshot ?? "");
    setCoachStaffFormVisible(true);
    setRosterStatus({ type: "info", message: "Editing staff member..." });
  };

  const handleDeleteCoachStaff = async (member: CoachStaff) => {
    if (!user) {
      setRosterStatus({ type: "error", message: "Sign in to delete staff." });
      return;
    }
    if (!selectedTeamId) return;
    if (!window.confirm(`Remove ${member.firstName} ${member.lastName}?`)) return;

    setRosterStatus({ type: "info", message: "Deleting..." });

    try {
      await deleteDoc(doc(firebaseDB, "teams", selectedTeamId, "coachStaff", member.id));
      await logAuditAction("coach_deleted", user.uid, user.email || "unknown", "coach", member.id, `${member.firstName} ${member.lastName}`, { teamName: selectedTeam?.name, role: member.role });
      if (member.headshot) {
        try {
          const headshotRef = storageRef(firebaseStorage, member.headshot);
          await deleteObject(headshotRef);
        } catch (storageError) {
          console.warn("Failed to delete headshot from storage:", storageError);
        }
      }
      setRosterStatus({ type: "success", message: "Staff member removed." });
      if (coachStaffForm?.id === member.id) {
        resetCoachStaffForm();
      }
    } catch (error) {
      console.error(error);
      setRosterStatus({ type: "error", message: "Unable to delete staff member." });
    }
  };

  const resetGameForm = () => {
    setGameForm(initialGameFormState);
    setGameFormVisible(false);
    setGameTeamSearch("");
  };

  const handleEditGame = (game: AdminGame) => {
    setGameForm({
      id: game.id,
      gender: game.gender,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      date: game.date,
      time: game.time,
      venue: game.venue,
      refereeHomeTeam1: game.refereeHomeTeam1 ?? "",
      refereeHomeTeam2: game.refereeHomeTeam2 ?? "",
      refereeAwayTeam: game.refereeAwayTeam ?? "",
    });
    setGameFormVisible(true);
    setGameStatus({ type: "info", message: `Editing game.` });
  };

  const handleSubmitGame = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setGameStatus({ type: "error", message: "Sign in to schedule games." });
      return;
    }

    if (!gameForm.homeTeamId || !gameForm.awayTeamId) {
      setGameStatus({ type: "error", message: "Select both home and away teams." });
      return;
    }

    if (gameForm.homeTeamId === gameForm.awayTeamId) {
      setGameStatus({ type: "error", message: "Home and away teams must be different." });
      return;
    }

    if (!gameForm.date || !gameForm.time || !gameForm.venue.trim()) {
      setGameStatus({ type: "error", message: "Date, time, and venue are required." });
      return;
    }

    setGameSubmitting(true);
    setGameStatus({ type: "info", message: gameForm.id ? "Updating game..." : "Scheduling game..." });

    try {
      const homeTeam = teams.find((t) => t.id === gameForm.homeTeamId);
      const awayTeam = teams.find((t) => t.id === gameForm.awayTeamId);

      if (!homeTeam || !awayTeam) {
        setGameStatus({ type: "error", message: "Selected teams not found." });
        return;
      }

      const payload = {
        gender: gameForm.gender,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        homeTeamLogo: homeTeam.logo,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        awayTeamLogo: awayTeam.logo,
        date: gameForm.date,
        time: gameForm.time,
        venue: gameForm.venue.trim(),
        refereeHomeTeam1: gameForm.refereeHomeTeam1 || null,
        refereeHomeTeam2: gameForm.refereeHomeTeam2 || null,
        refereeAwayTeam: gameForm.refereeAwayTeam || null,
        updatedAt: serverTimestamp(),
      };

      if (gameForm.id) {
        await updateDoc(doc(firebaseDB, "games", gameForm.id), payload);
        await logAuditAction("game_updated", user.uid, user.email || "unknown", "game", gameForm.id, `${awayTeam.name} @ ${homeTeam.name}`);
        setGameStatus({ type: "success", message: "Game updated." });
      } else {
        const newGameRef = await addDoc(collection(firebaseDB, "games"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        await logAuditAction("game_created", user.uid, user.email || "unknown", "game", newGameRef.id, `${awayTeam.name} @ ${homeTeam.name}`);
        setGameStatus({ type: "success", message: "Game scheduled." });
      }
      resetGameForm();
    } catch (error) {
      console.error(error);
      setGameStatus({ type: "error", message: "Unable to save the game." });
    } finally {
      setGameSubmitting(false);
    }
  };

  const handleDeleteGame = async (game: AdminGame) => {
    if (!user) {
      setGameStatus({ type: "error", message: "Sign in to delete games." });
      return;
    }
    if (!window.confirm(`Delete ${game.awayTeamName} @ ${game.homeTeamName}?`)) {
      return;
    }

    setGameStatus({ type: "info", message: "Deleting game..." });

    try {
      await deleteDoc(doc(firebaseDB, "games", game.id));
      await logAuditAction("game_deleted", user.uid, user.email || "unknown", "game", game.id, `${game.awayTeamName} @ ${game.homeTeamName}`);
      setGameStatus({ type: "success", message: "Game removed." });
      if (gameForm.id === game.id) {
        resetGameForm();
      }
    } catch (error) {
      console.error(error);
      setGameStatus({ type: "error", message: "Unable to delete the game." });
    }
  };

  const handleSelectCompletedGame = async (game: CompletedGame) => {
    setSelectedCompletedGame(game);
    const loserTeamId = game.winnerTeamId 
      ? (game.winnerTeamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId)
      : "";
    setGameStatsForm({
      gameId: game.id,
      winnerTeamId: game.winnerTeamId || "",
      loserTeamId,
      winnerScore: game.winnerScore?.toString() || "",
      loserScore: game.loserScore?.toString() || "",
    });
    
    // Fetch roster for winner team if winner is selected
    if (game.winnerTeamId) {
      const winnerTeam = teams.find(t => t.id === game.winnerTeamId);
      if (winnerTeam) {
        const rosterQuery = query(
          collection(firebaseDB, `teams/${game.winnerTeamId}/roster`),
          orderBy("number", "asc")
        );
        const snapshot = await getDocs(rosterQuery);
        const rosterPlayers = snapshot.docs.map(mapSnapshotToRosterPlayer);
        setWinnerRoster(rosterPlayers);
        
        // Initialize player stats map if exists
        if (game.playerStats) {
          const statsMap: Record<string, { two_pm: string; two_pa: string; three_pm: string; three_pa: string; ft_m: string; ft_a: string; ast: string; oreb: string; dreb: string; reb: string; stl: string; blk: string; min: string; pf: string; to: string; fls: string }> = {};
          game.playerStats.forEach((stat) => {
            statsMap[stat.playerId] = {
              two_pm: typeof stat.two_pm === "number" ? stat.two_pm.toString() : "",
              two_pa: typeof stat.two_pa === "number" ? stat.two_pa.toString() : "",
              three_pm: typeof stat.three_pm === "number" ? stat.three_pm.toString() : "",
              three_pa: typeof stat.three_pa === "number" ? stat.three_pa.toString() : "",
              ft_m: typeof stat.ft_m === "number" ? stat.ft_m.toString() : "",
              ft_a: typeof stat.ft_a === "number" ? stat.ft_a.toString() : "",
              ast: typeof stat.ast === "number" ? stat.ast.toString() : "",
              oreb: typeof stat.oreb === "number" ? stat.oreb.toString() : "",
              dreb: typeof stat.dreb === "number" ? stat.dreb.toString() : "",
              reb: typeof stat.reb === "number" ? stat.reb.toString() : "",
              stl: typeof stat.stl === "number" ? stat.stl.toString() : "",
              blk: typeof stat.blk === "number" ? stat.blk.toString() : "",
              min: typeof stat.min === "number" ? stat.min.toString() : "",
              pf: typeof stat.pf === "number" ? stat.pf.toString() : "",
              to: typeof stat.to === "number" ? stat.to.toString() : "",
              fls: "",
            };
          });
          setPlayerStatsMap(statsMap);
        }
      }
    }

    // Fetch loser team roster
    if (loserTeamId) {
      const loserRosterQuery = query(
        collection(firebaseDB, `teams/${loserTeamId}/roster`),
        orderBy("number", "asc")
      );
      const loserSnapshot = await getDocs(loserRosterQuery);
      setLoserRoster(loserSnapshot.docs.map(mapSnapshotToRosterPlayer));
    }
  };

  const handleWinnerChange = async (winnerTeamId: string) => {
    if (!gameStatsForm || !selectedCompletedGame) return;
    
    // Auto-populate loser team
    const loserTeamId = winnerTeamId 
      ? (selectedCompletedGame.homeTeamId === winnerTeamId ? selectedCompletedGame.awayTeamId : selectedCompletedGame.homeTeamId)
      : "";
    
    setGameStatsForm({ ...gameStatsForm, winnerTeamId, loserTeamId });
    
    // Fetch roster for new winner
    if (winnerTeamId) {
      const rosterQuery = query(
        collection(firebaseDB, `teams/${winnerTeamId}/roster`),
        orderBy("number", "asc")
      );
      const snapshot = await getDocs(rosterQuery);
      setWinnerRoster(snapshot.docs.map(mapSnapshotToRosterPlayer));
      setPlayerStatsMap({});

      // Fetch loser roster
      const loserRosterQuery = query(
        collection(firebaseDB, `teams/${loserTeamId}/roster`),
        orderBy("number", "asc")
      );
      const loserSnapshot = await getDocs(loserRosterQuery);
      setLoserRoster(loserSnapshot.docs.map(mapSnapshotToRosterPlayer));
      setLoserStatsMap({});
    }
  };

  // Helper to check if game is locked (30+ minutes past start time)
  const isGameLocked = (date: string, time: string) => {
    try {
      const gameDateTime = new Date(`${date}T${time}`);
      const now = new Date();
      const diffMinutes = (now.getTime() - gameDateTime.getTime()) / (1000 * 60);
      return diffMinutes >= 30;
    } catch {
      return false;
    }
  };

  const handleSubmitGameStats = async () => {
    if (!user || !selectedCompletedGame || !gameStatsForm) {
      setStatsStatus({ type: "error", message: "Missing required data." });
      return;
    }

    if (!gameStatsForm.winnerTeamId || !gameStatsForm.winnerScore || !gameStatsForm.loserScore) {
      setStatsStatus({ type: "error", message: "Please fill in all score fields." });
      return;
    }

    // Validate that winner's score is higher than loser's score
    const winnerScore = parseInt(gameStatsForm.winnerScore);
    const loserScore = parseInt(gameStatsForm.loserScore);
    if (winnerScore === loserScore) {
      setStatsStatus({ type: "error", message: "Tie games are not allowed. Winner's score must be different from loser's score." });
      return;
    }
    if (winnerScore <= loserScore) {
      setStatsStatus({ type: "error", message: "Winner's score must be higher than loser's score." });
      return;
    }

    setStatsSubmitting(true);
    setStatsStatus({ type: "info", message: "Saving game stats..." });

    try {
      const loserTeamId = selectedCompletedGame.homeTeamId === gameStatsForm.winnerTeamId
        ? selectedCompletedGame.awayTeamId
        : selectedCompletedGame.homeTeamId;

      const playerStats = Object.entries(playerStatsMap).map(([playerId, stats]) => {
        const player = winnerRoster.find(p => p.id === playerId);
        const two_pm = parseInt(stats.two_pm) || 0;
        const two_pa = parseInt(stats.two_pa) || 0;
        const three_pm = parseInt(stats.three_pm) || 0;
        const three_pa = parseInt(stats.three_pa) || 0;
        const ft_m = parseInt(stats.ft_m) || 0;
        const ft_a = parseInt(stats.ft_a) || 0;
        // Calculate PTS: (2PM × 2) + (3PM × 3) + (FTM × 1)
        const pts = (two_pm * 2) + (three_pm * 3) + (ft_m * 1);
        return {
          playerId,
          playerName: player ? `${player.firstName} ${player.lastName}` : "",
          firstName: player?.firstName || "",
          lastName: player?.lastName || "",
          number: player?.number || 0,
          headshot: player?.headshot || "",
          teamId: gameStatsForm.winnerTeamId,
          two_pm,
          two_pa,
          three_pm,
          three_pa,
          ft_m,
          ft_a,
          pts,
          ast: parseInt(stats.ast) || 0,
          oreb: parseInt(stats.oreb) || 0,
          dreb: parseInt(stats.dreb) || 0,
          reb: parseInt(stats.reb) || 0,
          stl: parseInt(stats.stl) || 0,
          blk: parseInt(stats.blk) || 0,
          min: parseInt(stats.min) || 0,
          pf: parseInt(stats.pf) || 0,
          to: parseInt(stats.to) || 0,
        };
      }).filter(stat => stat.pts > 0 || stat.ast > 0 || stat.reb > 0 || stat.stl > 0 || stat.blk > 0 || stat.two_pm > 0 || stat.three_pm > 0 || stat.ft_m > 0 || stat.oreb > 0 || stat.dreb > 0 || stat.min > 0 || stat.pf > 0 || stat.to > 0);

      // Add loser team stats
      const loserPlayerStats = Object.entries(loserStatsMap).map(([playerId, stats]) => {
        const player = loserRoster.find(p => p.id === playerId);
        const two_pm = parseInt(stats.two_pm) || 0;
        const two_pa = parseInt(stats.two_pa) || 0;
        const three_pm = parseInt(stats.three_pm) || 0;
        const three_pa = parseInt(stats.three_pa) || 0;
        const ft_m = parseInt(stats.ft_m) || 0;
        const ft_a = parseInt(stats.ft_a) || 0;
        // Calculate PTS: (2PM × 2) + (3PM × 3) + (FTM × 1)
        const pts = (two_pm * 2) + (three_pm * 3) + (ft_m * 1);
        return {
          playerId,
          playerName: player ? `${player.firstName} ${player.lastName}` : "",
          firstName: player?.firstName || "",
          lastName: player?.lastName || "",
          number: player?.number || 0,
          headshot: player?.headshot || "",
          teamId: loserTeamId,
          two_pm,
          two_pa,
          three_pm,
          three_pa,
          ft_m,
          ft_a,
          pts,
          ast: parseInt(stats.ast) || 0,
          oreb: parseInt(stats.oreb) || 0,
          dreb: parseInt(stats.dreb) || 0,
          reb: parseInt(stats.reb) || 0,
          stl: parseInt(stats.stl) || 0,
          blk: parseInt(stats.blk) || 0,
          min: parseInt(stats.min) || 0,
          pf: parseInt(stats.pf) || 0,
          to: parseInt(stats.to) || 0,
        };
      }).filter(stat => stat.pts > 0 || stat.ast > 0 || stat.reb > 0 || stat.stl > 0 || stat.blk > 0 || stat.two_pm > 0 || stat.three_pm > 0 || stat.ft_m > 0 || stat.oreb > 0 || stat.dreb > 0 || stat.min > 0 || stat.pf > 0 || stat.to > 0);

      const allPlayerStats = [...playerStats, ...loserPlayerStats];

      await updateDoc(doc(firebaseDB, "games", selectedCompletedGame.id), {
        winnerTeamId: gameStatsForm.winnerTeamId,
        winnerScore: parseInt(gameStatsForm.winnerScore),
        loserTeamId,
        loserScore: parseInt(gameStatsForm.loserScore),
        playerStats: allPlayerStats,
        completed: true,
        updatedAt: serverTimestamp(),
      });

      // Update individual player stats in roster (for both winner and loser teams)
      const batch = writeBatch(firebaseDB);
      for (const stat of allPlayerStats) {
        const isWinner = stat.teamId === gameStatsForm.winnerTeamId;
        const roster = isWinner ? winnerRoster : loserRoster;
        const player = roster.find(p => p.id === stat.playerId);
        if (!player) continue;

        // Get current player stats from roster
        const currentPts = parseFloat(player.stats.pts) || 0;
        const currentReb = parseFloat(player.stats.reb) || 0;
        const currentStl = parseFloat(player.stats.stl) || 0;

        // Get player's game history to calculate new averages
        const playerGamesQuery = query(
          collection(firebaseDB, "games"),
          orderBy("date", "asc")
        );
        const gamesSnapshot = await getDocs(playerGamesQuery);
        
        let totalGames = 0;
        let totalPts = 0;
        let total2PM = 0;
        let total2PA = 0;
        let total3PM = 0;
        let total3PA = 0;
        let totalFTM = 0;
        let totalFTA = 0;
        let totalAst = 0;
        let totalOreb = 0;
        let totalDreb = 0;
        let totalReb = 0;
        let totalStl = 0;
        let totalBlk = 0;
        let totalMin = 0;
        let totalPf = 0;
        let totalTo = 0;

        // Accumulate stats from all completed games for this player
        gamesSnapshot.docs.forEach(gameDoc => {
          const gameData = gameDoc.data();
          if (gameData.completed && gameData.playerStats) {
            const playerGameStats = gameData.playerStats.find((ps: any) => ps.playerId === stat.playerId);
            if (playerGameStats) {
              totalGames++;
              totalPts += playerGameStats.pts || 0;
              total2PM += playerGameStats.two_pm || 0;
              total2PA += playerGameStats.two_pa || 0;
              total3PM += playerGameStats.three_pm || 0;
              total3PA += playerGameStats.three_pa || 0;
              totalFTM += playerGameStats.ft_m || 0;
              totalFTA += playerGameStats.ft_a || 0;
              totalAst += playerGameStats.ast || 0;
              totalOreb += playerGameStats.oreb || 0;
              totalDreb += playerGameStats.dreb || 0;
              totalReb += playerGameStats.reb || 0;
              totalStl += playerGameStats.stl || 0;
              totalBlk += playerGameStats.blk || 0;
              totalMin += playerGameStats.min || 0;
              totalPf += playerGameStats.pf || 0;
              totalTo += playerGameStats.to || 0;
            }
          }
        });

        // Add current game stats
        totalGames++;
        totalPts += stat.pts;
        total2PM += stat.two_pm;
        total2PA += stat.two_pa;
        total3PM += stat.three_pm;
        total3PA += stat.three_pa;
        totalFTM += stat.ft_m;
        totalFTA += stat.ft_a;
        totalAst += stat.ast;
        totalOreb += stat.oreb;
        totalDreb += stat.dreb;
        totalReb += stat.reb;
        totalStl += stat.stl;
        totalBlk += stat.blk;
        totalMin += stat.min;
        totalPf += stat.pf;
        totalTo += stat.to;

        // Calculate new averages
        const newAvgPts = (totalPts / totalGames).toFixed(1);
        const newAvg2PM = (total2PM / totalGames).toFixed(1);
        const newAvg2PA = (total2PA / totalGames).toFixed(1);
        const newAvg3PM = (total3PM / totalGames).toFixed(1);
        const newAvg3PA = (total3PA / totalGames).toFixed(1);
        const newAvgFTM = (totalFTM / totalGames).toFixed(1);
        const newAvgFTA = (totalFTA / totalGames).toFixed(1);
        const newAvgAst = (totalAst / totalGames).toFixed(1);
        const newAvgOreb = (totalOreb / totalGames).toFixed(1);
        const newAvgDreb = (totalDreb / totalGames).toFixed(1);
        const newAvgReb = (totalReb / totalGames).toFixed(1);
        const newAvgStl = (totalStl / totalGames).toFixed(1);
        const newAvgBlk = (totalBlk / totalGames).toFixed(1);
        const newAvgMin = (totalMin / totalGames).toFixed(1);
        const newAvgPf = (totalPf / totalGames).toFixed(1);
        const newAvgTo = (totalTo / totalGames).toFixed(1);

        // Update player roster document
        const playerRef = doc(firebaseDB, "teams", stat.teamId, "roster", stat.playerId);
        batch.update(playerRef, {
          stats: {
            pts: newAvgPts,
            two_pm: newAvg2PM,
            two_pa: newAvg2PA,
            three_pm: newAvg3PM,
            three_pa: newAvg3PA,
            ft_m: newAvgFTM,
            ft_a: newAvgFTA,
            ast: newAvgAst,
            oreb: newAvgOreb,
            dreb: newAvgDreb,
            reb: newAvgReb,
            stl: newAvgStl,
            blk: newAvgBlk,
            min: newAvgMin,
            pf: newAvgPf,
            to: newAvgTo,
          },
          gamesPlayed: totalGames,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      // Update team win/loss records
      const winnerTeamRef = doc(firebaseDB, "teams", gameStatsForm.winnerTeamId);
      const loserTeamRef = doc(firebaseDB, "teams", loserTeamId);

      const winnerTeamDoc = await getDocs(query(collection(firebaseDB, "teams")));
      const winnerTeamData = winnerTeamDoc.docs.find(d => d.id === gameStatsForm.winnerTeamId)?.data();
      const loserTeamData = winnerTeamDoc.docs.find(d => d.id === loserTeamId)?.data();

      const winnerWins = (typeof winnerTeamData?.wins === "number" ? winnerTeamData.wins : 0) + 1;
      const winnerLosses = typeof winnerTeamData?.losses === "number" ? winnerTeamData.losses : 0;
      const loserWins = typeof loserTeamData?.wins === "number" ? loserTeamData.wins : 0;
      const loserLosses = (typeof loserTeamData?.losses === "number" ? loserTeamData.losses : 0) + 1;

      // Calculate total points for winner team (accumulate winner's score)
      const winnerGameScore = parseInt(gameStatsForm.winnerScore) || 0;
      const winnerCurrentTotalPoints = typeof winnerTeamData?.totalPoints === "number" ? winnerTeamData.totalPoints : 0;
      const winnerNewTotalPoints = winnerCurrentTotalPoints + winnerGameScore;

      // Calculate total points for loser team (accumulate loser's score)
      const loserGameScore = parseInt(gameStatsForm.loserScore) || 0;
      const loserCurrentTotalPoints = typeof loserTeamData?.totalPoints === "number" ? loserTeamData.totalPoints : 0;
      const loserNewTotalPoints = loserCurrentTotalPoints + loserGameScore;

      await updateDoc(winnerTeamRef, {
        wins: winnerWins,
        losses: winnerLosses,
        totalPoints: winnerNewTotalPoints,
        updatedAt: serverTimestamp(),
      });

      await updateDoc(loserTeamRef, {
        wins: loserWins,
        losses: loserLosses,
        totalPoints: loserNewTotalPoints,
        updatedAt: serverTimestamp(),
      });

      // Save standings to separate collection
      const winnerTeamName = winnerTeamData?.name ?? "";
      const winnerTeamGender = winnerTeamData?.gender ?? "men";
      const loserTeamName = loserTeamData?.name ?? "";
      const loserTeamGender = loserTeamData?.gender ?? "men";

      // Check if standing documents exist for both teams
      const standingsRef = collection(firebaseDB, "standings");
      const standingsSnapshot = await getDocs(standingsRef);

      // Find or create winner standing
      const winnerStandingDoc = standingsSnapshot.docs.find(
        d => d.data().teamId === gameStatsForm.winnerTeamId
      );
      if (winnerStandingDoc) {
        await updateDoc(doc(firebaseDB, "standings", winnerStandingDoc.id), {
          teamName: winnerTeamName,
          teamId: gameStatsForm.winnerTeamId,
          gender: winnerTeamGender,
          wins: winnerWins,
          losses: winnerLosses,
          totalPoints: winnerNewTotalPoints,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(standingsRef, {
          teamName: winnerTeamName,
          teamId: gameStatsForm.winnerTeamId,
          gender: winnerTeamGender,
          wins: winnerWins,
          losses: winnerLosses,
          totalPoints: winnerNewTotalPoints,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Find or create loser standing
      const loserStandingDoc = standingsSnapshot.docs.find(
        d => d.data().teamId === loserTeamId
      );
      if (loserStandingDoc) {
        await updateDoc(doc(firebaseDB, "standings", loserStandingDoc.id), {
          teamName: loserTeamName,
          teamId: loserTeamId,
          gender: loserTeamGender,
          wins: loserWins,
          losses: loserLosses,
          totalPoints: loserNewTotalPoints,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(standingsRef, {
          teamName: loserTeamName,
          teamId: loserTeamId,
          gender: loserTeamGender,
          wins: loserWins,
          losses: loserLosses,
          totalPoints: loserNewTotalPoints,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await logAuditAction("game_stats_updated", user.uid, user.email || "unknown", "game", selectedCompletedGame.id, `${winnerTeamName} vs ${loserTeamName}`);
      setStatsStatus({ type: "success", message: "Game stats saved, player averages and team records updated!" });
      setSelectedCompletedGame(null);
      setGameStatsForm(null);
      setWinnerRoster([]);
      setLoserRoster([]);
      setPlayerStatsMap({});
      setLoserStatsMap({});
    } catch (error) {
      console.error(error);
      setStatsStatus({ type: "error", message: "Failed to save game stats." });
    } finally {
      setStatsSubmitting(false);
    }
  };

  const filteredGameTeams = useMemo(() => {
    if (!gameTeamSearch.trim()) return teams.filter((t) => t.gender === gameForm.gender);
    const search = gameTeamSearch.toLowerCase();
    return teams.filter(
      (t) => t.gender === gameForm.gender && (t.name.toLowerCase().includes(search) || t.city.toLowerCase().includes(search))
    );
  }, [teams, gameForm.gender, gameTeamSearch]);

  // Auto-calculate spotlight: top 3 upcoming games (future date/time only)
  const gamesWithSpotlight = useMemo(() => {
    const now = new Date();
    
    // Filter to future games and sort by date+time ascending
    const upcomingGames = games
      .map((game) => {
        const gameDateTime = new Date(`${game.date}T${game.time}`);
        return { ...game, gameDateTime };
      })
      .filter((game) => game.gameDateTime > now)
      .sort((a, b) => a.gameDateTime.getTime() - b.gameDateTime.getTime());

    // Top 3 get spotlight
    const spotlightIds = new Set(upcomingGames.slice(0, 3).map((g) => g.id));

    // Return all games with spotlight flag
    return games.map((game) => ({
      ...game,
      spotlight: spotlightIds.has(game.id),
    }));
  }, [games]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      {authLoading ? (
        <div className="text-slate-400">Loading...</div>
      ) : !user ? (
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Admin console</p>
            <h1 className="text-3xl font-semibold">News desk</h1>
            <p className="text-sm text-slate-300">
              Authenticate with Firebase, then curate the league storytelling vault. Add a headline, attach a hero image,
              and the home feed will update in real time.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-left">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Firebase auth</p>
            <div className="space-y-2 text-sm">
              <label className="block text-slate-400">
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-white"
                  placeholder="admin@example.com"
                  required
                />
              </label>
              <label className="block text-slate-400">
                Password
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-white"
                  placeholder="••••••••"
                  required
                />
              </label>
              {authError && <p className="text-xs text-rose-300">{authError}</p>}
            </div>
            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              {authSubmitting ? t.signingIn : t.signIn}
            </button>
          </form>

          <p className="text-sm text-slate-400">
            {t.useCredentials}
          </p>
        </div>
      ) : user && !currentAdminUser ? (
        <div className="w-full max-w-2xl space-y-6">
          <div className="space-y-4 text-center">
            <div className="text-6xl">🔒</div>
            <h1 className="text-2xl font-semibold text-white">{t.accessRequired}</h1>
            <p className="text-sm text-slate-300">
              {t.notAuthorized}
            </p>
          </div>
          
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1 space-y-3">
                <p className="text-sm font-semibold text-yellow-200">Your account is not set up as an admin</p>
                <div className="space-y-2 text-xs text-yellow-100">
                  <p><strong>Logged in as:</strong> {user?.email}</p>
                  <p><strong>User ID:</strong> {user?.uid}</p>
                  <p><strong>Status:</strong> No admin document found in Firestore</p>
                </div>
                
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-2">
                  <p className="text-xs font-semibold text-yellow-200">To fix this issue:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-yellow-100">
                    <li>If you are the master admin, run the setup script: <code className="bg-black/30 px-1 rounded">node scripts/create-master-admin.js</code></li>
                    <li>Or visit: <a href="/setup-admin" className="text-yellow-300 underline hover:text-yellow-100">/setup-admin</a> and create your master account</li>
                    <li>If you are not the master admin, ask a master admin to create an admin account for you</li>
                    <li>After setup, refresh this page</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-6 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
            >
              🔄 Refresh Page
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {t.signOut}
            </button>
          </div>
        </div>
      ) : null}

      {status && (
        <div className={`fixed bottom-6 right-6 max-w-md rounded-2xl border ${statusClassMap[status.type]} p-4 text-sm shadow-2xl`}>
          {status.message}
        </div>
      )}

      {/* First Login Setup */}
      {user && currentAdminUser?.isFirstLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/20 bg-slate-900 p-8 shadow-2xl">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Welcome! 👋</h2>
              <p className="text-sm text-slate-300">
                This is your first login. Please set your display name to continue.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const displayName = formData.get('displayName') as string;
                
                if (!displayName.trim()) return;
                
                setAdminSubmitting(true);
                const result = await updateAdminProfile(user.uid, displayName.trim());
                
                if (result.success) {
                  // Reload admin user data
                  const updated = await getAdminUser(user.uid);
                  setCurrentAdminUser(updated);
                  setStatus({ type: 'success', message: 'Welcome! Your profile has been set up.' });
                } else {
                  setStatus({ type: 'error', message: result.error || 'Failed to update profile' });
                }
                setAdminSubmitting(false);
              }}
              className="space-y-4"
            >
              <label className="block space-y-2 text-sm text-slate-300">
                Display Name *
                <input
                  type="text"
                  name="displayName"
                  required
                  placeholder="Enter your name"
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-white"
                />
              </label>

              <button
                type="submit"
                disabled={adminSubmitting}
                className="w-full rounded-xl border border-white/20 bg-orange-500 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                {adminSubmitting ? 'Setting up...' : 'Continue to Dashboard'}
              </button>
            </form>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-200">
              <strong>Note:</strong> You can change your password anytime using the "Change Password" button in the dashboard.
            </div>
          </div>
        </div>
      )}

      {user && currentAdminUser && !currentAdminUser.isFirstLogin && (
        <main className="fixed inset-0 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="mx-auto flex max-w-7xl flex-col">
            {/* Header */}
            <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white">{t.adminDashboard}</h1>
                    <p className="text-xs text-slate-400">{t.contentManagement}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Online Admins Display with Dropdown */}
                    {(() => {
                      const now = Date.now();
                      const onlineAdmins = adminUsers.filter(admin => {
                        if (admin.id === user?.uid) return false; // Exclude current user
                        const lastActivity = admin.lastActivity ? new Date(admin.lastActivity).getTime() : 0;
                        return admin.isActive && lastActivity > 0 && (now - lastActivity) < 5 * 60 * 1000;
                      });
                      
                      if (onlineAdmins.length === 0) return null;
                      
                      return (
                        <div className="relative">
                          <button
                            onClick={() => setShowOnlineAdminsDropdown(!showOnlineAdminsDropdown)}
                            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 transition hover:bg-emerald-500/20 hover:border-emerald-500/50"
                          >
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                                <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
                              </div>
                              <span className="text-xs text-emerald-300">
                                {onlineAdmins.length === 1 
                                  ? onlineAdmins[0].displayName || onlineAdmins[0].email
                                  : `${onlineAdmins.length} admins online`
                                }
                              </span>
                            </div>
                            {onlineAdmins.length > 1 && (
                              <div className="ml-1 flex -space-x-2">
                                {onlineAdmins.slice(0, 3).map((admin) => (
                                  <div
                                    key={admin.id}
                                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950 bg-emerald-500/20 text-[10px] font-bold text-emerald-300"
                                    title={admin.displayName || admin.email}
                                  >
                                    {(admin.displayName || admin.email).charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {onlineAdmins.length > 3 && (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950 bg-slate-700 text-[10px] font-bold text-slate-300">
                                    +{onlineAdmins.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                            {onlineAdmins.length > 1 && (
                              <svg 
                                className={`ml-1 h-3 w-3 text-emerald-300 transition-transform ${showOnlineAdminsDropdown ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>

                          {/* Dropdown Menu */}
                          {showOnlineAdminsDropdown && onlineAdmins.length > 1 && (
                            <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-emerald-500/30 bg-slate-900/95 backdrop-blur-xl shadow-xl z-50">
                              <div className="p-2">
                                <div className="mb-2 px-2 py-1 text-xs font-semibold text-emerald-300 border-b border-emerald-500/20">
                                  Online Admins
                                </div>
                                {onlineAdmins.map((admin) => {
                                  const lastActivity = admin.lastActivity ? new Date(admin.lastActivity) : null;
                                  const timeAgo = lastActivity 
                                    ? Math.floor((now - lastActivity.getTime()) / 1000 / 60) 
                                    : null;
                                  
                                  return (
                                    <div
                                      key={admin.id}
                                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-emerald-500/10 transition"
                                    >
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                                        {(admin.displayName || admin.email).charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-white truncate">
                                          {admin.displayName || admin.email}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          {timeAgo !== null 
                                            ? timeAgo < 1 
                                              ? 'Active now' 
                                              : `Active ${timeAgo}m ago`
                                            : 'Recently active'
                                          }
                                        </div>
                                      </div>
                                      <div className="relative">
                                        <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                                        <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Language Toggle */}
                    <div className="flex rounded-lg border border-white/20 bg-white/5 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        className={`px-3 py-2 text-xs font-semibold transition ${
                          language === 'en' 
                            ? 'bg-orange-500 text-white' 
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('fr')}
                        className={`px-3 py-2 text-xs font-semibold transition ${
                          language === 'fr' 
                            ? 'bg-orange-500 text-white' 
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        FR
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(true)}
                      className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/10"
                    >
                      {t.changePassword}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/10"
                    >
                      {t.signOut}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Tab Navigation */}
              <div className="flex gap-1 overflow-x-auto px-6">
                {currentAdminUser?.permissions.canManageNews && (
                  <button
                    onClick={() => setActiveTab('stories')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                      activeTab === 'stories'
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    📰 {t.stories}
                  </button>
                )}
                {currentAdminUser?.permissions.canManageTeams && (
                  <button
                    onClick={() => setActiveTab('teams')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                      activeTab === 'teams'
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    🏀 {t.teams}
                  </button>
                )}
                {currentAdminUser?.permissions.canManageTeams && (
                  <button
                    onClick={() => setActiveTab('traffic')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                      activeTab === 'traffic'
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    🔄 {t.traffic}
                  </button>
                )}
                {currentAdminUser?.permissions.canManageGames && (
                  <button
                    onClick={() => setActiveTab('games')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                      activeTab === 'games'
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    🗓️ {t.games}
                  </button>
                )}
                {currentAdminUser?.permissions.canManageGames && (
                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                      activeTab === 'stats'
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    📊 {t.stats}
                  </button>
                )}
                {(currentAdminUser?.permissions.canManageReferees || 
                  currentAdminUser?.permissions.canManageVenues || 
                  currentAdminUser?.permissions.canManagePartners) && (
                  <button
                    onClick={() => setActiveTab('league')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                      activeTab === 'league'
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    ⚙️ {t.league}
                  </button>
                )}
                {currentAdminUser?.permissions.canManageAdmins && (
                  <button
                    onClick={() => setActiveTab('admins')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                      activeTab === 'admins'
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    👥 {t.admins}
                  </button>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="px-6 py-8">
              {/* Database Reset Section - Only for master admins */}
              {currentAdminUser?.roles.includes('master') && (
              <section className="mb-8 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-200">⚠️ {t.databaseReset}</h3>
                    <p className="mt-1 text-xs text-rose-300/80">
                      {t.resetDescription}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAllStats}
                    disabled={resetSubmitting}
                    className="w-full shrink-0 rounded-full border border-rose-400/60 bg-rose-500/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-rose-100 transition hover:border-rose-400/80 hover:bg-rose-500/30 disabled:opacity-50 sm:w-auto sm:py-2"
                  >
                    {resetSubmitting ? t.resetting : t.resetAllStats}
                  </button>
                </div>
                {resetStatus && (
                  <div className={`mt-3 rounded-xl border p-3 text-xs ${statusClassMap[resetStatus.type]}`}>
                    {resetStatus.message}
                  </div>
                )}
              </section>
              )}

              {/* Tab Content Sections */}
              <div className="space-y-4">
              {/* Stories Tab Content */}
              {activeTab === 'stories' && currentAdminUser?.permissions.canManageNews && (
              <div className="space-y-4">
            {/* Story Form */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">📰 {form.id ? t.editStory : t.createStory}</h2>
                {form.id && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    {t.newStory}
                  </button>
                )}
              </div>
              <form onSubmit={handleSubmitNews} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-slate-300">
                    {t.title} *
                    <input
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                      value={form.title}
                      onChange={(event) => updateFormField("title", event.target.value)}
                      placeholder=""
                      required
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-300">
                    {t.category}
                    <input
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                      value={form.category}
                      onChange={(event) => updateFormField("category", event.target.value)}
                      placeholder=""
                    />
                  </label>
                </div>
                <label className="space-y-1 text-xs text-slate-300">
                  {t.headline} *
                  <input
                    className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    value={form.headline}
                    onChange={(event) => updateFormField("headline", event.target.value)}
                    placeholder=""
                    required
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  {t.summary} *
                  <textarea
                    className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    rows={3}
                    value={form.summary}
                    onChange={(event) => updateFormField("summary", event.target.value)}
                    placeholder=""
                    required
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">{t.coverPhoto}</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-orange-500 file:px-2 file:py-1 file:text-xs file:text-white hover:file:bg-orange-600"
                    />
                  </div>
                  {imagePreview && (
                    <div className="relative h-20 overflow-hidden rounded-lg border border-white/10">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        fill
                        className="object-cover"
                        sizes="200px"
                        unoptimized
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {submitting ? t.saving : form.id ? t.update : t.publish}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
                  >
                    {t.clear}
                  </button>
                </div>
              </form>
            </section>

            {/* Published Stories List */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-bold text-white">{t.publishedStories} ({news.length})</h2>
              {news.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-400">{t.noStoriesYet}</p>
                  <p className="text-xs text-slate-500 mt-1">{t.createFirstStory}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {news.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-center gap-3 rounded-lg border border-white/5 bg-slate-800/30 p-3 hover:bg-slate-800/50 transition"
                    >
                      {article.imageUrl ? (
                        <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded border border-white/10">
                          <Image
                            src={article.imageUrl}
                            alt={article.title}
                            fill
                            className="object-cover"
                            sizes="100px"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded border border-dashed border-white/10 bg-slate-900/50">
                          <span className="text-xs text-slate-600">{t.noImage}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {article.category && (
                              <span className="text-[10px] text-orange-400 uppercase">{article.category}</span>
                            )}
                            <h3 className="text-sm font-semibold text-white truncate">{article.title}</h3>
                            <p className="text-xs text-slate-400 line-clamp-1">{article.headline}</p>
                          </div>
                          <span className="text-[10px] text-slate-500 flex-shrink-0">
                            {formatAdminPublishedLabel(article.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(article)}
                          className="rounded border border-white/20 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
                        >
                          {t.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(article)}
                          className="rounded border border-rose-500/30 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                        >
                          {t.delete}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
              </div>
              )}

              {/* Teams Tab Content */}
              {activeTab === 'teams' && currentAdminUser?.permissions.canManageTeams && (
              <>
              <button
                type="button"
                onClick={() => setTeamAssistantOpen(!teamAssistantOpen)}
                className="group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 p-8 text-left shadow-xl transition hover:border-white/30 hover:shadow-2xl"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Module</p>
                    <h2 className="mt-2 text-3xl font-bold text-white">Team Assistant</h2>
                    <p className="mt-3 text-sm text-slate-300">
                      Create teams, upload logos, manage rosters, and organize franchise directory.
                    </p>
                  </div>
                  <span className="text-2xl text-white">{teamAssistantOpen ? '−' : '+'}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 opacity-0 transition group-hover:opacity-100"></div>
              </button>

            {teamAssistantOpen && (
              <div className="space-y-6">

            {teamStatus ? (
              <div className={`rounded-2xl border ${statusClassMap[teamStatus.type]} p-4 text-sm`}>
                {teamStatus.message}
              </div>
            ) : null}

            {rosterStatus ? (
              <div className={`rounded-2xl border ${statusClassMap[rosterStatus.type]} p-4 text-sm`}>
                {rosterStatus.message}
              </div>
            ) : null}

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Team assistant</p>
                <h2 className="text-2xl font-semibold">Manage franchises & rosters</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Create new clubs, update their branding, and curate roster cards. Changes sync live in Firestore so the site can
                  pull updated data in real time.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                {/* Mobile Modal: Roster editor popup */}
                {selectedTeamId ? (
                  <div 
                    className="lg:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl px-4"
                    onClick={() => { setSelectedTeamId(null); resetRosterForm(); }}
                  >
                    <div 
                      className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-white/20 bg-slate-900 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-white truncate">Roster Editor</h3>
                          <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                            {teams.find((team) => team.id === selectedTeamId)?.name ?? "Selected team"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedTeamId(null); resetRosterForm(); }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3">
                        {!rosterFormVisible ? (
                          <button
                            type="button"
                            onClick={() => setRosterFormVisible(true)}
                            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
                          >
                            + Add Player
                          </button>
                        ) : (
                          <form onSubmit={handleSubmitRosterPlayer} className="space-y-2.5 overflow-hidden">
                            <div className="grid gap-2.5 grid-cols-1">
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                First name
                                <input
                                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white"
                                  value={rosterForm.firstName}
                                  onChange={(event) => setRosterForm((prev) => ({ ...prev, firstName: event.target.value }))}
                                  required
                                />
                              </label>
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                Last name
                                <input
                                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white"
                                  value={rosterForm.lastName}
                                  onChange={(event) => setRosterForm((prev) => ({ ...prev, lastName: event.target.value }))}
                                  required
                                />
                              </label>
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                Jersey #
                                <input
                                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white"
                                  value={rosterForm.number}
                                  onChange={(event) => setRosterForm((prev) => ({ ...prev, number: event.target.value }))}
                                  inputMode="numeric"
                                  required
                                />
                              </label>
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                Player License
                                <input
                                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white disabled:bg-slate-900/30 disabled:cursor-not-allowed"
                                  value={rosterForm.playerLicense}
                                  onChange={(event) => setRosterForm((prev) => ({ ...prev, playerLicense: event.target.value }))}
                                  disabled={!!rosterForm.id}
                                  required={!rosterForm.id}
                                  placeholder="Unique ID (cannot be changed)"
                                />
                              </label>
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                Height
                                <input
                                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white"
                                  value={rosterForm.height}
                                  onChange={(event) => setRosterForm((prev) => ({ ...prev, height: event.target.value }))}
                                />
                              </label>
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                Date of birth
                                <input
                                  type="date"
                                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white"
                                  value={rosterForm.dateOfBirth}
                                  onChange={(event) => setRosterForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                                />
                              </label>
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                Position
                                <select
                                  className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white"
                                  value={rosterForm.position}
                                  onChange={(event) => setRosterForm((prev) => ({ ...prev, position: event.target.value }))}
                                  required
                                >
                                  <option value="">Select position</option>
                                  <option value="Point Guard">Point Guard</option>
                                  <option value="Shooting Guard">Shooting Guard</option>
                                  <option value="Small Forward">Small Forward</option>
                                  <option value="Power Forward">Power Forward</option>
                                  <option value="Center">Center</option>
                                </select>
                              </label>
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                Nationality
                                  <div>
                                    <input
                                      list="country-options"
                                      placeholder="Search country..."
                                      value={rosterForm.nationality}
                                      onChange={(event) => setRosterForm((prev) => ({ ...prev, nationality: event.target.value }))}
                                      className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white"
                                    />
                                    <datalist id="country-options">
                                      {countries.map((c) => (
                                        <option key={c.code} value={c.name}>{flagFromCode(c.code)} {c.name}</option>
                                      ))}
                                    </datalist>
                                  </div>
                              </label>
                              <div className="flex items-center gap-2 text-[12px] text-slate-300">
                                <input
                                  id="double-nationality"
                                  type="checkbox"
                                  checked={!!rosterForm.nationality2Enabled}
                                  onChange={(e) => setRosterForm((prev) => ({ ...prev, nationality2Enabled: e.target.checked }))}
                                  className="h-4 w-4"
                                />
                                <label htmlFor="double-nationality" className="select-none text-[11px]">Add second nationality</label>
                              </div>
                              {rosterForm.nationality2Enabled ? (
                                <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                  Second nationality
                                  <div>
                                    <input
                                      list="country-options"
                                      placeholder="Search second country..."
                                      value={rosterForm.nationality2}
                                      onChange={(event) => setRosterForm((prev) => ({ ...prev, nationality2: event.target.value }))}
                                      className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-2 text-sm text-white focus:border-white"
                                    />
                                  </div>
                                </label>
                              ) : null}
                            </div>
                            <div className="space-y-2">
                              <label className="space-y-1 text-[10px] text-slate-300 min-w-0">
                                Upload headshot
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handlePlayerHeadshotChange}
                                  className="w-full min-w-0 rounded-lg border border-dashed border-white/20 bg-slate-900/40 px-2.5 py-2 text-[10px] text-slate-300"
                                />
                                {playerHeadshotFile || playerHeadshotPreview ? (
                                  <button
                                    type="button"
                                    onClick={clearPlayerHeadshotSelection}
                                    className="self-start rounded-lg border border-white/20 px-2 py-1 text-[9px] uppercase tracking-[0.3em] text-slate-300 hover:bg-white/5"
                                  >
                                    Clear
                                  </button>
                                ) : null}
                              </label>
                              {playerHeadshotPreview ? (
                                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
                                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                                    <Image src={playerHeadshotPreview} alt="Preview" fill className="object-cover" unoptimized />
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    {playerHeadshotFile ? "Ready to save" : "Current image"}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                type="submit"
                                disabled={rosterSubmitting}
                                className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {rosterSubmitting ? "Saving…" : rosterForm.id ? "Update" : "Add"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRosterFormVisible(false)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300 hover:bg-white/5"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Current Roster List */}
                        {roster.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between px-1">
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Roster ({roster.length})</p>
                            </div>
                            <div className="space-y-2">
                              {roster.map((player) => (
                                <div
                                  key={player.id}
                                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 p-2.5 hover:bg-slate-900/70 transition"
                                >
                                  <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                                    {player.headshot ? (
                                      <Image src={player.headshot} alt={player.firstName} fill className="object-cover" unoptimized />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-500">
                                        {player.firstName[0]}{player.lastName[0]}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">
                                      #{player.number} {player.firstName} {player.lastName}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {player.position || "—"} · {player.height || "—"}
                                      {player.nationality && (
                                        ` · ${player.nationality}${player.nationality2 ? ` / ${player.nationality2}` : ""}`
                                      )}
                                    </p>
                                    {player.playerLicense && (
                                      <p className="text-[9px] text-slate-500">License: {player.playerLicense}</p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleEditRosterPlayer(player)}
                                      className="rounded-lg border border-white/20 px-2 py-1 text-[9px] uppercase tracking-[0.3em] text-white hover:bg-white/10"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleInitiateTransfer(player)}
                                      className="rounded-lg border border-sky-500/40 px-2 py-1 text-[9px] uppercase tracking-[0.3em] text-sky-200 hover:bg-sky-500/10"
                                    >
                                      Transfer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRosterPlayer(player)}
                                      className="rounded-lg border border-rose-500/40 px-2 py-1 text-[9px] uppercase tracking-[0.3em] text-rose-200 hover:bg-rose-500/10"
                                    >
                                      Del
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-xs text-slate-500">
                            No players yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
                
                <div className="space-y-6">
                  {teamFormExpanded ? (
                    <form onSubmit={handleSubmitTeam} className="space-y-3 sm:space-y-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                            {teamForm.id ? "Edit team" : "Add new team"}
                          </p>
                          <h3 className="text-lg font-semibold text-white truncate">
                            {teamForm.name ? teamForm.name : "Start drafting"}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={closeTeamForm}
                            className="rounded-full border border-white/15 px-3 sm:px-4 py-1 text-[10px] uppercase tracking-[0.4em] text-slate-200"
                          >
                            Hide form
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                        <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                          Team name
                          <input
                            className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 px-2 sm:px-3 py-2 text-xs sm:text-sm text-white focus:border-white"
                            value={teamForm.name}
                            onChange={(event) => updateTeamFormField("name", event.target.value)}
                            placeholder="New Gen"
                            required
                          />
                        </label>
                        <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                          City / prefix
                          <input
                            className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 px-2 sm:px-3 py-2 text-xs sm:text-sm text-white focus:border-white"
                            value={teamForm.city}
                            onChange={(event) => updateTeamFormField("city", event.target.value)}
                            placeholder="Kinshasa"
                          />
                        </label>
                        <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                          Gender
                          <select
                            className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 px-2 sm:px-3 py-2 text-xs sm:text-sm text-white focus:border-white"
                            value={teamForm.gender}
                            onChange={(event) => updateTeamFormField("gender", event.target.value)}
                          >
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                          Nationality
                          <input
                            className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 px-2 sm:px-3 py-2 text-xs sm:text-sm text-white focus:border-white"
                            value={teamForm.nationality}
                            onChange={(event) => updateTeamFormField("nationality", event.target.value)}
                            placeholder="DRC"
                          />
                        </label>
                        <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0 sm:col-span-2">
                          Nationality 2 (optional)
                          <input
                            className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 px-2 sm:px-3 py-2 text-xs sm:text-sm text-white focus:border-white"
                            value={teamForm.nationality2}
                            onChange={(event) => updateTeamFormField("nationality2", event.target.value)}
                            placeholder="Optional second nationality"
                          />
                        </label>
                      </div>
                      <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                        Team colors
                        <div className="flex gap-2 min-w-0">
                          <input
                            type="color"
                            value={teamForm.colorsInput.split(',')[0]?.trim() || '#38bdf8'}
                            onChange={(event) => {
                              const colors = teamForm.colorsInput.split(',').map(c => c.trim()).filter(Boolean);
                              colors[0] = event.target.value;
                              updateTeamFormField('colorsInput', colors.join(', '));
                            }}
                            className="h-10 w-12 sm:w-16 cursor-pointer rounded-xl border border-white/10 bg-slate-900/60"
                          />
                          <input
                            type="color"
                            value={teamForm.colorsInput.split(',')[1]?.trim() || '#a855f7'}
                            onChange={(event) => {
                              const colors = teamForm.colorsInput.split(',').map(c => c.trim()).filter(Boolean);
                              colors[1] = event.target.value;
                              updateTeamFormField('colorsInput', colors.join(', '));
                            }}
                            className="h-10 w-12 sm:w-16 cursor-pointer rounded-xl border border-white/10 bg-slate-900/60"
                          />
                          <input
                            className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 px-2 sm:px-3 py-2 text-xs sm:text-sm text-white focus:border-white"
                            value={teamForm.colorsInput}
                            onChange={(event) => updateTeamFormField('colorsInput', event.target.value)}
                            placeholder="#38bdf8, #a855f7"
                          />
                        </div>
                      </label>
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-[260px_1fr]">
                        <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                          Upload logo (optional)
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleTeamLogoChange}
                              className="w-full min-w-0 rounded-2xl border border-dashed border-white/20 bg-slate-900/40 px-2 sm:px-3 py-2 text-[10px] sm:text-xs text-slate-300"
                            />
                            {teamLogoFile || teamLogoPreview ? (
                              <button
                                type="button"
                                onClick={clearTeamLogoSelection}
                                className="rounded-full border border-white/20 px-2 sm:px-3 py-1 text-[10px] sm:text-xs uppercase tracking-[0.4em] text-slate-300 whitespace-nowrap"
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                          <p className="text-[10px] sm:text-xs text-slate-500">Stored in Firebase Storage under team-logos/</p>
                        </label>
                        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-3 sm:p-4 min-w-0">
                          {teamLogoPreview ? (
                            <div className="relative h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                              <Image src={teamLogoPreview} alt="Team logo preview" fill className="object-contain p-1" unoptimized />
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-white/10 text-[10px] uppercase tracking-[0.4em] text-slate-500">
                              Logo
                            </div>
                          )}
                          <div className="text-xs text-slate-400 min-w-0">
                            <p className="truncate">{teamLogoFile ? "Using new upload" : teamLogoPreview ? "Using stored logo" : "No logo selected"}</p>
                            <p className="text-[10px] sm:text-[11px] text-slate-500">Drop PNG/SVG/JPG under 1MB.</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="submit"
                          disabled={teamSubmitting}
                          className="rounded-full border border-white/20 bg-white/10 px-4 sm:px-5 py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed"
                        >
                          {teamSubmitting ? "Saving…" : teamForm.id ? "Update team" : "Add team"}
                        </button>
                        <button
                          type="button"
                          onClick={resetTeamForm}
                          className="rounded-full border border-white/10 px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-[0.4em] text-slate-300"
                        >
                          Clear form
                        </button>
                        {teamForm.id ? (
                          <span className="text-[10px] sm:text-xs text-slate-400">Currently editing {teamForm.name || "this team"}.</span>
                        ) : null}
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-6 text-center">
                      <p className="text-sm text-slate-400">Team creation fields stay hidden until you choose to add a franchise.</p>
                      <button
                        type="button"
                        onClick={() => setTeamFormExpanded(true)}
                        className="mt-4 rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.4em] text-white"
                      >
                        Add team
                      </button>
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                          Team Management {selectedTeamId ? <span className="text-orange-400">· Selected</span> : null}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {teams.length} saved · {selectedTeamId ? "Tap a different team to switch" : "Tap a team to edit roster"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleResetAllStats}
                          disabled={resetSubmitting}
                          className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          {resetSubmitting ? "Resetting..." : "⚠️ Reset All Stats"}
                        </button>
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.4em] transition ${teamGenderFilter === "men" ? "bg-white text-black" : "border border-white/30 text-white hover:border-white/60"}`}
                          onClick={() => {
                            setTeamGenderFilter("men");
                            localStorage.setItem('adminTeamGenderFilter', 'men');
                          }}
                        >
                          Men
                        </button>
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.4em] transition ${teamGenderFilter === "women" ? "bg-white text-black" : "border border-white/30 text-white hover:border-white/60"}`}
                          onClick={() => {
                            setTeamGenderFilter("women");
                            localStorage.setItem('adminTeamGenderFilter', 'women');
                          }}
                        >
                          Women
                        </button>
                      </div>
                    </div>
                    {resetStatus && (
                      <div className={`mb-4 rounded-xl border p-3 ${statusClassMap[resetStatus.type]}`}>
                        <p className="text-sm">{resetStatus.message}</p>
                      </div>
                    )}
                    
                    {/* Search Bar */}
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Search teams..."
                        value={teamSearchQuery}
                        onChange={(e) => setTeamSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-white focus:outline-none"
                      />
                    </div>

                    {paginatedTeams.length ? (
                      <>
                        <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                          {paginatedTeams.map((team, teamIndex) => {
                          const isFirestore = teams.some(t => t.id === team.id);
                          const isActive = isFirestore && selectedTeamId === team.id;
                          const isTemplate = !isFirestore;
                          return (
                            <article
                              key={`${team.id}-${team.gender}-${teamIndex}`}
                              onClick={() => isFirestore && handleSelectTeam(team.id)}
                              className={`group rounded-xl border p-3 transition-all duration-200 ${
                                isActive
                                  ? "border-orange-400/60 bg-orange-500/10 scale-[1.02]"
                                  : isTemplate
                                    ? "border-dashed border-white/15 bg-slate-900/30"
                                    : "border-white/10 bg-slate-900/50"
                              } ${isFirestore ? "cursor-pointer hover:border-white/30 hover:scale-[1.02]" : ""}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                                  {team.logo ? (
                                    <Image
                                      src={team.logo}
                                      alt={`${team.name} logo`}
                                      fill
                                      className="object-contain p-1"
                                      sizes="48px"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.4em] text-slate-500">
                                      Logo
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-white flex items-center gap-1.5 truncate">
                                    {team.name}
                                    {isTemplate ? (
                                      <span className="rounded-full border border-white/20 px-2 py-[2px] text-[9px] uppercase tracking-[0.4em] text-slate-300">
                                        Template
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">
                                    {team.city || "—"} · {team.gender === "men" ? "MEN" : "WOMEN"}
                                  </p>
                                </div>
                              </div>
                              {team.colors.length ? (
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {team.colors.map((tone, index) => (
                                    <span
                                      key={`${team.id}-${tone}-${index}`}
                                      className="h-4 w-8 rounded-full border border-white/10"
                                      style={{ backgroundColor: tone }}
                                      title={tone}
                                    />
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-4 flex flex-wrap gap-2">
                                {isTemplate ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUseStaticTeam(team);
                                    }}
                                    className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white hover:border-white/40"
                                  >
                                    Load & add
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTeam(team);
                                      }}
                                      className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white hover:border-white/40"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTeam(team);
                                      }}
                                      className="rounded-full border border-rose-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-rose-200 hover:border-rose-400"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      
                      {/* Pagination Controls */}
                      {totalTeamPages > 1 && (
                        <div className="mt-6 flex items-center justify-between">
                          <p className="text-xs text-slate-500">
                            Page {teamCurrentPage} of {totalTeamPages} ({filteredFranchiseTeams.length} teams)
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setTeamCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={teamCurrentPage === 1}
                              className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-wider text-white transition hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ← Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setTeamCurrentPage(prev => Math.min(totalTeamPages, prev + 1))}
                              disabled={teamCurrentPage === totalTeamPages}
                              className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-wider text-white transition hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">
                        {teamSearchQuery ? `No teams found matching "${teamSearchQuery}"` : "No teams found for selected filter."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Desktop roster editor (hidden on mobile when team selected) */}
                <div className={`space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5 ${selectedTeamId ? 'hidden lg:block' : ''}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Roster editor</h3>
                      <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                        {selectedTeamId ? teams.find((team) => team.id === selectedTeamId)?.name ?? "Selected team" : "Select a team"}
                      </p>
                    </div>
                    {selectedTeamId ? (
                      <button
                        type="button"
                        onClick={resetRosterForm}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.4em] text-slate-300"
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  {selectedTeamId ? (
                    <>
                      {!rosterFormVisible ? (
                        <button
                          type="button"
                          onClick={() => setRosterFormVisible(true)}
                          className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-white/20"
                        >
                          Add player
                        </button>
                      ) : null}
                      {rosterFormVisible ? (
                        <form onSubmit={handleSubmitRosterPlayer} className="space-y-3 sm:space-y-4 overflow-hidden">
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                            First name
                            <input
                              className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white"
                              value={rosterForm.firstName}
                              onChange={(event) => setRosterForm((prev) => ({ ...prev, firstName: event.target.value }))}
                              required
                            />
                          </label>
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                            Last name
                            <input
                              className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white"
                              value={rosterForm.lastName}
                              onChange={(event) => setRosterForm((prev) => ({ ...prev, lastName: event.target.value }))}
                              required
                            />
                          </label>
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                            Jersey #
                            <input
                              className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white"
                              value={rosterForm.number}
                              onChange={(event) => setRosterForm((prev) => ({ ...prev, number: event.target.value }))}
                              inputMode="numeric"
                              required
                            />
                          </label>
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                            Player License
                            <input
                              className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white disabled:bg-slate-900/30 disabled:cursor-not-allowed"
                              value={rosterForm.playerLicense}
                              onChange={(event) => setRosterForm((prev) => ({ ...prev, playerLicense: event.target.value }))}
                              disabled={!!rosterForm.id}
                              required={!rosterForm.id}
                              placeholder="Unique ID (cannot be changed)"
                            />
                          </label>
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                            Height
                            <input
                              className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white"
                              value={rosterForm.height}
                              onChange={(event) => setRosterForm((prev) => ({ ...prev, height: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                            Date of birth
                            <input
                              type="date"
                              className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white"
                              value={rosterForm.dateOfBirth}
                              onChange={(event) => setRosterForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                            Position
                            <select
                              className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white"
                              value={rosterForm.position}
                              onChange={(event) => setRosterForm((prev) => ({ ...prev, position: event.target.value }))}
                              required
                            >
                              <option value="">Select position</option>
                              <option value="Point Guard">Point Guard</option>
                              <option value="Shooting Guard">Shooting Guard</option>
                              <option value="Small Forward">Small Forward</option>
                              <option value="Power Forward">Power Forward</option>
                              <option value="Center">Center</option>
                            </select>
                          </label>
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
                            Nationality
                            <div>
                              <input
                                list="country-options"
                                placeholder="Search country..."
                                value={rosterForm.nationality}
                                onChange={(event) => setRosterForm((prev) => ({ ...prev, nationality: event.target.value }))}
                                className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white"
                              />
                              <datalist id="country-options">
                                {countries.map((c) => (
                                  <option key={c.code} value={c.name}>{flagFromCode(c.code)} {c.name}</option>
                                ))}
                              </datalist>
                            </div>
                          </label>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
                          <input
                            id="double-nationality-desktop"
                            type="checkbox"
                            checked={!!rosterForm.nationality2Enabled}
                            onChange={(e) => setRosterForm((prev) => ({ ...prev, nationality2Enabled: e.target.checked }))}
                            className="h-4 w-4"
                          />
                          <label htmlFor="double-nationality-desktop" className="select-none">Add second nationality</label>
                        </div>
                        {rosterForm.nationality2Enabled ? (
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300">
                            Second nationality
                            <div>
                              <input
                                list="country-options"
                                placeholder="Search second country..."
                                value={rosterForm.nationality2}
                                onChange={(event) => setRosterForm((prev) => ({ ...prev, nationality2: event.target.value }))}
                                className="w-full rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-xs sm:text-sm text-white focus:border-white"
                              />
                            </div>
                          </label>
                        ) : null}
                        <div className="space-y-3">
                          <label className="space-y-1 text-xs sm:text-sm text-slate-300">
                            Upload headshot
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePlayerHeadshotChange}
                                className="w-full rounded-xl sm:rounded-2xl border border-dashed border-white/20 bg-slate-900/40 px-3 py-2 text-xs text-slate-300"
                              />
                              {playerHeadshotFile || playerHeadshotPreview ? (
                                <button
                                  type="button"
                                  onClick={clearPlayerHeadshotSelection}
                                  className="rounded-full border border-white/20 px-3 py-1 text-[10px] sm:text-xs uppercase tracking-wider text-slate-300 flex-shrink-0"
                                >
                                  Clear
                                </button>
                              ) : null}
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-500">Stored in Firebase Storage under player-headshots/</p>
                          </label>
                          {playerHeadshotPreview && (
                            <div className="flex items-center gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-slate-900/40 p-3">
                              <div className="relative h-12 w-12 sm:h-16 sm:w-16 overflow-hidden rounded-full border border-white/10 bg-black/40 flex-shrink-0">
                                <Image src={playerHeadshotPreview} alt="Player headshot preview" fill className="object-cover" unoptimized />
                              </div>
                              <div className="text-xs text-slate-400 min-w-0">
                                <p className="font-medium text-white truncate">{rosterForm.firstName || rosterForm.lastName ? `${rosterForm.firstName} ${rosterForm.lastName}`.trim() : "Player name"}</p>
                                <p className="text-[10px] sm:text-xs">Preview of headshot image</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                          <button
                            type="submit"
                            disabled={rosterSubmitting}
                            className="w-full sm:w-auto rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/20 disabled:cursor-not-allowed"
                          >
                            {rosterSubmitting ? "Saving…" : rosterForm.id ? "Update player" : "Add player"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRosterFormVisible(false);
                              resetRosterForm();
                            }}
                            className="w-full sm:w-auto rounded-full border border-white/10 px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wider text-slate-300"
                          >
                            Cancel
                          </button>
                          {rosterForm.id ? (
                            <span className="text-[10px] sm:text-xs text-slate-400">Editing {rosterForm.firstName || rosterForm.lastName ? `${rosterForm.firstName} ${rosterForm.lastName}`.trim() : "this player"}.</span>
                          ) : null}
                        </div>
                      </form>
                      ) : null}

                      <div className="space-y-3">
                        {roster.length ? (
                          roster.map((player) => (
                            <div key={player.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{player.firstName} {player.lastName}</p>
                                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                                    #{player.number ?? "—"} · {player.position || "Position TBC"} · {player.height || "Height TBC"}
                                    {player.nationality && (
                                      ` · ${player.nationality}${player.nationality2 ? ` / ${player.nationality2}` : ""}`
                                    )}
                                  </p>
                                  {player.playerLicense && (
                                    <p className="text-[10px] text-slate-500">License: {player.playerLicense}</p>
                                  )}
                                </div>
                                <div className="flex gap-2 text-xs text-slate-300">
                                  <span>PTS {player.stats.pts || "—"}</span>
                                  <span>REB {player.stats.reb || "—"}</span>
                                  <span>STL {player.stats.stl || "—"}</span>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditRosterPlayer(player)}
                                  className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white hover:border-white/40"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleInitiateTransfer(player)}
                                  className="rounded-full border border-sky-500/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-sky-200 hover:border-sky-400"
                                >
                                  Transfer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRosterPlayer(player)}
                                  className="rounded-full border border-rose-500/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-rose-200 hover:border-rose-400"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-2xl border border-dashed border-white/20 bg-slate-900/40 p-4 text-sm text-slate-400">
                            No players saved for this roster yet. Use the form above to add the first one.
                          </p>
                        )}
                      </div>

                      {/* Coach/Staff Section */}
                      <div className="mt-8 space-y-4">
                        <div>
                          <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                            Coaching Staff
                          </h4>
                          {!coachStaffFormVisible && (
                            <div className="space-y-3">
                              {/* Head Coach Section - Priority */}
                              <div className="rounded-xl border-2 border-orange-500/30 bg-orange-500/5 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">
                                      👑
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">Head Coach</span>
                                  </div>
                                  {coachStaffList.filter(c => c.role === "head_coach").length === 0 && (
                                    <span className="text-[10px] uppercase tracking-wider text-orange-400/60">Required</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openCoachStaffForm("head_coach")}
                                  disabled={coachStaffList.filter(c => c.role === "head_coach").length >= 1}
                                  className="w-full rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  {coachStaffList.filter(c => c.role === "head_coach").length >= 1 ? '✓ Head Coach Added' : '+ Add Head Coach'}
                                </button>
                              </div>

                              {/* Assistant Coaches */}
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Assistant Coaches</span>
                                  <span className="text-[10px] text-slate-500">{coachStaffList.filter(c => c.role === "assistant_coach").length}/2</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openCoachStaffForm("assistant_coach")}
                                  disabled={coachStaffList.filter(c => c.role === "assistant_coach").length >= 2}
                                  className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  + Add Assistant Coach
                                </button>
                              </div>

                              {/* Support Staff */}
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="mb-2">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Support Staff</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openCoachStaffForm("staff")}
                                  className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/20"
                                >
                                  + Add Staff Member
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {coachStaffFormVisible && coachStaffForm && (
                          <form onSubmit={handleSubmitCoachStaff} className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs uppercase tracking-wider text-slate-400">
                                {coachStaffForm.id ? "Edit" : "Add"} {coachStaffForm.role === "head_coach" ? "Head Coach" : coachStaffForm.role === "assistant_coach" ? "Assistant Coach" : "Staff Member"}
                              </h5>
                              <button
                                type="button"
                                onClick={resetCoachStaffForm}
                                className="text-xs text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                            
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1 text-xs text-slate-300">
                                First name
                                <input
                                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                                  value={coachStaffForm.firstName}
                                  onChange={(e) => setCoachStaffForm({ ...coachStaffForm, firstName: e.target.value })}
                                  required
                                />
                              </label>
                              <label className="space-y-1 text-xs text-slate-300">
                                Last name
                                <input
                                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                                  value={coachStaffForm.lastName}
                                  onChange={(e) => setCoachStaffForm({ ...coachStaffForm, lastName: e.target.value })}
                                  required
                                />
                              </label>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-300 mb-1">Headshot (optional)</label>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleCoachHeadshotChange}
                                className="w-full text-xs text-slate-300"
                              />
                              {coachHeadshotPreview && (
                                <div className="mt-2 relative h-24 w-24 rounded-lg overflow-hidden border border-white/10">
                                  <Image src={coachHeadshotPreview} alt="Preview" fill className="object-cover" unoptimized />
                                </div>
                              )}
                            </div>

                            <button
                              type="submit"
                              disabled={coachStaffSubmitting}
                              className="w-full rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-black transition hover:bg-slate-200 disabled:opacity-50"
                            >
                              {coachStaffSubmitting ? "Saving..." : coachStaffForm.id ? "Update" : "Add"}
                            </button>
                          </form>
                        )}

                        <div className="space-y-2">
                          {coachStaffList.length > 0 ? (
                            coachStaffList.map((member) => (
                              <div 
                                key={member.id} 
                                className={`rounded-xl border p-3 ${
                                  member.role === 'head_coach' 
                                    ? 'border-orange-500/40 bg-orange-500/10' 
                                    : 'border-white/10 bg-slate-900/40'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {member.headshot ? (
                                      <div className={`relative h-12 w-12 rounded-full overflow-hidden border-2 ${
                                        member.role === 'head_coach' ? 'border-orange-500/60' : 'border-white/10'
                                      }`}>
                                        <Image src={member.headshot} alt={member.firstName} fill className="object-cover" unoptimized />
                                      </div>
                                    ) : (
                                      <div className={`h-12 w-12 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                                        member.role === 'head_coach' 
                                          ? 'border-orange-500/60 bg-orange-500/20 text-orange-300' 
                                          : 'border-white/10 bg-slate-800 text-slate-400'
                                      }`}>
                                        {member.firstName[0]}{member.lastName[0]}
                                      </div>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        {member.role === 'head_coach' && (
                                          <span className="text-xs">👑</span>
                                        )}
                                        <p className={`text-sm font-semibold ${
                                          member.role === 'head_coach' ? 'text-orange-200' : 'text-white'
                                        }`}>
                                          {member.firstName} {member.lastName}
                                        </p>
                                      </div>
                                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                                        member.role === 'head_coach' ? 'text-orange-400' : 'text-slate-400'
                                      }`}>
                                        {member.role === "head_coach" ? "Head Coach" : member.role === "assistant_coach" ? "Assistant Coach" : "Staff"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEditCoachStaff(member)}
                                      className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-wider text-white hover:border-white/40 hover:bg-white/10"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCoachStaff(member)}
                                      className="rounded-full border border-rose-500/40 px-3 py-1 text-[10px] uppercase tracking-wider text-rose-200 hover:border-rose-400 hover:bg-rose-500/10"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-dashed border-white/20 bg-slate-900/30 p-4">
                              <p className="text-xs text-slate-400 text-center mb-2">
                                No coaching staff added yet.
                              </p>
                              <p className="text-[10px] text-slate-500 text-center">
                                Start by adding a head coach first
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-white/20 bg-slate-900/40 p-4 text-sm text-slate-400">
                      Select a franchise in the table to manage its roster.
                    </p>
                  )}
                </div>
              </div>
            </section>

              {/* Transfer Modal */}
              {transferModalVisible && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={handleCancelTransfer}>
                  <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-semibold text-white mb-4">Transfer Player</h3>
                    <p className="text-sm text-slate-300 mb-4">
                      You are about to transfer <span className="font-semibold text-white">{transferPlayerName}</span> from <span className="font-semibold text-white">{transferSourceTeamName}</span> to another team.
                    </p>
                    <label className="block text-xs text-slate-400 mb-2">Select destination team:</label>
                    <select
                      value={transferTargetTeamId}
                      onChange={(e) => setTransferTargetTeamId(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white mb-6 focus:border-white"
                    >
                      <option value="">-- Select team --</option>
                      {teams
                        .filter((t) => t.id !== transferSourceTeamId)
                        .map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team.gender === "men" ? "Men" : "Women"})
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmTransfer}
                        disabled={!transferTargetTeamId || transferSubmitting}
                        className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {transferSubmitting ? "Transferring..." : "Confirm transfer"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelTransfer}
                        disabled={transferSubmitting}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm uppercase tracking-wider text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}
              </>
              )}

            {/* Traffic Tab Content */}
            {activeTab === 'traffic' && currentAdminUser?.permissions.canManageTeams && (
            <>
            <button
              type="button"
              onClick={() => setTrafficModuleOpen(!trafficModuleOpen)}
              className="group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-red-600/20 to-amber-600/20 p-8 text-left shadow-xl transition hover:border-white/30 hover:shadow-2xl"
            >
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Module</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">Traffic & Audit Log</h2>
                  <p className="mt-3 text-sm text-slate-300">
                    Complete audit trail of all admin activity: teams, players, coaches, refs, games, news, and more.
                  </p>
                </div>
                <span className="text-2xl text-white">{trafficModuleOpen ? '−' : '+'}</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-amber-500/5 opacity-0 transition group-hover:opacity-100"></div>
            </button>

            {trafficModuleOpen && (
              <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Audit Log</p>
                    <h2 className="text-2xl font-semibold">Admin Activity Monitor</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Complete audit trail of all admin actions: teams, players, coaches, games, news, and more.
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    {auditLogs.length} logs
                  </span>
                </div>
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {auditLogs.map((log) => {
                      const actionColor = log.action.includes("deleted") ? "text-rose-400" 
                        : log.action.includes("created") || log.action.includes("added") ? "text-emerald-400"
                        : "text-sky-400";
                      const bgColor = log.action.includes("deleted") ? "bg-rose-500/10 border-rose-500/20" 
                        : log.action.includes("created") || log.action.includes("added") ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-sky-500/10 border-sky-500/20";
                      
                      return (
                        <div
                          key={log.id}
                          className={`flex items-start justify-between gap-3 rounded-lg border ${bgColor} p-3 text-sm`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${actionColor}`}>
                              {formatAuditLogDisplay(log)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              by {log.userEmail.split('@')[0]} · {log.timestamp.toLocaleString()}
                            </p>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-600 flex-shrink-0">
                            {log.targetType}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
            </>
            )}

            {/* Games Tab Content */}
            {activeTab === 'games' && currentAdminUser?.permissions.canManageGames && (
            <>
            {/* GAME PLANNER MODULE */}
            <button
              type="button"
              onClick={() => setGamePlannerOpen(!gamePlannerOpen)}
              className="group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-8 text-left shadow-xl transition hover:border-white/30 hover:shadow-2xl"
            >
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Module</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">Game Planner</h2>
                  <p className="mt-3 text-sm text-slate-300">
                    Schedule games with full details. The 3 earliest upcoming games automatically get spotlight status until they start.
                  </p>
                </div>
                <span className="text-2xl text-white">{gamePlannerOpen ? '−' : '+'}</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 transition group-hover:opacity-100"></div>
            </button>

            {gamePlannerOpen && (
              <div className="space-y-6">
                {gameStatus ? (
                  <div className={`rounded-2xl border ${statusClassMap[gameStatus.type]} p-4 text-sm`}>
                    {gameStatus.message}
                  </div>
                ) : null}

                <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                  <div className="space-y-1 mb-6">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Game Scheduler</p>
                    <h3 className="text-lg font-semibold">Schedule a Game</h3>
                  </div>

                  {!gameFormVisible ? (
                    <button
                      onClick={() => setGameFormVisible(true)}
                      className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-white/20"
                    >
                      + Schedule Game
                    </button>
                  ) : (
                    <form onSubmit={handleSubmitGame} className="space-y-6">
                      {/* Gender Selection */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">League</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setGameForm((prev) => ({ ...prev, gender: "men", homeTeamId: "", awayTeamId: "" }));
                              setGameTeamSearch("");
                            }}
                            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                              gameForm.gender === "men"
                                ? "border-blue-500 bg-blue-500/20 text-blue-100"
                                : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/20"
                            }`}
                            >
                            Men&apos;s League
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGameForm((prev) => ({ ...prev, gender: "women", homeTeamId: "", awayTeamId: "" }));
                              setGameTeamSearch("");
                            }}
                            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                              gameForm.gender === "women"
                                ? "border-pink-500 bg-pink-500/20 text-pink-100"
                                : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/20"
                            }`}
                          >
                            Women&apos;s League
                          </button>
                        </div>
                      </div>

                      {/* Team Search */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">Search Teams</label>
                        <input
                          type="text"
                          value={gameTeamSearch}
                          onChange={(e) => setGameTeamSearch(e.target.value)}
                          placeholder="Search by team name or city..."
                          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30"
                        />
                      </div>

                      {/* Team Selection Grid */}
                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Home Team */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-300">Home Team</label>
                          <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            {filteredGameTeams.length > 0 ? (
                              filteredGameTeams.map((team) => (
                                <button
                                  key={team.id}
                                  type="button"
                                  onClick={() => setGameForm((prev) => ({ ...prev, homeTeamId: team.id }))}
                                  className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                                    gameForm.homeTeamId === team.id
                                      ? "border-emerald-500 bg-emerald-500/20"
                                      : "border-white/5 bg-slate-900/40 hover:border-white/20"
                                  }`}
                                >
                                  {team.logo ? (
                                    <Image src={team.logo} alt={team.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full border border-dashed border-white/20 bg-slate-800"></div>
                                  )}
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-white">{team.name}</p>
                                    <p className="text-xs text-slate-400">{team.city}</p>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <p className="text-center text-sm text-slate-500">No teams found</p>
                            )}
                          </div>
                        </div>

                        {/* Away Team */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-300">Away Team</label>
                          <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            {filteredGameTeams.length > 0 ? (
                              filteredGameTeams.map((team) => (
                                <button
                                  key={team.id}
                                  type="button"
                                  onClick={() => setGameForm((prev) => ({ ...prev, awayTeamId: team.id }))}
                                  className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                                    gameForm.awayTeamId === team.id
                                      ? "border-blue-500 bg-blue-500/20"
                                      : "border-white/5 bg-slate-900/40 hover:border-white/20"
                                  }`}
                                >
                                  {team.logo ? (
                                    <Image src={team.logo} alt={team.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full border border-dashed border-white/20 bg-slate-800"></div>
                                  )}
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-white">{team.name}</p>
                                    <p className="text-xs text-slate-400">{team.city}</p>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <p className="text-center text-sm text-slate-500">No teams found</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Game Details */}
                      <div className="grid gap-4 sm:grid-cols-3">
                        <label className="space-y-1 text-sm text-slate-300">
                          Date
                          <input
                            type="date"
                            value={gameForm.date}
                            onChange={(e) => setGameForm((prev) => ({ ...prev, date: e.target.value }))}
                            className="w-full max-w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                            required
                          />
                        </label>
                        <label className="space-y-1 text-sm text-slate-300">
                          Time
                          <input
                            type="time"
                            value={gameForm.time}
                            onChange={(e) => setGameForm((prev) => ({ ...prev, time: e.target.value }))}
                            className="w-full max-w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                            required
                          />
                        </label>
                        <label className="space-y-1 text-sm text-slate-300">
                          Venue
                          <input
                            type="text"
                            value={gameForm.venue}
                            onChange={(e) => setGameForm((prev) => ({ ...prev, venue: e.target.value }))}
                            placeholder="Arena name"
                            className="w-full max-w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-white"
                            required
                          />
                        </label>
                      </div>

                      {/* Referee Assignment */}
                      <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                        <h4 className="text-sm font-semibold text-white">Referee Assignment</h4>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <label className="space-y-1 text-xs text-slate-300">
                            Home Team Referee #1
                            <select
                              value={gameForm.refereeHomeTeam1}
                              onChange={(e) => setGameForm((prev) => ({ ...prev, refereeHomeTeam1: e.target.value }))}
                              className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                            >
                              <option value="">-- Select Referee --</option>
                              {referees.map((ref) => (
                                <option key={ref.id} value={ref.id}>
                                  {ref.firstName} {ref.lastName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs text-slate-300">
                            Home Team Referee #2
                            <select
                              value={gameForm.refereeHomeTeam2}
                              onChange={(e) => setGameForm((prev) => ({ ...prev, refereeHomeTeam2: e.target.value }))}
                              className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                            >
                              <option value="">-- Select Referee --</option>
                              {referees.map((ref) => (
                                <option key={ref.id} value={ref.id}>
                                  {ref.firstName} {ref.lastName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs text-slate-300">
                            Away Team Referee
                            <select
                              value={gameForm.refereeAwayTeam}
                              onChange={(e) => setGameForm((prev) => ({ ...prev, refereeAwayTeam: e.target.value }))}
                              className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                            >
                              <option value="">-- Select Referee --</option>
                              {referees.map((ref) => (
                                <option key={ref.id} value={ref.id}>
                                  {ref.firstName} {ref.lastName}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>

                      {/* Submit Buttons */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                          type="submit"
                          disabled={gameSubmitting}
                          className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2 sm:text-xs"
                        >
                          {gameSubmitting ? "Saving…" : gameForm.id ? "Update Game" : "Post Game"}
                        </button>
                        <button
                          type="button"
                          onClick={resetGameForm}
                          className="w-full rounded-full border border-white/10 px-4 py-3 text-sm uppercase tracking-[0.4em] text-slate-300 transition hover:border-white/20 sm:w-auto sm:py-2 sm:text-xs"
                        >
                          Cancel
                        </button>
                        {gameForm.id ? <span className="text-xs text-slate-400">Editing game.</span> : null}
                      </div>
                    </form>
                  )}
                </section>

                {/* Scheduled Games List */}
                <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                  <div className="space-y-1 mb-6">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Scheduled Games</p>
                    <h3 className="text-lg font-semibold">Upcoming & Past Games</h3>
                  </div>

                  <div className="space-y-3">
                    {gamesWithSpotlight.length > 0 ? (
                      gamesWithSpotlight.map((game) => {
                        const isCompleted = !!(game as any).winnerScore && !!(game as any).loserScore;
                        const isLocked = !isCompleted && isGameLocked(game.date, game.time);
                        return (
                        <div
                          key={game.id}
                          className={`rounded-xl border transition-all ${
                            isCompleted 
                              ? "border-slate-700/40 bg-slate-900/30 opacity-60 p-2.5 sm:py-2 sm:px-3" 
                              : isLocked
                              ? "border-slate-700/40 bg-slate-900/40 opacity-70 p-2.5 sm:py-3 sm:px-4"
                              : game.spotlight 
                                ? "border-orange-500/40 bg-orange-500/10 p-2.5 sm:p-4" 
                                : "border-white/10 bg-slate-950/60 p-2.5 sm:p-4"
                          }`}
                        >
                          {/* Mobile-first layout */}
                          <div className="space-y-2">
                            {/* Badges Row */}
                            {(game.spotlight || isCompleted) && (
                              <div className="flex gap-1.5">
                                {game.spotlight && !isCompleted && (
                                  <span className="inline-block rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-orange-300">
                                    Spotlight
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className="inline-block rounded-full bg-slate-700/40 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                    Completed
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Teams Row */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {game.awayTeamLogo && (
                                  <Image 
                                    src={game.awayTeamLogo} 
                                    alt={game.awayTeamName} 
                                    width={24} 
                                    height={24} 
                                    className="h-5 w-5 sm:h-6 sm:w-6 rounded-full flex-shrink-0" 
                                    unoptimized 
                                  />
                                )}
                                <span className={`text-[11px] sm:text-xs font-semibold ${isCompleted || isLocked ? 'text-slate-400' : 'text-white'} truncate`}>
                                  {game.awayTeamName}
                                </span>
                                {(isCompleted || (isLocked && (game as any).winnerScore)) && (
                                  <span className="text-[11px] sm:text-xs font-bold text-slate-300 flex-shrink-0">{(game as any).loserTeamId === game.awayTeamId ? (game as any).loserScore : (game as any).winnerScore}</span>
                                )}
                              </div>
                              
                              <span className="text-[10px] text-slate-500 flex-shrink-0">@</span>
                              
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                                {(isCompleted || (isLocked && (game as any).winnerScore)) && (
                                  <span className="text-[11px] sm:text-xs font-bold text-slate-300 flex-shrink-0">{(game as any).loserTeamId === game.homeTeamId ? (game as any).loserScore : (game as any).winnerScore}</span>
                                )}
                                <span className={`text-[11px] sm:text-xs font-semibold ${isCompleted || isLocked ? 'text-slate-400' : 'text-white'} truncate text-right`}>
                                  {game.homeTeamName}
                                </span>
                                {game.homeTeamLogo && (
                                  <Image 
                                    src={game.homeTeamLogo} 
                                    alt={game.homeTeamName} 
                                    width={24} 
                                    height={24} 
                                    className="h-5 w-5 sm:h-6 sm:w-6 rounded-full flex-shrink-0" 
                                    unoptimized 
                                  />
                                )}
                              </div>
                            </div>
                            
                            {/* Details Row */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className={`flex flex-wrap gap-1.5 ${isCompleted || isLocked ? 'text-[8px] sm:text-[9px]' : 'text-[9px] sm:text-[10px]'} text-slate-500`}>
                                  <span>📅 {game.date}</span>
                                  <span>🕐 {game.time}</span>
                                  <span>📍 {game.venue}</span>
                                  <span className="uppercase text-slate-600">{game.gender + "'s"}</span>
                                </div>
                                
                                {/* Action Buttons - Compact */}
                              <div className="flex gap-1 flex-shrink-0">
                                {isCompleted ? (
                                  <button
                                    type="button"
                                    onClick={() => handleEditGame(game)}
                                    className="rounded-md border border-slate-600/40 px-2 py-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 hover:border-slate-500/60"
                                  >
                                    Edit
                                  </button>
                                ) : isLocked ? (
                                  <button
                                    type="button"
                                    onClick={() => handleEditGame(game)}
                                    className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-300 hover:border-amber-400/50"
                                  >
                                    Modify
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleEditGame(game)}
                                      className="rounded-md border border-white/20 px-2 py-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-white hover:border-white/40"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteGame(game)}
                                      className="rounded-md border border-rose-500/40 px-2 py-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-rose-200 hover:border-rose-400"
                                    >
                                      Del
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Referees Row */}
                            {(game.refereeHomeTeam1 || game.refereeHomeTeam2 || game.refereeAwayTeam) && (
                              <div className="text-[8px] sm:text-[9px] text-slate-600">
                                <span className="font-semibold">Refs:</span>{' '}
                                {[
                                  game.refereeHomeTeam1 && referees.find(r => r.id === game.refereeHomeTeam1)?.lastName,
                                  game.refereeHomeTeam2 && referees.find(r => r.id === game.refereeHomeTeam2)?.lastName,
                                  game.refereeAwayTeam && referees.find(r => r.id === game.refereeAwayTeam)?.lastName
                                ].filter(Boolean).join(', ')}
                              </div>
                            )}
                            </div>
                          </div>
                        </div>
                        );
                      })
                    ) : (
                      <p className="rounded-xl border border-dashed border-white/20 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
                        No games scheduled yet. Use the form above to add the first one.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            )}
            </>
            )}

            {/* Stats Tab Content */}
            {activeTab === 'stats' && currentAdminUser?.permissions.canManageGames && (
            <>
            {/* GAME STATS ASSISTANT MODULE */}
            <button
              type="button"
              onClick={() => setGameStatsAssistantOpen(!gameStatsAssistantOpen)}
              className="group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 p-8 text-left shadow-xl transition hover:border-white/30 hover:shadow-2xl"
            >
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Module</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">Game Stats Assistant</h2>
                  <p className="mt-3 text-sm text-slate-300">
                    Record final scores and player statistics for completed games (45+ minutes after start time).
                  </p>
                </div>
                <span className="text-2xl text-white">{gameStatsAssistantOpen ? '−' : '+'}</span>
              </div>
            </button>

            {gameStatsAssistantOpen && (
              <div className="space-y-6">
                {/* Status Callout */}
                {statsStatus && (
                  <div className={`rounded-2xl border p-4 ${statusClassMap[statsStatus.type]}`}>
                    <p className="text-sm font-medium">{statsStatus.message}</p>
                  </div>
                )}

                {/* Completed Games List */}
                <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                  <div className="space-y-1 mb-6">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Completed Games</p>
                    <h3 className="text-lg font-semibold">Games Ready for Stats (Last 7 Days)</h3>
                    <p className="text-xs text-slate-400">Games appear here 45 min after start and stay for 1 week. Stats are permanently saved.</p>
                  </div>

                  <div className="space-y-3">
                    {completedGames.length > 0 ? (
                      completedGames.map((game) => (
                        <div
                          key={game.id}
                          className={`rounded-xl border p-4 ${
                            game.completed ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-slate-950/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              {game.completed && (
                                <span className="mb-2 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                                  Stats Recorded
                                </span>
                              )}
                              <div className="flex items-center gap-3">
                                {game.awayTeamLogo && (
                                  <Image src={game.awayTeamLogo} alt={game.awayTeamName} width={32} height={32} className="h-8 w-8 rounded-full" unoptimized />
                                )}
                                <span className="text-sm font-semibold text-white">{game.awayTeamName}</span>
                                {game.completed && game.loserTeamId === game.awayTeamId && (
                                  <span className="text-xs text-slate-400">{game.loserScore}</span>
                                )}
                                <span className="text-xs text-slate-400">@</span>
                                {game.homeTeamLogo && (
                                  <Image src={game.homeTeamLogo} alt={game.homeTeamName} width={32} height={32} className="h-8 w-8 rounded-full" unoptimized />
                                )}
                                <span className="text-sm font-semibold text-white">{game.homeTeamName}</span>
                                {game.completed && game.loserTeamId === game.homeTeamId && (
                                  <span className="text-xs text-slate-400">{game.loserScore}</span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                                <span>📅 {game.date}</span>
                                <span>🕐 {game.time}</span>
                                <span>📍 {game.venue}</span>
                                <span className="uppercase text-slate-500">{game.gender + "'s"}</span>
                              </div>
                              {game.completed && game.winnerTeamId && (
                                <div className="mt-2 text-xs text-emerald-400">
                                  Winner: {game.winnerTeamId === game.homeTeamId ? game.homeTeamName : game.awayTeamName} ({game.winnerScore})
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectCompletedGame(game)}
                              className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white hover:border-white/40"
                            >
                              {game.completed ? "Edit Stats" : "Add Stats"}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-white/20 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
                        No games in the stats window. Games appear 45 minutes after start and remain for 7 days.
                      </p>
                    )}
                  </div>
                </section>

                {/* Stats Form */}
                {selectedCompletedGame && gameStatsForm && (
                  <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-950/60 p-6">
                    <div className="space-y-1 mb-6">
                      <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Recording Stats</p>
                      <h3 className="text-lg font-semibold">
                        {selectedCompletedGame.awayTeamName} @ {selectedCompletedGame.homeTeamName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {selectedCompletedGame.date} · {selectedCompletedGame.time} · {selectedCompletedGame.venue}
                      </p>
                    </div>

                    {/* Score Input */}
                    <div className="space-y-4 mb-6">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">Game Result</h4>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-2">
                          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Winner</span>
                          <select
                            value={gameStatsForm.winnerTeamId}
                            onChange={(e) => handleWinnerChange(e.target.value)}
                            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white focus:border-white sm:px-3 sm:py-2 sm:text-sm"
                            required
                          >
                            <option value="">Select winner</option>
                            <option value={selectedCompletedGame.homeTeamId}>{selectedCompletedGame.homeTeamName}</option>
                            <option value={selectedCompletedGame.awayTeamId}>{selectedCompletedGame.awayTeamName}</option>
                          </select>
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Winner Score</span>
                          <input
                            type="number"
                            value={gameStatsForm.winnerScore}
                            onChange={(e) => setGameStatsForm({ ...gameStatsForm, winnerScore: e.target.value })}
                            placeholder="0"
                            min="0"
                            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white focus:border-white sm:px-3 sm:py-2 sm:text-sm"
                            required
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Loser</span>
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-slate-400 italic sm:px-3 sm:py-2 sm:text-sm">
                            {gameStatsForm.loserTeamId 
                              ? (gameStatsForm.loserTeamId === selectedCompletedGame.homeTeamId 
                                  ? selectedCompletedGame.homeTeamName 
                                  : selectedCompletedGame.awayTeamName)
                              : "Select winner first"}
                          </div>
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Loser Score</span>
                          <input
                            type="number"
                            value={gameStatsForm.loserScore}
                            onChange={(e) => setGameStatsForm({ ...gameStatsForm, loserScore: e.target.value })}
                            placeholder="0"
                            min="0"
                            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white focus:border-white sm:px-3 sm:py-2 sm:text-sm"
                            required
                          />
                        </label>
                      </div>
                    </div>

                    {/* Player Stats */}
                    {winnerRoster.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                          Player Stats - {gameStatsForm.winnerTeamId === selectedCompletedGame.homeTeamId ? selectedCompletedGame.homeTeamName : selectedCompletedGame.awayTeamName}
                        </h4>
                        
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {winnerRoster.map((player) => {
                            const stats = playerStatsMap[player.id] || { two_pm: "", two_pa: "", three_pm: "", three_pa: "", ft_m: "", ft_a: "", ast: "", oreb: "", dreb: "", reb: "", stl: "", blk: "", fls: "", min: "", pf: "", to: "" };
                            return (
                              <div key={player.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                                <div className="mb-3 flex items-center gap-3">
                                  {player.headshot && (
                                    <Image src={player.headshot} alt={`${player.firstName} ${player.lastName}`} width={32} height={32} className="h-8 w-8 rounded-full" unoptimized />
                                  )}
                                  <div>
                                    <p className="text-sm font-semibold text-white">
                                      #{player.number} {player.firstName} {player.lastName}
                                    </p>
                                    <p className="text-xs text-slate-400">{player.height}</p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {/* Shooting Stats - Makes/Attempts */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[10px] uppercase tracking-wider text-slate-400">2PT M/A</label>
                                      <div className="flex gap-1">
                                        <input
                                          type="number"
                                          placeholder="M"
                                          value={stats.two_pm}
                                          onChange={(e) => {
                                            const made = parseInt(e.target.value) || 0;
                                            const attempts = parseInt(stats.two_pa) || 0;
                                            if (attempts > 0 && made > attempts) {
                                              setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, two_pm: attempts.toString() }});
                                            } else {
                                              setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, two_pm: e.target.value }});
                                            }
                                          }}
                                          min="0"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                        />
                                        <span className="text-slate-500">/</span>
                                        <input
                                          type="number"
                                          placeholder="A"
                                          value={stats.two_pa}
                                          onChange={(e) => {
                                            const attempts = parseInt(e.target.value) || 0;
                                            const made = parseInt(stats.two_pm) || 0;
                                            if (made > attempts && attempts > 0) {
                                              setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, two_pa: e.target.value, two_pm: attempts.toString() }});
                                            } else {
                                              setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, two_pa: e.target.value }});
                                            }
                                          }}
                                          min="0"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] uppercase tracking-wider text-slate-400">3PT M/A</label>
                                      <div className="flex gap-1">
                                        <input
                                          type="number"
                                          placeholder="M"
                                          value={stats.three_pm}
                                          onChange={(e) => {
                                            const made = parseInt(e.target.value) || 0;
                                            const attempts = parseInt(stats.three_pa) || 0;
                                            if (attempts > 0 && made > attempts) {
                                              setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, three_pm: attempts.toString() }});
                                            } else {
                                              setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, three_pm: e.target.value }});
                                            }
                                          }}
                                          min="0"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                        />
                                        <span className="text-slate-500">/</span>
                                        <input
                                          type="number"
                                          placeholder="A"
                                          value={stats.three_pa}
                                          onChange={(e) => {
                                            const attempts = parseInt(e.target.value) || 0;
                                            const made = parseInt(stats.three_pm) || 0;
                                            if (made > attempts && attempts > 0) {
                                              setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, three_pa: e.target.value, three_pm: attempts.toString() }});
                                            } else {
                                              setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, three_pa: e.target.value }});
                                            }
                                          }}
                                          min="0"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-slate-400">FT M/A</label>
                                    <div className="flex gap-1">
                                      <input
                                        type="number"
                                        placeholder="M"
                                        value={stats.ft_m}
                                        onChange={(e) => {
                                          const made = parseInt(e.target.value) || 0;
                                          const attempts = parseInt(stats.ft_a) || 0;
                                          if (attempts > 0 && made > attempts) {
                                            setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, ft_m: attempts.toString() }});
                                          } else {
                                            setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, ft_m: e.target.value }});
                                          }
                                        }}
                                        min="0"
                                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                      />
                                      <span className="text-slate-500">/</span>
                                      <input
                                        type="number"
                                        placeholder="A"
                                        value={stats.ft_a}
                                        onChange={(e) => {
                                          const attempts = parseInt(e.target.value) || 0;
                                          const made = parseInt(stats.ft_m) || 0;
                                          if (made > attempts && attempts > 0) {
                                            setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, ft_a: e.target.value, ft_m: attempts.toString() }});
                                          } else {
                                            setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, ft_a: e.target.value }});
                                          }
                                        }}
                                        min="0"
                                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                      />
                                    </div>
                                  </div>
                                  {/* Total Points Display */}
                                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-semibold">PTS</span>
                                      <span className="text-sm font-bold text-emerald-200 tabular-nums">
                                        {(() => {
                                          const twoPts = (parseInt(stats.two_pm) || 0) * 2;
                                          const threePts = (parseInt(stats.three_pm) || 0) * 3;
                                          const ftPts = (parseInt(stats.ft_m) || 0) * 1;
                                          return twoPts + threePts + ftPts;
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Other Stats */}
                                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                                    <input
                                      type="number"
                                      placeholder="AST"
                                      value={stats.ast}
                                      onChange={(e) => setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, ast: e.target.value }})}
                                      min="0"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                    <input
                                      type="number"
                                      placeholder="OREB"
                                      value={stats.oreb}
                                      onChange={(e) => {
                                        const oreb = parseInt(e.target.value) || 0;
                                        const dreb = parseInt(stats.dreb) || 0;
                                        const reb = (oreb + dreb).toString();
                                        setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, oreb: e.target.value, reb }});
                                      }}
                                      min="0"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                    <input
                                      type="number"
                                      placeholder="DREB"
                                      value={stats.dreb}
                                      onChange={(e) => {
                                        const dreb = parseInt(e.target.value) || 0;
                                        const oreb = parseInt(stats.oreb) || 0;
                                        const reb = (oreb + dreb).toString();
                                        setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, dreb: e.target.value, reb }});
                                      }}
                                      min="0"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                    <input
                                      type="number"
                                      placeholder="REB"
                                      value={stats.reb}
                                      readOnly
                                      className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2 py-1 text-center text-xs text-emerald-200 cursor-not-allowed"
                                      title="Auto-calculated: OREB + DREB"
                                    />
                                    <input
                                      type="number"
                                      placeholder="STL"
                                      value={stats.stl}
                                      onChange={(e) => setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, stl: e.target.value }})}
                                      min="0"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                    <input
                                      type="number"
                                      placeholder="BLK"
                                      value={stats.blk}
                                      onChange={(e) => setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, blk: e.target.value }})}
                                      min="0"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                    <input
                                      type="number"
                                      placeholder="TO"
                                      value={stats.to}
                                      onChange={(e) => setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, to: e.target.value }})}
                                      min="0"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                    <input
                                      type="number"
                                      placeholder="PF"
                                      value={stats.fls}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        if (value <= 6) {
                                          setPlayerStatsMap({ ...playerStatsMap, [player.id]: { ...stats, fls: e.target.value }});
                                        }
                                      }}
                                      min="0"
                                      max="6"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Loser Team Player Stats */}
                    {loserRoster.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                          Player Stats - {gameStatsForm.winnerTeamId === selectedCompletedGame.homeTeamId ? selectedCompletedGame.awayTeamName : selectedCompletedGame.homeTeamName}
                        </h4>
                        
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {loserRoster.map((player) => {
                            const stats = loserStatsMap[player.id] || { two_pm: "", two_pa: "", three_pm: "", three_pa: "", ft_m: "", ft_a: "", ast: "", oreb: "", dreb: "", reb: "", stl: "", blk: "", fls: "", min: "", pf: "", to: "" };
                            return (
                              <div key={player.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                                <div className="mb-3 flex items-center gap-3">
                                  {player.headshot && (
                                    <Image src={player.headshot} alt={`${player.firstName} ${player.lastName}`} width={32} height={32} className="h-8 w-8 rounded-full" unoptimized />
                                  )}
                                  <div>
                                    <p className="text-sm font-semibold text-white">
                                      #{player.number} {player.firstName} {player.lastName}
                                    </p>
                                    <p className="text-xs text-slate-400">{player.height}</p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {/* Shooting Stats - Makes/Attempts */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[10px] uppercase tracking-wider text-slate-400">2PT M/A</label>
                                      <div className="flex gap-1">
                                        <input
                                          type="number"
                                          placeholder="M"
                                          value={stats.two_pm}
                                          onChange={(e) => {
                                            const made = parseInt(e.target.value) || 0;
                                            const attempts = parseInt(stats.two_pa) || 0;
                                            if (attempts > 0 && made > attempts) {
                                              setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, two_pm: attempts.toString() }});
                                            } else {
                                              setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, two_pm: e.target.value }});
                                            }
                                          }}
                                          min="0"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                        />
                                        <span className="text-slate-500">/</span>
                                        <input
                                          type="number"
                                          placeholder="A"
                                          value={stats.two_pa}
                                          onChange={(e) => {
                                            const attempts = parseInt(e.target.value) || 0;
                                            const made = parseInt(stats.two_pm) || 0;
                                            if (made > attempts && attempts > 0) {
                                              setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, two_pa: e.target.value, two_pm: attempts.toString() }});
                                            } else {
                                              setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, two_pa: e.target.value }});
                                            }
                                          }}
                                          min="0"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] uppercase tracking-wider text-slate-400">3PT M/A</label>
                                      <div className="flex gap-1">
                                        <input
                                          type="number"
                                          placeholder="M"
                                          value={stats.three_pm}
                                          onChange={(e) => {
                                            const made = parseInt(e.target.value) || 0;
                                            const attempts = parseInt(stats.three_pa) || 0;
                                            if (attempts > 0 && made > attempts) {
                                              setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, three_pm: attempts.toString() }});
                                            } else {
                                              setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, three_pm: e.target.value }});
                                            }
                                          }}
                                          min="0"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                        />
                                        <span className="text-slate-500">/</span>
                                        <input
                                          type="number"
                                          placeholder="A"
                                          value={stats.three_pa}
                                          onChange={(e) => {
                                            const attempts = parseInt(e.target.value) || 0;
                                            const made = parseInt(stats.three_pm) || 0;
                                            if (made > attempts && attempts > 0) {
                                              setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, three_pa: e.target.value, three_pm: attempts.toString() }});
                                            } else {
                                              setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, three_pa: e.target.value }});
                                            }
                                          }}
                                          min="0"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-slate-400">FT M/A</label>
                                    <div className="flex gap-1">
                                      <input
                                        type="number"
                                        placeholder="M"
                                        value={stats.ft_m}
                                        onChange={(e) => {
                                          const made = parseInt(e.target.value) || 0;
                                          const attempts = parseInt(stats.ft_a) || 0;
                                          if (attempts > 0 && made > attempts) {
                                            setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, ft_m: attempts.toString() }});
                                          } else {
                                            setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, ft_m: e.target.value }});
                                          }
                                        }}
                                        min="0"
                                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                      />
                                      <span className="text-slate-500">/</span>
                                      <input
                                        type="number"
                                        placeholder="A"
                                        value={stats.ft_a}
                                        onChange={(e) => {
                                          const attempts = parseInt(e.target.value) || 0;
                                          const made = parseInt(stats.ft_m) || 0;
                                          if (made > attempts && attempts > 0) {
                                            setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, ft_a: e.target.value, ft_m: attempts.toString() }});
                                          } else {
                                            setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, ft_a: e.target.value }});
                                          }
                                        }}
                                        min="0"
                                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                      />
                                    </div>
                                  </div>
                                  {/* Total Points Display */}
                                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-semibold">PTS</span>
                                      <span className="text-sm font-bold text-emerald-200 tabular-nums">
                                        {(() => {
                                          const twoPts = (parseInt(stats.two_pm) || 0) * 2;
                                          const threePts = (parseInt(stats.three_pm) || 0) * 3;
                                          const ftPts = (parseInt(stats.ft_m) || 0) * 1;
                                          return twoPts + threePts + ftPts;
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Other Stats */}
                                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                                    <input
                                      type="number"
                                      placeholder="AST"
                                      value={stats.ast}
                                      onChange={(e) => setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, ast: e.target.value }})}
                                      min="0"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                    <input
                                      type="number"
                                      placeholder="OREB"
                                      value={stats.oreb}
                                      onChange={(e) => {
                                        const oreb = parseInt(e.target.value) || 0;
                                        const dreb = parseInt(stats.dreb) || 0;
                                        const reb = (oreb + dreb).toString();
                                        setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, oreb: e.target.value, reb }});
                                      }}
                                      min="0"
                                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                    />
                                    <input
                                    type="number"
                                    placeholder="DREB"
                                    value={stats.dreb}
                                    onChange={(e) => {
                                      const dreb = parseInt(e.target.value) || 0;
                                      const oreb = parseInt(stats.oreb) || 0;
                                      const reb = (oreb + dreb).toString();
                                      setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, dreb: e.target.value, reb }});
                                    }}
                                    min="0"
                                    className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                  />
                                  <input
                                    type="number"
                                    placeholder="REB"
                                    value={stats.reb}
                                    readOnly
                                    className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2 py-1 text-center text-xs text-emerald-200 cursor-not-allowed"
                                    title="Auto-calculated: OREB + DREB"
                                  />
                                  <input
                                    type="number"
                                    placeholder="STL"
                                    value={stats.stl}
                                    onChange={(e) => setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, stl: e.target.value }})}
                                    min="0"
                                    className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                  />
                                  <input
                                    type="number"
                                    placeholder="BLK"
                                    value={stats.blk}
                                    onChange={(e) => setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, blk: e.target.value }})}
                                    min="0"
                                    className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                  />
                                  <input
                                    type="number"
                                    placeholder="TO"
                                    value={stats.to}
                                    onChange={(e) => setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, to: e.target.value }})}
                                    min="0"
                                    className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                  />
                                  <input
                                    type="number"
                                    placeholder="PF"
                                    value={stats.fls}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 0;
                                      if (value <= 6) {
                                        setLoserStatsMap({ ...loserStatsMap, [player.id]: { ...stats, fls: e.target.value }});
                                      }
                                    }}
                                    min="0"
                                    max="6"
                                    className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-center text-xs text-white focus:border-white"
                                  />
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSubmitGameStats}
                        disabled={statsSubmitting}
                        className="rounded-full border border-white/20 bg-emerald-500/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-emerald-500/30 disabled:cursor-not-allowed"
                      >
                        {statsSubmitting ? "Saving…" : "Save Stats"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCompletedGame(null);
                          setGameStatsForm(null);
                          setWinnerRoster([]);
                          setLoserRoster([]);
                          setPlayerStatsMap({});
                          setLoserStatsMap({});
                        }}
                        className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.4em] text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </section>
                )}
              </div>
            )}
            </>
            )}

            {/* League Tab Content */}
            {activeTab === 'league' && (currentAdminUser?.permissions.canManageReferees || currentAdminUser?.permissions.canManageVenues || currentAdminUser?.permissions.canManagePartners) && (
            <>
            {/* LEAGUE GESTION MODULE */}
            <button
              type="button"
              onClick={() => setLeagueGestionOpen(!leagueGestionOpen)}
              className="group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/20 to-violet-600/20 p-8 text-left shadow-xl transition hover:border-white/30 hover:shadow-2xl"
            >
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Module</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">League Gestion</h2>
                  <p className="mt-3 text-sm text-slate-300">
                    Manage referees, committee members, and game venues for the league.
                  </p>
                </div>
                <span className="text-2xl text-white">{leagueGestionOpen ? '−' : '+'}</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 opacity-0 transition group-hover:opacity-100"></div>
            </button>

            {leagueGestionOpen && (
              <div className="space-y-6">
                {leagueGestionStatus && (
                  <div className={`rounded-2xl border ${statusClassMap[leagueGestionStatus.type]} p-4 text-sm`}>
                    {leagueGestionStatus.message}
                  </div>
                )}

                {/* REFEREES SECTION - Compact Table View */}
                <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Arbitres</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setRefereeForm({ firstName: "", lastName: "", phone: "", certificationLevel: "" });
                        setRefereeFormVisible(!refereeFormVisible);
                      }}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      {refereeFormVisible ? "− Annuler" : "+ Ajouter"}
                    </button>
                  </div>

                  {refereeFormVisible && (
                    <form onSubmit={handleSubmitReferee} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-black/30 p-4 sm:grid-cols-4">
                      <input
                        type="text"
                        required
                        placeholder="Prénom *"
                        value={refereeForm.firstName}
                        onChange={(e) => setRefereeForm({ ...refereeForm, firstName: e.target.value })}
                        className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Nom *"
                        value={refereeForm.lastName}
                        onChange={(e) => setRefereeForm({ ...refereeForm, lastName: e.target.value })}
                        className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                      <input
                        type="tel"
                        placeholder="Téléphone"
                        value={refereeForm.phone}
                        onChange={(e) => setRefereeForm({ ...refereeForm, phone: e.target.value })}
                        className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Certification"
                        value={refereeForm.certificationLevel}
                        onChange={(e) => setRefereeForm({ ...refereeForm, certificationLevel: e.target.value })}
                        className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={refereeSubmitting}
                        className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {refereeSubmitting ? "..." : refereeForm.id ? "Modifier" : "Ajouter"}
                      </button>
                    </form>
                  )}

                  {/* Mobile: Card view, Desktop: Table view */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="pb-3 font-semibold">Nom</th>
                          <th className="pb-3 font-semibold">Certification</th>
                          <th className="pb-3 font-semibold">Téléphone</th>
                          <th className="pb-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {referees.length > 0 ? (
                          referees.map((referee) => (
                            <tr key={referee.id} className="group hover:bg-white/5">
                              <td className="py-3 text-white">{referee.firstName} {referee.lastName}</td>
                              <td className="py-3 text-slate-400">{referee.certificationLevel || "—"}</td>
                              <td className="py-3 text-slate-400">{referee.phone || "—"}</td>
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleEditReferee(referee)}
                                  className="mr-2 text-xs text-indigo-400 hover:text-indigo-300"
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReferee(referee)}
                                  className="text-xs text-rose-400 hover:text-rose-300"
                                >
                                  Supprimer
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500">
                              Aucun arbitre ajouté.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Mobile Card View */}
                  <div className="space-y-3 md:hidden">
                    {referees.length > 0 ? (
                      referees.map((referee) => (
                        <div key={referee.id} className="rounded-lg border border-white/10 bg-black/30 p-3 min-w-0">
                          <div className="mb-2">
                            <p className="text-sm font-semibold text-white">{referee.firstName} {referee.lastName}</p>
                            {referee.certificationLevel && (
                              <p className="text-xs text-slate-400">{referee.certificationLevel}</p>
                            )}
                            {referee.phone && (
                              <p className="text-xs text-slate-400">{referee.phone}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditReferee(referee)}
                              className="flex-1 rounded-lg bg-indigo-600/20 px-2 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 whitespace-nowrap"
                            >
                              Modif.
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReferee(referee)}
                              className="flex-1 rounded-lg bg-rose-600/20 px-2 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-600/30 whitespace-nowrap"
                            >
                              Suppr.
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="py-6 text-center text-slate-500">Aucun arbitre ajouté.</p>
                    )}
                  </div>
                </section>

                {/* COMMITTEE MEMBERS - Card Grid View */}
                <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Membres du Comité</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setCommitteeForm({ firstName: "", lastName: "", role: "", email: "", phone: "" });
                        setCommitteePhotoPreview("");
                        setCommitteePhotoFile(null);
                        setCommitteeFormVisible(!committeeFormVisible);
                      }}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
                    >
                      {committeeFormVisible ? "− Annuler" : "+ Ajouter"}
                    </button>
                  </div>

                  {committeeFormVisible && (
                    <form onSubmit={handleSubmitCommittee} className="mb-6 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          required
                          placeholder="Prénom *"
                          value={committeeForm.firstName}
                          onChange={(e) => setCommitteeForm({ ...committeeForm, firstName: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Nom *"
                          value={committeeForm.lastName}
                          onChange={(e) => setCommitteeForm({ ...committeeForm, lastName: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Rôle *"
                          value={committeeForm.role}
                          onChange={(e) => setCommitteeForm({ ...committeeForm, role: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={committeeForm.email}
                          onChange={(e) => setCommitteeForm({ ...committeeForm, email: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                        />
                        <input
                          type="tel"
                          placeholder="Téléphone"
                          value={committeeForm.phone}
                          onChange={(e) => setCommitteeForm({ ...committeeForm, phone: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCommitteePhotoChange}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-xs file:text-white focus:outline-none"
                        />
                      </div>
                      {committeePhotoPreview && (
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
                          <Image
                            src={committeePhotoPreview}
                            alt="Preview"
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                          <span className="text-xs text-slate-400">Photo aperçu</span>
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={committeeSubmitting}
                        className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {committeeSubmitting ? "..." : committeeForm.id ? "Modifier" : "Ajouter"}
                      </button>
                    </form>
                  )}

                  {committeeMembers.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {committeeMembers.map((member) => (
                        <div key={member.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 p-3 transition hover:border-white/30">
                          <div className="flex items-start gap-3">
                            {member.photo ? (
                              <Image
                                src={member.photo}
                                alt={`${member.firstName} ${member.lastName}`}
                                width={48}
                                height={48}
                                className="h-12 w-12 flex-shrink-0 rounded-full border-2 border-white/20 object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/20 bg-slate-800 text-sm font-bold text-slate-400">
                                {member.firstName[0]}{member.lastName[0]}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-white truncate">{member.firstName} {member.lastName}</h4>
                              <p className="text-xs font-medium uppercase tracking-wider text-violet-300 truncate">{member.role}</p>
                              {member.email && (
                                <p className="mt-0.5 text-xs text-slate-400 truncate">{member.email}</p>
                              )}
                              {member.phone && (
                                <p className="text-xs text-slate-400 truncate">{member.phone}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditCommittee(member)}
                              className="flex-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs font-medium text-white hover:bg-white/10 whitespace-nowrap"
                            >
                              Modif.
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCommittee(member)}
                              className="flex-1 rounded-lg bg-rose-600/20 px-2 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-600/30 whitespace-nowrap"
                            >
                              Suppr.
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Aucun membre ajouté.
                    </div>
                  )}
                </section>

                {/* VENUES SECTION - Compact Table View */}
                <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Salles</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setVenueForm({ name: "", address: "", city: "", capacity: "", courts: "" });
                        setVenueFormVisible(!venueFormVisible);
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      {venueFormVisible ? "− Annuler" : "+ Ajouter"}
                    </button>
                  </div>

                  {venueFormVisible && (
                    <form onSubmit={handleSubmitVenue} className="mb-4 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          required
                          placeholder="Nom de la salle *"
                          value={venueForm.name}
                          onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Ville *"
                          value={venueForm.city}
                          onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Adresse complète *"
                          value={venueForm.address}
                          onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                          className="col-span-1 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:col-span-2"
                        />
                        <input
                          type="text"
                          placeholder="Capacité"
                          value={venueForm.capacity}
                          onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Nombre de terrains"
                          value={venueForm.courts}
                          onChange={(e) => setVenueForm({ ...venueForm, courts: e.target.value })}
                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={venueSubmitting}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {venueSubmitting ? "..." : venueForm.id ? "Modifier" : "Ajouter"}
                      </button>
                    </form>
                  )}

                  {/* Desktop: Table view */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="pb-3 font-semibold">Nom</th>
                          <th className="pb-3 font-semibold">Ville</th>
                          <th className="pb-3 font-semibold">Capacité</th>
                          <th className="pb-3 font-semibold">Terrains</th>
                          <th className="pb-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {venues.length > 0 ? (
                          venues.map((venue) => (
                            <tr key={venue.id} className="group hover:bg-white/5">
                              <td className="py-3 font-medium text-white">{venue.name}</td>
                              <td className="py-3 text-slate-400">{venue.city}</td>
                              <td className="py-3 text-slate-400">{venue.capacity || "—"}</td>
                              <td className="py-3 text-slate-400">{venue.courts || "—"}</td>
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleEditVenue(venue)}
                                  className="mr-2 text-xs text-emerald-400 hover:text-emerald-300"
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVenue(venue)}
                                  className="text-xs text-rose-400 hover:text-rose-300"
                                >
                                  Supprimer
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">
                              Aucune salle ajoutée.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Mobile: Card view */}
                  <div className="space-y-3 md:hidden">
                    {venues.length > 0 ? (
                      venues.map((venue) => (
                        <div key={venue.id} className="rounded-lg border border-white/10 bg-black/30 p-3 min-w-0">
                          <div className="mb-2">
                            <p className="text-sm font-semibold text-white">{venue.name}</p>
                            <p className="text-xs text-slate-400">{venue.city}</p>
                            <div className="mt-1 flex gap-3 text-xs text-slate-500">
                              {venue.capacity && <span>Cap: {venue.capacity}</span>}
                              {venue.courts && <span>Terrains: {venue.courts}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditVenue(venue)}
                              className="flex-1 rounded-lg bg-emerald-600/20 px-2 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 whitespace-nowrap"
                            >
                              Modif.
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVenue(venue)}
                              className="flex-1 rounded-lg bg-rose-600/20 px-2 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-600/30 whitespace-nowrap"
                            >
                              Suppr.
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="py-6 text-center text-slate-500">Aucune salle ajoutée.</p>
                    )}
                  </div>
                </section>

                {/* PARTNERS SECTION - Logo Grid View */}
                <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Partenaires</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerForm({ name: "", logo: "" });
                        setPartnerLogoFile(null);
                        setPartnerLogoPreview("");
                        setPartnerFormVisible(!partnerFormVisible);
                      }}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                    >
                      {partnerFormVisible ? "− Annuler" : "+ Ajouter"}
                    </button>
                  </div>

                  {partnerFormVisible && (
                    <form onSubmit={handleSubmitPartner} className="mb-6 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                      <input
                        type="text"
                        required
                        placeholder="Nom du partenaire *"
                        value={partnerForm.name}
                        onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        required={!partnerForm.id}
                        onChange={handlePartnerLogoChange}
                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white file:mr-2 file:rounded file:border-0 file:bg-amber-600 file:px-2 file:py-1 file:text-xs file:text-white focus:outline-none"
                      />
                      {partnerLogoPreview && (
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
                          <Image
                            src={partnerLogoPreview}
                            alt="Preview"
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded-lg border border-white/10 object-contain"
                            unoptimized
                          />
                          <span className="text-xs text-slate-400">Logo aperçu</span>
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={partnerSubmitting}
                        className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        {partnerSubmitting ? "..." : partnerForm.id ? "Modifier" : "Ajouter"}
                      </button>
                    </form>
                  )}

                  {partners.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {partners.map((partner) => (
                        <div key={partner.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-amber-600/10 to-orange-600/10 p-3 transition hover:border-white/30">
                          <div className="flex flex-col items-center gap-2">
                            {partner.logo && (
                              <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                                <Image
                                  src={partner.logo}
                                  alt={partner.name}
                                  fill
                                  className="object-contain p-1.5"
                                  unoptimized
                                />
                              </div>
                            )}
                            <p className="text-center text-xs font-semibold text-white line-clamp-2">{partner.name}</p>
                          </div>
                          <div className="mt-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditPartner(partner)}
                              className="flex-1 rounded-lg bg-white/5 px-1.5 py-1.5 text-xs font-medium text-white hover:bg-white/10 whitespace-nowrap"
                            >
                              Modif.
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePartner(partner)}
                              className="flex-1 rounded-lg bg-rose-600/20 px-1.5 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-600/30 whitespace-nowrap"
                            >
                              Suppr.
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Aucun partenaire ajouté.
                    </div>
                  )}
                </section>
              </div>
            )}
            </>
            )}

            {/* ADMINS TAB CONTENT */}
            {activeTab === 'admins' && currentAdminUser?.permissions.canManageAdmins && (
            <>
              <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-white">{t.adminUserManagement}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {t.createAdminAccounts}
                  </p>
                </div>

                {adminStatus && (
                  <div className={`mb-4 rounded-xl border p-3 text-xs ${
                    adminStatus.type === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' :
                    adminStatus.type === 'error' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' :
                    'border-blue-500/40 bg-blue-500/10 text-blue-200'
                  }`}>
                    {adminStatus.message}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setAdminFormVisible(!adminFormVisible);
                    setNewAdminEmail("");
                    setNewAdminRoles([]);
                  }}
                  className="mb-4 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-white/20"
                >
                  {adminFormVisible ? 'Cancel' : '+ Create New Admin'}
                </button>

                {adminFormVisible && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!user) return;
                      
                      setAdminSubmitting(true);
                      setAdminStatus(null);
                      
                      try {
                        const result = await createAdminAccount(newAdminEmail, newAdminName, newAdminPassword, newAdminRoles, user.uid);
                        
                        if (result.success) {
                          setAdminStatus({ 
                            type: 'success', 
                            message: `✅ Admin account created for ${newAdminEmail}! They can now log in with the password you provided.` 
                          });
                          setNewAdminEmail("");
                          setNewAdminName("");
                          setNewAdminPassword("");
                          setNewAdminRoles([]);
                          setAdminFormVisible(false);
                          
                          // Refresh admin users list
                          const users = await getAllAdminUsers();
                          setAdminUsers(users);
                        } else {
                          setAdminStatus({ 
                            type: 'error', 
                            message: result.error || 'Failed to create admin account' 
                          });
                        }
                      } catch (error) {
                        setAdminStatus({ 
                          type: 'error', 
                          message: 'An unexpected error occurred' 
                        });
                      } finally {
                        setAdminSubmitting(false);
                      }
                    }}
                    className="mb-6 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <label className="space-y-1 text-xs text-slate-300">
                      Email Address *
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        required
                        placeholder="admin@example.com"
                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-slate-300">
                      Display Name *
                      <input
                        type="text"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        required
                        placeholder="John Doe"
                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-slate-300">
                      Password *
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        required
                        placeholder="Minimum 6 characters"
                        minLength={6}
                        className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-white"
                      />
                      <p className="text-[10px] text-slate-400">They can change this after logging in</p>
                    </label>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-300">Assign Roles *</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          { role: 'master' as AdminRole, label: '👑 Master (Full Access)', desc: 'Complete control including admin management' },
                          { role: 'league_manager' as AdminRole, label: '⚡ League Manager', desc: 'Manage all league content except admins' },
                          { role: 'news_editor' as AdminRole, label: '📰 News Editor', desc: 'Manage news and stories' },
                          { role: 'game_scheduler' as AdminRole, label: '📅 Game Scheduler', desc: 'Create and manage games' },
                          { role: 'team_manager' as AdminRole, label: '👥 Team Manager', desc: 'Manage teams and players' },
                          { role: 'referee_manager' as AdminRole, label: '🔵 Referee Manager', desc: 'Manage referees' },
                          { role: 'venue_manager' as AdminRole, label: '🏟️ Venue Manager', desc: 'Manage venues' },
                          { role: 'partner_manager' as AdminRole, label: '🤝 Partner Manager', desc: 'Manage partners and committee' },
                        ].map(({ role, label, desc }) => (
                          <label key={role} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newAdminRoles.includes(role)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewAdminRoles([...newAdminRoles, role]);
                                } else {
                                  setNewAdminRoles(newAdminRoles.filter(r => r !== role));
                                }
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-white">{label}</p>
                              <p className="text-[10px] text-slate-400">{desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={adminSubmitting || !newAdminEmail.trim() || !newAdminName.trim() || newAdminPassword.length < 6 || newAdminRoles.length === 0}
                        className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-white/20 disabled:opacity-40"
                      >
                        {adminSubmitting ? 'Creating...' : 'Create Admin Account'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminFormVisible(false);
                          setNewAdminEmail("");
                          setNewAdminName("");
                          setNewAdminPassword("");
                          setNewAdminRoles([]);
                        }}
                        className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">All Admin Users</h3>
                  {adminUsers.length > 0 ? (
                    adminUsers.map((admin) => (
                      <div key={admin.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const now = Date.now();
                                const lastActivity = admin.lastActivity ? new Date(admin.lastActivity).getTime() : 0;
                                const isOnline = admin.isActive && lastActivity > 0 && (now - lastActivity) < 5 * 60 * 1000; // 5 minutes
                                return (
                                  <div className="relative">
                                    <div className={`h-2.5 w-2.5 rounded-full ${
                                      isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                                    }`} />
                                    {isOnline && (
                                      <div className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
                                    )}
                                  </div>
                                );
                              })()}
                              <p className="text-sm font-semibold text-white">{admin.displayName || admin.email}</p>
                              {!admin.isActive && (
                                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
                                  Inactive
                                </span>
                              )}
                              {admin.roles.includes('master') && (
                                <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-200">
                                  Master
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-400">{admin.email}</p>
                            
                            {editingAdminId === admin.id ? (
                              <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                                <p className="text-xs font-semibold text-slate-300">Edit Roles:</p>
                                <div className="space-y-1">
                                  {[
                                    { role: 'master' as AdminRole, label: '👑 Master' },
                                    { role: 'league_manager' as AdminRole, label: '⚡ League Manager' },
                                    { role: 'news_editor' as AdminRole, label: '📰 News Editor' },
                                    { role: 'game_scheduler' as AdminRole, label: '📅 Game Scheduler' },
                                    { role: 'team_manager' as AdminRole, label: '👥 Team Manager' },
                                    { role: 'referee_manager' as AdminRole, label: '🔵 Referee Manager' },
                                    { role: 'venue_manager' as AdminRole, label: '🏟️ Venue Manager' },
                                    { role: 'partner_manager' as AdminRole, label: '🤝 Partner Manager' },
                                  ].map(({ role, label }) => (
                                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={editingAdminRoles.includes(role)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setEditingAdminRoles([...editingAdminRoles, role]);
                                          } else {
                                            setEditingAdminRoles(editingAdminRoles.filter(r => r !== role));
                                          }
                                        }}
                                      />
                                      <span className="text-xs text-white">{label}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={async () => {
                                      setAdminSubmitting(true);
                                      const result = await updateAdminRoles(admin.id, editingAdminRoles);
                                      if (result.success) {
                                        setAdminStatus({ type: 'success', message: 'Roles updated successfully' });
                                        const users = await getAllAdminUsers();
                                        setAdminUsers(users);
                                        setEditingAdminId(null);
                                      } else {
                                        setAdminStatus({ type: 'error', message: result.error || 'Failed to update roles' });
                                      }
                                      setAdminSubmitting(false);
                                    }}
                                    disabled={adminSubmitting}
                                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white hover:bg-white/20 disabled:opacity-40"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingAdminId(null)}
                                    className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-wider text-white hover:bg-white/10"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {admin.roles.map((role) => (
                                  <span
                                    key={role}
                                    className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                                  >
                                    {role.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            <div className="mt-2 space-y-0.5 text-[10px] text-slate-500">
                              <div>
                                Last login: {admin.lastLogin ? (() => {
                                  const lastLogin = new Date(admin.lastLogin);
                                  const now = new Date();
                                  const diffMs = now.getTime() - lastLogin.getTime();
                                  const diffMins = Math.floor(diffMs / (1000 * 60));
                                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                  
                                  if (diffMins < 1) return 'Just now';
                                  if (diffMins < 60) return `${diffMins} min ago`;
                                  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                                  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                                  return lastLogin.toLocaleDateString();
                                })() : 'Never'}
                              </div>
                              {admin.lastActivity && (() => {
                                const now = Date.now();
                                const lastActivity = new Date(admin.lastActivity).getTime();
                                const isOnline = admin.isActive && (now - lastActivity) < 5 * 60 * 1000;
                                return (
                                  <div className={isOnline ? 'text-emerald-400' : 'text-slate-500'}>
                                    {isOnline ? '🟢 Online now' : `Last seen: ${(() => {
                                      const diffMs = now - lastActivity;
                                      const diffMins = Math.floor(diffMs / (1000 * 60));
                                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                      
                                      if (diffMins < 1) return 'Just now';
                                      if (diffMins < 60) return `${diffMins} min ago`;
                                      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                                      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                                      return new Date(lastActivity).toLocaleDateString();
                                    })()}`}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            {editingAdminId !== admin.id && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingAdminId(admin.id);
                                    setEditingAdminRoles(admin.roles);
                                  }}
                                  className="rounded-full border border-blue-500/40 px-3 py-1 text-xs uppercase tracking-wider text-blue-200 hover:bg-blue-500/10"
                                >
                                  Edit Roles
                                </button>
                                <button
                                  onClick={async () => {
                                    if (admin.id === user?.uid) {
                                      setAdminStatus({ type: 'error', message: 'You cannot deactivate yourself' });
                                      return;
                                    }
                                    setAdminSubmitting(true);
                                    const result = admin.isActive 
                                      ? await deactivateAdminUser(admin.id)
                                      : await reactivateAdminUser(admin.id);
                                    if (result.success) {
                                      setAdminStatus({ 
                                        type: 'success', 
                                        message: admin.isActive ? 'User deactivated' : 'User reactivated' 
                                      });
                                      const users = await getAllAdminUsers();
                                      setAdminUsers(users);
                                    } else {
                                      setAdminStatus({ type: 'error', message: result.error || 'Operation failed' });
                                    }
                                    setAdminSubmitting(false);
                                  }}
                                  disabled={adminSubmitting}
                                  className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider hover:opacity-80 disabled:opacity-40 ${ 
                                    admin.isActive
                                      ? 'border-rose-500/40 text-rose-200 hover:bg-rose-500/10'
                                      : 'border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10'
                                  }`}
                                >
                                  {admin.isActive ? 'Deactivate' : 'Reactivate'}
                                </button>
                                {!admin.roles.includes('master') && (
                                  <button
                                    onClick={async () => {
                                      if (admin.id === user?.uid) {
                                        setAdminStatus({ type: 'error', message: 'You cannot delete yourself' });
                                        return;
                                      }
                                      if (!confirm(`Are you sure you want to permanently delete ${admin.displayName || admin.email}? This action cannot be undone.`)) {
                                        return;
                                      }
                                      setAdminSubmitting(true);
                                      const result = await deleteAdminUser(admin.id, user?.uid || '');
                                      if (result.success) {
                                        setAdminStatus({ 
                                          type: 'success', 
                                          message: 'Admin user deleted permanently' 
                                        });
                                        const users = await getAllAdminUsers();
                                        setAdminUsers(users);
                                      } else {
                                        setAdminStatus({ type: 'error', message: result.error || 'Delete failed' });
                                      }
                                      setAdminSubmitting(false);
                                    }}
                                    disabled={adminSubmitting}
                                    className="rounded-full border border-red-600/40 px-3 py-1 text-xs uppercase tracking-wider text-red-300 hover:bg-red-600/10 disabled:opacity-40"
                                  >
                                    Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No admin users found.</p>
                  )}
                </div>
              </section>
            </>
            )}

              </div>
            </div>
          </div>
        </main>
      )}

      {/* Password Change Modal */}
      {showPasswordChange && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">Change Password</h2>
              <p className="text-xs text-slate-400 mt-1">Enter your new password below</p>
            </div>

            {passwordChangeStatus && (
              <div className={`mb-4 rounded-lg border p-3 text-sm ${
                passwordChangeStatus.type === 'success' 
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' 
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              }`}>
                {passwordChangeStatus.message}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordChangeStatus(null);

                if (newPassword.length < 6) {
                  setPasswordChangeStatus({ type: 'error', message: 'Password must be at least 6 characters' });
                  return;
                }

                if (newPassword !== confirmPassword) {
                  setPasswordChangeStatus({ type: 'error', message: 'Passwords do not match' });
                  return;
                }

                setAdminSubmitting(true);

                try {
                  const response = await fetch('/api/admin/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: user.uid, newPassword }),
                  });

                  const data = await response.json();

                  if (data.success) {
                    setPasswordChangeStatus({ type: 'success', message: '✅ Password changed successfully!' });
                    setTimeout(() => {
                      setShowPasswordChange(false);
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordChangeStatus(null);
                    }, 2000);
                  } else {
                    setPasswordChangeStatus({ type: 'error', message: data.error || 'Failed to change password' });
                  }
                } catch (error) {
                  setPasswordChangeStatus({ type: 'error', message: 'Network error. Please try again.' });
                }

                setAdminSubmitting(false);
              }}
              className="space-y-4"
            >
              <label className="block space-y-1 text-xs text-slate-300">
                New Password *
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-white"
                />
              </label>

              <label className="block space-y-1 text-xs text-slate-300">
                Confirm Password *
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Re-enter password"
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-white"
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={adminSubmitting}
                  className="flex-1 rounded-lg border border-white/20 bg-orange-500 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-orange-600 disabled:opacity-50"
                >
                  {adminSubmitting ? 'Changing...' : 'Change Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordChangeStatus(null);
                  }}
                  className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Story Preview Modal */}
      {showStoryPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-950 shadow-2xl my-8">
            {/* Preview Header */}
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{t.previewStory}</h2>
                  <p className="text-xs text-slate-400 mt-1">{t.previewDescription}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStoryPreview(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Preview Content - Matches main page story card design */}
            <div className="p-6">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
                {/* Story Image */}
                {(imagePreview || form.imageUrl) && (
                  <div className="relative h-64 w-full">
                    <Image
                      src={imagePreview || form.imageUrl || ''}
                      alt={form.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 800px"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
                    
                    {/* Category Badge */}
                    {form.category && (
                      <div className="absolute top-4 left-4">
                        <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                          {form.category}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Story Content */}
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {form.title}
                  </h3>
                  <p className="text-sm text-orange-400 font-medium mb-3">
                    {form.headline}
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    {form.summary}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{t.justNow}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Actions */}
            <div className="border-t border-white/10 p-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowStoryPreview(false)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
              >
                {t.editStory}
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={submitting}
                className="rounded-lg bg-orange-500 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {submitting ? t.publishing : form.id ? t.confirmUpdate : t.confirmPublish}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}