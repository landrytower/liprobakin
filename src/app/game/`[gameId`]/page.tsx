"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

type GameData = {
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  date?: string;
  time?: string;
  venue?: string;
  winnerScore?: number;
  loserScore?: number;
  winnerTeamId?: string;
  completed?: boolean;
  gender?: string;
};

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameDoc = await getDoc(doc(firebaseDB, "games", gameId));
        if (gameDoc.exists()) {
          setGame(gameDoc.data() as GameData);
        }
      } catch (error) {
        console.error("Error fetching game:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
  }, [gameId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Game not found</p>
          <Link href="/" className="text-blue-400"> Back</Link>
        </div>
      </div>
    );
  }

  const homeWon = game.winnerTeamId === game.homeTeamId;
  const homeScore = homeWon ? game.winnerScore : game.loserScore;
  const awayScore = !homeWon ? game.winnerScore : game.loserScore;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold">LIPROBAKIN</Link>
            <Link href="/" className="rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm"> Back</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8">
          <div className="mb-6 text-center">
            <span className="inline-block rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold uppercase">
              {game.completed ? "Final" : "Scheduled"}
            </span>
          </div>
          <div className="space-y-6">
            <div className={`flex items-center justify-between rounded-xl border p-6 ${!homeWon && game.completed ? "border-green-500/50 bg-green-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-center gap-4">
                {game.awayTeamLogo && <Image src={game.awayTeamLogo} alt={game.awayTeamName || "Away"} width={60} height={60} className="rounded-full" />}
                <div>
                  <p className="text-sm text-slate-400">Away</p>
                  <h2 className="text-2xl font-bold">{game.awayTeamName || "Away Team"}</h2>
                </div>
              </div>
              {game.completed && <div className="text-4xl font-bold">{awayScore}</div>}
            </div>
            <div className={`flex items-center justify-between rounded-xl border p-6 ${homeWon && game.completed ? "border-green-500/50 bg-green-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-center gap-4">
                {game.homeTeamLogo && <Image src={game.homeTeamLogo} alt={game.homeTeamName || "Home"} width={60} height={60} className="rounded-full" />}
                <div>
                  <p className="text-sm text-slate-400">Home</p>
                  <h2 className="text-2xl font-bold">{game.homeTeamName || "Home Team"}</h2>
                </div>
              </div>
              {game.completed && <div className="text-4xl font-bold">{homeScore}</div>}
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {game.date && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400 mb-1">Date</p>
                <p className="font-semibold">{new Date(game.date).toLocaleDateString()}</p>
              </div>
            )}
            {game.time && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400 mb-1">Time</p>
                <p className="font-semibold">{game.time}</p>
              </div>
            )}
            {game.venue && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400 mb-1">Venue</p>
                <p className="font-semibold">{game.venue}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}