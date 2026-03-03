"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";
import { useLanguage } from "@/contexts/LanguageContext";
import { navSections } from "@/data/febaco";

/* ─── types ─── */
type Locale = "en" | "fr";
type Gender = "men" | "women";

type ScheduleGame = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  venue: string;
  gender: Gender;
  dateTime: Date;
  time: string;
  status: string;
  homeRecord: string;
  awayRecord: string;
  referees: string[];
};

type Partner = { id: string; name: string; logo?: string };

/* ─── i18n ─── */
const copy = {
  en: {
    brand: "LIPROBAKIN",
    pageTitle: "Full Schedule",
    pageSubtitle: "All upcoming games organized by week",
    thisWeek: "This Week",
    nextWeek: "Next Week",
    weekOf: "Week of",
    noGames: "No games scheduled for this period.",
    allGender: "All",
    men: "Men",
    women: "Women",
    vs: "VS",
    at: "at",
    tbd: "TBD",
    upcoming: "Upcoming",
    today: "Today",
    tomorrow: "Tomorrow",
    backHome: "Back to Home",
    viewAll: "View All Weeks",
    ref: "Ref",
    nav: {
      games: "Games",
      schedule: "Schedule",
      players: "Players",
      news: "News",
      stats: "Stats",
      standings: "Standings",
      teams: "Teams",
    },
    footerTagline: "Liprobakin League",
    languageLabel: "Language",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    daysShort: ["S", "M", "T", "W", "T", "F", "S"],
  },
  fr: {
    brand: "LIPROBAKIN",
    pageTitle: "Calendrier Complet",
    pageSubtitle: "Tous les matchs à venir organisés par semaine",
    thisWeek: "Cette semaine",
    nextWeek: "Semaine prochaine",
    weekOf: "Semaine du",
    noGames: "Aucun match prévu pour cette période.",
    allGender: "Tous",
    men: "Messieurs",
    women: "Dames",
    vs: "VS",
    at: "à",
    tbd: "À déterminer",
    upcoming: "À venir",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    backHome: "Retour à l'accueil",
    viewAll: "Voir toutes les semaines",
    ref: "Arb",
    nav: {
      games: "Matchs",
      schedule: "Calendrier",
      players: "Joueurs",
      news: "Actualités",
      stats: "Stats",
      standings: "Classement",
      teams: "Équipes",
    },
    footerTagline: "Ligue Liprobakin",
    languageLabel: "Langue",
    months: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"],
    days: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    daysShort: ["L", "M", "M", "J", "V", "S", "D"],
  },
} as const;

/* ─── helpers ─── */
const parseGameDateTime = (dateStr?: string, timeStr?: string): Date | null => {
  const safeDate = (dateStr || "").trim();
  const safeTime = (timeStr || "00:00").trim();
  if (!safeDate) return null;

  let normalizedDate = safeDate;
  if (safeDate.includes("/")) {
    const [a, b, c] = safeDate.split("/");
    if (a && b && c) {
      normalizedDate = `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
    }
  }

  const normalizedTime = safeTime.length === 5 ? `${safeTime}:00` : safeTime;
  const parsed = new Date(`${normalizedDate}T${normalizedTime}`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const getWeekStart = (date: Date, isFrench: boolean): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = isFrench ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekEnd = (weekStart: Date): Date => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTime = (date: Date, lang: Locale) => {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  if (lang === "fr") return `${h.toString().padStart(2, "0")}:${m}`;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
};

type CopyStrings = (typeof copy)["en"] | (typeof copy)["fr"];

const formatDayLabel = (date: Date, lang: Locale, t: CopyStrings) => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) return t.today;
  if (isSameDay(date, tomorrow)) return t.tomorrow;

  const dayName = t.days[date.getDay()];
  const monthName = t.months[date.getMonth()];
  const day = date.getDate();
  return lang === "fr"
    ? `${dayName} ${day} ${monthName}`
    : `${dayName}, ${monthName} ${day}`;
};

/* ─── component ─── */
export default function CalendrierPage() {
  const { language, setLanguage } = useLanguage();
  const t = copy[language] ?? copy.fr;

  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<"all" | Gender>("all");
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [mounted, setMounted] = useState(false);
  const [shareUrl, setShareUrl] = useState("https://liprobakin.com/calendrier");

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  /* fetch partners */
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const snap = await getDocs(collection(firebaseDB, "partners"));
        setPartners(
          snap.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || "Partner",
            logo: doc.data().logo || undefined,
          }))
        );
      } catch {
        setPartners([]);
      }
    };
    fetchPartners();
  }, []);

  /* fetch games */
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const gamesRef = collection(firebaseDB, "games");
        const gamesQuery = query(gamesRef, orderBy("date", "asc"));
        const snapshot = await getDocs(gamesQuery);

        // Fetch teams
        const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
        const teamsMap = new Map<string, { wins: number; losses: number; name: string; city: string; logo?: string; gender?: string }>();
        teamsSnap.docs.forEach((doc) => {
          const data = doc.data();
          teamsMap.set(doc.id, {
            wins: data.wins || 0,
            losses: data.losses || 0,
            name: data.name || "",
            city: data.city || "",
            logo: data.logo || undefined,
            gender: data.gender || undefined,
          });
        });

        // Fetch referees
        const refsSnap = await getDocs(collection(firebaseDB, "referees"));
        const refsMap = new Map<string, string>();
        refsSnap.docs.forEach((doc) => {
          const data = doc.data();
          const name = `${data.firstName || ""} ${data.lastName || ""}`.trim();
          refsMap.set(doc.id, name || "Referee");
        });

        const now = new Date();
        const parsed: ScheduleGame[] = [];

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const dateObj = parseGameDateTime(data.date, data.time);
          if (!dateObj) return;

          // Skip completed/cancelled/hidden
          if (data.completed) return;
          if (data.isHiddenFromPublic) return;
          const status = String(data.status || "").toLowerCase();
          if (status === "cancelled" || status === "completed") return;

          // Only upcoming + a bit of grace
          const minutesSinceStart = (now.getTime() - dateObj.getTime()) / (1000 * 60);
          if (dateObj < now && minutesSinceStart > 120) return;

          const homeTeam = teamsMap.get(data.homeTeamId);
          const awayTeam = teamsMap.get(data.awayTeamId);

          const refs = (data.referees || [])
            .map((id: string) => refsMap.get(id))
            .filter(Boolean) as string[];

          parsed.push({
            id: doc.id,
            homeTeamName: data.homeTeamName || homeTeam?.name || "Home",
            awayTeamName: data.awayTeamName || awayTeam?.name || "Away",
            homeTeamLogo: data.homeTeamLogo || homeTeam?.logo,
            awayTeamLogo: data.awayTeamLogo || awayTeam?.logo,
            venue: data.venue || "TBD",
            gender: normalizeTeamGender(data.gender, "", "men") as Gender,
            dateTime: dateObj,
            time: formatTime(dateObj, language),
            status: status === "postponed" ? "Postponed" : "Upcoming",
            homeRecord: `${homeTeam?.wins ?? 0}-${homeTeam?.losses ?? 0}`,
            awayRecord: `${awayTeam?.wins ?? 0}-${awayTeam?.losses ?? 0}`,
            referees: refs,
          });
        });

        parsed.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
        setGames(parsed);
      } catch (err) {
        console.error("Error fetching games for calendar:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [language]);

  /* derived data */
  const filteredGames = useMemo(
    () => genderFilter === "all" ? games : games.filter((g) => g.gender === genderFilter),
    [games, genderFilter]
  );

  const isFrench = language === "fr";

  // Get available weeks
  const weeks = useMemo(() => {
    if (filteredGames.length === 0) return [];
    const weekMap = new Map<string, { start: Date; end: Date; games: ScheduleGame[] }>();

    filteredGames.forEach((game) => {
      const weekStart = getWeekStart(game.dateTime, isFrench);
      const key = weekStart.toISOString();
      if (!weekMap.has(key)) {
        weekMap.set(key, { start: weekStart, end: getWeekEnd(weekStart), games: [] });
      }
      weekMap.get(key)!.games.push(game);
    });

    return Array.from(weekMap.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [filteredGames, isFrench]);

  // Current week index (find the week that contains today, or the first upcoming)
  const currentWeekIndex = useMemo(() => {
    const today = new Date();
    const idx = weeks.findIndex((w) => today >= w.start && today <= w.end);
    return idx >= 0 ? idx : 0;
  }, [weeks]);

  const activeWeekIndex = useMemo(
    () => Math.min(Math.max(currentWeekIndex + selectedWeekOffset, 0), Math.max(weeks.length - 1, 0)),
    [currentWeekIndex, selectedWeekOffset, weeks.length]
  );

  const activeWeek = weeks[activeWeekIndex];

  // Group games by day
  const gamesByDay = useMemo(() => {
    if (!activeWeek) return [];
    const dayMap = new Map<string, { date: Date; games: ScheduleGame[] }>();
    activeWeek.games.forEach((game) => {
      const key = game.dateTime.toDateString();
      if (!dayMap.has(key)) {
        dayMap.set(key, { date: new Date(game.dateTime.getFullYear(), game.dateTime.getMonth(), game.dateTime.getDate()), games: [] });
      }
      dayMap.get(key)!.games.push(game);
    });
    return Array.from(dayMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activeWeek]);

  const canGoPrev = activeWeekIndex > 0;
  const canGoNext = activeWeekIndex < weeks.length - 1;

  const goToPrevWeek = useCallback(() => {
    if (canGoPrev) setSelectedWeekOffset((p) => p - 1);
  }, [canGoPrev]);

  const goToNextWeek = useCallback(() => {
    if (canGoNext) setSelectedWeekOffset((p) => p + 1);
  }, [canGoNext]);

  const weekLabel = activeWeek
    ? (() => {
        const today = new Date();
        const thisWeekStart = getWeekStart(today, isFrench);
        if (isSameDay(activeWeek.start, thisWeekStart)) return t.thisWeek;
        const nextWeekStart = new Date(thisWeekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        if (isSameDay(activeWeek.start, nextWeekStart)) return t.nextWeek;
        const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
        const startStr = activeWeek.start.toLocaleDateString(isFrench ? "fr-FR" : "en-US", opts);
        const endStr = activeWeek.end.toLocaleDateString(isFrench ? "fr-FR" : "en-US", opts);
        return `${t.weekOf} ${startStr} — ${endStr}`;
      })()
    : "";

  /* ─── Share & Download handlers ─── */
  const [shareTooltip, setShareTooltip] = useState(false);
  const shareTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleShare = useCallback(async () => {
    const url = shareUrl;

    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch { /* user cancelled */ }
    }

    // Fallback: copy URL
    try {
      await navigator.clipboard.writeText(url);
      setShareTooltip(true);
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
      shareTimeoutRef.current = setTimeout(() => setShareTooltip(false), 2000);
    } catch {
      // do nothing
    }
  }, [shareUrl]);

  const handleDownloadSchedule = useCallback(async () => {
    if (!activeWeek || activeWeek.games.length === 0) return;

    try {
      const W = 1200;
      const HEADER_H = 240;
      const GAME_ROW_H = 90; // taller rows for logos
      const GAP = 12;
      const PAD_X = 48;
      const FOOTER_H = 120;
      const TEASER_COUNT = Math.min(4, activeWeek.games.length);
      const gamesToDraw = activeWeek.games.slice(0, TEASER_COUNT);
      const hasMore = activeWeek.games.length > TEASER_COUNT;
      const BODY_H = gamesToDraw.length * (GAME_ROW_H + GAP);
      const MORE_BANNER_H = hasMore ? 70 : 0;
      const H = HEADER_H + BODY_H + MORE_BANNER_H + FOOTER_H + 40;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // ── Pre-load team logos ──
      const logoCache = new Map<string, HTMLImageElement>();
      const loadLogo = (src?: string): Promise<void> => {
        if (!src || logoCache.has(src)) return Promise.resolve();
        return new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => { logoCache.set(src, img); resolve(); };
          img.onerror = () => resolve();
          // Use proxy for external URLs
          img.src = /^https?:\/\//i.test(src) ? `/api/image-proxy?url=${encodeURIComponent(src)}` : src;
          setTimeout(resolve, 4000);
        });
      };
      await Promise.all([
        ...gamesToDraw.flatMap((g) => [loadLogo(g.awayTeamLogo), loadLogo(g.homeTeamLogo)]),
        loadLogo("/logos/liprobakin.png"),
      ]);
      const siteLogo = logoCache.get("/logos/liprobakin.png");

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, "#0c1222");
      bgGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle glow top-right
      const radGrad = ctx.createRadialGradient(W - 100, 80, 0, W - 100, 80, 400);
      radGrad.addColorStop(0, "rgba(59,130,246,0.08)");
      radGrad.addColorStop(1, "transparent");
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Header ──
      // Draw liprobakin logo centered
      const logoSize = 96;
      const logoX = W / 2 - logoSize / 2;
      const logoY = 20;
      if (siteLogo) {
        // Circle-clipped logo with glow
        ctx.save();
        ctx.shadowColor = "rgba(59,130,246,0.3)";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.drawImage(siteLogo, logoX, logoY, logoSize, logoSize);
        ctx.restore();
        // Logo border ring
        ctx.strokeStyle = "rgba(59,130,246,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Text centered below logo
      ctx.textAlign = "center";

      ctx.font = "bold 48px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(isFrench ? "Calendrier" : "Schedule", W / 2, logoY + logoSize + 72);

      ctx.font = "500 20px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#60a5fa";
      ctx.fillText(weekLabel, W / 2, logoY + logoSize + 100);

      const gamesCountText = `${activeWeek.games.length} ${isFrench ? "matchs" : "games"}`;
      ctx.font = "600 16px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(gamesCountText, W / 2, logoY + logoSize + 124);

      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(PAD_X, HEADER_H - 4, W - PAD_X * 2, 1);

      // ── Helper: draw circle-clipped logo ──
      const drawLogo = (img: HTMLImageElement | undefined, cx: number, cy: number, r: number) => {
        if (!img) {
          // Placeholder circle
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        // White circle background for transparency
        ctx.fillStyle = "#e2e8f0";
        ctx.fill();
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
        // Border
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      };

      // ── Game rows ──
      let y = HEADER_H + 12;
      const LOGO_R = 22; // logo radius

      for (const game of gamesToDraw) {
        // Row background
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        const rowRadius = 16;
        ctx.beginPath();
        ctx.roundRect(PAD_X, y, W - PAD_X * 2, GAME_ROW_H, rowRadius);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const rowCenterY = y + GAME_ROW_H / 2;

        // ── Left section: Date + Time + Gender ──
        // Date
        const dateLabel = `${game.dateTime.getDate()}/${(game.dateTime.getMonth() + 1).toString().padStart(2, "0")}`;
        ctx.font = "500 13px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText(dateLabel, PAD_X + 20, rowCenterY - 8);

        // Time
        ctx.font = "bold 18px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        const timeStr = formatTime(game.dateTime, language);
        ctx.fillText(timeStr, PAD_X + 20, rowCenterY + 14);

        // Gender pill
        const pillX = PAD_X + 120;
        const isWomen = game.gender === "women";
        ctx.fillStyle = isWomen ? "rgba(236,72,153,0.15)" : "rgba(59,130,246,0.15)";
        const pillW = 30, pillH = 22, pillY = rowCenterY - pillH / 2;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 8);
        ctx.fill();
        ctx.font = "bold 12px Inter, system-ui, sans-serif";
        ctx.fillStyle = isWomen ? "#f472b6" : "#60a5fa";
        ctx.textAlign = "center";
        ctx.fillText(isWomen ? "W" : "M", pillX + pillW / 2, pillY + 16);
        ctx.textAlign = "left";

        // ── Center: Away Logo + Name — VS — Home Name + Logo ──
        const centerX = W / 2;
        const vsGap = 32;

        // Measure team name widths
        ctx.font = "600 20px Inter, system-ui, sans-serif";
        const awayNameW = ctx.measureText(game.awayTeamName).width;
        const homeNameW = ctx.measureText(game.homeTeamName).width;

        ctx.font = "500 14px Inter, system-ui, sans-serif";
        const vsW = ctx.measureText("VS").width;

        // Away: logo then name, right-aligned to center
        const awayBlockW = LOGO_R * 2 + 10 + awayNameW; // logo + gap + text
        const awayStartX = centerX - vsGap - vsW / 2 - awayBlockW;

        const awayLogoImg = game.awayTeamLogo ? logoCache.get(game.awayTeamLogo) : undefined;
        drawLogo(awayLogoImg, awayStartX + LOGO_R, rowCenterY, LOGO_R);

        ctx.font = "600 20px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(game.awayTeamName, awayStartX + LOGO_R * 2 + 10, rowCenterY + 7);

        // VS
        ctx.font = "500 14px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.fillText("VS", centerX, rowCenterY + 5);
        ctx.textAlign = "left";

        // Home: name then logo, left-aligned from center
        const homeStartX = centerX + vsGap + vsW / 2;

        ctx.font = "600 20px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(game.homeTeamName, homeStartX, rowCenterY + 7);

        const homeLogoImg = game.homeTeamLogo ? logoCache.get(game.homeTeamLogo) : undefined;
        drawLogo(homeLogoImg, homeStartX + homeNameW + 10 + LOGO_R, rowCenterY, LOGO_R);

        // ── Right: Venue ──
        ctx.font = "400 13px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "right";
        const venueDisplay = game.venue.length > 30 ? game.venue.slice(0, 28) + "…" : game.venue;
        ctx.fillText(venueDisplay, W - PAD_X - 20, rowCenterY + 5);
        ctx.textAlign = "left";

        y += GAME_ROW_H + GAP;
      }

      // ── "Voir plus" banner if more games ──
      if (hasMore) {
        const bannerY = y + 8;
        const remaining = activeWeek.games.length - TEASER_COUNT;

        // Gradient banner
        const bannerGrad = ctx.createLinearGradient(PAD_X, bannerY, W - PAD_X, bannerY);
        bannerGrad.addColorStop(0, "rgba(59,130,246,0.08)");
        bannerGrad.addColorStop(0.5, "rgba(251,146,60,0.08)");
        bannerGrad.addColorStop(1, "rgba(59,130,246,0.08)");
        ctx.fillStyle = bannerGrad;
        ctx.beginPath();
        ctx.roundRect(PAD_X, bannerY, W - PAD_X * 2, MORE_BANNER_H - 8, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
        ctx.textAlign = "center";
        ctx.font = "600 20px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#fb923c";
        const moreText = isFrench
          ? `+ ${remaining} ${remaining === 1 ? "match" : "matchs"} de plus`
          : `+ ${remaining} more ${remaining === 1 ? "game" : "games"}`;
        ctx.fillText(moreText, W / 2, bannerY + 30);

        ctx.font = "500 16px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#60a5fa";
        ctx.fillText(isFrench ? "Voir plus sur liprobakin.com/calendrier" : "See more at liprobakin.com/calendrier", W / 2, bannerY + 54);
        ctx.textAlign = "left";
      }

      // ── Footer branding ──
      const footerY = H - FOOTER_H + 20;
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(0, footerY - 20, W, FOOTER_H + 20);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(PAD_X, footerY - 20, W - PAD_X * 2, 1);

      ctx.font = "bold 36px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fb923c";
      ctx.fillText("www.liprobakin.com", W / 2, footerY + 30);

      ctx.font = "400 16px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(isFrench ? "Ligue Provinciale de Basketball de Kinshasa" : "Kinshasa Provincial Basketball League", W / 2, footerY + 58);
      ctx.textAlign = "left";

      // Card border
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 2;
      const cR = 20;
      ctx.beginPath();
      ctx.moveTo(cR, 0);
      ctx.lineTo(W - cR, 0);
      ctx.arcTo(W, 0, W, cR, cR);
      ctx.lineTo(W, H - cR);
      ctx.arcTo(W, H, W - cR, H, cR);
      ctx.lineTo(cR, H);
      ctx.arcTo(0, H, 0, H - cR, cR);
      ctx.lineTo(0, cR);
      ctx.arcTo(0, 0, cR, 0, cR);
      ctx.closePath();
      ctx.stroke();

      // Export
      const fileName = `liprobakin-calendrier-${weekLabel.replace(/\s+/g, "-").toLowerCase()}.png`;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

      if (!blob) {
        const dataUrl = canvas.toDataURL("image/png");
        const fallbackLink = document.createElement("a");
        fallbackLink.href = dataUrl;
        fallbackLink.download = fileName;
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
        return;
      }

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const canShareFile =
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        navigator.canShare?.({ files: [new File([blob], fileName, { type: "image/png" })] });

      if (isMobile && canShareFile) {
        try {
          const file = new File([blob], fileName, { type: "image/png" });
          await navigator.share({
            title: isFrench ? "Calendrier Liprobakin" : "Liprobakin Schedule",
            files: [file],
          });
          return;
        } catch {
          // fall through to URL fallback
        }
      }

      const url = URL.createObjectURL(blob);

      if (isMobile) {
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      alert(isFrench ? "Échec du téléchargement." : "Download failed.");
    }
  }, [activeWeek, weekLabel, isFrench, language]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4 md:gap-8 px-3 sm:px-6 py-4 sm:py-5 md:px-12 md:pl-16">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl font-semibold tracking-[0.2em] sm:tracking-[0.3em]">
            <Image
              src="/logos/liprobakin.png"
              alt="Liprobakin logo"
              width={36}
              height={36}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-white/20 bg-white/5 object-cover"
              priority
            />
            <span className="hidden xs:inline sm:inline">{t.brand}</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 text-white/90 shadow-2xl transition-all duration-700 ease-out focus:outline-none focus:ring-2 focus:ring-white/20 lg:hidden active:scale-95"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-expanded={mobileNavOpen}
            aria-controls="cal-mobile-nav"
            aria-label="Toggle navigation menu"
          >
            <div className={`absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 via-transparent to-white/5 transition-all duration-500 ${mobileNavOpen ? "opacity-100" : "opacity-60"}`} />
            <div className={`absolute inset-0 rounded-xl ring-1 ring-white/20 transition-all duration-500 ${mobileNavOpen ? "ring-white/40 shadow-lg shadow-white/20" : "ring-white/10"}`} />
            <div className="relative w-6 h-6 flex items-center justify-center">
              <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${mobileNavOpen ? "rotate-180 opacity-0" : "rotate-0 opacity-100"}`}>
                <div className="w-6 h-6 grid grid-cols-2 grid-rows-2 gap-1 p-1">
                  <div className="bg-white/80 rounded-sm" />
                  <div className="bg-white/60 rounded-sm" />
                  <div className="bg-white/60 rounded-sm" />
                  <div className="bg-white/80 rounded-sm" />
                </div>
              </div>
              <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${mobileNavOpen ? "rotate-0 opacity-100" : "rotate-180 opacity-0"}`}>
                <div className="relative w-6 h-6 flex items-center justify-center">
                  <span className="absolute w-4 h-0.5 bg-white/90 rounded-full transform rotate-45" />
                  <span className="absolute w-4 h-0.5 bg-white/90 rounded-full transform -rotate-45" />
                </div>
              </div>
            </div>
          </button>

          {/* Desktop nav */}
          <div className="hidden gap-8 text-xs font-medium uppercase tracking-[0.3em] text-slate-300 lg:flex">
            {navSections.map((section) => (
              <Link
                key={section}
                href={`/#${section.toLowerCase()}`}
                className="transition hover:text-white hover:scale-105 whitespace-nowrap"
              >
                {t.nav[section.toLowerCase() as keyof typeof t.nav] ?? section}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileNavOpen && (
          <div
            id="cal-mobile-nav"
            className="border-t border-white/10 bg-black/90 backdrop-blur-xl px-6 py-4 lg:hidden animate-in slide-in-from-top duration-200"
          >
            <div className="flex flex-col gap-3">
              {navSections.map((section) => (
                <Link
                  key={section}
                  href={`/#${section.toLowerCase()}`}
                  className="text-sm font-medium uppercase tracking-[0.2em] text-slate-300 transition hover:text-white py-2"
                  onClick={() => setMobileNavOpen(false)}
                >
                  {t.nav[section.toLowerCase() as keyof typeof t.nav] ?? section}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero Header ─── */}
      <header className="relative overflow-hidden border-b border-white/5">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-slate-950 to-orange-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_60%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/5 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-12 py-12 sm:py-16 md:py-20">
          {/* Breadcrumb */}
          <div className={`flex items-center gap-2 text-sm text-slate-400 mb-6 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <Link href="/" className="hover:text-white transition-colors">{t.backHome}</Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white">{t.nav.schedule}</span>
          </div>

          <div className={`transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <p className="text-xs uppercase tracking-[0.4em] text-blue-400 mb-3">{t.nav.schedule}</p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">
              {t.pageTitle}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl">{t.pageSubtitle}</p>
          </div>

          {/* Stats row */}
          <div className={`mt-8 flex flex-wrap items-center gap-6 transition-all duration-700 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{games.length}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{language === "fr" ? "Matchs à venir" : "Upcoming Games"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold text-white">
                  {filteredGames.length > 0 ? (
                    `${filteredGames[0].dateTime.getDate()} ${filteredGames[0].dateTime.toLocaleString(isFrench ? 'fr-FR' : 'en-US', { month: 'short' })} - ${filteredGames[filteredGames.length - 1].dateTime.getDate()} ${filteredGames[filteredGames.length - 1].dateTime.toLocaleString(isFrench ? 'fr-FR' : 'en-US', { month: 'short' })}`
                  ) : (
                    "-"
                  )}
                </p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{language === "fr" ? "Période prévue" : "Scheduled Period"}</p>
              </div>
            </div>

            {/* Share & Download buttons */}
            <div className="flex items-center gap-2 ml-auto">
              {/* WhatsApp */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${isFrench ? "Calendrier Liprobakin" : "Liprobakin Schedule"}${activeWeek ? ` - ${weekLabel}` : ""}\n\n${shareUrl}`)}`}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="group inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all duration-300 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400 hover:scale-105 active:scale-95"
                aria-label="WhatsApp"
              >
                <svg className="w-4.5 h-4.5" viewBox="0 0 32 32" fill="currentColor"><path fillRule="evenodd" d="M16.21 4.41C9.973 4.41 4.917 9.465 4.917 15.7c0 2.134.592 4.13 1.62 5.832L4.5 27.59l6.25-2.002a11.24 11.24 0 0 0 5.46 1.404c6.234 0 11.29-5.055 11.29-11.29 0-6.237-5.056-11.292-11.29-11.292m0 20.69c-1.91 0-3.69-.57-5.173-1.553l-3.61 1.156 1.173-3.49a9.35 9.35 0 0 1-1.79-5.512c0-5.18 4.217-9.4 9.4-9.4s9.397 4.22 9.397 9.4c0 5.188-4.214 9.4-9.398 9.4zm5.293-6.832c-.284-.155-1.673-.906-1.934-1.012-.265-.106-.455-.16-.658.12s-.78.91-.954 1.096c-.176.186-.345.203-.628.048-.282-.154-1.2-.494-2.264-1.517-.83-.795-1.373-1.76-1.53-2.055s0-.445.15-.584c.134-.124.3-.326.45-.488.15-.163.203-.28.306-.47.104-.19.06-.36-.005-.506-.066-.147-.59-1.587-.81-2.173-.218-.586-.46-.498-.63-.505-.168-.007-.358-.038-.55-.045-.19-.007-.51.054-.78.332-.277.274-1.05.943-1.1 2.362-.055 1.418.926 2.826 1.064 3.023.137.2 1.874 3.272 4.76 4.537 2.888 1.264 2.9.878 3.43.85.53-.027 1.734-.633 2-1.297s.287-1.24.22-1.363c-.07-.123-.26-.203-.54-.357z" clipRule="evenodd"/></svg>
              </a>
              {/* Facebook */}
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="group inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all duration-300 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 hover:scale-105 active:scale-95"
                aria-label="Facebook"
              >
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
              </a>
              {/* Copy link */}
              <div className="relative">
                <button
                  type="button"
                  onClick={handleShare}
                  className="group inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all duration-300 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-300 hover:scale-105 active:scale-95"
                  aria-label={isFrench ? "Copier le lien" : "Copy link"}
                >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </button>
                {shareTooltip && (
                  <span className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg animate-fade-in">
                    {isFrench ? "Lien copié !" : "Link copied!"}
                  </span>
                )}
              </div>

              {/* Download */}
              <button
                type="button"
                onClick={handleDownloadSchedule}
                disabled={!activeWeek || activeWeek.games.length === 0}
                className="group inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all duration-300 hover:bg-orange-500/10 hover:border-orange-500/30 hover:text-orange-300 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={isFrench ? "Télécharger l'aperçu" : "Download preview"}
              >
                <svg className="w-4.5 h-4.5 transition-transform duration-300 group-hover:translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v11" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M4 20h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12 py-8 sm:py-12">
        {/* Filters & Week Navigation */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 transition-all duration-700 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {/* Gender filter pills */}
          <div className="flex gap-2">
            {(["all", "men", "women"] as const).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGenderFilter(g);
                  setSelectedWeekOffset(0);
                }}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all duration-300 ${
                  genderFilter === g
                    ? "bg-white text-slate-950 border-white shadow-lg shadow-white/20"
                    : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                {g === "all" ? t.allGender : g === "men" ? t.men : t.women}
              </button>
            ))}
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPrevWeek}
              disabled={!canGoPrev}
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous week"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="min-w-[200px] text-center">
              <p className="text-sm sm:text-base font-semibold text-white">{weekLabel}</p>
              {activeWeek && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {activeWeek.games.length} {language === "fr" ? "match(s)" : "game(s)"}
                </p>
              )}
            </div>

            <button
              onClick={goToNextWeek}
              disabled={!canGoNext}
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next week"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Week quick-jump strip (desktop) */}
        {weeks.length > 1 && (
          <div className={`hidden md:flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide transition-all duration-700 delay-400 ${mounted ? "opacity-100" : "opacity-0"}`}>
            {weeks.map((week, idx) => {
              const isActive = idx === activeWeekIndex;
              const today = new Date();
              const isCurrentWeek = today >= week.start && today <= week.end;
              const label = week.start.toLocaleDateString(isFrench ? "fr-FR" : "en-US", { month: "short", day: "numeric" });
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedWeekOffset(idx - currentWeekIndex)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium border transition-all duration-300 ${
                    isActive
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-lg shadow-blue-500/10"
                      : isCurrentWeek
                      ? "bg-orange-500/10 text-orange-300 border-orange-500/20 hover:bg-orange-500/20"
                      : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-[10px] opacity-60">({week.games.length})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
              <div className="absolute inset-0 rounded-full border-2 border-t-blue-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-t-orange-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
            </div>
            <p className="text-sm text-slate-400 animate-pulse">{language === "fr" ? "Chargement du calendrier..." : "Loading schedule..."}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && gamesByDay.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-12 sm:p-16 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-lg text-slate-300 font-medium">{t.noGames}</p>
            <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t.backHome}
            </Link>
          </div>
        )}

        {/* Games by day */}
        {!loading && gamesByDay.length > 0 && (
          <div className="space-y-8">
            {gamesByDay.map((day, dayIdx) => (
              <div
                key={day.date.toISOString()}
                className={`transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${400 + dayIdx * 100}ms` }}
              >
                {/* Day header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border ${
                      isSameDay(day.date, new Date())
                        ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                        : "bg-white/5 border-white/10 text-white"
                    }`}>
                      <span className="text-lg sm:text-xl font-bold">{day.date.getDate()}</span>
                    </div>
                    <div>
                      <p className={`text-sm sm:text-base font-semibold ${isSameDay(day.date, new Date()) ? "text-blue-300" : "text-white"}`}>
                        {formatDayLabel(day.date, language, t)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {day.games.length} {language === "fr" ? "match(s)" : "game(s)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                </div>

                {/* Game cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {day.games.map((game, gameIdx) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      language={language}
                      t={t}
                      index={gameIdx}
                      mounted={mounted}
                      dayIdx={dayIdx}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── Partners ─── */}
      {partners.length > 0 && (
        <div className="border-t border-white/5 bg-black/30 py-7">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-center gap-7 sm:gap-10 flex-wrap">
              {partners.slice(0, 6).map((partner) => (
                <div key={partner.id} className="flex-shrink-0 h-9 sm:h-11 opacity-60 hover:opacity-100 transition-opacity">
                  {partner.logo ? (
                    <div className="relative h-full" style={{ width: "4.5rem" }}>
                      <Image src={partner.logo} alt={partner.name} fill className="object-contain" />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 font-medium">{partner.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/10 bg-black/50 py-6 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-center text-xs uppercase tracking-[0.3em] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <p>{t.footerTagline}</p>
            <span className="hidden sm:inline text-slate-600">•</span>
            <a
              href="https://www.landrypalata.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-[10px] tracking-[0.4em] text-slate-500 hover:text-orange-400 transition-all duration-300"
            >
              <span className="uppercase">Built by</span>
              <span className="relative">
                <span className="font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent group-hover:from-orange-300 group-hover:via-amber-400 group-hover:to-orange-500 transition-all duration-300">
                  Landry Palata
                </span>
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-gradient-to-r from-orange-400 to-amber-500 group-hover:w-full transition-all duration-300" />
              </span>
            </a>
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{t.languageLabel}</span>
              <div className="flex gap-2">
                {(["en", "fr"] as Locale[]).map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setLanguage(locale)}
                    className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] ${
                      language === locale ? "border-white text-white" : "border-white/30 text-slate-400"
                    }`}
                  >
                    {locale.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="https://www.facebook.com/Liprobakin/" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/5 transition hover:border-white hover:bg-white/10" aria-label="Facebook">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.5 22v-8.01H16l.5-3H13.5V9.5c0-.87.29-1.5 1.63-1.5H16V5.1c-.23-.03-1.02-.1-2.02-.1-2.1 0-3.48 1.28-3.48 3.67v2.32H8v3h2.5V22h3z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/liprobakin_league/" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/5 transition hover:border-white hover:bg-white/10" aria-label="Instagram">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="5" ry="5" /><path d="M16 11.37a4 4 0 11-7.93 1.17 4 4 0 017.93-1.17z" /><path d="M17.5 6.5h.01" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Game Card Component ─── */
function GameCard({
  game,
  language,
  t,
  index,
  mounted,
  dayIdx,
}: {
  game: ScheduleGame;
  language: Locale;
  t: CopyStrings;
  index: number;
  mounted: boolean;
  dayIdx: number;
}) {
  const [hovered, setHovered] = useState(false);
  const isToday = isSameDay(game.dateTime, new Date());

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative rounded-2xl border overflow-hidden transition-all duration-500 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${
        isToday
          ? "border-blue-500/30 bg-gradient-to-br from-blue-950/50 via-slate-900/90 to-blue-950/30 shadow-lg shadow-blue-500/5"
          : "border-white/10 bg-slate-900/60 hover:border-white/20 hover:bg-slate-900/80"
      }`}
      style={{ transitionDelay: `${500 + dayIdx * 100 + index * 80}ms` }}
    >
      {/* Glow effect on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br from-blue-500/5 to-orange-500/5 transition-opacity duration-500 ${hovered ? "opacity-100" : "opacity-0"}`} />

      {/* Today badge */}
      {isToday && (
        <div className="absolute top-3 right-3 z-10">
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full animate-pulse">
            {t.today}
          </span>
        </div>
      )}

      <div className="relative p-4 sm:p-5">
        {/* Top: Time & Gender & Venue */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">{game.time}</span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            game.gender === "women"
              ? "bg-pink-500/10 text-pink-300 border-pink-500/20"
              : "bg-blue-500/10 text-blue-300 border-blue-500/20"
          }`}>
            {game.gender === "women" ? "W" : "M"}
          </span>
        </div>

        {/* Teams Section */}
        <div className="space-y-3 relative z-10">
          {/* Away team */}
          <Link
            href={`/team/${encodeURIComponent(game.awayTeamName)}?gender=${game.gender}`}
            className="flex items-center gap-3 group/team cursor-pointer"
          >
            <div className="relative flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 opacity-0 blur-md transition-all duration-500 group-hover/team:opacity-40 group-hover/team:scale-125" />
              <div className="relative w-full h-full rounded-full border border-white/15 bg-white/90 overflow-hidden flex items-center justify-center transition-all duration-500 group-hover/team:scale-110 group-hover/team:rotate-[360deg] group-hover/team:border-blue-400/50 group-hover/team:shadow-lg group-hover/team:shadow-blue-500/20">
                {game.awayTeamLogo ? (
                  <Image
                    src={game.awayTeamLogo}
                    alt={game.awayTeamName}
                    width={48}
                    height={48}
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-700">
                    {game.awayTeamName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 transition-transform duration-300 group-hover/team:translate-x-1">
              <p className="text-sm sm:text-base font-semibold text-white truncate group-hover/team:text-blue-200 transition-colors">
                {game.awayTeamName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] font-medium text-slate-500 bg-white/5 px-1.5 py-0.5 rounded group-hover/team:bg-white/10 group-hover/team:text-slate-300 transition-colors">{game.awayRecord}</p>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-blue-400/80 bg-blue-400/10 opacity-0 -translate-x-2 group-hover/team:opacity-100 group-hover/team:translate-x-0 transition-all duration-300 delay-75">{language === "fr" ? "Visiteur" : "Away"}</span>
              </div>
            </div>
          </Link>

          {/* VS divider */}
          <div className="flex items-center gap-2 pl-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
              hovered
                ? "bg-gradient-to-br from-blue-500 to-orange-500 text-white scale-110 shadow-lg shadow-orange-500/20"
                : "bg-white/10 text-slate-400"
            }`}>
              <span className="text-[10px] font-black tracking-wider">{t.vs}</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
            <div className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-500 ${hovered ? "opacity-100 text-orange-400" : "opacity-0 text-transparent"}`}>
              {game.status}
            </div>
          </div>

          {/* Home team */}
          <Link
            href={`/team/${encodeURIComponent(game.homeTeamName)}?gender=${game.gender}`}
            className="flex items-center gap-3 group/team cursor-pointer"
          >
            <div className="relative flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 opacity-0 blur-md transition-all duration-500 group-hover/team:opacity-40 group-hover/team:scale-125" />
              <div className="relative w-full h-full rounded-full border border-white/15 bg-white/90 overflow-hidden flex items-center justify-center transition-all duration-500 group-hover/team:scale-110 group-hover/team:rotate-[360deg] group-hover/team:border-orange-400/50 group-hover/team:shadow-lg group-hover/team:shadow-orange-500/20">
                {game.homeTeamLogo ? (
                  <Image
                    src={game.homeTeamLogo}
                    alt={game.homeTeamName}
                    width={48}
                    height={48}
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-700">
                    {game.homeTeamName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 transition-transform duration-300 group-hover/team:translate-x-1">
              <p className="text-sm sm:text-base font-semibold text-white truncate group-hover/team:text-orange-200 transition-colors">
                {game.homeTeamName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] font-medium text-slate-500 bg-white/5 px-1.5 py-0.5 rounded group-hover/team:bg-white/10 group-hover/team:text-slate-300 transition-colors">{game.homeRecord}</p>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-orange-400/80 bg-orange-400/10 opacity-0 -translate-x-2 group-hover/team:opacity-100 group-hover/team:translate-x-0 transition-all duration-300 delay-75">{language === "fr" ? "Domicile" : "Home"}</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Bottom: Venue & Referees */}
        <div className="mt-4 pt-3 border-t border-white/5 relative z-10 transition-colors duration-300 group-hover:border-white/10">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 transition-colors duration-300 group-hover:text-slate-300">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{game.venue}</span>
          </div>
          {game.referees.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5 transition-colors duration-300 group-hover:text-slate-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{t.ref}: {game.referees.join(", ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom accent line */}
      <div className={`h-0.5 transition-all duration-500 ${
        hovered
          ? "bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500"
          : isToday
          ? "bg-gradient-to-r from-blue-500/50 to-blue-500/0"
          : "bg-transparent"
      }`} />
    </div>
  );
}
