import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { firebaseDB } from "../lib/firebase";
import type { Team, Player, Game, GameStatus } from "../types";

// Helper to convert Firestore timestamp
const toDate = (timestamp: { _seconds: number; _nanoseconds: number } | Date | undefined): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if ("_seconds" in timestamp) {
    return new Date(timestamp._seconds * 1000);
  }
  return new Date();
};

// ============ TEAMS ============

export function useTeams(gender?: "men" | "women") {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        const constraints: QueryConstraint[] = [];
        
        if (gender) {
          constraints.push(where("gender", "==", gender === "men" ? "male" : "female"));
        }
        constraints.push(orderBy("name"));

        const teamsQuery = query(collection(firebaseDB, "teams"), ...constraints);
        const snapshot = await getDocs(teamsQuery);

        const teamsData: Team[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Unknown Team",
            shortName: data.shortName,
            logo: data.logo,
            city: data.city,
            gender: data.gender === "male" ? "men" : "women",
            league: data.league,
            wins: data.wins || 0,
            losses: data.losses || 0,
          };
        });

        setTeams(teamsData);
        setError(null);
      } catch (err) {
        console.error("Error fetching teams:", err);
        setError("Failed to load teams");
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [gender]);

  return { teams, loading, error };
}

export function useTeam(teamId: string) {
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!teamId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch team
        const teamDoc = await getDoc(doc(firebaseDB, "teams", teamId));
        if (teamDoc.exists()) {
          const data = teamDoc.data();
          setTeam({
            id: teamDoc.id,
            name: data.name || "Unknown Team",
            shortName: data.shortName,
            logo: data.logo,
            city: data.city,
            gender: data.gender === "male" ? "men" : "women",
            league: data.league,
            wins: data.wins || 0,
            losses: data.losses || 0,
          });

          // Fetch players (roster is typically stored in a subcollection or players collection)
          const playersQuery = query(
            collection(firebaseDB, "teams", teamId, "players"),
            orderBy("number")
          );
          const playersSnapshot = await getDocs(playersQuery);

          const playersData: Player[] = playersSnapshot.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              firstName: d.firstName || "",
              lastName: d.lastName || "",
              number: d.number,
              position: d.position,
              height: d.height,
              weight: d.weight,
              birthdate: d.birthdate,
              nationality: d.nationality,
              headshot: d.headshot,
              teamId,
              teamName: data.name,
            };
          });

          setPlayers(playersData);
        } else {
          setError("Team not found");
        }
      } catch (err) {
        console.error("Error fetching team:", err);
        setError("Failed to load team");
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [teamId]);

  return { team, players, loading, error };
}

// ============ GAMES ============

export function useGames(options?: {
  gender?: "men" | "women";
  teamId?: string;
  upcoming?: boolean;
  limitCount?: number;
}) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        const constraints: QueryConstraint[] = [];

        if (options?.gender) {
          constraints.push(
            where("gender", "==", options.gender === "men" ? "male" : "female")
          );
        }

        if (options?.teamId) {
          // This would need a compound query or client-side filtering
          // For simplicity, we'll fetch all and filter
        }

        // Order by date
        constraints.push(orderBy("date", options?.upcoming ? "asc" : "desc"));

        if (options?.limitCount) {
          constraints.push(limit(options.limitCount));
        }

        const gamesQuery = query(collection(firebaseDB, "games"), ...constraints);
        const snapshot = await getDocs(gamesQuery);

        let gamesData: Game[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          const completed = data.completed === true;
          
          let status: GameStatus = "scheduled";
          if (completed) {
            status = "final";
          } else if (data.status === "in_progress") {
            status = "in_progress";
          }

          return {
            id: doc.id,
            homeTeamId: data.homeTeamId || "",
            awayTeamId: data.awayTeamId || "",
            homeTeamName: data.homeTeamName || "TBD",
            awayTeamName: data.awayTeamName || "TBD",
            homeScore: completed
              ? data.winnerTeamId === data.homeTeamId
                ? data.winnerScore || 0
                : data.loserScore || 0
              : 0,
            awayScore: completed
              ? data.winnerTeamId === data.awayTeamId
                ? data.winnerScore || 0
                : data.loserScore || 0
              : 0,
            status,
            scheduledTime: new Date(`${data.date}T${data.time || "19:00"}`),
            venue: data.venue,
            league: data.gender === "male" ? "Men's League" : "Women's League",
          };
        });

        // Filter by team if needed
        if (options?.teamId) {
          gamesData = gamesData.filter(
            (g) => g.homeTeamId === options.teamId || g.awayTeamId === options.teamId
          );
        }

        // Filter upcoming games
        if (options?.upcoming) {
          const now = new Date();
          gamesData = gamesData.filter((g) => g.scheduledTime > now && g.status === "scheduled");
        }

        setGames(gamesData);
        setError(null);
      } catch (err) {
        console.error("Error fetching games:", err);
        setError("Failed to load games");
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [options?.gender, options?.teamId, options?.upcoming, options?.limitCount]);

  return { games, loading, error };
}

export function useGame(gameId: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(firebaseDB, "games", gameId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const completed = data.completed === true;

          let status: GameStatus = "scheduled";
          if (completed) {
            status = "final";
          } else if (data.status === "in_progress") {
            status = "in_progress";
          }

          setGame({
            id: snapshot.id,
            homeTeamId: data.homeTeamId || "",
            awayTeamId: data.awayTeamId || "",
            homeTeamName: data.homeTeamName || "TBD",
            awayTeamName: data.awayTeamName || "TBD",
            homeScore: completed
              ? data.winnerTeamId === data.homeTeamId
                ? data.winnerScore || 0
                : data.loserScore || 0
              : 0,
            awayScore: completed
              ? data.winnerTeamId === data.awayTeamId
                ? data.winnerScore || 0
                : data.loserScore || 0
              : 0,
            status,
            scheduledTime: new Date(`${data.date}T${data.time || "19:00"}`),
            venue: data.venue,
            league: data.gender === "male" ? "Men's League" : "Women's League",
          });
          setError(null);
        } else {
          setError("Game not found");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching game:", err);
        setError("Failed to load game");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gameId]);

  return { game, loading, error };
}

// ============ STANDINGS ============

export interface Standing {
  rank: number;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  wins: number;
  losses: number;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
}

export function useStandings(gender?: "men" | "women") {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        setLoading(true);
        const constraints: QueryConstraint[] = [];

        if (gender) {
          constraints.push(where("gender", "==", gender === "men" ? "male" : "female"));
        }

        // Fetch teams with their records
        const teamsQuery = query(collection(firebaseDB, "teams"), ...constraints);
        const snapshot = await getDocs(teamsQuery);

        const standingsData: Standing[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          const wins = data.wins || 0;
          const losses = data.losses || 0;
          const totalGames = wins + losses;

          return {
            rank: 0, // Will be calculated after sorting
            teamId: doc.id,
            teamName: data.name || "Unknown",
            teamLogo: data.logo,
            wins,
            losses,
            winPercentage: totalGames > 0 ? wins / totalGames : 0,
            pointsFor: data.totalPoints || 0,
            pointsAgainst: 0, // Would need to calculate from games
          };
        });

        // Sort by win percentage, then by wins
        standingsData.sort((a, b) => {
          if (b.winPercentage !== a.winPercentage) {
            return b.winPercentage - a.winPercentage;
          }
          return b.wins - a.wins;
        });

        // Assign ranks
        standingsData.forEach((s, i) => {
          s.rank = i + 1;
        });

        setStandings(standingsData);
        setError(null);
      } catch (err) {
        console.error("Error fetching standings:", err);
        setError("Failed to load standings");
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, [gender]);

  return { standings, loading, error };
}
