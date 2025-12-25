"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RosterPlayer } from "@/data/febaco";
import { flagFromCode } from "@/data/countries";

const translations = {
  en: {
    loading: "Loading...",
    loadingTeamData: "Loading team data...",
    teamNotFound: "Team not found",
    teamNotFoundDesc: "could not be found.",
    backToHome: "Back to Home",
    back: "Back",
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

type TeamData = {
  id: string;
  name: string;
  city?: string;
  logo?: string;
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
  headshot?: string;
};

export default function TeamPage() {
  const params = useParams();
  const router = useRouter();
  const teamName = decodeURIComponent(params.teamName as string);
  const { language } = useLanguage();
  const t = translations[language];
  
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [roster, setRoster] = useState<EnhancedRosterPlayer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        setLoading(true);
        
        // Search for team by name
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        
        const teamDoc = teamsSnapshot.docs.find((doc) => {
          const data = doc.data();
          const fullName = [data.city, data.name].filter(Boolean).join(" ").trim();
          return fullName === teamName || data.name === teamName;
        });
        
        if (!teamDoc) {
          setLoading(false);
          return;
        }
        
        const data = teamDoc.data();
        const foundTeamId = teamDoc.id;
        const foundTeam: TeamData = {
          id: teamDoc.id,
          name: data.name,
          city: data.city,
          logo: data.logo,
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
          return {
            id: doc.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Unknown Player",
            firstName: data.firstName,
            lastName: data.lastName,
            number: data.number || "0",
            position: data.position || "N/A",
            height: data.height,
            weight: data.weight,
            birthdate: data.birthdate,
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
            headshot: data.headshot,
          };
        });
        
        // Sort staff by role (head coach first, then assistant coaches, then staff)
        const roleOrder = { head_coach: 1, assistant_coach: 2, staff: 3 };
        staffData.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
        
        console.log("Staff data to set:", staffData);
        setStaff(staffData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching team data:", error);
        setLoading(false);
      }
    };

    if (teamName) {
      fetchTeamData();
    }
  }, [teamName]);

  if (loading) {
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

  const fullTeamName = [teamData.city, teamData.name].filter(Boolean).join(" ").trim();
  const record = `${teamData.wins}-${teamData.losses}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-white hover:text-slate-200 transition-colors">
              LIPROBAKIN
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="group relative h-11 w-11 flex items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-white/40 hover:bg-white/10"
                aria-label="Home"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 animate-shimmer" />
                <svg className="relative z-10 h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 text-sm hover:border-white/30 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t.back}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Team Header */}
      <div 
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage: `linear-gradient(135deg, ${teamData.colors?.[0] || '#000000'}33, ${teamData.colors?.[1] || '#FFFFFF'}22)`,
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
              <h1 className="text-4xl font-bold mb-2 sm:text-5xl">{fullTeamName}</h1>
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
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
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
          <div className="grid gap-2 grid-cols-4">
            {roster.map((player) => {
              const playerImage = player.headshot || "/players/default-avatar.png";
              
              return (
                <Link
                  key={player.id}
                  href={`/player/${encodeURIComponent(fullTeamName)}/${player.number}`}
                  className="group relative rounded-lg border border-white/10 bg-slate-900/60 overflow-hidden transition hover:border-white/30 hover:bg-slate-900/80"
                >
                  <div className="aspect-[3/4] relative">
                    <Image
                      src={playerImage}
                      alt={player.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-1.5">
                      <div className="flex items-end justify-between">
                        <div className="flex-1">
                          <span className="text-xl font-bold text-blue-400 block">#{player.number}</span>
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
            {roster.map((player) => (
              <Link
                key={player.id}
                href={`/player/${encodeURIComponent(fullTeamName)}/${player.number}`}
                className="group block rounded-lg border border-white/10 bg-slate-900/60 px-3 py-3 sm:px-6 sm:py-4 transition hover:border-white/30 hover:bg-slate-900/80"
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
                    <span className="text-white text-xs sm:text-sm">{player.dateOfBirth || "N/A"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Coaching Staff */}
      {
        <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">{t.coachingStaff}</h2>
          
          {staff.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>{t.noStaff}</p>
            </div>
          ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {staff.map((member) => {
              const staffImage = member.headshot || "/players/default-avatar.png";
              const fullName = `${member.firstName} ${member.lastName}`.trim();
              
              // Format role for display
              const roleDisplay = member.role
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
    </div>
  );
}
