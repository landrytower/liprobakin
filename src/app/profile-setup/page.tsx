"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { doc, updateDoc, serverTimestamp, collection, getDocs, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import type { UserRole } from "@/types/user";
import { countries } from "@/data/countries";

const translations = {
  en: {
    completeYourProfile: "Complete Your Profile",
    letsGetYouSetup: "Let's get you set up",
    whatBringsYouHere: "What brings you here?",
    chooseYourRole: "Choose your role to continue",
    player: "Player",
    iAmAPlayer: "I am a basketball player",
    coachStaff: "Coach / Staff",
    iAmACoach: "I am a coach or team staff member",
    fan: "Fan",
    iAmAFan: "I am a basketball fan",
    verificationRequired: "Verification Required",
    accountWillBeReviewed: "Your account will be reviewed by an administrator before approval.",
    selectGender: "Select Gender",
    chooseToSeeTeams: "Choose to see available teams",
    men: "Men",
    women: "Women",
    selectYourTeam: "Select Your Team",
    mensLeague: "Men's League",
    womensLeague: "Women's League",
    chooseATeam: "Choose a team...",
    changeGender: "← Change gender",
    selectPlayerStaff: "Select Your Name from Roster",
    chooseYourName: "Choose your name...",
    cantFindName: "Don't see your name in the roster?",
    createOwnProfile: "Create your own player profile",
    createPlayerProfile: "Create Player Profile",
    backToRoster: "← Back to roster selection",
    firstName: "First Name",
    lastName: "Last Name",
    jerseyNumber: "Jersey #",
    position: "Position",
    selectPosition: "Select position",
    height: "Height",
    dateOfBirth: "Date of Birth",
    nationality: "Nationality",
    selectNationality: "Select nationality",
    secondNationality: "Second Nationality",
    optional: "Optional",
    none: "None",
    playerLicense: "Player License",
    headshotPhoto: "Headshot Photo",
    uploadHeadshotPhoto: "Upload a professional headshot photo",
    uploadIdVerification: "Upload ID for Verification",
    uploadIdHelper: "Upload ID or badge if available for faster verification",
    submitting: "Submitting...",
    submitForVerification: "Submit for Verification",
    uploadId: "Upload a clear photo of your official ID or badge",
    completeAllFields: "Please complete all fields",
    welcomeFan: "Welcome, Fan!",
    fanWelcomeMessage: "Choose your favorite teams from men's and women's leagues. You can update these anytime from your account settings.",
    searchFavoritePlayer: "Search for Your Favorite Player",
    typePlayerName: "Type player name to search...",
    playerSelected: "Player selected",
    favoriteTeamMen: "Favorite Men's Team",
    favoriteTeamWomen: "Favorite Women's Team",
    typeToSearch: "Type to search teams...",
    favoritePlayerMenTeam: "Favorite Player from Men's Team",
    favoritePlayerWomenTeam: "Favorite Player from Women's Team",
    typeToSearchPlayers: "Type to search players...",
    saving: "Saving...",
    completeSetup: "Complete Setup",
    required: "*",
    cm: "cm",
    // Coach/Staff specific translations
    coachStaffSetup: "Coach / Staff Setup",
    selectYourRole: "What is your role?",
    coach: "Coach",
    iAmACoachRole: "I am a head coach or assistant coach",
    staff: "Team Staff",
    iAmTeamStaff: "I am a team staff member",
    headCoach: "Head Coach",
    assistantCoach: "Assistant Coach",
    selectCoachType: "Select coach type",
    claimExistingCoach: "Claim Existing Coach Profile",
    selectCoachToClaim: "Select a coach to claim...",
    noCoachesToClaim: "No coaches available to claim",
    createNewCoach: "Create New Coach Profile",
    coachPositionsFull: "Head coach and both assistant positions are filled. Please register as staff.",
    staffRole: "Staff Role",
    selectStaffRole: "Select your role...",
    president: "President",
    vicePresident: "Vice President",
    secretary: "Secretary",
    treasurer: "Treasurer",
    teamManager: "Team Manager",
    mediaManager: "Media Manager",
    equipmentManager: "Equipment Manager",
    medicalStaff: "Medical Staff",
    statistician: "Statistician",
    simpleStaff: "Staff Member",
    showOnRoster: "Show on Team Roster?",
    showOnRosterYes: "Yes, show my profile on the team roster",
    showOnRosterNo: "No, keep my profile private",
    showOnRosterNote: "Your profile visibility will be approved by an administrator",
    backToTeamSelection: "← Back to team selection",
    backToCoachStaffChoice: "← Back to role selection",
    coachSelected: "Coach selected",
    createCoachProfile: "Create Coach Profile",
    createStaffProfile: "Create Staff Profile",
  },
  fr: {
    completeYourProfile: "Complétez Votre Profil",
    letsGetYouSetup: "Configurons votre compte",
    whatBringsYouHere: "Qu'est-ce qui vous amène ici ?",
    chooseYourRole: "Choisissez votre rôle pour continuer",
    player: "Joueur",
    iAmAPlayer: "Je suis un joueur de basketball",
    coachStaff: "Entraîneur / Staff",
    iAmACoach: "Je suis un entraîneur ou membre du staff",
    fan: "Fan",
    iAmAFan: "Je suis un fan de basketball",
    verificationRequired: "Vérification Requise",
    accountWillBeReviewed: "Votre compte sera examiné par un administrateur avant approbation.",
    selectGender: "Sélectionnez le Genre",
    chooseToSeeTeams: "Choisissez pour voir les équipes disponibles",
    men: "Hommes",
    women: "Femmes",
    selectYourTeam: "Sélectionnez Votre Équipe",
    mensLeague: "Ligue Masculine",
    womensLeague: "Ligue Féminine",
    chooseATeam: "Choisissez une équipe...",
    changeGender: "← Changer de genre",
    selectPlayerStaff: "Sélectionnez Votre Nom dans le Roster",
    chooseYourName: "Choisissez votre nom...",
    cantFindName: "Vous ne voyez pas votre nom dans le roster ?",
    createOwnProfile: "Créez votre propre profil de joueur",
    createPlayerProfile: "Créer un Profil de Joueur",
    backToRoster: "← Retour à la sélection du roster",
    firstName: "Prénom",
    lastName: "Nom de Famille",
    jerseyNumber: "Numéro de Maillot",
    position: "Position",
    selectPosition: "Sélectionnez une position",
    height: "Taille",
    dateOfBirth: "Date de Naissance",
    nationality: "Nationalité",
    selectNationality: "Sélectionnez la nationalité",
    secondNationality: "Deuxième Nationalité",
    optional: "Optionnel",
    none: "Aucun",
    playerLicense: "Licence de Joueur",
    headshotPhoto: "Photo de Profil",
    uploadHeadshotPhoto: "Téléchargez une photo de profil professionnelle",
    uploadIdVerification: "Télécharger l'ID pour Vérification",
    uploadIdHelper: "Téléchargez votre pièce d'identité ou badge si disponible pour une vérification plus rapide",
    submitting: "Envoi en cours...",
    submitForVerification: "Soumettre pour Vérification",
    uploadId: "Veuillez télécharger une photo claire de votre pièce d'identité ou badge officiel",
    completeAllFields: "Veuillez compléter tous les champs",
    welcomeFan: "Bienvenue, Fan !",
    fanWelcomeMessage: "Choisissez vos équipes favorites des ligues masculine et féminine. Vous pouvez les modifier à tout moment dans les paramètres de votre compte.",
    searchFavoritePlayer: "Recherchez Votre Joueur Favori",
    typePlayerName: "Tapez le nom du joueur pour rechercher...",
    playerSelected: "Joueur sélectionné",
    favoriteTeamMen: "Équipe Masculine Favorite",
    favoriteTeamWomen: "Équipe Féminine Favorite",
    typeToSearch: "Tapez pour rechercher des équipes...",
    favoritePlayerMenTeam: "Joueur Favori de l'Équipe Masculine",
    favoritePlayerWomenTeam: "Joueuse Favorite de l'Équipe Féminine",
    typeToSearchPlayers: "Tapez pour rechercher des joueurs...",
    saving: "Enregistrement...",
    completeSetup: "Terminer la Configuration",
    required: "*",
    cm: "cm",
    // Coach/Staff specific translations
    coachStaffSetup: "Configuration Entraîneur / Staff",
    selectYourRole: "Quel est votre rôle ?",
    coach: "Entraîneur",
    iAmACoachRole: "Je suis entraîneur principal ou assistant",
    staff: "Staff d'Équipe",
    iAmTeamStaff: "Je suis membre du staff de l'équipe",
    headCoach: "Entraîneur Principal",
    assistantCoach: "Assistant Entraîneur",
    selectCoachType: "Sélectionnez le type d'entraîneur",
    claimExistingCoach: "Réclamer un Profil d'Entraîneur Existant",
    selectCoachToClaim: "Sélectionnez un entraîneur à réclamer...",
    noCoachesToClaim: "Aucun entraîneur disponible à réclamer",
    createNewCoach: "Créer un Nouveau Profil d'Entraîneur",
    coachPositionsFull: "Le poste d'entraîneur principal et les deux postes d'assistant sont occupés. Veuillez vous inscrire en tant que staff.",
    staffRole: "Rôle Staff",
    selectStaffRole: "Sélectionnez votre rôle...",
    president: "Président",
    vicePresident: "Vice-Président",
    secretary: "Secrétaire",
    treasurer: "Trésorier",
    teamManager: "Manager d'Équipe",
    mediaManager: "Responsable Médias",
    equipmentManager: "Responsable Équipement",
    medicalStaff: "Personnel Médical",
    statistician: "Statisticien",
    simpleStaff: "Membre du Staff",
    showOnRoster: "Afficher sur le Roster de l'Équipe ?",
    showOnRosterYes: "Oui, afficher mon profil sur le roster",
    showOnRosterNo: "Non, garder mon profil privé",
    showOnRosterNote: "La visibilité de votre profil sera approuvée par un administrateur",
    backToTeamSelection: "← Retour à la sélection d'équipe",
    backToCoachStaffChoice: "← Retour à la sélection du rôle",
    coachSelected: "Entraîneur sélectionné",
    createCoachProfile: "Créer un Profil d'Entraîneur",
    createStaffProfile: "Créer un Profil Staff",
  },
};

export default function ProfileSetup() {
  const router = useRouter();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Role selection
  const [step, setStep] = useState<"role" | "player-staff-setup" | "coach-staff-setup" | "fan-setup" | "create-player">("role");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [createOwnPlayer, setCreateOwnPlayer] = useState(false);

  // Player/Staff fields - ADD GENDER SELECTION
  const [selectedGender, setSelectedGender] = useState<"men" | "women" | "">("");
  const [teams, setTeams] = useState<Array<{ id: string; name: string; gender: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamRoster, setTeamRoster] = useState<Array<{ id: string; name: string; number?: string }>>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [idImage, setIdImage] = useState<File | null>(null);

  // Coach/Staff specific state
  type CoachStaffRole = "head_coach" | "assistant_coach";
  type StaffPosition = "president" | "vice_president" | "secretary" | "treasurer" | "team_manager" | "media_manager" | "equipment_manager" | "medical_staff" | "statistician" | "staff_member";
  
  interface TeamCoach {
    id: string;
    firstName: string;
    lastName: string;
    role: CoachStaffRole;
    headshot?: string;
    claimed?: boolean;
  }
  
  interface TeamStaff {
    id: string;
    firstName: string;
    lastName: string;
    position: StaffPosition;
    headshot?: string;
    claimed?: boolean;
  }
  
  const [coachOrStaffChoice, setCoachOrStaffChoice] = useState<"coach" | "staff" | "">("");
  const [teamCoaches, setTeamCoaches] = useState<TeamCoach[]>([]);
  const [teamStaffMembers, setTeamStaffMembers] = useState<TeamStaff[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [createNewCoach, setCreateNewCoach] = useState(false);
  const [coachType, setCoachType] = useState<CoachStaffRole | "">("");
  const [staffPosition, setStaffPosition] = useState<StaffPosition | "">("");
  const [coachStaffFirstName, setCoachStaffFirstName] = useState("");
  const [coachStaffLastName, setCoachStaffLastName] = useState("");
  const [coachStaffPhoto, setCoachStaffPhoto] = useState<File | null>(null);

  // Custom player creation fields
  const [customFirstName, setCustomFirstName] = useState("");
  const [customLastName, setCustomLastName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [secondNationality, setSecondNationality] = useState("");
  const [playerLicense, setPlayerLicense] = useState("");
  const [headshotPhoto, setHeadshotPhoto] = useState<File | null>(null);

  // Fan fields
  const [favoriteTeamMenId, setFavoriteTeamMenId] = useState("");
  const [favoriteTeamWomenId, setFavoriteTeamWomenId] = useState("");
  const [menTeams, setMenTeams] = useState<Array<{ id: string; name: string; gender: string }>>([]);
  const [womenTeams, setWomenTeams] = useState<Array<{ id: string; name: string; gender: string }>>([]);
  const [menTeamPlayers, setMenTeamPlayers] = useState<Array<{ id: string; name: string; number?: string }>>([]);
  const [womenTeamPlayers, setWomenTeamPlayers] = useState<Array<{ id: string; name: string; number?: string }>>([]);
  const [favoritePlayerMenId, setFavoritePlayerMenId] = useState("");
  const [favoritePlayerWomenId, setFavoritePlayerWomenId] = useState("");
  
  // Type-ahead search states
  const [menTeamSearch, setMenTeamSearch] = useState("");
  const [womenTeamSearch, setWomenTeamSearch] = useState("");
  const [menPlayerSearch, setMenPlayerSearch] = useState("");
  const [womenPlayerSearch, setWomenPlayerSearch] = useState("");
  const [showMenTeamDropdown, setShowMenTeamDropdown] = useState(false);
  const [showWomenTeamDropdown, setShowWomenTeamDropdown] = useState(false);
  const [showMenPlayerDropdown, setShowMenPlayerDropdown] = useState(false);
  const [showWomenPlayerDropdown, setShowWomenPlayerDropdown] = useState(false);
  
  // Global player search for fans (across all teams)
  const [allPlayers, setAllPlayers] = useState<Array<{ id: string; name: string; number?: string; teamName?: string; headshot?: string; teamId?: string }>>([]);
  const [globalPlayerSearch, setGlobalPlayerSearch] = useState("");
  const [showGlobalPlayerDropdown, setShowGlobalPlayerDropdown] = useState(false);
  const [selectedGlobalPlayerId, setSelectedGlobalPlayerId] = useState("");

  useEffect(() => {
    // Redirect if user already has a role
    if (userProfile?.role) {
      router.push("/");
    }

    // Redirect if not logged in
    if (!loading && !user) {
      router.push("/");
    }

    // Pre-populate names from user profile when creating custom player
    if (userProfile && !customFirstName && !customLastName) {
      setCustomFirstName(userProfile.firstName || "");
      setCustomLastName(userProfile.lastName || "");
    }
  }, [user, userProfile, loading, router, customFirstName, customLastName]);

  useEffect(() => {
    // Fetch teams when needed - FILTER BY GENDER
    const fetchTeams = async () => {
      const teamsSnapshot = await getDocs(collection(firebaseDB, "teams"));
      const allTeams = teamsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || doc.id,
        gender: doc.data().gender || "men",
      }));

      if (step === "fan-setup") {
        // Separate men's and women's teams for fan selection
        setMenTeams(allTeams.filter(team => team.gender === "men"));
        setWomenTeams(allTeams.filter(team => team.gender === "women"));
      } else if (step === "player-staff-setup" && selectedGender) {
        // Filter by selected gender for player/staff
        setTeams(allTeams.filter((team) => team.gender === selectedGender));
      } else if (step === "coach-staff-setup" && selectedGender) {
        // Filter by selected gender for coach/staff
        setTeams(allTeams.filter((team) => team.gender === selectedGender));
      }
    };

    if ((step === "player-staff-setup" && selectedGender) || step === "fan-setup" || (step === "coach-staff-setup" && selectedGender)) {
      fetchTeams();
    }
  }, [step, selectedGender]);

  // Fetch coaches and staff when team is selected for coach/staff setup
  useEffect(() => {
    const fetchTeamCoachesAndStaff = async () => {
      if (!selectedTeamId || step !== "coach-staff-setup") return;

      // Fetch coaches from the team's coaches subcollection
      const coachesRef = collection(firebaseDB, "teams", selectedTeamId, "coaches");
      const coachesSnapshot = await getDocs(coachesRef);
      const coaches: TeamCoach[] = coachesSnapshot.docs.map((doc) => ({
        id: doc.id,
        firstName: doc.data().firstName || "",
        lastName: doc.data().lastName || "",
        role: doc.data().role || "assistant_coach",
        headshot: doc.data().headshot || "",
        claimed: doc.data().claimed || false,
      }));
      setTeamCoaches(coaches);

      // Fetch staff from the team's staff subcollection
      const staffRef = collection(firebaseDB, "teams", selectedTeamId, "staff");
      const staffSnapshot = await getDocs(staffRef);
      const staffMembers: TeamStaff[] = staffSnapshot.docs.map((doc) => ({
        id: doc.id,
        firstName: doc.data().firstName || "",
        lastName: doc.data().lastName || "",
        position: doc.data().position || "staff_member",
        headshot: doc.data().headshot || "",
        claimed: doc.data().claimed || false,
      }));
      setTeamStaffMembers(staffMembers);
    };

    if (selectedTeamId && step === "coach-staff-setup") {
      fetchTeamCoachesAndStaff();
    }
  }, [selectedTeamId, step]);

  useEffect(() => {
    // Fetch team roster when team is selected
    const fetchRoster = async () => {
      if (!selectedTeamId) return;

      // Fetch from the team's roster subcollection
      const rosterRef = collection(firebaseDB, "teams", selectedTeamId, "roster");
      const rosterSnapshot = await getDocs(rosterRef);
      const roster = rosterSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || `${doc.data().firstName} ${doc.data().lastName}`,
        number: doc.data().number,
      }));
      setTeamRoster(roster);
    };

    if (selectedTeamId && step === "player-staff-setup") {
      fetchRoster();
    }
  }, [selectedTeamId, step]);

  useEffect(() => {
    // Fetch players for men's team when selected by fan
    const fetchMenPlayers = async () => {
      if (!favoriteTeamMenId) {
        setMenTeamPlayers([]);
        return;
      }

      const rosterRef = collection(firebaseDB, "teams", favoriteTeamMenId, "roster");
      const rosterSnapshot = await getDocs(rosterRef);
      const players = rosterSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || `${doc.data().firstName} ${doc.data().lastName}`,
        number: doc.data().number,
      }));
      setMenTeamPlayers(players);
    };

    if (favoriteTeamMenId && step === "fan-setup") {
      fetchMenPlayers();
    }
  }, [favoriteTeamMenId, step]);

  useEffect(() => {
    // Fetch players for women's team when selected by fan
    const fetchWomenPlayers = async () => {
      if (!favoriteTeamWomenId) {
        setWomenTeamPlayers([]);
        return;
      }

      const rosterRef = collection(firebaseDB, "teams", favoriteTeamWomenId, "roster");
      const rosterSnapshot = await getDocs(rosterRef);
      const players = rosterSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || `${doc.data().firstName} ${doc.data().lastName}`,
        number: doc.data().number,
      }));
      setWomenTeamPlayers(players);
    };

    if (favoriteTeamWomenId && step === "fan-setup") {
      fetchWomenPlayers();
    }
  }, [favoriteTeamWomenId, step]);

  useEffect(() => {
    // Fetch all players from all teams for global player search
    const fetchAllPlayers = async () => {
      const teamsSnapshot = await getDocs(collection(firebaseDB, "teams"));
      const playersList: Array<{ id: string; name: string; number?: string; teamName?: string; headshot?: string; teamId?: string }> = [];

      for (const teamDoc of teamsSnapshot.docs) {
        const teamId = teamDoc.id;
        const teamName = teamDoc.data().name || teamId;
        const rosterRef = collection(firebaseDB, "teams", teamId, "roster");
        const rosterSnapshot = await getDocs(rosterRef);

        rosterSnapshot.docs.forEach((playerDoc) => {
          const playerData = playerDoc.data();
          playersList.push({
            id: playerDoc.id,
            name: playerData.name || `${playerData.firstName} ${playerData.lastName}`,
            number: playerData.number,
            teamName,
            teamId,
            headshot: playerData.headshot || playerData.photo || "",
          });
        });
      }

      setAllPlayers(playersList);
    };

    if (step === "fan-setup") {
      fetchAllPlayers();
    }
  }, [step]);

  const handleRoleSelection = (role: UserRole) => {
    setSelectedRole(role);
    if (role === "fan") {
      setStep("fan-setup");
    } else if (role === "coach" || role === "staff") {
      setStep("coach-staff-setup");
    } else {
      setStep("player-staff-setup");
    }
  };

  const handlePlayerStaffSubmit = async () => {
    if (!user || !selectedRole || !selectedTeamId || !selectedPersonId || !idImage) {
      setError("Please complete all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Upload ID image
      const storageRef = ref(firebaseStorage, `verification/${user.uid}/${idImage.name}`);
      await uploadBytes(storageRef, idImage);
      const idImageUrl = await getDownloadURL(storageRef);

      const selectedTeam = teams.find((t) => t.id === selectedTeamId);
      const selectedPerson = teamRoster.find((p) => p.id === selectedPersonId);

      // Update user profile
      // IMPORTANT: firstName and lastName are NOT updated here
      // They remain the values from user sign-up and cannot be modified by player selection
      await updateDoc(doc(firebaseDB, "users", user.uid), {
        role: selectedRole,
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        verificationStatus: "pending",
        verificationImageUrl: idImageUrl,
        verificationSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // User's firstName and lastName from sign-up are preserved and never overwritten
      });

      // Create verification request for CLAIMING EXISTING PLAYER
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: user.email || userProfile?.email || "",
        userFirstName: userProfile?.firstName || "",
        userLastName: userProfile?.lastName || "",
        userPhone: userProfile?.phoneNumber || "",
        role: selectedRole,
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        // Claim existing player fields
        requestType: "claim_existing",
        existingPlayerId: selectedPersonId,
        existingPlayerName: selectedPerson?.name || "",
        idImageUrl,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      await refreshUserProfile();
      router.push("/verification-pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomPlayerSubmit = async () => {
    if (!user || !selectedRole || !selectedTeamId || !customFirstName || !customLastName || 
        !jerseyNumber || !position || !heightCm || !dateOfBirth || !nationality) {
      setError("Please complete all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Upload ID image if provided
      let idImageUrl = "";
      if (idImage) {
        const storageRef = ref(firebaseStorage, `verification/${user.uid}/${idImage.name}`);
        await uploadBytes(storageRef, idImage);
        idImageUrl = await getDownloadURL(storageRef);
      }

      // Upload headshot photo if provided
      let headshotUrl = "";
      if (headshotPhoto) {
        const playerFullName = `${customFirstName}_${customLastName}`.replace(/\s+/g, '_');
        const fileExtension = headshotPhoto.name.split('.').pop();
        const headshotRef = ref(firebaseStorage, `player-headshots/${playerFullName}_${Date.now()}.${fileExtension}`);
        await uploadBytes(headshotRef, headshotPhoto);
        headshotUrl = await getDownloadURL(headshotRef);
      }

      const selectedTeam = teams.find((t) => t.id === selectedTeamId);

      // Update user profile
      await updateDoc(doc(firebaseDB, "users", user.uid), {
        role: selectedRole,
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        verificationStatus: "pending",
        verificationImageUrl: idImageUrl || null,
        verificationSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create verification request for CREATING NEW PLAYER
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: user.email || userProfile?.email || "",
        userFirstName: userProfile?.firstName || "",
        userLastName: userProfile?.lastName || "",
        userPhone: userProfile?.phoneNumber || "",
        role: selectedRole,
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        // Create new player fields
        requestType: "create_new",
        customPlayer: true,
        customPlayerData: {
          firstName: customFirstName,
          lastName: customLastName,
          jerseyNumber,
          position,
          height: heightCm,
          dateOfBirth,
          nationality,
          secondNationality: secondNationality || null,
          playerLicense: playerLicense || null,
          headshotUrl: headshotUrl || null,
        },
        // Also store as newPlayerData for admin page compatibility
        newPlayerData: {
          firstName: customFirstName,
          lastName: customLastName,
          number: jerseyNumber,
          position,
          height: heightCm,
          birthdate: dateOfBirth,
          nationality,
          secondNationality: secondNationality || null,
          playerLicense: playerLicense || null,
          headshotUrl: headshotUrl || null,
        },
        idImageUrl: idImageUrl || null,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      await refreshUserProfile();
      router.push("/verification-pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleFanSubmit = async () => {
    if (!user) {
      setError("User not authenticated");
      return;
    }

    // At least one team or player should be selected
    if (!favoriteTeamMenId && !favoriteTeamWomenId && !selectedGlobalPlayerId) {
      setError("Please select at least one favorite team or player");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const selectedMenTeam = menTeams.find((t) => t.id === favoriteTeamMenId);
      const selectedWomenTeam = womenTeams.find((t) => t.id === favoriteTeamWomenId);
      const selectedMenPlayer = menTeamPlayers.find((p) => p.id === favoritePlayerMenId);
      const selectedWomenPlayer = womenTeamPlayers.find((p) => p.id === favoritePlayerWomenId);
      const selectedGlobalPlayer = allPlayers.find((p) => p.id === selectedGlobalPlayerId);

      await updateDoc(doc(firebaseDB, "users", user.uid), {
        role: "fan",
        ...(favoriteTeamMenId && {
          favoriteTeamMenId,
          favoriteTeamMenName: selectedMenTeam?.name || "",
        }),
        ...(favoriteTeamWomenId && {
          favoriteTeamWomenId,
          favoriteTeamWomenName: selectedWomenTeam?.name || "",
        }),
        ...(selectedGlobalPlayerId && {
          favoritePlayerId: selectedGlobalPlayerId,
          favoritePlayerName: selectedGlobalPlayer?.name || "",
          favoritePlayerTeamId: selectedGlobalPlayer?.teamId || "",
          favoritePlayerTeamName: selectedGlobalPlayer?.teamName || "",
        }),
        ...(favoritePlayerMenId && {
          favoritePlayerMenId,
          favoritePlayerMenName: selectedMenPlayer?.name || "",
        }),
        ...(favoritePlayerWomenId && {
          favoritePlayerWomenId,
          favoritePlayerWomenName: selectedWomenPlayer?.name || "",
        }),
        updatedAt: serverTimestamp(),
      });

      await refreshUserProfile();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handle claiming an existing coach profile
  const handleClaimCoachSubmit = async () => {
    if (!user || !selectedTeamId || !selectedCoachId || !idImage) {
      setError("Please complete all fields including ID upload");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Upload ID image
      const storageRef = ref(firebaseStorage, `verification/${user.uid}/${idImage.name}`);
      await uploadBytes(storageRef, idImage);
      const idImageUrl = await getDownloadURL(storageRef);

      const selectedTeam = teams.find((t) => t.id === selectedTeamId);
      const selectedCoach = teamCoaches.find((c) => c.id === selectedCoachId);

      // Update user profile
      await updateDoc(doc(firebaseDB, "users", user.uid), {
        role: "coach",
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        verificationStatus: "pending",
        verificationImageUrl: idImageUrl,
        verificationSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create verification request for CLAIMING EXISTING COACH
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: user.email || userProfile?.email || "",
        userFirstName: userProfile?.firstName || "",
        userLastName: userProfile?.lastName || "",
        userPhone: userProfile?.phoneNumber || "",
        role: "coach",
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        teamGender: selectedGender,
        requestType: "claim_existing_coach",
        existingCoachId: selectedCoachId,
        existingCoachName: `${selectedCoach?.firstName} ${selectedCoach?.lastName}`,
        existingCoachRole: selectedCoach?.role,
        idImageUrl,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      await refreshUserProfile();
      router.push("/verification-pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handle creating a new coach profile
  const handleCreateCoachSubmit = async () => {
    if (!user || !selectedTeamId || !coachStaffFirstName || !coachStaffLastName || !coachType) {
      setError("Please complete all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Upload ID image if provided
      let idImageUrl = "";
      if (idImage) {
        const storageRef = ref(firebaseStorage, `verification/${user.uid}/${idImage.name}`);
        await uploadBytes(storageRef, idImage);
        idImageUrl = await getDownloadURL(storageRef);
      }

      // Upload headshot photo if provided
      let headshotUrl = "";
      if (coachStaffPhoto && userProfile) {
        const coachFullName = `${userProfile.firstName}_${userProfile.lastName}`.replace(/\s+/g, '_');
        const fileExtension = coachStaffPhoto.name.split('.').pop();
        const headshotRef = ref(firebaseStorage, `coach-headshots/${coachFullName}_${Date.now()}.${fileExtension}`);
        await uploadBytes(headshotRef, coachStaffPhoto);
        headshotUrl = await getDownloadURL(headshotRef);
      }

      const selectedTeam = teams.find((t) => t.id === selectedTeamId);

      // Update user profile
      await updateDoc(doc(firebaseDB, "users", user.uid), {
        role: "coach",
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        verificationStatus: "pending",
        verificationImageUrl: idImageUrl || null,
        verificationSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create verification request for CREATING NEW COACH
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: user.email || userProfile?.email || "",
        userFirstName: userProfile?.firstName || "",
        userLastName: userProfile?.lastName || "",
        userPhone: userProfile?.phoneNumber || "",
        role: "coach",
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        teamGender: selectedGender,
        requestType: "create_new_coach",
        newCoachData: {
          firstName: coachStaffFirstName,
          lastName: coachStaffLastName,
          coachType: coachType,
          headshotUrl: headshotUrl || null,
        },
        idImageUrl: idImageUrl || null,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      await refreshUserProfile();
      router.push("/verification-pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handle creating a staff profile
  const handleCreateStaffSubmit = async () => {
    if (!user || !selectedTeamId || !coachStaffFirstName || !coachStaffLastName || !staffPosition) {
      setError("Please complete all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Upload ID image if provided
      let idImageUrl = "";
      if (idImage) {
        const storageRef = ref(firebaseStorage, `verification/${user.uid}/${idImage.name}`);
        await uploadBytes(storageRef, idImage);
        idImageUrl = await getDownloadURL(storageRef);
      }

      // Upload headshot photo if provided
      let headshotUrl = "";
      if (coachStaffPhoto && userProfile) {
        const staffFullName = `${userProfile.firstName}_${userProfile.lastName}`.replace(/\s+/g, '_');
        const fileExtension = coachStaffPhoto.name.split('.').pop();
        const headshotRef = ref(firebaseStorage, `staff-headshots/${staffFullName}_${staffPosition}_${Date.now()}.${fileExtension}`);
        await uploadBytes(headshotRef, coachStaffPhoto);
        headshotUrl = await getDownloadURL(headshotRef);
      }

      const selectedTeam = teams.find((t) => t.id === selectedTeamId);

      // Update user profile
      await updateDoc(doc(firebaseDB, "users", user.uid), {
        role: "staff",
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        verificationStatus: "pending",
        verificationImageUrl: idImageUrl || null,
        verificationSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create verification request for CREATING NEW STAFF
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: user.email || userProfile?.email || "",
        userFirstName: userProfile?.firstName || "",
        userLastName: userProfile?.lastName || "",
        userPhone: userProfile?.phoneNumber || "",
        role: "staff",
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        teamGender: selectedGender,
        requestType: "create_new_staff",
        newStaffData: {
          firstName: coachStaffFirstName,
          lastName: coachStaffLastName,
          position: staffPosition,
          showOnRoster: true, // Admin decides visibility during verification
          headshotUrl: headshotUrl || null,
        },
        idImageUrl: idImageUrl || null,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      await refreshUserProfile();
      router.push("/verification-pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Check if team has room for more coaches
  const getAvailableCoachPositions = () => {
    const headCoaches = teamCoaches.filter(c => c.role === "head_coach");
    const assistantCoaches = teamCoaches.filter(c => c.role === "assistant_coach");
    
    const canAddHeadCoach = headCoaches.length === 0;
    const canAddAssistant = assistantCoaches.length < 2;
    
    return { canAddHeadCoach, canAddAssistant, coachPositionsFull: !canAddHeadCoach && !canAddAssistant };
  };

  // Staff positions list
  const staffPositions: { value: StaffPosition; label: string }[] = [
    { value: "president", label: t.president },
    { value: "vice_president", label: t.vicePresident },
    { value: "secretary", label: t.secretary },
    { value: "treasurer", label: t.treasurer },
    { value: "team_manager", label: t.teamManager },
    { value: "media_manager", label: t.mediaManager },
    { value: "equipment_manager", label: t.equipmentManager },
    { value: "medical_staff", label: t.medicalStaff },
    { value: "statistician", label: t.statistician },
    { value: "staff_member", label: t.simpleStaff },
  ];

  // Height conversion utility
  const cmToFeetInches = (cm: number): string => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  };

  // Basketball positions
  const positions = [
    "Point Guard (PG)",
    "Shooting Guard (SG)",
    "Small Forward (SF)",
    "Power Forward (PF)",
    "Center (C)",
  ];

  if (!user || userProfile?.role) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Gradient Orbs Background */}
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-2xl shadow-black/50 p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/20">
                  <svg className="h-7 w-7 sm:h-8 sm:w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">{t.completeYourProfile}</h1>
            <p className="text-sm text-slate-400">{t.letsGetYouSetup}</p>
          </div>

          {step === "role" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-base sm:text-lg font-semibold text-white mb-2">{t.whatBringsYouHere}</p>
                <p className="text-sm text-slate-400">{t.chooseYourRole}</p>
              </div>
              <div className="grid gap-4">
                <button
                  onClick={() => handleRoleSelection("player")}
                  className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-5 sm:p-6 text-left transition-all duration-300 hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/20 hover:scale-[1.02]"
                  type="button"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t.player}</h3>
                      <p className="text-sm text-slate-400">{t.iAmAPlayer}</p>
                    </div>
                    <svg className="h-5 w-5 text-slate-400 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelection("coach")}
                  className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-5 sm:p-6 text-left transition-all duration-300 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02]"
                  type="button"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900/30 to-blue-800/20 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t.coachStaff}</h3>
                      <p className="text-sm text-slate-400">{t.iAmACoach}</p>
                    </div>
                    <svg className="h-5 w-5 text-slate-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelection("fan")}
                  className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-5 sm:p-6 text-left transition-all duration-300 hover:border-orange-400/50 hover:shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02]"
                  type="button"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t.fan}</h3>
                      <p className="text-sm text-slate-400">{t.iAmAFan}</p>
                    </div>
                    <svg className="h-5 w-5 text-slate-400 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === "player-staff-setup" && (
            <div className="space-y-6">
              {/* Verification Notice */}
              <div className="rounded-xl border border-green-400/50 bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm p-4 flex items-start gap-3">
                <svg className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="font-semibold text-green-300 mb-1">{t.verificationRequired}</p>
                  <p className="text-green-200/80">{t.accountWillBeReviewed}</p>
                </div>
              </div>

              {/* STEP 1: Gender Selection */}
              {!selectedGender && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-1">{t.selectGender}</h3>
                    <p className="text-sm text-slate-400">{t.chooseToSeeTeams}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedGender("men")}
                      className="group rounded-xl border border-white/20 bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm p-5 sm:p-6 transition-all duration-300 hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/20 hover:scale-105"
                      type="button"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-green-500/20 backdrop-blur-sm border border-green-400/30 group-hover:scale-110 transition-transform">
                          <svg className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-base sm:text-lg font-bold text-white">{t.men}</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedGender("women")}
                      className="group rounded-xl border border-white/20 bg-gradient-to-br from-pink-500/10 to-pink-600/5 backdrop-blur-sm p-5 sm:p-6 transition-all duration-300 hover:border-pink-400/50 hover:shadow-lg hover:shadow-pink-500/20 hover:scale-105"
                      type="button"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-pink-500/20 backdrop-blur-sm border border-pink-400/30 group-hover:scale-110 transition-transform">
                          <svg className="h-6 w-6 sm:h-7 sm:w-7 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-base sm:text-lg font-bold text-white">{t.women}</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Team Selection */}
              {selectedGender && (
                <>
                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                      {t.selectYourTeam}
                      <span className="ml-2 text-xs normal-case text-slate-500">({selectedGender === "men" ? t.mensLeague : t.womensLeague})</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400 group-focus-within:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        aria-label={t.selectYourTeam}
                        className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-4 py-3 text-sm sm:text-base text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-slate-900">{t.chooseATeam}</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id} className="bg-slate-900">
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedGender("");
                        setSelectedTeamId("");
                        setSelectedPersonId("");
                      }}
                      className="mt-2 text-xs text-green-400 hover:text-green-300 transition-colors"
                      type="button"
                    >
                      {t.changeGender}
                    </button>
                  </div>

                  {/* STEP 3: Player/Staff Name Selection */}
                  {selectedTeamId && !createOwnPlayer && (
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                        {t.selectPlayerStaff}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                          <svg className="h-4 w-4 text-slate-400 group-focus-within:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <select
                          value={selectedPersonId}
                          onChange={(e) => setSelectedPersonId(e.target.value)}
                          aria-label={t.selectPlayerStaff}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-4 py-3 text-sm sm:text-base text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300 appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-900">{t.chooseYourName}</option>
                          {teamRoster.map((person) => (
                            <option key={person.id} value={person.id} className="bg-slate-900">
                              {person.name} {person.number ? `#${person.number}` : ""}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* "Can't find your name?" option */}
                      <div className="mt-3 text-center">
                        <p className="text-xs text-slate-400 mb-2">{t.cantFindName}</p>
                        <button
                          onClick={() => {
                            setCreateOwnPlayer(true);
                            setSelectedPersonId("");
                          }}
                          className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors"
                          type="button"
                        >
                          {t.createOwnProfile}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Player Creation Form */}
                  {selectedTeamId && createOwnPlayer && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Create Player Profile</h3>
                        <button
                          onClick={() => {
                            setCreateOwnPlayer(false);
                            setCustomFirstName(userProfile?.firstName || "");
                            setCustomLastName(userProfile?.lastName || "");
                            setJerseyNumber("");
                            setPosition("");
                            setHeightCm("");
                            setDateOfBirth("");
                            setNationality("");
                            setSecondNationality("");
                            setPlayerLicense("");
                            setHeadshotPhoto(null);
                          }}
                          className="text-xs text-green-400 hover:text-green-300 transition-colors"
                          type="button"
                        >
                          ← Back to roster selection
                        </button>
                      </div>

                      {/* Name Fields (pre-populated) */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            First Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={customFirstName}
                            onChange={(e) => setCustomFirstName(e.target.value)}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            Last Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={customLastName}
                            onChange={(e) => setCustomLastName(e.target.value)}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                            required
                          />
                        </div>
                      </div>

                      {/* Jersey Number */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Jersey # <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={jerseyNumber}
                          onChange={(e) => setJerseyNumber(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                          placeholder="e.g., 23"
                          required
                        />
                      </div>

                      {/* Position and Height */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            Position <span className="text-red-400">*</span>
                          </label>
                          <select
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all appearance-none cursor-pointer"
                            required
                          >
                            <option value="" className="bg-slate-900">Select position</option>
                            {positions.map((pos) => (
                              <option key={pos} value={pos} className="bg-slate-900">
                                {pos}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            Height <span className="text-red-400">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={heightCm}
                              onChange={(e) => setHeightCm(e.target.value)}
                              className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 pr-16 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                              placeholder="185"
                              required
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-xs text-slate-400 pointer-events-none">
                              cm {heightCm && `(${cmToFeetInches(parseInt(heightCm))})`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Date of Birth */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Date of Birth <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                          required
                        />
                      </div>

                      {/* Nationality */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Nationality <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={nationality}
                          onChange={(e) => setNationality(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all appearance-none cursor-pointer"
                          required
                        >
                          <option value="" className="bg-slate-900">Select nationality</option>
                          {countries.map((country) => (
                            <option key={country.code} value={country.code} className="bg-slate-900">
                              {country.code} - {country.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Second Nationality (Optional) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Second Nationality <span className="text-xs text-slate-500">(Optional)</span>
                        </label>
                        <select
                          value={secondNationality}
                          onChange={(e) => setSecondNationality(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-900">None</option>
                          {countries.map((country) => (
                            <option key={country.code} value={country.code} className="bg-slate-900">
                              {country.code} - {country.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Player License (Optional) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Player License <span className="text-xs text-slate-500">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={playerLicense}
                          onChange={(e) => setPlayerLicense(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                          placeholder="Optional"
                        />
                      </div>

                      {/* Headshot Photo Upload */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Headshot Photo <span className="text-xs text-slate-500">(Optional)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setHeadshotPhoto(e.target.files?.[0] || null)}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-500 file:to-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:shadow-lg transition-all cursor-pointer focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Upload a professional headshot photo</p>
                      </div>

                      {/* ID Upload for Verification (Optional) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Upload ID for Verification <span className="text-xs text-slate-500">(Optional)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setIdImage(e.target.files?.[0] || null)}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-500 file:to-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:shadow-lg transition-all cursor-pointer focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                          />
                        </div>
                        <div className="mt-2 flex items-start gap-2 text-xs text-slate-400">
                          <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p>Upload ID or badge if available for faster verification</p>
                        </div>
                      </div>

                      {/* Submit Button for Custom Player Creation */}
                      <button
                        onClick={handleCustomPlayerSubmit}
                        disabled={loading || !customFirstName || !customLastName || !jerseyNumber || !position || !heightCm || !dateOfBirth || !nationality}
                        className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-900 to-green-500 px-4 py-4 font-bold text-white shadow-lg shadow-green-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/60 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        type="button"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {loading ? (
                            <>
                              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit for Verification</span>
                              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </>
                          )}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-900 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    </div>
                  )}

                  {/* STEP 4: ID Upload */}
                  {selectedPersonId && !createOwnPlayer && (
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                        Upload ID for Verification
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setIdImage(e.target.files?.[0] || null)}
                          aria-label="Upload ID for Verification"
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-500 file:to-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:shadow-lg transition-all cursor-pointer focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                        />
                      </div>
                      <div className="mt-2 flex items-start gap-2 text-xs text-slate-400">
                        <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>Please upload a clear photo of your official ID or badge</p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl border border-red-400/50 bg-red-500/10 backdrop-blur-sm p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                      <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  {/* Submit Button for Existing Roster Player */}
                  {selectedPersonId && idImage && !createOwnPlayer && (
                    <button
                      onClick={handlePlayerStaffSubmit}
                      disabled={loading}
                      className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-900 to-green-500 px-4 py-4 font-bold text-white shadow-lg shadow-green-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/60 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      type="button"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <span>Submit for Verification</span>
                            <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-900 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {step === "coach-staff-setup" && (
            <div className="space-y-6">
              {/* Verification Notice */}
              <div className="rounded-xl border border-blue-400/50 bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm p-4 flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="font-semibold text-blue-300 mb-1">{t.verificationRequired}</p>
                  <p className="text-blue-200/80">{t.accountWillBeReviewed}</p>
                </div>
              </div>

              {/* STEP 1: Gender Selection */}
              {!selectedGender && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-1">{t.selectGender}</h3>
                    <p className="text-sm text-slate-400">{t.chooseToSeeTeams}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedGender("men")}
                      className="group rounded-xl border border-white/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm p-5 sm:p-6 transition-all duration-300 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-105"
                      type="button"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 group-hover:scale-110 transition-transform">
                          <svg className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-base sm:text-lg font-bold text-white">{t.men}</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedGender("women")}
                      className="group rounded-xl border border-white/20 bg-gradient-to-br from-pink-500/10 to-pink-600/5 backdrop-blur-sm p-5 sm:p-6 transition-all duration-300 hover:border-pink-400/50 hover:shadow-lg hover:shadow-pink-500/20 hover:scale-105"
                      type="button"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-pink-500/20 backdrop-blur-sm border border-pink-400/30 group-hover:scale-110 transition-transform">
                          <svg className="h-6 w-6 sm:h-7 sm:w-7 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-base sm:text-lg font-bold text-white">{t.women}</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Team Selection for Coach/Staff */}
              {selectedGender && !selectedTeamId && (
                <div className="space-y-4">
                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                      {t.selectYourTeam}
                      <span className="ml-2 text-xs normal-case text-slate-500">({selectedGender === "men" ? t.mensLeague : t.womensLeague})</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <select
                        value={selectedTeamId}
                        onChange={(e) => {
                          setSelectedTeamId(e.target.value);
                          setCoachOrStaffChoice("");
                          setSelectedCoachId("");
                          setCreateNewCoach(false);
                        }}
                        aria-label={t.selectYourTeam}
                        className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-4 py-3 text-sm sm:text-base text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-slate-900">{t.chooseATeam}</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id} className="bg-slate-900">
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedGender("");
                        setSelectedTeamId("");
                        setCoachOrStaffChoice("");
                      }}
                      className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      type="button"
                    >
                      {t.changeGender}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Coach or Staff Choice */}
              {selectedTeamId && !coachOrStaffChoice && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-1">{t.selectYourRole}</h3>
                  </div>
                  
                  {/* Show coach positions status */}
                  {(() => {
                    const { coachPositionsFull } = getAvailableCoachPositions();
                    return coachPositionsFull ? (
                      <div className="rounded-xl border border-yellow-400/50 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-sm p-4 flex items-start gap-3 mb-4">
                        <svg className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-sm">
                          <p className="text-yellow-200/80">{t.coachPositionsFull}</p>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <div className="grid gap-4">
                    {/* Coach Option - disabled if positions are full */}
                    {(() => {
                      const { coachPositionsFull } = getAvailableCoachPositions();
                      return (
                        <button
                          onClick={() => !coachPositionsFull && setCoachOrStaffChoice("coach")}
                          disabled={coachPositionsFull}
                          className={`group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-5 sm:p-6 text-left transition-all duration-300 ${
                            coachPositionsFull 
                              ? "opacity-50 cursor-not-allowed" 
                              : "hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02]"
                          }`}
                          type="button"
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t.coach}</h3>
                              <p className="text-sm text-slate-400">{t.iAmACoachRole}</p>
                            </div>
                            <svg className="h-5 w-5 text-slate-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      );
                    })()}

                    {/* Staff Option */}
                    <button
                      onClick={() => setCoachOrStaffChoice("staff")}
                      className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-5 sm:p-6 text-left transition-all duration-300 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02]"
                      type="button"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                          <svg className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t.staff}</h3>
                          <p className="text-sm text-slate-400">{t.iAmTeamStaff}</p>
                        </div>
                        <svg className="h-5 w-5 text-slate-400 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedTeamId("");
                      setCoachOrStaffChoice("");
                    }}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    type="button"
                  >
                    {t.backToTeamSelection}
                  </button>
                </div>
              )}

              {/* STEP 4A: Coach Setup */}
              {selectedTeamId && coachOrStaffChoice === "coach" && (
                <div className="space-y-4">
                  {/* Option to claim existing coach */}
                  {teamCoaches.filter(c => !c.claimed).length > 0 && !createNewCoach && (
                    <div className="space-y-4">
                      <div className="group">
                        <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                          {t.claimExistingCoach}
                        </label>
                        <div className="relative">
                          <select
                            value={selectedCoachId}
                            onChange={(e) => setSelectedCoachId(e.target.value)}
                            aria-label={t.claimExistingCoach}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-sm sm:text-base text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300 appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-slate-900">{t.selectCoachToClaim}</option>
                            {teamCoaches.filter(c => !c.claimed).map((coach) => (
                              <option key={coach.id} value={coach.id} className="bg-slate-900">
                                {coach.firstName} {coach.lastName} - {coach.role === "head_coach" ? t.headCoach : t.assistantCoach}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        {selectedCoachId && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{t.coachSelected}</span>
                          </div>
                        )}
                      </div>

                      {/* ID Upload for claiming coach */}
                      {selectedCoachId && (
                        <div className="group">
                          <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                            {t.uploadIdVerification} <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setIdImage(e.target.files?.[0] || null)}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-500 file:to-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:shadow-lg transition-all cursor-pointer focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                          />
                          <p className="mt-1 text-xs text-slate-400">{t.uploadIdHelper}</p>
                        </div>
                      )}

                      {/* Submit for claiming coach */}
                      {selectedCoachId && idImage && (
                        <button
                          onClick={handleClaimCoachSubmit}
                          disabled={loading}
                          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-4 font-bold text-white shadow-lg shadow-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/60 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          type="button"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {loading ? (
                              <>
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>{t.submitting}</span>
                              </>
                            ) : (
                              <>
                                <span>{t.submitForVerification}</span>
                                <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                              </>
                            )}
                          </span>
                        </button>
                      )}

                      <div className="text-center mt-4">
                        <p className="text-xs text-slate-400 mb-2">{t.cantFindName}</p>
                        <button
                          onClick={() => {
                            setCreateNewCoach(true);
                            setSelectedCoachId("");
                            setCoachStaffFirstName(userProfile?.firstName || "");
                            setCoachStaffLastName(userProfile?.lastName || "");
                          }}
                          className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors"
                          type="button"
                        >
                          {t.createNewCoach}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Create New Coach Form */}
                  {(createNewCoach || teamCoaches.filter(c => !c.claimed).length === 0) && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">{t.createCoachProfile}</h3>
                        {teamCoaches.filter(c => !c.claimed).length > 0 && (
                          <button
                            onClick={() => {
                              setCreateNewCoach(false);
                              setCoachStaffFirstName("");
                              setCoachStaffLastName("");
                              setCoachType("");
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            type="button"
                          >
                            {t.backToRoster}
                          </button>
                        )}
                      </div>

                      {/* Name Fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            {t.firstName} <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={coachStaffFirstName}
                            onChange={(e) => setCoachStaffFirstName(e.target.value)}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            {t.lastName} <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={coachStaffLastName}
                            onChange={(e) => setCoachStaffLastName(e.target.value)}
                            className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                            required
                          />
                        </div>
                      </div>

                      {/* Coach Type Selection */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          {t.selectCoachType} <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={coachType}
                          onChange={(e) => setCoachType(e.target.value as CoachStaffRole)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all appearance-none cursor-pointer"
                          required
                        >
                          <option value="" className="bg-slate-900">{t.selectCoachType}</option>
                          {(() => {
                            const { canAddHeadCoach, canAddAssistant } = getAvailableCoachPositions();
                            return (
                              <>
                                {canAddHeadCoach && (
                                  <option value="head_coach" className="bg-slate-900">{t.headCoach}</option>
                                )}
                                {canAddAssistant && (
                                  <option value="assistant_coach" className="bg-slate-900">{t.assistantCoach}</option>
                                )}
                              </>
                            );
                          })()}
                        </select>
                      </div>

                      {/* Headshot Photo Upload */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          {t.headshotPhoto} <span className="text-xs text-slate-500">({t.optional})</span>
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setCoachStaffPhoto(e.target.files?.[0] || null)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-500 file:to-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:shadow-lg transition-all cursor-pointer focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                        />
                        <p className="mt-1 text-xs text-slate-400">{t.uploadHeadshotPhoto}</p>
                      </div>

                      {/* ID Upload */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          {t.uploadIdVerification} <span className="text-xs text-slate-500">({t.optional})</span>
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setIdImage(e.target.files?.[0] || null)}
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-500 file:to-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:shadow-lg transition-all cursor-pointer focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                        />
                        <p className="mt-1 text-xs text-slate-400">{t.uploadIdHelper}</p>
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handleCreateCoachSubmit}
                        disabled={loading || !coachStaffFirstName || !coachStaffLastName || !coachType}
                        className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-4 font-bold text-white shadow-lg shadow-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/60 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        type="button"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {loading ? (
                            <>
                              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>{t.submitting}</span>
                            </>
                          ) : (
                            <>
                              <span>{t.submitForVerification}</span>
                              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </>
                          )}
                        </span>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setCoachOrStaffChoice("");
                      setSelectedCoachId("");
                      setCreateNewCoach(false);
                    }}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    type="button"
                  >
                    {t.backToCoachStaffChoice}
                  </button>
                </div>
              )}

              {/* STEP 4B: Staff Setup */}
              {selectedTeamId && coachOrStaffChoice === "staff" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">{t.createStaffProfile}</h3>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        {t.firstName} <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={coachStaffFirstName}
                        onChange={(e) => setCoachStaffFirstName(e.target.value)}
                        placeholder={userProfile?.firstName || ""}
                        className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        {t.lastName} <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={coachStaffLastName}
                        onChange={(e) => setCoachStaffLastName(e.target.value)}
                        placeholder={userProfile?.lastName || ""}
                        className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Staff Position Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      {t.staffRole} <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={staffPosition}
                      onChange={(e) => setStaffPosition(e.target.value as StaffPosition)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all appearance-none cursor-pointer"
                      required
                    >
                      <option value="" className="bg-slate-900">{t.selectStaffRole}</option>
                      {staffPositions.map((pos) => (
                        <option key={pos.value} value={pos.value} className="bg-slate-900">
                          {pos.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Headshot Photo Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      {t.headshotPhoto} <span className="text-xs text-slate-500">({t.optional})</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCoachStaffPhoto(e.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-500 file:to-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:shadow-lg transition-all cursor-pointer focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                    />
                    <p className="mt-1 text-xs text-slate-400">{t.uploadHeadshotPhoto}</p>
                  </div>

                  {/* ID Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      {t.uploadIdVerification} <span className="text-xs text-slate-500">({t.optional})</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdImage(e.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-500 file:to-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:shadow-lg transition-all cursor-pointer focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                    />
                    <p className="mt-1 text-xs text-slate-400">{t.uploadIdHelper}</p>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-400/50 bg-red-500/10 backdrop-blur-sm p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                      <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleCreateStaffSubmit}
                    disabled={loading || !coachStaffFirstName || !coachStaffLastName || !staffPosition}
                    className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 px-4 py-4 font-bold text-white shadow-lg shadow-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/60 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    type="button"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>{t.submitting}</span>
                        </>
                      ) : (
                        <>
                          <span>{t.submitForVerification}</span>
                          <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setCoachOrStaffChoice("");
                      setStaffPosition("");
                      setCoachStaffFirstName("");
                      setCoachStaffLastName("");
                    }}
                    className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    type="button"
                  >
                    {t.backToCoachStaffChoice}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "fan-setup" && (
            <div className="space-y-6">
              {/* Fan Welcome Notice */}
              <div className="rounded-xl border border-orange-400/50 bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-sm p-4 flex items-start gap-3">
                <svg className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <div className="text-sm">
                  <p className="font-semibold text-orange-300 mb-1">Welcome, Fan!</p>
                  <p className="text-orange-200/80">Choose your favorite teams from men&apos;s and women&apos;s leagues. You can update these anytime from your account settings.</p>
                </div>
              </div>

              {/* Global Player Search with Headshots */}
              <div className="group relative">
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Search for Your Favorite Player
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                    <svg className="h-4 w-4 text-slate-400 group-focus-within:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={globalPlayerSearch}
                    onChange={(e) => setGlobalPlayerSearch(e.target.value)}
                    onFocus={() => setShowGlobalPlayerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowGlobalPlayerDropdown(false), 200)}
                    placeholder="Type player name to search..."
                    aria-label="Search for favorite player"
                    className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-10 py-3 text-white placeholder-slate-500 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
                  />
                  {globalPlayerSearch && (
                    <button
                      onClick={() => {
                        setGlobalPlayerSearch("");
                        setSelectedGlobalPlayerId("");
                      }}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 z-10"
                      type="button"
                    >
                      <svg className="h-4 w-4 text-slate-400 hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {showGlobalPlayerDropdown && allPlayers.filter(player => 
                    player.name.toLowerCase().includes(globalPlayerSearch.toLowerCase())
                  ).length > 0 && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/20 bg-slate-900 backdrop-blur-xl shadow-2xl max-h-80 overflow-y-auto">
                      {allPlayers
                        .filter(player => player.name.toLowerCase().includes(globalPlayerSearch.toLowerCase()))
                        .slice(0, 10)
                        .map((player) => (
                          <button
                            key={`${player.teamId}-${player.id}`}
                            onClick={() => {
                              setSelectedGlobalPlayerId(player.id);
                              setGlobalPlayerSearch(`${player.name}${player.number ? ` #${player.number}` : ""} - ${player.teamName}`);
                              setShowGlobalPlayerDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 text-white hover:bg-orange-500/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-white/10 last:border-b-0 flex items-center gap-3"
                            type="button"
                          >
                            {/* Player Headshot */}
                            <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden bg-slate-800 border-2 border-white/20">
                              {player.headshot ? (
                                <img 
                                  src={player.headshot} 
                                  alt={player.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = "/players/default.svg";
                                  }}
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <svg className="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* Player Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white truncate">
                                {player.name} {player.number ? `#${player.number}` : ""}
                              </div>
                              <div className="text-xs text-slate-400 truncate">
                                {player.teamName}
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                {selectedGlobalPlayerId && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Player selected</span>
                  </div>
                )}
              </div>

              {/* Favorite Men's Team Selection - Type Ahead */}
              <div className="group relative">
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Favorite Men&apos;s Team (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                    <svg className="h-4 w-4 text-slate-400 group-focus-within:text-orange-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={menTeamSearch}
                    onChange={(e) => setMenTeamSearch(e.target.value)}
                    onFocus={() => setShowMenTeamDropdown(true)}
                    onBlur={() => setTimeout(() => setShowMenTeamDropdown(false), 200)}
                    placeholder="Type to search teams..."
                    aria-label="Search Men's Team"
                    className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-10 py-3 text-white placeholder-slate-500 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
                  />
                  {menTeamSearch && (
                    <button
                      onClick={() => {
                        setMenTeamSearch("");
                        setFavoriteTeamMenId("");
                        setFavoritePlayerMenId("");
                      }}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 z-10"
                      type="button"
                    >
                      <svg className="h-4 w-4 text-slate-400 hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {showMenTeamDropdown && menTeams.filter(team => 
                    team.name.toLowerCase().includes(menTeamSearch.toLowerCase())
                  ).length > 0 && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/20 bg-slate-900 backdrop-blur-xl shadow-2xl max-h-60 overflow-y-auto">
                      {menTeams
                        .filter(team => team.name.toLowerCase().includes(menTeamSearch.toLowerCase()))
                        .map((team) => (
                          <button
                            key={team.id}
                            onClick={() => {
                              setFavoriteTeamMenId(team.id);
                              setMenTeamSearch(team.name);
                              setFavoritePlayerMenId("");
                              setShowMenTeamDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 text-white hover:bg-orange-500/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-white/10 last:border-b-0"
                            type="button"
                          >
                            {team.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Favorite Men's Player Selection - Type Ahead - Shows after team is selected */}
              {favoriteTeamMenId && menTeamPlayers.length > 0 && (
                <div className="group relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Favorite Player from Men&apos;s Team (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                      <svg className="h-4 w-4 text-slate-400 group-focus-within:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={menPlayerSearch}
                      onChange={(e) => setMenPlayerSearch(e.target.value)}
                      onFocus={() => setShowMenPlayerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowMenPlayerDropdown(false), 200)}
                      placeholder="Type to search players..."
                      aria-label="Search Men's Player"
                      className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-10 py-3 text-white placeholder-slate-500 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
                    />
                    {menPlayerSearch && (
                      <button
                        onClick={() => {
                          setMenPlayerSearch("");
                          setFavoritePlayerMenId("");
                        }}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 z-10"
                        type="button"
                      >
                        <svg className="h-4 w-4 text-slate-400 hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {showMenTeamDropdown && menTeams.filter(team => 
                      team.name.toLowerCase().includes(menTeamSearch.toLowerCase())
                    ).length > 0 && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/20 bg-slate-900 backdrop-blur-xl shadow-2xl max-h-60 overflow-y-auto">
                        {menTeams
                          .filter(team => team.name.toLowerCase().includes(menTeamSearch.toLowerCase()))
                          .map((team) => (
                            <button
                              key={team.id}
                              onClick={() => {
                                setFavoriteTeamMenId(team.id);
                                setMenTeamSearch(team.name);
                                setFavoritePlayerMenId("");
                                setShowMenTeamDropdown(false);
                              }}
                              className="w-full text-left px-4 py-3 text-white hover:bg-orange-500/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-white/10 last:border-b-0"
                              type="button"
                            >
                              {team.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Favorite Women's Team Selection - Type Ahead */}
              <div className="group relative">
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Favorite Women&apos;s Team (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                    <svg className="h-4 w-4 text-slate-400 group-focus-within:text-orange-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={womenTeamSearch}
                    onChange={(e) => setWomenTeamSearch(e.target.value)}
                    onFocus={() => setShowWomenTeamDropdown(true)}
                    onBlur={() => setTimeout(() => setShowWomenTeamDropdown(false), 200)}
                    placeholder="Type to search teams..."
                    aria-label="Search Women's Team"
                    className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-10 py-3 text-white placeholder-slate-500 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
                  />
                  {womenTeamSearch && (
                    <button
                      onClick={() => {
                        setWomenTeamSearch("");
                        setFavoriteTeamWomenId("");
                        setFavoritePlayerWomenId("");
                      }}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 z-10"
                      type="button"
                    >
                      <svg className="h-4 w-4 text-slate-400 hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {showWomenTeamDropdown && womenTeams.filter(team => 
                    team.name.toLowerCase().includes(womenTeamSearch.toLowerCase())
                  ).length > 0 && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/20 bg-slate-900 backdrop-blur-xl shadow-2xl max-h-60 overflow-y-auto">
                      {womenTeams
                        .filter(team => team.name.toLowerCase().includes(womenTeamSearch.toLowerCase()))
                        .map((team) => (
                          <button
                            key={team.id}
                            onClick={() => {
                              setFavoriteTeamWomenId(team.id);
                              setWomenTeamSearch(team.name);
                              setFavoritePlayerWomenId("");
                              setShowWomenTeamDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 text-white hover:bg-orange-500/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-white/10 last:border-b-0"
                            type="button"
                          >
                            {team.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Favorite Women's Player Selection - Type Ahead - Shows after team is selected */}
              {favoriteTeamWomenId && womenTeamPlayers.length > 0 && (
                <div className="group relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Favorite Player from Women&apos;s Team (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                      <svg className="h-4 w-4 text-slate-400 group-focus-within:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={womenPlayerSearch}
                      onChange={(e) => setWomenPlayerSearch(e.target.value)}
                      onFocus={() => setShowWomenPlayerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowWomenPlayerDropdown(false), 200)}
                      placeholder="Type to search players..."
                      aria-label="Search Women's Player"
                      className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-10 py-3 text-white placeholder-slate-500 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
                    />
                    {womenPlayerSearch && (
                      <button
                        onClick={() => {
                          setWomenPlayerSearch("");
                          setFavoritePlayerWomenId("");
                        }}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 z-10"
                        type="button"
                      >
                        <svg className="h-4 w-4 text-slate-400 hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {showWomenPlayerDropdown && womenTeamPlayers.filter(player => 
                      player.name.toLowerCase().includes(womenPlayerSearch.toLowerCase())
                    ).length > 0 && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/20 bg-slate-900 backdrop-blur-xl shadow-2xl max-h-60 overflow-y-auto">
                        {womenTeamPlayers
                          .filter(player => player.name.toLowerCase().includes(womenPlayerSearch.toLowerCase()))
                          .map((player) => (
                            <button
                              key={player.id}
                              onClick={() => {
                                setFavoritePlayerWomenId(player.id);
                                setWomenPlayerSearch(`${player.name}${player.number ? ` #${player.number}` : ""}`);
                                setShowWomenPlayerDropdown(false);
                              }}
                              className="w-full text-left px-4 py-3 text-white hover:bg-orange-500/20 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-white/10 last:border-b-0"
                              type="button"
                            >
                              {player.name} {player.number ? `#${player.number}` : ""}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-400/50 bg-red-500/10 backdrop-blur-sm p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                  <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <button
                onClick={handleFanSubmit}
                disabled={loading || (!favoriteTeamMenId && !favoriteTeamWomenId && !selectedGlobalPlayerId)}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-pink-600 px-4 py-4 font-bold text-white shadow-lg shadow-orange-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/60 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                type="button"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup</span>
                      <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-orange-500 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
