"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  conferenceStandings,
  conferenceStandingsWomen,
  featuredMatchups,
  franchises,
  franchisesWomen,
  latestGames,
  navSections,
  spotlightPlayers,
  spotlightPlayersWomen,
  upcomingSchedule,
  teamRosters,
} from "@/data/febaco";
import type { FeaturedMatchup, Franchise, RosterPlayer, SpotlightPlayer } from "@/data/febaco";

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
        description: "Marquee Liprobakin matchups set to headline the weekly slate.",
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
        description: "Déplacements, rivalités et showcases au programme.",
      },
      players: {
        eyebrow: "Joueurs",
        title: "Projecteur",
        description: "La température des prospects selon les rapports Liprobakin.",
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
        description: "Neuf équipes en route vers le showcase Liprobakin.",
      },
      teams: {
        eyebrow: "Équipes",
        title: "Franchises",
        description: "Neuf clubs qui donnent le ton à la montée Liprobakin.",
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
const allFranchises = [...franchises, ...franchisesWomen];

const findFranchiseByName = (teamName: string) => {
  const normalized = teamName.toLowerCase();
  return allFranchises.find((team) => {
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

const LeaderRow = ({ leader }: { leader: FeaturedMatchup["leaders"][number] }) => {
  const franchise = findFranchiseByName(leader.team);
  const headshot = playerHeadshots[leader.player];
  const initials = leader.player
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName = leader.player.trim().split(" ").pop() ?? leader.player;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {headshot ? (
          <Image
            src={headshot}
            alt={`${leader.player} portrait`}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full border border-white/20 object-cover"
          />
        ) : franchise?.logo ? (
          <Image
            src={franchise.logo}
            alt={`${formatFranchiseName(franchise)} logo`}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full border border-white/20 bg-white/5 object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
            {initials}
          </span>
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{leader.team}</p>
          <p className="text-lg font-semibold text-white">{displayName}</p>
          <p className="text-xs text-slate-400">{leader.stats}</p>
        </div>
      </div>
    </div>
  );
};

const MatchupTeam = ({ team, record }: { team: string; record: string }) => {
  const franchise = findFranchiseByName(team);
  const displayName = franchise ? formatFranchiseName(franchise) : team;
  const colors = franchise?.colors ?? ["#1e293b", "#0f172a"];
  const label = franchise?.city?.trim();
  const showLabel = Boolean(label && label.toLowerCase() !== displayName.toLowerCase());
  const initials = team
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {franchise?.logo ? (
        <Image
          src={franchise.logo}
          alt={`${displayName} logo`}
          width={72}
          height={72}
          className="h-20 w-20 rounded-full border border-white/10 bg-white/5 object-cover"
        />
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-xl font-semibold">
          {initials}
        </span>
      )}
      <div>
        {showLabel ? (
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{label}</p>
        ) : null}
        <p className="text-xl font-semibold text-white">{displayName}</p>
        <p className="text-xs text-slate-400">{record}</p>
      </div>
      <div className="flex w-24 gap-1">
        {colors.map((color) => (
          <span key={`${team}-${color}`} className="h-1 flex-1 rounded-full" style={{ backgroundColor: color }} />
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
}: {
  team: string;
  score: number;
  highlight?: boolean;
  showRecord?: boolean;
}) => {
  const franchise = findFranchiseByName(team);
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

const ScheduleTeam = ({ team, label }: { team: string; label: string }) => {
  const franchise = findFranchiseByName(team);
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

const RosterModal = ({ teamName, roster, onClose }: { teamName: string; roster: RosterPlayer[]; onClose: () => void }) => {
  const franchise = findFranchiseByName(teamName);

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
  const genderStandings = gender === "men" ? conferenceStandings : conferenceStandingsWomen;
  const genderFranchises = gender === "men" ? franchises : franchisesWomen;
  const playerLeaders = [...genderPlayers].sort(
    (a, b) => b.leaderboard[playerMetric] - a.leaderboard[playerMetric]
  );
  const spotlightGames = [...featuredMatchups]
    .sort((a, b) => parseTipoffToDate(a.tipoff) - parseTipoffToDate(b.tipoff))
    .slice(0, 3);

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
              {navSections
                .filter((section) => section !== "News")
                .map((section) => (
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
          className="lg:hidden border-b border-white/10 bg-black/90 backdrop-blur"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:px-8">
            {mobileNavSections.map((section) => (
              <Link
                key={section}
                href={`#${slug(section)}`}
                className="text-base font-semibold uppercase tracking-[0.3em] text-white"
                onClick={() => setMobileNavOpen(false)}
              >
                {copy.nav[slug(section) as keyof typeof copy.nav] ?? section}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <main className="mx-auto flex max-w-6xl flex-col gap-24 px-4 pb-24 pt-8 md:px-8">
        <section id="stats" className="space-y-8">
          <SectionHeader
            id="stats"
            title={sectionCopy.stats.title}
            description={sectionCopy.stats.description}
          />
          <div className="space-y-6">
            {spotlightGames.map((matchup) => (
              <article
                key={matchup.id}
                className="grid gap-6 rounded-3xl border border-white/5 bg-slate-900/70 p-6 shadow-lg shadow-black/30 lg:grid-cols-[2fr_1fr]"
              >
                <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
                  <MatchupTeam team={matchup.away.team} record={matchup.away.record} />
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <span className="rounded-full border border-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-300">
                      {matchup.status}
                    </span>
                    <div>
                      <p className="text-xl font-semibold text-white">{matchup.tipoff}</p>
                      <p className="text-sm text-slate-300">{matchup.venue}</p>
                    </div>
                  </div>
                  <MatchupTeam team={matchup.home.team} record={matchup.home.record} />
                </div>
                <div className="space-y-4 rounded-2xl border border-white/5 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Leaders</p>
                  <div className="space-y-4">
                    {matchup.leaders.map((leader) => (
                      <LeaderRow key={`${matchup.id}-${leader.player}`} leader={leader} />
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="games" className="space-y-8">
          <SectionHeader
            id="games"
            eyebrow={sectionCopy.games.eyebrow}
            title={sectionCopy.games.title}
            description={sectionCopy.games.description}
          />
          <div className="grid gap-6 md:grid-cols-2">
            {latestGames.map((game) => (
              <article
                key={game.id}
                className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-lg shadow-black/40"
              >
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{game.status}</p>
                <div className="mt-4 space-y-3">
                  <ScoreTeamRow team={game.home} score={game.homeScore} highlight />
                  <ScoreTeamRow team={game.away} score={game.awayScore} />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>{game.venue}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="schedule" className="space-y-8">
          <SectionHeader
            id="schedule"
            eyebrow={sectionCopy.schedule.eyebrow}
            title={sectionCopy.schedule.title}
            description={sectionCopy.schedule.description}
          />
          <div className="divide-y divide-white/5 rounded-3xl border border-white/5 bg-slate-950/70">
            {upcomingSchedule.map((game) => (
              <div key={game.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex items-center justify-between sm:block">
                  <p className="text-sm font-semibold text-white">{game.date}</p>
                  <p className="text-xs text-slate-400">{game.time}</p>
                </div>
                <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
                  <ScheduleTeam team={game.away} label="Away" />
                  <span className="text-xs uppercase tracking-[0.4em] text-slate-500">at</span>
                  <ScheduleTeam team={game.home} label="Home" />
                </div>
                <div className="text-sm text-slate-300 sm:min-w-[150px] sm:text-right">
                  <p>{game.venue}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="players" className="space-y-8">
          <SectionHeader
            id="players"
            eyebrow={sectionCopy.players.eyebrow}
            title={sectionCopy.players.title}
            description={sectionCopy.players.description}
          />
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
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
              {playerLeaders.map((player, index) => {
                const isLeader = index === 0;
                const playerFranchise = findFranchiseByName(player.team);
                const playerImage = player.photo || playerFranchise?.logo || "/logos/liprobakin.png";
                return (
                  <button
                    key={`${player.name}-${playerMetric}`}
                    type="button"
                    onClick={() => setSelectedPlayer(player)}
                    className={`flex w-full flex-col gap-4 rounded-3xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:flex-row sm:items-center sm:justify-between ${
                      isLeader
                        ? "border-white/40 bg-gradient-to-r from-sky-500/20 to-indigo-500/10 px-8 py-6 shadow-lg shadow-sky-500/20"
                        : "border-white/10 bg-slate-900/60 px-6 py-4 hover:border-white/50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`font-semibold ${isLeader ? "text-lg text-white" : "text-sm text-slate-400"}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="flex items-center gap-3">
                        <Image
                          src={playerImage}
                          alt={`${player.name} portrait`}
                          width={isLeader ? 72 : 56}
                          height={isLeader ? 72 : 56}
                          className="rounded-full border border-white/10 object-cover"
                          style={{
                            width: isLeader ? 72 : 56,
                            height: isLeader ? 72 : 56,
                          }}
                        />
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            #{player.number} · {player.team}
                          </p>
                          <p className={`${isLeader ? "text-2xl" : "text-lg"} font-semibold text-white`}>
                            {player.name}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={`${isLeader ? "text-4xl" : "text-2xl"} font-bold text-white sm:self-auto sm:text-right`}>
                      {player.leaderboard[playerMetric].toFixed(1)}
                    </span>
                  </button>
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
            description={sectionCopy.standings.description}
          />
          <div className="overflow-hidden rounded-2xl border border-white/5">
            <div className="max-sm:overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.3em] text-slate-300">
                <tr>
                  <th className="px-4 py-3">Seed</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">W</th>
                  <th className="px-4 py-3">L</th>
                  <th className="px-4 py-3">Streak</th>
                  <th className="px-4 py-3">Last 10</th>
                  <th className="px-4 py-3">Tot Points</th>
                </tr>
              </thead>
              <tbody>
                {genderStandings.map((row) => (
                  <tr key={row.team} className="odd:bg-white/5">
                    <td className="px-4 py-3 text-slate-300">{row.seed}</td>
                    <td className="px-4 py-3 font-semibold text-white">{row.team}</td>
                    <td className="px-4 py-3">{row.wins}</td>
                    <td className="px-4 py-3">{row.losses}</td>
                    <td className="px-4 py-3 text-slate-300">{row.streak}</td>
                    <td className="px-4 py-3 text-slate-300">{row.lastTen}</td>
                    <td className="px-4 py-3 font-semibold text-white">{getTotalPoints(row.wins, row.losses)}</td>
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
            description={sectionCopy.teams.description}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {genderFranchises.map((team) => {
              const fullName = [team.city, team.name].filter(Boolean).join(" ").trim();
              const rosterKey = gender === "men" ? fullName : `women:${fullName}`;
              const canOpenRoster = Boolean(teamRosters[rosterKey]);
              return (
                <button
                  type="button"
                  key={fullName}
                  onClick={() => {
                    if (canOpenRoster) {
                      setSelectedTeam({ label: fullName, gender });
                    }
                  }}
                  aria-disabled={!canOpenRoster}
                  className={`rounded-2xl border border-white/5 bg-slate-900/70 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    canOpenRoster ? "hover:border-white/30" : "opacity-80"
                  }`}
                  style={{
                    backgroundImage: `linear-gradient(120deg, ${team.colors[0]}22, ${team.colors[1]}11)`
                  }}
                >
                  {team.logo ? (
                    <div className="mb-4 flex items-center gap-3">
                      <Image
                        src={team.logo}
                        alt={`${fullName} logo`}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full border border-white/20 object-cover"
                      />
                      <p className="text-2xl font-semibold text-white">{fullName}</p>
                    </div>
                  ) : (
                    <p className="text-2xl font-semibold text-white">{fullName}</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    {team.colors.map((color) => (
                      <span
                        key={`${fullName}-${color}`}
                        className="h-1.5 flex-1 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/50 py-8 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-center text-xs uppercase tracking-[0.3em] sm:flex-row sm:items-center sm:justify-between">
          <p>
            {copy.footerTagline}
          </p>
          <div className="flex items-center justify-center gap-3">
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
        </div>
      </footer>
      {selectedTeam && selectedRoster ? (
        <RosterModal teamName={selectedTeam.label} roster={selectedRoster} onClose={() => setSelectedTeam(null)} />
      ) : null}
      {selectedPlayer ? (
        <PlayerStatsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      ) : null}
    </div>
  );
}
