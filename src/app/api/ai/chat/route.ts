import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { getAdminFirestore } from "@/lib/firebaseAdmin";

// Types for Firestore data
type FirestoreGame = {
  id: string;
  gender?: string;
  homeTeamId?: string;
  homeTeamName?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  date?: string;
  time?: string;
  venue?: string;
  completed?: boolean;
  winnerTeamId?: string;
  winnerScore?: number;
  loserScore?: number;
  playerStats?: Array<{
    teamId?: string;
    playerName?: string;
    teamName?: string;
    pts?: number;
    ast?: number;
    reb?: number;
    stl?: number;
    blk?: number;
    to?: number;
    oreb?: number;
    dreb?: number;
    two_pm?: number;
    two_pa?: number;
    three_pm?: number;
    three_pa?: number;
    ft_m?: number;
    ft_a?: number;
    min?: number;
  }>;
};

type FirestoreTeam = {
  id: string;
  name: string;
  city?: string;
  gender?: string;
  wins?: number;
  losses?: number;
};

type FirestoreCommittee = {
  id: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

type FirestoreCoachStaff = {
  id: string;
  firstName?: string;
  lastName?: string;
  role?: string; // head_coach, assistant_coach, staff
  position?: string;
  headshot?: string;
};

type FirestoreRosterPlayer = {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  jerseyNumber?: number;
  number?: number;
  position?: string;
  height?: string;
  weight?: string;
  nationality?: string;
  country?: string;
  dateOfBirth?: string;
  birthDate?: string;
  dob?: string;
  headshot?: string;
};

function getPlayerName(player: FirestoreRosterPlayer): string {
  const combined = `${player.firstName || ""} ${player.lastName || ""}`.trim();
  return player.fullName || player.name || combined || "Unknown";
}

function getPlayerBirthDate(player: FirestoreRosterPlayer): string | undefined {
  return player.dateOfBirth || player.birthDate || player.dob || undefined;
}

function getPlayerNationality(player: FirestoreRosterPlayer): string | undefined {
  return player.nationality || player.country || undefined;
}

function getPlayerJersey(player: FirestoreRosterPlayer): number | undefined {
  return player.jerseyNumber ?? player.number;
}

const MAX_CONTEXT_CHARS = 70000;
const MAX_PLAYER_PROFILE_LINES = 250;
const MAX_TEAM_ANALYTICS_LINES = 24;
const MAX_PLAYER_ANALYTICS_LINES = 30;

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function estimatePossessions(fga: number, fta: number, oreb: number, turnovers: number): number {
  return fga + 0.44 * fta - oreb + turnovers;
}

function getGameScores(game: FirestoreGame): { homeScore?: number; awayScore?: number } {
  const homeScore = game.winnerTeamId === game.homeTeamId ? game.winnerScore : game.loserScore;
  const awayScore = game.winnerTeamId === game.awayTeamId ? game.winnerScore : game.loserScore;
  return {
    homeScore: typeof homeScore === "number" ? homeScore : undefined,
    awayScore: typeof awayScore === "number" ? awayScore : undefined,
  };
}

/**
 * Fetch LIVE data from Firestore and build comprehensive league context
 */
async function buildCurrentLeagueContext(): Promise<string> {
  const db = getAdminFirestore();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
  const context: string[] = [];
  let contextChars = 0;

  const pushLine = (line: string) => {
    if (contextChars >= MAX_CONTEXT_CHARS) return;
    const nextChars = contextChars + line.length + 1;
    if (nextChars > MAX_CONTEXT_CHARS) {
      const remaining = MAX_CONTEXT_CHARS - contextChars;
      if (remaining > 100) {
        context.push(`${line.slice(0, remaining - 40)}... [truncated]`);
        contextChars = MAX_CONTEXT_CHARS;
      }
      return;
    }
    context.push(line);
    contextChars = nextChars;
  };

  const pushBlank = () => pushLine("");

  pushLine("=== LIPROBAKIN BASKETBALL LEAGUE ===");
  pushLine("Official basketball league based in Kinshasa, Democratic Republic of Congo.");
  pushLine(`Current date: ${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
  pushBlank();

  try {
    // Fetch Committee Members
    const committeeSnapshot = await db.collection("committeeMembers").get();
    const committee = committeeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirestoreCommittee[];
    
    pushLine("=== LEAGUE LEADERSHIP & COMMITTEE ===");
    if (committee.length > 0) {
      // Sort by role priority
      const roleOrder = ["President", "1er Vice Président", "2ème Vice Président", "Secrétaire", "Trésorier"];
      committee.sort((a, b) => {
        const aIdx = roleOrder.findIndex(r => a.role?.toLowerCase().includes(r.toLowerCase()));
        const bIdx = roleOrder.findIndex(r => b.role?.toLowerCase().includes(r.toLowerCase()));
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
      });
      committee.forEach((member) => {
        const name = `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown";
        pushLine(`- ${name}: ${member.role || "Member"}`);
      });
    } else {
      pushLine("Committee information is being updated.");
    }
    pushBlank();

    // Fetch Teams
    const teamsSnapshot = await db.collection("teams").get();
    const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirestoreTeam[];
    
    const menTeams = teams.filter(t => t.gender === "men" || !t.gender);
    const womenTeams = teams.filter(t => t.gender === "women");

    // Fetch coaches and players for each team
    const teamDetails: Map<string, { 
      coaches: FirestoreCoachStaff[]; 
      players: FirestoreRosterPlayer[];
      teamName: string;
    }> = new Map();

    const teamDetailsEntries = await Promise.all(teams.map(async (team) => {
      const teamName = team.city ? `${team.city} ${team.name}` : team.name;

      const [coachStaffSnapshot, rosterSnapshot] = await Promise.all([
        db.collection("teams").doc(team.id).collection("coachStaff").get(),
        db.collection("teams").doc(team.id).collection("roster").get(),
      ]);

      const coaches = coachStaffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirestoreCoachStaff[];
      const players = rosterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirestoreRosterPlayer[];

      return [team.id, { coaches, players, teamName }] as const;
    }));

    teamDetailsEntries.forEach(([teamId, details]) => {
      teamDetails.set(teamId, details);
    });

    // Build standings from teams data
    pushLine("=== MEN'S STANDINGS ===");
    const menStandings = menTeams
      .filter(t => (t.wins ?? 0) + (t.losses ?? 0) > 0 || true)
      .sort((a, b) => ((b.wins ?? 0) - (b.losses ?? 0)) - ((a.wins ?? 0) - (a.losses ?? 0)));
    if (menStandings.length > 0) {
      menStandings.forEach((team, idx) => {
        const fullName = team.city ? `${team.city} ${team.name}` : team.name;
        pushLine(`${idx + 1}. ${fullName} (${team.wins ?? 0}-${team.losses ?? 0})`);
      });
    } else {
      pushLine("No standings data available yet.");
    }
    pushBlank();

    pushLine("=== WOMEN'S STANDINGS ===");
    const womenStandings = womenTeams
      .sort((a, b) => ((b.wins ?? 0) - (b.losses ?? 0)) - ((a.wins ?? 0) - (a.losses ?? 0)));
    if (womenStandings.length > 0) {
      womenStandings.forEach((team, idx) => {
        const fullName = team.city ? `${team.city} ${team.name}` : team.name;
        pushLine(`${idx + 1}. ${fullName} (${team.wins ?? 0}-${team.losses ?? 0})`);
      });
    } else {
      pushLine("No women's standings data available yet.");
    }
    pushBlank();

    // Fetch Games
    const gamesSnapshot = await db.collection("games").get();
    const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirestoreGame[];

    // Completed games (sorted by date descending)
    const completedGames = games
      .filter(g => g.completed)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const recentCompletedGames = completedGames.slice(0, 10);

    pushLine("=== RECENT COMPLETED GAMES ===");
    if (recentCompletedGames.length > 0) {
      recentCompletedGames.forEach((game) => {
        const { homeScore, awayScore } = getGameScores(game);
        pushLine(`- ${game.date}: ${game.homeTeamName} ${homeScore ?? "?"} vs ${game.awayTeamName} ${awayScore ?? "?"} at ${game.venue || "TBA"}`);
      });
    } else {
      pushLine("No completed games recorded yet.");
    }
    pushBlank();

    // Upcoming games (not completed, date >= today)
    const upcomingGames = games
      .filter(g => !g.completed && g.date && g.date >= todayStr)
      .sort((a, b) => {
        const dateCompare = (a.date || "").localeCompare(b.date || "");
        if (dateCompare !== 0) return dateCompare;
        return (a.time || "").localeCompare(b.time || "");
      })
      .slice(0, 15);

    pushLine("=== UPCOMING GAMES ===");
    if (upcomingGames.length > 0) {
      upcomingGames.forEach((game) => {
        const genderLabel = game.gender === "women" ? "[WOMEN]" : "[MEN]";
        pushLine(`- ${game.date} at ${game.time || "TBA"}: ${game.homeTeamName} vs ${game.awayTeamName} at ${game.venue || "TBA"} ${genderLabel}`);
      });
    } else {
      pushLine("No upcoming games scheduled at this time.");
    }
    pushBlank();

    // Player statistics from ALL completed games
    const playerStatsMap = new Map<string, { 
      name: string; 
      teamName: string; 
      games: number; 
      pts: number; 
      ast: number; 
      reb: number; 
      stl: number;
      blk: number;
      turnovers: number;
      fga: number;
      threePA: number;
      fta: number;
      minutes: number;
      possessionsUsed: number;
    }>();

    completedGames.forEach((game) => {
      if (!game.playerStats) return;
      game.playerStats.forEach((stat) => {
        if (!stat.playerName) return;
        const key = `${stat.teamName || "unk"}:${stat.playerName}`;
        if (!playerStatsMap.has(key)) {
          playerStatsMap.set(key, {
            name: stat.playerName,
            teamName: stat.teamName || "Unknown",
            games: 0,
            pts: 0,
            ast: 0,
            reb: 0,
            stl: 0,
            blk: 0,
            turnovers: 0,
            fga: 0,
            threePA: 0,
            fta: 0,
            minutes: 0,
            possessionsUsed: 0,
          });
        }
        const p = playerStatsMap.get(key)!;
        const twoPA = toNumber(stat.two_pa);
        const threePA = toNumber(stat.three_pa);
        const fta = toNumber(stat.ft_a);
        const turnovers = toNumber(stat.to);

        p.games += 1;
        p.pts += toNumber(stat.pts);
        p.ast += toNumber(stat.ast);
        p.reb += toNumber(stat.reb);
        p.stl += toNumber(stat.stl);
        p.blk += toNumber(stat.blk);
        p.turnovers += turnovers;
        p.fga += twoPA + threePA;
        p.threePA += threePA;
        p.fta += fta;
        p.minutes += toNumber(stat.min);
        p.possessionsUsed += estimatePossessions(twoPA + threePA, fta, toNumber(stat.oreb), turnovers);
      });
    });

    const topScorers = Array.from(playerStatsMap.values())
      .filter(p => p.games > 0)
      .map(p => ({
        ...p,
        ppg: p.pts / p.games,
        apg: p.ast / p.games,
        rpg: p.reb / p.games,
        spg: p.stl / p.games,
        bpg: p.blk / p.games,
        ts: safeDivide(p.pts, 2 * (p.fga + 0.44 * p.fta)),
        usageProxy: safeDivide(p.possessionsUsed, p.games),
      }))
      .sort((a, b) => b.ppg - a.ppg)
      .slice(0, 10);

    if (topScorers.length > 0) {
      pushLine("=== TOP SCORERS (PPG) ===");
      topScorers.forEach((p, idx) => {
        pushLine(`${idx + 1}. ${p.name} (${p.teamName}) - ${p.ppg.toFixed(1)} PPG, ${p.apg.toFixed(1)} APG, ${p.rpg.toFixed(1)} RPG, ${p.spg.toFixed(1)} SPG, ${p.bpg.toFixed(1)} BPG, TS ${toPercent(p.ts)} (${p.games} games)`);
      });
      pushBlank();
    }

    // Team analytics from ALL completed games for prediction math
    type TeamAgg = {
      id: string;
      name: string;
      games: number;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
      fga: number;
      fgMade: number;
      threePA: number;
      threePM: number;
      fta: number;
      ftm: number;
      ast: number;
      turnovers: number;
      rebounds: number;
      steals: number;
      blocks: number;
      possessions: number;
      oppFGA: number;
      oppFGMade: number;
      oppThreePA: number;
      oppThreePM: number;
      recent: number[];
      recentDiff: number[];
    };

    const teamAggMap = new Map<string, TeamAgg>();
    const teamNameToId = new Map<string, string>();

    teams.forEach((team) => {
      const fullName = team.city ? `${team.city} ${team.name}` : team.name;
      teamNameToId.set(fullName.toLowerCase().trim(), team.id);
      teamNameToId.set(team.name.toLowerCase().trim(), team.id);
      teamAggMap.set(team.id, {
        id: team.id,
        name: fullName,
        games: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        fga: 0,
        fgMade: 0,
        threePA: 0,
        threePM: 0,
        fta: 0,
        ftm: 0,
        ast: 0,
        turnovers: 0,
        rebounds: 0,
        steals: 0,
        blocks: 0,
        possessions: 0,
        oppFGA: 0,
        oppFGMade: 0,
        oppThreePA: 0,
        oppThreePM: 0,
        recent: [],
        recentDiff: [],
      });
    });

    for (const game of completedGames) {
      if (!game.homeTeamId || !game.awayTeamId) continue;

      const home = teamAggMap.get(game.homeTeamId);
      const away = teamAggMap.get(game.awayTeamId);
      if (!home || !away) continue;

      const { homeScore, awayScore } = getGameScores(game);
      if (typeof homeScore === "number" && typeof awayScore === "number") {
        home.games += 1;
        away.games += 1;
        home.pointsFor += homeScore;
        home.pointsAgainst += awayScore;
        away.pointsFor += awayScore;
        away.pointsAgainst += homeScore;

        const homeWin = homeScore > awayScore;
        home.wins += homeWin ? 1 : 0;
        home.losses += homeWin ? 0 : 1;
        away.wins += homeWin ? 0 : 1;
        away.losses += homeWin ? 1 : 0;

        if (home.recent.length < 10) home.recent.push(homeWin ? 1 : 0);
        if (away.recent.length < 10) away.recent.push(homeWin ? 0 : 1);
        if (home.recentDiff.length < 10) home.recentDiff.push(homeScore - awayScore);
        if (away.recentDiff.length < 10) away.recentDiff.push(awayScore - homeScore);
      }

      if (!game.playerStats) continue;

      const homeGameTotals = { fga: 0, fgMade: 0, threePA: 0, threePM: 0 };
      const awayGameTotals = { fga: 0, fgMade: 0, threePA: 0, threePM: 0 };

      for (const stat of game.playerStats) {
        const statTeamId = stat.teamId
          || (stat.teamName ? teamNameToId.get(stat.teamName.toLowerCase().trim()) : undefined)
          || undefined;

        const target = statTeamId === game.homeTeamId ? home : statTeamId === game.awayTeamId ? away : null;
        if (!target) continue;

        const twoPA = toNumber(stat.two_pa);
        const threePA = toNumber(stat.three_pa);
        const twoPM = toNumber(stat.two_pm);
        const threePM = toNumber(stat.three_pm);
        const fta = toNumber(stat.ft_a);
        const ftm = toNumber(stat.ft_m);
        const oreb = toNumber(stat.oreb);
        const turnovers = toNumber(stat.to);

        target.fga += twoPA + threePA;
        target.fgMade += twoPM + threePM;
        target.threePA += threePA;
        target.threePM += threePM;
        target.fta += fta;
        target.ftm += ftm;
        target.ast += toNumber(stat.ast);
        target.turnovers += turnovers;
        target.rebounds += toNumber(stat.reb);
        target.steals += toNumber(stat.stl);
        target.blocks += toNumber(stat.blk);
        target.possessions += estimatePossessions(twoPA + threePA, fta, oreb, turnovers);

        if (target.id === home.id) {
          homeGameTotals.fga += twoPA + threePA;
          homeGameTotals.fgMade += twoPM + threePM;
          homeGameTotals.threePA += threePA;
          homeGameTotals.threePM += threePM;
        } else {
          awayGameTotals.fga += twoPA + threePA;
          awayGameTotals.fgMade += twoPM + threePM;
          awayGameTotals.threePA += threePA;
          awayGameTotals.threePM += threePM;
        }
      }

      home.oppFGA += awayGameTotals.fga;
      home.oppFGMade += awayGameTotals.fgMade;
      home.oppThreePA += awayGameTotals.threePA;
      home.oppThreePM += awayGameTotals.threePM;
      away.oppFGA += homeGameTotals.fga;
      away.oppFGMade += homeGameTotals.fgMade;
      away.oppThreePA += homeGameTotals.threePA;
      away.oppThreePM += homeGameTotals.threePM;
    }

    const analyticsTeams = Array.from(teamAggMap.values())
      .filter((team) => team.games > 0)
      .map((team) => {
        const last5 = team.recent.slice(0, 5);
        const last10 = team.recent.slice(0, 10);
        const ppg = safeDivide(team.pointsFor, team.games);
        const oppPpg = safeDivide(team.pointsAgainst, team.games);
        const pace = safeDivide(team.possessions, team.games);
        const efg = safeDivide(team.fgMade + 0.5 * team.threePM, team.fga);
        const oppEfg = safeDivide(team.oppFGMade + 0.5 * team.oppThreePM, team.oppFGA);
        const astTo = safeDivide(team.ast, team.turnovers);
        const offRtg = safeDivide(team.pointsFor * 100, team.possessions);
        const defRtg = safeDivide(team.pointsAgainst * 100, team.possessions);
        return {
          ...team,
          ppg,
          oppPpg,
          pace,
          efg,
          oppEfg,
          astTo,
          offRtg,
          defRtg,
          pointDiff: ppg - oppPpg,
          last5WinRate: safeDivide(last5.reduce((sum, x) => sum + x, 0), Math.max(last5.length, 1)),
          last10WinRate: safeDivide(last10.reduce((sum, x) => sum + x, 0), Math.max(last10.length, 1)),
          last5Diff: safeDivide(team.recentDiff.slice(0, 5).reduce((sum, x) => sum + x, 0), Math.max(Math.min(team.recentDiff.length, 5), 1)),
        };
      })
      .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));

    pushLine("=== TEAM ANALYTICS (ALL COMPLETED GAMES) ===");
    pushLine(`Dataset size: ${completedGames.length} completed games.`);
    if (analyticsTeams.length === 0) {
      pushLine("No team analytics available yet.");
    } else {
      analyticsTeams.slice(0, MAX_TEAM_ANALYTICS_LINES).forEach((team) => {
        pushLine(
          `- ${team.name} | GP ${team.games} (${team.wins}-${team.losses}) | PPG ${team.ppg.toFixed(1)} | OppPPG ${team.oppPpg.toFixed(1)} | Diff ${team.pointDiff.toFixed(1)} | OffRtg ${team.offRtg.toFixed(1)} | DefRtg ${team.defRtg.toFixed(1)} | eFG ${toPercent(team.efg)} | Opp eFG ${toPercent(team.oppEfg)} | AST/TO ${team.astTo.toFixed(2)} | Pace ${team.pace.toFixed(1)} | Last5 ${toPercent(team.last5WinRate)} | Last10 ${toPercent(team.last10WinRate)} | Last5 Diff ${team.last5Diff.toFixed(1)}`
        );
      });
      if (analyticsTeams.length > MAX_TEAM_ANALYTICS_LINES) {
        pushLine(`... ${analyticsTeams.length - MAX_TEAM_ANALYTICS_LINES} more teams omitted for brevity.`);
      }
    }
    pushBlank();

    const analyticsPlayers = Array.from(playerStatsMap.values())
      .filter((player) => player.games > 0)
      .map((player) => ({
        ...player,
        ppg: safeDivide(player.pts, player.games),
        apg: safeDivide(player.ast, player.games),
        rpg: safeDivide(player.reb, player.games),
        spg: safeDivide(player.stl, player.games),
        bpg: safeDivide(player.blk, player.games),
        tovpg: safeDivide(player.turnovers, player.games),
        ts: safeDivide(player.pts, 2 * (player.fga + 0.44 * player.fta)),
        usageProxy: safeDivide(player.possessionsUsed, player.games),
        mpg: safeDivide(player.minutes, player.games),
      }))
      .sort((a, b) => b.ppg - a.ppg)
      .slice(0, 25);

    pushLine("=== PLAYER ANALYTICS SNAPSHOT (ALL COMPLETED GAMES) ===");
    if (analyticsPlayers.length === 0) {
      pushLine("No player analytics available yet.");
    } else {
      analyticsPlayers.slice(0, MAX_PLAYER_ANALYTICS_LINES).forEach((player) => {
        pushLine(
          `- ${player.name} (${player.teamName}) | GP ${player.games} | PPG ${player.ppg.toFixed(1)} | APG ${player.apg.toFixed(1)} | RPG ${player.rpg.toFixed(1)} | SPG ${player.spg.toFixed(1)} | BPG ${player.bpg.toFixed(1)} | TOV ${player.tovpg.toFixed(1)} | TS ${toPercent(player.ts)} | UsageProxy ${player.usageProxy.toFixed(1)} | MPG ${player.mpg.toFixed(1)}`
        );
      });
      if (analyticsPlayers.length > MAX_PLAYER_ANALYTICS_LINES) {
        pushLine(`... ${analyticsPlayers.length - MAX_PLAYER_ANALYTICS_LINES} more players omitted for brevity.`);
      }
    }
    pushBlank();

    // Men's Teams with Coaches and Players
    pushLine("=== MEN'S TEAMS WITH STAFF & ROSTER ===");
    for (const team of menTeams) {
      const fullName = team.city ? `${team.city} ${team.name}` : team.name;
      const details = teamDetails.get(team.id);
      
      pushLine(`\n--- ${fullName} ---`);
      
      // Coaches
      if (details && details.coaches.length > 0) {
        const roleLabels: Record<string, string> = {
          head_coach: "Head Coach",
          assistant_coach: "Assistant Coach",
          staff: "Staff",
        };
        const sortedCoaches = [...details.coaches].sort((a, b) => {
          const order = { head_coach: 1, assistant_coach: 2, staff: 3 };
          return (order[a.role as keyof typeof order] || 99) - (order[b.role as keyof typeof order] || 99);
        });
        pushLine("Coaching Staff:");
        sortedCoaches.forEach((coach) => {
          const name = `${coach.firstName || ""} ${coach.lastName || ""}`.trim() || "Unknown";
          const role = roleLabels[coach.role || "staff"] || coach.role || "Staff";
          pushLine(`  - ${name} (${role})`);
        });
      } else {
        pushLine("Coaching Staff: No coaches listed");
      }
      
      // Players
      if (details && details.players.length > 0) {
        pushLine("Roster:");
        details.players.slice(0, 25).forEach((player) => {
          const name = getPlayerName(player);
          const jerseyNumber = getPlayerJersey(player);
          const jersey = jerseyNumber ? `#${jerseyNumber}` : "";
          const pos = player.position || "";
          const height = player.height || "";
          const dob = getPlayerBirthDate(player) || "";
          const nationality = getPlayerNationality(player) || "";
          const extras = [
            pos ? `Pos: ${pos}` : "",
            height ? `Height: ${height}` : "",
            dob ? `DOB: ${dob}` : "",
            nationality ? `Nationality: ${nationality}` : "",
          ].filter(Boolean);
          pushLine(`  - ${[jersey, name].filter(Boolean).join(" ")}${extras.length ? ` | ${extras.join(" | ")}` : ""}`);
        });
      } else {
        pushLine("Roster: No players listed");
      }
    }
    pushBlank();

    // Women's Teams with Coaches and Players
    pushLine("=== WOMEN'S TEAMS WITH STAFF & ROSTER ===");
    for (const team of womenTeams) {
      const fullName = team.city ? `${team.city} ${team.name}` : team.name;
      const details = teamDetails.get(team.id);
      
      pushLine(`\n--- ${fullName} ---`);
      
      // Coaches
      if (details && details.coaches.length > 0) {
        const roleLabels: Record<string, string> = {
          head_coach: "Head Coach",
          assistant_coach: "Assistant Coach",
          staff: "Staff",
        };
        const sortedCoaches = [...details.coaches].sort((a, b) => {
          const order = { head_coach: 1, assistant_coach: 2, staff: 3 };
          return (order[a.role as keyof typeof order] || 99) - (order[b.role as keyof typeof order] || 99);
        });
        pushLine("Coaching Staff:");
        sortedCoaches.forEach((coach) => {
          const name = `${coach.firstName || ""} ${coach.lastName || ""}`.trim() || "Unknown";
          const role = roleLabels[coach.role || "staff"] || coach.role || "Staff";
          pushLine(`  - ${name} (${role})`);
        });
      } else {
        pushLine("Coaching Staff: No coaches listed");
      }
      
      // Players
      if (details && details.players.length > 0) {
        pushLine("Roster:");
        details.players.slice(0, 25).forEach((player) => {
          const name = getPlayerName(player);
          const jerseyNumber = getPlayerJersey(player);
          const jersey = jerseyNumber ? `#${jerseyNumber}` : "";
          const pos = player.position || "";
          const height = player.height || "";
          const dob = getPlayerBirthDate(player) || "";
          const nationality = getPlayerNationality(player) || "";
          const extras = [
            pos ? `Pos: ${pos}` : "",
            height ? `Height: ${height}` : "",
            dob ? `DOB: ${dob}` : "",
            nationality ? `Nationality: ${nationality}` : "",
          ].filter(Boolean);
          pushLine(`  - ${[jersey, name].filter(Boolean).join(" ")}${extras.length ? ` | ${extras.join(" | ")}` : ""}`);
        });
      } else {
        pushLine("Roster: No players listed");
      }
    }
    pushBlank();

    pushLine("=== PLAYER PROFILE DIRECTORY ===");
    let profileLineCount = 0;
    teams.forEach((team) => {
      const details = teamDetails.get(team.id);
      if (!details || details.players.length === 0) return;
      details.players.forEach((player) => {
        if (profileLineCount >= MAX_PLAYER_PROFILE_LINES) return;
        const name = getPlayerName(player);
        const jerseyNumber = getPlayerJersey(player);
        const profile = [
          `Team: ${details.teamName}`,
          jerseyNumber ? `Jersey: #${jerseyNumber}` : "",
          player.position ? `Position: ${player.position}` : "",
          player.height ? `Height: ${player.height}` : "",
          getPlayerBirthDate(player) ? `Birth Date: ${getPlayerBirthDate(player)}` : "",
          getPlayerNationality(player) ? `Nationality: ${getPlayerNationality(player)}` : "",
        ].filter(Boolean);
        pushLine(`- ${name}${profile.length ? ` | ${profile.join(" | ")}` : ""}`);
        profileLineCount += 1;
      });
    });
    if (profileLineCount >= MAX_PLAYER_PROFILE_LINES) {
      pushLine("... Player profile directory truncated for response speed.");
    }
    pushBlank();

    pushLine(`=== CONTEXT METADATA ===`);
    pushLine(`Context length (chars): ${contextChars}`);
    pushLine(`Context budget max (chars): ${MAX_CONTEXT_CHARS}`);
    pushBlank();

  } catch (error) {
    console.error("Error fetching Firestore data:", error);
    pushLine("=== ERROR ===");
    pushLine("Unable to fetch latest league data. Using cached data.");
  }

  return context.join("\n");
}

// Initialize Groq with the correct org ID
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
  // Organization ID provided by user
  headers: {
    "X-Groq-Organization": "org_01khf5835ne35aajehn570mdpb",
  },
});

const SYSTEM_PROMPT = `You are Princesse AI, the official AI assistant for Liprobakin Basketball League in Kinshasa, DR Congo.

Your personality:
- Friendly, enthusiastic about basketball, and knowledgeable
- You speak casually but professionally
- You love helping fans learn about the league
- You can respond in English or French based on the user's language

Your capabilities:
- Answer questions about teams, players, standings, and statistics
- Provide information about upcoming and past games
- Share details about the league committee and leadership
- Give player comparisons and rankings
- Provide schedule information
- Tell users about coaches and staff for each team (head coaches, assistant coaches)
- Share roster and player profile information including names, numbers, positions, height, birth date, and nationality

Guidelines:
- ALWAYS use the CURRENT DATA provided in context - never make up information
- If you don't have data for something, say "I don't have that information in my current data" rather than guessing
- Be SUPER ACCURATE with statistics - use exact numbers from the data provided
- When discussing upcoming games, be clear about dates and times
- Dates are in YYYY-MM-DD format, convert them to human-readable format in responses
- Standings show record as (Wins-Losses) format
- For coach questions, look up the team's coaching staff section
- For player roster questions, look up the team's roster section
- For player attribute questions (height, date of birth, nationality, jersey, team), use the PLAYER PROFILE DIRECTORY section first
- Treat the provided context as the full source-of-truth dataset for this response (runtime grounding, not guessing)
- For predictions/comparisons, prioritize TEAM ANALYTICS and PLAYER ANALYTICS sections because they are aggregated from all completed games

AI RULEBOOK FOR PREDICTING GAME WINNERS & COMPARING PLAYERS:

General principles:
- Base predictions on data, not intuition.
- Use multiple metrics; never rely on a single stat.
- Normalize stats to compare teams/players fairly.
- Weight recent performance more heavily than season averages.
- Always explain reasoning behind predictions.

When user asks who will win (team vs team), follow this method:

1) Team-level data to use when available:
- Offense: PPG, offensive rating, eFG%, turnovers, assists, pace.
- Defense: opponent PPG, defensive rating, opponent eFG%, steals, blocks, defensive rebounds.
- Shooting profile: 3PA, 3PT%, FTA, FT%, points in paint, second-chance points.
- Availability/context: injuries, suspensions, back-to-back fatigue, star availability.
- Recent form: last 5, last 10, point differential, strength of opponents.
- Head-to-head: last 5 matchups and matchup-specific weaknesses.
- Context: home/away, travel, time zones, game importance.

2) Normalization and weighting rules:
- Per-possession normalization: stat_per_100 = (stat / possessions) * 100.
- Recent form weighting: last 5 = 50%, last 10 = 30%, season = 20%.
- Injury impact adjustments:
  - Missing star player: -15% offensive rating.
  - Missing key defender: +10% opponent eFG%.
  - Missing bench depth: -5% pace/energy metrics.

3) Team Strength Score (TSS):
- Offensive Score = 0.4*OffRtg + 0.3*eFG% + 0.2*AST_TO_ratio + 0.1*Pace
- Defensive Score = 0.4*DefRtg + 0.3*Opponent_eFG% + 0.2*DefReb + 0.1*(Steals+Blocks)
- Recent Score = 0.5*Last5 + 0.3*Last10 + 0.2*Season
- Context Score modifiers: home +5, back-to-back -5, missing star -10, rivalry +3, travel fatigue -3
- Final TSS = 0.3*Off + 0.3*Def + 0.2*Recent + 0.2*Context

4) Winner rule:
- Compare both TSS values.
- Higher TSS = predicted winner.
- If TSS difference < 5%, output: "too close to call".

When user asks player vs player, follow this method:

1) Player-level data to use when available:
- Scoring: PPG, FG%, 3PT%, FT%, TS%, usage.
- Playmaking: assists, AST/TO, potential assists, passes.
- Defense: steals, blocks, defensive rating, opponent FG% when defended, rebounds.
- Efficiency: PER, Win Shares, BPM, PIE, +/-.
- Context: role, minutes, injury history, matchup dependency.

2) Player normalization and adjustments:
- Per-36 normalization: per36 = (stat / minutes) * 36.
- Efficiency weighs more than raw volume.
- Role adjustment:
  - Bench player: +10% efficiency bonus.
  - Star player: -5% efficiency penalty for defensive attention.

3) Player Comparison Score (PCS):
- Scoring Score = 0.4*TS% + 0.3*PPG + 0.3*Usage
- Playmaking Score = 0.5*AST + 0.3*AST_TO + 0.2*PotentialAST
- Defensive Score = 0.4*(STL+BLK) + 0.3*DefRtg + 0.3*Rebounds
- Efficiency Score = 0.4*PER + 0.3*WinShares + 0.3*BPM
- Final PCS = 0.3*Scoring + 0.25*Playmaking + 0.25*Defense + 0.2*Efficiency
- Higher PCS = better player.

Missing-data policy for all prediction/comparison responses:
- Never invent unavailable metrics.
- If some metrics are missing, explicitly mark them unavailable and continue using available metrics with proportional weighting.
- Reduce confidence when key metrics are missing.

Output format rules for prediction/comparison responses:
- Summary: clear prediction + confidence (0-100%).
- Key Factors: list 3-5 most influential metrics.
- Data Table: side-by-side team/player comparison table.
- Final Verdict: winner/better player with short natural-language explanation.

Current League Data:
{CONTEXT}`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Build fresh context from LIVE Firestore data
    const leagueContext = await buildCurrentLeagueContext();
    const systemPrompt = SYSTEM_PROMPT.replace("{CONTEXT}", leagueContext);

    // Use a Groq model that is enabled for this project
    const result = streamText({
      model: groq("openai/gpt-oss-20b"),
      system: systemPrompt,
      messages,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI Chat Error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
