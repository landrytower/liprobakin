export type UserRole = "player" | "coach" | "staff" | "fan";

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  phoneVerified?: boolean; // Whether phone was verified via OTP
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
  
  // Linked coach/staff data (set when verification is approved)
  linkedCoachId?: string; // The actual coach/staff ID in team coachStaff
  linkedCoachName?: string; // The official coach/staff name from coachStaff
  
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
  requestType: "claim_existing" | "create_new" | "update_headshot" | "update_name" | "claim_existing_coach" | "create_new_coach" | "create_new_staff";
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
  // For claiming existing coach
  existingCoachId?: string;
  existingCoachName?: string;
  existingCoachRole?: "head_coach" | "assistant_coach";
  // For creating new coach
  newCoachData?: {
    firstName: string;
    lastName: string;
    coachType: "head_coach" | "assistant_coach";
    headshotUrl?: string | null;
  };
  // For creating new staff
  newStaffData?: {
    firstName: string;
    lastName: string;
    position: string;
    showOnRoster: boolean;
    headshotUrl?: string | null;
  };
  idImageUrl?: string;
  status: VerificationStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  notes?: string;
}
