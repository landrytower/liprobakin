"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, updateDoc, query, where } from "firebase/firestore";
import { firebaseDB, firebaseAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getAdminUser } from "@/lib/adminAuth";
import type { AdminUser } from "@/types/admin";

type Player = {
  id: string;
  teamId: string;
  teamName: string;
  number: number;
  firstName: string;
  lastName: string;
  position: string;
  height: string;
  dateOfBirth: string;
  nationality: string;
  headshot: string;
  stats: {
    pts: string;
    ast: string;
    reb: string;
    stl: string;
    blk: string;
    gp: string;
  };
};

type Team = {
  id: string;
  name: string;
  city: string;
  gender: string;
  colors: string[];
  logo: string;
  wins: number;
  losses: number;
  totalPoints: number;
};

export default function EditTeamPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [editingTeam, setEditingTeam] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  const [teamForm, setTeamForm] = useState({
    name: "",
    city: "",
    gender: "",
    color1: "",
    color2: "",
    logo: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        setUser(user);
        const admin = await getAdminUser(user.uid);
        if (!admin || !admin.permissions.canManageTeams) {
          router.push("/admin");
          return;
        }
        setAdminUser(admin);
      } else {
        router.push("/admin");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user && adminUser) {
      loadData();
    }
  }, [user, adminUser, teamId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all teams for navigation
      const teamsSnapshot = await getDocs(collection(firebaseDB, "teams"));
      const teamsData = teamsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Team[];
      setAllTeams(teamsData.sort((a, b) => a.name.localeCompare(b.name)));

      // Load current team
      const teamDoc = await getDoc(doc(firebaseDB, "teams", teamId));
      if (teamDoc.exists()) {
        const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
        setTeam(teamData);
        setTeamForm({
          name: teamData.name || "",
          city: teamData.city || "",
          gender: teamData.gender || "",
          color1: teamData.colors?.[0] || "",
          color2: teamData.colors?.[1] || "",
          logo: teamData.logo || "",
        });
      }

      // Load players for this team
      const playersQuery = query(
        collection(firebaseDB, "players"),
        where("teamId", "==", teamId)
      );
      const playersSnapshot = await getDocs(playersQuery);
      const playersData = playersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Player[];
      setPlayers(playersData.sort((a, b) => a.number - b.number));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTeam = async () => {
    if (!team) return;
    try {
      setSaving(true);
      await updateDoc(doc(firebaseDB, "teams", team.id), {
        name: teamForm.name,
        city: teamForm.city,
        gender: teamForm.gender,
        colors: [teamForm.color1, teamForm.color2],
        logo: teamForm.logo,
      });
      await loadData();
      setEditingTeam(false);
    } catch (error) {
      console.error("Error saving team:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlayer = async (player: Player) => {
    try {
      await updateDoc(doc(firebaseDB, "players", player.id), player);
      await loadData();
      setEditingPlayerId(null);
    } catch (error) {
      console.error("Error saving player:", error);
    }
  };

  const navigateToTeam = (direction: "prev" | "next") => {
    const currentIndex = allTeams.findIndex((t) => t.id === teamId);
    let nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex < 0) nextIndex = allTeams.length - 1;
    if (nextIndex >= allTeams.length) nextIndex = 0;
    
    router.push(`/admin/edit-team/${allTeams[nextIndex].id}`);
  };

  if (loading || !team) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const currentTeamIndex = allTeams.findIndex((t) => t.id === teamId);

  return (
    <div className="fixed inset-0 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/admin")}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white transition hover:bg-white/10"
                title="Back to Admin"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {team.logo && (
                <img src={team.logo} alt={team.name} className="h-12 w-12 rounded-lg object-contain" />
              )}
              
              <div>
                <h1 className="text-2xl font-bold text-white">{team.name}</h1>
                <p className="text-sm text-slate-400">
                  {team.city} • {team.gender} • {team.wins}W - {team.losses}L
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateToTeam("prev")}
                className="flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              
              <span className="text-sm text-slate-400">
                {currentTeamIndex + 1} / {allTeams.length}
              </span>
              
              <button
                onClick={() => navigateToTeam("next")}
                className="flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Next
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        {/* Team Details Section */}
        <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Team Details</h2>
            {!editingTeam && (
              <button
                onClick={() => setEditingTeam(true)}
                className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
              >
                Edit Team
              </button>
            )}
          </div>

          {editingTeam ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Team Name</label>
                <input
                  type="text"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">City</label>
                <input
                  type="text"
                  value={teamForm.city}
                  onChange={(e) => setTeamForm({ ...teamForm, city: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Gender</label>
                <select
                  value={teamForm.gender}
                  onChange={(e) => setTeamForm({ ...teamForm, gender: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                >
                  <option value="Males">Males</option>
                  <option value="Females">Females</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Logo URL</label>
                <input
                  type="text"
                  value={teamForm.logo}
                  onChange={(e) => setTeamForm({ ...teamForm, logo: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Primary Color</label>
                <input
                  type="text"
                  value={teamForm.color1}
                  onChange={(e) => setTeamForm({ ...teamForm, color1: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                  placeholder="#000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Secondary Color</label>
                <input
                  type="text"
                  value={teamForm.color2}
                  onChange={(e) => setTeamForm({ ...teamForm, color2: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                  placeholder="#FFFFFF"
                />
              </div>
              
              <div className="md:col-span-2 flex gap-2 justify-end">
                <button
                  onClick={() => setEditingTeam(false)}
                  className="rounded-lg border border-white/20 bg-white/5 px-6 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTeam}
                  disabled={saving}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-slate-400">City</div>
                <div className="text-white">{team.city}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Gender</div>
                <div className="text-white">{team.gender}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Record</div>
                <div className="text-white">{team.wins}W - {team.losses}L</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Colors</div>
                <div className="flex gap-2">
                  {team.colors.map((color, i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded border border-white/20"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Players Section */}
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-xl font-bold text-white">
            Roster ({players.length} Players)
          </h2>

          <div className="space-y-2">
            {players.map((player) => {
              const isEditing = editingPlayerId === player.id;
              
              return (
                <div
                  key={player.id}
                  className="rounded-lg border border-white/10 bg-slate-800/50 p-4 transition hover:bg-slate-800/70"
                >
                  {!isEditing ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={player.headshot || "/placeholder-player.png"}
                        alt={`${player.firstName} ${player.lastName}`}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      
                      <div className="flex-1 grid grid-cols-5 gap-4">
                        <div>
                          <div className="text-xs text-slate-400">Number</div>
                          <div className="text-lg font-bold text-white">#{player.number}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Name</div>
                          <div className="text-white">{player.firstName} {player.lastName}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Position</div>
                          <div className="text-white">{player.position}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Height</div>
                          <div className="text-white">{player.height}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Nationality</div>
                          <div className="text-white">{player.nationality}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2 text-center">
                        <div>
                          <div className="text-xs text-slate-400">PPG</div>
                          <div className="text-white font-medium">{player.stats.pts}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">RPG</div>
                          <div className="text-white font-medium">{player.stats.reb}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">APG</div>
                          <div className="text-white font-medium">{player.stats.ast}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">SPG</div>
                          <div className="text-white font-medium">{player.stats.stl}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">BPG</div>
                          <div className="text-white font-medium">{player.stats.blk}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => setEditingPlayerId(player.id)}
                        className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <PlayerEditForm
                      player={player}
                      onSave={handleSavePlayer}
                      onCancel={() => setEditingPlayerId(null)}
                    />
                  )}
                </div>
              );
            })}

            {players.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                No players found for this team
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerEditForm({
  player,
  onSave,
  onCancel,
}: {
  player: Player;
  onSave: (player: Player) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(player);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Jersey #</label>
          <input
            type="number"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: parseInt(e.target.value) })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">First Name</label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Last Name</label>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Position</label>
          <input
            type="text"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Height</label>
          <input
            type="text"
            value={form.height}
            onChange={(e) => setForm({ ...form, height: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Date of Birth</label>
          <input
            type="text"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nationality</label>
          <input
            type="text"
            value={form.nationality}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Headshot URL</label>
          <input
            type="text"
            value={form.headshot}
            onChange={(e) => setForm({ ...form, headshot: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">PPG</label>
          <input
            type="text"
            value={form.stats.pts}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, pts: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">RPG</label>
          <input
            type="text"
            value={form.stats.reb}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, reb: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">APG</label>
          <input
            type="text"
            value={form.stats.ast}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, ast: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">SPG</label>
          <input
            type="text"
            value={form.stats.stl}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, stl: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">BPG</label>
          <input
            type="text"
            value={form.stats.blk}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, blk: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">GP</label>
          <input
            type="text"
            value={form.stats.gp}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, gp: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="rounded-lg border border-white/20 bg-white/5 px-6 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          Save Player
        </button>
      </div>
    </div>
  );
}
