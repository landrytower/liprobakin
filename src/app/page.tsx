"use client";

import { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, query, orderBy, limit, getDocs, onSnapshot } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import AuthModal from "@/components/AuthModal";
import PlayerProfilePopup from "@/components/PlayerProfilePopup";

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

const formatGameDateTime = (dateTimeStr: string, language: Locale): string => {
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
        { key: "men" as Gender, label: language === 'fr' ? "Messieurs" : "Gentlemen", short: "G" },
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

export default function Home() {
  const { user, userProfile, signOut: handleSignOut } = useAuth();
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
  const [liveGames, setLiveGames] = useState<EnhancedMatchup[]>([]);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [scheduleStartIndex, setScheduleStartIndex] = useState(0);
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const copy = translations[language];
  const sectionCopy = copy.sections;
  const languageOptions: Locale[] = ["en", "fr"];
  const mobileNavSections: Array<(typeof navSections)[number]> = [
    "Schedule",
    "Players",
    "Standings",
    "Teams",
  ];
  // Removed static roster - RosterModal now fetches from Firestore
  const genderPlayers = gender === "men" ? spotlightPlayers : spotlightPlayersWomen;
  // Always use dynamic standings calculated from games - no fallback to static data
  const genderStandings = dynamicStandings.filter(s => s.gender === gender);
  const genderFranchises = gender === "men" ? menTeams : womenTeams;
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
          createdAt: data.createdAt?.toDate() || null,
          author: data.author || "LIPROBAKIN Staff",
        };
      });
      
      console.log('✅ Total articles (real-time):', articles.length);
      console.log('📰 Articles:', articles.map(a => ({ id: a.id, title: a.title })));
      setNewsArticles(articles);
      
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
    const fetchPlayerData = async () => {
      if (!userProfile?.role || !userProfile?.verificationStatus || !userProfile?.teamName) {
        setPlayerData(null);
        setNextGame(null);
        return;
      }

      if (userProfile.role === "player" && userProfile.verificationStatus === "approved" && userProfile.teamName) {
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
          
          // Fetch roster from Firestore
          const rosterRef = collection(firebaseDB, `teams/${targetTeamId}/roster`);
          const rosterSnapshot = await getDocs(rosterRef);
          
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
              const playerData = playerDoc.data();
              foundPlayer = {
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
            }
          }
          
          // Fallback: find by player number if linkedPlayerId not available
          if (!foundPlayer && userProfile.playerNumber) {
            for (const playerDoc of rosterSnapshot.docs) {
              const playerData = playerDoc.data();
              if (playerData.number?.toString() === userProfile.playerNumber.toString()) {
                foundPlayer = {
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
        } catch (error) {
          console.error("Error fetching player data from Firestore:", error);
          setPlayerData(null);
          setNextGame(null);
        }
      } else {
        setPlayerData(null);
        setNextGame(null);
      }
    };
    
    fetchPlayerData();
  }, [userProfile, dynamicSpotlightGames]);

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
        const fourDaysAgo = new Date(now);
        fourDaysAgo.setDate(now.getDate() - 4);
        fourDaysAgo.setHours(0, 0, 0, 0);
        
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
            // Only show completed games from the last 4 days
            if (game.completed !== true) return false;
            if (!game.dateObj) return false;
            return game.dateObj >= fourDaysAgo;
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

  // Show profile popup for verified players after login
  useEffect(() => {
    if (user && userProfile && userProfile.verificationStatus === "approved") {
      const timer = setTimeout(() => {
        setShowProfilePopup(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, userProfile]);

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

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-5 md:px-12 md:pl-16">
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
              className="flex flex-col justify-center items-center w-10 h-10 rounded-lg border border-white/20 bg-white/5 text-white transition-all hover:border-white/50 hover:bg-white/10 lg:hidden"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-panel"
              aria-label="Toggle navigation menu"
            >
              <span className="sr-only">Toggle navigation</span>
              <div className="relative w-5 h-4 flex flex-col justify-between">
                <span
                  className={`block h-0.5 w-full bg-current transition-all duration-300 ease-in-out ${
                    mobileNavOpen ? "translate-y-1.5 rotate-45" : ""
                  }`}
                />
                <span
                  className={`block h-0.5 w-full bg-current transition-all duration-300 ease-in-out ${
                    mobileNavOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`block h-0.5 w-full bg-current transition-all duration-300 ease-in-out ${
                    mobileNavOpen ? "-translate-y-1.5 -rotate-45" : ""
                  }`}
                />
              </div>
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
            {user ? (
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
                className="group relative hidden h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-white/40 hover:bg-white/10"
                type="button"
                aria-label="Log In / Sign Up"
                style={{ display: 'none' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 animate-shimmer" />
                <svg className="relative z-10 h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            )}
            <div className="hidden lg:flex items-center gap-2 border-l border-white/10 pl-4">
              <button
                onClick={() => setLanguage('fr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
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

      {mobileNavOpen ? (
        <div
          id="mobile-nav-panel"
          className="fixed inset-0 top-[73px] z-40 bg-black/95 backdrop-blur-xl lg:hidden overflow-y-auto"
        >
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
            {/* Navigation Links */}
            <div className="flex flex-col gap-2 mb-6">
              {mobileNavSections.map((section) => (
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
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-white/[0.02] px-6 py-4 text-base font-semibold uppercase tracking-[0.2em] text-slate-200 transition-all hover:border-blue-400/50 hover:text-white hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="relative z-10">{copy.nav[slug(section) as keyof typeof copy.nav] ?? section}</span>
                </a>
              ))}
            </div>
            
            {/* User Section */}
            {user ? (
              <div className="flex flex-col gap-3 pt-6 border-t border-white/10">
                <Link
                  href="/account"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-blue-500/10 to-blue-600/5 px-6 py-4 text-white transition-all hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold">{language === 'fr' ? 'Paramètres du compte' : 'Account Settings'}</div>
                    {(userProfile?.firstName || userProfile?.lastName) && (
                      <div className="text-xs text-slate-400">{`${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()}</div>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileNavOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/10 to-red-600/5 px-6 py-4 text-red-400 transition-all hover:border-red-400/50 hover:shadow-lg hover:shadow-red-500/20"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="flex-1 text-left text-sm font-semibold">{language === 'fr' ? 'Se déconnecter' : 'Sign Out'}</span>
                </button>
              </div>
            ) : (
              <div className="pt-6 border-t border-white/10">
                <button
                  onClick={() => {
                    setAuthModalOpen(true);
                    setMobileNavOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-gradient-to-r from-white/10 to-white/5 px-6 py-4 text-white font-semibold transition-all hover:border-white/40 hover:bg-white/15 hover:shadow-lg hover:shadow-white/10"
                  type="button"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{language === 'fr' ? 'Se connecter / S\'inscrire' : 'Log In / Sign Up'}</span>
                </button>
              </div>
            )}
            
            {/* Language & Gender Controls */}
            <div className="flex flex-col gap-3 pt-6 border-t border-white/10">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-2 px-2">{language === 'fr' ? 'Langue' : 'Language'}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage('fr')}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all ${
                      language === 'fr'
                        ? 'bg-white text-slate-900 shadow-lg'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:border-white/30 hover:bg-white/10'
                    }`}
                    type="button"
                  >
                    🇫🇷 Français
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all ${
                      language === 'en'
                        ? 'bg-white text-slate-900 shadow-lg'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:border-white/30 hover:bg-white/10'
                    }`}
                    type="button"
                  >
                    🇬🇧 English
                  </button>
                </div>
              </div>
              
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-2 px-2">{language === 'fr' ? 'Ligue' : 'League'}</p>
                <div className="w-full">
                  <GenderToggle value={gender} onChange={setGender} language={language} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950" />
                      
                      {/* Article Grid - Fixed position above title */}
                      <div 
                        className={`absolute left-0 right-0 px-8 md:px-16 z-30 transition-all duration-700 ease-out ${
                          isExpanded 
                            ? 'opacity-0 translate-y-8 pointer-events-none' 
                            : 'opacity-100 translate-y-0'
                        }`}
                        style={{bottom: 'calc(1.25rem - 3%)'}}
                      >
                      {newsArticles.length > 0 && (


                          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 max-w-4xl mx-auto">
                            {(() => {
                              // On mobile (< 640px): show 2 articles with rotation
                              // On desktop (>= 640px): show first 3 articles, no rotation
                              const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
                              const articlesToShow = 3;
                              const gridArticles = [];
                              
                              if (isMobile) {
                                // Mobile: rotate through articles
                                for (let i = 0; i < articlesToShow; i++) {
                                  const index = (newsGridStartIndex + i) % newsArticles.length;
                                  gridArticles.push(newsArticles[index]);
                                }
                              } else {
                                // Desktop: always show first 3 articles
                                for (let i = 0; i < Math.min(articlesToShow, newsArticles.length); i++) {
                                  gridArticles.push(newsArticles[i]);
                                }
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
                                      // Scroll to news section
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
                                {/* Glassy Progress Bar - Only show on active featured article */}
                                {article.id === featured.id && !expandedArticleId && (
                                  <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 overflow-hidden z-20">
                                    <div 
                                      className="h-full bg-white/40 backdrop-blur-md relative"
                                      style={{
                                        animation: 'progressBar 15s linear infinite'
                                      }}
                                    >
                                      {/* Subtle shimmer */}
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
                          
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedArticleId(isExpanded ? null : featured.id);
                            }}
                            type="button"
                            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:border-white/40 hover:bg-white/20 active:scale-95 w-fit cursor-pointer"
                          >
                            {language === 'fr' ? (isExpanded ? "Fermer" : "Voir l'article »") : (isExpanded ? "Close" : "Read Article »")}
                          </button>
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
                                {/* Close button - top right */}
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedArticleId(null);
                                  }}
                                  className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-white transition hover:border-white/40 hover:bg-white/20 hover:rotate-90 active:scale-95 cursor-pointer z-50"
                                  type="button"
                                  aria-label="Close article"
                                >
                                  <span className="text-xl leading-none">×</span>
                                </button>

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
                                    <div className="text-base md:text-lg leading-relaxed text-slate-200 space-y-4">
                                      {(language === 'en' && featured.summary_en ? featured.summary_en : featured.summary)
                                        .split('\n\n')
                                        .filter(para => para.trim())
                                        .map((paragraph, idx) => (
                                          <p key={idx} className="first-letter:text-3xl first-letter:font-bold first-letter:text-orange-400 first-letter:mr-1 first-letter:float-left first-letter:leading-none first-of-type:first-letter:text-5xl">
                                            {paragraph}
                                          </p>
                                        ))
                                      }
                                    </div>
                                  </div>

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
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Player Profile Pic */}
                <div className="relative h-32 w-32 flex-shrink-0">
                  <Image
                    src={playerData.headshot || '/logos/liprobakin.png'}
                    alt={playerData.name}
                    fill
                    className="rounded-full border-4 border-white/20 object-cover"
                  />
                </div>
                
                {/* Player Stats */}
                <div className="flex-1 space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <h3 className="text-2xl font-bold text-white">{playerData.name}</h3>
                    <p className="text-sm text-slate-400">#{playerData.number} • {userProfile.teamName}</p>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">PTS</p>
                      <p className="text-2xl font-bold text-white">{playerData.stats.pts}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">REB</p>
                      <p className="text-2xl font-bold text-white">{playerData.stats.reb}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">AST</p>
                      <p className="text-2xl font-bold text-white">{playerData.stats.pts ? Math.floor(Number(playerData.stats.pts) * 0.3) : '0'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">BLK</p>
                      <p className="text-2xl font-bold text-white">{playerData.stats.stl}</p>
                    </div>
                  </div>
                  
                  {/* Next Game */}
                  {nextGame && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Next Game</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-white">vs</span>
                          <span className="text-lg font-semibold text-white">
                            {nextGame.homeTeam === userProfile.teamName ? nextGame.awayTeam : nextGame.homeTeam}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white">{nextGame.dateTime ? formatGameDateTime(nextGame.dateTime, language) : "TBD"}</p>
                          <p className="text-xs text-slate-400">{nextGame.venue}</p>
                        </div>
                      </div>
                    </div>
                  )}
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
          />
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
              <div 
                ref={scheduleScrollRef}
                className="space-y-4 max-h-[600px] md:max-h-[700px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 scroll-smooth"
              >
                {weeklyScheduleGames.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-slate-400">{language === 'fr' ? "Aucun match n'est encore prévu." : "No games scheduled yet."}</p>
                  </div>
                ) : (
                  weeklyScheduleGames.map((game) => (
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
                ))
              )}
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
          />
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 overflow-hidden">
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
            <div className="mt-6 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {[...leagueTopPlayers]
                .filter((player) => player.teamGender === gender)
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
            {leagueTopPlayers.length > 3 && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setLeagueLeadersExpanded(!leagueLeadersExpanded)}
                  className="group relative overflow-hidden rounded-xl border border-white/20 bg-white/5 backdrop-blur-md px-5 py-2.5 text-sm font-medium text-white transition-all hover:border-white/40 hover:bg-white/10 active:scale-95"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {leagueLeadersExpanded ? (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        Show Top 10
                        <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </span>
                  {/* Subtle shimmer on hover */}
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
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

        <section id="teams" className="space-y-6 sm:space-y-8">
          <SectionHeader
            id="teams"
            eyebrow={sectionCopy.teams.eyebrow}
            title={sectionCopy.teams.title}
          />
          <div className="relative px-1 sm:px-0">
            <div 
              className="overflow-x-auto overflow-y-hidden pb-6 -mx-1 px-1" 
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              <div className="grid grid-flow-col grid-rows-2 auto-cols-[minmax(180px,1fr)] gap-3 pb-2 sm:auto-cols-[minmax(220px,1fr)] md:auto-cols-[minmax(260px,1fr)] lg:auto-cols-[minmax(300px,1fr)] sm:gap-4">
                {genderFranchises.map((team) => {
                  const fullName = [team.city, team.name].filter(Boolean).join(" ").trim();
                  return (
                    <Link
                      key={fullName}
                      href={`/team/${encodeURIComponent(fullName)}`}
                      className="group relative rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/40 via-slate-900/60 to-slate-950/80 p-4 sm:p-6 text-left transition-all duration-300 active:scale-95 sm:hover:scale-[1.02] hover:border-white/30 sm:hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 overflow-hidden"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${team.colors[0]}15, ${team.colors[1]}08)`
                      }}
                    >
                      {/* Glow effect on hover */}
                      <div 
                        className="absolute inset-0 opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 blur-xl pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at 50% 50%, ${team.colors[0]}30, transparent 70%)`
                        }}
                      />
                      
                      <div className="relative z-10">
                        {team.logo ? (
                          <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                            <div className="relative flex-shrink-0">
                              <div 
                                className="absolute inset-0 rounded-full blur-md opacity-50 sm:group-hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: team.colors[0] }}
                              />
                              <Image
                                src={team.logo}
                                alt={`${fullName} logo`}
                                width={56}
                                height={56}
                                className="relative h-11 w-11 sm:h-14 sm:w-14 rounded-full border-2 border-white/30 object-cover shadow-lg"
                              />
                            </div>
                            <p className="text-sm sm:text-lg font-bold text-white tracking-tight leading-tight line-clamp-2">{fullName}</p>
                          </div>
                        ) : (
                          <p className="text-sm sm:text-lg font-bold text-white mb-3 sm:mb-4 line-clamp-2">{fullName}</p>
                        )}
                        
                        {/* Color bars with enhanced styling */}
                        <div className="mt-4 sm:mt-5 flex gap-2 sm:gap-2.5">
                          {team.colors.map((color, idx) => (
                            <div key={`${fullName}-${color}`} className="flex-1 relative">
                              <div
                                className="h-2 sm:h-2.5 rounded-full shadow-md transition-all duration-300 sm:group-hover:h-3 sm:group-hover:shadow-lg"
                                style={{ 
                                  backgroundColor: color,
                                  boxShadow: `0 0 8px ${color}40, 0 0 12px ${color}30`
                                }}
                              />
                              <div
                                className="absolute inset-0 h-2 sm:h-2.5 rounded-full opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 blur-sm pointer-events-none"
                                style={{ backgroundColor: color }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* Navigation buttons - hidden on mobile, visible on tablet+ */}
            <button
              type="button"
              onClick={(e) => {
                const container = e.currentTarget.parentElement?.querySelector('.overflow-x-auto');
                if (container) container.scrollBy({ left: -400, behavior: 'smooth' });
              }}
              className="hidden sm:flex absolute left-0 top-1/2 z-10 -translate-y-1/2 h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-600 to-orange-700 text-white shadow-xl transition-all hover:scale-110 hover:from-orange-500 hover:to-orange-600 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 active:scale-95"
              aria-label="Scroll left"
            >
              <svg className="h-6 w-6 lg:h-7 lg:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                const container = e.currentTarget.parentElement?.querySelector('.overflow-x-auto');
                if (container) container.scrollBy({ left: 400, behavior: 'smooth' });
              }}
              className="hidden sm:flex absolute right-0 top-1/2 z-10 -translate-y-1/2 h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-600 to-orange-700 text-white shadow-xl transition-all hover:scale-110 hover:from-orange-500 hover:to-orange-600 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 active:scale-95"
              aria-label="Scroll right"
            >
              <svg className="h-6 w-6 lg:h-7 lg:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
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
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 p-2">
              {dynamicPartners.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 h-full">
                  {visiblePartners.map((partnerIndex, position) => {
                    const partner = dynamicPartners[partnerIndex];
                    if (!partner) return null;
                    
                    return (
                      <div
                        key={`${position}-${partnerIndex}`}
                         className={`relative flex items-center justify-center rounded-lg border overflow-hidden transition-all duration-500 ${
                          partnerAnimating === position
                            ? 'border-white/20 bg-black scale-95 brightness-50'
                            : 'border-white/5 bg-slate-950/50 scale-100 brightness-100'
                        }`}
                      >
                        <div className={`relative w-full h-full p-2 transition-all duration-500 ${
                          partnerAnimating === position
                            ? 'opacity-0 blur-sm'
                            : 'opacity-100 blur-0'
                        }`}>
                          {partner.logo ? (
                            <div className="relative w-full h-full">
                              <Image
                                src={partner.logo}
                                alt={partner.name}
                                fill
                                className="object-contain"
                              />
                            </div>
                          ) : (
                            <p className="text-xs md:text-sm font-semibold text-white text-center h-full flex items-center justify-center">
                              {partner.name}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p className="text-xs md:text-base">No partners yet</p>
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
        />
      ) : null}
    </div>
  );
}
