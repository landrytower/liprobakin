"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  conferenceStandings,
  conferenceStandingsWomen,
  franchises,
  franchisesWomen,
  navSections,
  type Franchise,
} from "@/data/febaco";

type Gender = "men" | "women";
type CurrentPartner = { id: string; name: string; logo?: string };
type CurrentTeam = {
  id: string;
  name?: string;
  city?: string;
  gender?: string;
  logo?: string;
  colors?: string[];
};
type CurrentGame = {
  id: string;
  gender?: string;
  completed?: boolean;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number;
  awayScore?: number;
  winnerTeamId?: string;
  winnerScore?: number;
  loserTeamId?: string;
  loserScore?: number;
};

const normalizeTeamName = (name: string) => name.replace(/^espoir\s+espoir\s+/i, "Espoir ").trim();
const normalizeTeamKey = (name: string) => normalizeTeamName(name).toLowerCase();

const formatFranchiseName = (team: Franchise) =>
  normalizeTeamName([team.city, team.name].filter(Boolean).join(" ").trim());

const findFranchiseByName = (teamName: string, allTeams: Franchise[]) => {
  const normalized = normalizeTeamName(teamName).toLowerCase();
  return allTeams.find((team) => {
    const display = formatFranchiseName(team).toLowerCase();
    return display === normalized || normalizeTeamName(team.name).toLowerCase() === normalized;
  });
};

const copy = {
  en: {
    brand: "LIPROBAKIN",
    title: "Latest Standings",
    subtitle: "Full classement across all teams",
    men: "Gentlemen",
    women: "Ladies",
    nav: {
      games: "Games",
      schedule: "Schedule",
      players: "Players",
      news: "News",
      stats: "Stats",
      standings: "Standings",
      teams: "Teams",
    },
    seed: "Seed",
    team: "Team",
    gamesPlayed: "GP",
    wins: "W",
    losses: "L",
    pointsScoredTotal: "Points Scored (Total)",
    pointsScoredAvg: "Points Scored (Avg)",
    pointsAllowedTotal: "Points Allowed (Total)",
    pointsAllowedAvg: "Points Allowed (Avg)",
    difference: "Difference",
    footerTagline: "Liprobakin League",
  },
  fr: {
    brand: "LIPROBAKIN",
    title: "Classement",
    subtitle: "Classement complet de toutes les équipes",
    men: "Messieurs",
    women: "Dames",
    nav: {
      games: "Matchs",
      schedule: "Calendrier",
      players: "Joueurs",
      news: "Actualités",
      stats: "Stats",
      standings: "Classement",
      teams: "Équipes",
    },
    seed: "N°",
    team: "Équipe",
    gamesPlayed: "MJ",
    wins: "V",
    losses: "D",
    pointsScoredTotal: "Points marqués (total)",
    pointsScoredAvg: "Points marqués (moy)",
    pointsAllowedTotal: "Points encaissés (total)",
    pointsAllowedAvg: "Points encaissés (moy)",
    difference: "Difference",
    footerTagline: "Ligue Liprobakin",
  },
} as const;

export default function ClassementPage() {
  const { language } = useLanguage();
  const t = copy[language] ?? copy.fr;
  const [gender, setGender] = useState<Gender>("men");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentPartners, setCurrentPartners] = useState<CurrentPartner[]>([]);
  const [currentTeams, setCurrentTeams] = useState<CurrentTeam[]>([]);
  const [currentGames, setCurrentGames] = useState<CurrentGame[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firebaseDB, "teams"),
      (snapshot) => {
        const teams = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<CurrentTeam, "id">),
        }));
        setCurrentTeams(teams);
      },
      (error) => {
        console.error("Error loading current teams:", error);
        setCurrentTeams([]);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchCurrentPartners = async () => {
      try {
        const snapshot = await getDocs(collection(firebaseDB, "partners"));
        const partners = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Partner",
          logo: doc.data().logo || undefined,
        }));
        setCurrentPartners(partners);
      } catch (error) {
        console.error("Error loading current partners:", error);
        setCurrentPartners([]);
      }
    };

    fetchCurrentPartners();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firebaseDB, "games"),
      (snapshot) => {
        const games = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<CurrentGame, "id">),
        }));
        setCurrentGames(games);
      },
      (error) => {
        console.error("Error loading current games:", error);
        setCurrentGames([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const fallbackStandings = useMemo(
    () => (gender === "men" ? conferenceStandings : conferenceStandingsWomen),
    [gender]
  );

  const standings = useMemo(() => {
    const liveGenderTeams = currentTeams.filter((team) => (team.gender ?? "men") === gender);

    if (liveGenderTeams.length === 0) {
      return fallbackStandings.map((row) => ({ team: row.team }));
    }

    const unique = new Map<string, { team: string }>();
    liveGenderTeams.forEach((team) => {
      const display = normalizeTeamName([team.city, team.name].filter(Boolean).join(" ").trim() || team.id);
      unique.set(normalizeTeamKey(display), { team: display });
    });

    return Array.from(unique.values());
  }, [currentTeams, fallbackStandings, gender]);

  const teams = useMemo<Franchise[]>(() => {
    const liveGenderTeams = currentTeams.filter((team) => (team.gender ?? "men") === gender);
    if (liveGenderTeams.length === 0) {
      return gender === "men" ? franchises : franchisesWomen;
    }

    return liveGenderTeams.map((team): Franchise => ({
      city: team.city ?? "",
      name: team.name ?? team.id,
      colors:
        Array.isArray(team.colors) && team.colors.length >= 2
          ? [team.colors[0], team.colors[1]] as [string, string]
          : ["#1e293b", "#0f172a"] as [string, string],
      logo: team.logo,
    }));
  }, [currentTeams, gender]);

  const scoreStatsByTeam = useMemo(() => {
    const selectedTeamKeys = new Set(
      standings.map((row) => normalizeTeamKey(row.team))
    );

    const map = new Map<string, { played: number; scored: number; allowed: number; wins: number; losses: number }>();

    currentGames.forEach((game) => {
      if (game.gender && game.gender !== gender) {
        return;
      }

      if (!game.completed) {
        return;
      }

      let homeScore = game.homeScore;
      let awayScore = game.awayScore;

      if (typeof homeScore !== "number" || typeof awayScore !== "number") {
        if (
          typeof game.winnerScore === "number" &&
          typeof game.loserScore === "number" &&
          game.winnerTeamId &&
          game.homeTeamId &&
          game.awayTeamId
        ) {
          if (game.winnerTeamId === game.homeTeamId) {
            homeScore = game.winnerScore;
            awayScore = game.loserScore;
          } else if (game.winnerTeamId === game.awayTeamId) {
            homeScore = game.loserScore;
            awayScore = game.winnerScore;
          }
        }
      }

      if (typeof homeScore !== "number" || typeof awayScore !== "number") {
        return;
      }

      const homeKey = normalizeTeamKey(game.homeTeamName ?? "");
      const awayKey = normalizeTeamKey(game.awayTeamName ?? "");

      if (selectedTeamKeys.has(homeKey)) {
        const current = map.get(homeKey) ?? { played: 0, scored: 0, allowed: 0, wins: 0, losses: 0 };
        current.played += 1;
        current.scored += homeScore;
        current.allowed += awayScore;
        if (homeScore > awayScore) {
          current.wins += 1;
        } else {
          current.losses += 1;
        }
        map.set(homeKey, current);
      }

      if (selectedTeamKeys.has(awayKey)) {
        const current = map.get(awayKey) ?? { played: 0, scored: 0, allowed: 0, wins: 0, losses: 0 };
        current.played += 1;
        current.scored += awayScore;
        current.allowed += homeScore;
        if (awayScore > homeScore) {
          current.wins += 1;
        } else {
          current.losses += 1;
        }
        map.set(awayKey, current);
      }
    });

    return map;
  }, [currentGames, gender, standings]);

  const sortedStandings = useMemo(() => {
    return [...standings].sort((a, b) => {
      const aStats = scoreStatsByTeam.get(normalizeTeamKey(a.team)) ?? {
        played: 0,
        scored: 0,
        allowed: 0,
        wins: 0,
        losses: 0,
      };
      const bStats = scoreStatsByTeam.get(normalizeTeamKey(b.team)) ?? {
        played: 0,
        scored: 0,
        allowed: 0,
        wins: 0,
        losses: 0,
      };

      if (bStats.wins !== aStats.wins) return bStats.wins - aStats.wins;
      if (aStats.losses !== bStats.losses) return aStats.losses - bStats.losses;

      const aDiff = aStats.scored - aStats.allowed;
      const bDiff = bStats.scored - bStats.allowed;
      if (bDiff !== aDiff) return bDiff - aDiff;

      return normalizeTeamName(a.team).localeCompare(normalizeTeamName(b.team));
    });
  }, [scoreStatsByTeam, standings]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
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
            <span className="hidden xs:inline sm:inline">{t.brand}</span>
          </Link>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 p-2 text-white transition hover:bg-white/10 lg:hidden"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-expanded={mobileNavOpen}
            aria-controls="classement-mobile-nav"
            aria-label="Toggle navigation menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {mobileNavOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>

          <div className="hidden gap-8 text-xs font-medium uppercase tracking-[0.3em] text-slate-300 lg:flex">
            {navSections.map((section) => (
              <Link
                key={section}
                href={`/#${section.toLowerCase()}`}
                className="transition hover:text-white hover:scale-105 whitespace-nowrap"
              >
                {t.nav[section.toLowerCase() as keyof typeof t.nav] ?? section}
              </Link>
            ))}
            <Link
              href="/d2"
              className="group relative px-2 py-1.5 text-[13px] font-bold uppercase tracking-[0.28em] text-amber-200/90 transition-colors duration-300 hover:text-amber-100"
            >
              <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                EUBAKIN
              </span>
            </Link>
          </div>
        </div>

        {mobileNavOpen ? (
          <div id="classement-mobile-nav" className="border-t border-white/10 px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
              {navSections.map((section) => (
                <Link
                  key={section}
                  href={`/#${section.toLowerCase()}`}
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-md px-2 py-2 transition hover:bg-white/10 hover:text-white"
                >
                  {t.nav[section.toLowerCase() as keyof typeof t.nav] ?? section}
                </Link>
              ))}
              <Link
                href="/d2"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md px-2 py-2 text-amber-200 transition hover:bg-white/10"
              >
                EUBAKIN
              </Link>
            </div>
          </div>
        ) : null}
      </nav>

      <main className="w-full px-[5%] py-6">
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4 pb-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">{t.title}</h1>
            <p className="text-base text-slate-300">{t.subtitle}</p>
          </div>

          <div className="inline-flex gap-2 text-sm font-medium">
            <button
              type="button"
              onClick={() => setGender("men")}
              className={`px-3 py-1.5 ${
                gender === "men" ? "border-b-2 border-white text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.men}
            </button>
            <button
              type="button"
              onClick={() => setGender("women")}
              className={`px-3 py-1.5 ${
                gender === "women" ? "border-b-2 border-white text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.women}
            </button>
          </div>
        </div>

        <div className="mt-2 w-full overflow-x-auto">
            <div className="max-h-[1080px] overflow-y-auto">
              <table className="w-full min-w-[980px] md:min-w-[1320px] border-collapse text-left text-sm md:text-base">
              <thead className="border-y border-white/15 text-slate-300">
                <tr>
                  <th className="sticky left-0 z-30 w-10 min-w-10 bg-slate-950 px-1.5 py-2 text-center whitespace-nowrap md:static md:w-auto md:min-w-0 md:px-2 md:py-3">{t.seed}</th>
                  <th className="sticky left-10 z-30 w-[1%] min-w-0 bg-slate-950 pl-1 pr-0 py-2 whitespace-nowrap text-slate-200 md:static md:w-auto md:min-w-0 md:pr-0 md:py-3">{t.team}</th>
                  <th className="px-2 py-2 text-center whitespace-nowrap md:px-3 md:py-3">{t.gamesPlayed}</th>
                  <th className="px-2 py-2 text-center whitespace-nowrap md:px-3 md:py-3">{t.wins}</th>
                  <th className="px-2 py-2 text-center whitespace-nowrap md:px-3 md:py-3">{t.losses}</th>
                  <th className="px-2 py-2 text-center align-middle md:px-3 md:py-3">
                    <span className="inline-flex flex-col items-center leading-tight">
                      {language === "fr" ? (
                        <>
                          <span>Points</span>
                          <span>marqués</span>
                          <span>(total)</span>
                        </>
                      ) : (
                        <>
                          <span>Points</span>
                          <span>Scored</span>
                          <span>(Total)</span>
                        </>
                      )}
                    </span>
                  </th>
                  <th className="px-2 py-2 text-center align-middle md:px-3 md:py-3">
                    <span className="inline-flex flex-col items-center leading-tight">
                      {language === "fr" ? (
                        <>
                          <span>Points</span>
                          <span>marqués</span>
                          <span>(moy)</span>
                        </>
                      ) : (
                        <>
                          <span>Points</span>
                          <span>Scored</span>
                          <span>(Avg)</span>
                        </>
                      )}
                    </span>
                  </th>
                  <th className="px-2 py-2 text-center align-middle md:px-3 md:py-3">
                    <span className="inline-flex flex-col items-center leading-tight">
                      {language === "fr" ? (
                        <>
                          <span>Points</span>
                          <span>encaissés</span>
                          <span>(total)</span>
                        </>
                      ) : (
                        <>
                          <span>Points</span>
                          <span>Allowed</span>
                          <span>(Total)</span>
                        </>
                      )}
                    </span>
                  </th>
                  <th className="px-2 py-2 text-center align-middle md:px-3 md:py-3">
                    <span className="inline-flex flex-col items-center leading-tight">
                      {language === "fr" ? (
                        <>
                          <span>Points</span>
                          <span>encaissés</span>
                          <span>(moyenne)</span>
                        </>
                      ) : (
                        <>
                          <span>Points</span>
                          <span>Allowed</span>
                          <span>(Avg)</span>
                        </>
                      )}
                    </span>
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap md:px-3 md:py-3">{t.difference}</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((row, index) => {
                  const franchise = findFranchiseByName(row.team, teams);
                  const displayName = franchise ? formatFranchiseName(franchise) : normalizeTeamName(row.team);
                  const rawTeamStats =
                    scoreStatsByTeam.get(normalizeTeamKey(displayName)) ??
                    scoreStatsByTeam.get(normalizeTeamKey(row.team)) ??
                    { played: 0, scored: 0, allowed: 0, wins: 0, losses: 0 };
                  const teamStats = rawTeamStats;
                  const wins = teamStats.wins;
                  const losses = teamStats.losses;
                  const scoredAvg = teamStats.played > 0 ? (teamStats.scored / teamStats.played).toFixed(1) : "0.0";
                  const allowedAvg = teamStats.played > 0 ? (teamStats.allowed / teamStats.played).toFixed(1) : "0.0";
                  const difference = teamStats.scored - teamStats.allowed;
                  const teamLogo = franchise?.logo;
                  const shortName = displayName.length > 10 ? `${displayName.slice(0, 10)}...` : displayName;
                  const initials = displayName
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr key={`${gender}-${row.team}`} className="border-b border-white/10">
                      <td className="sticky left-0 z-20 w-10 min-w-10 bg-slate-950 px-1.5 py-1.5 text-center text-slate-300 tabular-nums md:static md:w-auto md:min-w-0 md:px-2 md:py-3">{index + 1}</td>
                      <td className="sticky left-10 z-20 w-[1%] min-w-0 bg-slate-950 pl-1 pr-0 py-1.5 whitespace-nowrap md:static md:w-auto md:min-w-0 md:pr-0 md:py-3">
                        <Link
                          href={`/team/${encodeURIComponent(displayName)}`}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-slate-100 transition-colors hover:text-white md:text-sm"
                        >
                          {teamLogo ? (
                            <Image
                              src={teamLogo}
                              alt={`${displayName} logo`}
                              width={30}
                              height={30}
                              className="h-6 w-6 rounded-full border border-white/10 bg-white/5 object-cover md:h-7 md:w-7"
                            />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-slate-300 md:h-7 md:w-7">
                              {initials}
                            </span>
                          )}
                          <span title={displayName}>{shortName}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums md:px-3 md:py-3">{teamStats.played}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums md:px-3 md:py-3">{wins}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums md:px-3 md:py-3">{losses}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums md:px-3 md:py-3">{teamStats.scored}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums md:px-3 md:py-3">{scoredAvg}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums md:px-3 md:py-3">{teamStats.allowed}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums md:px-3 md:py-3">{allowedAvg}</td>
                      <td className="px-2 py-1.5 text-center font-semibold tabular-nums md:px-3 md:py-3">{difference > 0 ? `+${difference}` : difference}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
        </div>
      </main>

      {currentPartners.length > 0 ? (
        <div className="border-t border-white/5 bg-black/30 py-7">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-center gap-7 sm:gap-10 flex-wrap">
              {currentPartners.map((partner) => (
                <div
                  key={partner.id}
                  className="flex-shrink-0 h-9 sm:h-11 opacity-70 hover:opacity-100 transition-opacity"
                >
                  {partner.logo ? (
                    <div className="relative h-full w-18 sm:w-22" style={{ width: "4.5rem" }}>
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
      ) : null}

      <footer className="border-t border-white/10 bg-black/50 py-6 text-slate-400">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs uppercase tracking-[0.3em]">
          <p>{t.footerTagline}</p>
        </div>
      </footer>
    </div>
  );
}
