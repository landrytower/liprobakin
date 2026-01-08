export type UserRole = "player" | "coach" | "staff" | "fan";

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  createdAt: Date;
  updatedAt: Date;
  
  // Player/Coach/Staff specific fields
  teamId?: string;
  teamName?: string;
  playerNumber?: string;
  position?: string;
  verificationStatus?: VerificationStatus;
  verificationImageUrl?: string;
  verificationSubmittedAt?: Date;
  verificationReviewedAt?: Date;
  verificationReviewedBy?: string;
  verificationNotes?: string;
  // Linked player data (set when verification is approved)
  linkedPlayerId?: string; // The actual player ID in team roster
  linkedPlayerName?: string; // The official player name from roster
  
  // Fan specific fields
  favoriteTeamId?: string;
  favoriteTeamName?: string;
  favoriteAthleteId?: string;
  favoriteAthleteName?: string;
  // New fan favorites (men's and women's teams)
  favoriteTeamMenId?: string;
  favoriteTeamMenName?: string;
  favoriteTeamWomenId?: string;
  favoriteTeamWomenName?: string;
  // Favorite players from teams
  favoritePlayerMenId?: string;
  favoritePlayerMenName?: string;
  favoritePlayerWomenId?: string;
  favoritePlayerWomenName?: string;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userEmail?: string;
  userFirstName: string;
  userLastName: string;
  userPhone: string;
  requestType: "claim_existing" | "create_new" | "update_headshot" | "update_name";
  role: "player" | "coach" | "staff";
  teamId: string;
  teamName: string;
  teamGender?: string;
  // For claiming existing player
  existingPlayerId?: string;
  existingPlayerName?: string;
  existingPlayerNumber?: number;
  // For creating new player
  newPlayerData?: {
    firstName: string;
    lastName: string;
    number?: number;
    position?: string;
    height?: string;
    birthdate?: string;
    nationality?: string;
    nationality2?: string | null;
    playerLicense?: string | null;
    headshot?: string | null;
  };
  // For custom player creation (from profile-setup page)
  customPlayer?: boolean;
  customPlayerData?: {
    firstName: string;
    lastName: string;
    jerseyNumber: string;
    position: string;
    height: string;
    dateOfBirth: string;
    nationality: string;
    secondNationality?: string | null;
    playerLicense?: string | null;
    headshotUrl?: string | null;
  };
  // For headshot updates
  newHeadshotUrl?: string;
  previousHeadshotUrl?: string | null;
  // For name updates
  newFirstName?: string;
  newLastName?: string;
  previousFirstName?: string;
  previousLastName?: string;
  idImageUrl?: string;
  status: VerificationStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  notes?: string;
}
