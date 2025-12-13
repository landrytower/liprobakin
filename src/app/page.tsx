"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

import {
  conferenceStandings,
  conferenceStandingsWomen,
  navSections,
  spotlightPlayers,
  spotlightPlayersWomen,
  teamRosters,
  leaguePartners,
  leagueCommittee,
} from "@/data/febaco";
import type { FeaturedMatchup, Franchise, RosterPlayer, SpotlightPlayer } from "@/data/febaco";

type EnhancedMatchup = FeaturedMatchup & {
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  gender?: "men" | "women";
  refereeHomeTeam1?: string;
  refereeHomeTeam2?: string;
  refereeAwayTeam?: string;
};

type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  category: string;
  headline: string;
  imageUrl?: string;
  createdAt: Date | null;
};

type SectionHeaderProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

const SectionHeader = ({ id, eyebrow, title, description, actions }: SectionHeaderProps) => (
  <div aria-labelledby={`${id}-title`} className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{eyebrow}</p>
        ) : null}
        <h2 id={`${id}-title`} className="text-3xl font-semibold text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm text-slate-300">{description}</p>
        ) : null}
      </div>
      {actions ?? <div className="h-px flex-1 bg-slate-800" aria-hidden />}
    </div>
    {actions ? <div className="h-px w-full bg-slate-800" aria-hidden /> : null}
  </div>
);

const slug = (label: string) => label.toLowerCase();

const formatFranchiseName = (team: Franchise) =>
  [team.city, team.name].filter(Boolean).join(" ").trim();

const formatTimeAgo = (date: Date): string => {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) {
    return `il y a ${minutes} min`;
  } else if (hours < 24) {
    return `il y a ${hours} h`;
  } else {
    return `il y a ${days} j`;
  }
};

const translations = {
  en: {
    brand: "LIPROBAKIN",
    heroSeason: "Season 2025",
    heroTitle: "The Liprobakin rhythm mirrors the energy of the NBA G League.",
    heroDescription:
      "Players chasing call-ups, teams rewriting scouting reports, and nightly showcases streaming live.",
    ctaWatch: "Watch Live",
    ctaSchedule: "Download Schedule",
    ctaStandings: "Latest Standings",
    nextOn: "Next on Liprobakin+",
    heroTipoff: "Friday · 7:00 PM PT",
    heroVenue: "Axis Pavilion",
    heroFeed: "LIPROBAKIN+",
    nav: {
      games: "Games",
      schedule: "Schedule",
      players: "Players",
      news: "News",
      stats: "Stats",
      standings: "Standings",
      teams: "Teams",
    },
    sections: {
      games: {
        eyebrow: "Games",
        title: "Final Buzzer",
        description: "Scoreboard snapshots from tonight's slate.",
      },
      schedule: {
        eyebrow: "Schedule",
        title: "Weekly Schedule",
        description: "Road trips, rivalries, and showcase dates on deck.",
      },
      players: {
        eyebrow: "Players",
        title: "Spotlight",
        description: "Prospect heat check straight from Liprobakin scouting reports.",
      },
      news: {
        eyebrow: "News",
        title: "League Stories",
        description: "Daily briefs from arenas across the Liprobakin map.",
      },
      stats: {
        title: "Upcoming Spotlight Games",
        description: "",
      },
      standings: {
        eyebrow: "Standings",
        title: "Playoff Picture",
        description: "Top nine teams pathing toward the Liprobakin Showcase.",
      },
      teams: {
        eyebrow: "Teams",
        title: "Franchises",
        description: "Nine clubs setting the pace for the Liprobakin climb.",
      },
      partners: {
        eyebrow: "Partners",
        title: "League Partners",
        description: "Organizations supporting the growth of Liprobakin.",
      },
      committee: {
        eyebrow: "Committee",
        title: "League Committee",
        description: "Leadership guiding the future of Liprobakin.",
      },
    },
    metricLabels: {
      "League Pace": "League Pace",
      "Avg Efficiency": "Avg Efficiency",
      "Clutch Net": "Clutch Net",
      "3PT Volume": "3PT Volume",
      "Paint Touches": "Paint Touches",
      "Turnover Rate": "Turnover Rate",
      Deflections: "Deflections",
      "Bench Net": "Bench Net",
    },
    footerTagline: "Liprobakin League",
    languageLabel: "Language",
  },
  fr: {
    brand: "LIPROBAKIN",
    heroSeason: "Saison 2025",
    heroTitle: "Le rythme Liprobakin reflète l'énergie de la NBA G League.",
    heroDescription:
      "Des joueurs en quête de promotion, des équipes qui réécrivent les rapports de scouting et des showcases nocturnes en direct.",
    ctaWatch: "Regarder en direct",
    ctaSchedule: "Télécharger le calendrier",
    ctaStandings: "Classement",
    nextOn: "Prochain sur Liprobakin+",
    heroTipoff: "Vendredi · 19h00 PT",
    heroVenue: "Axis Pavilion",
    heroFeed: "LIPROBAKIN+",
    nav: {
      games: "Matchs",
      schedule: "Calendrier",
      players: "Joueurs",
      news: "Actualités",
      stats: "Stats",
      standings: "Classement",
      teams: "Équipes",
    },
    sections: {
      games: {
        eyebrow: "Matchs",
        title: "Dernier buzzer",
        description: "Instantanés du tableau d'affichage de ce soir.",
      },
      schedule: {
        eyebrow: "Calendrier",
        title: "Programme hebdomadaire",
        description: "",
      },
      players: {
        eyebrow: "Joueurs",
        title: "Projecteur",
        description: "",
      },
      news: {
        eyebrow: "Actualités",
        title: "Histoires de ligue",
        description: "Briefings quotidiens depuis les arènes du circuit Liprobakin.",
      },
      stats: {
        title: "Matchs à suivre",
        description: "Les affiches Liprobakin qui dynamisent la semaine à venir.",
      },
      standings: {
        eyebrow: "Classement",
        title: "Image des séries",
        description: "",
      },
      teams: {
        eyebrow: "Équipes",
        title: "Franchises",
        description: "",
      },
      partners: {
        eyebrow: "Partenaires",
        title: "Partenaires",
        description: "",
      },
      committee: {
        eyebrow: "Comité",
        title: "Comité",
        description: "",
      },
    },
    metricLabels: {
      "League Pace": "Rythme de ligue",
      "Avg Efficiency": "Efficacité moyenne",
      "Clutch Net": "Net clutch",
      "3PT Volume": "Volume à 3 pts",
      "Paint Touches": "Touches dans la raquette",
      "Turnover Rate": "Taux de pertes",
      Deflections: "Déviations",
      "Bench Net": "Impact du banc",
    },
    footerTagline: "Ligue Liprobakin",
    languageLabel: "Langue",
  },
} as const;

const teamRecordMap = Object.fromEntries(
  [...conferenceStandings, ...conferenceStandingsWomen].map((row) => [row.team, `${row.wins}-${row.losses}`] as const)
);

const getTeamRecord = (team: string) => teamRecordMap[team] ?? null;
const getTotalPoints = (wins: number, losses: number) => wins * 2 + losses;

const playerHeadshots: Record<string, string> = {
  ...Object.fromEntries(spotlightPlayers.map((player) => [player.name, player.photo] as const)),
  ...Object.fromEntries(spotlightPlayersWomen.map((player) => [player.name, player.photo] as const)),
  "Cam Porter": "/players/cam-porter.svg",
  "Omar Greer": "/players/omar-greer.svg",
};

type Locale = keyof typeof translations;
type Gender = "men" | "women";
type SelectedTeamState = { label: string; gender: Gender } | null;

const findFranchiseByName = (teamName: string, allTeams: Franchise[]) => {
  const normalized = teamName.toLowerCase();
  return allTeams.find((team) => {
    const display = formatFranchiseName(team).toLowerCase();
    return display === normalized || team.name.toLowerCase() === normalized;
  });
};

const parseTipoffToDate = (tipoff: string) => {
  const sanitized = tipoff.replace(/\s*·\s*/g, " ");
  const candidate = `${sanitized} ${new Date().getFullYear()}`;
  const timestamp = Date.parse(candidate);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
};

const LeaderRow = ({ leader, allFranchises }: { leader: FeaturedMatchup["leaders"][number]; allFranchises: Franchise[] }) => {
  const franchise = findFranchiseByName(leader.team, allFranchises);
  const headshot = playerHeadshots[leader.player];
  const initials = leader.player
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName = leader.player.trim().split(" ").pop() ?? leader.player;

  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        {headshot ? (
          <Image
            src={headshot}
            alt={`${leader.player} portrait`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full border border-white/20 object-cover flex-shrink-0"
          />
        ) : franchise?.logo ? (
          <Image
            src={franchise.logo}
            alt={`${formatFranchiseName(franchise)} logo`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full border border-white/20 bg-white/5 object-cover flex-shrink-0"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold flex-shrink-0">
            {initials}
          </span>
        )}
        <div className="min-w-0 overflow-hidden">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 truncate">{leader.team}</p>
          <p className="text-sm font-semibold text-white truncate">{displayName}</p>
          <p className="text-[10px] text-slate-400 truncate">{leader.stats}</p>
        </div>
      </div>
    </div>
  );
};

const MatchupTeam = ({ team, record, logo, allFranchises }: { team: string; record: string; logo?: string; allFranchises: Franchise[] }) => {
  const franchise = findFranchiseByName(team, allFranchises);
  const displayName = franchise ? formatFranchiseName(franchise) : team;
  const colors = franchise?.colors ?? ["#1e293b", "#0f172a"];
  const label = franchise?.city?.trim();
  const showLabel = Boolean(label && label.toLowerCase() !== displayName.toLowerCase());
  const teamLogo = logo || franchise?.logo;
  const initials = team
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col items-center gap-1 md:gap-2 text-center min-w-0">
      {teamLogo ? (
        <Image
          src={teamLogo}
          alt={`${displayName} logo`}
          width={48}
          height={48}
          className="h-8 w-8 md:h-12 md:w-12 rounded-full border border-white/10 bg-white/5 object-cover flex-shrink-0"
        />
      ) : (
        <span className="flex h-8 w-8 md:h-12 md:w-12 items-center justify-center rounded-full bg-white/10 text-[10px] md:text-sm font-semibold flex-shrink-0">
          {initials}
        </span>
      )}
      <div className="min-w-0 w-full">
        <p className="text-[10px] md:text-sm font-semibold text-white truncate">{displayName}</p>
        <p className="text-[8px] md:text-[10px] text-slate-400">{record}</p>
      </div>
      <div className="flex w-10 md:w-16 gap-1 flex-shrink-0">
        {colors.map((color) => (
          <span key={`${team}-${color}`} className="h-0.5 flex-1 rounded-full" style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
};

const ScoreTeamRow = ({
  team,
  score,
  highlight = false,
  showRecord = false,
  allFranchises,
}: {
  team: string;
  score: number;
  highlight?: boolean;
  showRecord?: boolean;
  allFranchises: Franchise[];
}) => {
  const franchise = findFranchiseByName(team, allFranchises);
  const displayName = franchise ? formatFranchiseName(franchise) : team;
  const initials = team
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const record = showRecord ? getTeamRecord(displayName) ?? getTeamRecord(team) : null;

  return (
    <div className={`flex items-center justify-between ${highlight ? "text-white" : "text-slate-300"}`}>
      <div className="flex items-center gap-3">
        {franchise?.logo ? (
          <Image
            src={franchise.logo}
            alt={`${displayName} logo`}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border border-white/15 bg-white/5 object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
            {initials}
          </span>
        )}
        <span className={`text-base font-semibold ${highlight ? "text-white" : "text-slate-200"}`}>
          {displayName}
          {record ? <span className="text-sm font-normal text-slate-400"> {`(${record})`}</span> : null}
        </span>
      </div>
      <span className={`text-2xl font-bold ${highlight ? "text-white" : "text-slate-300"}`}>{score}</span>
    </div>
  );
};

const ScheduleTeam = ({ team, label, allFranchises }: { team: string; label: string; allFranchises: Franchise[] }) => {
  const franchise = findFranchiseByName(team, allFranchises);
  const displayName = franchise ? formatFranchiseName(franchise) : team;
  const initials = team
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {franchise?.logo ? (
        <Image
          src={franchise.logo}
          alt={`${displayName} logo`}
          width={48}
          height={48}
          className="h-12 w-12 rounded-full border border-white/10 bg-white/5 object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
          {initials}
        </span>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{label}</p>
        <p className="text-base font-semibold text-white">{displayName}</p>
      </div>
    </div>
  );
};

const GenderToggle = ({ value, onChange }: { value: Gender; onChange: (value: Gender) => void }) => (
  <div className="inline-flex overflow-hidden rounded-full border border-white/20 bg-white/5 text-[10px] font-semibold uppercase tracking-[0.3em]" role="group" aria-label="Gender filter">
    {(
      [
        { key: "men" as Gender, label: "Gentlemen", short: "G" },
        { key: "women" as Gender, label: "Ladies", short: "L" },
      ]
    ).map((option) => {
      const isActive = value === option.key;
      return (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`relative px-2 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:px-4 ${
            isActive ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
          }`}
          aria-pressed={isActive}
          aria-label={option.label}
        >
          <span className="sm:hidden" aria-hidden>
            {option.short}
          </span>
          <span className="hidden sm:inline" aria-hidden>
            {option.label}
          </span>
        </button>
      );
    })}
  </div>
);

type PlayerMetric = keyof SpotlightPlayer["leaderboard"];

const playerMetricFilters: { key: PlayerMetric; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "ast", label: "AST" },
  { key: "reb", label: "REB" },
  { key: "blk", label: "BLK" },
];

  const RosterModal = ({ teamName, roster, onClose, allFranchises }: { teamName: string; roster: RosterPlayer[]; onClose: () => void; allFranchises: Franchise[] }) => {
    const franchise = findFranchiseByName(teamName, allFranchises);
    
    useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={`${teamName} roster`}
        className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {franchise?.logo ? (
              <Image
                src={franchise.logo}
                alt={`${teamName} logo`}
                width={56}
                height={56}
                className="h-14 w-14 rounded-full border border-white/20 object-cover"
              />
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Roster</p>
              <h3 className="text-2xl font-semibold">{teamName}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-white hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="mt-6 space-y-3">
          {roster.map((player) => (
            <div
              key={`${teamName}-${player.number}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-gradient-to-r from-slate-900/70 to-slate-900/30 p-4"
            >
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">#{player.number}</p>
                <p className="text-lg font-semibold text-white">{player.name}</p>
                <p className="text-sm text-slate-300">{player.height}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200">
                <span className="rounded-full border border-white/10 px-3 py-1">PTS {player.stats.pts}</span>
                <span className="rounded-full border border-white/10 px-3 py-1">REB {player.stats.reb}</span>
                <span className="rounded-full border border-white/10 px-3 py-1">STL {player.stats.stl}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PlayerStatsModal = ({ player, onClose }: { player: SpotlightPlayer; onClose: () => void }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={`${player.name} league-leading stats`}
        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">League Leaders</p>
            <h3 className="text-2xl font-semibold text-white">
              #{player.number} · {player.name}
            </h3>
            <p className="text-sm text-slate-300">{player.team}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-white hover:text-white"
          >
            Close
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-200">{player.blurb}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {player.statLines.map((line) => (
            <div
              key={`${player.name}-${line.label}`}
              className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/80 to-slate-900/30 p-4"
            >
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{line.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{line.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [language, setLanguage] = useState<Locale>("fr");
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeamState>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<SpotlightPlayer | null>(null);
  const [playerMetric, setPlayerMetric] = useState<PlayerMetric>("pts");
  const [gender, setGender] = useState<Gender>("men");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dynamicSpotlightGames, setDynamicSpotlightGames] = useState<EnhancedMatchup[]>([]);
  const [weeklyScheduleGames, setWeeklyScheduleGames] = useState<EnhancedMatchup[]>([]);
  const [completedGames, setCompletedGames] = useState<any[]>([]);
  const [menTeams, setMenTeams] = useState<Franchise[]>([]);
  const [womenTeams, setWomenTeams] = useState<Franchise[]>([]);
  const [leagueTopPlayers, setLeagueTopPlayers] = useState<any[]>([]);
  const [leagueLeadersExpanded, setLeagueLeadersExpanded] = useState(false);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [featuredArticleId, setFeaturedArticleId] = useState<string | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [newsGridStartIndex, setNewsGridStartIndex] = useState(0);
  const [dynamicStandings, setDynamicStandings] = useState<any[]>([]);
  const [currentPartnerIndex, setCurrentPartnerIndex] = useState(0);
  const [currentCommitteeIndex, setCurrentCommitteeIndex] = useState(0);
  const [dynamicPartners, setDynamicPartners] = useState<any[]>([]);
  const [dynamicCommittee, setDynamicCommittee] = useState<any[]>([]);
  const copy = translations[language];
  const sectionCopy = copy.sections;
  const languageOptions: Locale[] = ["en", "fr"];
  const mobileNavSections: Array<(typeof navSections)[number]> = [
    "Schedule",
    "Players",
    "Standings",
    "Teams",
  ];
  const selectedRoster = selectedTeam
    ? selectedTeam.gender === "men"
      ? teamRosters[selectedTeam.label]
      : teamRosters[`women:${selectedTeam.label}`]
    : undefined;
  const genderPlayers = gender === "men" ? spotlightPlayers : spotlightPlayersWomen;
  // Always use dynamic standings calculated from games - no fallback to static data
  const genderStandings = dynamicStandings.filter(s => s.gender === gender);
  const genderFranchises = gender === "men" ? menTeams : womenTeams;
  const allFranchises = [...menTeams, ...womenTeams];
  const playerLeaders = [...genderPlayers].sort(
    (a, b) => b.leaderboard[playerMetric] - a.leaderboard[playerMetric]
  );
  const spotlightGames = dynamicSpotlightGames;

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        
        const men: Franchise[] = [];
        const women: Franchise[] = [];
        
        teamsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const colors: [string, string] = Array.isArray(data.colors) && data.colors.length >= 2
            ? [data.colors[0], data.colors[1]]
            : ["#1e293b", "#0f172a"];
          
          const franchise: Franchise = {
            city: data.city ?? "",
            name: data.name ?? doc.id,
            colors,
            logo: data.logo ?? "/logos/liprobakin.png",
          };
          
          if (data.gender === "women") {
            women.push(franchise);
          } else {
            men.push(franchise);
          }
        });
        
        men.sort((a, b) => a.name.localeCompare(b.name));
        women.sort((a, b) => a.name.localeCompare(b.name));
        
        setMenTeams(men);
        setWomenTeams(women);
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };
    
    fetchTeams();
  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const newsRef = collection(firebaseDB, "news");
        const newsQuery = query(newsRef, orderBy("createdAt", "desc"));
        const newsSnapshot = await getDocs(newsQuery);
        
        const articles: NewsArticle[] = newsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "",
            summary: data.summary || "",
            category: data.category || "News",
            headline: data.headline || "",
            imageUrl: data.imageUrl,
            createdAt: data.createdAt?.toDate() || null,
          };
        });
        
        setNewsArticles(articles);
        if (articles.length > 0) {
          setFeaturedArticleId(articles[0].id);
        }
      } catch (error) {
        console.error("Error fetching news:", error);
      }
    };
    
    fetchNews();
  }, []);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const partnersRef = collection(firebaseDB, "partners");
        const partnersSnapshot = await getDocs(partnersRef);
        
        const partners = partnersSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "",
            logo: data.logo || "",
          };
        });
        
        setDynamicPartners(partners);
      } catch (error) {
        console.error("Error fetching partners:", error);
      }
    };
    
    fetchPartners();
  }, []);

  useEffect(() => {
    const fetchCommittee = async () => {
      try {
        const committeeRef = collection(firebaseDB, "committee");
        const committeeSnapshot = await getDocs(committeeRef);
        
        const members = committeeSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            role: data.role || "",
            photo: data.photo || "",
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        
        setDynamicCommittee(members);
      } catch (error) {
        console.error("Error fetching committee:", error);
      }
    };
    
    fetchCommittee();
  }, []);

  useEffect(() => {
    const calculateStandings = async () => {
      try {
        const gamesRef = collection(firebaseDB, "games");
        const gamesSnapshot = await getDocs(gamesRef);
        
        console.log("Total games found:", gamesSnapshot.size);
        
        const teamStats: Record<string, {
          wins: number;
          losses: number;
          totalPoints: number;
          teamName: string;
          gender: string;
        }> = {};
        
        gamesSnapshot.docs.forEach((doc) => {
          const game = doc.data();
          console.log("Processing game:", game);
          
          if (game.winnerTeamId && game.loserTeamId) {
            const homeTeam = game.homeTeamId;
            const awayTeam = game.awayTeamId;
            const winnerTeam = game.winnerTeamId;
            const loserTeam = game.loserTeamId;
            const winnerScore = game.winnerScore || 0;
            const loserScore = game.loserScore || 0;
            const homeTeamName = game.homeTeamName || "";
            const awayTeamName = game.awayTeamName || "";
            const gameGender = game.gender || "men";
            
            // Determine scores for home and away teams
            const homeScore = winnerTeam === homeTeam ? winnerScore : loserScore;
            const awayScore = winnerTeam === awayTeam ? winnerScore : loserScore;
            
            console.log(`Game: ${homeTeamName} (${homeScore}) vs ${awayTeamName} (${awayScore}), Winner: ${winnerTeam === homeTeam ? homeTeamName : awayTeamName}`);
            
            // Initialize home team
            if (!teamStats[homeTeam]) {
              teamStats[homeTeam] = {
                wins: 0,
                losses: 0,
                totalPoints: 0,
                teamName: homeTeamName,
                gender: gameGender
              };
            }
            
            // Initialize away team
            if (!teamStats[awayTeam]) {
              teamStats[awayTeam] = {
                wins: 0,
                losses: 0,
                totalPoints: 0,
                teamName: awayTeamName,
                gender: gameGender
              };
            }
            
            // Update stats
            teamStats[homeTeam].totalPoints += homeScore;
            teamStats[awayTeam].totalPoints += awayScore;
            
            if (winnerTeam === homeTeam) {
              teamStats[homeTeam].wins += 1;
              teamStats[awayTeam].losses += 1;
            } else {
              teamStats[awayTeam].wins += 1;
              teamStats[homeTeam].losses += 1;
            }
            
            console.log(`${homeTeamName} stats:`, teamStats[homeTeam]);
            console.log(`${awayTeamName} stats:`, teamStats[awayTeam]);
          }
        });
        
        console.log("Final team stats:", teamStats);
        
        // Convert to array and sort
        const standingsArray = Object.entries(teamStats).map(([teamId, stats], index) => ({
          seed: index + 1,
          team: stats.teamName,
          wins: stats.wins,
          losses: stats.losses,
          totalPoints: stats.totalPoints,
          gender: stats.gender
        }));
        
        // Sort by wins (descending), then by total points (descending)
        standingsArray.sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.totalPoints - a.totalPoints;
        });
        
        // Update seed numbers after sorting
        const menStandings = standingsArray.filter(s => s.gender === "men");
        const womenStandings = standingsArray.filter(s => s.gender === "women");
        
        menStandings.forEach((s, i) => s.seed = i + 1);
        womenStandings.forEach((s, i) => s.seed = i + 1);
        
        console.log("Final standings:", [...menStandings, ...womenStandings]);
        
        setDynamicStandings([...menStandings, ...womenStandings]);
      } catch (error) {
        console.error("Error calculating standings:", error);
      }
    };
    
    calculateStandings();
  }, []);

  // Auto-rotate news articles every 10 seconds
  useEffect(() => {
    if (newsArticles.length <= 1 || expandedArticleId) return; // Don't rotate if expanded
    
    const interval = setInterval(() => {
      setNewsArticles(prev => {
        if (prev.length === 0) return prev;
        
        // Find current featured index
        const currentIndex = prev.findIndex(article => article.id === featuredArticleId);
        // Get next article (wrap around to start)
        const nextIndex = (currentIndex + 1) % prev.length;
        
        // Set next article as featured
        setFeaturedArticleId(prev[nextIndex].id);
        
        return prev;
      });
    }, 10000); // 10 seconds
    
    return () => clearInterval(interval);
  }, [newsArticles, featuredArticleId, expandedArticleId]);

  // Auto-rotate partners every 5 seconds
  useEffect(() => {
    if (dynamicPartners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentPartnerIndex((prev) => (prev + 1) % dynamicPartners.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [dynamicPartners]);

  // Auto-rotate committee members every 5 seconds
  useEffect(() => {
    if (dynamicCommittee.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentCommitteeIndex((prev) => (prev + 1) % dynamicCommittee.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [dynamicCommittee]);

  // Auto-rotate news grid on mobile every 6 seconds
  useEffect(() => {
    if (newsArticles.length <= 2) return;
    
    const interval = setInterval(() => {
      setNewsGridStartIndex((prev) => (prev + 1) % newsArticles.length);
    }, 6000);
    
    return () => clearInterval(interval);
  }, [newsArticles]);

  useEffect(() => {
    const fetchLeagueTopPlayers = async () => {
      try {
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        
        // Fetch all team rosters in parallel instead of sequentially
        const rosterPromises = teamsSnapshot.docs.map(async (teamDoc) => {
          const teamData = teamDoc.data();
          const rosterRef = collection(firebaseDB, "teams", teamDoc.id, "roster");
          
          try {
            const rosterSnapshot = await getDocs(rosterRef);
            
            return rosterSnapshot.docs.map((playerDoc) => {
              const playerData = playerDoc.data();
              return {
                id: playerDoc.id,
                firstName: playerData.firstName || "",
                lastName: playerData.lastName || "",
                number: playerData.number || "00",
                teamName: teamData.name || "Unknown",
                teamLogo: teamData.logo || "/logos/liprobakin.png",
                headshot: playerData.headshot,
                stats: {
                  pts: playerData.stats?.pts || 0,
                  reb: playerData.stats?.reb || 0,
                  ast: playerData.stats?.ast || 0,
                  blk: playerData.stats?.blk || 0,
                  stl: playerData.stats?.stl || 0,
                },
              };
            });
          } catch (error) {
            console.error(`Error fetching roster for team ${teamDoc.id}:`, error);
            return [];
          }
        });
        
        // Wait for all rosters to be fetched in parallel
        const allRosters = await Promise.all(rosterPromises);
        const allPlayers = allRosters.flat();
        
        // Sort by points and set top players
        const sortedByPts = [...allPlayers].sort((a, b) => b.stats.pts - a.stats.pts);
        setLeagueTopPlayers(sortedByPts);
      } catch (error) {
        console.error("Error fetching league top players:", error);
      }
    };
    
    fetchLeagueTopPlayers();
  }, []);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const gamesRef = collection(firebaseDB, "games");
        const gamesQuery = query(
          gamesRef,
          orderBy("date", "asc"),
          limit(50)
        );
        
        const snapshot = await getDocs(gamesQuery);
        
        // Fetch teams to get records
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        const teamsMap = new Map();
        teamsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          teamsMap.set(doc.id, {
            wins: data.wins || 0,
            losses: data.losses || 0,
          });
        });
        
        // Fetch referees to get their names
        const refereesRef = collection(firebaseDB, "referees");
        const refereesSnapshot = await getDocs(refereesRef);
        const refereesMap = new Map();
        refereesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          refereesMap.set(doc.id, {
            firstName: data.firstName || "",
            lastName: data.lastName || "",
          });
        });
        
        const allGames = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const dateStr = data.date || "";
            const timeStr = data.time || "00:00";
            const dateObj = new Date(`${dateStr}T${timeStr}`);
            
            return {
              id: doc.id,
              data,
              dateObj,
              completed: data.completed === true,
            };
          })
          .filter((game) => {
            if (game.completed) return false;
            
            const now = new Date();
            
            // Get the start of current week (Monday)
            const currentDay = now.getDay();
            const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay; // If Sunday, go back 6 days, else go to Monday
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() + diffToMonday);
            startOfWeek.setHours(0, 0, 0, 0);
            
            // Get the end of current week (Sunday)
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            
            // Check if game is within current week
            const gameInCurrentWeek = game.dateObj >= startOfWeek && game.dateObj <= endOfWeek;
            
            // Hide game 1 minute after start time
            const oneMinuteAfterStart = new Date(game.dateObj.getTime() + 60000);
            const gameNotStarted = now < oneMinuteAfterStart;
            
            return gameInCurrentWeek && gameNotStarted;
          })
          .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        // Get top 3 for spotlight (earliest upcoming games)
        const spotlightGamesData = allGames.slice(0, 3);
        
        // Fetch roster data for all teams involved in games
        const getTopPlayerForTeam = async (teamId: string, teamName: string) => {
          try {
            const rosterRef = collection(firebaseDB, "teams", teamId, "roster");
            const rosterSnapshot = await getDocs(rosterRef);
            
            if (rosterSnapshot.empty) return null;
            
            const players = rosterSnapshot.docs.map((doc) => doc.data());
            
            // Check if any player has stats
            const hasStats = players.some((p) => (p.stats?.pts || 0) > 0);
            
            if (hasStats) {
              // Find player with highest points
              let topPlayer: any = null;
              let topPts = 0;
              
              players.forEach((player) => {
                const pts = player.stats?.pts || 0;
                if (pts > topPts) {
                  topPts = pts;
                  topPlayer = player;
                }
              });
              
              if (topPlayer) {
                const pts = topPlayer.stats?.pts || 0;
                const reb = topPlayer.stats?.reb || 0;
                const ast = topPlayer.stats?.ast || 0;
                const secondStat = reb >= ast ? `${reb} REB` : `${ast} AST`;
                return {
                  player: `${topPlayer.firstName || ""} ${topPlayer.lastName || ""}`.trim() || "Unknown",
                  team: teamName,
                  stats: `${pts} PTS · ${secondStat}`,
                };
              }
            } else {
              // No stats, get first player alphabetically
              const sortedPlayers = players.sort((a, b) => {
                const nameA = `${a.lastName || ""} ${a.firstName || ""}`.trim().toLowerCase();
                const nameB = `${b.lastName || ""} ${b.firstName || ""}`.trim().toLowerCase();
                return nameA.localeCompare(nameB);
              });
              
              if (sortedPlayers.length > 0) {
                const firstPlayer = sortedPlayers[0];
                const pts = firstPlayer.stats?.pts || 0;
                const reb = firstPlayer.stats?.reb || 0;
                const ast = firstPlayer.stats?.ast || 0;
                const secondStat = reb >= ast ? `${reb} REB` : `${ast} AST`;
                return {
                  player: `${firstPlayer.firstName || ""} ${firstPlayer.lastName || ""}`.trim() || "Unknown",
                  team: teamName,
                  stats: `${pts} PTS · ${secondStat}`,
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching roster for team ${teamId}:`, error);
          }
          return null;
        };
        
        const formatGameData = async (game: typeof allGames[0]): Promise<EnhancedMatchup> => {
          const formatTipoff = (dateObj: Date) => {
            return new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(dateObj);
          };
          
          const homeTeam = teamsMap.get(game.data.homeTeamId) || { wins: 0, losses: 0 };
          const awayTeam = teamsMap.get(game.data.awayTeamId) || { wins: 0, losses: 0 };
          
          // Get referee last names from IDs
          const getRefereeLastName = (refId: string | undefined) => {
            if (!refId) return undefined;
            const referee = refereesMap.get(refId);
            return referee?.lastName || undefined;
          };
          
          // Get top player from each team's roster
          const leaders: FeaturedMatchup["leaders"] = [];
          
          if (game.data.homeTeamId) {
            const homeLeader = await getTopPlayerForTeam(game.data.homeTeamId, game.data.homeTeamName || "Home");
            if (homeLeader) leaders.push(homeLeader);
          }
          
          if (game.data.awayTeamId) {
            const awayLeader = await getTopPlayerForTeam(game.data.awayTeamId, game.data.awayTeamName || "Away");
            if (awayLeader) leaders.push(awayLeader);
          }
          
          return {
            id: game.id,
            status: "Upcoming",
            tipoff: formatTipoff(game.dateObj),
            venue: game.data.venue || "TBD",
            network: "Liprobakin+",
            home: {
              team: game.data.homeTeamName || "Home",
              record: `${homeTeam.wins}-${homeTeam.losses}`,
            },
            away: {
              team: game.data.awayTeamName || "Away",
              record: `${awayTeam.wins}-${awayTeam.losses}`,
            },
            homeTeamLogo: game.data.homeTeamLogo,
            awayTeamLogo: game.data.awayTeamLogo,
            gender: game.data.gender,
            refereeHomeTeam1: getRefereeLastName(game.data.refereeHomeTeam1),
            refereeHomeTeam2: getRefereeLastName(game.data.refereeHomeTeam2),
            refereeAwayTeam: getRefereeLastName(game.data.refereeAwayTeam),
            leaders,
          };
        };

        const spotlightGames = await Promise.all(spotlightGamesData.map(formatGameData));
        const allWeeklyGames = await Promise.all(allGames.map(formatGameData));
        
        setDynamicSpotlightGames(spotlightGames);
        setWeeklyScheduleGames(allWeeklyGames);
        
        // Fetch completed games for Final Buzzer section
        const completedGamesQuery = query(
          gamesRef,
          orderBy("date", "desc"),
          limit(10)
        );
        const completedSnapshot = await getDocs(completedGamesQuery);
        const completedGamesData = completedSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              dateObj: data.date ? new Date(data.date) : null,
            };
          })
          .filter((game: any) => game.completed === true)
          .sort((a: any, b: any) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0))
          .slice(0, 7);
        
        setCompletedGames(completedGamesData);
        
        console.log("Spotlight games:", spotlightGames.length);
        console.log("Weekly schedule games:", allWeeklyGames.length);
        console.log("Completed games:", completedGamesData.length);
      } catch (error) {
        console.error("Error fetching games:", error);
      }
    };

    fetchGames();
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  // Auto-scroll for teams section
  useEffect(() => {
    const container = document.querySelector('#teams .overflow-x-auto') as HTMLElement;
    if (!container) return;

    let scrollInterval: NodeJS.Timeout;
    let isHovered = false;
    let isPaused = false;

    const startAutoScroll = () => {
      scrollInterval = setInterval(() => {
        if (!isHovered && !isPaused) {
          const maxScroll = container.scrollWidth - container.clientWidth;
          
          if (container.scrollLeft >= maxScroll) {
            // Reset to beginning
            container.scrollLeft = 0;
          } else {
            // Scroll right by 1 pixel for smooth movement
            container.scrollLeft += 1;
          }
        }
      }, 30); // 30ms interval for smooth animation
    };

    const handleMouseEnter = () => {
      isHovered = true;
    };

    const handleMouseLeave = () => {
      isHovered = false;
    };

    const handleUserScroll = () => {
      isPaused = true;
      // Resume auto-scroll after 3 seconds of no user interaction
      setTimeout(() => {
        isPaused = false;
      }, 3000);
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('scroll', handleUserScroll);

    startAutoScroll();

    return () => {
      clearInterval(scrollInterval);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('scroll', handleUserScroll);
    };
  }, [genderFranchises]); // Re-run when teams change

  return (
    <div className="relative isolate min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-[-200px] h-[500px] bg-[radial-gradient(circle,_rgba(56,189,248,0.35),_transparent_60%)] blur-3xl"
        aria-hidden
      />

      <nav className="sticky top-0 z-30 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3 text-xl font-semibold tracking-[0.3em]">
            <Image
              src="/logos/liprobakin.png"
              alt="Liprobakin logo"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full border border-white/20 bg-white/5 object-cover"
              priority
            />
            <span>{copy.brand}</span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="flex rounded-full border border-white/20 p-2 text-white transition hover:border-white/50 lg:hidden"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-panel"
            >
              <span className="sr-only">Toggle navigation</span>
              <span
                className={`block h-0.5 w-6 bg-current transition ${mobileNavOpen ? "translate-y-1 rotate-45" : ""}`}
              />
              <span
                className={`block h-0.5 w-6 bg-current transition ${mobileNavOpen ? "-translate-y-1 -rotate-45" : "mt-1"}`}
              />
            </button>
            <div className="hidden gap-6 text-xs font-medium uppercase tracking-[0.3em] text-slate-300 lg:flex">
              {navSections.map((section) => (
                <Link
                  key={section}
                  href={`#${slug(section)}`}
                  className="transition hover:text-white"
                >
                  {copy.nav[slug(section) as keyof typeof copy.nav] ?? section}
                </Link>
                ))}
            </div>
            <GenderToggle value={gender} onChange={setGender} />
          </div>
        </div>
      </nav>

      {mobileNavOpen ? (
        <div
          id="mobile-nav-panel"
          className="border-b border-white/10 bg-black/90 backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:px-8">
            {mobileNavSections.map((section) => (
              <Link
                key={section}
                href={`#${slug(section)}`}
                onClick={() => setMobileNavOpen(false)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-white/40 hover:text-white"
              >
                {copy.nav[slug(section) as keyof typeof copy.nav] ?? section}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* News Section */}
      {newsArticles.length > 0 && featuredArticleId && (
        <section className="mx-auto max-w-7xl px-4 md:px-8">
          {(() => {
            const featured = newsArticles.find((article) => article.id === featuredArticleId);
            if (!featured) return null;
            
            const isExpanded = expandedArticleId === featured.id;
            
            return (
              <div className="space-y-8">
                {/* Featured Article */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90">
                  {featured.imageUrl && (
                    <div className={`relative overflow-hidden transition-all duration-500 ${isExpanded ? 'min-h-[600px]' : 'h-[600px]'}`}>
                      <Image
                        src={featured.imageUrl}
                        alt={featured.title}
                        fill
                        className="object-cover"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950" />
                      
                      {/* Title and Headline on top of image */}
                      <div className={`absolute inset-0 flex flex-col p-8 md:p-16 ${isExpanded ? 'relative' : 'justify-between'}`}>
                        <div>
                          <span className="mb-2 inline-block w-fit rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                            {featured.category}
                          </span>
                          
                          <h1 className="mb-2 text-2xl font-bold leading-tight text-white md:text-3xl lg:text-4xl max-w-4xl">
                            {featured.title}
                          </h1>
                          
                          <p className="mb-2 text-sm md:text-base text-slate-200 max-w-3xl">
                            {featured.headline}
                          </p>
                          
                          {featured.createdAt && (
                            <p className="mb-4 text-xs text-slate-300">
                              {formatTimeAgo(featured.createdAt)}
                            </p>
                          )}
                          
                          <button
                            onClick={() => setExpandedArticleId(isExpanded ? null : featured.id)}
                            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:border-orange-500 hover:bg-orange-600 w-fit"
                          >
                            {isExpanded ? "Fermer" : "Voir l'article »"}
                          </button>
                          
                          {/* Expandable Article Content - Below button with slide up animation */}
                          <div
                            className={`transition-all duration-500 ease-in-out -mx-8 md:-mx-16 overflow-visible ${
                              isExpanded ? "max-h-[3000px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
                            }`}
                          >
                            <div className="bg-slate-950/95 backdrop-blur-sm p-6 md:p-8 border-y border-white/10 w-full">
                              <p className="text-base leading-relaxed text-slate-200 whitespace-pre-line">
                                {featured.summary}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Article Grid - Below button, hidden when expanded */}
                        {newsArticles.length > 0 && !isExpanded && (
                          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 pb-16 mt-6 max-w-4xl mx-auto">
                            {(() => {
                              // On mobile (< 640px): show 2 articles with rotation
                              // On larger screens: show 3 articles
                              const articlesToShow = 3;
                              const gridArticles = [];
                              
                              for (let i = 0; i < articlesToShow; i++) {
                                const index = (newsGridStartIndex + i) % newsArticles.length;
                                gridArticles.push(newsArticles[index]);
                              }
                              
                              return gridArticles.map((article, index) => (
                                <button
                                  key={`${article.id}-${index}`}
                                  onClick={() => {
                                    setFeaturedArticleId(article.id);
                                    setExpandedArticleId(null);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className={`group relative overflow-hidden rounded-xl border text-left transition hover:border-orange-500 hover:bg-slate-900/80 ${
                                    article.id === featured.id 
                                      ? 'border-orange-500 bg-slate-900/80' 
                                      : 'border-white/10 bg-slate-900/60'
                                  } ${index === 2 ? 'hidden sm:block' : ''}`}
                              >
                                {article.imageUrl && (
                                  <div className="relative h-20 md:h-28 overflow-hidden">
                                    <Image
                                      src={article.imageUrl}
                                      alt={article.title}
                                      fill
                                      className="object-cover transition duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                                  </div>
                                )}
                                
                                <div className="p-2 md:p-3">
                                  <span className="mb-1 inline-block text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-orange-500">
                                    {article.category}
                                  </span>
                                  
                                  <h3 className="mb-1 md:mb-1.5 text-[10px] md:text-xs font-bold leading-tight text-white group-hover:text-orange-500 transition-colors line-clamp-2">
                                    {article.title}
                                  </h3>
                                  
                                  <p className="text-[9px] md:text-[11px] text-slate-400 line-clamp-2">
                                    {article.headline}
                                  </p>
                                  
                                  {article.createdAt && (
                                    <p className="mt-1 md:mt-1.5 text-[9px] md:text-[10px] text-slate-500">
                                      {new Intl.DateTimeFormat("fr-FR", {
                                        month: "short",
                                        day: "numeric",
                                      }).format(article.createdAt)}
                                    </p>
                                  )}
                                </div>
                              </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      <main className="mx-auto max-w-6xl space-y-20 px-4 pb-20 pt-12 md:px-8">
        <section id="stats" className="space-y-8">
          <SectionHeader
            id="stats"
            title={sectionCopy.stats.title}
          />
          <div className="space-y-4">
            {spotlightGames.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-12 text-center">
                <p className="text-lg text-slate-400">No upcoming games scheduled yet.</p>
                <p className="mt-2 text-sm text-slate-500">Check back soon for the latest matchups!</p>
              </div>
            ) : (
              spotlightGames.map((matchup) => (
                <article
                  key={matchup.id}
                  className="grid gap-4 rounded-2xl border border-white/5 bg-slate-900/70 p-3 md:p-4 shadow-lg shadow-black/30 lg:grid-cols-[2fr_1fr] overflow-hidden"
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 min-w-0">
                    <MatchupTeam 
                      team={matchup.away.team} 
                      record={matchup.away.record}
                      logo={"awayTeamLogo" in matchup ? matchup.awayTeamLogo : undefined}
                      allFranchises={allFranchises}
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5 md:gap-2 text-center min-w-0 px-1">
                      <span className="rounded-full border border-white/15 px-2 md:px-3 py-0.5 text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-300 whitespace-nowrap">
                        {matchup.gender === "men" ? "Men" : matchup.gender === "women" ? "Women" : matchup.status}
                      </span>
                      <div className="min-w-0 w-full">
                        <p className="text-sm md:text-base font-semibold text-white truncate">{matchup.tipoff}</p>
                        <p className="text-xs md:text-sm text-slate-300 truncate">{matchup.venue}</p>
                        {(matchup.refereeHomeTeam1 || matchup.refereeHomeTeam2 || matchup.refereeAwayTeam) && (
                          <p className="mt-0.5 md:mt-1 text-[10px] md:text-xs text-slate-400 truncate">
                            Refs: {[matchup.refereeHomeTeam1, matchup.refereeHomeTeam2, matchup.refereeAwayTeam].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <MatchupTeam 
                      team={matchup.home.team} 
                      record={matchup.home.record}
                      logo={"homeTeamLogo" in matchup ? matchup.homeTeamLogo : undefined}
                      allFranchises={allFranchises}
                    />
                  </div>
                  <div className="space-y-2 rounded-xl border border-white/5 bg-black/30 p-3 overflow-hidden flex flex-col items-center justify-center">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Leaders</p>
                    <div className="grid grid-cols-2 gap-3 min-w-0 w-full">
                      {matchup.leaders.map((leader) => (
                        <LeaderRow key={`${matchup.id}-${leader.player}`} leader={leader} allFranchises={allFranchises} />
                      ))}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section id="schedule" className="space-y-8">
          <SectionHeader
            id="schedule"
            eyebrow={sectionCopy.schedule.eyebrow}
            title={sectionCopy.schedule.title}
          />
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <div className="space-y-4">
              {weeklyScheduleGames.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-slate-400">No games scheduled yet.</p>
                </div>
              ) : (
                weeklyScheduleGames.slice(0, 5).map((game) => (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-white/5 bg-black/30 p-3 sm:p-4"
                  >
                    {/* Mobile: Vertical Stack, Desktop: Horizontal */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                      {/* Date/Time */}
                      <div className="flex items-center justify-between md:flex-col md:items-start md:min-w-[80px] md:flex-shrink-0">
                        <p className="text-sm font-semibold text-white">{game.tipoff.split(" · ")[0]}</p>
                        {game.tipoff.split(" · ")[1] && (
                          <p className="text-xs text-slate-400">{game.tipoff.split(" · ")[1]}</p>
                        )}
                      </div>
                      
                      {/* Teams Section - Horizontal on desktop, vertical on mobile */}
                      <div className="flex flex-col gap-2 flex-1 md:flex-row md:items-center md:justify-center md:gap-4">
                        {/* Away Team */}
                        <div className="flex items-center gap-2 md:flex-1 md:justify-end">
                          {game.awayTeamLogo && (
                            <Image
                              src={game.awayTeamLogo}
                              alt={game.away.team}
                              width={28}
                              height={28}
                              className="h-7 w-7 rounded-full border border-white/10 object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex items-baseline gap-2 min-w-0 flex-1 md:flex-initial">
                            <span className="text-sm font-medium text-white truncate">{game.away.team}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">({game.away.record})</span>
                          </div>
                        </div>
                        
                        {/* VS Divider - hidden on mobile, shown on desktop */}
                        <span className="hidden md:inline text-xs uppercase tracking-wider text-slate-500 flex-shrink-0">vs</span>
                        
                        {/* Home Team */}
                        <div className="flex items-center gap-2 md:flex-1">
                          {game.homeTeamLogo && (
                            <Image
                              src={game.homeTeamLogo}
                              alt={game.home.team}
                              width={28}
                              height={28}
                              className="h-7 w-7 rounded-full border border-white/10 object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex items-baseline gap-2 min-w-0 flex-1 md:flex-initial">
                            <span className="text-sm font-medium text-white truncate">{game.home.team}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">({game.home.record})</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Venue & Gender */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 md:flex-col md:items-end md:border-t-0 md:pt-0 md:min-w-[100px] md:flex-shrink-0">
                        <span className="text-xs text-slate-300 truncate">{game.venue}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          {game.gender === "men" ? "MEN'S" : game.gender === "women" ? "WOMEN'S" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Final Buzzer Section */}
        <section id="final-buzzer" className="space-y-8">
          <SectionHeader
            id="final-buzzer"
            eyebrow="GAMES"
            title="Final Buzzer"
          />
          <div className="space-y-4">
            {completedGames.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-12 text-center">
                <p className="text-lg text-slate-400">No completed games yet.</p>
                <p className="mt-2 text-sm text-slate-500">Check back after games are finished!</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {completedGames.map((game) => {
                  const homeWon = game.winnerTeamId === game.homeTeamId;
                  const awayWon = game.winnerTeamId === game.awayTeamId;
                  const homeScore = homeWon ? game.winnerScore : game.loserScore;
                  const awayScore = awayWon ? game.winnerScore : game.loserScore;
                  
                  return (
                    <Link
                      key={game.id}
                      href={`/game/${game.id}`}
                      className="block rounded-2xl border border-white/5 bg-slate-900/70 p-3 sm:p-4 overflow-hidden transition-all hover:border-orange-500 hover:bg-slate-900/80 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <span className="rounded-full border border-white/15 px-1.5 py-0.5 sm:px-2 text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                          FINAL
                        </span>
                        <div className="text-right">
                          <p className="text-[10px] sm:text-xs text-slate-400">
                            {game.dateObj ? new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                            }).format(game.dateObj) : ""}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 sm:space-y-2">
                        {/* Away Team */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                            {game.awayTeamLogo && (
                              <Image
                                src={game.awayTeamLogo}
                                alt={game.awayTeamName || "Away team"}
                                width={32}
                                height={32}
                                className="h-5 w-5 sm:h-8 sm:w-8 rounded-full border border-white/10 bg-white/5 object-cover flex-shrink-0"
                              />
                            )}
                            <span className={`text-[11px] sm:text-sm font-medium truncate ${
                              awayWon ? "text-white" : "text-slate-400"
                            }`}>
                              {game.awayTeamName || "Away"}
                            </span>
                          </div>
                          <span className={`text-base sm:text-xl font-bold ${
                            awayWon ? "text-white" : "text-slate-500"
                          }`}>
                            {awayScore ?? 0}
                          </span>
                        </div>
                        
                        {/* Home Team */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                            {game.homeTeamLogo && (
                              <Image
                                src={game.homeTeamLogo}
                                alt={game.homeTeamName || "Home team"}
                                width={32}
                                height={32}
                                className="h-5 w-5 sm:h-8 sm:w-8 rounded-full border border-white/10 bg-white/5 object-cover flex-shrink-0"
                              />
                            )}
                            <span className={`text-[11px] sm:text-sm font-medium truncate ${
                              homeWon ? "text-white" : "text-slate-400"
                            }`}>
                              {game.homeTeamName || "Home"}
                            </span>
                          </div>
                          <span className={`text-base sm:text-xl font-bold ${
                            homeWon ? "text-white" : "text-slate-500"
                          }`}>
                            {homeScore ?? 0}
                          </span>
                        </div>
                      </div>
                      
                      {/* Venue and Gender */}
                      <div className="mt-2 pt-2 sm:mt-3 sm:pt-3 border-t border-white/5 flex items-center justify-between text-[10px] sm:text-xs">
                        <span className="text-slate-400 truncate">{game.venue || ""}</span>
                        <span className="text-slate-500 uppercase tracking-wider ml-2">{game.gender === "men" ? "MEN'S" : game.gender === "women" ? "WOMEN'S" : ""}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section id="players" className="space-y-8">
          <SectionHeader
            id="players"
            eyebrow={sectionCopy.players.eyebrow}
            title={sectionCopy.players.title}
          />
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">League Leaderboard</p>
              <div className="flex flex-wrap gap-2">
                {playerMetricFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setPlayerMetric(filter.key)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition ${
                      playerMetric === filter.key
                        ? "border-white text-white"
                        : "border-white/30 text-slate-400 hover:border-white/60 hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {[...leagueTopPlayers]
                .sort((a, b) => {
                  const statA = playerMetric === "pts" ? a.stats.pts
                    : playerMetric === "reb" ? a.stats.reb
                    : playerMetric === "ast" ? a.stats.ast
                    : playerMetric === "blk" ? a.stats.blk
                    : a.stats.stl;
                  const statB = playerMetric === "pts" ? b.stats.pts
                    : playerMetric === "reb" ? b.stats.reb
                    : playerMetric === "ast" ? b.stats.ast
                    : playerMetric === "blk" ? b.stats.blk
                    : b.stats.stl;
                  return statB - statA;
                })
                .slice(0, leagueLeadersExpanded ? 10 : 3)
                .map((player, index) => {
                const isLeader = index === 0;
                const playerName = `${player.firstName} ${player.lastName}`.trim();
                const playerImage = player.headshot || player.teamLogo || "/logos/liprobakin.png";
                const statValue = playerMetric === "pts" ? player.stats.pts
                  : playerMetric === "reb" ? player.stats.reb
                  : playerMetric === "ast" ? player.stats.ast
                  : playerMetric === "blk" ? player.stats.blk
                  : player.stats.stl;
                return (
                  <button
                    key={`${player.id}-${playerMetric}`}
                    type="button"
                    onClick={() => {}}
                    className={`flex w-full flex-col gap-3 rounded-3xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:flex-row sm:items-center sm:justify-between overflow-hidden ${
                      isLeader
                        ? "border-white/40 bg-gradient-to-r from-sky-500/20 to-indigo-500/10 px-7 py-5 shadow-lg shadow-sky-500/20"
                        : "border-white/10 bg-slate-900/60 px-5 py-3 hover:border-white/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`font-semibold flex-shrink-0 ${isLeader ? "text-base text-white" : "text-sm text-slate-400"}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Image
                          src={playerImage}
                          alt={`${player.name} portrait`}
                          width={isLeader ? 61 : 48}
                          height={isLeader ? 61 : 48}
                          className="rounded-full border border-white/10 object-cover flex-shrink-0"
                          style={{
                            width: isLeader ? 61 : 48,
                            height: isLeader ? 61 : 48,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 truncate">
                            #{player.number} · {player.teamName}
                          </p>
                          <p className={`${isLeader ? "text-xl" : "text-base"} font-semibold text-white truncate`}>
                            {playerName}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:gap-3 flex-shrink-0">
                      <div className="text-center min-w-[40px]">
                        <p className="text-xs text-slate-400">PTS</p>
                        <p className={`${isLeader ? "text-xl" : "text-base"} font-bold text-white`}>{player.stats.pts}</p>
                      </div>
                      <div className="text-center min-w-[40px]">
                        <p className="text-xs text-slate-400">REB</p>
                        <p className={`${isLeader ? "text-xl" : "text-base"} font-bold text-white`}>{player.stats.reb}</p>
                      </div>
                      <div className="text-center min-w-[40px]">
                        <p className="text-xs text-slate-400">AST</p>
                        <p className={`${isLeader ? "text-xl" : "text-base"} font-bold text-white`}>{player.stats.ast}</p>
                      </div>
                      <div className="text-center min-w-[40px]">
                        <p className="text-xs text-slate-400">BLK</p>
                        <p className={`${isLeader ? "text-xl" : "text-base"} font-bold text-white`}>{player.stats.blk}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {leagueTopPlayers.length > 3 && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setLeagueLeadersExpanded(!leagueLeadersExpanded)}
                  className="rounded-full border border-white/30 bg-white/5 px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white hover:bg-white/10"
                >
                  {leagueLeadersExpanded ? "Show Less" : "Show Top 10"}
                </button>
              </div>
            )}
          </div>
        </section>

        <section id="standings" className="space-y-8">
          <SectionHeader
            id="standings"
            eyebrow={sectionCopy.standings.eyebrow}
            title={sectionCopy.standings.title}
          />
          <div className="overflow-hidden rounded-2xl border border-white/5">
            <div className="max-sm:overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-[0.3em] text-slate-300 border-b border-white/5">
                <tr>
                  <th className="px-3 py-2">Seed</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">W</th>
                  <th className="px-3 py-2">L</th>
                  <th className="px-3 py-2">Tot Points</th>
                </tr>
              </thead>
              <tbody>
                {genderStandings.map((row, index) => (
                  <tr key={row.team} className="odd:bg-white/5 hover:bg-orange-500/10 cursor-pointer transition-colors">
                    <td className="px-3 py-2 text-slate-300">
                      <Link 
                        href={`/team/${encodeURIComponent(row.team)}`}
                        className="block"
                      >
                        {row.seed}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      <Link 
                        href={`/team/${encodeURIComponent(row.team)}`}
                        className="block text-white group-hover:text-orange-500 transition-colors"
                      >
                        {row.team}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link 
                        href={`/team/${encodeURIComponent(row.team)}`}
                        className="block"
                      >
                        {row.wins}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link 
                        href={`/team/${encodeURIComponent(row.team)}`}
                        className="block"
                      >
                        {row.losses}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-semibold text-white">
                      <Link 
                        href={`/team/${encodeURIComponent(row.team)}`}
                        className="block"
                      >
                        {row.totalPoints || getTotalPoints(row.wins, row.losses)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        <section id="teams" className="space-y-8">
          <SectionHeader
            id="teams"
            eyebrow={sectionCopy.teams.eyebrow}
            title={sectionCopy.teams.title}
          />
          <div className="relative">
            <div 
              className="overflow-x-auto overflow-y-hidden pb-4" 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="grid grid-flow-col grid-rows-2 auto-cols-[minmax(202px,1fr)] gap-3 pb-2 sm:auto-cols-[minmax(230px,1fr)] lg:auto-cols-[minmax(274px,1fr)]">
                {genderFranchises.map((team) => {
                  const fullName = [team.city, team.name].filter(Boolean).join(" ").trim();
                  return (
                    <Link
                      key={fullName}
                      href={`/team/${encodeURIComponent(fullName)}`}
                      className="rounded-2xl border border-white/5 bg-slate-900/70 p-5 text-left transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      style={{
                        backgroundImage: `linear-gradient(120deg, ${team.colors[0]}22, ${team.colors[1]}11)`
                      }}
                    >
                      {team.logo ? (
                        <div className="mb-3 flex items-center gap-2.5">
                          <Image
                            src={team.logo}
                            alt={`${fullName} logo`}
                            width={45}
                            height={45}
                            className="h-11 w-11 rounded-full border-2 border-white/20 object-cover"
                          />
                          <p className="text-lg font-semibold text-white">{fullName}</p>
                        </div>
                      ) : (
                        <p className="text-lg font-semibold text-white">{fullName}</p>
                      )}
                      <div className="mt-4 flex gap-2">
                        {team.colors.map((color) => (
                          <span
                            key={`${fullName}-${color}`}
                            className="h-2 flex-1 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                const container = e.currentTarget.parentElement?.querySelector('.overflow-x-auto');
                if (container) container.scrollBy({ left: -400, behavior: 'smooth' });
              }}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg transition hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              aria-label="Scroll left"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                const container = e.currentTarget.parentElement?.querySelector('.overflow-x-auto');
                if (container) container.scrollBy({ left: 400, behavior: 'smooth' });
              }}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg transition hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              aria-label="Scroll right"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </section>

        {/* Partners and Committee Sections */}
        <div className="grid gap-4 grid-cols-2">
          {/* Partners Section */}
          <section className="space-y-3">
            <SectionHeader
              id="partners"
              eyebrow={sectionCopy.partners.eyebrow}
              title={sectionCopy.partners.title}
              description={sectionCopy.partners.description}
            />
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 p-4 md:p-8">
              {dynamicPartners.length > 0 ? (
                <div className="flex h-full items-center justify-center">
                  {dynamicPartners[currentPartnerIndex].logo ? (
                    <Image
                      src={dynamicPartners[currentPartnerIndex].logo}
                      alt={dynamicPartners[currentPartnerIndex].name}
                      width={400}
                      height={300}
                      className="h-auto max-h-full w-auto max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <p className="text-sm md:text-2xl font-semibold text-white">
                        {dynamicPartners[currentPartnerIndex].name}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p className="text-xs md:text-base">No partners yet</p>
                </div>
              )}
              {dynamicPartners.length > 1 && (
                <div className="absolute bottom-2 md:bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 md:gap-2">
                  {dynamicPartners.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPartnerIndex(index)}
                      className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full transition ${
                        index === currentPartnerIndex
                          ? "bg-orange-500"
                          : "bg-white/30 hover:bg-white/50"
                      }`}
                      aria-label={`Go to partner ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Committee Section */}
          <section className="space-y-3">
            <SectionHeader
              id="committee"
              eyebrow={sectionCopy.committee.eyebrow}
              title={sectionCopy.committee.title}
              description={sectionCopy.committee.description}
            />
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
              {dynamicCommittee.length > 0 ? (
                <div className="relative h-full">
                  {dynamicCommittee[currentCommitteeIndex].photo ? (
                    <Image
                      src={dynamicCommittee[currentCommitteeIndex].photo}
                      alt={dynamicCommittee[currentCommitteeIndex].name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-900/20 to-slate-900">
                      <div className="flex h-16 w-16 md:h-32 md:w-32 items-center justify-center rounded-full bg-orange-600 text-2xl md:text-5xl font-bold text-white">
                        {dynamicCommittee[currentCommitteeIndex].name.charAt(0)}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 md:p-6">
                    <p className="text-sm md:text-xl font-semibold text-white truncate">
                      {dynamicCommittee[currentCommitteeIndex].name}
                    </p>
                    <p className="text-xs md:text-sm text-orange-400 truncate">
                      {dynamicCommittee[currentCommitteeIndex].role}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p className="text-xs md:text-base">No committee members yet</p>
                </div>
              )}
              {dynamicCommittee.length > 1 && (
                <div className="absolute bottom-2 md:bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 md:gap-2">
                  {dynamicCommittee.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentCommitteeIndex(index)}
                      className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full transition ${
                        index === currentCommitteeIndex
                          ? "bg-orange-500"
                          : "bg-white/30 hover:bg-white/50"
                      }`}
                      aria-label={`Go to committee member ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-black/50 py-8 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-center text-xs uppercase tracking-[0.3em] sm:flex-row sm:items-center sm:justify-between">
          <p>
            {copy.footerTagline}
          </p>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{copy.languageLabel}</span>
              <div className="flex gap-2">
                {languageOptions.map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setLanguage(locale)}
                    className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] ${
                      language === locale ? "border-white text-white" : "border-white/30 text-slate-400"
                    }`}
                  >
                    {locale.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <Link
              href="/admin"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/5 transition hover:border-white hover:bg-white/10"
              aria-label="Admin Login"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          </div>
        </div>
      </footer>
      {selectedTeam && selectedRoster ? (
        <RosterModal teamName={selectedTeam.label} roster={selectedRoster} onClose={() => setSelectedTeam(null)} allFranchises={allFranchises} />
      ) : null}
      {selectedPlayer ? (
        <PlayerStatsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      ) : null}
    </div>
  );
}
