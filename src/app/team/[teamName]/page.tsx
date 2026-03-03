"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, getDocs, onSnapshot, doc, getDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";
import { formatTeamDisplayName } from "@/lib/team-name";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RosterPlayer } from "@/data/febaco";
import { flagFromCode } from "@/data/countries";
import GoogleAd from "@/components/GoogleAd";

const translations = {
  en: {
    loading: "Loading...",
    loadingTeamData: "Loading team data...",
    teamNotFound: "Team not found",
    teamNotFoundDesc: "could not be found.",
    backToHome: "Back to Home",
    back: "Back",
    next: "Next",
    record: "Record",
    conference: "Conference",
    roster: "Roster",
    coachingStaff: "Coaching Staff",
    noRoster: "No roster data available for this team.",
    noStaff: "No coaching staff data available for this team.",
    number: "#",
    position: "Position",
    height: "Height",
    weight: "Weight",
    nationality: "Nationality",
    dob: "DOB",
    ppg: "PPG",
    rpg: "RPG",
    apg: "APG",
    headCoach: "Head Coach",
    assistantCoach: "Assistant Coach",
    staff: "Staff",
    grid: "Grid",
    list: "List",
  },
  fr: {
    loading: "Chargement...",
    loadingTeamData: "Chargement des données de l'équipe...",
    teamNotFound: "Équipe introuvable",
    teamNotFoundDesc: "n'a pas pu être trouvée.",
    backToHome: "Retour à l'accueil",
    back: "Retour",
    next: "Suivant",
    record: "Bilan",
    conference: "Conférence",
    roster: "Effectif",
    coachingStaff: "Staff Technique",
    noRoster: "Aucune donnée d'effectif disponible pour cette équipe.",
    noStaff: "Aucune donnée du staff technique disponible pour cette équipe.",
    number: "#",
    position: "Position",
    height: "Taille",
    weight: "Poids",
    nationality: "Nationalité",
    dob: "Date de Naissance",
    ppg: "PPM",
    rpg: "RPM",
    apg: "PPM",
    headCoach: "Entraîneur Principal",
    assistantCoach: "Entraîneur Adjoint",
    staff: "Staff",
    grid: "Grille",
    list: "Liste",
  },
};

const AI_SETTINGS_DOC = "global";

type TeamData = {
  id: string;
  name: string;
  city?: string;
  logo?: string;
  teamPhoto?: string;
  teamPhotoPosition?: number;
  colors?: string[];
  wins: number;
  losses: number;
  conference?: string;
  nationality?: string;
  nationality2?: string;
};

type EnhancedRosterPlayer = RosterPlayer & {
  id: string;
  stats?: {
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
  };
};

type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: "head_coach" | "assistant_coach" | "staff";
  position?: string;
  headshot?: string;
  showOnRoster?: boolean;
};

type TeamPageTransitionPayload = {
  teamId?: string;
  teamName?: string;
  logo?: string;
  colors?: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function TeamPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamName = decodeURIComponent(params.teamName as string);
  const genderParam = searchParams.get("gender");
  const requestedGender = genderParam ? normalizeTeamGender(genderParam, undefined, "men") : null;
  const { language } = useLanguage();
  const t = translations[language];
  
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [roster, setRoster] = useState<EnhancedRosterPlayer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [coaches, setCoaches] = useState<StaffMember[]>([]);
  const [teamStaff, setTeamStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [allTeams, setAllTeams] = useState<{ id: string; name: string; fullName: string }[]>([]);
  const [nextTeam, setNextTeam] = useState<{ id: string; name: string; fullName: string } | null>(null);
  const [previousTeam, setPreviousTeam] = useState<{ id: string; name: string; fullName: string } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showEntryAnimation, setShowEntryAnimation] = useState(false);
  const [entryAnimationExpanded, setEntryAnimationExpanded] = useState(false);
  const [entryAnimationLogo, setEntryAnimationLogo] = useState<string>("");
  const [entryAnimationColors, setEntryAnimationColors] = useState<string[]>(["#2563eb", "#1d4ed8"]);
  const entryLoaderStartRef = useRef<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [isAiEnabled, setIsAiEnabled] = useState(true);

  useEffect(() => {
    if (genderParam) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("gender", "men");
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [genderParam, pathname, router, searchParams]);

  useEffect(() => {
    const settingsRef = doc(firebaseDB, "siteSettings", AI_SETTINGS_DOC);
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.data();
        setIsAiEnabled(data?.aiEnabled !== false);
      },
      (error) => {
        console.error("Failed to read AI visibility settings:", error);
        setIsAiEnabled(true);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAiEnabled) {
      setChatOpen(false);
    }
  }, [isAiEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem("teamPageTransition");
    if (!raw) return;

    const normalize = (value: string) => value.trim().toLowerCase();

    try {
      const payload = JSON.parse(raw) as TeamPageTransitionPayload;
      const payloadTeam = payload.teamId
        ? normalize(payload.teamId)
        : payload.teamName
          ? normalize(payload.teamName)
          : "";
      const currentTeam = normalize(teamName);

      if (payloadTeam && payloadTeam === currentTeam) {
        setEntryAnimationLogo(payload.logo || "");
        setEntryAnimationColors(payload.colors && payload.colors.length > 0 ? payload.colors : ["#2563eb", "#1d4ed8"]);
        setShowEntryAnimation(true);
        entryLoaderStartRef.current = Date.now();

        const expandTimer = window.setTimeout(() => {
          setEntryAnimationExpanded(true);
        }, 20);

        const fadeTimer = window.setTimeout(() => {
          setEntryAnimationExpanded(false);
        }, 1100);

        const hideTimer = window.setTimeout(() => {
          setShowEntryAnimation(false);
        }, 1550);

        return () => {
          window.clearTimeout(expandTimer);
          window.clearTimeout(fadeTimer);
          window.clearTimeout(hideTimer);
        };
      }
    } catch (error) {
      console.warn("Invalid team transition payload", error);
    } finally {
      window.sessionStorage.removeItem("teamPageTransition");
    }
  }, [teamName]);

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        setIsTransitioning(true);
        setLoading(true);
        
        // Search for team by name
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        
        // Get all teams for navigation - include ID for uniqueness when names are duplicated
        const allTeamsList = teamsSnapshot.docs.map((doc) => {
          const data = doc.data();
          const fullName = formatTeamDisplayName(data.city, data.name);
          return { id: doc.id, name: data.name, fullName };
        }).sort((a, b) => a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id));
        
        setAllTeams(allTeamsList);
        
        // Find team by ID first, then by name. If multiple teams share a name, use requested gender when provided.
        const teamDocById = teamsSnapshot.docs.find((doc) => doc.id === teamName);
        const matchingByName = teamsSnapshot.docs.filter((doc) => {
          const data = doc.data();
          const fullName = formatTeamDisplayName(data.city, data.name);
          return fullName === teamName || data.name === teamName;
        });

        let teamDoc = teamDocById ?? null;

        if (!teamDoc) {
          if (matchingByName.length === 1) {
            teamDoc = matchingByName[0];
          } else if (matchingByName.length > 1) {
            if (requestedGender) {
              teamDoc =
                matchingByName.find((doc) => {
                  const data = doc.data();
                  return normalizeTeamGender(data?.gender, data?.logo, "men") === requestedGender;
                }) ?? null;
            }

            if (!teamDoc) {
              teamDoc =
                matchingByName.find((doc) => {
                  const data = doc.data();
                  return normalizeTeamGender(data?.gender, data?.logo, "men") === "men";
                }) ?? matchingByName[0];
            }
          }
        }
        
        if (!teamDoc) {
          setLoading(false);
          return;
        }
        
        // Find current team index and next team - use ID for exact match
        const currentTeamData = teamDoc.data();
        const currentFullName = formatTeamDisplayName(currentTeamData.city, currentTeamData.name);
        const currentTeamId = teamDoc.id;
        const currentIndex = allTeamsList.findIndex(t => t.id === currentTeamId);
        
        console.log('🏀 Current team:', currentFullName);
        console.log('🏀 Current index:', currentIndex);
        console.log('🏀 Total teams:', allTeamsList.length);
        
        // Always set next and previous teams - wrap around for continuous navigation
        if (currentIndex !== -1 && allTeamsList.length > 1) {
          const nextIndex = (currentIndex + 1) % allTeamsList.length;
          const prevIndex = (currentIndex - 1 + allTeamsList.length) % allTeamsList.length;
          setNextTeam(allTeamsList[nextIndex]);
          setPreviousTeam(allTeamsList[prevIndex]);
          console.log('🏀 Previous:', allTeamsList[prevIndex].fullName, '| Current:', currentFullName, '| Next:', allTeamsList[nextIndex].fullName);
        } else {
          setNextTeam(null);
          setPreviousTeam(null);
          console.log('🏀 Navigation disabled (only one team or team not found)');
        }
        
        const data = teamDoc.data();
        const foundTeamId = teamDoc.id;
        const foundTeam: TeamData = {
          id: teamDoc.id,
          name: data.name,
          city: data.city,
          logo: data.logo,
          teamPhoto: data.teamPhoto,
          teamPhotoPosition: data.teamPhotoPosition ?? 50,
          colors: data.colors || ["#000000", "#FFFFFF"],
          wins: data.wins || 0,
          losses: data.losses || 0,
          conference: data.conference,
          nationality: data.nationality,
          nationality2: data.nationality2,
        };
        
        // Calculate wins/losses from games
        const gamesRef = collection(firebaseDB, "games");
        const gamesSnapshot = await getDocs(gamesRef);
        
        let wins = 0;
        let losses = 0;
        
        gamesSnapshot.docs.forEach((gameDoc) => {
          const game = gameDoc.data();
          if (game.winnerTeamId === foundTeamId) {
            wins++;
          } else if (game.loserTeamId === foundTeamId) {
            losses++;
          }
        });
        
        const updatedTeam: TeamData = {
          id: foundTeam.id,
          name: foundTeam.name,
          city: foundTeam.city,
          logo: foundTeam.logo,
          teamPhoto: foundTeam.teamPhoto,
          teamPhotoPosition: foundTeam.teamPhotoPosition,
          colors: foundTeam.colors,
          conference: foundTeam.conference,
          nationality: foundTeam.nationality,
          nationality2: foundTeam.nationality2,
          wins,
          losses,
        };
        
        setTeamData(updatedTeam);
        
        // Fetch roster
        const rosterRef = collection(firebaseDB, "teams", foundTeamId, "roster");
        const rosterSnapshot = await getDocs(rosterRef);
        
        const rosterData: EnhancedRosterPlayer[] = rosterSnapshot.docs.map((doc) => {
          const data = doc.data();
          const playerDob = data.dateOfBirth || data.birthdate || "";
          return {
            id: doc.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Unknown Player",
            firstName: data.firstName,
            lastName: data.lastName,
            number: data.number || "0",
            position: data.position || "N/A",
            height: data.height,
            weight: data.weight,
            dateOfBirth: playerDob,
            birthdate: playerDob,
            nationality: data.nationality,
            nationality2: data.nationality2,
            headshot: data.headshot,
            stats: data.stats || {
              pts: 0,
              reb: 0,
              ast: 0,
              stl: 0,
              blk: 0,
            },
          };
        });
        
        // Sort by number
        rosterData.sort((a, b) => {
          const numA = typeof a.number === 'number' ? a.number : parseInt(String(a.number)) || 999;
          const numB = typeof b.number === 'number' ? b.number : parseInt(String(b.number)) || 999;
          return numA - numB;
        });
        
        setRoster(rosterData);
        
        // Fetch staff (using coachStaff collection to match admin)
        const staffRef = collection(firebaseDB, "teams", foundTeamId, "coachStaff");
        const staffSnapshot = await getDocs(staffRef);
        
        console.log("Staff snapshot size:", staffSnapshot.size);
        
        const staffData: StaffMember[] = staffSnapshot.docs.map((doc) => {
          const data = doc.data();
          console.log("Staff member data:", data);
          return {
            id: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            role: data.role || "staff",
            position: data.position,
            headshot: data.headshot,
            showOnRoster: data.showOnRoster ?? true,
          };
        });
        
        // Sort staff by role (head coach first, then assistant coaches, then staff)
        const roleOrder = { head_coach: 1, assistant_coach: 2, staff: 3 };
        staffData.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
        
        console.log("Staff data to set:", staffData);
        
        // Separate coaches and staff
        const coachesOnly = staffData.filter(member => 
          member.role === "head_coach" || member.role === "assistant_coach"
        );
        const staffOnly = staffData.filter(member => 
          member.role === "staff" && member.showOnRoster !== false
        );
        
        setStaff(staffData);
        setCoaches(coachesOnly);
        setTeamStaff(staffOnly);

        if (entryLoaderStartRef.current) {
          const elapsed = Date.now() - entryLoaderStartRef.current;
          const remaining = Math.max(0, 1300 - elapsed);
          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
          }
        }

        setLoading(false);
        setTimeout(() => setIsTransitioning(false), 100);
      } catch (error) {
        console.error("Error fetching team data:", error);
        setLoading(false);
      }
    };

    if (teamName) {
      fetchTeamData();
    }
  }, [teamName, requestedGender]);

  const introInitials = teamName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const entryAnimationOverlay = (
    <div
      className={`pointer-events-none fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${
        entryAnimationExpanded ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${entryAnimationColors[0]}55, transparent 55%), linear-gradient(180deg, ${entryAnimationColors[1]}44, #020407CC)`,
        }}
      />
      <div
        className={`relative h-56 w-56 sm:h-72 sm:w-72 transform-gpu rounded-full border border-white/30 bg-black/20 backdrop-blur-md transition-all duration-700 ${
          entryAnimationExpanded
            ? "[transform:perspective(900px)_rotateX(0deg)_scale(1)]"
            : "[transform:perspective(900px)_rotateX(16deg)_scale(0.58)]"
        }`}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
        <div className="absolute -inset-3 rounded-full border border-white/20" />
        {entryAnimationLogo ? (
          <Image
            src={entryAnimationLogo}
            alt={`${teamName} intro logo`}
            fill
            className={`rounded-full object-cover p-6 transition-all duration-700 ${
              entryAnimationExpanded ? "scale-100" : "scale-75"
            }`}
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-extrabold text-white">
            {introInitials}
          </div>
        )}
      </div>
    </div>
  );

  const fullTeamName = teamData ? formatTeamDisplayName(teamData.city, teamData.name, teamName) : teamName;
  const record = teamData ? `${teamData.wins}-${teamData.losses}` : "0-0";

  // Chat messages initialization - MUST be before early returns
  useEffect(() => {
    if (!teamData) return;
    setChatMessages([{
      id: `welcome-${teamData.id}`,
      role: "assistant",
      content:
        language === "fr"
          ? `Salut, je suis Princesse IA. Pose-moi une question sur ${fullTeamName} (bilan, effectif, staff, coachs, conférence, etc.).`
          : `Hey I am Princesse your AI. Ask me about ${fullTeamName} (record, roster, staff, coaches, conference, etc.).`,
    }]);
  }, [teamData, language, fullTeamName]);

  // Chat auto-scroll - MUST be before early returns
  useEffect(() => {
    if (!chatOpen) return;
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  if (loading) {
    if (showEntryAnimation) {
      return (
        <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white">
          {entryAnimationOverlay}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.loadingTeamData}</p>
        </div>
      </div>
    );
  }

  if (!teamData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">{t.teamNotFound}</h1>
          <p className="text-slate-400 mb-8">{t.teamNotFound} "{teamName}" {t.teamNotFoundDesc}</p>
          <Link 
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-br from-blue-500/30 to-purple-500/30 hover:from-blue-500/40 hover:to-purple-500/40 border border-white/30 backdrop-blur-xl rounded-lg transition-all shadow-lg"
          >
            {t.backToHome}
          </Link>
        </div>
      </div>
    );
  }
  const aiCopy = {
    title: language === "fr" ? "Princesse IA" : "Princesse AI",
    subtitle: language === "fr" ? "Assistant d'équipe" : "Team Assistant",
    placeholder: language === "fr" ? "Posez une question sur l'équipe..." : "Ask a question about this team...",
    send: language === "fr" ? "Envoyer" : "Send",
    open: language === "fr" ? "Ouvrir Princesse IA" : "Open Princesse AI",
    noData: language === "fr" ? "Je n'ai pas encore les données de l'équipe." : "I don't have team data loaded yet.",
    fallback:
      language === "fr"
        ? "Je peux aider avec le bilan, l'effectif, les coachs, le staff, la conférence, le meilleur marqueur et les joueurs par numéro."
        : "I can help with record, roster, coaches, staff, conference, top scorer, and players by jersey number.",
  };

  const aiQuickPrompts =
    language === "fr"
      ? [
          "Prédire: [Équipe A] vs [Équipe B] avec TSS + confiance",
          "Comparer: [Joueur 1] vs [Joueur 2] avec PCS",
          "Quel est le prochain match et ton pronostic chiffré ?",
          "Montre le classement actuel et les équipes en forme",
        ]
      : [
          "Predict: [Team A] vs [Team B] with TSS + confidence",
          "Compare: [Player 1] vs [Player 2] with PCS",
          "What is the next game and your quantified prediction?",
          "Show current standings and in-form teams",
        ];

  const buildAIResponse = (question: string) => {
    if (!teamData) return aiCopy.noData;

    const text = question.toLowerCase().trim();
    const headCoach = coaches.find((coach) => coach.role === "head_coach");
    const assistantCount = coaches.filter((coach) => coach.role === "assistant_coach").length;
    const totalPlayers = roster.length;
    const topScorer =
      roster.length > 0
        ? [...roster].sort((a, b) => Number(b.stats?.pts || 0) - Number(a.stats?.pts || 0))[0]
        : null;

    if (text.includes("record") || text.includes("wins") || text.includes("loss") || text.includes("bilan")) {
      return `${fullTeamName} ${language === "fr" ? "a un bilan de" : "has a record of"} ${record}.`;
    }

    if (
      text.includes("roster") ||
      text.includes("player") ||
      text.includes("effectif") ||
      text.includes("joueur") ||
      text.includes("how many")
    ) {
      return language === "fr"
        ? `${fullTeamName} compte ${totalPlayers} joueur(s) dans l'effectif actuel.`
        : `${fullTeamName} currently has ${totalPlayers} player(s) on the roster.`;
    }

    if (text.includes("head coach") || text.includes("coach principal") || text.includes("coach")) {
      if (!headCoach) {
        return language === "fr" ? "Aucun entraîneur principal n'est enregistré pour le moment." : "No head coach is currently listed.";
      }
      return language === "fr"
        ? `L'entraîneur principal est ${headCoach.firstName} ${headCoach.lastName}.`
        : `The head coach is ${headCoach.firstName} ${headCoach.lastName}.`;
    }

    if (text.includes("assistant")) {
      return language === "fr"
        ? `L'équipe a ${assistantCount} entraîneur(s) adjoint(s).`
        : `The team has ${assistantCount} assistant coach(es).`;
    }

    if (text.includes("staff")) {
      return language === "fr"
        ? `${teamStaff.length} membre(s) du staff sont actuellement affichés.`
        : `${teamStaff.length} staff member(s) are currently listed.`;
    }

    if (text.includes("conference") || text.includes("conférence")) {
      return teamData.conference
        ? `${fullTeamName} ${language === "fr" ? "évolue en" : "plays in"} ${teamData.conference}.`
        : language === "fr"
          ? "La conférence n'est pas renseignée pour cette équipe."
          : "Conference information is not set for this team.";
    }

    if (text.includes("top scorer") || text.includes("best scorer") || text.includes("meilleur marqueur") || text.includes("points leader")) {
      if (!topScorer) {
        return language === "fr" ? "Aucune donnée de marqueur n'est disponible pour le moment." : "No scoring leader data is available yet.";
      }
      return language === "fr"
        ? `Le meilleur marqueur actuel est ${topScorer.name} avec ${Number(topScorer.stats?.pts || 0).toFixed(1)} pts.`
        : `Current top scorer is ${topScorer.name} with ${Number(topScorer.stats?.pts || 0).toFixed(1)} ppg.`;
    }

    const jerseyMatch = text.match(/#?\s?(\d{1,2})/);
    if (jerseyMatch) {
      const targetNumber = String(Number(jerseyMatch[1]));
      const player = roster.find((item) => String(item.number) === targetNumber);
      if (player) {
        return language === "fr"
          ? `Le joueur #${targetNumber} est ${player.name}${player.position ? ` (${player.position})` : ""}.`
          : `Player #${targetNumber} is ${player.name}${player.position ? ` (${player.position})` : ""}.`;
      }
      return language === "fr"
        ? `Je n'ai trouvé aucun joueur avec le numéro ${targetNumber}.`
        : `I couldn't find a player with jersey number ${targetNumber}.`;
    }

    if (text.includes("list") || text.includes("show players") || text.includes("liste")) {
      if (roster.length === 0) {
        return language === "fr" ? "Aucun joueur n'est disponible dans l'effectif." : "No players are currently available in the roster.";
      }
      const samplePlayers = roster.slice(0, 8).map((player) => `${player.name} (#${player.number})`).join(", ");
      return language === "fr"
        ? `Voici quelques joueurs: ${samplePlayers}${roster.length > 8 ? "..." : ""}`
        : `Here are some players: ${samplePlayers}${roster.length > 8 ? "..." : ""}`;
    }

    return aiCopy.fallback;
  };

  const sendChatQuestion = (questionInput: string) => {
    const question = questionInput.trim();
    if (!question) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question,
    };

    const assistantMessage: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      role: "assistant",
      content: buildAIResponse(question),
    };

    setChatMessages((prev) => [...prev, userMessage, assistantMessage]);
    setChatInput("");
  };

  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendChatQuestion(chatInput);
  };

  return (
    <div 
      key={teamData.id}
      className={`min-h-screen overflow-x-hidden bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white transition-all duration-700 ${
        isTransitioning ? 'opacity-0 translate-y-8 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      {showEntryAnimation && (
        entryAnimationOverlay
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            {/* Logo - hidden on very small screens, shown on sm+ */}
            <Link href="/" className="hidden sm:flex items-center gap-2 sm:gap-3 text-lg sm:text-2xl font-bold text-white hover:text-slate-200 transition-colors shrink-0">
              <Image
                src="/logos/liprobakin.png"
                alt="Liprobakin"
                width={40}
                height={40}
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
              />
              <span className="hidden md:inline">LIPROBAKIN</span>
            </Link>
            
            {/* Navigation buttons - responsive layout */}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 overflow-hidden sm:flex-none sm:justify-end sm:gap-2 md:gap-3">
              {/* Home button - always visible */}
              <Link
                href="/"
                className="group relative h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 flex items-center justify-center overflow-hidden rounded-lg sm:rounded-xl border border-white/20 bg-white/5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-105 sm:hover:scale-110 hover:border-white/40 hover:bg-white/10 shrink-0"
                aria-label="Home"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 animate-shimmer" />
                <svg className="relative z-10 h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              
              {/* Previous Team button */}
              {previousTeam && (
                <Link
                  href={`/team/${previousTeam.id}`}
                  className="group flex min-w-0 max-w-[44vw] items-center gap-1 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5 text-xs transition-colors hover:border-white/30 sm:max-w-[220px] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm md:max-w-[280px] md:px-4"
                >
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="truncate text-slate-400 transition-colors group-hover:text-white">{previousTeam.name}</span>
                </Link>
              )}
              
              {/* Back button - icon only on mobile */}
              <button
                onClick={() => router.back()}
                className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-900/60 p-1.5 sm:p-2 text-sm hover:border-white/30 transition-colors shrink-0"
                aria-label="Back"
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Next Team button */}
              {nextTeam && (
                <Link
                  href={`/team/${nextTeam.id}`}
                  className="group flex min-w-0 max-w-[44vw] items-center gap-1 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5 text-xs transition-colors hover:border-white/30 sm:max-w-[220px] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm md:max-w-[280px] md:px-4"
                >
                  <span className="truncate text-slate-400 transition-colors group-hover:text-white">{nextTeam.name}</span>
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Team Header */}
      <div 
        className={`relative overflow-hidden border-b border-white/10 transition-all duration-1000 h-56 sm:h-64 md:h-72 ${
          isTransitioning ? 'opacity-0 -translate-x-12' : 'opacity-100 translate-x-0'
        }`}
        style={{
          backgroundImage: teamData.teamPhoto 
            ? `linear-gradient(135deg, ${teamData.colors?.[0] || '#000000'}CC, ${teamData.colors?.[1] || '#FFFFFF'}99), url(${teamData.teamPhoto})`
            : `linear-gradient(135deg, ${teamData.colors?.[0] || '#000000'}33, ${teamData.colors?.[1] || '#FFFFFF'}22)`,
          backgroundSize: 'cover',
          backgroundPosition: `center ${teamData.teamPhotoPosition ?? 50}%`,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            {teamData.logo && (
              <Image
                src={teamData.logo}  
                alt={`${fullTeamName} logo`}
                width={120}
                height={120}
                className="h-28 w-28 rounded-full border-4 border-white/20 object-cover sm:h-32 sm:w-32"
              />
            )}
            <div className="text-center sm:text-left">
              <h1 className="mb-2 break-words text-3xl font-bold leading-tight sm:text-5xl">{fullTeamName}</h1>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                <span className="text-xl text-slate-300">{t.record}: <span className="font-semibold text-white">{record}</span></span>
                {teamData.conference && (
                  <span className="text-xl text-slate-300">{teamData.conference}</span>
                )}
              </div>
              <div className="mt-3 flex gap-2 justify-center sm:justify-start">
                {teamData.colors?.map((color, idx) => (
                  <span
                    key={idx}
                    className="h-3 w-12 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className={`mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 transition-all duration-1000 delay-200 ${
        isTransitioning ? 'opacity-0 translate-y-12' : 'opacity-100 translate-y-0'
      }`}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">{t.roster}</h2>
          
          {/* Grid/List Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`group relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all overflow-hidden ${
                viewMode === "grid"
                  ? "bg-gradient-to-br from-blue-500/30 via-purple-500/20 to-pink-500/20 border border-white/40 text-white shadow-lg backdrop-blur-xl"
                  : "border border-white/20 bg-gradient-to-br from-white/10 to-white/5 text-slate-300 hover:border-white/40 backdrop-blur-xl"
              }`}
              type="button"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 animate-shimmer" />
              <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="relative z-10">{t.grid}</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`group relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all overflow-hidden ${
                viewMode === "list"
                  ? "bg-gradient-to-br from-blue-500/30 via-purple-500/20 to-pink-500/20 border border-white/40 text-white shadow-lg backdrop-blur-xl"
                  : "border border-white/20 bg-gradient-to-br from-white/10 to-white/5 text-slate-300 hover:border-white/40 backdrop-blur-xl"
              }`}
              type="button"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 animate-shimmer" />
              <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="relative z-10">{t.list}</span>
            </button>
          </div>
        </div>
        
        {roster.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>{t.noRoster}</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {roster.map((player, index) => {
              const playerImage = player.headshot || "/players/default-avatar.png";
              
              return (
                <Link
                  key={player.id}
                  href={`/player/${encodeURIComponent(fullTeamName)}/${player.number}`}
                  className="group relative rounded-lg border border-white/10 bg-slate-900/60 overflow-hidden transition hover:border-white/30 hover:bg-slate-900/80"
                  style={{
                    animation: isTransitioning ? 'none' : `fadeInUp 0.5s ease-out ${index * 0.03}s both`
                  }}
                >
                  <div className="aspect-[3/4] relative">
                    <Image
                      src={playerImage}
                      alt={player.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    
                    {/* Hover overlay with stats - desktop only */}
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 via-blue-950/70 to-blue-950/85 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 ease-out hidden md:flex flex-col items-center justify-center p-2">
                      <span className="text-xl font-bold text-white mb-0.5 transform -translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-75">#{index}</span>
                      <h3 className="text-xs font-semibold text-blue-300 text-center mb-2 leading-tight transform -translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-100">
                        {player.name}
                      </h3>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-center">
                        <div className="transform translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-150">
                          <span className="text-2xl font-bold text-white">{Number(player.stats?.pts || 0).toFixed(1)}</span>
                          <span className="text-[10px] text-blue-300 block uppercase tracking-wide">PTS</span>
                        </div>
                        <div className="transform translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-175">
                          <span className="text-2xl font-bold text-white">{Number(player.stats?.reb || 0).toFixed(1)}</span>
                          <span className="text-[10px] text-blue-300 block uppercase tracking-wide">REB</span>
                        </div>
                        <div className="transform translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-200">
                          <span className="text-2xl font-bold text-white">{Number(player.stats?.ast || 0).toFixed(1)}</span>
                          <span className="text-[10px] text-blue-300 block uppercase tracking-wide">AST</span>
                        </div>
                        <div className="transform translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-225">
                          <span className="text-2xl font-bold text-white">{Number(player.stats?.stl || 0).toFixed(1)}</span>
                          <span className="text-[10px] text-blue-300 block uppercase tracking-wide">STL</span>
                        </div>
                        <div className="transform translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-250">
                          <span className="text-2xl font-bold text-white">{Number(player.stats?.blk || 0).toFixed(1)}</span>
                          <span className="text-[10px] text-blue-300 block uppercase tracking-wide">BLK</span>
                        </div>
                        <div className="transform translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-275">
                          <span className="text-2xl font-bold text-yellow-400">{(Number(player.stats?.pts || 0) + Number(player.stats?.reb || 0) + Number(player.stats?.ast || 0) + Number(player.stats?.stl || 0) + Number(player.stats?.blk || 0)).toFixed(1)}</span>
                          <span className="text-[10px] text-yellow-400 block uppercase tracking-wide">EFF</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Default view (visible on mobile, hidden on desktop hover) */}
                    <div className="absolute bottom-0 left-0 right-0 p-1.5 md:group-hover:opacity-0 transition-opacity duration-200">
                      <div className="flex items-end justify-between">
                        <div className="flex-1">
                          <span className="text-xl font-bold text-blue-400 block">#{index}</span>
                          <h3 className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors leading-tight">
                            {player.name}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {roster.map((player, index) => (
              <Link
                key={player.id}
                href={`/player/${encodeURIComponent(fullTeamName)}/${player.number}`}
                className="group block rounded-lg border border-white/10 bg-slate-900/60 px-3 py-3 sm:px-6 sm:py-4 transition hover:border-white/30 hover:bg-slate-900/80"
                style={{
                  animation: isTransitioning ? 'none' : `fadeInUp 0.5s ease-out ${index * 0.03}s both`
                }}
              >
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <span className="text-xl sm:text-2xl font-bold text-blue-400 flex-shrink-0">#{player.number}</span>
                  <h3 className="text-sm sm:text-lg font-semibold text-white group-hover:text-blue-400 transition-colors flex-1 min-w-0 truncate">
                    {player.name}
                  </h3>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm mt-2 sm:mt-0 sm:flex sm:justify-end">
                  <div className="text-center sm:text-left">
                    <span className="text-slate-400 block text-[10px] sm:text-xs">{t.height}</span>
                    <span className="text-white text-xs sm:text-sm">{player.height || "N/A"}</span>
                  </div>
                  <div className="text-center sm:text-left">
                    <span className="text-slate-400 block text-[10px] sm:text-xs">{t.nationality}</span>
                    <div className="flex justify-center sm:justify-start">
                      {player.nationality && player.nationality !== "N/A" ? (
                        <img
                          src={`https://flagcdn.com/w40/${player.nationality.toLowerCase()}.png`}
                          alt={player.nationality}
                          width={20}
                          height={14}
                          className="rounded sm:w-6 sm:h-4"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-white text-xs sm:text-sm">N/A</span>
                      )}
                    </div>
                  </div>
                  <div className="text-center sm:text-left">
                    <span className="text-slate-400 block text-[10px] sm:text-xs">{t.dob}</span>
                    <span className="text-white text-xs sm:text-sm">{player.dateOfBirth || player.birthDate || "N/A"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Coaching Staff */}
      {
        <div className={`mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 transition-all duration-1000 delay-300 ${
          isTransitioning ? 'opacity-0 translate-y-12' : 'opacity-100 translate-y-0'
        }`}>
          <h2 className="text-3xl font-bold mb-8">{t.coachingStaff}</h2>
          
          {coaches.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>{t.noStaff}</p>
            </div>
          ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {coaches.map((member) => {
              const staffImage = member.headshot || "/players/default-avatar.png";
              const fullName = `${member.firstName} ${member.lastName}`.trim();
              
              // Format role for display
              const roleDisplay = member.position || member.role
                .split("_")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
              
              return (
                <div
                  key={member.id}
                  className="relative rounded-lg border border-white/10 bg-slate-900/60 overflow-hidden"
                >
                  <div className="aspect-[3/4] relative">
                    <Image
                      src={staffImage}
                      alt={fullName}
                      fill
                      className="object-cover"
                    />
                    {!member.headshot && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                        <span className="text-2xl md:text-xl font-bold text-slate-500">
                          {member.firstName?.charAt(0) || ""}{member.lastName?.charAt(0) || ""}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-1.5">
                      <p className="text-xs sm:text-[10px] uppercase tracking-wide text-blue-400 font-semibold mb-0.5">
                        {roleDisplay}
                      </p>
                      <h3 className="text-sm sm:text-xs font-semibold text-white leading-tight">
                        {fullName}
                      </h3>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      }

      {/* Staff Section */}
      {teamStaff.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">{language === 'fr' ? 'Staff' : 'Staff'}</h2>
          
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {teamStaff.map((member) => {
              const staffImage = member.headshot || "/players/default-avatar.png";
              const fullName = `${member.firstName} ${member.lastName}`.trim();
              
              // Display position instead of role
              const positionDisplay = member.position || "Staff Member";
              
              return (
                <div
                  key={member.id}
                  className="relative rounded-lg border border-white/10 bg-slate-900/60 overflow-hidden"
                >
                  <div className="aspect-[3/4] relative">
                    <Image
                      src={staffImage}
                      alt={fullName}
                      fill
                      className="object-cover"
                    />
                    {!member.headshot && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                        <span className="text-2xl md:text-xl font-bold text-slate-500">
                          {member.firstName?.charAt(0) || ""}{member.lastName?.charAt(0) || ""}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-1.5">
                      <p className="text-xs sm:text-[10px] uppercase tracking-wide text-green-400 font-semibold mb-0.5">
                        {positionDisplay}
                      </p>
                      <h3 className="text-sm sm:text-xs font-semibold text-white leading-tight">
                        {fullName}
                      </h3>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liprobakin AI */}
      {isAiEnabled && <div className="fixed bottom-4 left-4 right-4 z-[60] sm:left-auto sm:right-6 sm:w-[380px]">
        {chatOpen && (
          <div className="mb-3 overflow-hidden rounded-2xl border border-white/20 bg-slate-950/85 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{aiCopy.title}</p>
                <p className="truncate text-xs text-slate-400">{aiCopy.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1 text-xs text-slate-300 transition hover:border-white/30 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div ref={chatScrollRef} className="max-h-[48vh] overflow-y-auto px-3 py-3 sm:max-h-[380px]">
              <div className="space-y-2">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "bg-blue-600/85 text-white"
                          : "border border-white/10 bg-white/8 text-slate-200"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {chatMessages.length <= 2 && (
              <div className="border-t border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="mb-2 text-xs text-slate-500">
                  {language === "fr" ? "Essaie de demander:" : "Try asking:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {aiQuickPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => sendChatQuestion(prompt)}
                      className="rounded-full border border-white/15 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 transition hover:border-blue-300/50 hover:text-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleChatSubmit} className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={aiCopy.placeholder}
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400/60"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl border border-blue-400/40 bg-blue-600/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
                >
                  {aiCopy.send}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setChatOpen((prev) => !prev)}
            className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-white/20 bg-slate-900/85 px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur-xl transition hover:border-blue-300/60"
          >
            <span className="text-base">🤖</span>
            <span className="truncate">{chatOpen ? "Close" : aiCopy.title}</span>
          </button>
        </div>
      </div>}
    </div>
  );
}
