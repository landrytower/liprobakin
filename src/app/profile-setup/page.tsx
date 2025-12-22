"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc, serverTimestamp, collection, getDocs, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import type { UserRole } from "@/types/user";

export default function ProfileSetup() {
  const router = useRouter();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Role selection
  const [step, setStep] = useState<"role" | "player-staff-setup" | "fan-setup">("role");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Player/Staff fields - ADD GENDER SELECTION
  const [selectedGender, setSelectedGender] = useState<"men" | "women" | "">("");
  const [teams, setTeams] = useState<Array<{ id: string; name: string; gender: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamRoster, setTeamRoster] = useState<Array<{ id: string; name: string; number?: string }>>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [idImage, setIdImage] = useState<File | null>(null);

  // Fan fields
  const [favoriteTeamId, setFavoriteTeamId] = useState("");
  const [athletes, setAthletes] = useState<Array<{ id: string; name: string; teamName: string }>>([]);
  const [favoriteAthleteId, setFavoriteAthleteId] = useState("");

  useEffect(() => {
    // Redirect if user already has a role
    if (userProfile?.role) {
      router.push("/");
    }

    // Redirect if not logged in
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, userProfile, loading, router]);

  useEffect(() => {
    // Fetch teams when needed - FILTER BY GENDER
    const fetchTeams = async () => {
      const teamsSnapshot = await getDocs(collection(firebaseDB, "teams"));
      const teamsList = teamsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          gender: doc.data().gender || "men",
        }))
        .filter((team) => !selectedGender || team.gender === selectedGender);
      setTeams(teamsList);
    };

    if ((step === "player-staff-setup" && selectedGender) || step === "fan-setup") {
      fetchTeams();
    }
  }, [step, selectedGender]);

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
    // Fetch athletes for fan setup
    const fetchAthletes = async () => {
      const playersSnapshot = await getDocs(collection(firebaseDB, "players"));
      const athletesList = playersSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || `${doc.data().firstName} ${doc.data().lastName}`,
        teamName: doc.data().teamName || "",
      }));
      setAthletes(athletesList);
    };

    if (step === "fan-setup") {
      fetchAthletes();
    }
  }, [step]);

  const handleRoleSelection = (role: UserRole) => {
    setSelectedRole(role);
    if (role === "fan") {
      setStep("fan-setup");
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

      // Create verification request
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userFirstName: userProfile?.firstName || "",
        userLastName: userProfile?.lastName || "",
        userPhone: userProfile?.phoneNumber || "",
        role: selectedRole,
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || "",
        selectedPersonName: selectedPerson?.name || "",
        selectedPersonId: selectedPersonId,
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

  const handleFanSubmit = async () => {
    if (!user || !favoriteTeamId || !favoriteAthleteId) {
      setError("Please select your favorite team and athlete");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const selectedTeam = teams.find((t) => t.id === favoriteTeamId);
      const selectedAthlete = athletes.find((a) => a.id === favoriteAthleteId);

      await updateDoc(doc(firebaseDB, "users", user.uid), {
        role: "fan",
        favoriteTeamId,
        favoriteTeamName: selectedTeam?.name || "",
        favoriteAthleteId,
        favoriteAthleteName: selectedAthlete?.name || "",
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
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/20">
                  <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Complete Your Profile</h1>
            <p className="text-sm text-slate-400">Let&apos;s get you set up</p>
          </div>

          {step === "role" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-lg font-semibold text-white mb-2">What brings you here?</p>
                <p className="text-sm text-slate-400">Choose your role to continue</p>
              </div>
              <div className="grid gap-4">
                <button
                  onClick={() => handleRoleSelection("player")}
                  className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 text-left transition-all duration-300 hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/20 hover:scale-[1.02]"
                  type="button"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                      <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-1">Player</h3>
                      <p className="text-sm text-slate-400">I am a basketball player</p>
                    </div>
                    <svg className="h-5 w-5 text-slate-400 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelection("coach")}
                  className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 text-left transition-all duration-300 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02]"
                  type="button"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900/30 to-blue-800/20 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                      <svg className="h-6 w-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-1">Coach / Staff</h3>
                      <p className="text-sm text-slate-400">I am a coach or team staff member</p>
                    </div>
                    <svg className="h-5 w-5 text-slate-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelection("fan")}
                  className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 text-left transition-all duration-300 hover:border-orange-400/50 hover:shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02]"
                  type="button"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                      <svg className="h-6 w-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-1">Fan</h3>
                      <p className="text-sm text-slate-400">I am a basketball fan</p>
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
                  <p className="font-semibold text-green-300 mb-1">Verification Required</p>
                  <p className="text-green-200/80">Your account will be reviewed by an administrator before approval.</p>
                </div>
              </div>

              {/* STEP 1: Gender Selection */}
              {!selectedGender && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-white mb-1">Select Gender</h3>
                    <p className="text-sm text-slate-400">Choose to see available teams</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedGender("men")}
                      className="group rounded-xl border border-white/20 bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm p-6 transition-all duration-300 hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/20 hover:scale-105"
                      type="button"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 backdrop-blur-sm border border-green-400/30 group-hover:scale-110 transition-transform">
                          <svg className="h-7 w-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-lg font-bold text-white">Men</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedGender("women")}
                      className="group rounded-xl border border-white/20 bg-gradient-to-br from-pink-500/10 to-pink-600/5 backdrop-blur-sm p-6 transition-all duration-300 hover:border-pink-400/50 hover:shadow-lg hover:shadow-pink-500/20 hover:scale-105"
                      type="button"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500/20 backdrop-blur-sm border border-pink-400/30 group-hover:scale-110 transition-transform">
                          <svg className="h-7 w-7 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-lg font-bold text-white">Women</span>
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
                      Select Your Team
                      <span className="ml-2 text-xs normal-case text-slate-500">({selectedGender === "men" ? "Men's" : "Women's"} League)</span>
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
                        aria-label="Select Your Team"
                        className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-slate-900">Choose a team...</option>
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
                      ← Change gender
                    </button>
                  </div>

                  {/* STEP 3: Player/Staff Name Selection */}
                  {selectedTeamId && (
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                        Select Your Name from Roster
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
                          aria-label="Select Your Name from Roster"
                          className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-4 py-3 text-white focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300 appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-900">Choose your name...</option>
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
                    </div>
                  )}

                  {/* STEP 4: ID Upload */}
                  {selectedPersonId && (
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

                  {selectedPersonId && idImage && (
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

          {step === "fan-setup" && (
            <div className="space-y-6">
              {/* Fan Welcome Notice */}
              <div className="rounded-xl border border-orange-400/50 bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-sm p-4 flex items-start gap-3">
                <svg className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <div className="text-sm">
                  <p className="font-semibold text-orange-300 mb-1">Welcome, Fan!</p>
                  <p className="text-orange-200/80">Complete your profile to personalize your experience and stay updated with your favorites.</p>
                </div>
              </div>

              {/* Favorite Team Selection */}
              <div className="group">
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Select Your Favorite Team
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400 group-focus-within:text-orange-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                  <select
                    value={favoriteTeamId}
                    onChange={(e) => setFavoriteTeamId(e.target.value)}
                    aria-label="Select Your Favorite Team"
                    className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-4 py-3 text-white focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-all duration-300 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">Choose a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id} className="bg-slate-900">
                        {team.name} ({team.gender})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Favorite Athlete Selection */}
              <div className="group">
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Select Your Favorite Athlete
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400 group-focus-within:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <select
                    value={favoriteAthleteId}
                    onChange={(e) => setFavoriteAthleteId(e.target.value)}
                    aria-label="Select Your Favorite Athlete"
                    className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm pl-11 pr-4 py-3 text-white focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-all duration-300 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">Choose an athlete...</option>
                    {athletes.map((athlete) => (
                      <option key={athlete.id} value={athlete.id} className="bg-slate-900">
                        {athlete.name} ({athlete.teamName})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

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
                disabled={loading || !favoriteTeamId || !favoriteAthleteId}
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
