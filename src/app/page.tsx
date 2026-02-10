"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, query, orderBy, limit, getDocs, onSnapshot, where } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import AuthModal from "@/components/AuthModal";
import PlayerProfilePopup from "@/components/PlayerProfilePopup";
import AnimatedButton from "@/components/AnimatedButton";
import ArticleContent from "@/components/ArticleContent";
import MentionedEntities from "@/components/MentionedEntities";
import html2canvas from "html2canvas";

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
  homeTeam?: string;
  awayTeam?: string;
  gender?: "men" | "women";
  refereeHomeTeam1?: string;
  refereeHomeTeam2?: string;
  refereeAwayTeam?: string;
  dateTime?: string;
};

type NewsArticle = {
  id: string;
  title: string; // French (base/default)
  title_en?: string; // English translation
  summary: string; // French (base/default)
  summary_en?: string; // English translation
  category: string;
  headline: string; // French (base/default)
  headline_en?: string; // English translation
  imageUrl?: string;
  imagePosition?: number;
  createdAt: Date | null;
  author?: string; // Author name
};

type SectionHeaderProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

const SectionHeader = ({ id, eyebrow, title, description, actions }: SectionHeaderProps) => (
  <div aria-labelledby={`${id}-title`} className={actions ? "space-y-0" : "space-y-4"}>
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

const formatISODate = (isoString: string, language: Locale): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    const month = date.getMonth() + 1;
    const day = date.getDate();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    if (language === 'en') {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${month}/${day} · ${hours}:${minutes} ${period}`;
    } else {
      return `${day}/${month} · ${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  } catch {
    return isoString;
  }
};

const formatGameDateTime = (dateTimeStr: string, language: Locale): string => {
  // First check if it's an ISO string (starts with year)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateTimeStr)) {
    return formatISODate(dateTimeStr, language);
  }
  
  // Parse the datetime string - handle both "·" and other separators
  const parts = dateTimeStr.split(/\s*[·•]\s*/);
  if (parts.length < 2) return dateTimeStr;
  
  const datePart = parts[0]; // e.g., "Dec 13" or "déc. 13"
  let timePart = parts[1]; // e.g., "3:45 PM" or "15:45"
  
  // Convert month to number
  const monthMap: {[key: string]: string} = {
    'Jan': '1', 'Feb': '2', 'Mar': '3', 'Apr': '4',
    'May': '5', 'Jun': '6', 'Jul': '7', 'Aug': '8',
    'Sep': '9', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    'jan': '1', 'fév': '2', 'mar': '3', 'avr': '4',
    'mai': '5', 'juin': '6', 'juil': '7', 'août': '8',
    'sep': '9', 'oct': '10', 'nov': '11', 'déc': '12',
    'janv': '1', 'févr': '2', 'mars': '3', 'sept': '9'
  };
  
  const dateMatch = datePart.match(/([A-Za-zé\.]+)\s+(\d+)/);
  if (!dateMatch) return dateTimeStr;
  
  const monthKey = dateMatch[1].toLowerCase().replace(/\./g, '');
  const month = monthMap[monthKey] || monthMap[dateMatch[1]] || dateMatch[1];
  const day = dateMatch[2];
  
  // Convert time to 24-hour for French
  let formattedTime = timePart.trim();
  if (language === 'fr') {
    // Check if time has AM/PM
    const timeMatchAMPM = formattedTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (timeMatchAMPM) {
      let hours = parseInt(timeMatchAMPM[1]);
      const minutes = timeMatchAMPM[2];
      const period = timeMatchAMPM[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    // If time is like "15 h 45", convert to "15:45"
    const timeMatchHFormat = formattedTime.match(/(\d+)\s*h\s*(\d+)/);
    if (timeMatchHFormat) {
      formattedTime = `${timeMatchHFormat[1].padStart(2, '0')}:${timeMatchHFormat[2]}`;
    }
  }
  
  // Format date based on language
  const dateStr = language === 'fr' 
    ? `${day}/${month}` // French: day/month (25/12)
    : `${month}/${day}`; // English: month/day (12/25)
  
  return `${dateStr}, ${formattedTime}`;
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
    standingsTable: {
      seed: "Seed",
      team: "Team",
      wins: "W",
      losses: "L",
      totalPoints: "Tot Points",
    },
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
        title: "Match terminé",
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
        eyebrow: "Franchises",
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
    standingsTable: {
      seed: "N°",
      team: "Équipe",
      wins: "V",
      losses: "D",
      totalPoints: "Pts totaux",
    },
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
type Language = Locale; // Alias for clarity
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
  const headshot = leader.headshot || playerHeadshots[leader.player];
  const initials = leader.player
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName = leader.player.trim().split(" ").pop() ?? leader.player;
  
  // Determine the link URL - prioritize player page if number is available
  const playerNumber = 'number' in leader ? leader.number : null;
  const linkUrl = playerNumber 
    ? `/player/${encodeURIComponent(leader.team)}/${playerNumber}`
    : `/team/${encodeURIComponent(leader.team)}`;

  return (           
    <Link 
      href={linkUrl}
      className="flex items-center justify-between gap-2 min-w-0 group transition-all hover:bg-white/5 rounded-lg p-1.5 -m-1.5"
    >
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        {headshot ? (
          <Image
            src={headshot}
            alt={`${leader.player} portrait`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full border border-white/20 object-cover flex-shrink-0 group-hover:border-blue-400 transition-colors"
          />
        ) : franchise?.logo ? (
          <Image
            src={franchise.logo}
            alt={`${formatFranchiseName(franchise)} logo`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full border border-white/20 bg-white/5 object-cover flex-shrink-0 group-hover:border-blue-400 transition-colors"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold flex-shrink-0 group-hover:bg-white/20 transition-colors">
            {initials}
          </span>
        )}
        <div className="min-w-0 overflow-hidden">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 truncate group-hover:text-blue-400 transition-colors">{leader.team}</p>
          <p className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">{displayName}</p>
          <p className="text-[10px] text-slate-400 truncate">{leader.stats}</p>
        </div>
      </div>
    </Link>
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
    <Link href={`/team/${encodeURIComponent(displayName)}`} className="flex flex-col items-center gap-1 md:gap-2 text-center min-w-0 transition hover:opacity-80">
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
        <p className="text-xs md:text-base font-semibold text-white truncate">{displayName}</p>
        <p className="text-[8px] md:text-[10px] text-slate-400">{record}</p>
      </div>
    </Link>
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

const GenderToggle = ({ value, onChange, language }: { value: Gender; onChange: (value: Gender) => void; language: Language }) => (
  <div className="inline-flex overflow-hidden rounded-full border border-white/20 bg-white/5 text-[11px] font-semibold uppercase tracking-[0.25em]" role="group" aria-label="Gender filter">
    {(
      [
        { key: "men" as Gender, label: language === 'fr' ? "Messieur" : "Gentlemen", short: "G" },
        { key: "women" as Gender, label: language === 'fr' ? "Dames" : "Ladies", short: "L" },
      ]
    ).map((option) => {
      const isActive = value === option.key;
      return (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`relative px-3 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:px-6 sm:py-2 ${
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

  const RosterModal = ({ teamName, onClose, allFranchises }: { teamName: string; onClose: () => void; allFranchises: Franchise[] }) => {
    const franchise = findFranchiseByName(teamName, allFranchises);
    const [roster, setRoster] = useState<RosterPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      const fetchRoster = async () => {
        try {
          setLoading(true);
          
          // Find the team in Firestore
          const teamsRef = collection(firebaseDB, "teams");
          const teamsSnapshot = await getDocs(teamsRef);
          
          let targetTeamId: string | null = null;
          
          for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();
            const teamDocName = teamData.name ?? "";
            const teamDocCity = teamData.city ?? "";
            const fullTeamName = teamDocCity ? `${teamDocCity} ${teamDocName}` : teamDocName;
            
            if (fullTeamName === teamName || teamDocName === teamName) {
              targetTeamId = teamDoc.id;
              break;
            }
          }
          
          if (!targetTeamId) {
            console.log("Team not found in Firestore:", teamName);
            setRoster([]);
            setLoading(false);
            return;
          }
          
          // Fetch roster from Firestore
          const rosterRef = collection(firebaseDB, `teams/${targetTeamId}/roster`);
          const rosterSnapshot = await getDocs(rosterRef);
          
          const players: RosterPlayer[] = rosterSnapshot.docs.map((playerDoc) => {
            const playerData = playerDoc.data();
            return {
              name: `${playerData.firstName || ""} ${playerData.lastName || ""}`.trim(),
              number: playerData.number ?? 0,
              height: playerData.height ?? "",
              headshot: playerData.headshot ?? "/players/default-avatar.png",
              position: playerData.position ?? "",
              stats: {
                pts: playerData.stats?.pts ?? "0.0",
                reb: playerData.stats?.reb ?? "0.0",
                ast: playerData.stats?.ast ?? "0.0",
                blk: playerData.stats?.blk ?? "0.0",
                stl: playerData.stats?.stl ?? "0.0"
              }
            };
          }).sort((a, b) => a.number - b.number);
          
          setRoster(players);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching roster:", error);
          setRoster([]);
          setLoading(false);
        }
      };
      
      fetchRoster();
    }, [teamName]);
    
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
          {loading ? (
            <div className="flex justify-center py-12 text-slate-400">Loading roster...</div>
          ) : roster.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No players registered for this team yet.</div>
          ) : (
            roster.map((player) => (
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
            ))
          )}
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

// Fan Favorite Player Card Component
const FanFavoritePlayerCard = ({ playerId, teamId }: { playerId: string; teamId?: string }) => {
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!playerId || !teamId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const rosterRef = collection(firebaseDB, "teams", teamId, "roster");
        const rosterSnapshot = await getDocs(rosterRef);
        
        const player = rosterSnapshot.docs.find(doc => doc.id === playerId);
        if (player) {
          const data = player.data();
          setPlayerData({
            name: data.name || `${data.firstName} ${data.lastName}`,
            number: data.number,
            position: data.position,
            height: data.height,
            photo: data.headshot || data.photo || "/players/default.svg",
            stats: data.stats || {},
          });
        }
      } catch (error) {
        console.error("Error fetching player data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [playerId, teamId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="flex justify-center items-center p-12 text-slate-400">
        {language === 'fr' ? 'Joueur non trouvé' : 'Player not found'}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-6">
        {/* Player Photo */}
        <div className="relative h-32 w-32 flex-shrink-0 rounded-full overflow-hidden border-4 border-orange-400/30 shadow-2xl">
          <Image
            src={playerData.photo}
            alt={playerData.name}
            fill
            className="object-cover"
            onError={(e) => {
              e.currentTarget.src = "/players/default.svg";
            }}
          />
        </div>

        {/* Player Info */}
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.4em] text-orange-400 mb-1">
            {language === 'fr' ? 'Votre Joueur Favori' : 'Your Favorite Player'}
          </p>
          <h3 className="text-3xl font-bold text-white mb-2">
            {playerData.number && `#${playerData.number} · `}{playerData.name}
          </h3>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            {playerData.position && (
              <span className="px-3 py-1 rounded-full border border-white/20 bg-white/5">
                {playerData.position}
              </span>
            )}
            {playerData.height && (
              <span className="px-3 py-1 rounded-full border border-white/20 bg-white/5">
                {playerData.height}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player Stats */}
      {playerData.stats && Object.keys(playerData.stats).length > 0 && (
        <div className="mt-6 grid grid-cols-3 md:grid-cols-5 gap-4">
          {Object.entries(playerData.stats).map(([key, value]) => (
            <div key={key} className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs uppercase text-slate-400 mb-1">{key}</p>
              <p className="text-2xl font-bold text-white">{String(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Fan Favorite Team Card Component  
const FanFavoriteTeamCard = ({ teamId, teamName }: { teamId?: string; teamName?: string }) => {
  const [teamData, setTeamData] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!teamId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch team info
        const teamDoc = await getDocs(query(collection(firebaseDB, "teams"), where("__name__", "==", teamId)));
        if (!teamDoc.empty) {
          setTeamData(teamDoc.docs[0].data());
        }

        // Fetch roster
        const rosterRef = collection(firebaseDB, "teams", teamId, "roster");
        const rosterSnapshot = await getDocs(rosterRef);
        const players = rosterSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).slice(0, 5); // Show top 5 players
        setRoster(players);
      } catch (error) {
        console.error("Error fetching team data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-6 mb-6">
        {teamData?.logo && (
          <div className="relative h-24 w-24 flex-shrink-0">
            <Image
              src={teamData.logo}
              alt={teamName || 'Team logo'}
              fill
              className="object-contain"
            />
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-green-400 mb-1">
            {language === 'fr' ? 'Votre Équipe Favorite' : 'Your Favorite Team'}
          </p>
          <h3 className="text-3xl font-bold text-white">{teamName}</h3>
        </div>
      </div>

      {/* Roster Preview */}
      {roster.length > 0 && (
        <div>
          <h4 className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-3">
            {language === 'fr' ? 'Effectif' : 'Roster'}
          </h4>
          <div className="grid gap-3">
            {roster.map((player) => (
              <Link
                key={player.id}
                href={`/player/${encodeURIComponent(teamName || '')}/${player.number}`}
                className="flex items-center gap-4 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
              >
                {player.headshot && (
                  <div className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-white/20">
                    <Image
                      src={player.headshot}
                      alt={player.name || `${player.firstName} ${player.lastName}`}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/players/default.svg";
                      }}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-white">
                    #{player.number} {player.name || `${player.firstName} ${player.lastName}`}
                  </p>
                  {player.position && (
                    <p className="text-xs text-slate-400">{player.position}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const { user, userProfile, isAdmin, signOut: handleSignOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  
  console.log('Current language:', language);
  
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeamState>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<SpotlightPlayer | null>(null);
  const [playerMetric, setPlayerMetric] = useState<PlayerMetric>("pts");
  const [gender, setGender] = useState<Gender>("men");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
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
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isArticleChanging, setIsArticleChanging] = useState(false);
  const [dynamicStandings, setDynamicStandings] = useState<any[]>([]);
  const [currentPartnerIndex, setCurrentPartnerIndex] = useState(0);
  const [currentCommitteeIndex, setCurrentCommitteeIndex] = useState(0);
  const [dynamicPartners, setDynamicPartners] = useState<any[]>([]);
  const [visiblePartners, setVisiblePartners] = useState<number[]>([0, 1, 2, 3]);
  const [partnerAnimating, setPartnerAnimating] = useState<number | null>(null);
  const [dynamicCommittee, setDynamicCommittee] = useState<any[]>([]);
  const [playerCardExpanded, setPlayerCardExpanded] = useState(true);
  const [playerData, setPlayerData] = useState<RosterPlayer | null>(null);
  const [nextGame, setNextGame] = useState<EnhancedMatchup | null>(null);
  const [gameCountdown, setGameCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; isGameDay: boolean } | null>(null);
  const [liveGames, setLiveGames] = useState<EnhancedMatchup[]>([]);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [scheduleStartIndex, setScheduleStartIndex] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date | null>(null);
  const [allScheduledGames, setAllScheduledGames] = useState<EnhancedMatchup[]>([]);
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const teamsScrollRef = useRef<HTMLDivElement>(null);
  
  // Fan favorites state
  const [showFavoritePlayer, setShowFavoritePlayer] = useState(false);
  const [showMenTeamFavorite, setShowMenTeamFavorite] = useState(false);
  const [showWomenTeamFavorite, setShowWomenTeamFavorite] = useState(false);
  
  const copy = translations[language];
  const sectionCopy = copy.sections;
  const languageOptions: Locale[] = ["en", "fr"];
  const mobileNavSections: Array<(typeof navSections)[number]> = [
    "Schedule",
    "Players",
    "Standings",
    "Teams",
  ];
  const [standingsGender, setStandingsGender] = useState<Gender>("men");
  const [franchiseGender, setFranchiseGender] = useState<Gender>("men");
  const [playersGender, setPlayersGender] = useState<Gender>("men");
  const [teamSearch, setTeamSearch] = useState<string>("");

  // Share player card using native share API
  const sharePlayerCard = useCallback(async (platform: 'ig' | 'fb') => {
    if (!playerData) {
      console.error('No player data available');
      alert('No player data available');
      return;
    }
    
    // Create canvas for the share image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    
    // Set dimensions (IG story or FB post)
    canvas.width = platform === 'ig' ? 1080 : 1200;
    canvas.height = platform === 'ig' ? 1920 : 630;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add accent circles
    ctx.beginPath();
    ctx.arc(100, 100, 200, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(canvas.width - 100, canvas.height - 100, 200, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
    ctx.fill();
    
    // Load player image with fallback
    const loadImage = (src: string): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.warn('Failed to load image:', src);
          resolve(null);
        };
        img.src = src;
      });
    };
    
    try {
      // Try to load player image, use null if fails
      const playerImg = await loadImage(playerData.headshot || '/players/placeholder.jpg');
      
      if (platform === 'ig') {
        // Instagram Story Layout
        // Logo
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 48px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('LIPROBAKIN', canvas.width / 2, 120);
        
        // Player photo (circular)
        const photoSize = 400;
        const photoX = (canvas.width - photoSize) / 2;
        const photoY = 250;
        
        // Draw photo placeholder or actual image
        if (playerImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(playerImg, photoX, photoY, photoSize, photoSize);
          ctx.restore();
        } else {
          // Draw placeholder circle
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
          ctx.fill();
          // Draw initials
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 120px system-ui';
          const initials = playerData.name.split(' ').map(n => n[0]).join('').slice(0, 2);
          ctx.fillText(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 40);
        }
        
        // Photo border
        ctx.beginPath();
        ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 16;
        ctx.stroke();
        
        // Jersey number badge
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 80, photoY + photoSize - 30, 160, 80, 20);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px system-ui';
        ctx.fillText(`#${playerData.number || '00'}`, canvas.width / 2, photoY + photoSize + 30);
        
        // Player name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 72px system-ui';
        ctx.fillText(playerData.name, canvas.width / 2, photoY + photoSize + 160);
        
        // Team
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 36px system-ui';
        ctx.fillText(userProfile?.teamName || 'FEBACO', canvas.width / 2, photoY + photoSize + 220);
        
        // Stats
        const stats = [
          { label: 'PTS', value: playerData.stats?.pts || '0' },
          { label: 'REB', value: playerData.stats?.reb || '0' },
          { label: 'AST', value: playerData.stats?.ast || '0' },
        ];
        const statY = photoY + photoSize + 320;
        const statWidth = 280;
        const startX = (canvas.width - statWidth * 3) / 2;
        
        stats.forEach((stat, i) => {
          const x = startX + i * statWidth + statWidth / 2;
          // Stat box
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.roundRect(startX + i * statWidth + 20, statY, statWidth - 40, 180, 20);
          ctx.fill();
          // Value
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 80px system-ui';
          ctx.fillText(Number(stat.value).toFixed(1), x, statY + 90);
          // Label
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 28px system-ui';
          ctx.fillText(stat.label, x, statY + 140);
        });
        
        // Website
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '28px system-ui';
        ctx.fillText('liprobakin.com', canvas.width / 2, canvas.height - 80);
      } else {
        // Facebook Layout (horizontal)
        const photoSize = 350;
        const photoX = 80;
        const photoY = (canvas.height - photoSize) / 2;
        
        // Player photo with fallback
        if (playerImg) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(photoX, photoY, photoSize, photoSize, 30);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(playerImg, photoX, photoY, photoSize, photoSize);
          ctx.restore();
        } else {
          // Placeholder
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.roundRect(photoX, photoY, photoSize, photoSize, 30);
          ctx.fill();
          // Draw initials
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 100px system-ui';
          ctx.textAlign = 'center';
          const initials = playerData.name.split(' ').map(n => n[0]).join('').slice(0, 2);
          ctx.fillText(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 35);
        }
        
        // Photo border
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(photoX, photoY, photoSize, photoSize, 30);
        ctx.stroke();
        
        // Jersey badge
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(photoX + photoSize - 60, photoY + photoSize - 60, 100, 60, 15);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`#${playerData.number || '00'}`, photoX + photoSize - 10, photoY + photoSize - 20);
        
        // Right side content
        const textX = photoX + photoSize + 80;
        ctx.textAlign = 'left';
        
        // Logo
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 32px system-ui';
        ctx.fillText('LIPROBAKIN', textX, photoY + 40);
        
        // Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px system-ui';
        ctx.fillText(playerData.name, textX, photoY + 110);
        
        // Team
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 28px system-ui';
        ctx.fillText(userProfile?.teamName || 'FEBACO', textX, photoY + 160);
        
        // Stats row
        const stats = [
          { label: 'PTS', value: playerData.stats?.pts || '0' },
          { label: 'REB', value: playerData.stats?.reb || '0' },
          { label: 'AST', value: playerData.stats?.ast || '0' },
          { label: 'STL', value: playerData.stats?.stl || '0' },
          { label: 'BLK', value: playerData.stats?.blk || '0' },
        ];
        const statStartY = photoY + 220;
        const statBoxWidth = 120;
        
        stats.forEach((stat, i) => {
          const x = textX + i * (statBoxWidth + 15);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.roundRect(x, statStartY, statBoxWidth, 100, 15);
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 40px system-ui';
          ctx.fillText(Number(stat.value).toFixed(1), x + statBoxWidth / 2, statStartY + 50);
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 18px system-ui';
          ctx.fillText(stat.label, x + statBoxWidth / 2, statStartY + 80);
        });
        
        // Website
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '24px system-ui';
        ctx.fillText('liprobakin.com', canvas.width - 40, canvas.height - 30);
      }
      
      // Convert to blob and share
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const fileName = `${playerData.name.replace(/\s+/g, '_')}_stats.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        
        // Try native share (works on mobile - opens share sheet where user can pick Instagram/Facebook)
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${playerData.name} - Stats`,
              text: platform === 'ig' 
                ? `Check out ${playerData.name}'s stats! 🏀 #Liprobakin #Basketball`
                : `Check out ${playerData.name}'s stats on Liprobakin! 🏀`,
            });
            return; // Share was successful
          } catch (err) {
            // User cancelled or error - fall through to download
            console.log('Share cancelled or failed, falling back to download');
          }
        }
        
        // Fallback: Download the image first
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Also copy to clipboard if supported (so user can paste)
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          console.log('Image copied to clipboard');
        } catch (clipErr) {
          console.log('Clipboard write not supported');
        }
        
        URL.revokeObjectURL(url);
        
        // Show instruction alert then open the platform
        if (platform === 'ig') {
          alert('📸 Image saved! Open Instagram Stories and select the image from your gallery.');
          // Try to open Instagram app, fallback to web
          setTimeout(() => {
            window.open('instagram://story-camera', '_blank');
            setTimeout(() => {
              window.open('https://www.instagram.com/stories/create/', '_blank');
            }, 1000);
          }, 300);
        } else {
          alert('📸 Image saved! Select it from your gallery when creating your Facebook Story.');
          // Open Facebook Stories directly
          setTimeout(() => {
            // Try mobile app deep link first
            const fbStoryUrl = 'fb://story_composer';
            const fbWebUrl = 'https://www.facebook.com/stories/create';
            
            // Try app first
            window.location.href = fbStoryUrl;
            
            // Fallback to web after short delay
            setTimeout(() => {
              window.open(fbWebUrl, '_blank');
            }, 1000);
          }, 300);
        }
        
      }, 'image/png');
      
    } catch (error) {
      console.error('Error creating share card:', error);
      alert('Failed to create share card. Please try again.');
    }
  }, [playerData, userProfile]);

  // Removed static roster - RosterModal now fetches from Firestore
  const genderPlayers = playersGender === "men" ? spotlightPlayers : spotlightPlayersWomen;
  // Always use dynamic standings calculated from games - no fallback to static data
  const genderStandings = dynamicStandings.filter((s) => s.gender === standingsGender);
  const genderFranchises = franchiseGender === "men" ? menTeams : womenTeams;
  const filteredFranchises = genderFranchises.filter(team => {
    const fullName = [team.city, team.name].filter(Boolean).join(" ").trim().toLowerCase();
    return fullName.includes(teamSearch.toLowerCase());
  });
  const allFranchises = [...menTeams, ...womenTeams];
  const playerLeaders = [...genderPlayers].sort(
    (a, b) => b.leaderboard[playerMetric] - a.leaderboard[playerMetric]
  );
  const spotlightGames = dynamicSpotlightGames;

  // Load gender selection from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('selectedGender');
      if (saved === 'men' || saved === 'women') {
        setGender(saved);
      }
    }
  }, []);

  // Save gender selection to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedGender', gender);
    }
  }, [gender]);

  // Teams section now static – no auto-scroll animations

  // Save scroll position before navigating away
  useEffect(() => {
    const saveScrollPosition = () => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('scrollPosition', window.scrollY.toString());
      }
    };

    window.addEventListener('beforeunload', saveScrollPosition);
    
    // Save on navigation
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href && !link.href.includes('#')) {
        saveScrollPosition();
      }
    };
    
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('beforeunload', saveScrollPosition);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // Restore scroll position on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPosition = sessionStorage.getItem('scrollPosition');
      if (savedPosition) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedPosition, 10));
          sessionStorage.removeItem('scrollPosition');
        }, 100);
      }
    }
  }, []);

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
    // Real-time listener for news articles
    const newsRef = collection(firebaseDB, "news");
    const newsQuery = query(newsRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(newsQuery, (snapshot) => {
      const articles: NewsArticle[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log('News article data:', { 
          id: doc.id, 
          title: data.title, 
          title_en: data.title_en,
          headline: data.headline,
          headline_en: data.headline_en,
          author: data.author
        });
        
        return {
          id: doc.id,
          title: data.title || "",
          title_en: data.title_en || "",
          summary: data.summary || "",
          summary_en: data.summary_en || "",
          category: data.category || "News",
          headline: data.headline || "",
          headline_en: data.headline_en || "",
          imageUrl: data.imageUrl,
          imagePosition: data.imagePosition ?? 50,
          createdAt: data.createdAt?.toDate() || null,
          author: data.author || "LIPROBAKIN Staff",
        };
      });
      
      console.log('✅ Total articles (real-time):', articles.length);
      console.log('📰 Articles:', articles.map(a => ({ id: a.id, title: a.title })));
      // Limit to last 5 published articles
      setNewsArticles(articles.slice(0, 5));
      
      if (articles.length > 0 && !featuredArticleId) {
        console.log('🎯 Setting featured article to:', articles[0].id);
        setFeaturedArticleId(articles[0].id);
      }
    }, (error) => {
      console.error("❌ Error fetching news:", error);
    });
    
    // Cleanup listener on unmount
    return () => unsubscribe();
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
    // Fetch player profile data from Firestore if user is a verified player
    // Using real-time listener for instant updates when player data changes
    if (!userProfile?.role || !userProfile?.verificationStatus || !userProfile?.teamName) {
      setPlayerData(null);
      setNextGame(null);
      return;
    }

    if (userProfile.role !== "player" || userProfile.verificationStatus !== "approved" || !userProfile.teamName) {
      setPlayerData(null);
      setNextGame(null);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setupRealTimeListener = async () => {
      try {
        // Find the team in Firestore
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        
        let targetTeamId: string | null = null;
        
        // Find the team document that matches the user's teamName
        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          const teamDocName = teamData.name ?? "";
          const teamDocCity = teamData.city ?? "";
          const fullTeamName = teamDocCity ? `${teamDocCity} ${teamDocName}` : teamDocName;
          
          if (fullTeamName === userProfile.teamName || teamDocName === userProfile.teamName) {
            targetTeamId = teamDoc.id;
            break;
          }
        }
        
        if (!targetTeamId) {
          console.log("Team not found in Firestore:", userProfile.teamName);
          setPlayerData(null);
          setNextGame(null);
          return;
        }
        
        // Set up real-time listener on the roster subcollection
        const rosterRef = collection(firebaseDB, `teams/${targetTeamId}/roster`);
        
        unsubscribe = onSnapshot(rosterRef, (rosterSnapshot) => {
          if (rosterSnapshot.empty) {
            console.log("No roster found for team:", userProfile.teamName);
            setPlayerData(null);
            setNextGame(null);
            return;
          }
          
          // Find the specific player by linkedPlayerId (preferred) or player number (fallback)
          let foundPlayer: RosterPlayer | null = null;
          
          // First try to find by linkedPlayerId (set during verification approval)
          if (userProfile.linkedPlayerId) {
            const playerDoc = rosterSnapshot.docs.find(doc => doc.id === userProfile.linkedPlayerId);
            if (playerDoc) {
              const pData = playerDoc.data();
              // Add cache-buster to headshot URL to force refresh
              const headshotUrl = pData.headshot 
                ? `${pData.headshot}${pData.headshot.includes('?') ? '&' : '?'}t=${Date.now()}`
                : "/players/default-avatar.png";
              foundPlayer = {
                name: `${pData.firstName || ""} ${pData.lastName || ""}`.trim(),
                number: pData.number ?? 0,
                height: pData.height ?? "",
                headshot: headshotUrl,
                position: pData.position ?? "",
                stats: {
                  pts: pData.stats?.pts ?? "0.0",
                  reb: pData.stats?.reb ?? "0.0",
                  ast: pData.stats?.ast ?? "0.0",
                  blk: pData.stats?.blk ?? "0.0",
                  stl: pData.stats?.stl ?? "0.0"
                }
              };
            }
          }
          
          // Fallback: find by player number if linkedPlayerId not available
          if (!foundPlayer && userProfile.playerNumber) {
            for (const playerDoc of rosterSnapshot.docs) {
              const pData = playerDoc.data();
              if (pData.number?.toString() === userProfile.playerNumber.toString()) {
                // Add cache-buster to headshot URL to force refresh
                const headshotUrl = pData.headshot 
                  ? `${pData.headshot}${pData.headshot.includes('?') ? '&' : '?'}t=${Date.now()}`
                  : "/players/default-avatar.png";
                foundPlayer = {
                  name: `${pData.firstName || ""} ${pData.lastName || ""}`.trim(),
                  number: pData.number ?? 0,
                  height: pData.height ?? "",
                  headshot: headshotUrl,
                  position: pData.position ?? "",
                  stats: {
                    pts: pData.stats?.pts ?? "0.0",
                    reb: pData.stats?.reb ?? "0.0",
                    ast: pData.stats?.ast ?? "0.0",
                    blk: pData.stats?.blk ?? "0.0",
                    stl: pData.stats?.stl ?? "0.0"
                  }
                };
                break;
              }
            }
          }
          
          if (foundPlayer) {
            setPlayerData(foundPlayer);
            
            // Find next game for this player's team
            const upcomingGames = dynamicSpotlightGames.filter(game => {
              if (!game.dateTime) return false;
              const now = new Date();
              const gameDate = new Date(game.dateTime);
              return gameDate > now && (game.homeTeam === userProfile.teamName || game.awayTeam === userProfile.teamName);
            }).sort((a, b) => {
              const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
              const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
              return dateA - dateB;
            });
            
            if (upcomingGames.length > 0) {
              setNextGame(upcomingGames[0]);
            } else {
              setNextGame(null);
            }
          } else {
            console.log("Player not found in team roster");
            setPlayerData(null);
            setNextGame(null);
          }
        }, (error) => {
          console.error("Error in roster listener:", error);
          setPlayerData(null);
          setNextGame(null);
        });
        
      } catch (error) {
        console.error("Error setting up player data listener:", error);
        setPlayerData(null);
        setNextGame(null);
      }
    };
    
    setupRealTimeListener();
    
    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userProfile, dynamicSpotlightGames]);

  // Countdown timer for next game
  useEffect(() => {
    if (!nextGame?.dateTime) {
      setGameCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const gameDate = new Date(nextGame.dateTime!);
      const now = new Date();
      const diff = gameDate.getTime() - now.getTime();

      if (diff <= 0) {
        setGameCountdown(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const isGameDay = days === 0;

      setGameCountdown({ days, hours, minutes, seconds, isGameDay });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextGame]);

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
        // First, fetch ALL teams to ensure they all show up in standings
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        
        const teamStats: Record<string, {
          wins: number;
          losses: number;
          totalPoints: number;
          teamName: string;
          gender: string;
        }> = {};
        
        // Initialize ALL teams with 0-0 records
        teamsSnapshot.docs.forEach((doc) => {
          const team = doc.data();
          const teamId = doc.id;
          const teamName = team.name || team.teamName || "";
          const teamGender = team.gender || "men";
          
          if (teamName) {
            teamStats[teamId] = {
              wins: 0,
              losses: 0,
              totalPoints: 0,
              teamName: teamName,
              gender: teamGender
            };
          }
        });
        
        console.log("All teams initialized:", Object.keys(teamStats).length);
        
        // Then fetch games and update records
        const gamesRef = collection(firebaseDB, "games");
        const gamesSnapshot = await getDocs(gamesRef);
        
        console.log("Total games found:", gamesSnapshot.size);
        
        gamesSnapshot.docs.forEach((doc) => {
          const game = doc.data();
          
          if (game.winnerTeamId && game.loserTeamId) {
            const homeTeam = game.homeTeamId;
            const awayTeam = game.awayTeamId;
            const winnerTeam = game.winnerTeamId;
            const winnerScore = game.winnerScore || 0;
            const loserScore = game.loserScore || 0;
            const homeTeamName = game.homeTeamName || "";
            const awayTeamName = game.awayTeamName || "";
            const gameGender = game.gender || "men";
            
            // Determine scores for home and away teams
            const homeScore = winnerTeam === homeTeam ? winnerScore : loserScore;
            const awayScore = winnerTeam === awayTeam ? winnerScore : loserScore;
            
            // Initialize home team if not already (fallback for teams not in teams collection)
            if (!teamStats[homeTeam] && homeTeamName) {
              teamStats[homeTeam] = {
                wins: 0,
                losses: 0,
                totalPoints: 0,
                teamName: homeTeamName,
                gender: gameGender
              };
            }
            
            // Initialize away team if not already (fallback)
            if (!teamStats[awayTeam] && awayTeamName) {
              teamStats[awayTeam] = {
                wins: 0,
                losses: 0,
                totalPoints: 0,
                teamName: awayTeamName,
                gender: gameGender
              };
            }
            
            // Update stats
            if (teamStats[homeTeam]) {
              teamStats[homeTeam].totalPoints += homeScore;
              if (winnerTeam === homeTeam) {
                teamStats[homeTeam].wins += 1;
              } else {
                teamStats[homeTeam].losses += 1;
              }
            }
            
            if (teamStats[awayTeam]) {
              teamStats[awayTeam].totalPoints += awayScore;
              if (winnerTeam === awayTeam) {
                teamStats[awayTeam].wins += 1;
              } else {
                teamStats[awayTeam].losses += 1;
              }
            }
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
        
        // Sort by wins (descending), then by total points (descending), then alphabetically
        standingsArray.sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
          return a.team.localeCompare(b.team);
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
        
        // Trigger fade out
        setIsArticleChanging(true);
        
        // Find current featured index
        const currentIndex = prev.findIndex(article => article.id === featuredArticleId);
        // Get next article (wrap around to start)
        const nextIndex = (currentIndex + 1) % prev.length;
        
        // Wait for fade out, then change article
        setTimeout(() => {
          setFeaturedArticleId(prev[nextIndex].id);
          // Fade back in
          setTimeout(() => setIsArticleChanging(false), 50);
        }, 300);
        
        return prev;
      });
    }, 15000); // 15 seconds
    
    return () => clearInterval(interval);
  }, [newsArticles, featuredArticleId, expandedArticleId]);

  // Auto-rotate partners - individual random rotation
  useEffect(() => {
    if (dynamicPartners.length <= 4) return;
    
    const interval = setInterval(() => {
      // Pick a random position (0-3) to replace
      const positionToReplace = Math.floor(Math.random() * 4);
      
      // Trigger animation
      setPartnerAnimating(positionToReplace);
      
      // After animation, replace with new partner
      setTimeout(() => {
        setVisiblePartners((prev) => {
          const newVisible = [...prev];
          // Find a partner not currently visible
          let newPartnerIndex;
          do {
            newPartnerIndex = Math.floor(Math.random() * dynamicPartners.length);
          } while (prev.includes(newPartnerIndex));
          
          newVisible[positionToReplace] = newPartnerIndex;
          return newVisible;
        });
        setPartnerAnimating(null);
      }, 300);
    }, 3000);
    
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

  // Auto-rotate news grid on mobile only every 15 seconds
  useEffect(() => {
    if (newsArticles.length <= 2) return;
    
    // Only rotate on mobile (< 640px)
    const checkMobile = () => window.innerWidth < 640;
    
    const interval = setInterval(() => {
      if (checkMobile()) {
        setNewsGridStartIndex((prev) => (prev + 1) % newsArticles.length);
      }
    }, 15000);
    
    return () => clearInterval(interval);
  }, [newsArticles]);

  // Touch handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);
    
    const touchDistance = touchStartX - touchEndX;
    const minSwipeDistance = 50; // Minimum distance for a swipe
    
    if (Math.abs(touchDistance) > minSwipeDistance) {
      const maxIndex = Math.ceil(newsArticles.length / 2) - 1;
      
      if (touchDistance > 0) {
        // Swipe left - go to next page
        setNewsGridStartIndex(prev => (prev + 1) % Math.ceil(newsArticles.length / 2));
      } else {
        // Swipe right - go to previous page
        setNewsGridStartIndex(prev => 
          prev === 0 ? maxIndex : prev - 1
        );
      }
    }
  };

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
                teamGender: teamData.gender || "men",
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
    const fetchLiveGames = async () => {
      try {
        const gamesRef = collection(firebaseDB, "games");
        const gamesQuery = query(gamesRef, orderBy("date", "asc"));
        const snapshot = await getDocs(gamesQuery);
        
        const now = new Date();
        const twoAndHalfHoursInMs = 2.5 * 60 * 60 * 1000; // 2 hours and 30 minutes
        
        console.log("Checking for live games at:", now.toLocaleString());
        console.log("Total games found:", snapshot.docs.length);
        
        const live = snapshot.docs
          .filter((doc) => {
            const data = doc.data();
            console.log("Checking game - ALL FIELDS:", doc.id, data);
            
            if (data.completed === true) {
              console.log("Game is completed, skipping");
              return false;
            }
            
            const dateStr = data.date || "";
            const timeStr = data.time || "00:00";
            const gameStartTime = new Date(`${dateStr}T${timeStr}`);
            const timeSinceStart = now.getTime() - gameStartTime.getTime();
            
            console.log("Game start time:", gameStartTime.toLocaleString());
            console.log("Time since start (ms):", timeSinceStart);
            console.log("Time since start (hours):", timeSinceStart / (1000 * 60 * 60));
            
            // Show if game has started and less than 2.5 hours have passed
            const shouldShow = timeSinceStart >= 0 && timeSinceStart < twoAndHalfHoursInMs;
            console.log("Should show as live:", shouldShow);
            return shouldShow;
          })
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              home: data.homeTeam || data.team1 || data.homeTeamName || "",
              away: data.awayTeam || data.team2 || data.awayTeamName || "",
              homeTeam: data.homeTeam || data.team1 || data.homeTeamName || "",
              awayTeam: data.awayTeam || data.team2 || data.awayTeamName || "",
              dateTime: `${data.date || ""}T${data.time || "00:00"}`,
              homeTeamLogo: data.homeTeamLogo || data.team1Logo,
              awayTeamLogo: data.awayTeamLogo || data.team2Logo,
              gender: data.gender as "men" | "women",
              location: data.venue || data.location || "",
              status: "live" as const,
              tipoff: `${data.date || ""} · ${data.time || "00:00"}`,
              venue: data.venue || data.location || "",
              network: "",
              broadcast: data.broadcast || "",
              leaders: [],
            };
          });
        
        console.log("Live games to display:", live.length);
        setLiveGames(live);
      } catch (error) {
        console.error("Error fetching live games:", error);
      }
    };
    
    fetchLiveGames();
    // Refresh every 30 seconds for faster updates
    const interval = setInterval(fetchLiveGames, 30000);
    return () => clearInterval(interval);
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
            
            // Hide game at exact start time
            const gameNotStarted = now < game.dateObj;
            
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
                  headshot: topPlayer.headshot || undefined,
                  number: topPlayer.number || 0,
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
                  headshot: firstPlayer.headshot || undefined,
                  number: firstPlayer.number || 0,
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
            const day = dateObj.getDate();
            const month = dateObj.getMonth() + 1;
            const hours = dateObj.getHours();
            const minutes = dateObj.getMinutes();
            
            let timeStr;
            let dateStr;
            if (language === 'fr') {
              // 24-hour format for French
              timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              // French: day/month (25/12)
              dateStr = `${day}/${month}`;
            } else {
              // 12-hour format for English
              const period = hours >= 12 ? 'PM' : 'AM';
              const hours12 = hours % 12 || 12;
              timeStr = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
              // English: month/day (12/25)
              dateStr = `${month}/${day}`;
            }
            
            return `${dateStr} · ${timeStr}`;
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
            homeTeam: game.data.homeTeamName || "Home",
            awayTeam: game.data.awayTeamName || "Away",
            homeTeamLogo: game.data.homeTeamLogo,
            awayTeamLogo: game.data.awayTeamLogo,
            gender: game.data.gender,
            dateTime: game.dateObj ? game.dateObj.toISOString() : "",
            refereeHomeTeam1: getRefereeLastName(game.data.refereeHomeTeam1),
            refereeHomeTeam2: getRefereeLastName(game.data.refereeHomeTeam2),
            refereeAwayTeam: getRefereeLastName(game.data.refereeAwayTeam),
            leaders,
          };
        };

        const spotlightGames = await Promise.all(spotlightGamesData.map(formatGameData));
        // Exclude spotlight games from weekly schedule (skip first 3 games)
        const weeklyScheduleGamesData = allGames.slice(3);
        const allWeeklyGames = await Promise.all(weeklyScheduleGamesData.map(formatGameData));
        
        // Store all games for calendar filtering
        const allFormattedGames = await Promise.all(allGames.map(formatGameData));
        setAllScheduledGames(allFormattedGames);
        
        setDynamicSpotlightGames(spotlightGames);
        setWeeklyScheduleGames(allWeeklyGames);
        
        // Fetch completed games for Final Buzzer section
        const completedGamesQuery = query(
          gamesRef,
          orderBy("date", "desc"),
          limit(10)
        );
        const completedSnapshot = await getDocs(completedGamesQuery);
        
        // Get current date
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
        
        const completedGamesData = completedSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              dateObj: data.date ? new Date(data.date) : null,
            };
          })
          .filter((game: any) => {
            // Only show completed games from the current week (Monday to Sunday)
            if (game.completed !== true) return false;
            if (!game.dateObj) return false;
            return game.dateObj >= startOfWeek && game.dateObj <= endOfWeek;
          })
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
    // Auto-refresh every 30 seconds to show new games without page refresh
    const interval = setInterval(fetchGames, 30000);
    return () => clearInterval(interval);
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

  // Disabled auto-popup - players can access from navbar
  // useEffect(() => {
  //   if (user && userProfile && userProfile.verificationStatus === "approved") {
  //     const timer = setTimeout(() => {
  //       setShowProfilePopup(true);
  //     }, 1000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [user, userProfile]);

  // Teams section is completely static - no auto-scroll

  return (
    <div className="relative isolate min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white overflow-x-hidden w-full max-w-[100vw]">
      <div
        className="pointer-events-none absolute inset-x-0 top-[-200px] h-[500px] bg-[radial-gradient(circle,_rgba(56,189,248,0.35),_transparent_60%)] blur-3xl"
        aria-hidden
      />

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4 md:gap-8 px-3 sm:px-6 py-4 sm:py-5 md:px-12 md:pl-16">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl font-semibold tracking-[0.2em] sm:tracking-[0.3em]">
            <Image
              src="/logos/liprobakin.png"
              alt="Liprobakin logo"
              width={36}
              height={36}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-white/20 bg-white/5 object-cover"
              priority
            />
            <span className="hidden xs:inline sm:inline">{copy.brand}</span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 text-white/90 shadow-2xl transition-all duration-700 ease-out focus:outline-none focus:ring-2 focus:ring-white/20 lg:hidden active:scale-95 transform-gpu"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-panel"
              aria-label="Toggle navigation menu"
            >
              <span className="sr-only">Toggle navigation</span>
              
              {/* Glossy Background Effect */}
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 via-transparent to-white/5 transition-all duration-500 ${
                mobileNavOpen ? 'opacity-100' : 'opacity-60'
              }`} />
              
              {/* Animated Glow Ring */}
              <div className={`absolute inset-0 rounded-xl ring-1 ring-white/20 transition-all duration-500 ${
                mobileNavOpen ? 'ring-white/40 shadow-lg shadow-white/20' : 'ring-white/10'
              }`} />
              
              {/* Menu Icon Container */}
              <div className="relative w-6 h-6 flex items-center justify-center transform-gpu">
                <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                  mobileNavOpen ? 'rotate-180 opacity-0' : 'rotate-0 opacity-100'
                }`}>
                  {/* Modern Grid Icon (replacing hamburger) */}
                  <div className="w-6 h-6 grid grid-cols-2 grid-rows-2 gap-1 p-1">
                    <div className="bg-white/80 rounded-sm transition-all duration-300"></div>
                    <div className="bg-white/60 rounded-sm transition-all duration-300"></div>
                    <div className="bg-white/60 rounded-sm transition-all duration-300"></div>
                    <div className="bg-white/80 rounded-sm transition-all duration-300"></div>
                  </div>
                </div>
                
                <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                  mobileNavOpen ? 'rotate-0 opacity-100' : 'rotate-180 opacity-0'
                }`}>
                  {/* Close Icon with Smooth X Animation */}
                  <div className="relative w-6 h-6 flex items-center justify-center">
                    <span className="absolute w-4 h-0.5 bg-white/90 rounded-full transform rotate-45 transition-all duration-300 ease-out"></span>
                    <span className="absolute w-4 h-0.5 bg-white/90 rounded-full transform -rotate-45 transition-all duration-300 ease-out"></span>
                  </div>
                </div>
              </div>
              
              {/* Subtle Shine Effect removed for hover animation */}
            </button>
            <div className="hidden gap-8 text-xs font-medium uppercase tracking-[0.3em] text-slate-300 lg:flex">
              {navSections.map((section) => (
                <a
                  key={section}
                  href={`#${slug(section)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById(slug(section));
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="transition hover:text-white hover:scale-105 whitespace-nowrap cursor-pointer"
                >
                  {copy.nav[slug(section) as keyof typeof copy.nav] ?? section}
                </a>
                ))}
            </div>
            {user && !isAdmin ? (
              <div className="hidden items-center gap-3 lg:flex">
                <Link
                  href="/account"
                  className="group relative rounded-xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-3 backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-white/40 hover:shadow-lg hover:shadow-blue-500/20"
                  aria-label="Account settings"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="group relative rounded-xl border border-white/20 bg-gradient-to-br from-red-500/20 to-red-600/10 p-3 backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-red-400/40 hover:shadow-lg hover:shadow-red-500/20"
                  type="button"
                  aria-label="Sign out"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="animated-send-btn !p-2.5"
                type="button"
                aria-label={language === 'fr' ? 'Se connecter / S\'inscrire' : 'Log In / Sign Up'}
              >
                <div className="svg-wrapper-1">
                  <div className="svg-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              </button>
            )}
            <div className="hidden md:flex items-center gap-1.5 sm:gap-2 border-l border-white/10 pl-2 sm:pl-4">
              <button
                onClick={() => setLanguage('fr')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all ${
                  language === 'fr'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                type="button"
                aria-label="Switch to French"
              >
                FR
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all ${
                  language === 'en'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                type="button"
                aria-label="Switch to English"
              >
                EN
              </button>
            </div>
            <GenderToggle value={gender} onChange={setGender} language={language} />
          </div>
        </div>
      </nav>

      {/* Enhanced Mobile Navigation Panel */}
      <div 
        className={`fixed inset-0 top-[73px] z-40 transition-all duration-700 ease-out transform-gpu lg:hidden ${
          mobileNavOpen 
            ? 'opacity-100 visible translate-y-0' 
            : 'opacity-0 invisible -translate-y-4 pointer-events-none'
        }`}
      >
        {/* Background Overlay with Blur Effect */}
        <div className={`absolute inset-0 bg-gradient-to-b from-black/95 via-black/90 to-black/95 backdrop-blur-2xl transition-all duration-700 ${
          mobileNavOpen ? 'opacity-100' : 'opacity-0'
        }`} />
        
        {/* Main Content */}
        <div
          id="mobile-nav-panel"
          className={`relative h-full overflow-y-auto transition-all duration-700 ease-out ${
            mobileNavOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
            {/* Animated Header */}
            <div className={`mb-8 transition-all duration-700 delay-300 ${
              mobileNavOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="text-center">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  Navigation
                </h2>
                <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full" />
              </div>
            </div>

            {/* Navigation Links with Staggered Animation */}
            <div className="flex flex-col gap-3 mb-8">
              {mobileNavSections.map((section, index) => (
                <a
                  key={section}
                  href={`#${slug(section)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileNavOpen(false);
                    const element = document.getElementById(slug(section));
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-white/[0.02] to-white/5 backdrop-blur-sm px-6 py-5 text-base font-semibold uppercase tracking-[0.2em] text-slate-200 transition-all duration-500 hover:border-blue-400/50 hover:text-white hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02] cursor-pointer transform-gpu ${
                    mobileNavOpen 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  style={{ 
                    transitionDelay: mobileNavOpen ? `${400 + (index * 100)}ms` : '0ms'
                  }}
                >
                  {/* Animated Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-purple-500/0 opacity-0 transition-all duration-500 group-hover:opacity-100" />
                  
                  {/* Content */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span>{copy.nav[slug(section) as keyof typeof copy.nav] ?? section}</span>
                    <div className="w-5 h-5 rounded-full border border-blue-400/30 flex items-center justify-center transition-all duration-300 group-hover:border-blue-400 group-hover:bg-blue-400/10 group-hover:scale-110">
                      <svg className="w-3 h-3 text-blue-400 transform transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out" />
                </a>
              ))}
            </div>
            
            {/* User Section with Enhanced Styling */}
            {user && !isAdmin ? (
              <div className={`flex flex-col gap-4 pt-8 border-t border-white/10 transition-all duration-700 delay-700 ${
                mobileNavOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-white mb-1">Account</h3>
                  <div className="w-12 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full" />
                </div>
                
                <Link
                  href="/account"
                  onClick={() => setMobileNavOpen(false)}
                  className="group flex items-center gap-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-blue-600/5 to-purple-500/10 px-6 py-5 text-white transition-all duration-500 hover:border-blue-400/50 hover:shadow-xl hover:shadow-blue-500/25 hover:scale-[1.02] transform-gpu"
                >
                  <div className="p-2 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold mb-1">{language === 'fr' ? 'Paramètres du compte' : 'Account Settings'}</div>
                    {(userProfile?.firstName || userProfile?.lastName) && (
                      <div className="text-xs text-slate-400">{`${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()}</div>
                    )}
                  </div>
                  <div className="w-5 h-5 rounded-full border border-blue-400/30 flex items-center justify-center transition-all duration-300 group-hover:border-blue-400 group-hover:bg-blue-400/10">
                    <svg className="w-3 h-3 text-blue-400 transform transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileNavOpen(false);
                  }}
                  className="group flex items-center gap-4 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/10 via-red-600/5 to-pink-500/10 px-6 py-5 text-red-400 transition-all duration-500 hover:border-red-400/50 hover:shadow-xl hover:shadow-red-500/25 hover:scale-[1.02] transform-gpu"
                  type="button"
                >
                  <div className="p-2 rounded-xl bg-red-500/20 group-hover:bg-red-500/30 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <span className="flex-1 text-left text-sm font-semibold">{language === 'fr' ? 'Se déconnecter' : 'Sign Out'}</span>
                  <div className="w-5 h-5 rounded-full border border-red-400/30 flex items-center justify-center transition-all duration-300 group-hover:border-red-400 group-hover:bg-red-400/10">
                    <svg className="w-3 h-3 text-red-400 transform transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* News Section */}
      {newsArticles.length > 0 && featuredArticleId && (
        <section className="w-full">
          {(() => {
            const featured = newsArticles.find((article) => article.id === featuredArticleId);
            if (!featured) return null;
            
            const isExpanded = expandedArticleId === featured.id;
            
            return (
              <div className="space-y-8">
                {/* Click-away backdrop when expanded */}
                {isExpanded && (
                  <div 
                    className="fixed inset-0 bg-black/50 z-40 cursor-pointer"
                    onClick={() => setExpandedArticleId(null)}
                    aria-label="Close article"
                  />
                )}
                
                {/* Featured Article */}
                <div 
                  className={`relative overflow-hidden border-y border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 transition-opacity duration-300 ${isArticleChanging ? 'opacity-0' : 'opacity-100'} ${isExpanded ? 'z-50' : ''}`}
                >
                  {featured.imageUrl && (
                    <div className={`relative overflow-hidden transition-all duration-500 ${isExpanded ? 'min-h-[600px]' : 'h-[600px]'}`}>
                      <Image
                        src={featured.imageUrl}
                        alt={language === 'en' && featured.title_en ? featured.title_en : featured.title}
                        fill
                        className="object-cover"
                        style={{ objectPosition: `center ${featured.imagePosition ?? 50}%` }}
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950" />
                      
                      {/* Article Grid - Fixed position above title */}
                      <div 
                        className={`absolute left-0 right-0 px-4 md:px-8 lg:px-16 z-30 transition-all duration-700 ease-out ${
                          isExpanded 
                            ? 'opacity-0 translate-y-8 pointer-events-none' 
                            : 'opacity-100 translate-y-0'
                        }`}
                        style={{bottom: 'calc(1.25rem - 3%)'}}
                      >
                        {newsArticles.length > 0 && (
                          <>
                            {/* Mobile Swipeable Grid */}
                            <div className="sm:hidden">
                            <div className="relative max-w-4xl mx-auto w-full">
                              {/* Smooth Scroll Container - Hold and drag to scroll */}
                              <div 
                                className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide touch-pan-x pb-3"
                                style={{
                                  WebkitOverflowScrolling: 'touch',
                                  scrollbarWidth: 'none',
                                  msOverflowStyle: 'none'
                                }}
                              >
                                {/* Individual scrollable cards */}
                                {newsArticles.map((article) => (
                                        <button
                                          key={article.id}
                                          onClick={() => {
                                            setIsArticleChanging(true);
                                            setTimeout(() => {
                                              setFeaturedArticleId(article.id);
                                              setExpandedArticleId(null);
                                              setIsArticleChanging(false);
                                              const newsSection = document.querySelector('section');
                                              if (newsSection) {
                                                newsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                              }
                                            }, 300);
                                          }}
                                          className={`group relative overflow-hidden rounded-xl border text-left transition-all duration-300 backdrop-blur-md snap-start flex-shrink-0 w-[45vw] ${
                                            article.id === featured.id 
                                              ? 'border-white/30 bg-white/10' 
                                              : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                                          }`}
                                        >
                                          {article.id === featured.id && !expandedArticleId && (
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 overflow-hidden z-20">
                                              <div 
                                                className="h-full bg-white/40 backdrop-blur-md relative"
                                                style={{
                                                  animation: 'progressBar 15s linear infinite'
                                                }}
                                              >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                              </div>
                                            </div>
                                          )}
                                          
                                          {article.imageUrl && (
                                            <div className="relative h-20 overflow-hidden">
                                              <Image
                                                src={article.imageUrl}
                                                alt={language === 'en' && article.title_en ? article.title_en : article.title}
                                                fill
                                                className="object-cover transition duration-300 group-hover:scale-105"
                                                style={{ objectPosition: `center ${article.imagePosition ?? 50}%` }}
                                              />
                                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                                            </div>
                                          )}
                                          
                                          <div className="p-2">
                                            <span className="mb-1 inline-block text-[9px] font-semibold uppercase tracking-wider text-orange-500">
                                              {article.category}
                                            </span>
                                            
                                            <h3 className="mb-1 text-[10px] font-bold leading-tight text-white group-hover:text-orange-500 transition-colors line-clamp-2">
                                              {language === 'en' && article.title_en ? article.title_en : article.title}
                                            </h3>
                                            
                                            <p className="text-[9px] text-slate-400 line-clamp-2">
                                              {language === 'en' && article.headline_en ? article.headline_en : article.headline}
                                            </p>
                                            
                                            {article.createdAt && (
                                              <p className="mt-1 text-[9px] text-slate-500">
                                                {new Intl.DateTimeFormat(language === 'fr' ? "fr-FR" : "en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                }).format(article.createdAt)}
                                              </p>
                                            )}
                                          </div>
                                        </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Desktop Grid */}
                          <div className="hidden sm:block">
                            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 max-w-4xl mx-auto w-full">
                              {(() => {
                                const articlesToShow = 3;
                                const gridArticles = [];
                                
                                // Desktop: always show first 3 articles
                                for (let i = 0; i < Math.min(articlesToShow, newsArticles.length); i++) {
                                  gridArticles.push(newsArticles[i]);
                                }
                                
                                return gridArticles.map((article, index) => (
                                  <button
                                    key={article.id}
                                    onClick={() => {
                                      setIsArticleChanging(true);
                                      setTimeout(() => {
                                        setFeaturedArticleId(article.id);
                                        setExpandedArticleId(null);
                                        setIsArticleChanging(false);
                                        const newsSection = document.querySelector('section');
                                        if (newsSection) {
                                          newsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                      }, 300);
                                    }}
                                    className={`group relative overflow-hidden rounded-xl border text-left transition-all duration-300 backdrop-blur-md ${
                                      article.id === featured.id 
                                        ? 'border-white/30 bg-white/10' 
                                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                                    } ${index === 2 ? 'hidden sm:block' : ''}`}
                                  >
                                    {article.id === featured.id && !expandedArticleId && (
                                      <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 overflow-hidden z-20">
                                        <div 
                                          className="h-full bg-white/40 backdrop-blur-md relative"
                                          style={{
                                            animation: 'progressBar 15s linear infinite'
                                          }}
                                        >
                                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                        </div>
                                      </div>
                                    )}
                                    
                                    {article.imageUrl && (
                                      <div className="relative h-20 md:h-28 overflow-hidden">
                                        <Image
                                          src={article.imageUrl}
                                          alt={language === 'en' && article.title_en ? article.title_en : article.title}
                                          fill
                                          className="object-cover transition duration-300 group-hover:scale-105"
                                          style={{ objectPosition: `center ${article.imagePosition ?? 50}%` }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                                      </div>
                                    )}
                                    
                                    <div className="p-2 md:p-3">
                                      <span className="mb-1 inline-block text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-orange-500">
                                        {article.category}
                                      </span>
                                      
                                      <h3 className="mb-1 md:mb-1.5 text-[10px] md:text-xs font-bold leading-tight text-white group-hover:text-orange-500 transition-colors line-clamp-2">
                                        {language === 'en' && article.title_en ? article.title_en : article.title}
                                      </h3>
                                      
                                      <p className="text-[9px] md:text-[11px] text-slate-400 line-clamp-2">
                                        {language === 'en' && article.headline_en ? article.headline_en : article.headline}
                                      </p>
                                      
                                      {article.createdAt && (
                                        <p className="mt-1 md:mt-1.5 text-[9px] md:text-[10px] text-slate-500">
                                          {new Intl.DateTimeFormat(language === 'fr' ? "fr-FR" : "en-US", {
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
                          </div>
                          </>
                        )}
                      </div>

                      {/* Title and Headline on top of image */}
                      <div className={`absolute inset-0 flex flex-col p-8 md:p-16 ${isExpanded ? 'relative' : 'justify-start'} z-10`}>
                        <div className="pointer-events-auto">
                        <div>
                          <span className="mb-2 inline-block w-fit rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                            {featured.category}
                          </span>
                          
                          <h1 className="mb-2 text-2xl font-bold leading-tight text-white md:text-3xl lg:text-4xl max-w-4xl line-clamp-2">
                            {language === 'en' && featured.title_en ? featured.title_en : featured.title}
                          </h1>
                          
                          <p className="mb-2 text-sm md:text-base text-slate-200 max-w-3xl line-clamp-2">
                            {language === 'en' && featured.headline_en ? featured.headline_en : featured.headline}
                          </p>
                          
                          {featured.createdAt && (
                            <p className="mb-4 text-xs text-slate-300">
                              {formatTimeAgo(featured.createdAt)}
                            </p>
                          )}
                          
                          <AnimatedButton
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedArticleId(isExpanded ? null : featured.id);
                            }}
                            icon="book"
                            ariaLabel={language === 'fr' ? (isExpanded ? "Fermer" : "Lire") : (isExpanded ? "Close" : "Read")}
                          >
                            {language === 'fr' ? (isExpanded ? "Fermer" : "Lire") : (isExpanded ? "Close" : "Read")}
                          </AnimatedButton>
                        </div>
                          
                          {/* Expandable Article Content - Modern slide-in overlay with animations */}
                          <div 
                            className={`overflow-hidden transition-all duration-700 ease-in-out ${
                              isExpanded 
                                ? 'max-h-[800px] opacity-100 mt-8' 
                                : 'max-h-0 opacity-0 mt-0'
                            }`}
                          >
                            <div className={`transform transition-all duration-700 ease-in-out ${
                              isExpanded 
                                ? 'translate-y-0 scale-100 delay-100' 
                                : 'translate-y-8 scale-95'
                            }`}>
                              <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-black/95 backdrop-blur-xl p-6 md:p-8 shadow-2xl">
                                {/* Close button - top right with basketball theme */}
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Add basketball bounce animation
                                    const button = e.currentTarget;
                                    button.style.animation = 'basketball-bounce 0.6s ease-out';
                                    setTimeout(() => {
                                      setExpandedArticleId(null);
                                    }, 400);
                                  }}
                                  className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full border-2 border-orange-500/40 bg-gradient-to-br from-orange-600/20 to-orange-800/20 backdrop-blur-md text-orange-400 transition-all hover:border-orange-400 hover:from-orange-500/30 hover:to-orange-700/30 hover:text-orange-300 hover:scale-110 hover:rotate-12 active:scale-95 cursor-pointer z-50 group"
                                  type="button"
                                  aria-label="Close article"
                                  style={{ boxShadow: '0 0 20px rgba(249, 115, 22, 0.3), inset 0 0 10px rgba(249, 115, 22, 0.1)' }}
                                >
                                  {/* Basketball seams effect */}
                                  <div className="absolute inset-0 rounded-full overflow-hidden opacity-30">
                                    <div className="absolute top-0 left-1/2 w-px h-full bg-orange-400/50 -translate-x-1/2"></div>
                                    <div className="absolute top-1/2 left-0 w-full h-px bg-orange-400/50 -translate-y-1/2"></div>
                                  </div>
                                  <span className="text-xl leading-none relative z-10 group-hover:scale-125 transition-transform">×</span>
                                </button>
                                
                                <style jsx>{`
                                  @keyframes basketball-bounce {
                                    0% {
                                      transform: translateY(0) scale(1) rotate(0deg);
                                      opacity: 1;
                                    }
                                    25% {
                                      transform: translateY(-15px) scale(1.1) rotate(90deg);
                                      opacity: 0.9;
                                    }
                                    50% {
                                      transform: translateY(0) scale(0.95) rotate(180deg);
                                      opacity: 0.7;
                                    }
                                    70% {
                                      transform: translateY(-8px) scale(1.05) rotate(270deg);
                                      opacity: 0.5;
                                    }
                                    85% {
                                      transform: translateY(0) scale(0.98) rotate(340deg);
                                      opacity: 0.3;
                                    }
                                    100% {
                                      transform: translateY(50px) scale(0.5) rotate(360deg);
                                      opacity: 0;
                                    }
                                  }
                                `}</style>

                                {/* Decorative gradient line */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-t-2xl" />

                                {/* Article content with custom scrollbar */}
                                <div className="max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                  {/* Article Header */}
                                  <div className="mb-6 pb-6 border-b border-white/10">
                                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                                      {language === 'en' && featured.title_en ? featured.title_en : featured.title}
                                    </h2>
                                    <p className="text-base md:text-lg text-slate-300 font-medium italic">
                                      {language === 'en' && featured.headline_en ? featured.headline_en : featured.headline}
                                    </p>
                                    {featured.createdAt && (
                                      <div className="flex items-center gap-3 mt-4 text-sm text-slate-400">
                                        <span className="flex items-center gap-1.5">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          {new Intl.DateTimeFormat(language === 'fr' ? "fr-FR" : "en-US", {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                          }).format(featured.createdAt)}
                                        </span>
                                        <span className="text-slate-600">•</span>
                                        <span className="uppercase tracking-wider text-xs font-semibold text-orange-400">
                                          {featured.category}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Article Body */}
                                  <div className="prose prose-invert prose-slate max-w-none">
                                    <ArticleContent 
                                      htmlContent={language === 'en' && featured.summary_en ? featured.summary_en : featured.summary}
                                      className="text-base md:text-lg leading-relaxed text-slate-200 space-y-4"
                                    />
                                  </div>

                                  {/* Players/Teams Mentioned */}
                                  <MentionedEntities 
                                    htmlContent={language === 'en' && featured.summary_en ? featured.summary_en : featured.summary}
                                    language={language}
                                  />

                                  {/* Article Footer */}
                                  <div className="mt-8 pt-6 border-t border-white/10">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                      {/* Author Info */}
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-sm">
                                          {(featured.author || 'LIPROBAKIN Staff').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-400 uppercase tracking-wider">
                                            {language === 'fr' ? 'Publié par' : 'Posted By'}
                                          </p>
                                          <p className="text-sm font-semibold text-white">
                                            {featured.author || 'LIPROBAKIN Staff'}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {/* Share Section */}
                                      <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-sm text-slate-400">
                                          {language === 'fr' ? 'Partager' : 'Share'}
                                        </span>
                                        <div className="flex gap-2">
                                          {/* Social Share Buttons */}
                                          <button 
                                            onClick={() => {
                                              const url = typeof window !== 'undefined' ? window.location.href : '';
                                              const text = language === 'en' && featured.title_en ? featured.title_en : featured.title;
                                              window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                                            }}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition text-slate-400 hover:text-white"
                                            aria-label="Share on Facebook"
                                          >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                            </svg>
                                          </button>
                                          <button 
                                            onClick={() => {
                                              const url = typeof window !== 'undefined' ? window.location.href : '';
                                              const text = language === 'en' && featured.title_en ? featured.title_en : featured.title;
                                              window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
                                            }}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition text-slate-400 hover:text-white"
                                            aria-label="Share on Twitter"
                                          >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Gradient fade at bottom */}
                                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none rounded-b-2xl" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* Fan Favorites Section - Shows right after news for logged-in fans */}
      {user && userProfile && userProfile.role === 'fan' && (
        <section className="mx-auto max-w-6xl px-4 md:px-8 pb-12">
          <div className="flex flex-col items-center gap-6">
            {/* Dropdown arrows */}
            <div className="flex gap-3">
              {/* Global Favorite Player Arrow */}
              {(userProfile.favoritePlayerMenId || userProfile.favoritePlayerWomenId) && (
                <button
                  onClick={() => setShowFavoritePlayer(!showFavoritePlayer)}
                  className="group relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:scale-105"
                  type="button"
                  aria-label="Toggle favorite player"
                >
                  <svg className="h-8 w-8 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 3c-1.2 0-2.4.6-3.2 1.6-.2.2-.4.4-.6.6-.1.1-.1.2-.2.3-.1-.1-.1-.2-.2-.3-.2-.2-.4-.4-.6-.6C10.4 3.6 9.2 3 8 3c-1.7 0-3 1.3-3 3 0 .8.3 1.6.8 2.2L6 8.4V20c0 .6.4 1 1 1h10c.6 0 1-.4 1-1V8.4l.2-.2c.5-.6.8-1.4.8-2.2 0-1.7-1.3-3-3-3zM16 19H8V9.2l.8-.8c.4-.4.6-1 .6-1.5 0-.6-.4-1-1-1-.3 0-.6.1-.8.3l-.2.2-.4-.4c-.2-.2-.5-.3-.8-.3-.6 0-1 .4-1 1 0 .5.2 1.1.6 1.5l.8.8V19h-.6v-8.8l-.8-.8C4.3 8.6 4 7.8 4 7c0-2.2 1.8-4 4-4 1.4 0 2.7.7 3.5 1.8.1.1.2.3.3.4.1.1.2.3.2.4 0-.1.1-.3.2-.4.1-.1.2-.3.3-.4C13.3 3.7 14.6 3 16 3c2.2 0 4 1.8 4 4 0 .8-.3 1.6-.8 2.2l-.8.8V19h-.4z"/>
                    <text x="12" y="15" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor">23</text>
                  </svg>
                  <svg 
                    className={`h-6 w-6 text-white/80 transition-transform duration-300 ${showFavoritePlayer ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Men's Team Arrow */}
              {userProfile.favoriteTeamMenId && (
                <button
                  onClick={() => setShowMenTeamFavorite(!showMenTeamFavorite)}
                  className="group relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-white/20 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:scale-100"
                  type="button"
                  aria-label="Toggle men's favorite team"
                >
                  <svg className="h-6 w-6 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                    <path d="M12 3c0 3-3 6-3 9s3 6 3 9" />
                    <path d="M21 12c-3 0-6-3-9-3s-6 3-9 3" />
                  </svg>
                  <svg 
                    className={`h-4 w-4 text-white/80 transition-transform duration-300 ${showMenTeamFavorite ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Women's Team Arrow */}
              {userProfile.favoriteTeamWomenId && (
                <button
                  onClick={() => setShowWomenTeamFavorite(!showWomenTeamFavorite)}
                  className="group relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-white/20 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:scale-100"
                  type="button"
                  aria-label="Toggle women's favorite team"
                >
                  <svg className="h-6 w-6 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                    <path d="M12 3c0 3-3 6-3 9s3 6 3 9" />
                    <path d="M21 12c-3 0-6-3-9-3s-6 3-9 3" />
                  </svg>
                  <svg 
                    className={`h-4 w-4 text-white/80 transition-transform duration-300 ${showWomenTeamFavorite ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Dropdown Content - Favorite Player */}
            {showFavoritePlayer && (userProfile.favoritePlayerMenId || userProfile.favoritePlayerWomenId) && (
              <div className="w-full max-w-3xl overflow-hidden rounded-t-none rounded-b-2xl border-x border-b border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-4 duration-500">
                <div className="p-8 text-center text-white/60">
                  <p>Favorite Player: {userProfile.favoritePlayerMenName || userProfile.favoritePlayerWomenName}</p>
                </div>
              </div>
            )}

            {/* Dropdown Content - Men's Team */}
            {showMenTeamFavorite && userProfile.favoriteTeamMenId && (
              <div className="w-full max-w-3xl overflow-hidden rounded-t-none rounded-b-2xl border-x border-b border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-4 duration-500">
                <FanFavoriteTeamCard teamId={userProfile.favoriteTeamMenId || ''} teamName={userProfile.favoriteTeamMenName || ''} />
              </div>
            )}

            {/* Dropdown Content - Women's Team */}
            {showWomenTeamFavorite && userProfile.favoriteTeamWomenId && (
              <div className="w-full max-w-3xl overflow-hidden rounded-t-none rounded-b-2xl border-x border-b border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-4 duration-500">
                <FanFavoriteTeamCard teamId={userProfile.favoriteTeamWomenId || ''} teamName={userProfile.favoriteTeamWomenName || ''} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Live Games Section - No label */}
      {liveGames.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 md:px-8">
          <div className={`flex flex-wrap gap-4 ${liveGames.length === 1 ? 'justify-center' : liveGames.length === 2 ? 'justify-center' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {liveGames.map((game) => {
              return (
                <div
                  key={game.id}
                  className={`relative overflow-hidden rounded-b-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:shadow-xl ${liveGames.length < 3 ? 'w-full md:w-[calc(50%-0.5rem)] lg:w-[400px]' : ''}`}
                >
                  <div className="flex items-center justify-between p-3">
                    {/* Home Team */}
                    <div className="flex flex-1 items-center gap-2">
                      {game.homeTeamLogo && (
                        <div className="relative h-10 w-10 flex-shrink-0 rounded-full overflow-hidden bg-slate-800">
                          <Image
                            src={game.homeTeamLogo}
                            alt={game.homeTeam || "Home Team"}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-white">{game.homeTeam}</h3>
                      </div>
                    </div>

                    {/* Live Indicator */}
                    <div className="flex flex-col items-center gap-1 px-4">
                      <div className="relative flex items-center gap-1">
                        <div className="relative">
                          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          <div className="absolute inset-0 h-2 w-2 rounded-full bg-red-500 animate-ping" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-red-500 animate-pulse">
                          LIVE
                        </span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                        {game.gender === "men" ? "MEN" : "WOMEN"}
                      </span>
                      {game.venue && (
                        <span className="text-[10px] text-slate-500 text-center">
                          {game.venue}
                        </span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <div className="flex-1 text-right">
                        <h3 className="text-sm font-bold text-white">{game.awayTeam}</h3>
                      </div>
                      {game.awayTeamLogo && (
                        <div className="relative h-10 w-10 flex-shrink-0 rounded-full overflow-hidden bg-slate-800">
                          <Image
                            src={game.awayTeamLogo}
                            alt={game.awayTeam || "Away Team"}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Player Profile Card - Only for verified players */}
      {userProfile?.role === "player" && userProfile?.verificationStatus === "approved" && userProfile?.teamName && playerData && (
        <section className="mx-auto max-w-6xl px-4 pt-8 md:px-8">
          <div 
            className={`relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-2xl transition-all duration-500 overflow-hidden ${
              playerCardExpanded ? 'p-6' : 'cursor-pointer hover:border-white/30'
            }`}
            onClick={() => !playerCardExpanded && setPlayerCardExpanded(true)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPlayerCardExpanded(!playerCardExpanded);
              }}
              className="absolute right-4 top-4 z-10 text-slate-400 transition hover:text-white hover:scale-110"
              type="button"
              aria-label={playerCardExpanded ? "Collapse player card" : "Expand player card"}
            >
              {playerCardExpanded ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
            </button>
            
            {/* Collapsed View */}
            {!playerCardExpanded && (
              <div className="flex items-center gap-3 p-3">
                <div className="relative h-12 w-12 flex-shrink-0">
                  <Image
                    src={playerData.headshot || '/logos/liprobakin.png'}
                    alt={playerData.name}
                    fill
                    className="rounded-full border-2 border-white/20 object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white">{playerData.name}</h3>
                </div>
              </div>
            )}
            
            {/* Expanded View */}
            {playerCardExpanded && (
              <div className="space-y-4">
                <div className="flex flex-row items-start gap-4">
                  {/* Player Profile Pic - Top left */}
                  <div className="relative h-24 w-24 sm:h-32 sm:w-32 flex-shrink-0">
                    <Image
                      src={playerData.headshot || '/logos/liprobakin.png'}
                      alt={playerData.name}
                      fill
                      className="rounded-full border-4 border-white/20 object-cover"
                    />
                  </div>
                  
                  {/* Player Info - Always on right */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="border-b border-white/10 pb-2">
                      <h3 className="text-xl sm:text-2xl font-bold text-white truncate">{playerData.name}</h3>
                      <p className="text-sm text-slate-400">#{playerData.number} • {userProfile.teamName}</p>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
                      <div>
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">PTS</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{playerData.stats.pts}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">REB</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{playerData.stats.reb}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">AST</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{playerData.stats.pts ? Math.floor(Number(playerData.stats.pts) * 0.3) : '0'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">BLK</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{playerData.stats.stl}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Next Game - Full width with countdown */}
                {nextGame && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    {/* Header with countdown */}
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider">
                        {gameCountdown?.isGameDay ? (
                          <span className="text-yellow-400">
                            🏀 Game Day in {gameCountdown.hours > 0 && `${gameCountdown.hours}h `}{gameCountdown.minutes}m {gameCountdown.seconds}s
                          </span>
                        ) : gameCountdown ? (
                          <span>
                            <span className="text-slate-400">Next Game in </span>
                            <span className="text-blue-400 font-mono">
                              {gameCountdown.days > 0 && `${gameCountdown.days}d `}{gameCountdown.hours}h {gameCountdown.minutes}m
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Next Game</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-white">vs</span>
                        <span className="text-lg font-semibold text-white">
                          {nextGame.homeTeam === userProfile.teamName ? nextGame.awayTeam : nextGame.homeTeam}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">
                          {nextGame.dateTime ? formatGameDateTime(nextGame.dateTime, language) : "TBD"}
                        </p>
                        <p className="text-xs text-slate-400">{nextGame.venue}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Download Card Button */}
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    onClick={() => sharePlayerCard('ig')}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                    aria-label="Download Player Card"
                  >
                    <svg className="w-4 h-4 text-white/60 hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
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
                <p className="text-lg text-slate-400">{language === 'fr' ? "Aucun match n'est encore prévu." : "No upcoming games scheduled yet."}</p>
                <p className="mt-2 text-sm text-slate-500">{language === 'fr' ? "Revenez bientôt pour découvrir les prochaines rencontres !" : "Check back soon for the latest matchups!"}</p>
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
                      <span className="rounded-full border border-white/15 px-2 md:px-2.5 py-0.5 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 whitespace-nowrap">
                        {matchup.gender === "men" ? "Men" : matchup.gender === "women" ? "Women" : matchup.status}
                      </span>
                      <div className="min-w-0 w-full">
                        <p className="text-xs md:text-sm font-semibold text-white truncate">{formatGameDateTime(matchup.tipoff, language)}</p>
                        <p className="text-[10px] md:text-xs text-slate-300 truncate">{matchup.venue}</p>
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
            actions={
              <button
                onClick={() => setShowCalendar(true)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all ml-auto"
                aria-label={language === 'fr' ? 'Ouvrir le calendrier' : 'Open calendar'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            }
          />
          
          {/* Calendar Drawer - Slides in from right */}
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-opacity duration-300 ${
              showCalendar ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setShowCalendar(false)}
          />
          
          {/* Calendar Panel */}
          <div 
            className={`fixed top-0 right-0 h-full w-[320px] max-w-[85vw] bg-slate-900/98 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[101] transform transition-transform duration-300 ease-out ${
              showCalendar ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-6 h-full overflow-y-auto">
              {/* Header with close button */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {language === 'fr' ? 'Calendrier' : 'Calendar'}
                </h3>
                <button
                  onClick={() => setShowCalendar(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={language === 'fr' ? 'Fermer' : 'Close'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    const newDate = new Date(selectedScheduleDate || new Date());
                    newDate.setMonth(newDate.getMonth() - 1);
                    setSelectedScheduleDate(newDate);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={language === 'fr' ? 'Mois précédent' : 'Previous month'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-white font-semibold">
                  {(selectedScheduleDate || new Date()).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    const newDate = new Date(selectedScheduleDate || new Date());
                    newDate.setMonth(newDate.getMonth() + 1);
                    setSelectedScheduleDate(newDate);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={language === 'fr' ? 'Mois suivant' : 'Next month'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {(language === 'fr' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((day, i) => (
                  <div key={i} className="text-center text-xs text-slate-500 py-1">{day}</div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const currentMonth = selectedScheduleDate || new Date();
                  const year = currentMonth.getFullYear();
                  const month = currentMonth.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const lastDay = new Date(year, month + 1, 0);
                  const startDay = language === 'fr' ? (firstDay.getDay() + 6) % 7 : firstDay.getDay();
                  const days = [];
                  
                  // Empty cells for days before month starts
                  for (let i = 0; i < startDay; i++) {
                    days.push(<div key={`empty-${i}`} className="p-2"></div>);
                  }
                  
                  // Days of the month
                  for (let day = 1; day <= lastDay.getDate(); day++) {
                    const date = new Date(year, month, day);
                    const isToday = new Date().toDateString() === date.toDateString();
                    const isSelected = selectedScheduleDate?.toDateString() === date.toDateString();
                    
                    // Check if there are games on this day
                    const hasGames = allScheduledGames.some(game => {
                      const gameDate = new Date(game.dateTime || '');
                      return gameDate.toDateString() === date.toDateString();
                    });
                    
                    days.push(
                      <button
                        key={day}
                        onClick={() => {
                          setSelectedScheduleDate(date);
                          setShowCalendar(false);
                        }}
                        className={`p-2 text-sm rounded-lg transition-all relative ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : isToday
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'hover:bg-white/10 text-white'
                        }`}
                      >
                        {day}
                        {hasGames && !isSelected && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500"></div>
                        )}
                      </button>
                    );
                  }
                  
                  return days;
                })()}
              </div>
              
              {/* Reset button */}
              <button
                onClick={() => {
                  setSelectedScheduleDate(null);
                  setShowCalendar(false);
                }}
                className="w-full mt-6 py-3 text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                {language === 'fr' ? 'Voir cette semaine' : 'Show this week'}
              </button>
            </div>
          </div>
          
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
              {/* Selected date indicator */}
              {selectedScheduleDate && (
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-slate-400">
                    {language === 'fr' ? 'Semaine du' : 'Week of'}{' '}
                    <span className="text-white font-medium">
                      {(() => {
                        const weekStart = new Date(selectedScheduleDate);
                        const day = weekStart.getDay();
                        const diff = language === 'fr' ? (day === 0 ? -6 : 1 - day) : -day;
                        weekStart.setDate(weekStart.getDate() + diff);
                        return weekStart.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
                      })()}
                    </span>
                  </span>
                  <button
                    onClick={() => setSelectedScheduleDate(null)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {language === 'fr' ? 'Retour à cette semaine' : 'Back to this week'}
                  </button>
                </div>
              )}
              
              <div 
                ref={scheduleScrollRef}
                className="space-y-4 max-h-[600px] md:max-h-[700px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 scroll-smooth"
              >
                {(() => {
                  // Filter games based on selected date's week
                  const gamesToShow = selectedScheduleDate
                    ? (() => {
                        const weekStart = new Date(selectedScheduleDate);
                        const day = weekStart.getDay();
                        const diff = language === 'fr' ? (day === 0 ? -6 : 1 - day) : -day;
                        weekStart.setDate(weekStart.getDate() + diff);
                        weekStart.setHours(0, 0, 0, 0);
                        
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        weekEnd.setHours(23, 59, 59, 999);
                        
                        return allScheduledGames.filter(game => {
                          const gameDate = new Date(game.dateTime || '');
                          return gameDate >= weekStart && gameDate <= weekEnd;
                        });
                      })()
                    : weeklyScheduleGames;
                  
                  if (gamesToShow.length === 0) {
                    return (
                      <div className="py-8 text-center">
                        <p className="text-slate-400">{language === 'fr' ? "Aucun match n'est prévu cette semaine." : "No games scheduled for this week."}</p>
                      </div>
                    );
                  }
                  
                  return gamesToShow.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-white/5 bg-black/30 p-3 sm:p-4"
                  >
                    {/* Compact layout for mobile and desktop */}
                    <div className="space-y-2">
                      {/* Top Row: Date/Time on left, Venue & Gender on right (mobile) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs md:text-sm font-semibold text-white flex-shrink-0">
                          {formatGameDateTime(game.tipoff, language)}
                        </div>
                        
                        {/* Venue & Gender - Horizontal on mobile, vertical on desktop */}
                        <div className="flex items-center gap-2 md:flex-col md:items-end md:gap-0.5 min-w-0">
                          <span className="text-[10px] md:text-xs text-slate-300 truncate">{game.venue}</span>
                          <span className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap flex-shrink-0">
                            {game.gender === "men" ? "M" : game.gender === "women" ? "W" : ""}
                          </span>
                        </div>
                      </div>
                      
                      {/* Bottom Row: Teams Section - Compact horizontal layout */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Away Team */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          {game.awayTeamLogo && (
                            <Image
                              src={game.awayTeamLogo}
                              alt={game.away.team}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full border border-white/10 object-cover flex-shrink-0"
                            />
                          )}
                          <span className="text-xs md:text-sm font-medium text-white truncate">{game.away.team}</span>
                        </div>
                        
                        {/* VS Divider */}
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 flex-shrink-0 px-1">vs</span>
                        
                        {/* Home Team */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs md:text-sm font-medium text-white truncate">{game.home.team}</span>
                          {game.homeTeamLogo && (
                            <Image
                              src={game.homeTeamLogo}
                              alt={game.home.team}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full border border-white/10 object-cover flex-shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
          
          {/* Down Arrow Button - Desktop only */}
          {weeklyScheduleGames.length > 7 && (
            <div className="hidden md:flex justify-center mt-4">
              <button
                onClick={() => {
                  if (scheduleScrollRef.current) {
                    const container = scheduleScrollRef.current;
                    const scrollHeight = container.scrollHeight;
                    const clientHeight = container.clientHeight;
                    const scrollTop = container.scrollTop;
                    
                    // Scroll down by approximately one game card height (around 100px)
                    container.scrollTo({
                      top: Math.min(scrollTop + 120, scrollHeight - clientHeight),
                      behavior: 'smooth'
                    });
                  }
                }}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all hover:translate-y-1 animate-bounce"
                aria-label="Show more games"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>
        </section>

        {/* Final Buzzer Section */}
        <section id="final-buzzer" className="space-y-8">
          <SectionHeader
            id="final-buzzer"
            eyebrow={sectionCopy.games.eyebrow}
            title={sectionCopy.games.title}
          />
          <div className="space-y-4">
            {completedGames.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-12 text-center">
                <p className="text-lg text-slate-400">No completed games yet.</p>
                <p className="mt-2 text-sm text-slate-500">Check back after games are finished!</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-2">
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
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/15 px-1.5 py-0.5 sm:px-2 text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                            FINAL
                          </span>
                          <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-wider">
                            {game.gender === "men" ? "M" : game.gender === "women" ? "W" : ""}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] sm:text-xs text-slate-400">
                            {game.dateObj ? new Intl.DateTimeFormat(language === 'fr' ? "fr-FR" : "en-US", {
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
            actions={<GenderToggle value={playersGender} onChange={setPlayersGender} language={language} />}
          />
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">League Leader</p>
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
            <div className="mt-6 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {[...leagueTopPlayers]
                .filter((player) => player.teamGender === playersGender)
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
                .slice(0, leagueLeadersExpanded ? 10 : 10)
                .map((player, index) => {
                const playerName = `${player.firstName} ${player.lastName}`.trim();
                const playerImage = player.headshot || player.teamLogo || "/logos/liprobakin.png";
                const statValue = playerMetric === "pts" ? player.stats.pts
                  : playerMetric === "reb" ? player.stats.reb
                  : playerMetric === "ast" ? player.stats.ast
                  : playerMetric === "blk" ? player.stats.blk
                  : player.stats.stl;
                return (
                  <div
                    key={`${player.id}-${playerMetric}`}
                    className="flex-shrink-0 w-[280px] snap-start rounded-3xl border border-white/10 bg-slate-900/60 overflow-hidden hover:border-white/30 transition"
                  >
                    <div className="p-6 flex flex-col items-center text-center">
                      <span className="text-lg font-bold text-slate-300 mb-3">
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                      <Image
                        src={playerImage}
                        alt={`${player.name} portrait`}
                        width={180}
                        height={180}
                        className="rounded-full border-4 border-white/10 object-cover mb-4"
                        style={{
                          width: 180,
                          height: 180,
                        }}
                      />
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-1">
                        #{player.number} · {player.teamName}
                      </p>
                      <p className="text-xl font-bold text-white mb-4">
                        {playerName}
                      </p>
                      <div className="grid grid-cols-4 gap-3 w-full">
                        <div>
                          <p className="text-[10px] uppercase text-slate-400">PTS</p>
                          <p className="text-lg font-bold text-white">{player.stats.pts}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400">REB</p>
                          <p className="text-lg font-bold text-white">{player.stats.reb}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400">AST</p>
                          <p className="text-lg font-bold text-white">{player.stats.ast}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400">BLK</p>
                          <p className="text-lg font-bold text-white">{player.stats.blk}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="standings" className="space-y-8">
          <SectionHeader
            id="standings"
            eyebrow={sectionCopy.standings.eyebrow}
            title={sectionCopy.standings.title}
            actions={<GenderToggle value={standingsGender} onChange={setStandingsGender} language={language} />}
          />
          <div className="overflow-hidden rounded-2xl border border-white/5">
            <div className="max-sm:overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-950 text-sm uppercase tracking-[0.3em] text-slate-300 border-b border-white/5">
                <tr>
                  <th className="px-3 py-2">{copy.standingsTable.seed}</th>
                  <th className="px-3 py-2">{copy.standingsTable.team}</th>
                  <th className="px-3 py-2">{copy.standingsTable.wins}</th>
                  <th className="px-3 py-2">{copy.standingsTable.losses}</th>
                  <th className="px-3 py-2">{copy.standingsTable.totalPoints}</th>
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

        <section id="teams" className="space-y-0">
          <SectionHeader
            id="teams"
            eyebrow={sectionCopy.teams.eyebrow}
            title={sectionCopy.teams.title}
            actions={<GenderToggle value={franchiseGender} onChange={setFranchiseGender} language={language} />}
          />
          
          {/* Search bar */}
          <div className="max-w-2xl mx-auto px-1 sm:px-0 -mt-px">
            <div className="relative">
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder={language === 'en' ? 'Choose your team...' : 'Choisissez votre équipe...'}
                className="w-full px-3.5 py-2.5 bg-slate-900/50 border-2 border-blue-500/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-base sm:text-[0.85rem]"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              />
              {teamSearch && (
                <button
                  onClick={() => setTeamSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {teamSearch && filteredFranchises.length === 0 && (
              <p className="mt-2 text-sm text-slate-400 text-center">
                {language === 'en' ? 'No teams found' : 'Aucune équipe trouvée'}
              </p>
            )}
          </div>
          
          <div className={`relative mt-3 sm:mt-4 ${teamSearch ? 'px-1 sm:px-4' : 'px-1 sm:px-0 md:w-screen md:left-1/2 md:right-1/2 md:-ml-[50vw] md:-mr-[50vw] md:px-0 md:relative'}`}>
            {teamSearch ? (
              // Search Results - auto-scrolling marquee format
              <div className="relative overflow-hidden">
                <div className="relative">
                  <div className="marquee-container overflow-hidden flex justify-center" style={{ width: '100%' }}>
                    <div className="marquee-content flex animate-marquee hover:animation-pause">
                      {/* First set of search results */}
                      {filteredFranchises.map((team) => {
                        const fullName = [team.city, team.name].filter(Boolean).join(" ").trim();
                        return (
                          <Link
                            key={`search-first-${fullName}`}
                            href={`/team/${encodeURIComponent(fullName)}`}
                            className="logo-showcase-item flex-shrink-0 mx-4 lg:mx-6 group"
                          >
                            <div className="logo-inner relative">
                              <div className="logo-innerInner p-4 transition-all duration-300 group-hover:scale-110">
                                {team.logo ? (
                                  <Image
                                    src={team.logo}
                                    alt={`${fullName} logo`}
                                    width={88}
                                    height={88}
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 object-cover shadow-lg transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))',
                                    }}
                                    priority={false}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div 
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${team.colors[0]}, ${team.colors[1]})`
                                    }}
                                  >
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                      {/* Duplicate set for seamless loop */}
                      {filteredFranchises.map((team) => {
                        const fullName = [team.city, team.name].filter(Boolean).join(" ").trim();
                        return (
                          <Link
                            key={`search-second-${fullName}`}
                            href={`/team/${encodeURIComponent(fullName)}`}
                            className="logo-showcase-item flex-shrink-0 mx-4 lg:mx-6 group"
                          >
                            <div className="logo-inner relative">
                              <div className="logo-innerInner p-4 transition-all duration-300 group-hover:scale-110">
                                {team.logo ? (
                                  <Image
                                    src={team.logo}
                                    alt={`${fullName} logo`}
                                    width={88}
                                    height={88}
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 object-cover shadow-lg transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))',
                                    }}
                                    priority={false}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div 
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${team.colors[0]}, ${team.colors[1]})`
                                    }}
                                  >
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Logo Showcase Marquee - new carousel design
              <div className="relative overflow-hidden">
                <div className="relative">
                  {/* Marquee Container */}
                  <div className="marquee-container overflow-hidden flex justify-center" style={{ width: '100%' }}>
                    <div className="marquee-content flex animate-marquee hover:animation-pause">
                      {/* First set of logos */}
                      {filteredFranchises.map((team) => {
                        const fullName = [team.city, team.name].filter(Boolean).join(" ").trim();
                        return (
                          <Link
                            key={`first-${fullName}`}
                            href={`/team/${encodeURIComponent(fullName)}`}
                            className="logo-showcase-item flex-shrink-0 mx-4 lg:mx-6 group"
                          >
                            <div className="logo-inner relative">
                              <div className="logo-innerInner p-4 transition-all duration-300 group-hover:scale-110">
                                {team.logo ? (
                                  <Image
                                    src={team.logo}
                                    alt={`${fullName} logo`}
                                    width={88}
                                    height={88}
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 object-cover shadow-lg transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))',
                                    }}
                                    priority={false}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div 
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${team.colors[0]}, ${team.colors[1]})`
                                    }}
                                  >
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                      {/* Duplicate set for seamless loop */}
                      {filteredFranchises.map((team) => {
                        const fullName = [team.city, team.name].filter(Boolean).join(" ").trim();
                        return (
                          <Link
                            key={`second-${fullName}`}
                            href={`/team/${encodeURIComponent(fullName)}`}
                            className="logo-showcase-item flex-shrink-0 mx-4 lg:mx-6 group"
                          >
                            <div className="logo-inner relative">
                              <div className="logo-innerInner p-4 transition-all duration-300 group-hover:scale-110">
                                {team.logo ? (
                                  <Image
                                    src={team.logo}
                                    alt={`${fullName} logo`}
                                    width={88}
                                    height={88}
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 object-cover shadow-lg transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))',
                                    }}
                                    priority={false}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div 
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${team.colors[0]}, ${team.colors[1]})`
                                    }}
                                  >
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
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
          {dynamicCommittee.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
              {dynamicCommittee.map((member) => (
                <Link
                  key={member.id}
                  href={`/staff/${member.id}`}
                  className="group relative overflow-hidden rounded-lg border border-white/10 bg-slate-900/50 transition-all hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10"
                >
                  <div className="aspect-[4/5] relative">
                    {member.photo ? (
                      <Image
                        src={member.photo}
                        alt={member.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-900/20 via-slate-900 to-slate-900">
                        <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xl md:text-2xl font-bold text-white shadow-lg">
                          {member.name.charAt(0)}
                        </div>
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    {/* Info at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                      <p className="font-semibold text-white text-xs md:text-sm truncate">{member.name}</p>
                      <p className="text-[10px] md:text-xs text-orange-400 truncate">{member.role}</p>
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/20 bg-slate-900/30 py-12 text-center">
              <p className="text-slate-400">{language === "fr" ? "Aucun membre du comité" : "No committee members yet"}</p>
            </div>
          )}
        </section>
      </main>

      {/* Partners Strip - Before Footer */}
      {dynamicPartners.length > 0 && (
        <div className="border-t border-white/5 bg-black/30 py-7">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-center gap-7 sm:gap-10 flex-wrap">
              {dynamicPartners.slice(0, 6).map((partner) => (
                <div 
                  key={partner.id} 
                  className="flex-shrink-0 h-9 sm:h-11 opacity-60 hover:opacity-100 transition-opacity"
                >
                  {partner.logo ? (
                    <div className="relative h-full w-18 sm:w-22" style={{ width: '4.5rem' }}>
                      <Image
                        src={partner.logo}
                        alt={partner.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 font-medium">{partner.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-white/10 bg-black/50 py-6 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-center text-xs uppercase tracking-[0.3em] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <p>
              {copy.footerTagline}
            </p>
            <span className="hidden sm:inline text-slate-600">•</span>
            <a 
              href="https://www.landrypalata.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-[10px] tracking-[0.4em] text-slate-500 hover:text-orange-400 transition-all duration-300"
            >
              <span className="uppercase">Built by</span>
              <span className="relative">
                <span className="font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent group-hover:from-orange-300 group-hover:via-amber-400 group-hover:to-orange-500 transition-all duration-300">
                  Landry Palata
                </span>
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-gradient-to-r from-orange-400 to-amber-500 group-hover:w-full transition-all duration-300"></span>
              </span>
              <svg className="w-3 h-3 text-orange-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
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
      {selectedTeam ? (
        <RosterModal teamName={selectedTeam.label} onClose={() => setSelectedTeam(null)} allFranchises={allFranchises} />
      ) : null}
      {selectedPlayer ? (
        <PlayerStatsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      ) : null}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      {showProfilePopup && userProfile ? (
        <PlayerProfilePopup 
          userProfile={userProfile} 
          onClose={() => setShowProfilePopup(false)}
          language={language}
        />
      ) : null}
    </div>
  );
}
