/**
 * Liprobakin AI - Data Context Helper
 * Compiles league data into a format the AI can understand and query
 */

import {
  conferenceStandings,
  conferenceStandingsWomen,
  spotlightPlayers,
  spotlightPlayersWomen,
  latestGames,
  upcomingSchedule,
  leagueCommittee,
  leaguePartners,
  franchises,
  franchisesWomen,
  headlineNews,
  type SpotlightPlayer,
  type StandingRow,
  type GameResult,
  type ScheduleEntry,
} from "@/data/febaco";

import gamesRaw from "@/data/exports/games.json";

type PlayerStatEntry = {
  playerId?: string;
  playerName?: string;
  firstName?: string;
  lastName?: string;
  number?: number;
  headshot?: string;
  teamId?: string;
  teamName?: string;
  pts?: number;
  ast?: number;
  reb?: number;
  oreb?: number;
  dreb?: number;
  stl?: number;
  blk?: number;
  min?: number;
  pf?: number;
  to?: number;
  two_pm?: number;
  two_pa?: number;
  three_pm?: number;
  three_pa?: number;
  ft_m?: number;
  ft_a?: number;
};

type GameWithStats = {
  id: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  date?: string;
  venue?: string;
  completed?: boolean;
  winnerTeamId?: string;
  winnerScore?: number;
  loserScore?: number;
  playerStats?: PlayerStatEntry[];
};

const games = gamesRaw as GameWithStats[];

/**
 * Get all unique players from game stats
 */
function getAllPlayers(): Map<string, { name: string; teamId?: string; teamName?: string; games: number; totals: { pts: number; ast: number; reb: number; stl: number; blk: number } }> {
  const players = new Map<string, { name: string; teamId?: string; teamName?: string; games: number; totals: { pts: number; ast: number; reb: number; stl: number; blk: number } }>();

  games.forEach((game) => {
    if (!game.playerStats) return;

    game.playerStats.forEach((stat) => {
      if (!stat.playerName) return;

      const key = `${stat.teamId || "unknown"}:${stat.playerName}`;
      if (!players.has(key)) {
        players.set(key, {
          name: stat.playerName,
          teamId: stat.teamId,
          teamName: stat.teamName,
          games: 0,
          totals: { pts: 0, ast: 0, reb: 0, stl: 0, blk: 0 },
        });
      }

      const player = players.get(key)!;
      player.games += 1;
      player.totals.pts += stat.pts ?? 0;
      player.totals.ast += stat.ast ?? 0;
      player.totals.reb += stat.reb ?? 0;
      player.totals.stl += stat.stl ?? 0;
      player.totals.blk += stat.blk ?? 0;
    });
  });

  return players;
}

/**
 * Get head-to-head stats between two players
 */
export function getPlayerVsPlayer(player1Name: string, player2Name: string): string {
  const matchups: {
    game: string;
    date: string;
    player1Stats: PlayerStatEntry | null;
    player2Stats: PlayerStatEntry | null;
  }[] = [];

  const normalize = (name: string) => name.toLowerCase().trim();

  games.forEach((game) => {
    if (!game.playerStats || !game.completed) return;

    const p1Stats = game.playerStats.find((s) => normalize(s.playerName || "") === normalize(player1Name));
    const p2Stats = game.playerStats.find((s) => normalize(s.playerName || "") === normalize(player2Name));

    if (p1Stats || p2Stats) {
      matchups.push({
        game: `${game.homeTeamName || "Home"} vs ${game.awayTeamName || "Away"}`,
        date: game.date || "Unknown",
        player1Stats: p1Stats || null,
        player2Stats: p2Stats || null,
      });
    }
  });

  if (matchups.length === 0) {
    return `No head-to-head games found between ${player1Name} and ${player2Name}.`;
  }

  // Calculate totals
  const p1Total = { pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, games: 0 };
  const p2Total = { pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, games: 0 };

  matchups.forEach((m) => {
    if (m.player1Stats) {
      p1Total.pts += m.player1Stats.pts ?? 0;
      p1Total.ast += m.player1Stats.ast ?? 0;
      p1Total.reb += m.player1Stats.reb ?? 0;
      p1Total.stl += m.player1Stats.stl ?? 0;
      p1Total.blk += m.player1Stats.blk ?? 0;
      p1Total.games += 1;
    }
    if (m.player2Stats) {
      p2Total.pts += m.player2Stats.pts ?? 0;
      p2Total.ast += m.player2Stats.ast ?? 0;
      p2Total.reb += m.player2Stats.reb ?? 0;
      p2Total.stl += m.player2Stats.stl ?? 0;
      p2Total.blk += m.player2Stats.blk ?? 0;
      p2Total.games += 1;
    }
  });

  return JSON.stringify({
    player1: {
      name: player1Name,
      gamesPlayed: p1Total.games,
      totals: p1Total,
      averages: {
        pts: p1Total.games > 0 ? (p1Total.pts / p1Total.games).toFixed(1) : 0,
        ast: p1Total.games > 0 ? (p1Total.ast / p1Total.games).toFixed(1) : 0,
        reb: p1Total.games > 0 ? (p1Total.reb / p1Total.games).toFixed(1) : 0,
      },
    },
    player2: {
      name: player2Name,
      gamesPlayed: p2Total.games,
      totals: p2Total,
      averages: {
        pts: p2Total.games > 0 ? (p2Total.pts / p2Total.games).toFixed(1) : 0,
        ast: p2Total.games > 0 ? (p2Total.ast / p2Total.games).toFixed(1) : 0,
        reb: p2Total.games > 0 ? (p2Total.reb / p2Total.games).toFixed(1) : 0,
      },
    },
    gamesCompared: matchups.length,
    matchupDetails: matchups.slice(0, 5),
  });
}

/**
 * Get league leaders by stat category
 */
export function getLeagueLeaders(category: "pts" | "ast" | "reb" | "stl" | "blk" = "pts", limit = 10): string {
  const players = getAllPlayers();

  const sorted = Array.from(players.values())
    .filter((p) => p.games > 0)
    .map((p) => ({
      name: p.name,
      team: p.teamName || "Unknown",
      games: p.games,
      total: p.totals[category],
      average: (p.totals[category] / p.games).toFixed(1),
    }))
    .sort((a, b) => parseFloat(b.average) - parseFloat(a.average))
    .slice(0, limit);

  return JSON.stringify({
    category: category.toUpperCase(),
    leaders: sorted,
  });
}

/**
 * Build the complete context for the AI
 */
export function buildAIContext(): string {
  const context: string[] = [];

  // League info
  context.push("=== LIPROBAKIN LEAGUE INFO ===");
  context.push("Liprobakin is a basketball league based in Kinshasa, DR Congo.");
  context.push("The league has both men's and women's divisions.");

  // Committee/Leadership
  context.push("\n=== LEAGUE COMMITTEE ===");
  if (leagueCommittee.length > 0) {
    leagueCommittee.forEach((member) => {
      context.push(`- ${member.name}: ${member.role}`);
    });
  } else {
    context.push("Committee information not currently available.");
  }

  // Men's standings
  context.push("\n=== MEN'S STANDINGS ===");
  conferenceStandings.forEach((team: StandingRow) => {
    context.push(`${team.seed}. ${team.team} (${team.wins}-${team.losses})`);
  });

  // Women's standings
  context.push("\n=== WOMEN'S STANDINGS ===");
  conferenceStandingsWomen.forEach((team: StandingRow) => {
    context.push(`${team.seed}. ${team.team} (${team.wins}-${team.losses})`);
  });

  // Top players - Men
  context.push("\n=== TOP MEN'S PLAYERS ===");
  spotlightPlayers.forEach((player: SpotlightPlayer) => {
    context.push(`- ${player.name} (${player.team}): ${player.stats}`);
  });

  // Top players - Women
  context.push("\n=== TOP WOMEN'S PLAYERS ===");
  spotlightPlayersWomen.forEach((player: SpotlightPlayer) => {
    context.push(`- ${player.name} (${player.team}): ${player.stats}`);
  });

  // Recent games
  context.push("\n=== RECENT GAMES ===");
  latestGames.slice(0, 10).forEach((game: GameResult) => {
    context.push(`- ${game.home} ${game.homeScore} vs ${game.away} ${game.awayScore} (${game.venue})`);
  });

  // Upcoming games
  context.push("\n=== UPCOMING GAMES ===");
  upcomingSchedule.slice(0, 10).forEach((game: ScheduleEntry) => {
    context.push(`- ${game.date} ${game.time}: ${game.home} vs ${game.away} at ${game.venue}`);
  });

  // Teams
  context.push("\n=== MEN'S TEAMS ===");
  franchises.forEach((team) => {
    context.push(`- ${team.city ? team.city + " " : ""}${team.name}`);
  });

  context.push("\n=== WOMEN'S TEAMS ===");
  franchisesWomen.forEach((team) => {
    context.push(`- ${team.city ? team.city + " " : ""}${team.name}`);
  });

  // Partners
  if (leaguePartners.length > 0) {
    context.push("\n=== LEAGUE PARTNERS/SPONSORS ===");
    leaguePartners.forEach((partner) => {
      context.push(`- ${partner.name}`);
    });
  }

  // News
  if (headlineNews.length > 0) {
    context.push("\n=== RECENT NEWS ===");
    headlineNews.slice(0, 5).forEach((news) => {
      context.push(`- ${news.headline}`);
    });
  }

  return context.join("\n");
}

type PlayerData = { name: string; teamName?: string; games: number; totals: { pts: number; ast: number; reb: number; stl: number; blk: number } };

/**
 * Get player stats summary
 */
export function getPlayerStats(playerName: string): string {
  const players = getAllPlayers();
  const normalize = (name: string) => name.toLowerCase().trim();
  const normalizedSearch = normalize(playerName);

  let foundPlayer: PlayerData | null = null;

  for (const player of players.values()) {
    if (normalize(player.name) === normalizedSearch || 
        player.name.toLowerCase().includes(playerName.toLowerCase())) {
      foundPlayer = player;
      break;
    }
  }

  if (!foundPlayer) {
    return `No stats found for player "${playerName}".`;
  }

  const gamesPlayed = foundPlayer.games;
  const totals = foundPlayer.totals;

  const avg = {
    pts: gamesPlayed > 0 ? (totals.pts / gamesPlayed).toFixed(1) : "0.0",
    ast: gamesPlayed > 0 ? (totals.ast / gamesPlayed).toFixed(1) : "0.0",
    reb: gamesPlayed > 0 ? (totals.reb / gamesPlayed).toFixed(1) : "0.0",
    stl: gamesPlayed > 0 ? (totals.stl / gamesPlayed).toFixed(1) : "0.0",
    blk: gamesPlayed > 0 ? (totals.blk / gamesPlayed).toFixed(1) : "0.0",
  };

  return JSON.stringify({
    name: foundPlayer.name,
    team: foundPlayer.teamName || "Unknown",
    gamesPlayed: gamesPlayed,
    totals: totals,
    averages: avg,
  });
}

/**
 * Get team info
 */
export function getTeamInfo(teamName: string): string {
  const normalize = (name: string) => name.toLowerCase().trim();

  // Search in men's teams
  const menTeam = franchises.find(
    (t) =>
      normalize(t.name) === normalize(teamName) ||
      normalize(`${t.city} ${t.name}`.trim()) === normalize(teamName)
  );

  // Search in women's teams
  const womenTeam = franchisesWomen.find(
    (t) =>
      normalize(t.name) === normalize(teamName) ||
      normalize(`${t.city} ${t.name}`.trim()) === normalize(teamName)
  );

  // Get standings
  const menStanding = conferenceStandings.find(
    (s) => normalize(s.team).includes(normalize(teamName))
  );
  const womenStanding = conferenceStandingsWomen.find(
    (s) => normalize(s.team).includes(normalize(teamName))
  );

  const team = menTeam || womenTeam;
  const standing = menStanding || womenStanding;

  if (!team && !standing) {
    return `No team found with name "${teamName}".`;
  }

  return JSON.stringify({
    name: team ? `${team.city ? team.city + " " : ""}${team.name}` : standing?.team,
    division: menTeam || menStanding ? "Men's" : "Women's",
    record: standing ? `${standing.wins}-${standing.losses}` : "No games played",
    ranking: standing ? standing.seed : null,
  });
}
