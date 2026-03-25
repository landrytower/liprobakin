"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { firebaseDB } from "@/lib/firebase/firestore";
import { parseCongoDateTime } from "@/lib/congo-time";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";

type EubakinTeam = {
  id: string;
  name: string;
  conference: "west" | "east";
  gender: "men" | "women";
  wins?: number;
  losses?: number;
};

type EubakinGame = {
  id: string;
  conference: "west" | "east";
  gender: "men" | "women";
  gameDate: string;
  gameTime: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  status?: "scheduled" | "final";
};

const translations = {
  en: {
    title: "EUBAKIN",
    subtitle: "Second Division",
    description: "Welcome to Eubakin, the second division. All echoes and highlights from the second division.",
    gamesTitle: "Schedule",
    standingsTitle: "Standings",
    noGames: "No games scheduled yet for this selection.",
    noStandings: "No teams available yet for this selection.",
    loadingGames: "Loading games...",
    loadingStandings: "Loading standings...",
    timeOfGame: "time of the game",
    finalScore: "final score",
    pendingScore: "-",
    rank: "Rank",
    team: "Team",
    record: "Record",
    comingSoon: "Coming Soon",
    backToHome: "← Back to Home",
    west: "Ouest",
    east: "Est",
    features: {
      games: "Eubakin Games",
      gamesDesc: "Follow all Division 2 matchups and scores",
      standings: "Standings",
      standingsDesc: "Track team rankings and playoff positioning",
      players: "Players",
      playersDesc: "Discover rising talent in Division 2",
    },
  },
  fr: {
    title: "EUBAKIN",
    subtitle: "La deuxième division",
    description: "Bienvenue sur Eubakin, la deuxième division. Tous les échos et temps forts de la deuxième division.",
    gamesTitle: "Calendrier",
    standingsTitle: "Classement",
    noGames: "Aucun match programmé pour cette sélection.",
    noStandings: "Aucune équipe disponible pour cette sélection.",
    loadingGames: "Chargement des matchs...",
    loadingStandings: "Chargement du classement...",
    timeOfGame: "heure du match",
    finalScore: "score final",
    pendingScore: "-",
    rank: "Rang",
    team: "Équipe",
    record: "Bilan",
    comingSoon: "Bientôt disponible",
    backToHome: "← Retour à l'accueil",
    west: "Ouest",
    east: "Est",
    features: {
      games: "Matchs Eubakin",
      gamesDesc: "Suivez tous les matchs et scores de la Division 2",
      standings: "Classements",
      standingsDesc: "Suivez les classements des équipes et les positions en playoffs",
      players: "Joueurs",
      playersDesc: "Découvrez les talents émergents de la Division 2",
    },
  },
};

const teamsRequestCache = new Map<string, Promise<EubakinTeam[]>>();
const gamesRequestCache = new Map<string, Promise<EubakinGame[]>>();

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function D2Page() {
  const { language, setLanguage } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.en;
  const [region, setRegion] = useState<"ouest" | "est">("ouest");
  const [divisionGender, setDivisionGender] = useState<"men" | "women">("men");
  const [standingsGender, setStandingsGender] = useState<"men" | "women">("men");
  const [teams, setTeams] = useState<EubakinTeam[]>([]);
  const [games, setGames] = useState<EubakinGame[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);

  useEffect(() => {
    const cacheKey = "all";

    const fetchTeams = async () => {
      setLoadingTeams(true);
      try {
        const cached = teamsRequestCache.get(cacheKey);
        const request =
          cached ??
          (async () => {
            const snap = await getDocs(
              query(
                collection(firebaseDB, "eubakinTeams"),
                orderBy("name", "asc"),
                limit(500)
              )
            );

            return snap.docs.map((item) => ({
              id: item.id,
              name: item.data().name || "",
              conference: (item.data().conference || "west") as "west" | "east",
              gender: (item.data().gender || "men") as "men" | "women",
              wins: typeof item.data().wins === "number" ? item.data().wins : 0,
              losses: typeof item.data().losses === "number" ? item.data().losses : 0,
            }));
          })();

        if (!cached) {
          teamsRequestCache.set(cacheKey, request);
        }

        setTeams(await request);
      } catch (error) {
        console.error("Error loading EUBAKIN teams", error);
      } finally {
        setLoadingTeams(false);
      }
    };

    fetchTeams();
  }, []);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const fromKey = formatDateKey(today);
    const toKey = formatDateKey(weekEnd);
    const cacheKey = `${fromKey}:${toKey}`;

    const fetchGames = async () => {
      setLoadingGames(true);
      try {
        const cached = gamesRequestCache.get(cacheKey);
        const request =
          cached ??
          (async () => {
            const snap = await getDocs(
              query(
                collection(firebaseDB, "eubakinGames"),
                where("gameDate", ">=", fromKey),
                where("gameDate", "<=", toKey),
                orderBy("gameDate", "asc"),
                limit(300)
              )
            );

            return snap.docs
              .map((item) => ({
                id: item.id,
                conference: (item.data().conference || "west") as "west" | "east",
                gender: (item.data().gender || "men") as "men" | "women",
                gameDate: item.data().gameDate || "",
                gameTime: item.data().gameTime || "",
                homeTeamName: item.data().homeTeamName || "",
                awayTeamName: item.data().awayTeamName || "",
                homeScore: typeof item.data().homeScore === "number" ? item.data().homeScore : undefined,
                awayScore: typeof item.data().awayScore === "number" ? item.data().awayScore : undefined,
                status: (item.data().status || "scheduled") as "scheduled" | "final",
              }))
              .sort((a, b) => {
                const dateCompare = (a.gameDate || "").localeCompare(b.gameDate || "");
                if (dateCompare !== 0) return dateCompare;
                return (a.gameTime || "").localeCompare(b.gameTime || "");
              });
          })();

        if (!cached) {
          gamesRequestCache.set(cacheKey, request);
        }

        setGames(await request);
      } catch (error) {
        console.error("Error loading EUBAKIN games", error);
      } finally {
        setLoadingGames(false);
      }
    };

    fetchGames();
  }, []);

  const visibleStandings = useMemo(() => {
    const wantedConference = region === "ouest" ? "west" : "east";
    return teams
      .filter((team) => team.conference === wantedConference && team.gender === standingsGender)
      .sort((a, b) => {
        const winsA = a.wins ?? 0;
        const winsB = b.wins ?? 0;
        const lossesA = a.losses ?? 0;
        const lossesB = b.losses ?? 0;
        if (winsB !== winsA) return winsB - winsA;
        if (lossesA !== lossesB) return lossesA - lossesB;
        return a.name.localeCompare(b.name);
      });
  }, [region, standingsGender, teams]);

  const visibleGames = useMemo(() => {
    const wantedConference = region === "ouest" ? "west" : "east";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return games.filter((game) => {
      if (!(game.conference === wantedConference && game.gender === divisionGender)) {
        return false;
      }
      if (!game.gameDate) {
        return false;
      }
      const gameDate = new Date(`${game.gameDate}T00:00:00`);
      return gameDate >= today && gameDate <= weekEnd;
    });
  }, [divisionGender, games, region]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <nav className="sticky top-0 live-pin-offset z-50 border-b border-cyan-900/40 bg-[#020715]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 max-[360px]:gap-1.5 px-3 max-[360px]:px-2.5 py-3 max-[360px]:py-2.5 sm:px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl font-semibold tracking-[0.22em] sm:tracking-[0.3em] text-white">
            <Image
              src="/logos/liprobakin.png"
              alt="Liprobakin logo"
              width={34}
              height={34}
              className="h-8 w-8 max-[360px]:h-7 max-[360px]:w-7 rounded-full border border-cyan-500/30 object-cover"
              priority
            />
            <span className="hidden sm:inline">LIPROBAKIN</span>
          </Link>

          <div className="order-3 w-full sm:order-none sm:w-auto flex items-center justify-center gap-1 rounded-full border border-cyan-800/40 bg-[#010a1f]/90 p-1">
            <button
              type="button"
              onClick={() => setRegion("ouest")}
              className={`rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-sm sm:text-base font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] transition-all duration-300 ${
                region === "ouest"
                  ? "bg-amber-300/15 text-amber-200 shadow-[inset_0_0_0_1px_rgba(252,211,77,0.35)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {t.west}
            </button>
            <button
              type="button"
              onClick={() => setRegion("est")}
              className={`rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-sm sm:text-base font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] transition-all duration-300 ${
                region === "est"
                  ? "bg-amber-300/15 text-amber-200 shadow-[inset_0_0_0_1px_rgba(252,211,77,0.35)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {t.east}
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 ml-auto">
            <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/25 p-1">
              <button
                type="button"
                onClick={() => setLanguage("fr")}
                className={`rounded-md px-2 max-[360px]:px-1.5 sm:px-3 py-1 max-[360px]:py-0.5 sm:py-1.5 text-[10px] sm:text-sm font-semibold uppercase transition-colors ${
                  language === "fr"
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`rounded-md px-2 max-[360px]:px-1.5 sm:px-3 py-1 max-[360px]:py-0.5 sm:py-1.5 text-[10px] sm:text-sm font-semibold uppercase transition-colors ${
                  language === "en"
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                EN
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/25 p-1 max-[360px]:p-0.5">
              <button
                type="button"
                onClick={() => setDivisionGender("men")}
                className={`rounded-full px-2 max-[360px]:px-1.5 sm:px-6 py-1 max-[360px]:py-0.5 sm:py-1.5 text-[10px] sm:text-sm font-semibold transition-colors ${
                  divisionGender === "men"
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span className="sm:hidden">G</span>
                <span className="hidden sm:inline">{language === "fr" ? "Messieur" : "Gentlemen"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDivisionGender("women")}
                className={`rounded-full px-2 max-[360px]:px-1.5 sm:px-6 py-1 max-[360px]:py-0.5 sm:py-1.5 text-[10px] sm:text-sm font-semibold transition-colors ${
                  divisionGender === "women"
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span className="sm:hidden">L</span>
                <span className="hidden sm:inline">{language === "fr" ? "Dames" : "Ladies"}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 pb-16 md:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full border border-orange-500/50 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">
            {t.subtitle}
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white md:text-5xl lg:text-6xl">
            {t.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            {t.description}
          </p>
        </div>
      </div>

      {/* Schedule + Standings */}
      <div className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">{t.gamesTitle}</h2>
          <p className="text-sm text-slate-400">
            {region === "ouest" ? t.west : t.east} • {divisionGender === "men" ? (language === "fr" ? "Messieur" : "Gentlemen") : (language === "fr" ? "Dames" : "Ladies")}
          </p>
        </div>

        {loadingGames ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
            {t.loadingGames}
          </div>
        ) : visibleGames.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
            {t.noGames}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleGames.map((game) => {
              // Convert stored Congo TZ date/time to user's local timezone
              const localDateObj = parseCongoDateTime(game.gameDate, game.gameTime);
              const localDate = localDateObj
                ? localDateObj.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : (game.gameDate || "-");
              const localTime = localDateObj
                ? localDateObj.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: 'numeric', minute: '2-digit', hour12: language !== 'fr' })
                : (game.gameTime || t.timeOfGame);
              return (
              <article key={game.id} className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                <div className="sm:hidden space-y-2">
                  <p className="text-xs text-slate-300">{localDate}</p>
                  <p className="text-sm font-semibold text-white">{game.homeTeamName} vs {game.awayTeamName}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{localTime}</span>
                    <span className="text-slate-200 font-medium">
                      {typeof game.homeScore === "number" && typeof game.awayScore === "number"
                        ? `${game.homeScore}-${game.awayScore}`
                        : t.finalScore}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:grid sm:grid-cols-[180px_1fr_220px_160px] sm:items-center sm:gap-3">
                  <p className="text-sm text-slate-300">{localDate}</p>
                  <p className="text-base font-semibold text-white text-center">{game.homeTeamName} vs {game.awayTeamName}</p>
                  <p className="text-sm text-slate-300 text-center">{localTime}</p>
                  <p className="text-sm text-slate-200 text-right font-medium">
                    {typeof game.homeScore === "number" && typeof game.awayScore === "number"
                      ? `${game.homeScore}-${game.awayScore}`
                      : t.finalScore}
                  </p>
                </div>
              </article>
              );
            })}
          </div>
        )}

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">{t.standingsTitle}</h2>
            <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/25 p-1">
              <button
                type="button"
                onClick={() => setStandingsGender("men")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${
                  standingsGender === "men"
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
                aria-label="Show men standings"
              >
                G
              </button>
              <button
                type="button"
                onClick={() => setStandingsGender("women")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${
                  standingsGender === "women"
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
                aria-label="Show women standings"
              >
                L
              </button>
            </div>
          </div>
          {loadingTeams ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
              {t.loadingStandings}
            </div>
          ) : visibleStandings.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
              {t.noStandings}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
              <div className="grid grid-cols-[56px_1fr_92px] sm:grid-cols-[80px_1fr_140px] border-b border-white/10 px-3 sm:px-4 py-3 text-[10px] sm:text-xs uppercase tracking-[0.16em] sm:tracking-[0.2em] text-slate-400">
                <span>{t.rank}</span>
                <span>{t.team}</span>
                <span className="text-right">{t.record}</span>
              </div>
              {visibleStandings.map((team, index) => (
                <div key={team.id} className="grid grid-cols-[56px_1fr_92px] sm:grid-cols-[80px_1fr_140px] px-3 sm:px-4 py-3 text-sm text-slate-200 border-b border-white/5 last:border-b-0">
                  <span className="font-semibold text-white">{index + 1}</span>
                  <span className="font-medium">{team.name}</span>
                  <span className="text-right">{team.wins ?? 0}-{team.losses ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
