"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAdmin } from "../../layout";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";

type GameItem = {
  id: string;
  homeTeamName: string;
  homeTeamLogo?: string;
  awayTeamName: string;
  awayTeamLogo?: string;
  date: string;
  time?: string;
  venue?: string;
  completed?: boolean;
  status?: string;
  homeScore?: number;
  awayScore?: number;
  period?: string | number;
  quarter?: string | number;
  gameClock?: string;
  clock?: string;
  timeRemaining?: string;
  gender?: string;
  highlightsVideoUrl?: string;
  highlightVideoUrl?: string;
  highlightsUrl?: string;
  highlightUrl?: string;
  videoUrl?: string;
  youtubeUrl?: string;
  streamUrl?: string;
  photoUrls?: string[];
  gamePhotos?: string[];
  photos?: string[];
};

const copy = {
  en: {
    title: "Game Media",
    subtitle: "Upload photos and highlight videos by game",
    back: "Back to League",
    noAccess: "You don't have permission to manage game media.",
    loading: "Loading games...",
    gameList: "Games",
    search: "Search game",
    searchPlaceholder: "Team, date, venue...",
    filter: "Filter",
    allGames: "All",
    upcomingGames: "Upcoming",
    completedGames: "Completed",
    shown: "shown",
    noMatchFilter: "No games match this filter.",
    selectGame: "Select a game to manage media",
    highlightLabel: "Live stream URL (YouTube)",
    highlightPlaceholder: "Paste YouTube live/watch URL (e.g. https://youtube.com/watch?v=...)",
    photosLabel: "Upload Photos",
    addPhotos: "Add photos",
    selectedPhotos: "selected",
    save: "Save Media",
    modify: "Modify Media",
    saving: "Saving...",
    saved: "Media updated successfully",
    saveFailed: "Failed to save media",
    existingPhotos: "Current Photos",
    noPhotos: "No photos uploaded for this game yet.",
    gameDetails: "Game Details",
    liveScoreConsole: "Live Score Console",
    liveModeHint: "Temporary live score controls (does not finalize the game)",
    liveScoreStatus: "Live Status",
    liveHomeScore: "Home Live Score",
    liveAwayScore: "Away Live Score",
    livePeriod: "Period",
    liveClock: "Clock",
    updateLiveScore: "Push Live Score",
    liveUpdated: "Live score updated",
    liveUpdateFailed: "Failed to update live score",
    invalidLiveScore: "Enter valid live scores",
    openLiveStudio: "Open full live console",
    createYoutubeLive: "Create YouTube Live",
    creatingYoutubeLive: "Creating YouTube live...",
    youtubeLiveCreated: "YouTube live created and linked to this game",
    youtubeLiveFailed: "Failed to create YouTube live",
    openYoutubeStudio: "Open YouTube Studio",
    videoUploadLabel: "Upload Video",
    addVideo: "Add video",
    videoSelected: "video selected",
    currentVideo: "Current Video",
    noVideo: "No video attached yet.",
    removeVideo: "Delete video",
    uploadProgress: "Upload Progress",
    uploading: "Uploading",
  },
  fr: {
    title: "Médias des Matchs",
    subtitle: "Téléverser les photos et la vidéo highlight par match",
    back: "Retour à la Ligue",
    noAccess: "Vous n'avez pas la permission de gérer les médias des matchs.",
    loading: "Chargement des matchs...",
    gameList: "Matchs",
    search: "Rechercher un match",
    searchPlaceholder: "Équipe, date, site...",
    filter: "Filtre",
    allGames: "Tous",
    upcomingGames: "À venir",
    completedGames: "Terminés",
    shown: "affichés",
    noMatchFilter: "Aucun match ne correspond à ce filtre.",
    selectGame: "Sélectionnez un match pour gérer les médias",
    highlightLabel: "URL du direct (YouTube)",
    highlightPlaceholder: "Collez l'URL YouTube du direct / vidéo (ex: https://youtube.com/watch?v=...)",
    photosLabel: "Téléverser Photos",
    addPhotos: "Ajouter des photos",
    selectedPhotos: "sélectionnées",
    save: "Enregistrer les médias",
    modify: "Modifier les médias",
    saving: "Enregistrement...",
    saved: "Médias mis à jour avec succès",
    saveFailed: "Échec de l'enregistrement des médias",
    existingPhotos: "Photos actuelles",
    noPhotos: "Aucune photo n'a encore été ajoutée à ce match.",
    gameDetails: "Détails du match",
    liveScoreConsole: "Console Score Live",
    liveModeHint: "Contrôles de score temporaire en direct (ne finalise pas le match)",
    liveScoreStatus: "Statut Live",
    liveHomeScore: "Score Live Domicile",
    liveAwayScore: "Score Live Visiteur",
    livePeriod: "Période",
    liveClock: "Chrono",
    updateLiveScore: "Publier Score Live",
    liveUpdated: "Score live mis à jour",
    liveUpdateFailed: "Échec de la mise à jour du score live",
    invalidLiveScore: "Entrez des scores live valides",
    openLiveStudio: "Ouvrir la console live plein écran",
    createYoutubeLive: "Créer un live YouTube",
    creatingYoutubeLive: "Création du live YouTube...",
    youtubeLiveCreated: "Live YouTube créé et lié à ce match",
    youtubeLiveFailed: "Échec de la création du live YouTube",
    openYoutubeStudio: "Ouvrir YouTube Studio",
    videoUploadLabel: "Téléverser Vidéo",
    addVideo: "Ajouter une vidéo",
    videoSelected: "vidéo sélectionnée",
    currentVideo: "Vidéo actuelle",
    noVideo: "Aucune vidéo attachée pour le moment.",
    removeVideo: "Supprimer la vidéo",
    uploadProgress: "Progression du téléversement",
    uploading: "Téléversement",
  },
} as const;

function extractPhotoUrls(game: GameItem): string[] {
  const candidates = [game.photoUrls, game.gamePhotos, game.photos];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((url) => typeof url === "string" && url.trim().length > 0);
    }
  }
  return [];
}

function normalizeVideoUrlInput(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("studio.youtube.com") && parsed.pathname.includes("/video/")) {
      const studioMatch = parsed.pathname.match(/\/video\/([^/]+)/i);
      const videoId = studioMatch?.[1] || "";
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }
  } catch {
    return raw;
  }

  return raw;
}

export default function GameMediaPage() {
  const { language, currentAdminUser } = useAdmin();
  const t = copy[language];

  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "completed">("all");
  const [highlightUrl, setHighlightUrl] = useState("");
  const [originalHighlightUrl, setOriginalHighlightUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [originalPhotos, setOriginalPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [creatingYoutubeLive, setCreatingYoutubeLive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [youtubeStudioUrl, setYoutubeStudioUrl] = useState<string>("");

  const canManage = currentAdminUser?.permissions?.canManageGameMedia || currentAdminUser?.roles?.includes("master");

  useEffect(() => {
    const gamesQuery = query(collection(firebaseDB, "games"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(
      gamesQuery,
      (snapshot) => {
        const next = snapshot.docs.map((gameDoc) => ({
          id: gameDoc.id,
          ...(gameDoc.data() as Omit<GameItem, "id">),
        }));

        setGames(next);
        if (!selectedGameId && next.length > 0) {
          setSelectedGameId(next[0].id);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading games for media management:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedGameId]);

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) || null,
    [games, selectedGameId]
  );

  const hasExistingMedia = originalPhotos.length > 0 || Boolean(originalHighlightUrl);

  const filteredGames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const query = searchQuery.trim().toLowerCase();

    return games.filter((game) => {
      const isCompleted = game.completed === true || game.status === "completed";

      if (statusFilter === "completed" && !isCompleted) return false;
      if (statusFilter === "upcoming") {
        if (isCompleted) return false;
        if (game.date) {
          const gameDate = new Date(`${game.date}T00:00:00`);
          if (gameDate < today) return false;
        }
      }

      if (!query) return true;

      const searchable = [
        game.homeTeamName,
        game.awayTeamName,
        game.date,
        game.time,
        game.venue,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [games, searchQuery, statusFilter]);

  useEffect(() => {
    if (!selectedGameId || filteredGames.some((g) => g.id === selectedGameId)) {
      return;
    }
    if (filteredGames.length > 0) {
      setSelectedGameId(filteredGames[0].id);
    }
  }, [filteredGames, selectedGameId]);

  useEffect(() => {
    if (!selectedGame) {
      setHighlightUrl("");
      setOriginalHighlightUrl("");
      setVideoFile(null);
      setExistingPhotos([]);
      setOriginalPhotos([]);
      setNewPhotos([]);
      return;
    }

    const currentHighlight =
      selectedGame.highlightsVideoUrl ||
      selectedGame.highlightVideoUrl ||
      selectedGame.highlightsUrl ||
      selectedGame.highlightUrl ||
      selectedGame.videoUrl ||
      selectedGame.youtubeUrl ||
      selectedGame.streamUrl ||
      "";

    setHighlightUrl(currentHighlight);
    setOriginalHighlightUrl(currentHighlight);
    setVideoFile(null);
    const currentPhotos = extractPhotoUrls(selectedGame);
    setExistingPhotos(currentPhotos);
    setOriginalPhotos(currentPhotos);
    setNewPhotos([]);
    setStatus(null);
  }, [selectedGame]);

  const gameLabel = (game: GameItem) => `${game.awayTeamName} vs ${game.homeTeamName}`;

  const handleAddPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setNewPhotos((prev) => [...prev, ...Array.from(files)]);
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setHighlightUrl("");
    setVideoFile(null);
  };

  const handleCreateYouTubeLive = async () => {
    if (!selectedGame) return;

    setCreatingYoutubeLive(true);
    setStatus(null);

    try {
      const response = await fetch("/api/youtube/live/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: selectedGame.id,
          title: `${selectedGame.awayTeamName} vs ${selectedGame.homeTeamName}`,
          description: `${selectedGame.date || ""} ${selectedGame.time || ""} ${selectedGame.venue || ""}`.trim(),
          privacyStatus: "unlisted",
        }),
      });

      const data = (await response.json()) as {
        watchUrl?: string;
        studioUrl?: string;
        rtmpUrl?: string;
        streamKey?: string;
        error?: string;
      };

      if (!response.ok || !data.watchUrl) {
        throw new Error(data.error || t.youtubeLiveFailed);
      }

      setHighlightUrl(data.watchUrl);
      setYoutubeStudioUrl(data.studioUrl || "");

      await updateDoc(doc(firebaseDB, "games", selectedGame.id), {
        streamUrl: data.watchUrl,
        youtubeUrl: data.watchUrl,
        highlightsVideoUrl: data.watchUrl,
        highlightVideoUrl: data.watchUrl,
        status: "live",
        completed: false,
        youtubeStudioUrl: data.studioUrl || null,
        youtubeIngestUrl: data.rtmpUrl || null,
        youtubeStreamKey: data.streamKey || null,
        updatedAt: serverTimestamp(),
      });

      setStatus({ type: "success", message: t.youtubeLiveCreated });
    } catch (error) {
      console.error("Error creating YouTube live:", error);
      setStatus({ type: "error", message: t.youtubeLiveFailed });
    } finally {
      setCreatingYoutubeLive(false);
    }
  };

  const handleSave = async () => {
    if (!selectedGame) return;

    setSaving(true);
    setUploadProgress(0);
    setStatus(null);

    try {
      const uploadedUrls: string[] = [];
      const totalBytes =
        newPhotos.reduce((sum, file) => sum + file.size, 0) +
        (videoFile?.size || 0);
      let uploadedBytes = 0;

      const uploadFileWithProgress = async (file: File, path: string): Promise<string> => {
        const fileRef = storageRef(firebaseStorage, path);
        const uploadTask = uploadBytesResumable(fileRef, file);

        return new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              if (totalBytes <= 0) {
                setUploadProgress(90);
                return;
              }
              const currentBytes = uploadedBytes + snapshot.bytesTransferred;
              const percentage = Math.min(99, Math.round((currentBytes / totalBytes) * 100));
              setUploadProgress(percentage);
            },
            (error) => reject(error),
            async () => {
              uploadedBytes += file.size;
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            }
          );
        });
      };

      for (const file of newPhotos) {
        const storagePath = `game-media/${selectedGame.id}/photos/${Date.now()}-${file.name}`;
        const url = await uploadFileWithProgress(file, storagePath);
        uploadedUrls.push(url);
      }

      const allPhotoUrls = [...existingPhotos, ...uploadedUrls];
      let normalizedHighlight = normalizeVideoUrlInput(highlightUrl);

      if (videoFile) {
        const videoPath = `game-media/${selectedGame.id}/videos/${Date.now()}-${videoFile.name}`;
        normalizedHighlight = await uploadFileWithProgress(videoFile, videoPath);
      }

      setUploadProgress(100);

      const removedPhotos = originalPhotos.filter((photoUrl) => !allPhotoUrls.includes(photoUrl));
      for (const removedPhoto of removedPhotos) {
        if (!removedPhoto.includes("firebasestorage.googleapis.com")) continue;
        try {
          await deleteObject(storageRef(firebaseStorage, removedPhoto));
        } catch (error) {
          console.warn("Could not delete removed photo from storage:", removedPhoto, error);
        }
      }

      if (
        originalHighlightUrl &&
        originalHighlightUrl !== normalizedHighlight &&
        originalHighlightUrl.includes("firebasestorage.googleapis.com")
      ) {
        try {
          await deleteObject(storageRef(firebaseStorage, originalHighlightUrl));
        } catch (error) {
          console.warn("Could not delete previous highlight video from storage:", error);
        }
      }

      await updateDoc(doc(firebaseDB, "games", selectedGame.id), {
        highlightsVideoUrl: normalizedHighlight || null,
        highlightVideoUrl: normalizedHighlight || null,
        photoUrls: allPhotoUrls,
        gamePhotos: allPhotoUrls,
        updatedAt: serverTimestamp(),
      });

      setExistingPhotos(allPhotoUrls);
  setOriginalPhotos(allPhotoUrls);
  setOriginalHighlightUrl(normalizedHighlight);
  setHighlightUrl(normalizedHighlight);
  setVideoFile(null);
      setNewPhotos([]);
      setStatus({ type: "success", message: t.saved });
    } catch (error) {
      console.error("Error saving game media:", error);
      setStatus({ type: "error", message: t.saveFailed });
    } finally {
      setSaving(false);
      setTimeout(() => setUploadProgress(null), 1200);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
        {t.noAccess}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <span className="ml-3 text-slate-300">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-sm text-slate-400">{t.subtitle}</p>
        </div>
        <Link href="/admin/league" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:text-white hover:border-white/30 transition">
          ← {t.back}
        </Link>
      </div>

      {status && (
        <div className={`rounded-xl border p-3 text-sm ${status.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {status.message}
        </div>
      )}

      {saving && uploadProgress !== null && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-sky-200">
            <span>{t.uploadProgress}</span>
            <span className="font-bold">{uploadProgress}%</span>
          </div>
          <progress className="h-2.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-900/70 [&::-webkit-progress-value]:bg-sky-400 [&::-moz-progress-bar]:bg-sky-400" value={uploadProgress} max={100} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-800/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.gameList}</p>
            <span className="text-[11px] text-slate-500">{filteredGames.length}/{games.length} {t.shown}</span>
          </div>

          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-orange-500/40 focus:outline-none"
              aria-label={t.search}
            />
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${statusFilter === "all" ? "bg-orange-500/20 text-orange-300 border border-orange-500/40" : "bg-slate-900/70 text-slate-300 border border-white/10 hover:border-white/20"}`}
              >
                {t.allGames}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("upcoming")}
                className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${statusFilter === "upcoming" ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "bg-slate-900/70 text-slate-300 border border-white/10 hover:border-white/20"}`}
              >
                {t.upcomingGames}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${statusFilter === "completed" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-900/70 text-slate-300 border border-white/10 hover:border-white/20"}`}
              >
                {t.completedGames}
              </button>
            </div>
          </div>

          <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {filteredGames.length === 0 && (
              <p className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-3 text-xs text-slate-400">{t.noMatchFilter}</p>
            )}

            {filteredGames.map((game) => {
              const selected = game.id === selectedGameId;
              const photoCount = extractPhotoUrls(game).length;
              const hasHighlight = Boolean(
                game.highlightsVideoUrl ||
                game.highlightVideoUrl ||
                game.highlightsUrl ||
                game.highlightUrl ||
                game.videoUrl ||
                game.youtubeUrl ||
                game.streamUrl
              );
              const isCompleted = game.completed === true || game.status === "completed";
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setSelectedGameId(game.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-orange-500/40 bg-orange-500/10" : "border-white/10 bg-slate-900/40 hover:border-white/20"}`}
                >
                  <p className="text-sm font-semibold text-white truncate">{gameLabel(game)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                    <span>{game.date || "—"}{game.time ? ` • ${game.time}` : ""}</span>
                    <span className={`rounded px-1.5 py-0.5 ${isCompleted ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"}`}>
                      {isCompleted ? t.completedGames : t.upcomingGames}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{hasHighlight ? "🎬 1" : "🎬 0"}</span>
                    <span>📷 {photoCount}</span>
                    {game.venue && <span className="truncate">📍 {game.venue}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-800/30 p-4 sm:p-5">
          {!selectedGame ? (
            <p className="text-slate-400">{t.selectGame}</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">{gameLabel(selectedGame)}</h2>
                <p className="text-xs text-slate-400">{selectedGame.date || "—"}{selectedGame.time ? ` • ${selectedGame.time}` : ""}</p>
                <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{t.gameDetails}</p>
                  <p>{selectedGame.venue || "—"}{selectedGame.gender ? ` • ${selectedGame.gender}` : ""}</p>
                </div>
              </div>

              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-200">{t.liveScoreConsole}</p>
                    <p className="text-[11px] text-slate-300">{t.liveModeHint}</p>
                  </div>
                  <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${String(selectedGame.status || "").toLowerCase() === "live" ? "bg-red-500/20 text-red-200 border border-red-500/40" : "bg-slate-800 text-slate-300 border border-white/10"}`}>
                    {t.liveScoreStatus}: {String(selectedGame.status || "scheduled").toUpperCase()}
                  </span>
                </div>
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/50 p-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {selectedGame.awayTeamLogo ? (
                      <Image src={selectedGame.awayTeamLogo} alt={selectedGame.awayTeamName || "Away"} width={28} height={28} className="h-7 w-7 rounded-full object-cover" unoptimized />
                    ) : null}
                    <span className="truncate text-sm font-semibold text-white">{selectedGame.awayTeamName}</span>
                    <span className="ml-auto text-xl font-black tabular-nums text-white">{selectedGame.awayScore ?? 0}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">VS</span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="text-xl font-black tabular-nums text-white">{selectedGame.homeScore ?? 0}</span>
                    <span className="truncate text-sm font-semibold text-white">{selectedGame.homeTeamName}</span>
                    {selectedGame.homeTeamLogo ? (
                      <Image src={selectedGame.homeTeamLogo} alt={selectedGame.homeTeamName || "Home"} width={28} height={28} className="h-7 w-7 rounded-full object-cover" unoptimized />
                    ) : null}
                  </div>
                </div>

                <Link
                  href={`/admin/league/game-media/live-console?gameId=${selectedGame.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:shadow-red-500/30"
                >
                  🎛️ {t.openLiveStudio}
                </Link>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateYouTubeLive}
                    disabled={creatingYoutubeLive}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/20 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingYoutubeLive ? "⏳" : "📺"} {creatingYoutubeLive ? t.creatingYoutubeLive : t.createYoutubeLive}
                  </button>

                  {youtubeStudioUrl && (
                    <a
                      href={youtubeStudioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-white/30 hover:text-white"
                    >
                      ▶ {t.openYoutubeStudio}
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t.highlightLabel}</label>
                <input
                  type="url"
                  value={highlightUrl}
                  onChange={(event) => setHighlightUrl(event.target.value)}
                  placeholder={t.highlightPlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-orange-500/40 focus:outline-none"
                />
                <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                  <p className="mb-2 text-[11px] text-slate-500 uppercase tracking-wide">{t.currentVideo}</p>
                  {highlightUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={highlightUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full truncate text-xs text-sky-300 hover:text-sky-200"
                      >
                        {highlightUrl}
                      </a>
                      <button
                        type="button"
                        onClick={removeVideo}
                        className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"
                      >
                        {t.removeVideo}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">{t.noVideo}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t.videoUploadLabel}</label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-white">
                  <span>🎥</span>
                  {t.addVideo}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
                  />
                </label>
                {videoFile && (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                    <span className="truncate">{videoFile.name}</span>
                    <button type="button" onClick={() => setVideoFile(null)} className="ml-3 text-red-300 hover:text-red-200">✕</button>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t.photosLabel}</label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-white">
                  <span>📷</span>
                  {t.addPhotos}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => handleAddPhotos(event.target.files)}
                  />
                </label>
              </div>

              {newPhotos.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                  <p className="mb-2 text-xs text-slate-400">{newPhotos.length} {t.selectedPhotos}</p>
                  <div className="space-y-1.5">
                    {newPhotos.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between text-xs text-slate-300">
                        <span className="truncate">{file.name}</span>
                        <button type="button" onClick={() => removeNewPhoto(index)} className="ml-3 text-red-300 hover:text-red-200">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t.existingPhotos}</p>
                {existingPhotos.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.noPhotos}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {existingPhotos.map((photoUrl, index) => (
                      <div key={`${photoUrl}-${index}`} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                        <Image src={photoUrl} alt={`Game photo ${index + 1}`} width={320} height={220} className="h-28 w-full object-cover" unoptimized />
                        <button
                          type="button"
                          onClick={() => removeExistingPhoto(index)}
                          className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-xs text-red-300 hover:text-red-200"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:shadow-orange-500/30 disabled:opacity-60"
              >
                {saving ? `${t.uploading} ${uploadProgress ?? 0}%` : hasExistingMedia ? t.modify : t.save}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
