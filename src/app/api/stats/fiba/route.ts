import { NextResponse } from "next/server";

type Primitive = string | number | boolean | null | undefined;

type JsonRecord = Record<string, unknown>;

type NormalizedPlayerStat = {
  team: "home" | "away";
  jerseyNumber?: string;
  playerName: string;
  stats: {
    points: number;
    minutes: number;
    rebounds: number;
    offensiveRebounds: number;
    defensiveRebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    blockedAgainst: number;
    turnovers: number;
    fouls: number;
    foulsDrawn: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    twoPointsMade: number;
    twoPointsAttempted: number;
    threePointsMade: number;
    threePointsAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    plusMinus: number;
  };
};

type NormalizedImport = {
  homeScore: number;
  awayScore: number;
  players: NormalizedPlayerStat[];
};

const NUMBER_ALIASES: Record<keyof NormalizedPlayerStat["stats"], string[]> = {
  points: ["points", "pts", "point", "score"],
  minutes: ["minutes", "min", "mins"],
  rebounds: ["rebounds", "reb", "trb"],
  offensiveRebounds: ["offensiveRebounds", "oreb", "orb"],
  defensiveRebounds: ["defensiveRebounds", "dreb", "drb"],
  assists: ["assists", "ast"],
  steals: ["steals", "stl"],
  blocks: ["blocks", "blk"],
  blockedAgainst: ["blockedAgainst", "blocked_against", "contreSubi", "contre_subi", "cs"],
  turnovers: ["turnovers", "to", "tov"],
  fouls: ["fouls", "pf", "personalFouls"],
  foulsDrawn: ["foulsDrawn", "fd", "fouled"],
  fieldGoalsMade: ["fieldGoalsMade", "fgm"],
  fieldGoalsAttempted: ["fieldGoalsAttempted", "fga"],
  twoPointsMade: ["twoPointsMade", "2pm", "two_pm"],
  twoPointsAttempted: ["twoPointsAttempted", "2pa", "two_pa"],
  threePointsMade: ["threePointsMade", "3pm", "three_pm"],
  threePointsAttempted: ["threePointsAttempted", "3pa", "three_pa"],
  freeThrowsMade: ["freeThrowsMade", "ftm", "ft_m", "lf_r", "lfr"],
  freeThrowsAttempted: ["freeThrowsAttempted", "fta", "ft_a", "lf_t", "lft"],
  plusMinus: ["plusMinus", "plus_minus", "+/-", "pm"],
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeKey(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function findNumberByAliases(source: JsonRecord, aliases: string[]): number {
  const entries = Object.entries(source);
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === normalizedAlias);
    if (found) {
      return toNumber(found[1]);
    }
  }
  return 0;
}

function hasAliasValue(source: JsonRecord, aliases: string[]): boolean {
  const entries = Object.entries(source);
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === normalizedAlias);
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== "") {
      return true;
    }
  }
  return false;
}

function getString(source: JsonRecord, aliases: string[]): string {
  const entries = Object.entries(source);
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === normalizedAlias);
    if (found && found[1] != null) {
      return String(found[1]).trim();
    }
  }
  return "";
}

function collectPlayers(payload: JsonRecord): JsonRecord[] {
  const direct = payload.players;
  if (Array.isArray(direct)) {
    return direct.filter((item): item is JsonRecord => typeof item === "object" && item !== null);
  }

  const nestedCandidates = [
    payload.playerStats,
    (payload.boxscore as JsonRecord | undefined)?.players,
    (payload.data as JsonRecord | undefined)?.players,
    (payload.stats as JsonRecord | undefined)?.players,
  ];

  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is JsonRecord => typeof item === "object" && item !== null);
    }
  }

  return [];
}

function normalizeTeamSide(value: Primitive): "home" | "away" | null {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  if (["home", "domicile", "local", "h"].includes(raw)) return "home";
  if (["away", "visitor", "visiteur", "a"].includes(raw)) return "away";
  return null;
}

function normalizePayload(payload: JsonRecord): NormalizedImport {
  const homeScore = toNumber(payload.homeScore ?? (payload.home as JsonRecord | undefined)?.score ?? (payload.score as JsonRecord | undefined)?.home);
  const awayScore = toNumber(payload.awayScore ?? (payload.away as JsonRecord | undefined)?.score ?? (payload.score as JsonRecord | undefined)?.away);

  const rawPlayers = collectPlayers(payload);

  const players: NormalizedPlayerStat[] = rawPlayers
    .map((player) => {
      const teamSide =
        normalizeTeamSide(player.team as Primitive) ||
        normalizeTeamSide(player.side as Primitive) ||
        normalizeTeamSide(player.teamType as Primitive) ||
        normalizeTeamSide(player.location as Primitive);

      if (!teamSide) {
        return null;
      }

      const jerseyNumber = getString(player, ["jerseyNumber", "number", "jersey", "no", "num"]) || undefined;
      const firstName = getString(player, ["firstName", "firstname", "givenName"]);
      const lastName = getString(player, ["lastName", "lastname", "familyName"]);
      const fullName = getString(player, ["playerName", "name", "fullName"]) || `${firstName} ${lastName}`.trim() || "Unknown Player";

      const statsSource = (player.stats as JsonRecord | undefined) || player;

      const twoPointsMade = findNumberByAliases(statsSource, NUMBER_ALIASES.twoPointsMade);
      const twoPointsAttempted = findNumberByAliases(statsSource, NUMBER_ALIASES.twoPointsAttempted);
      const threePointsMade = findNumberByAliases(statsSource, NUMBER_ALIASES.threePointsMade);
      const threePointsAttempted = findNumberByAliases(statsSource, NUMBER_ALIASES.threePointsAttempted);
      const freeThrowsMade = findNumberByAliases(statsSource, NUMBER_ALIASES.freeThrowsMade);
      const freeThrowsAttempted = findNumberByAliases(statsSource, NUMBER_ALIASES.freeThrowsAttempted);

      const valuesToValidate = [
        twoPointsMade,
        twoPointsAttempted,
        threePointsMade,
        threePointsAttempted,
        freeThrowsMade,
        freeThrowsAttempted,
      ];
      if (valuesToValidate.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new Error(`Invalid shooting values for player ${fullName}. Negative values are not allowed.`);
      }

      if (twoPointsMade > twoPointsAttempted) {
        throw new Error(`Invalid shooting values for player ${fullName}. 2PM cannot exceed 2PA.`);
      }
      if (threePointsMade > threePointsAttempted) {
        throw new Error(`Invalid shooting values for player ${fullName}. 3PM cannot exceed 3PA.`);
      }
      if (freeThrowsMade > freeThrowsAttempted) {
        throw new Error(`Invalid shooting values for player ${fullName}. FTM cannot exceed FTA.`);
      }

      const providedPoints = findNumberByAliases(statsSource, NUMBER_ALIASES.points);
      const providedPointsExists = hasAliasValue(statsSource, NUMBER_ALIASES.points);
      const calculatedPoints = twoPointsMade * 2 + threePointsMade * 3 + freeThrowsMade;
      if (providedPointsExists && providedPoints !== calculatedPoints) {
        throw new Error(
          `Invalid points for player ${fullName}. Expected ${calculatedPoints} from shooting makes, got ${providedPoints}.`
        );
      }

      const providedFgaExists = hasAliasValue(statsSource, NUMBER_ALIASES.fieldGoalsAttempted);
      const providedFgmExists = hasAliasValue(statsSource, NUMBER_ALIASES.fieldGoalsMade);
      const expectedFga = twoPointsAttempted + threePointsAttempted;
      const expectedFgm = twoPointsMade + threePointsMade;
      if (providedFgaExists) {
        const providedFga = findNumberByAliases(statsSource, NUMBER_ALIASES.fieldGoalsAttempted);
        if (providedFga !== expectedFga) {
          throw new Error(`Invalid FGA for player ${fullName}. Expected ${expectedFga}, got ${providedFga}.`);
        }
      }
      if (providedFgmExists) {
        const providedFgm = findNumberByAliases(statsSource, NUMBER_ALIASES.fieldGoalsMade);
        if (providedFgm !== expectedFgm) {
          throw new Error(`Invalid FGM for player ${fullName}. Expected ${expectedFgm}, got ${providedFgm}.`);
        }
      }

      const stats: NormalizedPlayerStat["stats"] = {
        points: calculatedPoints,
        minutes: findNumberByAliases(statsSource, NUMBER_ALIASES.minutes),
        rebounds: findNumberByAliases(statsSource, NUMBER_ALIASES.rebounds),
        offensiveRebounds: findNumberByAliases(statsSource, NUMBER_ALIASES.offensiveRebounds),
        defensiveRebounds: findNumberByAliases(statsSource, NUMBER_ALIASES.defensiveRebounds),
        assists: findNumberByAliases(statsSource, NUMBER_ALIASES.assists),
        steals: findNumberByAliases(statsSource, NUMBER_ALIASES.steals),
        blocks: findNumberByAliases(statsSource, NUMBER_ALIASES.blocks),
        blockedAgainst: findNumberByAliases(statsSource, NUMBER_ALIASES.blockedAgainst),
        turnovers: findNumberByAliases(statsSource, NUMBER_ALIASES.turnovers),
        fouls: findNumberByAliases(statsSource, NUMBER_ALIASES.fouls),
        foulsDrawn: findNumberByAliases(statsSource, NUMBER_ALIASES.foulsDrawn),
        fieldGoalsMade: expectedFgm,
        fieldGoalsAttempted: expectedFga,
        twoPointsMade,
        twoPointsAttempted,
        threePointsMade,
        threePointsAttempted,
        freeThrowsMade,
        freeThrowsAttempted,
        plusMinus: findNumberByAliases(statsSource, NUMBER_ALIASES.plusMinus),
      };

      return {
        team: teamSide,
        jerseyNumber,
        playerName: fullName,
        stats,
      } as NormalizedPlayerStat;
    })
    .filter((item): item is NormalizedPlayerStat => item !== null);

  return { homeScore, awayScore, players };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sourceUrl?: string; payload?: unknown };

    let sourcePayload: unknown = body.payload;

    if (!sourcePayload && body.sourceUrl) {
      const response = await fetch(body.sourceUrl, { cache: "no-store" });
      if (!response.ok) {
        return NextResponse.json({ error: `Failed to fetch source URL (${response.status})` }, { status: 400 });
      }
      sourcePayload = await response.json();
    }

    if (!sourcePayload || typeof sourcePayload !== "object") {
      return NextResponse.json({ error: "Provide either sourceUrl or payload JSON" }, { status: 400 });
    }

    const normalized = normalizePayload(sourcePayload as JsonRecord);

    return NextResponse.json({ success: true, normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
