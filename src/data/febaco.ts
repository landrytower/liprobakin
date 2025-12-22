import gamesRaw from "./exports/games.json";
import newsRaw from "./exports/news.json";
import partnersRaw from "./exports/partners.json";
import committeeRaw from "./exports/committee.json";
// import standingsRaw from "./exports/standings.json"; // Standings now calculated from games only
import teamTrafficRaw from "./exports/teamTraffic.json";
import teamsRaw from "./exports/teams.json";

type FirestoreTimestamp = {
  _seconds: number;
  _nanoseconds: number;
};

type FirestoreGameDoc = {
  id?: string;
  gender?: string;
  week?: number; // Journée/Week number
  homeTeamId?: string;
  homeTeamName?: string;
  homeTeamLogo?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  awayTeamLogo?: string;
  date?: string;
  time?: string;
  venue?: string;
  broadcast?: string;
  winnerTeamId?: string;
  winnerScore?: number;
  loserTeamId?: string;
  loserScore?: number;
  completed?: boolean;
  playerStats?: Array<{
    teamId?: string;
    teamName?: string;
    playerName?: string;
    headshot?: string;
    pts?: number;
    ast?: number;
    reb?: number;
    blk?: number;
    stl?: number;
    position?: string;
    jerseyNumber?: number;
  }>;
};

type FirestorePlayerStat = NonNullable<FirestoreGameDoc["playerStats"]>[number];

type FirestoreStandingDoc = {
  id?: string;
  teamId?: string;
  teamName?: string;
  gender?: string;
  wins?: number;
  losses?: number;
  totalPoints?: number;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
};

type FirestoreTeamDoc = {
  id: string;
  name?: string;
  city?: string;
  gender?: string;
  colors?: string[];
  logo?: string;
  wins?: number;
  losses?: number;
  totalPoints?: number;
};

type FirestoreNewsDoc = {
  id?: string;
  title?: string;
  headline?: string;
  summary?: string;
  category?: string;
  imageUrl?: string;
  createdAt?: FirestoreTimestamp;
};

type FirestorePartnerDoc = {
  id?: string;
  name?: string;
  logo?: string;
  createdAt?: FirestoreTimestamp;
};

type FirestoreCommitteeDoc = {
  id?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  photo?: string;
  email?: string;
  phone?: string;
  createdAt?: FirestoreTimestamp;
};

type FirestoreTeamTrafficDoc = {
  id?: string;
  action?: string;
  teamId?: string;
  teamName?: string;
  teamGender?: string;
  playerName?: string;
  jerseyNumber?: number;
  createdAt?: FirestoreTimestamp;
};

const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toDate = (timestamp?: FirestoreTimestamp): Date | undefined => {
  if (!timestamp || typeof timestamp._seconds !== "number") {
    return undefined;
  }
  return new Date(timestamp._seconds * 1000 + Math.floor((timestamp._nanoseconds ?? 0) / 1_000_000));
};

const parseDateTime = (date?: string, time?: string): Date | undefined => {
  if (!date) {
    return undefined;
  }

  const timeSegment = time ? time.replace(/^(\d{2})(\d{2})$/, "$1:$2") : "00:00";
  const isoCandidate = `${date}T${timeSegment}`;
  const parsed = Date.parse(isoCandidate);
  return Number.isNaN(parsed) ? undefined : new Date(parsed);
};

const formatDateLabel = (date?: Date): string => {
  if (!date) {
    return "TBD";
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatTimeLabel = (date?: Date): string => {
  if (!date) {
    return "TBD";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatTipoffLabel = (date?: Date): string => {
  if (!date) {
    return "TBD";
  }
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)} · ${formatTimeLabel(date)}`;
};

const firestoreGames = asArray<FirestoreGameDoc>(gamesRaw);
const firestoreStandings: FirestoreStandingDoc[] = []; // Standings calculated from games only
const firestoreTeams = asArray<FirestoreTeamDoc>(teamsRaw);
const firestoreNews = asArray<FirestoreNewsDoc>(newsRaw);
const firestorePartners = asArray<FirestorePartnerDoc>(partnersRaw);
const firestoreCommittee = asArray<FirestoreCommitteeDoc>(committeeRaw);
const firestoreTeamTraffic = asArray<FirestoreTeamTrafficDoc>(teamTrafficRaw);

const teamById = new Map<string, FirestoreTeamDoc>(
  firestoreTeams.filter((team): team is FirestoreTeamDoc & { id: string } => Boolean(team?.id)).map((team) => [team.id, team])
);

const getTeamDisplayName = (teamId?: string, fallback?: string) => {
  if (teamId && teamById.has(teamId)) {
    const team = teamById.get(teamId);
    if (team?.city) {
      return team.city ? `${team.city} ${team.name ?? ""}`.trim() : team.name ?? fallback ?? "TBD";
    }
    return team?.name ?? fallback ?? "TBD";
  }
  return fallback ?? "TBD";
};

const sortByDateDesc = (a?: Date, b?: Date) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0);
const sortByDateAsc = (a?: Date, b?: Date) => (a?.getTime() ?? 0) - (b?.getTime() ?? 0);

type EnrichedGame = {
  id: string;
  week?: number; // Journée/Week number
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  venue?: string;
  broadcast?: string;
  dateInstance?: Date;
  completed: boolean;
  homeScore?: number;
  awayScore?: number;
  tipoffLabel: string;
  leaders: FeaturedMatchup["leaders"];
};

const extractLeaderEntries = (game: FirestoreGameDoc): FeaturedMatchup["leaders"] => {
  const statEntries = asArray<{
    teamId?: string;
    playerName?: string;
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
  }>(game.playerStats);
  if (!statEntries.length) {
    return [];
  }

  const topByTeam = new Map<string, typeof statEntries[number]>();

  statEntries.forEach((entry) => {
    const teamKey = entry.teamId ?? entry.playerName ?? "";
    const currentTop = topByTeam.get(teamKey);
    const points = typeof entry.pts === "number" ? entry.pts : -Infinity;
    const currentPoints = currentTop && typeof currentTop.pts === "number" ? currentTop.pts : -Infinity;
    if (!currentTop || points > currentPoints) {
      topByTeam.set(teamKey, entry);
    }
  });

  return Array.from(topByTeam.values()).map((entry) => {
    const teamMeta = entry.teamId ? teamById.get(entry.teamId) : undefined;
    const teamName = teamMeta?.name ?? entry.teamId ?? "";
    const pieces: string[] = [];
    if (typeof entry.pts === "number") pieces.push(`${entry.pts} PTS`);
    if (typeof entry.reb === "number") pieces.push(`${entry.reb} REB`);
    if (typeof entry.ast === "number") pieces.push(`${entry.ast} AST`);
    if (!pieces.length && typeof entry.blk === "number") pieces.push(`${entry.blk} BLK`);

    return {
      player: entry.playerName ?? "Player Spotlight",
      team: teamName || entry.teamId || "",
      stats: pieces.join(" · ") || "Impact performance",
    };
  });
};

const gameDocById = new Map<string, FirestoreGameDoc>();

const enrichedGames: EnrichedGame[] = firestoreGames.map((game) => {
  const id = game.id ?? generateId("game");
  if (!game.id) {
    game.id = id;
  }
  gameDocById.set(id, game);
  const dateInstance = parseDateTime(game.date, game.time);
  const completed = Boolean(
    game.completed ?? (typeof game.winnerScore === "number" && typeof game.loserScore === "number")
  );

  const winnerScore = typeof game.winnerScore === "number" ? game.winnerScore : undefined;
  const loserScore = typeof game.loserScore === "number" ? game.loserScore : undefined;

  let homeScore: number | undefined;
  let awayScore: number | undefined;
  if (completed && winnerScore !== undefined && loserScore !== undefined) {
    if (game.winnerTeamId && game.winnerTeamId === game.homeTeamId) {
      homeScore = winnerScore;
      awayScore = loserScore;
    } else if (game.winnerTeamId && game.winnerTeamId === game.awayTeamId) {
      homeScore = loserScore;
      awayScore = winnerScore;
    } else {
      homeScore = winnerScore;
      awayScore = loserScore;
    }
  }

  return {
    id,
    week: game.week, // Journée/Week number
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeTeamName: getTeamDisplayName(game.homeTeamId, game.homeTeamName ?? "Home"),
    awayTeamName: getTeamDisplayName(game.awayTeamId, game.awayTeamName ?? "Away"),
    homeTeamLogo: game.homeTeamLogo,
    awayTeamLogo: game.awayTeamLogo,
    venue: game.venue ?? "TBD",
    broadcast: game.broadcast ?? "Liprobakin+",
    dateInstance,
    completed,
    homeScore,
    awayScore,
    tipoffLabel: formatTipoffLabel(dateInstance),
    leaders: extractLeaderEntries(game),
  };
});

const completedGames = enrichedGames
  .filter((game) => game.completed && typeof game.homeScore === "number" && typeof game.awayScore === "number")
  .sort((a, b) => sortByDateDesc(a.dateInstance, b.dateInstance));

const upcomingGames = enrichedGames
  .filter((game) => !game.completed)
  .sort((a, b) => sortByDateAsc(a.dateInstance, b.dateInstance));

const standingsWithGender = firestoreStandings.map((standing) => {
  const team = standing.teamId ? teamById.get(standing.teamId) : undefined;
  const gender = standing.gender ?? team?.gender ?? "men";

  return {
    ...standing,
    gender,
  };
});

const sortStandings = (a: FirestoreStandingDoc, b: FirestoreStandingDoc) => {
  const pointsDiff = (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
  if (pointsDiff !== 0) return pointsDiff;
  const winsDiff = (b.wins ?? 0) - (a.wins ?? 0);
  if (winsDiff !== 0) return winsDiff;
  return (a.teamName ?? "").localeCompare(b.teamName ?? "");
};

const menStandingsDocs = standingsWithGender.filter((standing) => standing.gender === "men").sort(sortStandings);
const womenStandingsDocs = standingsWithGender.filter((standing) => standing.gender === "women").sort(sortStandings);

const menTeams = firestoreTeams.filter((team) => (team.gender ?? "men") === "men");
const womenTeams = firestoreTeams.filter((team) => (team.gender ?? "women") === "women");

const mergeStandingsWithTeams = (standings: FirestoreStandingDoc[], teams: FirestoreTeamDoc[]) => {
  const combined = [...standings];
  const hasTeam = (team: FirestoreTeamDoc) =>
    combined.some(
      (row) =>
        (row.teamId && row.teamId === team.id) ||
        (row.teamName && team.name && row.teamName.toLowerCase() === team.name.toLowerCase())
    );

  // Add ALL teams, even those without any games/records
  teams.forEach((team) => {
    if (!hasTeam(team)) {
      combined.push({
        teamId: team.id,
        teamName: getTeamDisplayName(team.id, team.name ?? "Team"),
        gender: team.gender ?? "men",
        wins: team.wins ?? 0,
        losses: team.losses ?? 0,
        totalPoints: team.totalPoints ?? 0, // Default to 0 if no points yet
      });
    }
  });

  return combined.sort(sortStandings);
};

const combinedMenStandings = mergeStandingsWithTeams(menStandingsDocs, menTeams);
const combinedWomenStandings = mergeStandingsWithTeams(womenStandingsDocs, womenTeams);

const recordByTeamId = new Map<string, string>();
const recordByTeamName = new Map<string, string>();

// Build record map from combined standings (includes all teams)
combinedMenStandings.concat(combinedWomenStandings).forEach((standing) => {
  const wins = standing.wins ?? 0;
  const losses = standing.losses ?? 0;
  const record = `${wins}-${losses}`;
  if (standing.teamId) {
    recordByTeamId.set(standing.teamId, record);
  }
  if (standing.teamName) {
    recordByTeamName.set(standing.teamName.toLowerCase(), record);
  }
});

const getRecordForTeam = (teamId?: string, teamName?: string) => {
  if (teamId && recordByTeamId.has(teamId)) {
    return recordByTeamId.get(teamId)!;
  }
  if (teamName && recordByTeamName.has(teamName.toLowerCase())) {
    return recordByTeamName.get(teamName.toLowerCase())!;
  }
  return "0-0";
};

const derivedMenStandings: StandingRow[] = combinedMenStandings.map((standing, index) => ({
  seed: index + 1,
  team: standing.teamName ?? getTeamDisplayName(standing.teamId, "Team"),
  wins: standing.wins ?? 0,
  losses: standing.losses ?? 0,
  streak: "-",
  lastTen: `${standing.wins ?? 0}-${standing.losses ?? 0}`,
}));

const derivedWomenStandings: StandingRow[] = combinedWomenStandings.map((standing, index) => ({
  seed: index + 1,
  team: standing.teamName ?? getTeamDisplayName(standing.teamId, "Team"),
  wins: standing.wins ?? 0,
  losses: standing.losses ?? 0,
  streak: "-",
  lastTen: `${standing.wins ?? 0}-${standing.losses ?? 0}`,
}));

const normalizeTeamKey = (city?: string, name?: string) =>
  [city, name].filter(Boolean).join(" ").trim().toLowerCase();

const teamLogoOverrides: Record<string, string> = {
  "espoir fukash": "/logos/Males/Espoir_Fukash.png",
  "city kauka": "/logos/Males/city kauka.jpg",
  "binza city": "/logos/Males/binza city.jpg",
  "ballers": "/logos/Males/Ballers.jpg",
  "nmg": "/logos/Males/nmg.jpg",
  "ngaba basket center": "/logos/Males/ngaba_basket_center.jpg",
  "ngaba basketball center": "/logos/Males/ngaba_basket_center.jpg",
  "tourbillon": "/logos/Females/tourbillon.jpg",
  "csm": "/logos/Males/csm.jpg",
  "raphael": "/logos/Males/raphael.jpg",
  "police": "/logos/Males/police.jpg",
  "bana lingwala": "/logos/Males/bana lingwala.jpg",
  "jourdain": "/logos/Males/jourdain.jpg",
  "hatari": "/logos/Females/hatari.jpg",
  "yellow center": "/logos/Females/yellow star.jpg",
  "one team": "/logos/Males/one_team.jpg",
  "cnss": "/logos/Females/cnss.jpg",
  "sctp": "/logos/Males/sctp.jpg",
  "ajakm": "/logos/Females/ajakm.jpg",
  "rich": "/logos/Males/rich.jpg",
  "molokai": "/logos/Males/molokai.jpg",
  "maison des jeunes": "/logos/Females/maison_des_jeunes.jpg",
  "opportunidade": "/logos/Males/oportunidade.jpg",
  "oportunidade": "/logos/Males/oportunidade.jpg",
  "yolo": "/logos/Females/yolo.jpg",
  "heritage": "/logos/Males/heritage.jpg",
  "figuier": "/logos/Males/figuier.jpg",
  "mboka mboka": "/logos/Females/mboka_mboka.jpg",
  "corridor de l'espoir": "/logos/liprobakin.png",
  "marche de la liberte": "/logos/Males/marche_de_la liberte.jpg",
  "ngaliema": "/logos/Males/ngaliema.jpg",
  "terreur": "/logos/Males/terreur.jpg",
  "masano": "/logos/Males/masano.jpg",
  "vita club": "/logos/Females/vita_club.jpg",
  "j&a": "/logos/Males/j&a.jpg",
  "ogks": "/logos/Females/OGSK.jpg",
  "new gen": "/logos/Males/New_Gen.png",
  "gen": "/logos/Males/New_Gen.png",
  "don bosco": "/logos/Females/don bosco.jpg",
  "bosco": "/logos/Females/don bosco.jpg",
  "inri": "/logos/Females/inri.jpg",
  "dcmp": "/logos/liprobakin.png",
};

const mapTeamToFranchise = (team: FirestoreTeamDoc): Franchise => {
  const colors: [string, string] = Array.isArray(team.colors) && team.colors.length >= 2
    ? [team.colors[0], team.colors[1]]
    : ["#1e293b", "#0f172a"];

  const combinedKey = normalizeTeamKey(team.city, team.name);
  const nameOnlyKey = normalizeTeamKey(undefined, team.name);
  const overrideLogo = teamLogoOverrides[combinedKey] ?? teamLogoOverrides[nameOnlyKey];

  const logo = overrideLogo ?? team.logo ?? "/logos/liprobakin.png";

  return {
    city: team.city ?? "",
    name: team.name ?? team.id,
    colors,
    logo,
  };
};

const menFranchises = firestoreTeams
  .filter((team) => (team.gender ?? "men") === "men")
  .map(mapTeamToFranchise)
  .sort((a, b) => a.name.localeCompare(b.name));

// Generate standings for all teams by combining explicit standings + teams without standings

const womenFranchises = firestoreTeams
  .filter((team) => (team.gender ?? "women") === "women")
  .map(mapTeamToFranchise)
  .sort((a, b) => a.name.localeCompare(b.name));

const newsArticles = firestoreNews
  .slice()
  .sort((a, b) => sortByDateDesc(toDate(a.createdAt), toDate(b.createdAt)))
  .map((article, index) => ({
    id: article.id ?? `news-${index}`,
    category: article.category ?? "News",
    headline: article.headline ?? article.title ?? "League update",
    title: article.title ?? article.headline ?? "League update",
    summary: article.summary ?? article.headline ?? "",
    thumbnail: article.imageUrl ?? "/logos/liprobakin.png",
    publishedAt: (toDate(article.createdAt) || new Date()).toISOString(),
    published: formatDateLabel(toDate(article.createdAt)),
  }));

const partnersList = firestorePartners
  .slice()
  .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
  .map((partner, index) => ({
    id: partner.id ?? `partner-${index}`,
    name: partner.name ?? "Partner",
    logo: partner.logo,
  }));

const committeeList = firestoreCommittee
  .slice()
  .sort((a, b) => {
    const aName = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
    const bName = `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim();
    return aName.localeCompare(bName);
  })
  .map((member, index) => ({
    id: member.id ?? `committee-${index}`,
    name: `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() || "Committee Member",
    role: member.role ?? "Member",
    photo: member.photo,
  }));

const recentTeamTraffic = firestoreTeamTraffic
  .slice()
  .sort((a, b) => sortByDateDesc(toDate(a.createdAt), toDate(b.createdAt)));

export const leaguePartners = partnersList;
export const leagueCommittee = committeeList;

const jerseyByPlayerName = new Map<string, number>();
recentTeamTraffic.forEach((entry) => {
  if (entry.playerName && typeof entry.jerseyNumber === "number") {
    jerseyByPlayerName.set(entry.playerName, entry.jerseyNumber);
  }
});

type PlayerAggregate = {
  name: string;
  teamId?: string;
  teamName: string;
  headshot?: string;
  position?: string;
  pts: number;
  ast: number;
  reb: number;
  blk: number;
  stl: number;
  games: number;
};

const playerAggregates = new Map<string, PlayerAggregate & { gender?: string }>();

enrichedGames.forEach((game) => {
  if (!game.completed) {
    return;
  }
  const original = gameDocById.get(game.id);
  if (!original) {
    return;
  }
  
  // Determine game gender from team
  const gameGender = (game.homeTeamId && teamById.has(game.homeTeamId)) 
    ? (teamById.get(game.homeTeamId)?.gender ?? "men")
    : "men";
  
  asArray<FirestorePlayerStat>(original.playerStats).forEach((entry) => {
    if (!entry.playerName) {
      return;
    }
    if (typeof entry.jerseyNumber === "number" && !jerseyByPlayerName.has(entry.playerName)) {
      jerseyByPlayerName.set(entry.playerName, entry.jerseyNumber);
    }
    const key = `${entry.teamId ?? ""}:${entry.playerName}`;
    if (!playerAggregates.has(key)) {
      playerAggregates.set(key, {
        name: entry.playerName,
        teamId: entry.teamId,
        teamName: entry.teamName ?? getTeamDisplayName(entry.teamId, "Team"),
        headshot: entry.headshot,
        position: entry.position,
        gender: gameGender,
        pts: 0,
        ast: 0,
        reb: 0,
        blk: 0,
        stl: 0,
        games: 0,
      });
    }
    const aggregate = playerAggregates.get(key)!;
    if ((!aggregate.teamName || aggregate.teamName === "Team") && entry.teamName) {
      aggregate.teamName = entry.teamName;
    }
    if (!aggregate.position && entry.position) {
      aggregate.position = entry.position;
    }
    if (!aggregate.gender) {
      aggregate.gender = gameGender;
    }
    aggregate.pts += typeof entry.pts === "number" ? entry.pts : 0;
    aggregate.ast += typeof entry.ast === "number" ? entry.ast : 0;
    aggregate.reb += typeof entry.reb === "number" ? entry.reb : 0;
    aggregate.blk += typeof entry.blk === "number" ? entry.blk : 0;
    aggregate.stl += typeof entry.stl === "number" ? entry.stl : 0;
    if (!aggregate.headshot && entry.headshot) {
      aggregate.headshot = entry.headshot;
    }
    aggregate.games += 1;
  });
});

// Helper function to create spotlight players from aggregates
const createSpotlightPlayers = (gender: string): SpotlightPlayer[] => {
  return Array.from(playerAggregates.values())
    .filter((player) => (player.gender ?? "men") === gender)
    .map((player) => {
      const gamesPlayed = Math.max(player.games, 1);
      const avgPts = player.pts / gamesPlayed;
      const avgAst = player.ast / gamesPlayed;
      const avgReb = player.reb / gamesPlayed;
      const avgBlk = player.blk / gamesPlayed;
      const avgStl = player.stl / gamesPlayed;
      const rating = avgPts + avgAst * 0.75 + avgReb * 0.6 + avgStl * 0.8 + avgBlk * 0.5;

      const statLines = [
        { label: "Points", value: avgPts.toFixed(1) },
        { label: "Assists", value: avgAst.toFixed(1) },
        { label: "Rebounds", value: avgReb.toFixed(1) },
        { label: "Steals", value: avgStl.toFixed(1) },
        { label: "Blocks", value: avgBlk.toFixed(1) },
      ];

      return {
        name: player.name,
        position: player.position ?? "G",
        team: player.teamName,
        stats: `${avgPts.toFixed(1)} PPG | ${avgAst.toFixed(1)} AST | ${avgReb.toFixed(1)} REB`,
        efficiency: `+${(rating).toFixed(1)}`,
        blurb: `${player.teamName} standout fueling the Liprobakin slate.`,
        number: jerseyByPlayerName.get(player.name) ?? 0,
        statLines,
        leaderboard: {
          pts: Number(avgPts.toFixed(1)),
          ast: Number(avgAst.toFixed(1)),
          reb: Number(avgReb.toFixed(1)),
          blk: Number(avgBlk.toFixed(1)),
          stl: Number(avgStl.toFixed(1)),
        },
        photo: player.headshot ?? "/players/default.svg",
        rating,
      };
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);
};

const derivedSpotlightPlayers: SpotlightPlayer[] = createSpotlightPlayers("men");
const derivedSpotlightPlayersWomen: SpotlightPlayer[] = createSpotlightPlayers("women");

const fallbackSpotlightPlayers: SpotlightPlayer[] = [
  {
    name: "Jonas Beya",
    position: "G",
    team: "New Gen",
    stats: "22.4 PPG | 6.8 AST",
    efficiency: "+18.4",
    blurb: "New Gen's floor general keeps the pace frantic and punishes gaps from deep.",
    number: 2,
    statLines: [
      { label: "Points", value: "22.4" },
      { label: "Assists", value: "6.8" },
      { label: "Steals", value: "1.9" },
      { label: "3PT%", value: "38%" },
    ],
    leaderboard: {
      pts: 22.4,
      ast: 6.8,
      reb: 4.0,
      blk: 0.4,
      stl: 1.9,
    },
    photo: "/players/jonas-beya.svg",
  },
  {
    name: "Samuel Ilunga",
    position: "F",
    team: "Terreur",
    stats: "19.1 PPG | 9.3 REB",
    efficiency: "+16.2",
    blurb: "Terreur's high-motor forward seals deep position and erases drives with length.",
    number: 14,
    statLines: [
      { label: "Points", value: "19.1" },
      { label: "Rebounds", value: "9.3" },
      { label: "Blocks", value: "1.8" },
      { label: "FG%", value: "58%" },
    ],
    leaderboard: {
      pts: 19.1,
      ast: 3.1,
      reb: 9.3,
      blk: 1.8,
      stl: 1.2,
    },
    photo: "/players/samuel-ilunga.svg",
  },
  {
    name: "Emery Kasongo",
    position: "G",
    team: "Vita Club",
    stats: "17.6 PPG | 2.4 STL",
    efficiency: "+14.3",
    blurb: "Vita Club's lead guard pressures full court and pulls up in rhythm in transition.",
    number: 11,
    statLines: [
      { label: "Points", value: "17.6" },
      { label: "Steals", value: "2.4" },
      { label: "Assists", value: "5.2" },
      { label: "FT%", value: "85%" },
    ],
    leaderboard: {
      pts: 17.6,
      ast: 5.2,
      reb: 3.8,
      blk: 0.6,
      stl: 2.4,
    },
    photo: "/players/emery-kasongo.svg",
  },
];

export const spotlightPlayers: SpotlightPlayer[] = derivedSpotlightPlayers.length
  ? derivedSpotlightPlayers
  : fallbackSpotlightPlayers;

export type GenderKey = "men" | "women";

export type SpotlightPlayer = {
  name: string;
  position: string;
  team: string;
  stats: string;
  efficiency: string;
  blurb: string;
  number: number;
  statLines: {
    label: string;
    value: string;
  }[];
  leaderboard: {
    pts: number;
    ast: number;
    reb: number;
    blk: number;
    stl: number;
  };
  photo: string;
  rating?: number;
};

export type GameResult = {
  id: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  status: string;
  venue: string;
  broadcast: string;
};

export type ScheduleEntry = {
  id: string;
  date: string;
  time: string;
  venue: string;
  home: string;
  away: string;
};

export type NewsArticle = {
  id: string;
  category: string;
  headline: string;
  title: string;
  summary: string;
  thumbnail: string;
  publishedAt: string;
  published: string;
};

export type StatMetric = {
  label: string;
  value: string;
  change: string;
};

export type StandingRow = {
  seed: number;
  team: string;
  wins: number;
  losses: number;
  streak: string;
  lastTen: string;
};

export type Franchise = {
  city: string;
  name: string;
  colors: [string, string];
  logo?: string;
};

export type RosterPlayer = {
  name: string;
  firstName?: string;
  lastName?: string;
  number: number;
  height: string;
  headshot?: string;
  position?: string;
  nationality?: string;
  nationality2?: string;
  weight?: string;
  birthDate?: string;
  dateOfBirth?: string;
  draftYear?: string;
  draftPick?: string;
  college?: string;
  experience?: string;
  stats: {
    pts: string;
    reb: string;
    ast?: string;
    blk?: string;
    stl: string;
  };
};

export type FeaturedMatchup = {
  id: string;
  status: string;
  tipoff: string;
  venue: string;
  network: string;
  home: {
    team: string;
    record: string;
  };
  away: {
    team: string;
    record: string;
  };
  leaders: {
    player: string;
    team: string;
    stats: string;
    headshot?: string;
  }[];
};

export const navSections = [
  "Schedule",
  "Players",
  "Standings",
  "Teams",
];

const fallbackFeaturedMatchups: FeaturedMatchup[] = [
  {
    id: "fallback-match-001",
    status: "Upcoming",
    tipoff: "Nov 29 · 6:00 PM",
    venue: "Axis Pavilion",
    network: "Liprobakin+",
    home: { team: "New Gen", record: "15-2" },
    away: { team: "Terreur", record: "13-4" },
    leaders: [],
  },
];

const featuredSourceGames = upcomingGames.length ? upcomingGames : completedGames.slice(0, 3);

const derivedFeaturedMatchups: FeaturedMatchup[] = featuredSourceGames.map((game) => ({
  id: game.id,
  status: game.completed ? "Final" : "Upcoming",
  tipoff: game.tipoffLabel,
  venue: game.venue ?? "TBD",
  network: game.broadcast ?? "Liprobakin+",
  home: {
    team: game.homeTeamName,
    record: getRecordForTeam(game.homeTeamId, game.homeTeamName),
  },
  away: {
    team: game.awayTeamName,
    record: getRecordForTeam(game.awayTeamId, game.awayTeamName),
  },
  leaders: game.leaders.length ? game.leaders : [],
}));

export const featuredMatchups: FeaturedMatchup[] = derivedFeaturedMatchups.length
  ? derivedFeaturedMatchups
  : fallbackFeaturedMatchups;

const fallbackSpotlightPlayersWomen: SpotlightPlayer[] = [
  {
    name: "Amina Ngalula",
    position: "G",
    team: "CNSS",
    stats: "18.3 PPG | 6.1 AST",
    efficiency: "+12.5",
    blurb: "CNSS drives tempo through Ngalula's bursts in transition and no-dribble swing threes.",
    number: 5,
    statLines: [
      { label: "Points", value: "18.3" },
      { label: "Assists", value: "6.1" },
      { label: "Steals", value: "2.4" },
      { label: "3PT%", value: "41%" },
    ],
    leaderboard: {
      pts: 18.3,
      ast: 6.1,
      reb: 4.2,
      blk: 0.5,
      stl: 2.4,
    },
    photo: "/players/amina-ngalula.svg",
  },
  {
    name: "Ruth Mbuyi",
    position: "F",
    team: "Tourbillon",
    stats: "16.1 PPG | 9.0 REB",
    efficiency: "+10.7",
    blurb: "Tourbillon's switchable forward seals deep position and erases drives with long arms.",
    number: 11,
    statLines: [
      { label: "Points", value: "16.1" },
      { label: "Rebounds", value: "9.0" },
      { label: "Blocks", value: "1.6" },
      { label: "Steals", value: "1.3" },
    ],
    leaderboard: {
      pts: 16.1,
      ast: 3.4,
      reb: 9.0,
      blk: 1.6,
      stl: 1.3,
    },
    photo: "/players/ruth-mbuyi.svg",
  },
  {
    name: "Lila Katembo",
    position: "G",
    team: "Vita Club",
    stats: "14.8 PPG | 2.8 STL",
    efficiency: "+9.8",
    blurb: "Vita Club's pressure guard digs in at the nail and pulls up in rhythm from 18 feet.",
    number: 3,
    statLines: [
      { label: "Points", value: "14.8" },
      { label: "Steals", value: "2.8" },
      { label: "Assists", value: "4.9" },
      { label: "FT%", value: "88%" },
    ],
    leaderboard: {
      pts: 14.8,
      ast: 4.9,
      reb: 3.6,
      blk: 0.4,
      stl: 2.8,
    },
    photo: "/players/lila-katembo.svg",
  },
  {
    name: "Sandrine Ilondo",
    position: "C",
    team: "OGKS",
    stats: "12.4 PPG | 10.5 REB",
    efficiency: "+8.9",
    blurb: "OGKS leans on Ilondo's high-low passing and second-chance work on the glass.",
    number: 24,
    statLines: [
      { label: "Points", value: "12.4" },
      { label: "Rebounds", value: "10.5" },
      { label: "Blocks", value: "2.2" },
      { label: "Steals", value: "0.8" },
    ],
    leaderboard: {
      pts: 12.4,
      ast: 2.1,
      reb: 10.5,
      blk: 2.2,
      stl: 0.8,
    },
    photo: "/players/sandrine-ilondo.svg",
  },
];

// Export women's spotlight players (use derived if available, fallback otherwise)
export const spotlightPlayersWomen: SpotlightPlayer[] = derivedSpotlightPlayersWomen.length
  ? derivedSpotlightPlayersWomen
  : fallbackSpotlightPlayersWomen;

const fallbackLatestGames: GameResult[] = [
  {
    id: "fallback-001",
    home: "New Gen",
    away: "Terreur",
    homeScore: 118,
    awayScore: 111,
    status: "Final",
    venue: "Stade des Martyrs",
    broadcast: "Liprobakin Live",
  },
  {
    id: "fallback-002",
    home: "SCTP",
    away: "Don Bosco",
    homeScore: 105,
    awayScore: 97,
    status: "Final",
    venue: "Limete",
    broadcast: "Prime Sports",
  },
  {
    id: "fallback-003",
    home: "Espoir Fukash",
    away: "Molokai",
    homeScore: 101,
    awayScore: 95,
    status: "Final",
    venue: "Stade de la Police",
    broadcast: "Liprobakin Stream",
  },
  {
    id: "fallback-004",
    home: "Ballers",
    away: "City Kauka",
    homeScore: 112,
    awayScore: 108,
    status: "Final",
    venue: "Limete",
    broadcast: "League Feed",
  },
];

const derivedLatestGames: GameResult[] = completedGames.map((game) => ({
  id: game.id,
  home: game.homeTeamName,
  away: game.awayTeamName,
  homeScore: game.homeScore ?? 0,
  awayScore: game.awayScore ?? 0,
  status: "Final",
  venue: game.venue ?? "TBD",
  broadcast: game.broadcast ?? "Liprobakin+",
}));

export const latestGames: GameResult[] = derivedLatestGames.length ? derivedLatestGames : fallbackLatestGames;

const fallbackUpcomingSchedule: ScheduleEntry[] = [
  {
    id: "fallback-schedule-001",
    date: "Tue, Dec 16",
    time: "7:30 PM",
    venue: "Stade des Martyrs",
    home: "Terreur",
    away: "New Gen",
  },
  {
    id: "fallback-schedule-002",
    date: "Thu, Dec 18",
    time: "5:00 PM",
    venue: "Limete",
    home: "New Gen",
    away: "Don Bosco",
  },
  {
    id: "fallback-schedule-003",
    date: "Sat, Dec 20",
    time: "8:00 PM",
    venue: "Stade de la Police",
    home: "New Gen",
    away: "Espoir Fukash",
  },
];

const derivedUpcomingSchedule: ScheduleEntry[] = upcomingGames.map((game) => ({
  id: game.id,
  date: formatDateLabel(game.dateInstance),
  time: formatTimeLabel(game.dateInstance),
  venue: game.venue ?? "TBD",
  home: game.homeTeamName,
  away: game.awayTeamName,
}));

export const upcomingSchedule: ScheduleEntry[] = derivedUpcomingSchedule.length
  ? derivedUpcomingSchedule
  : fallbackUpcomingSchedule;

const fallbackHeadlineNews: NewsArticle[] = [
  {
    id: "fallback-news-001",
    category: "Spotlight",
    headline: "Porter Drops 42 To Seal New Gen Sweep",
    title: "Porter Drops 42 To Seal New Gen Sweep",
    summary:
      "Cam Porter punched in another 40-piece to keep New Gen unbeaten through the Showcase window.",
    thumbnail: "/logos/liprobakin.png",
    publishedAt: new Date().toISOString(),
    published: "2h ago",
  },
  {
    id: "fallback-news-002",
    category: "Transactions",
    headline: "Terreur Adds Rim Protector Omar Greer",
    title: "Terreur Adds Rim Protector Omar Greer",
    summary:
      "Length and timing at the rim bolsters Terreur's top-rated defense heading into the winter push.",
    thumbnail: "/logos/liprobakin.png",
    publishedAt: new Date().toISOString(),
    published: "5h ago",
  },
];

export const headlineNews: NewsArticle[] = newsArticles.length ? newsArticles : fallbackHeadlineNews;

export const leagueStats: StatMetric[] = [
  { label: "League Pace", value: "101.7", change: "+1.4 vs last week" },
  { label: "Avg Efficiency", value: "114.2", change: "-0.6 vs last season" },
  { label: "Clutch Net", value: "+8.0", change: "New Gen (1st)" },
  { label: "3PT Volume", value: "40.8", change: "+2 attempts" },
  { label: "Paint Touches", value: "55%", change: "Molokai (lead)" },
  { label: "Turnover Rate", value: "12.1%", change: "Don Bosco (best)" },
  { label: "Deflections", value: "18.2", change: "Espoir (surge)" },
  { label: "Bench Net", value: "+3.7", change: "Ballers (spark)" },
];

const fallbackMenStandings: StandingRow[] = [
  { seed: 1, team: "New Gen", wins: 15, losses: 2, streak: "W7", lastTen: "9-1" },
  { seed: 2, team: "Terreur", wins: 13, losses: 4, streak: "L1", lastTen: "7-3" },
  { seed: 3, team: "SCTP", wins: 11, losses: 6, streak: "W1", lastTen: "6-4" },
  { seed: 4, team: "Espoir Fukash", wins: 10, losses: 7, streak: "W3", lastTen: "7-3" },
  { seed: 5, team: "Molokai", wins: 9, losses: 8, streak: "W1", lastTen: "5-5" },
  { seed: 6, team: "Ballers", wins: 7, losses: 10, streak: "W1", lastTen: "4-6" },
  { seed: 7, team: "City Kauka", wins: 6, losses: 11, streak: "L1", lastTen: "4-6" },
  { seed: 8, team: "Don Bosco", wins: 5, losses: 12, streak: "W1", lastTen: "4-6" },
  { seed: 9, team: "DCMP", wins: 5, losses: 12, streak: "L2", lastTen: "3-7" },
];

const fallbackWomenStandings: StandingRow[] = [
  { seed: 1, team: "CNSS", wins: 11, losses: 1, streak: "W6", lastTen: "9-1" },
  { seed: 2, team: "Vita Club", wins: 10, losses: 2, streak: "W3", lastTen: "8-2" },
  { seed: 3, team: "Tourbillon", wins: 8, losses: 4, streak: "L1", lastTen: "7-3" },
  { seed: 4, team: "OGKS", wins: 7, losses: 5, streak: "W2", lastTen: "6-4" },
  { seed: 5, team: "Hatari", wins: 6, losses: 6, streak: "W1", lastTen: "5-5" },
];

export const conferenceStandings: StandingRow[] = derivedMenStandings.length
  ? derivedMenStandings
  : fallbackMenStandings;

export const conferenceStandingsWomen: StandingRow[] = derivedWomenStandings.length
  ? derivedWomenStandings
  : fallbackWomenStandings;

const fallbackMenFranchises: Franchise[] = [
  { city: "New", name: "Gen", colors: ["#38bdf8", "#a855f7"], logo: "/logos/New Gen.png" },
  { city: "", name: "Terreur", colors: ["#ef4444", "#0f172a"], logo: "/logos/terreur.jpg" },
  { city: "", name: "SCTP", colors: ["#22d3ee", "#0ea5e9"], logo: "/logos/sctp.jpg" },
  { city: "", name: "Molokai", colors: ["#fbbf24", "#fb923c"], logo: "/logos/molokai.jpg" },
  { city: "", name: "Ballers", colors: ["#cbd5f5", "#3b82f6"], logo: "/logos/ballers.jpg" },
  { city: "Espoir", name: "Fukash", colors: ["#4ade80", "#15803d"], logo: "/logos/Espoir Fukash.png" },
  { city: "City", name: "Kauka", colors: ["#67e8f9", "#0ea5e9"], logo: "/logos/City kauka.png" },
  { city: "Don", name: "Bosco", colors: ["#fcd34d", "#f97316"], logo: "/logos/don bosco.jpg" },
  { city: "", name: "One Team", colors: ["#f472b6", "#be185d"] },
  { city: "", name: "Ngaliema", colors: ["#2dd4bf", "#0f766e"] },
  { city: "", name: "Opportunidade", colors: ["#fb923c", "#ea580c"] },
  { city: "", name: "J&A", colors: ["#c4b5fd", "#9333ea"] },
  { city: "", name: "Raphael", colors: ["#fde047", "#facc15"] },
  { city: "", name: "Bana Lingwala", colors: ["#4ade80", "#16a34a"] },
  { city: "", name: "Binza City", colors: ["#60a5fa", "#2563eb"] },
  { city: "", name: "NMG", colors: ["#38bdf8", "#0284c7"] },
  { city: "", name: "Rich", colors: ["#fda4af", "#fb7185"] },
  { city: "", name: "Heritage", colors: ["#facc15", "#d97706"] },
  { city: "", name: "Figuier", colors: ["#a5b4fc", "#6366f1"] },
  { city: "", name: "Masano", colors: ["#34d399", "#047857"] },
  { city: "", name: "Marche de la Liberte", colors: ["#fb7185", "#be123c"] },
  { city: "", name: "CSM", colors: ["#ec4899", "#9333ea"] },
  { city: "", name: "Ngaba Bagait Center", colors: ["#fcd34d", "#fb923c"] },
  { city: "", name: "Jourdain", colors: ["#93c5fd", "#3b82f6"] },
];

const fallbackWomenFranchises: Franchise[] = [
  { city: "", name: "CNSS", colors: ["#38bdf8", "#0ea5e9"] },
  { city: "", name: "Vita Club", colors: ["#86efac", "#16a34a"] },
  { city: "", name: "Tourbillon", colors: ["#fb7185", "#9f1239"] },
  { city: "", name: "OGKS", colors: ["#fef08a", "#eab308"] },
  { city: "", name: "Hatari", colors: ["#fca5a5", "#e11d48"] },
  { city: "", name: "Saint Jean", colors: ["#818cf8", "#4f46e5"] },
  { city: "", name: "Mboka Mboka", colors: ["#38bdf8", "#0ea5e9"] },
  { city: "", name: "Motema Pembe", colors: ["#fbbf24", "#eab308"] },
  { city: "", name: "Saint Pie", colors: ["#22d3ee", "#0ea5e9"] },
  { city: "", name: "VCK", colors: ["#fca5a5", "#e11d48"] },
  { city: "", name: "Yellow Center", colors: ["#fef08a", "#eab308"] },
  { city: "", name: "Ajakin", colors: ["#c7d2fe", "#6366f1"] },
  { city: "", name: "Maison des Jeunes", colors: ["#c4b5fd", "#8b5cf6"] },
  { city: "", name: "INRI", colors: ["#c084fc", "#7c3aed"] },
  { city: "", name: "Ngaba", colors: ["#fcd34d", "#eab308"] },
  { city: "", name: "Yolo", colors: ["#38bdf8", "#0ea5e9"] },
];

export const franchises: Franchise[] = menFranchises.length ? menFranchises : fallbackMenFranchises;

export const franchisesWomen: Franchise[] = womenFranchises.length
  ? womenFranchises
  : fallbackWomenFranchises;

// Removed all static team rosters - players now loaded dynamically from Firestore
// Players are registered through account creation where they select their team and player number
export const teamRosters: Record<string, RosterPlayer[]> = {};

export const allTeamsByGender = {
  male: menFranchises.length ? menFranchises : fallbackMenFranchises,
  female: womenFranchises.length ? womenFranchises : fallbackWomenFranchises,
};

// Helper function to group games by week
export const getGamesByWeek = (games: EnrichedGame[]): Map<number, EnrichedGame[]> => {
  const gamesByWeek = new Map<number, EnrichedGame[]>();
  
  games.forEach(game => {
    const week = game.week ?? 0; // Default to 0 if no week assigned
    if (!gamesByWeek.has(week)) {
      gamesByWeek.set(week, []);
    }
    gamesByWeek.get(week)!.push(game);
  });
  
  return gamesByWeek;
};

// Export games grouped by week for easy access
export const gamesByWeek = getGamesByWeek(enrichedGames);
