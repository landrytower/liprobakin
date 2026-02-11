// Re-export types from the web app's types directory
// This creates a shared types layer between web and mobile

// User types
export type UserRole = "player" | "coach" | "staff" | "fan";
export type VerificationStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  phoneVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
  teamId?: string;
  teamName?: string;
  playerNumber?: string;
  position?: string;
  verificationStatus?: VerificationStatus;
  linkedPlayerId?: string;
  linkedPlayerName?: string;
  favoriteTeamMenId?: string;
  favoriteTeamMenName?: string;
  favoriteTeamWomenId?: string;
  favoriteTeamWomenName?: string;
}

// Team types
export interface Team {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  city?: string;
  gender: "men" | "women";
  league?: string;
  wins: number;
  losses: number;
}

// Player types
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  number?: number;
  position?: string;
  height?: string;
  weight?: string;
  birthdate?: string;
  nationality?: string;
  headshot?: string;
  teamId: string;
  teamName?: string;
}

// Game types
export type GameStatus = "scheduled" | "in_progress" | "final" | "postponed" | "cancelled";

export interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  scheduledTime: Date;
  venue?: string;
  league?: string;
}

// Stats types
export interface PlayerStats {
  playerId: string;
  gameId?: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  minutesPlayed: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
}

// Navigation types for type-safe routing
export type RootStackParamList = {
  "(tabs)": undefined;
  "team/[id]": { id: string };
  "player/[id]": { id: string };
  "game/[id]": { id: string };
};
