"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { addDoc, arrayRemove, arrayUnion, collection, collectionGroup, deleteDoc, doc, query, orderBy, limit, getDocs, onSnapshot, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase/firestore";
import { normalizeTeamGender } from "@/lib/team-gender";
import { resolveTeamLogo } from "@/lib/team-logo";
import { fetchHomeProjectorPlayers, HOME_PROJECTOR_COLLECTION, HOME_PROJECTOR_DOC } from "@/lib/homeProjectorCache";
import { parseCongoDateTime, CONGO_TIMEZONE } from "@/lib/congo-time";
import { useAuth } from "@/contexts/AuthContext";
import { canonicalArticleShareUrl } from "./articleMetadata";
import { useLanguage } from "@/contexts/LanguageContext";
import ArticleContent from "@/components/ArticleContent";
import MentionedEntities from "@/components/MentionedEntities";
import {
  conferenceStandings,
  conferenceStandingsWomen,
  navSections,
  spotlightPlayers,
  spotlightPlayersWomen,
  leagueCommittee,
  franchises as ssrMenFranchises,
  franchisesWomen as ssrWomenFranchises,
} from "@/data/febaco";
import type { FeaturedMatchup, Franchise, RosterPlayer, SpotlightPlayer } from "@/data/febaco";

const AuthModal = dynamic(() => import("@/components/AuthModal"), {
  ssr: false,
  loading: () => null,
});

const PlayerProfilePopup = dynamic(() => import("@/components/PlayerProfilePopup"), {
  ssr: false,
  loading: () => null,
});

type MatchupReferee = {
  id: string;
  fullName: string;
  displayName: string;
  headshot?: string;
};

type EnhancedMatchup = FeaturedMatchup & {
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  livePeriod?: string;
  liveClock?: string;
  gender?: "men" | "women";
  referees?: MatchupReferee[];
  dateTime?: string;
  liveStreamUrl?: string;
  isStartingSoon?: boolean;
  activeTimeout?: {
    side: "home" | "away";
    startedAt?: unknown;
  } | null;
};

type NewsArticle = {
  id: string;
  title: string; // French (base/default)
  title_en?: string; // English translation
  summary: string; // French (base/default)
  summary_en?: string; // English translation
  category: string;
  headline: string; // French (base/default)
  headline_en?: string; // English translation
  imageUrl?: string;
  additionalMedia?: {
    type: "image" | "video";
    url: string;
    size?: "full" | "half" | "third";
    align?: "left" | "center" | "right";
    textWrap?: AdditionalMediaWrap;
    wrapSide?: AdditionalMediaWrapSide;
    height?: number;
    order?: number;
    widthPercent?: number;
    offsetX?: number;
    offsetY?: number;
    distanceTop?: number;
    distanceRight?: number;
    distanceBottom?: number;
    distanceLeft?: number;
  }[];
  additionalImageUrls?: string[];
  videoUrl?: string;
  videoTrimStart?: number;
  videoTrimEnd?: number;
  videoScale?: number;
  videoOffsetX?: number;
  videoOffsetY?: number;
  imagePosition?: number;
  createdAt: Date | null;
  author?: string; // Author name
  authorPhoto?: string; // Author profile photo URL
  isPaused?: boolean;
};

type AdditionalMediaSize = "full" | "half" | "third";
type AdditionalMediaAlign = "left" | "center" | "right";
type CanonicalAdditionalMediaWrap = "inline" | "square" | "tight" | "through" | "topBottom" | "behind" | "front";
type AdditionalMediaWrap = CanonicalAdditionalMediaWrap | "wrap" | "break";
type AdditionalMediaWrapSide = "bothSides" | "leftOnly" | "rightOnly" | "largestOnly";
type NormalizedAdditionalMediaItem = {
  type: "image" | "video";
  url: string;
  size: AdditionalMediaSize;
  align: AdditionalMediaAlign;
  textWrap: AdditionalMediaWrap;
  wrapSide: AdditionalMediaWrapSide;
  height: number;
  order: number;
  widthPercent: number;
  offsetX: number;
  offsetY: number;
  distanceTop: number;
  distanceRight: number;
  distanceBottom: number;
  distanceLeft: number;
};

type ArticleComment = {
  id: string;
  articleId: string;
  name: string;
  message: string;
  createdAt: Date | null;
  likesCount: number;
  likedByCurrentUser: boolean;
  canDelete: boolean;
};

type ArticleCommentReply = {
  id: string;
  articleId: string;
  commentId: string;
  name: string;
  message: string;
  createdAt: Date | null;
};

const MIN_ADDITIONAL_MEDIA_HEIGHT = 160;
const MAX_ADDITIONAL_MEDIA_HEIGHT = 640;
const DEFAULT_ADDITIONAL_MEDIA_HEIGHT = 320;
const MIN_ADDITIONAL_MEDIA_WIDTH = 35;
const MAX_ADDITIONAL_MEDIA_WIDTH = 100;
const DEFAULT_ADDITIONAL_MEDIA_WIDTH = 100;
const MIN_ADDITIONAL_MEDIA_OFFSET_X = -5000;
const MAX_ADDITIONAL_MEDIA_OFFSET_X = 5000;
const MIN_ADDITIONAL_MEDIA_OFFSET_Y = -5000;
const MAX_ADDITIONAL_MEDIA_OFFSET_Y = 5000;
const ARTICLE_COMMENT_COOLDOWN_MS = 20_000;
const ARTICLE_COMMENT_DAILY_LIMIT = 10;
const ARTICLE_COMMENT_SPAM_TERMS = ["http://", "https://", "www.", "whatsapp", "telegram", "bitcoin", "casino"];
const ARTICLE_COMMENT_CLIENT_TOKEN_KEY = "article-comment-client-token";
const ARTICLE_COMMENT_PROFANITY_TERMS = [
  "fuck",
  "fucking",
  "fucker",
  "fuckoff",
  "fuk",
  "fck",
  "shit",
  "shitty",
  "bullshit",
  "dipshit",
  "bitch",
  "bitches",
  "sonofabitch",
  "sob",
  "asshole",
  "ass",
  "jackass",
  "dumbass",
  "bastard",
  "dick",
  "dickhead",
  "cock",
  "penis",
  "pussy",
  "cunt",
  "motherfucker",
  "motherfucking",
  "mf",
  "whore",
  "slut",
  "hoe",
  "nigger",
  "nigga",
  "retard",
  "idiot",
  "stupid",
  "pute",
  "putain",
  "put1",
  "ptn",
  "salope",
  "salop",
  "salaud",
  "salaude",
  "enculer",
  "connard",
  "conasse",
  "encule",
  "batard",
  "batarde",
  "niquetamere",
  "nique",
  "ta mere",
  "tamere",
  "tg",
  "ta gueule",
  "tagueule",
  "fdtg",
  "fermetagueule",
  "merde",
  "merdique",
  "bordel",
  "sacamerde",
  "fdp",
  "filsdepute",
  "filledepute",
  "enculede",
  "enculedetamer",
  "pd",
  "tapette",
  "gouine",
  "negro",
  "zoba",
  "zozo",
  "ndoki",
  "libolo",
  "mbwa",
  "nyama",
  "ebende",
  "voleur",
  "mabanga",
];

const normalizeCommentModerationInput = (input: string): string =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const getOrCreateArticleCommentClientToken = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(ARTICLE_COMMENT_CLIENT_TOKEN_KEY);
  if (existing) {
    return existing;
  }

  const generated = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(ARTICLE_COMMENT_CLIENT_TOKEN_KEY, generated);
  return generated;
};
const MAX_FIXED_MEDIA_TRANSLATE_X = 5000;
const MAX_FIXED_MEDIA_TRANSLATE_Y = 5000;
const MIN_MEDIA_TEXT_DISTANCE = 0;
const MAX_MEDIA_TEXT_DISTANCE = 48;
const DEFAULT_MEDIA_TEXT_DISTANCE = 12;

// DRC (Kinshasa) timezone - UTC+1 (re-use the constant from congo-time)
const DRC_TIMEZONE = CONGO_TIMEZONE;

// Helper to get current time in DRC timezone
const getDRCNow = (): Date => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: DRC_TIMEZONE }));
};

const isTrustedNewsMediaUrl = (url?: string | null) => {
  if (!url) return false;
  const normalized = url.trim();
  if (!normalized) return false;
  return normalized.includes("firebasestorage.googleapis.com") || normalized.includes("storage.googleapis.com");
};

const normalizeWrapMode = (wrap?: AdditionalMediaWrap): CanonicalAdditionalMediaWrap => {
  if (wrap === "wrap") return "square";
  if (wrap === "break") return "topBottom";
  if (wrap === "behind" || wrap === "front") return "square";
  if (wrap === "inline" || wrap === "square" || wrap === "tight" || wrap === "through" || wrap === "topBottom") {
    return wrap;
  }
  return "inline";
};

const normalizeWrapSide = (side?: AdditionalMediaWrapSide): AdditionalMediaWrapSide => {
  if (side === "leftOnly" || side === "rightOnly" || side === "largestOnly" || side === "bothSides") {
    return side;
  }
  return "bothSides";
};

const normalizeTextDistance = (value?: number): number => {
  return Math.max(MIN_MEDIA_TEXT_DISTANCE, Math.min(MAX_MEDIA_TEXT_DISTANCE, Number(value ?? DEFAULT_MEDIA_TEXT_DISTANCE)));
};

const normalizeAdditionalMediaItem = (
  item: Partial<NormalizedAdditionalMediaItem> | null | undefined,
  fallbackIndex: number
): NormalizedAdditionalMediaItem | null => {
  if (!item) return null;
  const type = item.type === "video" ? "video" : item.type === "image" ? "image" : null;
  const url = typeof item.url === "string" ? item.url.trim() : "";
  if (!type || !isTrustedNewsMediaUrl(url)) return null;
  const size: AdditionalMediaSize = item.size === "half" || item.size === "third" ? item.size : "full";
  const align: AdditionalMediaAlign = item.align === "left" || item.align === "right" ? item.align : "center";
  const textWrap = normalizeWrapMode(item.textWrap);
  const wrapSide = normalizeWrapSide(item.wrapSide);
  const height = Math.max(
    MIN_ADDITIONAL_MEDIA_HEIGHT,
    Math.min(MAX_ADDITIONAL_MEDIA_HEIGHT, Number(item.height || DEFAULT_ADDITIONAL_MEDIA_HEIGHT))
  );
  const order = Math.max(1, Math.min(3, Math.round(Number(item.order || fallbackIndex + 1))));
  const widthPercent = Math.max(
    MIN_ADDITIONAL_MEDIA_WIDTH,
    Math.min(MAX_ADDITIONAL_MEDIA_WIDTH, Number(item.widthPercent || DEFAULT_ADDITIONAL_MEDIA_WIDTH))
  );
  const isFixedPosition = textWrap === "behind" || textWrap === "front";
  const offsetX = Math.max(
    isFixedPosition ? 0 : MIN_ADDITIONAL_MEDIA_OFFSET_X,
    Math.min(isFixedPosition ? MAX_FIXED_MEDIA_TRANSLATE_X : MAX_ADDITIONAL_MEDIA_OFFSET_X, Number(item.offsetX || 0))
  );
  const offsetY = Math.max(
    isFixedPosition ? 0 : MIN_ADDITIONAL_MEDIA_OFFSET_Y,
    Math.min(isFixedPosition ? MAX_FIXED_MEDIA_TRANSLATE_Y : MAX_ADDITIONAL_MEDIA_OFFSET_Y, Number(item.offsetY || 0))
  );
  const distanceTop = normalizeTextDistance(item.distanceTop);
  const distanceRight = normalizeTextDistance(item.distanceRight);
  const distanceBottom = normalizeTextDistance(item.distanceBottom);
  const distanceLeft = normalizeTextDistance(item.distanceLeft);

  return {
    type,
    url,
    size,
    align,
    textWrap,
    wrapSide,
    height,
    order,
    widthPercent,
    offsetX,
    offsetY,
    distanceTop,
    distanceRight,
    distanceBottom,
    distanceLeft,
  };
};

const getAdditionalMediaWidthClass = (size: AdditionalMediaSize) => {
  if (size === "half") return "w-full sm:w-2/3";
  if (size === "third") return "w-full sm:w-1/2";
  return "w-full";
};

const getAdditionalMediaAlignClass = (align: AdditionalMediaAlign) => {
  if (align === "left") return "mr-auto ml-0";
  if (align === "right") return "ml-auto mr-0";
  return "mx-auto";
};

const isTextWrappingMode = (wrap: CanonicalAdditionalMediaWrap): boolean => {
  return wrap === "square" || wrap === "tight" || wrap === "through";
};

const getTextWrapFloatClass = (wrapMode: CanonicalAdditionalMediaWrap, wrapSide: AdditionalMediaWrapSide): string => {
  if (!isTextWrappingMode(wrapMode)) return "";
  if (wrapSide === "leftOnly") return "float-right";
  return "float-left";
};

function AutoPlayOnVisibleVideo({ src, className, style }: { src: string; className: string; style?: CSSProperties }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!videoRef.current) return;
        if (entry.isIntersecting) {
          const playPromise = videoRef.current.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {
              // Autoplay can be blocked by browser policy until user interacts.
            });
          }
        } else {
          videoRef.current.pause();
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      style={style}
      controls
      playsInline
      preload="metadata"
      muted
    />
  );
}

const NEWS_ARTICLE_SWITCH_MS = 15000;
const HOME_BOOTSTRAP_CACHE_KEY = "febaco:home:bootstrap:v1";
const HOME_BOOTSTRAP_CACHE_TTL_MS = 1000 * 60 * 10;
const HOME_STATS_CACHE_KEY = "febaco:home:stats:v1";

type CachedNewsArticle = Omit<NewsArticle, "createdAt"> & { createdAt: string | null };

type HomeBootstrapSnapshot = {
  menTeams: Franchise[];
  womenTeams: Franchise[];
  newsArticles: CachedNewsArticle[];
  featuredArticleId: string | null;
  partners: Array<{ id: string; name: string; logo: string }>;
  committee: any[];
  commission: any[];
  referees: any[];
};

type HomeBootstrapCache = HomeBootstrapSnapshot & { savedAt: number };

type HomeStatsCache = {
  version: number;
  savedAt: number;
  standings: any[];
  leagueTopPlayers: any[];
};

const emptyHomeBootstrapSnapshot = (): HomeBootstrapSnapshot => ({
  menTeams: [],
  womenTeams: [],
  newsArticles: [],
  featuredArticleId: null,
  partners: [],
  committee: [],
  commission: [],
  referees: [],
});

const parseHomeBootstrapCache = (raw: string | null): HomeBootstrapCache | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HomeBootstrapCache>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.savedAt !== "number") {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      menTeams: Array.isArray(parsed.menTeams) ? parsed.menTeams : [],
      womenTeams: Array.isArray(parsed.womenTeams) ? parsed.womenTeams : [],
      newsArticles: Array.isArray(parsed.newsArticles) ? parsed.newsArticles : [],
      featuredArticleId: typeof parsed.featuredArticleId === "string" ? parsed.featuredArticleId : null,
      partners: Array.isArray(parsed.partners) ? parsed.partners : [],
      committee: Array.isArray(parsed.committee) ? parsed.committee : [],
      commission: Array.isArray(parsed.commission) ? parsed.commission : [],
      referees: Array.isArray(parsed.referees) ? parsed.referees : [],
    };
  } catch {
    return null;
  }
};

const readHomeBootstrapCache = (): HomeBootstrapSnapshot | null => {
  if (typeof window === "undefined") return null;
  const cache = parseHomeBootstrapCache(window.localStorage.getItem(HOME_BOOTSTRAP_CACHE_KEY));
  if (!cache) return null;

  if (Date.now() - cache.savedAt > HOME_BOOTSTRAP_CACHE_TTL_MS) {
    window.localStorage.removeItem(HOME_BOOTSTRAP_CACHE_KEY);
    return null;
  }

  return {
    menTeams: cache.menTeams,
    womenTeams: cache.womenTeams,
    newsArticles: cache.newsArticles,
    featuredArticleId: cache.featuredArticleId,
    partners: cache.partners,
    committee: cache.committee,
    commission: cache.commission,
    referees: cache.referees,
  };
};

const writeHomeBootstrapCache = (snapshot: HomeBootstrapSnapshot) => {
  if (typeof window === "undefined") return;
  const payload: HomeBootstrapCache = {
    ...snapshot,
    savedAt: Date.now(),
  };
  window.localStorage.setItem(HOME_BOOTSTRAP_CACHE_KEY, JSON.stringify(payload));
};

const mergeHomeBootstrapCache = (partial: Partial<HomeBootstrapSnapshot>) => {
  if (typeof window === "undefined") return;
  const current = parseHomeBootstrapCache(window.localStorage.getItem(HOME_BOOTSTRAP_CACHE_KEY));
  const base: HomeBootstrapSnapshot = current
    ? {
        menTeams: current.menTeams,
        womenTeams: current.womenTeams,
        newsArticles: current.newsArticles,
        featuredArticleId: current.featuredArticleId,
        partners: current.partners,
        committee: current.committee,
        commission: current.commission,
        referees: current.referees,
      }
    : emptyHomeBootstrapSnapshot();
  writeHomeBootstrapCache({
    ...base,
    ...partial,
  });
};

const parseHomeStatsCache = (raw: string | null): HomeStatsCache | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HomeStatsCache>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.version !== "number") {
      return null;
    }

    return {
      version: parsed.version,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      standings: Array.isArray(parsed.standings) ? parsed.standings : [],
      leagueTopPlayers: Array.isArray(parsed.leagueTopPlayers) ? parsed.leagueTopPlayers : [],
    };
  } catch {
    return null;
  }
};

const readHomeStatsCache = (): HomeStatsCache | null => {
  if (typeof window === "undefined") return null;
  return parseHomeStatsCache(window.localStorage.getItem(HOME_STATS_CACHE_KEY));
};

const writeHomeStatsCache = (payload: Omit<HomeStatsCache, "savedAt">) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    HOME_STATS_CACHE_KEY,
    JSON.stringify({
      ...payload,
      savedAt: Date.now(),
    })
  );
};

const toCachedNewsArticle = (article: NewsArticle): CachedNewsArticle => ({
  ...article,
  createdAt: article.createdAt ? article.createdAt.toISOString() : null,
});

const fromCachedNewsArticle = (article: CachedNewsArticle): NewsArticle => ({
  ...article,
  createdAt: article.createdAt ? new Date(article.createdAt) : null,
});

type SectionHeaderProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  titleHref?: string;
  autoShine?: boolean;
  shineMode?: "once" | "twice";
};

const SectionHeader = ({ id, eyebrow, title, description, actions, titleHref, autoShine = false, shineMode = "once" }: SectionHeaderProps) => {
  const shineClass = autoShine ? (shineMode === "twice" ? "gold-auto-shine-twice" : "gold-auto-shine-once gold-mobile-glow") : "";
  const shineClassNoGlow = autoShine ? (shineMode === "twice" ? "gold-auto-shine-twice" : "gold-auto-shine-once") : "";
  
  return (
  <div aria-labelledby={`${id}-title`} className={actions ? "space-y-0" : "space-y-4"}>
    <div className="flex flex-wrap items-end justify-between gap-4">
      {titleHref ? (
        <Link href={titleHref} className="group block">
          <div>
            {eyebrow ? (
              <p className={`gold-hover-text text-xs uppercase tracking-[0.4em] text-slate-400 ${shineClass}`}>{eyebrow}</p>
            ) : null}
            <h2 id={`${id}-title`} className={`gold-hover-text text-3xl font-semibold text-white ${shineClass}`}>
              {title}
            </h2>
            {description ? (
              <p className={`gold-hover-text mt-2 text-sm text-slate-300 ${shineClassNoGlow}`}>{description}</p>
            ) : null}
          </div>
        </Link>
      ) : (
        <div>
          {eyebrow ? (
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{eyebrow}</p>
          ) : null}
          <h2 id={`${id}-title`} className="text-3xl font-semibold text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-sm text-slate-300">{description}</p>
          ) : null}
        </div>
      )}
      {actions ?? <div className="h-px flex-1 bg-slate-800" aria-hidden />}
    </div>
    {actions ? <div className="h-px w-full bg-slate-800" aria-hidden /> : null}
  </div>
);
};

const slug = (label: string) => label.toLowerCase();

const normalizeTeamName = (name: string) => {
  const withFixedTypo = name
    .replace(/\bsepoir\b/gi, "Espoir")
    .replace(/\bfukas\b|\bfukash\b/gi, "Fukash")
    .trim();
  return withFixedTypo.replace(/^espoir\s+espoir\s+/i, "Espoir ").trim();
};

const buildTeamDisplayName = (team: Pick<Franchise, "city" | "name">) => {
  const city = normalizeTeamName(team.city ?? "");
  const name = normalizeTeamName(team.name ?? "");

  if (!city) return name;
  if (!name) return city;

  const cityLower = city.toLowerCase();
  const nameLower = name.toLowerCase();

  if (nameLower === cityLower || nameLower.startsWith(`${cityLower} `)) {
    return name;
  }

  return normalizeTeamName(`${city} ${name}`.trim());
};

const formatFranchiseName = (team: Franchise) => buildTeamDisplayName(team);

const formatTimeAgo = (date: Date): string => {
  const now = getDRCNow().getTime();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) {
    return `il y a ${minutes} min`;
  } else if (hours < 24) {
    return `il y a ${hours} h`;
  } else {
    return `il y a ${days} j`;
  }
};

const formatISODate = (isoString: string, language: Locale): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    // Convert to DRC timezone
    const drcDate = new Date(date.toLocaleString('en-US', { timeZone: DRC_TIMEZONE }));
    const month = drcDate.getMonth() + 1;
    const day = drcDate.getDate();
    let hours = drcDate.getHours();
    const minutes = drcDate.getMinutes().toString().padStart(2, '0');
    
    if (language === 'en') {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${month}/${day} · ${hours}:${minutes} ${period}`;
    } else {
      return `${day}/${month} · ${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  } catch {
    return isoString;
  }
};

const formatGameDateTime = (dateTimeStr: string, language: Locale): string => {
  // First check if it's an ISO string (starts with year)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateTimeStr)) {
    return formatISODate(dateTimeStr, language);
  }
  
  // Parse the datetime string - handle both "·" and other separators
  const parts = dateTimeStr.split(/\s*[·•]\s*/);
  if (parts.length < 2) return dateTimeStr;
  
  const datePart = parts[0]; // e.g., "Dec 13" or "déc. 13"
  const timePart = parts[1]; // e.g., "3:45 PM" or "15:45"
  
  // Convert month to number
  const monthMap: {[key: string]: string} = {
    'Jan': '1', 'Feb': '2', 'Mar': '3', 'Apr': '4',
    'May': '5', 'Jun': '6', 'Jul': '7', 'Aug': '8',
    'Sep': '9', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    'jan': '1', 'fév': '2', 'mar': '3', 'avr': '4',
    'mai': '5', 'juin': '6', 'juil': '7', 'août': '8',
    'sep': '9', 'oct': '10', 'nov': '11', 'déc': '12',
    'janv': '1', 'févr': '2', 'mars': '3', 'sept': '9'
  };
  
  const dateMatch = datePart.match(/([A-Za-zé\.]+)\s+(\d+)/);
  if (!dateMatch) return dateTimeStr;
  
  const monthKey = dateMatch[1].toLowerCase().replace(/\./g, '');
  const month = monthMap[monthKey] || monthMap[dateMatch[1]] || dateMatch[1];
  const day = dateMatch[2];
  
  // Convert time to 24-hour for French
  let formattedTime = timePart.trim();
  if (language === 'fr') {
    // Check if time has AM/PM
    const timeMatchAMPM = formattedTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (timeMatchAMPM) {
      let hours = parseInt(timeMatchAMPM[1]);
      const minutes = timeMatchAMPM[2];
      const period = timeMatchAMPM[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    // If time is like "15 h 45", convert to "15:45"
    const timeMatchHFormat = formattedTime.match(/(\d+)\s*h\s*(\d+)/);
    if (timeMatchHFormat) {
      formattedTime = `${timeMatchHFormat[1].padStart(2, '0')}:${timeMatchHFormat[2]}`;
    }
  }
  
  // Format date based on language
  const dateStr = language === 'fr' 
    ? `${day}/${month}` // French: day/month (25/12)
    : `${month}/${day}`; // English: month/day (12/25)
  
  return `${dateStr}, ${formattedTime}`;
};

const translations = {
  en: {
    brand: "LIPROBAKIN",
    heroSeason: "Season 2025",
    heroTitle: "The Liprobakin rhythm mirrors the energy of the NBA G League.",
    heroDescription:
      "Players chasing call-ups, teams rewriting scouting reports, and nightly showcases streaming live.",
    ctaWatch: "Watch Live",
    ctaLiveScore: "Live Score",
    ctaSchedule: "Download Schedule",
    ctaStandings: "Latest Standings",
    nextOn: "Next on Liprobakin+",
    heroTipoff: "Friday · 7:00 PM PT",
    heroVenue: "Axis Pavilion",
    heroFeed: "LIPROBAKIN+",
    nav: {
      games: "Games",
      schedule: "Schedule",
      players: "Players",
      news: "News",
      stats: "Stats",
      standings: "Standings",
      teams: "Teams",
    },
    sections: {
      games: {
        eyebrow: "Games",
        title: "Final Buzzer",
        description: "Scoreboard snapshots from tonight's slate.",
      },
      schedule: {
        eyebrow: "Schedule",
        title: "Weekly Schedule",
        description: "Road trips, rivalries, and showcase dates on deck.",
      },
      players: {
        eyebrow: "Players",
        title: "Spotlight",
        description: "Prospect heat check straight from Liprobakin scouting reports.",
      },
      news: {
        eyebrow: "News",
        title: "League Stories",
        description: "Daily briefs from arenas across the Liprobakin map.",
      },
      stats: {
        title: "Upcoming Spotlight Games",
        description: "",
      },
      standings: {
        eyebrow: "Standings",
        title: "Playoff Picture",
        description: "Top seven teams pathing toward the Liprobakin Showcase.",
      },
      teams: {
        eyebrow: "Teams",
        title: "Franchises",
        description: "Seven clubs setting the pace for the Liprobakin climb.",
      },
      partners: {
        eyebrow: "Partners",
        title: "League Partners",
        description: "Organizations supporting the growth of Liprobakin.",
      },
      committee: {
        eyebrow: "Committee",
        title: "League Committee",
        description: "Leadership guiding the future of Liprobakin.",
      },
    },
    metricLabels: {
      "League Pace": "League Pace",
      "Avg Efficiency": "Avg Efficiency",
      "Clutch Net": "Clutch Net",
      "3PT Volume": "3PT Volume",
      "Paint Touches": "Paint Touches",
      "Turnover Rate": "Turnover Rate",
      Deflections: "Deflections",
      "Bench Net": "Bench Net",
    },
    footerTagline: "Liprobakin League",
    languageLabel: "Language",
    standingsTable: {
      seed: "Seed",
      team: "Team",
      wins: "W",
      losses: "L",
      totalPoints: "PTS",
    },
    contact: {
      title: "Get In Touch",
      subtitle: "Send us a message / suggestion",
      firstName: "First Name",
      lastName: "Last Name",
      emailAddress: "Email Address",
      phoneOptional: "Phone (Optional)",
      yourMessage: "Your Message",
      placeholderFirstName: "John",
      placeholderLastName: "Doe",
      placeholderEmail: "john@example.com",
      placeholderPhone: "+1 (555) 000-0000",
      placeholderMessage: "Please type your message or suggestion here!",
      sendMessage: "Send Message",
    },
  },
  fr: {
    brand: "LIPROBAKIN",
    heroSeason: "Saison 2025",
    heroTitle: "Le rythme Liprobakin reflète l'énergie de la NBA G League.",
    heroDescription:
      "Des joueurs en quête de promotion, des équipes qui réécrivent les rapports de scouting et des showcases nocturnes en direct.",
    ctaWatch: "Regarder en direct",
    ctaLiveScore: "Score en direct",
    ctaSchedule: "Télécharger le calendrier",
    ctaStandings: "Classement",
    nextOn: "Prochain sur Liprobakin+",
    heroTipoff: "Vendredi · 19h00 PT",
    heroVenue: "Axis Pavilion",
    heroFeed: "LIPROBAKIN+",
    nav: {
      games: "Matchs",
      schedule: "Calendrier",
      players: "Joueurs",
      news: "Actualités",
      stats: "Stats",
      standings: "Classement",
      teams: "Équipes",
    },
    sections: {
      games: {
        eyebrow: "Matchs",
        title: "Match terminé",
        description: "Instantanés du tableau d'affichage de ce soir.",
      },
      schedule: {
        eyebrow: "Calendrier",
        title: "Programme hebdomadaire",
        description: "",
      },
      players: {
        eyebrow: "Joueurs",
        title: "Projecteur",
        description: "",
      },
      news: {
        eyebrow: "Actualités",
        title: "Histoires de ligue",
        description: "Briefings quotidiens depuis les arènes du circuit Liprobakin.",
      },
      stats: {
        title: "Matchs à suivre",
        description: "Les affiches Liprobakin qui dynamisent la semaine à venir.",
      },
      standings: {
        eyebrow: "Classement",
        title: "Image des séries",
        description: "",
      },
      teams: {
        eyebrow: "Franchises",
        title: "Franchises",
        description: "",
      },
      partners: {
        eyebrow: "Partenaires",
        title: "Partenaires",
        description: "",
      },
      committee: {
        eyebrow: "Comité",
        title: "Comité",
        description: "",
      },
    },
    metricLabels: {
      "League Pace": "Rythme de ligue",
      "Avg Efficiency": "Efficacité moyenne",
      "Clutch Net": "Net clutch",
      "3PT Volume": "Volume à 3 pts",
      "Paint Touches": "Touches dans la raquette",
      "Turnover Rate": "Taux de pertes",
      Deflections: "Déviations",
      "Bench Net": "Impact du banc",
    },
    footerTagline: "Ligue Liprobakin",
    languageLabel: "Langue",
    standingsTable: {
      seed: "N°",
      team: "Équipe",
      wins: "V",
      losses: "D",
      totalPoints: "PTS",
    },
    contact: {
      title: "Contactez-Nous",
      subtitle: "Envoyez-nous un message / une suggestion",
      firstName: "Prénom",
      lastName: "Nom",
      emailAddress: "Adresse Email",
      phoneOptional: "Téléphone (Optionnel)",
      yourMessage: "Votre Message",
      placeholderFirstName: "Jean",
      placeholderLastName: "Dupont",
      placeholderEmail: "jean@exemple.com",
      placeholderPhone: "+243 000 000 000",
      placeholderMessage: "Please type your message or suggestion here!",
      sendMessage: "Envoyer",
    },
  },
} as const;

const teamRecordMap = Object.fromEntries(
  [...conferenceStandings, ...conferenceStandingsWomen].map((row) => [row.team, `${row.wins}-${row.losses}`] as const)
);

const getTeamRecord = (team: string) => teamRecordMap[team] ?? null;
const getLeaguePoints = (wins: number, losses: number, forfeitLosses = 0) => (wins * 2) + Math.max(0, losses - forfeitLosses);
const getResolvedTeamLogo = ({
  teamName,
  logo,
  franchise,
}: {
  teamName?: string;
  logo?: string | null;
  franchise?: Franchise | null;
}) =>
  resolveTeamLogo({
    city: franchise?.city,
    name: franchise?.name ?? teamName,
    logo: logo ?? franchise?.logo,
  });

const playerHeadshots: Record<string, string> = {
  ...Object.fromEntries(spotlightPlayers.map((player) => [player.name, player.photo] as const)),
  ...Object.fromEntries(spotlightPlayersWomen.map((player) => [player.name, player.photo] as const)),
  "Cam Porter": "/players/cam-porter.svg",
  "Omar Greer": "/players/omar-greer.svg",
};

type Locale = keyof typeof translations;
type Language = Locale; // Alias for clarity
type Gender = "men" | "women";
type SelectedTeamState = { label: string; gender: Gender } | null;

const findFranchiseByName = (teamName: string, allTeams: Franchise[]) => {
  const normalized = normalizeTeamName(teamName).toLowerCase();
  return allTeams.find((team) => {
    const display = formatFranchiseName(team).toLowerCase();
    return display === normalized || normalizeTeamName(team.name).toLowerCase() === normalized;
  });
};

const parseTipoffToDate = (tipoff: string) => {
  const sanitized = tipoff.replace(/\s*·\s*/g, " ");
  const candidate = `${sanitized} ${new Date().getFullYear()}`;
  const timestamp = Date.parse(candidate);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
};

const LeaderRow = ({ leader, allFranchises, gender }: { leader: FeaturedMatchup["leaders"][number]; allFranchises: Franchise[]; gender?: Gender }) => {
  const franchise = findFranchiseByName(leader.team, allFranchises);
  const teamLogo = getResolvedTeamLogo({ teamName: leader.team, franchise });
  const headshot = leader.headshot || playerHeadshots[leader.player];
  const initials = leader.player
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName = leader.player.trim().split(" ").pop() ?? leader.player;
  
  // Determine the link URL - prioritize player page if number is available
  const playerNumber = 'number' in leader ? leader.number : null;
  const teamGender = gender === "women" ? "women" : "men";
  const linkUrl = playerNumber 
    ? `/player/${encodeURIComponent(leader.team)}/${playerNumber}`
    : `/team/${encodeURIComponent(leader.team)}?gender=${teamGender}`;

  return (           
    <Link 
      href={linkUrl}
      className="flex items-center justify-between gap-2 min-w-0 group transition-all hover:bg-white/5 rounded-lg p-1.5 -m-1.5"
    >
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        {headshot ? (
          <Image
            src={headshot}
            alt={`${leader.player} portrait`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full border border-white/20 object-cover flex-shrink-0 group-hover:border-blue-400 transition-colors"
          />
        ) : teamLogo ? (
          <Image
            src={teamLogo}
            alt={`${franchise ? formatFranchiseName(franchise) : leader.team} logo`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full border border-white/20 bg-white/5 object-cover flex-shrink-0 group-hover:border-blue-400 transition-colors"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold flex-shrink-0 group-hover:bg-white/20 transition-colors">
            {initials}
          </span>
        )}
        <div className="min-w-0 overflow-hidden">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 truncate group-hover:text-blue-400 transition-colors">{leader.team}</p>
          <p className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">{displayName}</p>
          <p className="text-[10px] text-slate-400 truncate">{leader.stats}</p>
        </div>
      </div>
    </Link>
  );
};

// Countdown timer component for upcoming games
const CountdownTimer = ({ dateTime, language }: { dateTime?: string; language: Locale }) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalSeconds: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!dateTime) return;
    
    const targetDate = new Date(dateTime);
    if (isNaN(targetDate.getTime())) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      
      // Only show if within 24 hours and game hasn't started
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (diff <= 0 || diff > twentyFourHours) {
        setIsVisible(false);
        return;
      }
      
      setIsVisible(true);
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds, totalSeconds });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [dateTime]);

  if (!isVisible || !timeLeft) return null;

  const formatNum = (n: number) => n.toString().padStart(2, '0');

  const urgency: "normal" | "low" | "medium" | "high" | "critical" = (() => {
    const s = timeLeft.totalSeconds;
    if (s <= 5 * 60) return "critical";
    if (s <= 15 * 60) return "high";
    if (s <= 60 * 60) return "medium";
    if (s <= 6 * 60 * 60) return "low";
    return "normal";
  })();

  const labelClass =
    urgency === "critical"
      ? "border-red-500/25 bg-red-500/10 text-red-200"
      : urgency === "high"
        ? "border-orange-500/25 bg-orange-500/10 text-orange-200"
        : urgency === "medium"
          ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
          : urgency === "low"
            ? "border-amber-500/20 bg-amber-500/5 text-amber-100"
            : "border-white/10 bg-white/5 text-slate-300";

  const timerShellClass =
    urgency === "critical"
      ? "border-red-500/25 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 shadow-lg shadow-red-500/10"
      : urgency === "high"
        ? "border-orange-500/25 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 shadow-lg shadow-orange-500/10"
        : urgency === "medium"
          ? "border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 shadow-md shadow-amber-500/10"
          : urgency === "low"
            ? "border-white/15 bg-black/25"
            : "border-white/10 bg-black/20";

  const glowClass =
    urgency === "critical"
      ? "from-red-500/35 via-orange-500/25 to-red-500/35 animate-[pulse_0.7s_ease-in-out_infinite]"
      : urgency === "high"
        ? "from-amber-500/25 via-orange-500/20 to-red-500/25 animate-pulse"
        : urgency === "medium"
          ? "from-amber-500/15 via-orange-500/10 to-amber-500/15 animate-pulse"
          : "from-transparent via-transparent to-transparent";

  const secondsClass =
    urgency === "critical"
      ? "text-red-100 animate-[pulse_0.7s_ease-in-out_infinite]"
      : urgency === "high"
        ? "text-orange-100 animate-pulse"
        : urgency === "medium"
          ? "text-amber-100"
          : "text-white";

  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      <span className={`rounded-full border px-2 py-0.5 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.2em] whitespace-nowrap transition-colors ${labelClass}`}>
        {language === 'fr' ? 'Début dans' : 'Starting in'}
      </span>
      <div className={`relative inline-flex items-center rounded-full border px-2 py-0.5 text-xs md:text-sm font-semibold text-white tabular-nums overflow-hidden ${timerShellClass}`}>
        <div className={`pointer-events-none absolute inset-0 rounded-full blur-xl bg-gradient-to-r ${glowClass}`} />
        <div className="relative inline-flex items-center">
        <span>{formatNum(timeLeft.hours)}</span>
        <span className="mx-1 text-white/40">:</span>
        <span>{formatNum(timeLeft.minutes)}</span>
        <span className="mx-1 text-white/40">:</span>
        <span className={secondsClass}>{formatNum(timeLeft.seconds)}</span>
        </div>
      </div>
    </div>
  );
};

const MatchupTeam = ({ team, record, logo, allFranchises, gender }: { team: string; record: string; logo?: string; allFranchises: Franchise[]; gender?: Gender }) => {
  const franchise = findFranchiseByName(team, allFranchises);
  const displayName = franchise ? formatFranchiseName(franchise) : normalizeTeamName(team);
  const colors = franchise?.colors ?? ["#1e293b", "#0f172a"];
  const label = franchise?.city?.trim();
  const showLabel = Boolean(label && label.toLowerCase() !== displayName.toLowerCase());
  const teamLogo = getResolvedTeamLogo({ teamName: team, logo, franchise });
  const initials = team
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const teamGender = gender === "women" ? "women" : "men";

  const handleTeamOpenAnimation = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "teamPageTransition",
      JSON.stringify({
        teamName: displayName,
        logo: teamLogo || "",
        colors,
      })
    );
  };

  return (
    <Link
      href={`/team/${encodeURIComponent(displayName)}?gender=${teamGender}`}
      onClick={handleTeamOpenAnimation}
      className="flex flex-col items-center gap-1 md:gap-2 text-center min-w-0 transition hover:opacity-80"
    >
      {teamLogo ? (
        <Image
          src={teamLogo}
          alt={`${displayName} logo`}
          width={48}
          height={48}
          className="h-8 w-8 md:h-12 md:w-12 rounded-full border border-white/10 bg-white/5 object-cover flex-shrink-0"
        />
      ) : (
        <span className="flex h-8 w-8 md:h-12 md:w-12 items-center justify-center rounded-full bg-white/10 text-[10px] md:text-sm font-semibold flex-shrink-0">
          {initials}
        </span>
      )}
      <div className="min-w-0 w-full">
        <p className="text-xs md:text-base font-semibold text-white truncate">{displayName}</p>
        <p className="text-[8px] md:text-[10px] text-slate-400">{record}</p>
      </div>
    </Link>
  );
};

const ScoreTeamRow = ({
  team,
  score,
  highlight = false,
  showRecord = false,
  allFranchises,
}: {
  team: string;
  score: number;
  highlight?: boolean;
  showRecord?: boolean;
  allFranchises: Franchise[];
}) => {
  const franchise = findFranchiseByName(team, allFranchises);
  const displayName = franchise ? formatFranchiseName(franchise) : normalizeTeamName(team);
  const teamLogo = getResolvedTeamLogo({ teamName: team, franchise });
  const initials = team
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const record = showRecord ? getTeamRecord(displayName) ?? getTeamRecord(team) : null;

  return (
    <div className={`flex items-center justify-between ${highlight ? "text-white" : "text-slate-300"}`}>
      <div className="flex items-center gap-3">
        {teamLogo ? (
          <Image
            src={teamLogo}
            alt={`${displayName} logo`}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border border-white/15 bg-white/5 object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
            {initials}
          </span>
        )}
        <span className={`text-base font-semibold ${highlight ? "text-white" : "text-slate-200"}`}>
          {displayName}
          {record ? <span className="text-sm font-normal text-slate-400"> {`(${record})`}</span> : null}
        </span>
      </div>
      <span className={`text-2xl font-bold ${highlight ? "text-white" : "text-slate-300"}`}>{score}</span>
    </div>
  );
};

const ScheduleTeam = ({ team, label, allFranchises }: { team: string; label: string; allFranchises: Franchise[] }) => {
  const franchise = findFranchiseByName(team, allFranchises);
  const displayName = franchise ? formatFranchiseName(franchise) : normalizeTeamName(team);
  const teamLogo = getResolvedTeamLogo({ teamName: team, franchise });
  const initials = team
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {teamLogo ? (
        <Image
          src={teamLogo}
          alt={`${displayName} logo`}
          width={48}
          height={48}
          className="h-12 w-12 rounded-full border border-white/10 bg-white/5 object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
          {initials}
        </span>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{label}</p>
        <p className="text-base font-semibold text-white">{displayName}</p>
      </div>
    </div>
  );
};

const GenderToggle = ({ value, onChange, language }: { value: Gender; onChange: (value: Gender) => void; language: Language }) => (
  <div className="inline-flex overflow-hidden rounded-full border border-white/20 bg-white/5 text-[11px] font-semibold uppercase tracking-[0.25em]" role="group" aria-label="Gender filter">
    {(
      [
        { key: "men" as Gender, label: language === 'fr' ? "Messieur" : "Gentlemen", short: "G" },
        { key: "women" as Gender, label: language === 'fr' ? "Dames" : "Ladies", short: "L" },
      ]
    ).map((option) => {
      const isActive = value === option.key;
      return (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`relative px-3 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:px-6 sm:py-2 ${
            isActive ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
          }`}
          aria-pressed={isActive}
          aria-label={option.label}
        >
          <span className="sm:hidden" aria-hidden>
            {option.short}
          </span>
          <span className="hidden sm:inline" aria-hidden>
            {option.label}
          </span>
        </button>
      );
    })}
  </div>
);

type PlayerMetric = "pts" | "ast" | "reb" | "blk" | "evl";

const playerMetricFilters: { key: PlayerMetric; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "ast", label: "AST" },
  { key: "reb", label: "REB" },
  { key: "blk", label: "BLK" },
  { key: "evl", label: "EVL" },
];

  const RosterModal = ({ teamName, onClose, allFranchises }: { teamName: string; onClose: () => void; allFranchises: Franchise[] }) => {
    const franchise = findFranchiseByName(teamName, allFranchises);
    const [roster, setRoster] = useState<RosterPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      const fetchRoster = async () => {
        try {
          setLoading(true);
          
          // Find the team in Firestore
          const teamsRef = collection(firebaseDB, "teams");
          const teamsSnapshot = await getDocs(teamsRef);
          
          let targetTeamId: string | null = null;
          
          for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();
            const teamDocName = teamData.name ?? "";
            const teamDocCity = teamData.city ?? "";
            const fullTeamName = buildTeamDisplayName({ city: teamDocCity, name: teamDocName });
            
            if (fullTeamName === teamName || teamDocName === teamName) {
              targetTeamId = teamDoc.id;
              break;
            }
          }
          
          if (!targetTeamId) {
            console.log("Team not found in Firestore:", teamName);
            setRoster([]);
            setLoading(false);
            return;
          }
          
          // Fetch roster from Firestore
          const rosterRef = collection(firebaseDB, `teams/${targetTeamId}/roster`);
          const rosterSnapshot = await getDocs(rosterRef);
          
          const players: RosterPlayer[] = rosterSnapshot.docs.map((playerDoc) => {
            const playerData = playerDoc.data();
            return {
              name: `${playerData.firstName || ""} ${playerData.lastName || ""}`.trim(),
              number: playerData.number ?? 0,
              height: playerData.height ?? "",
              headshot: playerData.headshot ?? "/players/default-avatar.png",
              position: playerData.position ?? "",
              stats: {
                pts: playerData.stats?.pts ?? "0.0",
                reb: playerData.stats?.reb ?? "0.0",
                ast: playerData.stats?.ast ?? "0.0",
                blk: playerData.stats?.blk ?? "0.0",
                stl: playerData.stats?.stl ?? "0.0"
              }
            };
          }).sort((a, b) => a.number - b.number);
          
          setRoster(players);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching roster:", error);
          setRoster([]);
          setLoading(false);
        }
      };
      
      fetchRoster();
    }, [teamName]);
    
    useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={`${teamName} roster`}
        className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {franchise?.logo ? (
              <Image
                src={franchise.logo}
                alt={`${teamName} logo`}
                width={56}
                height={56}
                className="h-14 w-14 rounded-full border border-white/20 object-cover"
              />
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Roster</p>
              <h3 className="text-2xl font-semibold">{teamName}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-white hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12 text-slate-400">Loading roster...</div>
          ) : roster.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No players registered for this team yet.</div>
          ) : (
            roster.map((player) => (
              <div
                key={`${teamName}-${player.number}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-gradient-to-r from-slate-900/70 to-slate-900/30 p-4"
              >
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">#{player.number}</p>
                  <p className="text-lg font-semibold text-white">{player.name}</p>
                  <p className="text-sm text-slate-300">{player.height}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200">
                  <span className="rounded-full border border-white/10 px-3 py-1">PTS {player.stats.pts}</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">REB {player.stats.reb}</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">STL {player.stats.stl}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const PlayerStatsModal = ({ player, onClose }: { player: SpotlightPlayer; onClose: () => void }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={`${player.name} league-leading stats`}
        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">League Leaders</p>
            <h3 className="text-2xl font-semibold text-white">
              #{player.number} · {player.name}
            </h3>
            <p className="text-sm text-slate-300">{player.team}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-white hover:text-white"
          >
            Close
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-200">{player.blurb}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {player.statLines.map((line) => (
            <div
              key={`${player.name}-${line.label}`}
              className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/80 to-slate-900/30 p-4"
            >
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{line.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{line.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Fan Favorite Player Card Component
const FanFavoritePlayerCard = ({ playerId, teamId }: { playerId: string; teamId?: string }) => {
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!playerId || !teamId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const rosterRef = collection(firebaseDB, "teams", teamId, "roster");
        const rosterSnapshot = await getDocs(rosterRef);
        
        const player = rosterSnapshot.docs.find(doc => doc.id === playerId);
        if (player) {
          const data = player.data();
          setPlayerData({
            name: data.name || `${data.firstName} ${data.lastName}`,
            number: data.number,
            position: data.position,
            height: data.height,
            photo: data.headshot || data.photo || "/players/default.svg",
            stats: data.stats || {},
          });
        }
      } catch (error) {
        console.error("Error fetching player data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [playerId, teamId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="flex justify-center items-center p-12 text-slate-400">
        {language === 'fr' ? 'Joueur non trouvé' : 'Player not found'}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-6">
        {/* Player Photo */}
        <div className="relative h-32 w-32 flex-shrink-0 rounded-full overflow-hidden border-4 border-orange-400/30 shadow-2xl">
          <Image
            src={playerData.photo}
            alt={playerData.name}
            fill
            className="object-cover"
            onError={(e) => {
              e.currentTarget.src = "/players/default.svg";
            }}
          />
        </div>

        {/* Player Info */}
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.4em] text-orange-400 mb-1">
            {language === 'fr' ? 'Votre Joueur Favori' : 'Your Favorite Player'}
          </p>
          <h3 className="text-3xl font-bold text-white mb-2">
            {playerData.number && `#${playerData.number} · `}{playerData.name}
          </h3>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            {playerData.position && (
              <span className="px-3 py-1 rounded-full border border-white/20 bg-white/5">
                {playerData.position}
              </span>
            )}
            {playerData.height && (
              <span className="px-3 py-1 rounded-full border border-white/20 bg-white/5">
                {playerData.height}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player Stats */}
      {playerData.stats && Object.keys(playerData.stats).length > 0 && (
        <div className="mt-6 grid grid-cols-3 md:grid-cols-5 gap-4">
          {Object.entries(playerData.stats).map(([key, value]) => (
            <div key={key} className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs uppercase text-slate-400 mb-1">{key}</p>
              <p className="text-2xl font-bold text-white">{String(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Fan Favorite Team Card Component  
const FanFavoriteTeamCard = ({ teamId, teamName }: { teamId?: string; teamName?: string }) => {
  const [teamData, setTeamData] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!teamId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch team info
        const teamDoc = await getDocs(query(collection(firebaseDB, "teams"), where("__name__", "==", teamId)));
        if (!teamDoc.empty) {
          setTeamData(teamDoc.docs[0].data());
        }

        // Fetch roster
        const rosterRef = collection(firebaseDB, "teams", teamId, "roster");
        const rosterSnapshot = await getDocs(rosterRef);
        const players = rosterSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).slice(0, 5); // Show top 5 players
        setRoster(players);
      } catch (error) {
        console.error("Error fetching team data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-6 mb-6">
        {teamData?.logo && (
          <div className="relative h-24 w-24 flex-shrink-0">
            <Image
              src={teamData.logo}
              alt={teamName || 'Team logo'}
              fill
              className="object-contain"
            />
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-orange-300 mb-1">
            {language === 'fr' ? 'Votre Équipe Favorite' : 'Your Favorite Team'}
          </p>
          <h3 className="text-3xl font-bold text-white">{teamName}</h3>
        </div>
      </div>

      {/* Roster Preview */}
      {roster.length > 0 && (
        <div>
          <h4 className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-3">
            {language === 'fr' ? 'Effectif' : 'Roster'}
          </h4>
          <div className="grid gap-3">
            {roster.map((player) => (
              <Link
                key={player.id}
                href={`/player/${encodeURIComponent(teamName || '')}/${player.number}`}
                className="flex items-center gap-4 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
              >
                {player.headshot && (
                  <div className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-white/20">
                    <Image
                      src={player.headshot}
                      alt={player.name || `${player.firstName} ${player.lastName}`}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/players/default.svg";
                      }}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-white">
                    #{player.number} {player.name || `${player.firstName} ${player.lastName}`}
                  </p>
                  {player.position && (
                    <p className="text-xs text-slate-400">{player.position}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const { user, userProfile, isAdmin, signOut: handleSignOut } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [selectedTeam, setSelectedTeam] = useState<SelectedTeamState>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<SpotlightPlayer | null>(null);
  const [playerMetric, setPlayerMetric] = useState<PlayerMetric>("pts");
  const [gender, setGender] = useState<Gender>("men");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [dynamicSpotlightGames, setDynamicSpotlightGames] = useState<EnhancedMatchup[]>([]);
  const [weeklyScheduleGames, setWeeklyScheduleGames] = useState<EnhancedMatchup[]>([]);
  const [completedGames, setCompletedGames] = useState<any[]>([]);
  const [menTeams, setMenTeams] = useState<Franchise[]>(ssrMenFranchises);
  const [womenTeams, setWomenTeams] = useState<Franchise[]>(ssrWomenFranchises);
  const [leagueTopPlayers, setLeagueTopPlayers] = useState<any[]>([]);
  const [leagueLeadersExpanded, setLeagueLeadersExpanded] = useState(false);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [featuredArticleId, setFeaturedArticleId] = useState<string | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  // Helper: expand/collapse article AND update the URL so each article has a shareable link
  const expandArticle = useCallback((articleId: string | null) => {
    setExpandedArticleId(articleId);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (articleId) {
      url.searchParams.set("article", articleId);
    } else {
      url.searchParams.delete("article");
    }
    window.history.pushState({ articleId }, "", url.toString());
  }, []);
  const [articleComments, setArticleComments] = useState<ArticleComment[]>([]);
  const [articleCommentReplies, setArticleCommentReplies] = useState<ArticleCommentReply[]>([]);
  const [articleCommentsVisibleCount, setArticleCommentsVisibleCount] = useState(6);
  const [commentName, setCommentName] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentWebsite, setCommentWebsite] = useState("");
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyName, setReplyName] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [newsGridStartIndex, setNewsGridStartIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isFeaturedVideoMuted, setIsFeaturedVideoMuted] = useState(true);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isArticleChanging, setIsArticleChanging] = useState(false);
  const [dynamicStandings, setDynamicStandings] = useState<any[] | null>(null);
  const [currentPartnerIndex, setCurrentPartnerIndex] = useState(0);
  const [currentCommitteeIndex, setCurrentCommitteeIndex] = useState(0);
  const [dynamicPartners, setDynamicPartners] = useState<any[]>([]);
  const [visiblePartners, setVisiblePartners] = useState<number[]>([0, 1, 2, 3]);
  const [partnerAnimating, setPartnerAnimating] = useState<number | null>(null);
  const [dynamicCommittee, setDynamicCommittee] = useState<any[]>(leagueCommittee);
  const [dynamicCommission, setDynamicCommission] = useState<any[]>([]);
  const [dynamicReferees, setDynamicReferees] = useState<any[]>([]);
  const [showRefs, setShowRefs] = useState(false);
  const [playerCardExpanded, setPlayerCardExpanded] = useState(true);
  const [playerData, setPlayerData] = useState<RosterPlayer | null>(null);
  const [nextGame, setNextGame] = useState<EnhancedMatchup | null>(null);
  const [gameCountdown, setGameCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; isGameDay: boolean } | null>(null);
  const [liveGames, setLiveGames] = useState<EnhancedMatchup[]>([]);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [scheduleStartIndex, setScheduleStartIndex] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date | null>(null);
  const [allScheduledGames, setAllScheduledGames] = useState<EnhancedMatchup[]>([]);
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const finalBuzzerScrollRef = useRef<HTMLDivElement>(null);
  const expandedArticlePanelRef = useRef<HTMLElement | null>(null);
  const teamsScrollRef = useRef<HTMLDivElement>(null);
  const standingsHistoryRef = useRef<Record<string, number>>({});
  const featuredVideoCompletionRef = useRef(false);
  const featuredArticleStartTimeRef = useRef<number>(Date.now());
  const featuredVideoRotateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectorFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Fan favorites state
  const [showFavoritePlayer, setShowFavoritePlayer] = useState(false);
  const [showMenTeamFavorite, setShowMenTeamFavorite] = useState(false);
  const [showWomenTeamFavorite, setShowWomenTeamFavorite] = useState(false);
  
  const copy = translations[language];
  const sectionCopy = copy.sections;
  const languageOptions: Locale[] = ["en", "fr"];
  const mobileNavSections: Array<(typeof navSections)[number]> = [
    "Schedule",
    "Players",
    "Standings",
    "Teams",
  ];
  const [standingsGender, setStandingsGender] = useState<Gender>("men");
  const [franchiseGender, setFranchiseGender] = useState<Gender>("men");
  const [playersGender, setPlayersGender] = useState<Gender>("men");
  const [teamSearch, setTeamSearch] = useState<string>("");
  const [glowedStandingPlayerPhotos, setGlowedStandingPlayerPhotos] = useState<Record<string, boolean>>({});
  const glowedStandingPlayerPhotoIdsRef = useRef<Set<string>>(new Set());
  const standingsShineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [standingsAutoShine, setStandingsAutoShine] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "", phone: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactNotice, setContactNotice] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactError(null);
    setContactNotice(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contactForm, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }
      if (data.emailDelivered === false) {
        setContactNotice(language === "fr"
          ? "Message enregistré, mais l'email de notification a échoué. Vérifiez la configuration Resend."
          : "Message saved, but email notification failed. Please check Resend configuration.");
      }
      setContactSuccess(true);
      setContactForm({ firstName: "", lastName: "", email: "", phone: "", message: "" });
    } catch (err: unknown) {
      setContactError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setContactSubmitting(false);
    }
  };

  // Share player card using native share API
  const sharePlayerCard = useCallback(async (platform: 'ig' | 'fb') => {
    if (!playerData) {
      console.error('No player data available');
      alert('No player data available');
      return;
    }
    
    // Create canvas for the share image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    
    // Set dimensions (IG story or FB post)
    canvas.width = platform === 'ig' ? 1080 : 1200;
    canvas.height = platform === 'ig' ? 1920 : 630;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add accent circles
    ctx.beginPath();
    ctx.arc(100, 100, 200, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(canvas.width - 100, canvas.height - 100, 200, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
    ctx.fill();
    
    // Load player image with fallback
    const loadImage = (src: string): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.warn('Failed to load image:', src);
          resolve(null);
        };
        img.src = src;
      });
    };
    
    try {
      // Try to load player image, use null if fails
      const playerImg = await loadImage(playerData.headshot || '/players/placeholder.jpg');
      
      if (platform === 'ig') {
        // Instagram Story Layout
        // Logo
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 48px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('LIPROBAKIN', canvas.width / 2, 120);
        
        // Player photo (circular)
        const photoSize = 400;
        const photoX = (canvas.width - photoSize) / 2;
        const photoY = 250;
        
        // Draw photo placeholder or actual image
        if (playerImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(playerImg, photoX, photoY, photoSize, photoSize);
          ctx.restore();
        } else {
          // Draw placeholder circle
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
          ctx.fill();
          // Draw initials
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 120px system-ui';
          const initials = playerData.name.split(' ').map(n => n[0]).join('').slice(0, 2);
          ctx.fillText(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 40);
        }
        
        // Photo border
        ctx.beginPath();
        ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 16;
        ctx.stroke();
        
        // Jersey number badge
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 80, photoY + photoSize - 30, 160, 80, 20);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px system-ui';
        ctx.fillText(`#${playerData.number || '00'}`, canvas.width / 2, photoY + photoSize + 30);
        
        // Player name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 72px system-ui';
        ctx.fillText(playerData.name, canvas.width / 2, photoY + photoSize + 160);
        
        // Team
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 36px system-ui';
        ctx.fillText(userProfile?.teamName || 'FEBACO', canvas.width / 2, photoY + photoSize + 220);
        
        // Stats
        const stats = [
          { label: 'PTS', value: playerData.stats?.pts || '0' },
          { label: 'REB', value: playerData.stats?.reb || '0' },
          { label: 'AST', value: playerData.stats?.ast || '0' },
        ];
        const statY = photoY + photoSize + 320;
        const statWidth = 280;
        const startX = (canvas.width - statWidth * 3) / 2;
        
        stats.forEach((stat, i) => {
          const x = startX + i * statWidth + statWidth / 2;
          // Stat box
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.roundRect(startX + i * statWidth + 20, statY, statWidth - 40, 180, 20);
          ctx.fill();
          // Value
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 80px system-ui';
          ctx.fillText(Number(stat.value).toFixed(1), x, statY + 90);
          // Label
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 28px system-ui';
          ctx.fillText(stat.label, x, statY + 140);
        });
        
        // Website
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '28px system-ui';
        ctx.fillText('liprobakin.com', canvas.width / 2, canvas.height - 80);
      } else {
        // Facebook Layout (horizontal)
        const photoSize = 350;
        const photoX = 80;
        const photoY = (canvas.height - photoSize) / 2;
        
        // Player photo with fallback
        if (playerImg) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(photoX, photoY, photoSize, photoSize, 30);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(playerImg, photoX, photoY, photoSize, photoSize);
          ctx.restore();
        } else {
          // Placeholder
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.roundRect(photoX, photoY, photoSize, photoSize, 30);
          ctx.fill();
          // Draw initials
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 100px system-ui';
          ctx.textAlign = 'center';
          const initials = playerData.name.split(' ').map(n => n[0]).join('').slice(0, 2);
          ctx.fillText(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 35);
        }
        
        // Photo border
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(photoX, photoY, photoSize, photoSize, 30);
        ctx.stroke();
        
        // Jersey badge
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(photoX + photoSize - 60, photoY + photoSize - 60, 100, 60, 15);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`#${playerData.number || '00'}`, photoX + photoSize - 10, photoY + photoSize - 20);
        
        // Right side content
        const textX = photoX + photoSize + 80;
        ctx.textAlign = 'left';
        
        // Logo
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 32px system-ui';
        ctx.fillText('LIPROBAKIN', textX, photoY + 40);
        
        // Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px system-ui';
        ctx.fillText(playerData.name, textX, photoY + 110);
        
        // Team
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 28px system-ui';
        ctx.fillText(userProfile?.teamName || 'FEBACO', textX, photoY + 160);
        
        // Stats row
        const stats = [
          { label: 'PTS', value: playerData.stats?.pts || '0' },
          { label: 'REB', value: playerData.stats?.reb || '0' },
          { label: 'AST', value: playerData.stats?.ast || '0' },
          { label: 'STL', value: playerData.stats?.stl || '0' },
          { label: 'BLK', value: playerData.stats?.blk || '0' },
        ];
        const statStartY = photoY + 220;
        const statBoxWidth = 120;
        
        stats.forEach((stat, i) => {
          const x = textX + i * (statBoxWidth + 15);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.roundRect(x, statStartY, statBoxWidth, 100, 15);
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 40px system-ui';
          ctx.fillText(Number(stat.value).toFixed(1), x + statBoxWidth / 2, statStartY + 50);
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 18px system-ui';
          ctx.fillText(stat.label, x + statBoxWidth / 2, statStartY + 80);
        });
        
        // Website
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '24px system-ui';
        ctx.fillText('liprobakin.com', canvas.width - 40, canvas.height - 30);
      }
      
      // Convert to blob and share
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const fileName = `${playerData.name.replace(/\s+/g, '_')}_stats.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        
        // Try native share (works on mobile - opens share sheet where user can pick Instagram/Facebook)
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${playerData.name} - Stats`,
              text: platform === 'ig' 
                ? `Check out ${playerData.name}'s stats! 🏀 #Liprobakin #Basketball`
                : `Check out ${playerData.name}'s stats on Liprobakin! 🏀`,
            });
            return; // Share was successful
          } catch (err) {
            // User cancelled or error - fall through to download
            console.log('Share cancelled or failed, falling back to download');
          }
        }
        
        // Fallback: Download the image first
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Also copy to clipboard if supported (so user can paste)
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          console.log('Image copied to clipboard');
        } catch (clipErr) {
          console.log('Clipboard write not supported');
        }
        
        URL.revokeObjectURL(url);
        
        // Show instruction alert then open the platform
        if (platform === 'ig') {
          alert('📸 Image saved! Open Instagram Stories and select the image from your gallery.');
          // Try to open Instagram app, fallback to web
          setTimeout(() => {
            window.open('instagram://story-camera', '_blank');
            setTimeout(() => {
              window.open('https://www.instagram.com/stories/create/', '_blank');
            }, 1000);
          }, 300);
        } else {
          alert('📸 Image saved! Select it from your gallery when creating your Facebook Story.');
          // Open Facebook Stories directly
          setTimeout(() => {
            // Try mobile app deep link first
            const fbStoryUrl = 'fb://story_composer';
            const fbWebUrl = 'https://www.facebook.com/stories/create';
            
            // Try app first
            window.location.href = fbStoryUrl;
            
            // Fallback to web after short delay
            setTimeout(() => {
              window.open(fbWebUrl, '_blank');
            }, 1000);
          }, 300);
        }
        
      }, 'image/png');
      
    } catch (error) {
      console.error('Error creating share card:', error);
      alert('Failed to create share card. Please try again.');
    }
  }, [playerData, userProfile]);

  // Removed static roster - RosterModal now fetches from Firestore
  const genderPlayers = playersGender === "men" ? spotlightPlayers : spotlightPlayersWomen;
  // Standings should not flash placeholder data; only render once computed standings arrive.
  const genderStandings = useMemo(() => {
    const standings = Array.isArray(dynamicStandings) ? dynamicStandings : [];
    return [...standings]
      .filter((s) => s.gender === standingsGender)
      .sort((a, b) => Number(a.seed) - Number(b.seed));
  }, [dynamicStandings, standingsGender]);
  const homepageStandings = genderStandings;
  const genderFranchises = franchiseGender === "men" ? menTeams : womenTeams;
  const filteredFranchises = genderFranchises.filter(team => {
    const fullName = buildTeamDisplayName(team).toLowerCase();
    return fullName.includes(teamSearch.toLowerCase());
  });
  const visibleFranchises = filteredFranchises.slice(0, 7);
  const allFranchises = useMemo(() => [...menTeams, ...womenTeams], [menTeams, womenTeams]);
  const rankedArticleComments = useMemo(
    () =>
      [...articleComments].sort((a, b) => {
        if (b.likesCount !== a.likesCount) {
          return b.likesCount - a.likesCount;
        }

        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      }),
    [articleComments]
  );

  const repliesByCommentId = useMemo(() => {
    return articleCommentReplies.reduce<Record<string, ArticleCommentReply[]>>((grouped, reply) => {
      if (!grouped[reply.commentId]) {
        grouped[reply.commentId] = [];
      }
      grouped[reply.commentId].push(reply);
      return grouped;
    }, {});
  }, [articleCommentReplies]);

  const sortedRepliesByCommentId = useMemo(() => {
    return Object.entries(repliesByCommentId).reduce<Record<string, ArticleCommentReply[]>>((grouped, [commentId, replies]) => {
      grouped[commentId] = [...replies].sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeA - timeB;
      });
      return grouped;
    }, {});
  }, [repliesByCommentId]);

  const completedGamesSorted = useMemo(() => {
    const toSortTime = (game: any) =>
      game?.dateObj?.getTime?.() || game?.completedAtObj?.getTime?.() || 0;
    return [...completedGames].sort((a, b) => toSortTime(b) - toSortTime(a));
  }, [completedGames]);

  const standingsLogosFromLoadedGames = useMemo(() => {
    const logos = new Map<string, string>();
    const addLogo = (teamName: unknown, logo: unknown) => {
      if (typeof teamName !== "string" || !teamName.trim()) return;
      if (typeof logo !== "string" || !logo.trim()) return;
      const normalizedLogo = logo.trim();
      if (normalizedLogo.includes("/logos/liprobakin.png")) return;
      logos.set(normalizeTeamName(teamName).toLowerCase(), normalizedLogo);
    };

    const registerGame = (game: any) => {
      addLogo(game?.homeTeamName ?? game?.homeTeam ?? game?.team1, game?.homeTeamLogo);
      addLogo(game?.awayTeamName ?? game?.awayTeam ?? game?.team2, game?.awayTeamLogo);
    };

    completedGamesSorted.forEach(registerGame);
    liveGames.forEach(registerGame);
    allScheduledGames.forEach(registerGame);
    dynamicSpotlightGames.forEach(registerGame);
    weeklyScheduleGames.forEach(registerGame);

    return logos;
  }, [allScheduledGames, completedGamesSorted, dynamicSpotlightGames, liveGames, weeklyScheduleGames]);

  useEffect(() => {
    const container = finalBuzzerScrollRef.current;
    if (!container) {
      return;
    }

    // Keep newest games visible on the left.
    // Some browsers restore horizontal scroll position; force it back to the start.
    requestAnimationFrame(() => {
      container.scrollTo({ left: 0, behavior: "auto" });
    });
  }, [completedGamesSorted]);

  useEffect(() => {
    const cached = readHomeBootstrapCache();
    if (cached) {
      if (cached.menTeams.length > 0) setMenTeams(cached.menTeams);
      if (cached.womenTeams.length > 0) setWomenTeams(cached.womenTeams);
      if (cached.newsArticles.length > 0) {
        const hydratedNews = cached.newsArticles.map(fromCachedNewsArticle);
        setNewsArticles(hydratedNews);
        setFeaturedArticleId(cached.featuredArticleId ?? hydratedNews[0]?.id ?? null);
      }
      if (cached.partners.length > 0) setDynamicPartners(cached.partners);
      if (cached.committee.length > 0) setDynamicCommittee(cached.committee);
      if (cached.commission.length > 0) setDynamicCommission(cached.commission);
      if (cached.referees.length > 0) setDynamicReferees(cached.referees);
    }

    // Load stats cache (leagueTopPlayers) after hydration to avoid SSR mismatch.
    const statsCached = readHomeStatsCache();
    if (statsCached) {
      if (statsCached.leagueTopPlayers.length > 0) setLeagueTopPlayers(statsCached.leagueTopPlayers);
    }
  }, []);

  useEffect(() => {
    if (menTeams.length === 0 && womenTeams.length === 0) {
      return;
    }

    mergeHomeBootstrapCache({
      menTeams,
      womenTeams,
    });
  }, [menTeams, womenTeams]);

  useEffect(() => {
    if (newsArticles.length === 0) {
      return;
    }

    mergeHomeBootstrapCache({
      newsArticles: newsArticles.map(toCachedNewsArticle),
      featuredArticleId: featuredArticleId ?? newsArticles[0]?.id ?? null,
    });
  }, [newsArticles, featuredArticleId]);

  useEffect(() => {
    if (!expandedArticleId) {
      setArticleComments([]);
      setArticleCommentReplies([]);
      setArticleCommentsVisibleCount(6);
      setCommentWebsite("");
      setActiveReplyCommentId(null);
      setReplyName("");
      setReplyMessage("");
      setCommentError(null);
      return;
    }

    setArticleCommentsVisibleCount(6);
    setCommentError(null);

    const commentsRef = collection(firebaseDB, "news", expandedArticleId, "comments");
    const commentsQuery = query(commentsRef, orderBy("createdAt", "desc"), limit(100));

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const currentClientToken = getOrCreateArticleCommentClientToken();
        const comments = snapshot.docs
          .map((commentDoc) => {
            const data = commentDoc.data() as {
              name?: string;
              message?: string;
              ownerToken?: string;
              likedByTokens?: string[];
              createdAt?: { toDate?: () => Date } | Date;
            };

            const name = String(data.name || "").trim();
            const message = String(data.message || "").trim();
            if (!message) {
              return null;
            }

            const createdAt =
              data.createdAt instanceof Date
                ? data.createdAt
                : data.createdAt && typeof data.createdAt.toDate === "function"
                  ? data.createdAt.toDate()
                  : null;

            return {
              id: commentDoc.id,
              articleId: expandedArticleId,
              name: name || (language === "fr" ? "Anonyme" : "Anonymous"),
              message,
              createdAt,
              likesCount: Array.isArray(data.likedByTokens) ? data.likedByTokens.length : 0,
              likedByCurrentUser: Array.isArray(data.likedByTokens) && data.likedByTokens.includes(currentClientToken),
              canDelete: Boolean(data.ownerToken) && String(data.ownerToken) === currentClientToken,
            };
          })
          .filter((comment): comment is ArticleComment => !!comment);

        setArticleComments(comments);
      },
      (error) => {
        console.error("Error loading article comments:", error);
        setCommentError(language === "fr" ? "Impossible de charger les commentaires." : "Unable to load comments.");
      }
    );

    return () => unsubscribe();
  }, [expandedArticleId, language]);

  useEffect(() => {
    if (!expandedArticleId) {
      setArticleCommentReplies([]);
      return;
    }

    const repliesQuery = query(collectionGroup(firebaseDB, "replies"), limit(500));
    const unsubscribe = onSnapshot(repliesQuery, (snapshot) => {
      const replies = snapshot.docs
        .map((replyDoc) => {
          const path = replyDoc.ref.path;
          const expectedPrefix = `news/${expandedArticleId}/comments/`;

          if (!path.startsWith(expectedPrefix)) {
            return null;
          }

          const commentId = replyDoc.ref.parent.parent?.id;
          if (!commentId) {
            return null;
          }

          const data = replyDoc.data() as {
            name?: string;
            message?: string;
            createdAt?: { toDate?: () => Date } | Date;
          };

          const message = String(data.message || "").trim();
          if (!message) {
            return null;
          }

          const createdAt =
            data.createdAt instanceof Date
              ? data.createdAt
              : data.createdAt && typeof data.createdAt.toDate === "function"
                ? data.createdAt.toDate()
                : null;

          return {
            id: replyDoc.id,
            articleId: expandedArticleId,
            commentId,
            name: String(data.name || "").trim() || (language === "fr" ? "Anonyme" : "Anonymous"),
            message,
            createdAt,
          } as ArticleCommentReply;
        })
        .filter((reply): reply is ArticleCommentReply => !!reply);

      setArticleCommentReplies(replies);
    }, (error) => {
      console.error("Error loading comment replies:", error);
      setCommentError(language === "fr" ? "Impossible de charger les réponses." : "Unable to load replies.");
    });

    return () => unsubscribe();
  }, [expandedArticleId, language]);

  const handleSubmitArticleComment = useCallback(async () => {
    if (!expandedArticleId || isSubmittingComment) {
      return;
    }

    if (commentWebsite.trim()) {
      setCommentName("");
      setCommentMessage("");
      setCommentWebsite("");
      setCommentError(null);
      return;
    }

    const sanitizedName = commentName.trim().slice(0, 50);
    const sanitizedMessage = commentMessage.trim().slice(0, 600);
    const normalizedMessage = sanitizedMessage.toLowerCase();
    const moderationMessage = normalizeCommentModerationInput(sanitizedMessage);

    if (!sanitizedMessage) {
      setCommentError(language === "fr" ? "Le commentaire est requis." : "Comment is required.");
      return;
    }

    const hasBlockedTerm = ARTICLE_COMMENT_SPAM_TERMS.some((term) => normalizedMessage.includes(term));
    if (hasBlockedTerm) {
      setCommentError(
        language === "fr"
          ? "Votre commentaire contient un contenu non autorisé."
          : "Your comment contains disallowed content."
      );
      return;
    }

    const hasProfanity = ARTICLE_COMMENT_PROFANITY_TERMS.some((term) => moderationMessage.includes(term));
    if (hasProfanity) {
      setCommentError(
        language === "fr"
          ? "Les insultes et grossièretés ne sont pas autorisées."
          : "Curse and abusive words are not allowed."
      );
      return;
    }

    if (typeof window !== "undefined") {
      const cooldownStorageKey = `article-comment-cooldown:${expandedArticleId}`;
      const nextAllowedAtRaw = window.localStorage.getItem(cooldownStorageKey);
      const nextAllowedAt = Number.parseInt(nextAllowedAtRaw || "0", 10);
      const now = Date.now();

      if (Number.isFinite(nextAllowedAt) && nextAllowedAt > now) {
        const remainingSeconds = Math.ceil((nextAllowedAt - now) / 1000);
        setCommentError(
          language === "fr"
            ? `Veuillez attendre ${remainingSeconds}s avant de republier.`
            : `Please wait ${remainingSeconds}s before posting again.`
        );
        return;
      }

      const dailyKeyDate = new Date(now).toISOString().slice(0, 10);
      const dailyStorageKey = `article-comment-daily:${dailyKeyDate}`;
      const dailyCountRaw = window.localStorage.getItem(dailyStorageKey);
      const dailyCount = Number.parseInt(dailyCountRaw || "0", 10);

      if (Number.isFinite(dailyCount) && dailyCount >= ARTICLE_COMMENT_DAILY_LIMIT) {
        setCommentError(
          language === "fr"
            ? `Limite atteinte: ${ARTICLE_COMMENT_DAILY_LIMIT} commentaires aujourd'hui.`
            : `Limit reached: ${ARTICLE_COMMENT_DAILY_LIMIT} comments today.`
        );
        return;
      }
    }

    setIsSubmittingComment(true);
    setCommentError(null);

    try {
      const ownerToken = getOrCreateArticleCommentClientToken();
      await addDoc(collection(firebaseDB, "news", expandedArticleId, "comments"), {
        name: sanitizedName || (language === "fr" ? "Anonyme" : "Anonymous"),
        message: sanitizedMessage,
        ownerToken,
        createdAt: serverTimestamp(),
      });

      setCommentName("");
      setCommentMessage("");
      setCommentWebsite("");

      if (typeof window !== "undefined") {
        const cooldownStorageKey = `article-comment-cooldown:${expandedArticleId}`;
        const now = Date.now();
        const dailyKeyDate = new Date(now).toISOString().slice(0, 10);
        const dailyStorageKey = `article-comment-daily:${dailyKeyDate}`;
        const currentDailyCount = Number.parseInt(window.localStorage.getItem(dailyStorageKey) || "0", 10);

        window.localStorage.setItem(cooldownStorageKey, String(now + ARTICLE_COMMENT_COOLDOWN_MS));
        window.localStorage.setItem(dailyStorageKey, String((Number.isFinite(currentDailyCount) ? currentDailyCount : 0) + 1));
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      setCommentError(language === "fr" ? "Impossible d'ajouter le commentaire." : "Unable to post comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentMessage, commentName, commentWebsite, expandedArticleId, isSubmittingComment, language]);

  const handleDeleteArticleComment = useCallback(
    async (commentId: string) => {
      if (!expandedArticleId || !commentId || deletingCommentId) {
        return;
      }

      const commentToDelete = articleComments.find((comment) => comment.id === commentId);
      if (!commentToDelete?.canDelete) {
        setCommentError(
          language === "fr"
            ? "Vous ne pouvez supprimer que vos propres commentaires."
            : "You can delete only your own comments."
        );
        return;
      }

      setDeletingCommentId(commentId);
      setCommentError(null);

      try {
        await deleteDoc(doc(firebaseDB, "news", expandedArticleId, "comments", commentId));
      } catch (error) {
        console.error("Error deleting comment:", error);
        setCommentError(
          language === "fr"
            ? "Impossible de supprimer le commentaire."
            : "Unable to delete comment."
        );
      } finally {
        setDeletingCommentId(null);
      }
    },
    [articleComments, deletingCommentId, expandedArticleId, language]
  );

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!expandedArticleId || !commentId) {
        return;
      }

      try {
        const currentClientToken = getOrCreateArticleCommentClientToken();
        const targetComment = articleComments.find((comment) => comment.id === commentId);
        if (!targetComment) {
          return;
        }

        const commentRef = doc(firebaseDB, "news", expandedArticleId, "comments", commentId);
        if (targetComment.likedByCurrentUser) {
          await updateDoc(commentRef, {
            likedByTokens: arrayRemove(currentClientToken),
          });
        } else {
          await updateDoc(commentRef, {
            likedByTokens: arrayUnion(currentClientToken),
          });
        }
      } catch (error) {
        console.error("Error toggling comment like:", error);
        setCommentError(language === "fr" ? "Impossible de mettre à jour le like." : "Unable to update like.");
      }
    },
    [articleComments, expandedArticleId, language]
  );

  const handleSubmitCommentReply = useCallback(
    async (commentId: string) => {
      if (!expandedArticleId || !commentId || isSubmittingReply) {
        return;
      }

      const sanitizedName = replyName.trim().slice(0, 50);
      const sanitizedMessage = replyMessage.trim().slice(0, 600);
      const normalizedMessage = sanitizedMessage.toLowerCase();
      const moderationMessage = normalizeCommentModerationInput(sanitizedMessage);

      if (!sanitizedMessage) {
        setCommentError(language === "fr" ? "La réponse est requise." : "Reply is required.");
        return;
      }

      const hasBlockedTerm = ARTICLE_COMMENT_SPAM_TERMS.some((term) => normalizedMessage.includes(term));
      if (hasBlockedTerm) {
        setCommentError(
          language === "fr"
            ? "Votre réponse contient un contenu non autorisé."
            : "Your reply contains disallowed content."
        );
        return;
      }

      const hasProfanity = ARTICLE_COMMENT_PROFANITY_TERMS.some((term) => moderationMessage.includes(term));
      if (hasProfanity) {
        setCommentError(
          language === "fr"
            ? "Les insultes et grossièretés ne sont pas autorisées."
            : "Curse and abusive words are not allowed."
        );
        return;
      }

      setIsSubmittingReply(true);
      setCommentError(null);

      try {
        await addDoc(collection(firebaseDB, "news", expandedArticleId, "comments", commentId, "replies"), {
          name: sanitizedName || (language === "fr" ? "Anonyme" : "Anonymous"),
          message: sanitizedMessage,
          createdAt: serverTimestamp(),
        });

        setReplyName("");
        setReplyMessage("");
        setActiveReplyCommentId(null);
      } catch (error) {
        console.error("Error posting reply:", error);
        setCommentError(language === "fr" ? "Impossible d'ajouter la réponse." : "Unable to post reply.");
      } finally {
        setIsSubmittingReply(false);
      }
    },
    [expandedArticleId, isSubmittingReply, language, replyMessage, replyName]
  );

  useEffect(() => {
    if (!Array.isArray(dynamicPartners) || dynamicPartners.length === 0) {
      return;
    }

    mergeHomeBootstrapCache({
      partners: dynamicPartners.map((partner) => ({
        id: String(partner.id ?? ""),
        name: String(partner.name ?? ""),
        logo: String(partner.logo ?? ""),
      })),
    });
  }, [dynamicPartners]);

  useEffect(() => {
    if (dynamicCommittee.length === 0 && dynamicCommission.length === 0 && dynamicReferees.length === 0) {
      return;
    }

    mergeHomeBootstrapCache({
      committee: dynamicCommittee,
      commission: dynamicCommission,
      referees: dynamicReferees,
    });
  }, [dynamicCommittee, dynamicCommission, dynamicReferees]);

  const scrollFinalBuzzer = useCallback((direction: "prev" | "next") => {
    const container = finalBuzzerScrollRef.current;
    if (!container) {
      return;
    }

    const amount = Math.max(container.clientWidth * 0.8, 280);
    container.scrollBy({
      left: direction === "next" ? amount : -amount,
      behavior: "smooth",
    });
  }, []);
  const spotlightGames = dynamicSpotlightGames;

  // Load gender selection from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('selectedGender');
      if (saved === 'men' || saved === 'women') {
        setGender(saved);
      }
    }
  }, []);

  // Save gender selection to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedGender', gender);
    }
  }, [gender]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth > 768) {
      return;
    }

    const photoNodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-standing-player-photo-id]")
    );

    if (photoNodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const element = entry.target as HTMLElement;
          const photoId = element.dataset.standingPlayerPhotoId;

          if (!photoId || glowedStandingPlayerPhotoIdsRef.current.has(photoId)) {
            observer.unobserve(element);
            return;
          }

          glowedStandingPlayerPhotoIdsRef.current.add(photoId);
          setGlowedStandingPlayerPhotos((previous) => ({
            ...previous,
            [photoId]: true,
          }));

          observer.unobserve(element);
        });
      },
      { threshold: 0.45 }
    );

    photoNodes.forEach((node) => {
      const photoId = node.dataset.standingPlayerPhotoId;
      if (!photoId || glowedStandingPlayerPhotoIdsRef.current.has(photoId)) {
        return;
      }
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, [playersGender, playerMetric, leagueLeadersExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const standingsSection = document.getElementById("standings");
    if (!standingsSection) {
      return;
    }

    let wasIntersecting = false;
    let glowDelayTimeout: NodeJS.Timeout | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !wasIntersecting) {
            // Wait 2 seconds before starting glow
            glowDelayTimeout = setTimeout(() => {
              setStandingsAutoShine(true);

              if (standingsShineTimeoutRef.current) {
                clearTimeout(standingsShineTimeoutRef.current);
              }

              standingsShineTimeoutRef.current = setTimeout(() => {
                setStandingsAutoShine(false);
                standingsShineTimeoutRef.current = null;
              }, 4500); // 4.5s to match goldAutoShineTwice animation duration
            }, 2000);
          } else if (!entry.isIntersecting && glowDelayTimeout) {
            clearTimeout(glowDelayTimeout);
            glowDelayTimeout = null;
          }

          wasIntersecting = entry.isIntersecting;
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(standingsSection);

    return () => {
      observer.disconnect();
      if (standingsShineTimeoutRef.current) {
        clearTimeout(standingsShineTimeoutRef.current);
        standingsShineTimeoutRef.current = null;
      }
    };
  }, []);

  // Teams section now static – no auto-scroll animations

  // Save scroll position before navigating away
  useEffect(() => {
    const saveScrollPosition = () => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('scrollPosition', window.scrollY.toString());
      }
    };

    window.addEventListener('beforeunload', saveScrollPosition);
    
    // Save on navigation
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href && !link.href.includes('#')) {
        saveScrollPosition();
      }
    };
    
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('beforeunload', saveScrollPosition);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // Restore scroll position on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPosition = sessionStorage.getItem('scrollPosition');
      if (savedPosition) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedPosition, 10));
          sessionStorage.removeItem('scrollPosition');
        }, 100);
      }
    }
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      const cached = readHomeBootstrapCache();
      if (cached && cached.menTeams.length > 0 && cached.womenTeams.length > 0) {
        return;
      }

      try {
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);

        const canonicalFranchiseKey = (team: Franchise) => {
          const fullName = buildTeamDisplayName(team);
          return normalizeTeamName(fullName).toLowerCase().replace(/\s+/g, " ");
        };

        const scoreFranchise = (team: Franchise) => {
          let score = 0;
          if (team.city && team.city.trim()) score += 1;
          if (team.logo && !team.logo.includes("/logos/liprobakin.png")) score += 2;
          const colors = Array.isArray(team.colors) ? team.colors : [];
          if (colors.length >= 2 && !(colors[0] === "#1e293b" && colors[1] === "#0f172a")) score += 1;
          return score;
        };

        const menByKey = new Map<string, Franchise>();
        const womenByKey = new Map<string, Franchise>();
        teamsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const colors: [string, string] = Array.isArray(data.colors) && data.colors.length >= 2
            ? [data.colors[0], data.colors[1]]
            : ["#1e293b", "#0f172a"];
          
          const franchise: Franchise = {
            city: data.city ?? "",
            name: data.name ?? doc.id,
            colors,
            logo: resolveTeamLogo({ city: data.city ?? "", name: data.name ?? doc.id, logo: data.logo ?? null }),
          };

          const teamGender = normalizeTeamGender(data.gender, data.logo, "men");

          const key = canonicalFranchiseKey(franchise);
          const target = teamGender === "women" ? womenByKey : menByKey;
          const existing = target.get(key);
          if (!existing) {
            target.set(key, franchise);
            return;
          }

          if (scoreFranchise(franchise) > scoreFranchise(existing)) {
            target.set(key, franchise);
          }
        });

        const men = Array.from(menByKey.values()).sort((a, b) => a.name.localeCompare(b.name));
        const women = Array.from(womenByKey.values()).sort((a, b) => a.name.localeCompare(b.name));

        setMenTeams(men);
        setWomenTeams(women);
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };
    
    fetchTeams();
  }, []);

  useEffect(() => {
    // Real-time listener for news articles
    const newsRef = collection(firebaseDB, "news");
    // Fetch a small window (includes paused articles that will be filtered out)
    const newsQuery = query(newsRef, orderBy("createdAt", "desc"), limit(20));
    
    const unsubscribe = onSnapshot(newsQuery, (snapshot) => {
      const articles: NewsArticle[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "",
          title_en: data.title_en || "",
          summary: data.summary || "",
          summary_en: data.summary_en || "",
          category: data.category || "News",
          headline: data.headline || "",
          headline_en: data.headline_en || "",
          imageUrl: isTrustedNewsMediaUrl(data.imageUrl) ? data.imageUrl : undefined,
          additionalMedia: Array.isArray(data.additionalMedia)
            ? data.additionalMedia
                .map((item: unknown, index: number) =>
                  normalizeAdditionalMediaItem(
                    item && typeof item === "object"
                      ? (item as Partial<NormalizedAdditionalMediaItem>)
                      : null,
                    index
                  )
                )
                .filter((item: NormalizedAdditionalMediaItem | null): item is NormalizedAdditionalMediaItem => !!item)
            : [],
          additionalImageUrls: Array.isArray(data.additionalImageUrls)
            ? data.additionalImageUrls.filter((url: unknown): url is string => isTrustedNewsMediaUrl(typeof url === "string" ? url : ""))
            : [],
          videoUrl: isTrustedNewsMediaUrl(data.videoUrl) ? data.videoUrl : undefined,
          videoTrimStart: data.videoTrimStart ?? 0,
          videoTrimEnd: data.videoTrimEnd ?? null,
          videoScale: data.videoScale ?? 1,
          videoOffsetX: data.videoOffsetX ?? 0,
          videoOffsetY: data.videoOffsetY ?? 0,
          imagePosition: data.imagePosition ?? 50,
          createdAt: data.createdAt?.toDate() || null,
          author: data.author || "LIPROBAKIN Staff",
          authorPhoto: data.authorPhoto || "",
          isPaused: data.isPaused || false,
        };
      }).filter(article => !article.isPaused); // Filter out paused articles
      // Limit to last 7 published articles
      setNewsArticles(articles.slice(0, 7));
      if (articles.length > 0 && !featuredArticleId) {
        setFeaturedArticleId(articles[0].id);
      }
    }, (error) => {
      console.error("❌ Error fetching news:", error);
    });
    
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || newsArticles.length === 0) {
      return;
    }

    const articleId = new URLSearchParams(window.location.search).get("article");
    if (!articleId) {
      return;
    }

    const matchingArticle = newsArticles.find((article) => article.id === articleId);
    if (!matchingArticle) {
      return;
    }

    setFeaturedArticleId(matchingArticle.id);
    setExpandedArticleId(matchingArticle.id);
    // Replace (not push) so the initial load doesn't create an extra history entry
    const initUrl = new URL(window.location.href);
    initUrl.searchParams.set("article", matchingArticle.id);
    window.history.replaceState({ articleId: matchingArticle.id }, "", initUrl.toString());
  }, [newsArticles]);

  // Listen for browser back/forward to sync expanded article with URL
  useEffect(() => {
    const onPopState = () => {
      const articleId = new URLSearchParams(window.location.search).get("article");
      setExpandedArticleId(articleId);
      if (articleId) {
        const match = newsArticles.find((a) => a.id === articleId);
        if (match) setFeaturedArticleId(match.id);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [newsArticles]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firebaseDB, "partners"),
      (snapshot) => {
        const partners = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "",
            logo: data.logo || "",
          };
        });

        setDynamicPartners(partners);
      },
      (error) => {
        console.error("Error fetching partners:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch player profile data from Firestore if user is a verified player
    // Using real-time listener for instant updates when player data changes
    if (!userProfile?.role || !userProfile?.verificationStatus || !userProfile?.teamName) {
      setPlayerData(null);
      setNextGame(null);
      return;
    }

    if (userProfile.role !== "player" || userProfile.verificationStatus !== "approved" || !userProfile.teamName) {
      setPlayerData(null);
      setNextGame(null);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setupRealTimeListener = async () => {
      try {
        // Find the team in Firestore
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        
        let targetTeamId: string | null = null;
        
        // Find the team document that matches the user's teamName
        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          const teamDocName = teamData.name ?? "";
          const teamDocCity = teamData.city ?? "";
          const fullTeamName = buildTeamDisplayName({ city: teamDocCity, name: teamDocName });
          
          if (fullTeamName === userProfile.teamName || teamDocName === userProfile.teamName) {
            targetTeamId = teamDoc.id;
            break;
          }
        }
        
        if (!targetTeamId) {
          console.log("Team not found in Firestore:", userProfile.teamName);
          setPlayerData(null);
          setNextGame(null);
          return;
        }
        
        // Set up real-time listener on the roster subcollection
        const rosterRef = collection(firebaseDB, `teams/${targetTeamId}/roster`);
        
        unsubscribe = onSnapshot(rosterRef, (rosterSnapshot) => {
          if (rosterSnapshot.empty) {
            console.log("No roster found for team:", userProfile.teamName);
            setPlayerData(null);
            setNextGame(null);
            return;
          }
          
          // Find the specific player by linkedPlayerId (preferred) or player number (fallback)
          let foundPlayer: RosterPlayer | null = null;
          
          // First try to find by linkedPlayerId (set during verification approval)
          if (userProfile.linkedPlayerId) {
            const playerDoc = rosterSnapshot.docs.find(doc => doc.id === userProfile.linkedPlayerId);
            if (playerDoc) {
              const pData = playerDoc.data();
              // Add cache-buster to headshot URL to force refresh
              const headshotUrl = pData.headshot 
                ? `${pData.headshot}${pData.headshot.includes('?') ? '&' : '?'}t=${Date.now()}`
                : "/players/default-avatar.png";
              foundPlayer = {
                name: `${pData.firstName || ""} ${pData.lastName || ""}`.trim(),
                number: pData.number ?? 0,
                height: pData.height ?? "",
                headshot: headshotUrl,
                position: pData.position ?? "",
                stats: {
                  pts: pData.stats?.pts ?? "0.0",
                  reb: pData.stats?.reb ?? "0.0",
                  ast: pData.stats?.ast ?? "0.0",
                  blk: pData.stats?.blk ?? "0.0",
                  stl: pData.stats?.stl ?? "0.0"
                }
              };
            }
          }
          
          // Fallback: find by player number if linkedPlayerId not available
          if (!foundPlayer && userProfile.playerNumber) {
            for (const playerDoc of rosterSnapshot.docs) {
              const pData = playerDoc.data();
              if (pData.number?.toString() === userProfile.playerNumber.toString()) {
                // Add cache-buster to headshot URL to force refresh
                const headshotUrl = pData.headshot 
                  ? `${pData.headshot}${pData.headshot.includes('?') ? '&' : '?'}t=${Date.now()}`
                  : "/players/default-avatar.png";
                foundPlayer = {
                  name: `${pData.firstName || ""} ${pData.lastName || ""}`.trim(),
                  number: pData.number ?? 0,
                  height: pData.height ?? "",
                  headshot: headshotUrl,
                  position: pData.position ?? "",
                  stats: {
                    pts: pData.stats?.pts ?? "0.0",
                    reb: pData.stats?.reb ?? "0.0",
                    ast: pData.stats?.ast ?? "0.0",
                    blk: pData.stats?.blk ?? "0.0",
                    stl: pData.stats?.stl ?? "0.0"
                  }
                };
                break;
              }
            }
          }
          
          if (foundPlayer) {
            setPlayerData(foundPlayer);
            
            // Find next game for this player's team
            const upcomingGames = dynamicSpotlightGames.filter(game => {
              if (!game.dateTime) return false;
              const now = getDRCNow();
              const gameDate = new Date(game.dateTime);
              return gameDate > now && (game.homeTeam === userProfile.teamName || game.awayTeam === userProfile.teamName);
            }).sort((a, b) => {
              const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
              const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
              return dateA - dateB;
            });
            
            if (upcomingGames.length > 0) {
              setNextGame(upcomingGames[0]);
            } else {
              setNextGame(null);
            }
          } else {
            console.log("Player not found in team roster");
            setPlayerData(null);
            setNextGame(null);
          }
        }, (error) => {
          console.error("Error in roster listener:", error);
          setPlayerData(null);
          setNextGame(null);
        });
        
      } catch (error) {
        console.error("Error setting up player data listener:", error);
        setPlayerData(null);
        setNextGame(null);
      }
    };
    
    setupRealTimeListener();
    
    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userProfile, dynamicSpotlightGames]);

  // Countdown timer for next game
  useEffect(() => {
    if (!nextGame?.dateTime) {
      setGameCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const gameDate = new Date(nextGame.dateTime!);
      const now = getDRCNow();
      const diff = gameDate.getTime() - now.getTime();

      if (diff <= 0) {
        setGameCountdown(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const isGameDay = days === 0;

      setGameCountdown({ days, hours, minutes, seconds, isGameDay });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextGame]);

  useEffect(() => {
    const cached = readHomeBootstrapCache();
    if (cached && cached.committee.length > 0) {
      setDynamicCommittee(cached.committee);
    }
    if (cached && cached.commission.length > 0) {
      setDynamicCommission(cached.commission);
    }
    if (cached && cached.referees.length > 0) {
      setDynamicReferees(cached.referees);
    }

    if (cached && cached.committee.length > 0 && cached.commission.length > 0 && cached.referees.length > 0) {
      return;
    }

    const fetchCommittee = async () => {
      try {
        const committeeRef = collection(firebaseDB, "committee");
        const committeeSnapshot = await getDocs(committeeRef);
        
        // Helper function to determine role priority
        const getRolePriority = (role: string): number => {
          const r = role.toLowerCase().trim();
          
          // President (priority 1)
          if (r.includes("president") || r.includes("président")) return 1;
          
          // 1st Vice (priority 2)
          if ((r.includes("1") || r.includes("first") || r.includes("1er") || r.includes("premier")) && r.includes("vice")) return 2;
          
          // 2nd Vice (priority 3)
          if ((r.includes("2") || r.includes("second") || r.includes("2e") || r.includes("deuxième")) && r.includes("vice")) return 3;
          
          // Secretary (priority 4)
          if (r.includes("secr") || r.includes("secretary")) return 4;
          
          // Treasurer (priority 5)
          if (r.includes("tres") || r.includes("trés") || r.includes("treasurer")) return 5;
          
          // All other members (priority 999)
          return 999;
        };
        
        const members = committeeSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            role: data.role || "",
            photo: data.photo || "",
          };
        }).sort((a, b) => {
          const aPriority = getRolePriority(a.role);
          const bPriority = getRolePriority(b.role);
          
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          
          return a.name.localeCompare(b.name);
        });
        
        setDynamicCommittee(members);
      } catch (error) {
        console.error("Error fetching committee:", error);
      }
    };
    
    const fetchCommission = async () => {
      try {
        const commissionRef = collection(firebaseDB, "commission");
        const commissionSnapshot = await getDocs(commissionRef);
        
        const members = commissionSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            role: data.role || "",
            photo: data.photo || "",
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        
        setDynamicCommission(members);
      } catch (error) {
        console.error("Error fetching commission:", error);
      }
    };
    
    const fetchReferees = async () => {
      try {
        const refereesRef = collection(firebaseDB, "referees");
        const refereesSnapshot = await getDocs(refereesRef);
        
        const refs = refereesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            role: language === "fr" ? "Arbitre" : "Referee",
            photo: data.headshot || "",
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        
        setDynamicReferees(refs);
      } catch (error) {
        console.error("Error fetching referees:", error);
      }
    };
    
    fetchCommittee();
    fetchCommission();
    fetchReferees();
  }, [language]);

  useEffect(() => {
    const STANDINGS_HISTORY_KEY = "liprobakin:standings-history";
    let historyLoaded = false;

    const loadStandingsHistory = () => {
      if (historyLoaded || typeof window === "undefined") return;
      historyLoaded = true;
      try {
        const raw = window.localStorage.getItem(STANDINGS_HISTORY_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (parsed && typeof parsed === "object") {
          standingsHistoryRef.current = parsed;
        }
      } catch {
        // Ignore malformed local storage data
      }
    };

    const persistStandingsHistory = (history: Record<string, number>) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(STANDINGS_HISTORY_KEY, JSON.stringify(history));
      } catch {
        // Ignore storage quota / privacy errors
      }
    };
    const buildForfeitLossCounts = (singleForfeitSnapshot: any, doubleForfeitSnapshot: any) => {
      const counts = new Map<string, number>();
      const addLoss = (teamId?: string) => {
        if (!teamId) return;
        counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
      };

      singleForfeitSnapshot.docs.forEach((gameDoc: any) => {
        const data = gameDoc.data?.() ?? gameDoc.data ?? {};
        const explicitLoserTeamId = typeof data.loserTeamId === "string" ? data.loserTeamId : "";
        const homeTeamId = typeof data.homeTeamId === "string" ? data.homeTeamId : "";
        const awayTeamId = typeof data.awayTeamId === "string" ? data.awayTeamId : "";
        const winnerTeamId = typeof data.winnerTeamId === "string" ? data.winnerTeamId : typeof data.winnerId === "string" ? data.winnerId : "";

        if (explicitLoserTeamId) {
          addLoss(explicitLoserTeamId);
          return;
        }

        if (winnerTeamId && homeTeamId && awayTeamId) {
          addLoss(winnerTeamId === homeTeamId ? awayTeamId : homeTeamId);
        }
      });

      doubleForfeitSnapshot.docs.forEach((gameDoc: any) => {
        const data = gameDoc.data?.() ?? gameDoc.data ?? {};
        addLoss(typeof data.homeTeamId === "string" ? data.homeTeamId : "");
        addLoss(typeof data.awayTeamId === "string" ? data.awayTeamId : "");
      });

      return counts;
    };

    const buildTeamLogoMapFromGames = (gamesSnapshot: any) => {
      const logos = new Map<string, string>();
      const addLogo = (teamId: unknown, teamName: unknown, logo: unknown) => {
        if (typeof logo !== "string" || !logo.trim()) return;
        const normalizedLogo = logo.trim();
        if (typeof teamId === "string" && teamId.trim()) {
          logos.set(teamId.trim(), normalizedLogo);
        }
        if (typeof teamName === "string" && teamName.trim()) {
          logos.set(normalizeTeamName(teamName).toLowerCase(), normalizedLogo);
        }
      };

      gamesSnapshot.docs.forEach((gameDoc: any) => {
        const data = gameDoc.data?.() ?? gameDoc.data ?? {};
        addLogo(data.homeTeamId, data.homeTeamName ?? data.homeTeam ?? data.team1, data.homeTeamLogo ?? data.team1Logo);
        addLogo(data.awayTeamId, data.awayTeamName ?? data.awayTeam ?? data.team2, data.awayTeamLogo ?? data.team2Logo);
      });

      return logos;
    };

    const calculateStandingsFromTeams = (snapshot: any, forfeitLossCounts: Map<string, number>, teamLogosFromGames: Map<string, string>) => {
      try {
        loadStandingsHistory();

        const standingsArray: Array<{
          seed: number;
          teamKey: string;
          teamId: string;
          team: string;
          logo: string;
          wins: number;
          losses: number;
          totalPoints: number;
          leaguePoints: number;
          gender: "men" | "women";
        }> = snapshot.docs
          .map((teamDoc: any) => {
            const data = teamDoc.data?.() ?? teamDoc.data ?? {};
            const teamId = teamDoc.id;
            const baseName = String(data.name || data.teamName || "").trim();
            if (!baseName) return null;

            const teamGender = normalizeTeamGender(data.gender, data.logo, "men") as "men" | "women";
            const teamName = buildTeamDisplayName({
              city: String(data.city || "").trim(),
              name: baseName,
            });
            const fallbackLogoFromGames = teamLogosFromGames.get(teamId) ?? teamLogosFromGames.get(normalizeTeamName(teamName).toLowerCase()) ?? null;
            const rawTeamLogo = typeof data.logo === "string" ? data.logo.trim() : "";
            const preferredTeamLogo = rawTeamLogo && !rawTeamLogo.includes("/logos/liprobakin.png") ? rawTeamLogo : fallbackLogoFromGames;
            const teamLogo = getResolvedTeamLogo({
              teamName: teamName,
              logo: preferredTeamLogo,
            });
            const wins = typeof data.wins === "number" && Number.isFinite(data.wins) ? data.wins : 0;
            const losses = typeof data.losses === "number" && Number.isFinite(data.losses) ? data.losses : 0;
            const totalPoints = typeof data.totalPoints === "number" && Number.isFinite(data.totalPoints) ? data.totalPoints : 0;
            const leaguePoints = getLeaguePoints(wins, losses, forfeitLossCounts.get(teamId) ?? 0);

            return {
              seed: 0,
              teamKey: `${teamGender}:${teamId}`,
              teamId,
              team: teamName,
              logo: teamLogo,
              wins,
              losses,
              totalPoints,
              leaguePoints,
              gender: teamGender,
            };
          })
          .filter(
            (
              team: unknown
            ): team is {
              seed: number;
              teamKey: string;
              teamId: string;
              team: string;
              logo: string;
              wins: number;
              losses: number;
              totalPoints: number;
              leaguePoints: number;
              gender: "men" | "women";
            } => Boolean(team)
          );

        standingsArray.sort((
          a: {
            seed: number;
            teamKey: string;
            teamId: string;
            team: string;
            wins: number;
            losses: number;
            totalPoints: number;
            leaguePoints: number;
            gender: "men" | "women";
          },
          b: {
            seed: number;
            teamKey: string;
            teamId: string;
            team: string;
            logo: string;
            wins: number;
            losses: number;
            totalPoints: number;
            leaguePoints: number;
            gender: "men" | "women";
          }
        ) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (a.losses !== b.losses) return a.losses - b.losses;
          if ((b.leaguePoints ?? 0) !== (a.leaguePoints ?? 0)) return (b.leaguePoints ?? 0) - (a.leaguePoints ?? 0);
          if ((b.totalPoints ?? 0) !== (a.totalPoints ?? 0)) return (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
          return a.team.localeCompare(b.team);
        });

        const menStandings = standingsArray.filter((s) => s.gender === "men");
        const womenStandings = standingsArray.filter((s) => s.gender === "women");
        menStandings.forEach((s, i) => (s.seed = i + 1));
        womenStandings.forEach((s, i) => (s.seed = i + 1));

        const previousRanks = standingsHistoryRef.current;
        const finalStandings = [...menStandings, ...womenStandings].map((standing) => {
          const previousSeed = previousRanks[standing.teamKey];
          const rankChange =
            typeof previousSeed === "number"
              ? standing.seed < previousSeed
                ? "up"
                : standing.seed > previousSeed
                  ? "down"
                  : "same"
              : "same";
          return { ...standing, rankChange };
        });

        const nextRanks: Record<string, number> = {};
        finalStandings.forEach((standing) => {
          nextRanks[standing.teamKey] = standing.seed;
        });
        standingsHistoryRef.current = nextRanks;
        persistStandingsHistory(nextRanks);

        return finalStandings;
      } catch (error) {
        console.error("Error calculating standings:", error);
        return [];
      }
    };

    const toNumber = (value: unknown): number => {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
      }

      if (typeof value === "string") {
        const cleaned = value.trim().replace(/,/g, ".").replace(/[^0-9.+\-]/g, "");
        const parsed = Number.parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
      }

      return 0;
    };

    const resolveEvaluation = (statsSource: Record<string, unknown>) => {
      const evStored = toNumber(statsSource.evl ?? statsSource.ev);
      if (evStored !== 0) {
        return evStored;
      }

      const pts = toNumber(statsSource.pts ?? statsSource.points);
      const rebDirect = toNumber(statsSource.reb ?? statsSource.rebounds);
      const oreb = toNumber(statsSource.oreb ?? statsSource.offensiveRebounds);
      const dreb = toNumber(statsSource.dreb ?? statsSource.defensiveRebounds);
      const reb = rebDirect > 0 ? rebDirect : oreb + dreb;
      const ast = toNumber(statsSource.ast ?? statsSource.assists);
      const stl = toNumber(statsSource.stl ?? statsSource.steals);
      const blk = toNumber(statsSource.blk ?? statsSource.blocks);
      const turnovers = toNumber(statsSource.to ?? statsSource.turnovers);
      const twoPa = toNumber(statsSource.two_pa ?? statsSource.twoPointsAttempted);
      const threePa = toNumber(statsSource.three_pa ?? statsSource.threePointsAttempted);
      const twoPm = toNumber(statsSource.two_pm ?? statsSource.twoPointsMade);
      const threePm = toNumber(statsSource.three_pm ?? statsSource.threePointsMade);
      const fga = toNumber(statsSource.fga ?? statsSource.fieldGoalsAttempted) || (twoPa + threePa);
      const fgm = toNumber(statsSource.fgm ?? statsSource.fieldGoalsMade) || (twoPm + threePm);
      const fta = toNumber(statsSource.ft_a ?? statsSource.freeThrowsAttempted);
      const ftm = toNumber(statsSource.ft_m ?? statsSource.freeThrowsMade);

      return pts + reb + ast + stl + blk - turnovers - (fga - fgm) - (fta - ftm);
    };

    const toMillis = (value: unknown) => {
      if (value && typeof value === "object" && "toMillis" in (value as Record<string, unknown>) && typeof (value as { toMillis?: unknown }).toMillis === "function") {
        return ((value as { toMillis: () => number }).toMillis());
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      return 0;
    };

    const getHomeStatsVersion = async () => {
      const [teamsUpdatedSnap, gamesUpdatedSnap] = await Promise.all([
        getDocs(query(collection(firebaseDB, "teams"), orderBy("updatedAt", "desc"), limit(1))),
        getDocs(query(collection(firebaseDB, "games"), orderBy("updatedAt", "desc"), limit(1))),
      ]);

      const teamsUpdatedAt = teamsUpdatedSnap.docs[0]?.data()?.updatedAt;
      const gamesUpdatedAt = gamesUpdatedSnap.docs[0]?.data()?.updatedAt;
      return Math.max(toMillis(teamsUpdatedAt), toMillis(gamesUpdatedAt));
    };

    let activeRefreshToken = 0;

    const refreshHomeStats = async (version: number) => {
      const refreshToken = ++activeRefreshToken;
      try {
        const [teamsSnapshot, singleForfeitSnapshot, doubleForfeitSnapshot, gamesSnapshot] = await Promise.all([
          getDocs(collection(firebaseDB, "teams")),
          getDocs(query(collection(firebaseDB, "games"), where("winByForfeit", "==", true))),
          getDocs(query(collection(firebaseDB, "games"), where("status", "==", "forfeit"))),
          getDocs(collection(firebaseDB, "games")),
        ]);
        const forfeitLossCounts = buildForfeitLossCounts(singleForfeitSnapshot, doubleForfeitSnapshot);
        const teamLogosFromGames = buildTeamLogoMapFromGames(gamesSnapshot);
        const standings = calculateStandingsFromTeams(teamsSnapshot, forfeitLossCounts, teamLogosFromGames);

        if (refreshToken !== activeRefreshToken) return;

        setDynamicStandings(standings);
        writeHomeStatsCache({
          version,
          standings,
          leagueTopPlayers: readHomeStatsCache()?.leagueTopPlayers ?? [],
        });
      } catch (error) {
        console.error("Error refreshing home stats:", error);
      }
    };

    let cancelled = false;

    const bootstrapHomeStats = async () => {
      try {
        const version = await getHomeStatsVersion();
        if (cancelled) return;

        const cache = readHomeStatsCache();
        if (cache && cache.version === version && cache.standings.length > 0) {
          setDynamicStandings(cache.standings);
          return;
        }

        await refreshHomeStats(version);
      } catch (error) {
        console.error("Error bootstrapping home stats:", error);
      }
    };

    bootstrapHomeStats();

    const unsubscribeTeams = onSnapshot(
      query(collection(firebaseDB, "teams"), orderBy("updatedAt", "desc"), limit(1)),
      () => {
        void bootstrapHomeStats();
      }
    );

    const unsubscribeGames = onSnapshot(
      query(collection(firebaseDB, "games"), orderBy("updatedAt", "desc"), limit(1)),
      () => {
        void bootstrapHomeStats();
      }
    );

    return () => {
      cancelled = true;
      activeRefreshToken += 1;
      unsubscribeTeams();
      unsubscribeGames();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let fallbackRequested = false;

    const applyProjectorPlayers = (players: any[]) => {
      if (cancelled || !Array.isArray(players) || players.length === 0) {
        return;
      }

      setLeagueTopPlayers(players);

      const cache = readHomeStatsCache();
      writeHomeStatsCache({
        version: cache?.version ?? 0,
        standings: cache?.standings ?? dynamicStandings ?? [],
        leagueTopPlayers: players,
      });
    };

    const loadFallbackProjector = async () => {
      if (fallbackRequested) {
        return;
      }

      fallbackRequested = true;
      try {
        const players = await fetchHomeProjectorPlayers();
        applyProjectorPlayers(players);
      } catch (error) {
        console.error("Error loading fallback home projector players:", error);
      }
    };

    const unsubscribeProjector = onSnapshot(
      doc(firebaseDB, HOME_PROJECTOR_COLLECTION, HOME_PROJECTOR_DOC),
      (snapshot) => {
        const data = snapshot.data() as { players?: any[] } | undefined;
        if (!data || !Array.isArray(data.players) || data.players.length === 0) {
          if (leagueTopPlayers.length === 0 && !projectorFallbackTimeoutRef.current) {
            projectorFallbackTimeoutRef.current = setTimeout(() => {
              projectorFallbackTimeoutRef.current = null;
              void loadFallbackProjector();
            }, 1500);
          }
          return;
        }

        if (projectorFallbackTimeoutRef.current) {
          clearTimeout(projectorFallbackTimeoutRef.current);
          projectorFallbackTimeoutRef.current = null;
        }

        applyProjectorPlayers(data.players);
      },
      (error) => {
        console.error("Error listening to home projector cache:", error);
        if (leagueTopPlayers.length === 0 && !projectorFallbackTimeoutRef.current) {
          projectorFallbackTimeoutRef.current = setTimeout(() => {
            projectorFallbackTimeoutRef.current = null;
            void loadFallbackProjector();
          }, 1500);
        }
      }
    );

    return () => {
      cancelled = true;
      if (projectorFallbackTimeoutRef.current) {
        clearTimeout(projectorFallbackTimeoutRef.current);
        projectorFallbackTimeoutRef.current = null;
      }
      unsubscribeProjector();
    };
  }, [dynamicStandings, leagueTopPlayers.length]);

  // Auto-rotate non-video featured news articles every configured interval
  useEffect(() => {
    if (newsArticles.length <= 1 || expandedArticleId) return;

    const featuredArticle = newsArticles.find((article) => article.id === featuredArticleId);
    if (featuredArticle?.videoUrl) return;
    
    const interval = setInterval(() => {
      setNewsArticles(prev => {
        if (prev.length === 0) return prev;
        
        // Trigger fade out
        setIsArticleChanging(true);
        
        // Find current featured index
        const currentIndex = prev.findIndex(article => article.id === featuredArticleId);
        // Get next article (wrap around to start)
        const nextIndex = (currentIndex + 1) % prev.length;
        
        // Wait for fade out, then change article
        setTimeout(() => {
          setFeaturedArticleId(prev[nextIndex].id);
          // Fade back in
          setTimeout(() => setIsArticleChanging(false), 50);
        }, 300);
        
        return prev;
      });
    }, NEWS_ARTICLE_SWITCH_MS);
    
    return () => clearInterval(interval);
  }, [newsArticles, featuredArticleId, expandedArticleId]);

  useEffect(() => {
    return () => {
      if (featuredVideoRotateTimeoutRef.current) {
        clearTimeout(featuredVideoRotateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (featuredVideoRotateTimeoutRef.current) {
      clearTimeout(featuredVideoRotateTimeoutRef.current);
      featuredVideoRotateTimeoutRef.current = null;
    }
    setIsFeaturedVideoMuted(true);
    featuredVideoCompletionRef.current = false;
    featuredArticleStartTimeRef.current = Date.now();
  }, [featuredArticleId]);

  useEffect(() => {
    if (!expandedArticleId) return;
    if (featuredVideoRotateTimeoutRef.current) {
      clearTimeout(featuredVideoRotateTimeoutRef.current);
      featuredVideoRotateTimeoutRef.current = null;
    }
  }, [expandedArticleId]);

  useEffect(() => {
    if (!expandedArticleId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const panel = expandedArticlePanelRef.current;
      if (!panel) {
        return;
      }

      const target = event.target as Node | null;
      if (target && panel.contains(target)) {
        return;
      }

      expandArticle(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        expandArticle(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedArticleId]);

  const rotateToNextArticle = useCallback((currentFeaturedId: string) => {
    if (newsArticles.length <= 1 || expandedArticleId) return;
    setIsArticleChanging(true);
    const currentIndex = newsArticles.findIndex((article) => article.id === currentFeaturedId);
    const nextIndex = (currentIndex + 1) % newsArticles.length;
    setTimeout(() => {
      setFeaturedArticleId(newsArticles[nextIndex].id);
      setTimeout(() => setIsArticleChanging(false), 50);
    }, 300);
  }, [newsArticles, expandedArticleId]);

  const rotateToNextArticleWithDelay = useCallback((currentFeaturedId: string) => {
    if (featuredVideoRotateTimeoutRef.current) {
      clearTimeout(featuredVideoRotateTimeoutRef.current);
    }

    if (expandedArticleId) {
      featuredVideoRotateTimeoutRef.current = null;
      return;
    }

    const elapsed = Date.now() - featuredArticleStartTimeRef.current;
    const remainingDelay = Math.max(0, NEWS_ARTICLE_SWITCH_MS - elapsed);

    featuredVideoRotateTimeoutRef.current = setTimeout(() => {
      featuredVideoRotateTimeoutRef.current = null;
      rotateToNextArticle(currentFeaturedId);
    }, remainingDelay);
  }, [rotateToNextArticle, expandedArticleId]);

  // Auto-rotate partners - individual random rotation
  useEffect(() => {
    if (dynamicPartners.length <= 4) return;
    
    const interval = setInterval(() => {
      // Pick a random position (0-3) to replace
      const positionToReplace = Math.floor(Math.random() * 4);
      
      // Trigger animation
      setPartnerAnimating(positionToReplace);
      
      // After animation, replace with new partner
      setTimeout(() => {
        setVisiblePartners((prev) => {
          const newVisible = [...prev];
          // Find a partner not currently visible
          let newPartnerIndex;
          do {
            newPartnerIndex = Math.floor(Math.random() * dynamicPartners.length);
          } while (prev.includes(newPartnerIndex));
          
          newVisible[positionToReplace] = newPartnerIndex;
          return newVisible;
        });
        setPartnerAnimating(null);
      }, 300);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [dynamicPartners]);

  // Auto-rotate committee members every 5 seconds
  useEffect(() => {
    if (dynamicCommittee.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentCommitteeIndex((prev) => (prev + 1) % dynamicCommittee.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [dynamicCommittee]);

  // Auto-rotate news grid on mobile only every 15 seconds
  useEffect(() => {
    if (newsArticles.length <= 2) return;
    
    // Only rotate on mobile (< 640px)
    const checkMobile = () => window.innerWidth < 640;
    
    const interval = setInterval(() => {
      if (checkMobile()) {
        setNewsGridStartIndex((prev) => (prev + 1) % newsArticles.length);
      }
    }, 15000);
    
    return () => clearInterval(interval);
  }, [newsArticles]);

  // Touch handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);
    
    const touchDistance = touchStartX - touchEndX;
    const minSwipeDistance = 50; // Minimum distance for a swipe
    
    if (Math.abs(touchDistance) > minSwipeDistance) {
      const maxIndex = Math.ceil(newsArticles.length / 2) - 1;
      
      if (touchDistance > 0) {
        // Swipe left - go to next page
        setNewsGridStartIndex(prev => (prev + 1) % Math.ceil(newsArticles.length / 2));
      } else {
        // Swipe right - go to previous page
        setNewsGridStartIndex(prev => 
          prev === 0 ? maxIndex : prev - 1
        );
      }
    }
  };

  useEffect(() => {
    const toNumberOrNull = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const gamesRef = collection(firebaseDB, "games");
    const gamesQuery = query(gamesRef, where("status", "==", "live"), limit(8));

    const unsubscribe = onSnapshot(
      gamesQuery,
      (snapshot) => {
        const live = snapshot.docs
          .filter((doc) => {
            const data = doc.data();
            if (data.isHiddenFromPublic === true) {
              return false;
            }
            if (data.completed === true) {
              return false;
            }

            return true;
          })
          .map((doc) => {
            const data = doc.data();

            const homeScoreValue = toNumberOrNull(data.homeScore);
            const awayScoreValue = toNumberOrNull(data.awayScore);
            const winnerScore = toNumberOrNull(data.winnerScore);
            const loserScore = toNumberOrNull(data.loserScore);

            const hasDirectScores = homeScoreValue !== null && awayScoreValue !== null;
            const hasWinnerLoserScores = winnerScore !== null && loserScore !== null;

            const homeScore = hasDirectScores
              ? homeScoreValue
              : hasWinnerLoserScores
                ? data.winnerTeamId === data.homeTeamId
                  ? winnerScore
                  : loserScore
                : undefined;

            const awayScore = hasDirectScores
              ? awayScoreValue
              : hasWinnerLoserScores
                ? data.winnerTeamId === data.awayTeamId
                  ? winnerScore
                  : loserScore
                : undefined;

            const livePeriodSource = [data.period, data.quarter]
              .find((value) => value !== undefined && value !== null && String(value).trim() !== "");

            return {
              id: doc.id,
              home: data.homeTeam || data.team1 || data.homeTeamName || "",
              away: data.awayTeam || data.team2 || data.awayTeamName || "",
              homeTeam: data.homeTeam || data.team1 || data.homeTeamName || "",
              awayTeam: data.awayTeam || data.team2 || data.awayTeamName || "",
              homeScore,
              awayScore,
              livePeriod: livePeriodSource ? String(livePeriodSource) : "",
              liveClock: String(data.gameClock || data.clock || data.timeRemaining || ""),
              dateTime: `${data.date || ""}T${data.time || "00:00"}`,
              homeTeamLogo: getResolvedTeamLogo({
                teamName: data.homeTeam || data.team1 || data.homeTeamName || "Home",
                logo: data.homeTeamLogo || data.team1Logo,
              }),
              awayTeamLogo: getResolvedTeamLogo({
                teamName: data.awayTeam || data.team2 || data.awayTeamName || "Away",
                logo: data.awayTeamLogo || data.team2Logo,
              }),
              gender: data.gender as "men" | "women",
              location: data.venue || data.location || "",
              status: "live" as const,
              tipoff: `${data.date || ""} · ${data.time || "00:00"}`,
              venue: data.venue || data.location || "",
              network: "",
              broadcast: data.broadcast || "",
              activeTimeout: (data.activeTimeout as EnhancedMatchup["activeTimeout"]) ?? null,
              liveStreamUrl:
                data.streamUrl ||
                data.youtubeUrl ||
                data.highlightsVideoUrl ||
                data.highlightVideoUrl ||
                data.highlightsUrl ||
                data.highlightUrl ||
                data.videoUrl ||
                "",
              leaders: [],
            };
          });

        setLiveGames(live);
      },
      (error) => {
        console.error("Error subscribing to live games:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Parse stored date+time as Congo/Kinshasa timezone → proper UTC Date.
        // This ensures that when the browser formats the Date using local methods
        // (getHours, toLocaleString, etc.) the user sees their own local time.
        const parseGameDateTime = (dateStr?: string, timeStr?: string): Date | null => {
          return parseCongoDateTime(dateStr, timeStr) ?? null;
        };

        // Fetch games, teams, and referees in PARALLEL instead of sequentially
        const gamesRef = collection(firebaseDB, "games");
        const gamesQuery = query(
          gamesRef,
          orderBy("date", "asc"),
          limit(50)
        );
        const teamsRef = collection(firebaseDB, "teams");
        const refereesRef = collection(firebaseDB, "referees");
        
        const [snapshot, teamsSnapshot, refereesSnapshot] = await Promise.all([
          getDocs(gamesQuery),
          getDocs(teamsRef),
          getDocs(refereesRef),
        ]);
        
        // Process teams
        const teamsMap = new Map<string, { wins: number; losses: number }>();
        const teamsByName = new Map<string, { id: string; wins: number; losses: number }>();
        const normalizeTeamName = (value: string) =>
          value
            .replace(/\bsepoir\b/gi, "espoir")
            .replace(/\bfukas\b|\bfukash\b/gi, "fukash")
            .replace(/^espoir\s+espoir\s+/i, "espoir ")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        teamsSnapshot.docs.forEach((doc) => {
          const data = doc.data() as { wins?: number; losses?: number; name?: string; city?: string };
          const wins = data.wins || 0;
          const losses = data.losses || 0;
          const name = (data.name || "").trim();
          const city = (data.city || "").trim();
          const fullName = buildTeamDisplayName({ city, name });

          teamsMap.set(doc.id, { wins, losses });

          if (name) {
            teamsByName.set(normalizeTeamName(name), { id: doc.id, wins, losses });
          }
          if (fullName) {
            teamsByName.set(normalizeTeamName(fullName), { id: doc.id, wins, losses });
          }
        });

        const resolveTeamInfo = (teamId?: string, teamName?: string) => {
          if (teamId && teamsMap.has(teamId)) {
            const record = teamsMap.get(teamId)!;
            return { id: teamId, wins: record.wins, losses: record.losses };
          }

          const normalizedName = normalizeTeamName(teamName || "");
          if (normalizedName && teamsByName.has(normalizedName)) {
            return teamsByName.get(normalizedName)!;
          }

          return { id: teamId || "", wins: 0, losses: 0 };
        };
        
        // Process referees (already fetched in parallel above)
        const refereesMap = new Map();
        refereesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          refereesMap.set(doc.id, {
            id: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            headshot: data.headshot || "",
            phone: data.phone || "",
            email: data.email || "",
            bio: data.bio || data.biography || "",
          });
        });
        
        const now = new Date();
        
        // Get the start of current week (Monday) - DRC timezone
        const currentDay = now.getDay();
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay; // If Sunday, go back 6 days, else go to Monday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        
        // Get the end of current week (Sunday)
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Get all upcoming games for "Match à suivre"
        // Rules:
        // - Live games are excluded (they appear only in the live section)
        // - Non-live games disappear 30 minutes after scheduled tipoff
        type UpcomingGameEntry = {
          id: string;
          data: Record<string, any>;
          dateObj: Date;
          completed: boolean;
        };

        const upcomingGames: UpcomingGameEntry[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const dateObj = parseGameDateTime(data.date, data.time);
            
            return {
              id: doc.id,
              data,
              dateObj,
              completed: data.completed === true,
            };
          })
          .filter((game): game is UpcomingGameEntry => {
            if (game.completed) return false;

            if (game.data?.isHiddenFromPublic === true) return false;

            const status = String(game.data?.status || "").toLowerCase();
            if (status === "cancelled" || status === "postponed" || status === "completed") return false;
            if (status === "live") return false;
            if (!game.dateObj) return false;

            const gameNotStarted = now < game.dateObj;
            const minutesSinceStart = (now.getTime() - game.dateObj.getTime()) / (1000 * 60);
            const nonLiveGraceWindow = minutesSinceStart >= 0 && minutesSinceStart <= 30;

            return gameNotStarted || nonLiveGraceWindow;
          })
          .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        
        // Try to get games from current week first
        const currentWeekGames = upcomingGames.filter((game) => {
          return game.dateObj >= startOfWeek && game.dateObj <= endOfWeek;
        });
        
        // If no games this week, use the closest upcoming games instead
        const allGames = currentWeekGames.length > 0 ? currentWeekGames : upcomingGames;

        // Get top 3 for spotlight (earliest upcoming games)
        const spotlightGamesData = allGames.slice(0, 3);
        
        // Fetch roster data for all teams involved in games
        const getTopPlayerForTeam = async (teamId: string, teamName: string) => {
          try {
            const rosterRef = collection(firebaseDB, "teams", teamId, "roster");
            const rosterSnapshot = await getDocs(rosterRef);
            
            if (rosterSnapshot.empty) return null;
            
            const players = rosterSnapshot.docs.map((doc) => doc.data());
            
            // Check if any player has stats
            const hasStats = players.some((p) => (p.stats?.pts || 0) > 0);
            
            if (hasStats) {
              // Find player with highest points
              let topPlayer: any = null;
              let topPts = 0;
              
              players.forEach((player) => {
                const pts = player.stats?.pts || 0;
                if (pts > topPts) {
                  topPts = pts;
                  topPlayer = player;
                }
              });
              
              if (topPlayer) {
                const pts = topPlayer.stats?.pts || 0;
                const reb = topPlayer.stats?.reb || 0;
                const ast = topPlayer.stats?.ast || 0;
                const secondStat = reb >= ast ? `${reb} REB` : `${ast} AST`;
                return {
                  player: `${topPlayer.firstName || ""} ${topPlayer.lastName || ""}`.trim() || "Unknown",
                  team: teamName,
                  stats: `${pts} PTS · ${secondStat}`,
                  headshot: topPlayer.headshot || undefined,
                  number: topPlayer.number || 0,
                };
              }
            } else {
              // No stats, get first player alphabetically
              const sortedPlayers = players.sort((a, b) => {
                const nameA = `${a.lastName || ""} ${a.firstName || ""}`.trim().toLowerCase();
                const nameB = `${b.lastName || ""} ${b.firstName || ""}`.trim().toLowerCase();
                return nameA.localeCompare(nameB);
              });
              
              if (sortedPlayers.length > 0) {
                const firstPlayer = sortedPlayers[0];
                const pts = firstPlayer.stats?.pts || 0;
                const reb = firstPlayer.stats?.reb || 0;
                const ast = firstPlayer.stats?.ast || 0;
                const secondStat = reb >= ast ? `${reb} REB` : `${ast} AST`;
                return {
                  player: `${firstPlayer.firstName || ""} ${firstPlayer.lastName || ""}`.trim() || "Unknown",
                  team: teamName,
                  stats: `${pts} PTS · ${secondStat}`,
                  headshot: firstPlayer.headshot || undefined,
                  number: firstPlayer.number || 0,
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching roster for team ${teamId}:`, error);
          }
          return null;
        };
        
        const uniqueTeamsForLeaders = new Map<string, { teamId: string; teamName: string }>();

        allGames.forEach((game) => {
          const homeTeam = resolveTeamInfo(game.data.homeTeamId, game.data.homeTeamName || game.data.homeTeam || game.data.team1);
          const awayTeam = resolveTeamInfo(game.data.awayTeamId, game.data.awayTeamName || game.data.awayTeam || game.data.team2);

          if (homeTeam.id && !uniqueTeamsForLeaders.has(homeTeam.id)) {
            uniqueTeamsForLeaders.set(homeTeam.id, {
              teamId: homeTeam.id,
              teamName: game.data.homeTeamName || game.data.homeTeam || "Home",
            });
          }

          if (awayTeam.id && !uniqueTeamsForLeaders.has(awayTeam.id)) {
            uniqueTeamsForLeaders.set(awayTeam.id, {
              teamId: awayTeam.id,
              teamName: game.data.awayTeamName || game.data.awayTeam || "Away",
            });
          }
        });

        const teamLeaderMap = new Map<string, FeaturedMatchup["leaders"][number] | null>();
        await Promise.all(
          Array.from(uniqueTeamsForLeaders.values()).map(async ({ teamId, teamName }) => {
            const leader = await getTopPlayerForTeam(teamId, teamName);
            teamLeaderMap.set(teamId, leader);
          })
        );

        const formatGameData = (game: typeof allGames[0]): EnhancedMatchup => {
          const formatTipoff = (dateObj: Date) => {
            const day = dateObj.getDate();
            const month = dateObj.getMonth() + 1;
            const hours = dateObj.getHours();
            const minutes = dateObj.getMinutes();
            
            let timeStr;
            let dateStr;
            if (language === 'fr') {
              // 24-hour format for French
              timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              // French: day/month (25/12)
              dateStr = `${day}/${month}`;
            } else {
              // 12-hour format for English
              const period = hours >= 12 ? 'PM' : 'AM';
              const hours12 = hours % 12 || 12;
              timeStr = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
              // English: month/day (12/25)
              dateStr = `${month}/${day}`;
            }
            
            return `${dateStr} · ${timeStr}`;
          };

          const minutesSinceStart = (now.getTime() - game.dateObj.getTime()) / (1000 * 60);
          const isStartingSoon = minutesSinceStart >= 0 && minutesSinceStart <= 30;
          
          const homeTeam = resolveTeamInfo(game.data.homeTeamId, game.data.homeTeamName || game.data.homeTeam || game.data.team1);
          const awayTeam = resolveTeamInfo(game.data.awayTeamId, game.data.awayTeamName || game.data.awayTeam || game.data.team2);
          
          // Map referee IDs to display metadata
          const refereeAssignments = (game.data.referees || []).map((refId: string) => {
            const referee = refereesMap.get(refId);
            if (!referee) return null;
            const fullName = `${referee.firstName || ""} ${referee.lastName || ""}`.trim() || "Referee";
            return {
              id: refId,
              fullName,
              displayName: referee.lastName || referee.firstName || fullName,
              headshot: referee.headshot || undefined,
            } satisfies MatchupReferee;
          }).filter(Boolean) as MatchupReferee[];
          
          // Get top player from each team's roster
          const leaders: FeaturedMatchup["leaders"] = [];
          
          if (homeTeam.id) {
            const homeLeader = teamLeaderMap.get(homeTeam.id);
            if (homeLeader) {
              leaders.push({
                ...homeLeader,
                team: game.data.homeTeamName || game.data.homeTeam || "Home",
              });
            }
          }
          
          if (awayTeam.id) {
            const awayLeader = teamLeaderMap.get(awayTeam.id);
            if (awayLeader) {
              leaders.push({
                ...awayLeader,
                team: game.data.awayTeamName || game.data.awayTeam || "Away",
              });
            }
          }
          
          return {
            id: game.id,
            status: "Upcoming",
            tipoff: formatTipoff(game.dateObj),
            venue: game.data.venue || "TBD",
            network: "Liprobakin+",
            home: {
              team: game.data.homeTeamName || "Home",
              record: `${homeTeam.wins}-${homeTeam.losses}`,
            },
            away: {
              team: game.data.awayTeamName || "Away",
              record: `${awayTeam.wins}-${awayTeam.losses}`,
            },
            homeTeam: game.data.homeTeamName || "Home",
            awayTeam: game.data.awayTeamName || "Away",
            homeTeamLogo: getResolvedTeamLogo({ teamName: game.data.homeTeamName || "Home", logo: game.data.homeTeamLogo }),
            awayTeamLogo: getResolvedTeamLogo({ teamName: game.data.awayTeamName || "Away", logo: game.data.awayTeamLogo }),
            gender: game.data.gender,
            dateTime: game.dateObj ? game.dateObj.toISOString() : "",
            isStartingSoon,
            referees: refereeAssignments,
            leaders,
          };
        };

        // Format once, then reuse slices
        const allFormattedGames = allGames.map(formatGameData);
        const spotlightGames = allFormattedGames.slice(0, 3);
        const allWeeklyGames = allFormattedGames.slice(3);

        // Store all games for calendar filtering
        setAllScheduledGames(allFormattedGames);
        
        setDynamicSpotlightGames(spotlightGames);
        setWeeklyScheduleGames(allWeeklyGames);
        
        // Fetch completed games for Final Buzzer section (rolling last 25)
        const completedGamesQuery = query(
          gamesRef,
          orderBy("date", "desc"),
          limit(25)
        );
        const completedSnapshot = await getDocs(completedGamesQuery);
        
        const completedGamesData = completedSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            const toDateObject = (value: any): Date | null => {
              if (!value) return null;
              if (value instanceof Date) return value;
              if (typeof value?.toDate === "function") return value.toDate();
              if (typeof value === "string" || typeof value === "number") {
                const parsed = new Date(value);
                return Number.isFinite(parsed.getTime()) ? parsed : null;
              }
              return null;
            };

            const toNumberOrNull = (value: any): number | null => {
              if (typeof value === "number" && Number.isFinite(value)) return value;
              if (typeof value === "string" && value.trim() !== "") {
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : null;
              }
              return null;
            };

            const dateObj = parseGameDateTime(data.date, data.time);

            const completedAtObj = toDateObject(data.completedAt);

            const winnerScore = toNumberOrNull(data.winnerScore);
            const loserScore = toNumberOrNull(data.loserScore);
            const homeScore = toNumberOrNull(data.homeScore);
            const awayScore = toNumberOrNull(data.awayScore);

            const hasWinnerLoserScores =
              winnerScore !== null && loserScore !== null;
            const hasDirectFinalScores = homeScore !== null && awayScore !== null;
            const hasOfficialFinalScore = hasWinnerLoserScores || hasDirectFinalScores;
            const hasStatsModuleData = Array.isArray(data.playerStats) && data.playerStats.length > 0;

            const isCompleted =
              (data.completed === true || data.archived === true || Boolean(data.status === "completed" || data.status === "final" || data.status === "finished")) &&
              hasOfficialFinalScore;

            return {
              id: doc.id,
              ...data,
              homeTeamLogo: getResolvedTeamLogo({ teamName: data.homeTeamName || data.homeTeam || data.team1 || "Home", logo: data.homeTeamLogo || data.team1Logo }),
              awayTeamLogo: getResolvedTeamLogo({ teamName: data.awayTeamName || data.awayTeam || data.team2 || "Away", logo: data.awayTeamLogo || data.team2Logo }),
              dateObj,
              completedAtObj,
              winnerScore,
              loserScore,
              homeScore,
              awayScore,
              hasOfficialFinalScore,
              hasStatsModuleData,
              isCompleted,
            };
          })
          .filter((game: any) => {
            // Show completed games with final score (rolling list)
            if (game.dateObj && game.dateObj > now) return false;

            return game.isCompleted && game.hasOfficialFinalScore;
          })
          .sort((a: any, b: any) => {
            const aTime = a.dateObj?.getTime() || a.completedAtObj?.getTime() || 0;
            const bTime = b.dateObj?.getTime() || b.completedAtObj?.getTime() || 0;
            return bTime - aTime;
          })
          .slice(0, 25);
        
        setCompletedGames(completedGamesData);
        
        console.log("Spotlight games:", spotlightGames.length);
        console.log("Weekly schedule games:", allWeeklyGames.length);
        console.log("Completed games:", completedGamesData.length);
      } catch (error) {
        console.error("Error fetching games:", error);
      }
    };

    fetchGames();
    // Auto-refresh every 60 seconds to show new games without page refresh
    const interval = setInterval(fetchGames, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  // Disabled auto-popup - players can access from navbar
  // useEffect(() => {
  //   if (user && userProfile && userProfile.verificationStatus === "approved") {
  //     const timer = setTimeout(() => {
  //       setShowProfilePopup(true);
  //     }, 1000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [user, userProfile]);

  // Teams section is completely static - no auto-scroll

  return (
    <div className="relative isolate min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white overflow-x-hidden w-full max-w-[100vw]">
      <div
        className="pointer-events-none absolute inset-x-0 top-[-200px] h-[500px] bg-[radial-gradient(circle,_rgba(56,189,248,0.35),_transparent_60%)] blur-3xl"
        aria-hidden
      />

      <nav className="sticky top-0 live-pin-offset z-50 border-b border-white/10 bg-black/30 backdrop-blur-xl">
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
            <span className="hidden xs:inline sm:inline">{copy.brand}</span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative flex items-center justify-center w-12 h-12 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 text-white/90 shadow-2xl transition-all duration-700 ease-out focus:outline-none focus:ring-2 focus:ring-white/20 lg:hidden active:scale-95 transform-gpu"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-panel"
              aria-label="Toggle navigation menu"
            >
              <span className="sr-only">Toggle navigation</span>
              
              {/* Glossy Background Effect */}
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 via-transparent to-white/5 transition-all duration-500 ${
                mobileNavOpen ? 'opacity-100' : 'opacity-60'
              }`} />
              
              {/* Animated Glow Ring */}
              <div className={`absolute inset-0 rounded-xl ring-1 ring-white/20 transition-all duration-500 ${
                mobileNavOpen ? 'ring-white/40 shadow-lg shadow-white/20' : 'ring-white/10'
              }`} />
              
              {/* Menu Icon Container */}
              <div className="relative w-6 h-6 flex items-center justify-center transform-gpu">
                <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                  mobileNavOpen ? 'rotate-180 opacity-0' : 'rotate-0 opacity-100'
                }`}>
                  {/* Modern Grid Icon (replacing hamburger) */}
                  <div className="w-6 h-6 grid grid-cols-2 grid-rows-2 gap-1 p-1">
                    <div className="bg-white/80 rounded-sm transition-all duration-300"></div>
                    <div className="bg-white/60 rounded-sm transition-all duration-300"></div>
                    <div className="bg-white/60 rounded-sm transition-all duration-300"></div>
                    <div className="bg-white/80 rounded-sm transition-all duration-300"></div>
                  </div>
                </div>
                
                <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                  mobileNavOpen ? 'rotate-0 opacity-100' : 'rotate-180 opacity-0'
                }`}>
                  {/* Close Icon with Smooth X Animation */}
                  <div className="relative w-6 h-6 flex items-center justify-center">
                    <span className="absolute w-4 h-0.5 bg-white/90 rounded-full transform rotate-45 transition-all duration-300 ease-out"></span>
                    <span className="absolute w-4 h-0.5 bg-white/90 rounded-full transform -rotate-45 transition-all duration-300 ease-out"></span>
                  </div>
                </div>
              </div>
              
              {/* Subtle Shine Effect removed for hover animation */}
            </button>
            <div className="hidden gap-8 text-xs font-medium uppercase tracking-[0.3em] text-slate-300 lg:flex">
              {navSections.map((section) => (
                <a
                  key={section}
                  href={`#${slug(section)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById(slug(section));
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="transition hover:text-white hover:scale-105 whitespace-nowrap cursor-pointer"
                >
                  {copy.nav[slug(section) as keyof typeof copy.nav] ?? section}
                </a>
                ))}
            </div>
            {user && !isAdmin ? (
              <div className="hidden items-center gap-3 lg:flex">
                <Link
                  href="/account"
                  className="group relative rounded-xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-3 backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-white/40 hover:shadow-lg hover:shadow-blue-500/20"
                  aria-label="Account settings"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="group relative rounded-xl border border-white/20 bg-gradient-to-br from-red-500/20 to-red-600/10 p-3 backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-red-400/40 hover:shadow-lg hover:shadow-red-500/20"
                  type="button"
                  aria-label="Sign out"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="hidden lg:block" />
            )}
            <div className="hidden md:flex items-center gap-1.5 sm:gap-2 border-l border-white/10 pl-2 sm:pl-4">
              <button
                onClick={() => setLanguage('fr')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all ${
                  language === 'fr'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                type="button"
                aria-label="Switch to French"
              >
                FR
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all ${
                  language === 'en'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                type="button"
                aria-label="Switch to English"
              >
                EN
              </button>
            </div>
            <GenderToggle value={gender} onChange={setGender} language={language} />
          </div>
        </div>
      </nav>

      {/* Enhanced Mobile Navigation Panel */}
      <div 
        className={`fixed inset-0 top-[73px] z-40 transition-all duration-700 ease-out transform-gpu lg:hidden ${
          mobileNavOpen 
            ? 'opacity-100 visible translate-y-0' 
            : 'opacity-0 invisible -translate-y-4 pointer-events-none'
        }`}
      >
        {/* Background Overlay with Blur Effect */}
        <div className={`absolute inset-0 bg-gradient-to-b from-black/95 via-black/90 to-black/95 backdrop-blur-2xl transition-all duration-700 ${
          mobileNavOpen ? 'opacity-100' : 'opacity-0'
        }`} />
        
        {/* Main Content */}
        <div
          id="mobile-nav-panel"
          className={`relative h-full overflow-y-auto transition-all duration-700 ease-out ${
            mobileNavOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
            {/* Animated Header */}
            <div className={`mb-8 transition-all duration-700 delay-300 ${
              mobileNavOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="text-center">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  Navigation
                </h2>
                <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full" />
              </div>
            </div>

            {/* Navigation Links with Staggered Animation */}
            <div className="flex flex-col gap-3 mb-8">
              {mobileNavSections.map((section, index) => (
                <a
                  key={section}
                  href={`#${slug(section)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileNavOpen(false);
                    const element = document.getElementById(slug(section));
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-white/[0.02] to-white/5 backdrop-blur-sm px-6 py-5 text-base font-semibold uppercase tracking-[0.2em] text-slate-200 transition-all duration-500 hover:border-blue-400/50 hover:text-white hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02] cursor-pointer transform-gpu ${
                    mobileNavOpen 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  style={{ 
                    transitionDelay: mobileNavOpen ? `${400 + (index * 100)}ms` : '0ms'
                  }}
                >
                  {/* Animated Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-purple-500/0 opacity-0 transition-all duration-500 group-hover:opacity-100" />
                  
                  {/* Content */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span>{copy.nav[slug(section) as keyof typeof copy.nav] ?? section}</span>
                    <div className="w-5 h-5 rounded-full border border-blue-400/30 flex items-center justify-center transition-all duration-300 group-hover:border-blue-400 group-hover:bg-blue-400/10 group-hover:scale-110">
                      <svg className="w-3 h-3 text-blue-400 transform transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out" />
                </a>
              ))}
            </div>
            
            {/* User Section with Enhanced Styling */}
            {user && !isAdmin ? (
              <div className={`flex flex-col gap-4 pt-8 border-t border-white/10 transition-all duration-700 delay-700 ${
                mobileNavOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-white mb-1">Account</h3>
                  <div className="w-12 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full" />
                </div>
                
                <Link
                  href="/account"
                  onClick={() => setMobileNavOpen(false)}
                  className="group flex items-center gap-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-blue-600/5 to-purple-500/10 px-6 py-5 text-white transition-all duration-500 hover:border-blue-400/50 hover:shadow-xl hover:shadow-blue-500/25 hover:scale-[1.02] transform-gpu"
                >
                  <div className="p-2 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold mb-1">{language === 'fr' ? 'Paramètres du compte' : 'Account Settings'}</div>
                    {(userProfile?.firstName || userProfile?.lastName) && (
                      <div className="text-xs text-slate-400">{`${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()}</div>
                    )}
                  </div>
                  <div className="w-5 h-5 rounded-full border border-blue-400/30 flex items-center justify-center transition-all duration-300 group-hover:border-blue-400 group-hover:bg-blue-400/10">
                    <svg className="w-3 h-3 text-blue-400 transform transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileNavOpen(false);
                  }}
                  className="group flex items-center gap-4 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/10 via-red-600/5 to-pink-500/10 px-6 py-5 text-red-400 transition-all duration-500 hover:border-red-400/50 hover:shadow-xl hover:shadow-red-500/25 hover:scale-[1.02] transform-gpu"
                  type="button"
                >
                  <div className="p-2 rounded-xl bg-red-500/20 group-hover:bg-red-500/30 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <span className="flex-1 text-left text-sm font-semibold">{language === 'fr' ? 'Se déconnecter' : 'Sign Out'}</span>
                  <div className="w-5 h-5 rounded-full border border-red-400/30 flex items-center justify-center transition-all duration-300 group-hover:border-red-400 group-hover:bg-red-400/10">
                    <svg className="w-3 h-3 text-red-400 transform transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* News Section */}
      {newsArticles.length > 0 && featuredArticleId && (
        <section className="w-full px-4 md:px-8 lg:px-12">
          {(() => {
            const featured = newsArticles.find((article) => article.id === featuredArticleId);
            if (!featured) return null;
            const allSecondaryArticles = newsArticles.filter((article) => article.id !== featured.id);

            const getArticleTitle = (article: NewsArticle) =>
              language === "en" && article.title_en ? article.title_en : article.title;

            const getArticleExcerpt = (article: NewsArticle) => {
              const baseText = language === "en" && article.headline_en ? article.headline_en : article.headline;
              return baseText
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            };

            const getArticleSummary = (article: NewsArticle) =>
              language === "en" && article.summary_en ? article.summary_en : article.summary;

            const articleShareUrl = canonicalArticleShareUrl(featured.id);
            const articleShareTitle = getArticleTitle(featured);
            const articleShareExcerpt = getArticleExcerpt(featured).slice(0, 100);
            const articleImageUrl = featured.imageUrl || "https://liprobakin.com/logos/liprobakin.png";
            const whatsappPreviewUrl = `${articleShareUrl}&wa=${encodeURIComponent(articleImageUrl)}`;
            
            // Facebook: Use simple sharer URL (iOS will prompt to open FB app)
            const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleShareUrl)}`;
            
            // X (Twitter): Include hashtags and full share text
            const xShareUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(articleShareUrl)}&text=${encodeURIComponent(`${articleShareTitle} - ${articleShareExcerpt}`)}&hashtags=Liprobakin,Basketball`;

            // WhatsApp: direct share link with title + URL
            const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${articleShareTitle}\n\n${articleShareExcerpt}\n\n${whatsappPreviewUrl}`)}`;
            
            // Instagram: Prepare share handler (will use native share or copy link)
            const handleInstagramShare = async (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Try native share API first (mobile)
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: articleShareTitle,
                    text: `${articleShareTitle} - ${articleShareExcerpt}`,
                    url: articleShareUrl,
                  });
                  return;
                } catch (err) {
                  // User cancelled or error - try fallback
                  console.log('Native share cancelled, trying fallback');
                }
              }
              
              // Fallback: Copy link and try to open Instagram
              try {
                await navigator.clipboard.writeText(`${articleShareTitle}\n\n${articleShareUrl}`);
                alert(language === 'fr' 
                  ? '📋 Lien copié ! Collez-le dans votre story ou publication Instagram.'
                  : '📋 Link copied! Paste it in your Instagram story or post.');
                // Try to open Instagram app
                const igDeepLink = 'instagram://app';
                const igWebUrl = 'https://www.instagram.com';
                window.open(igDeepLink, '_blank');
                setTimeout(() => window.open(igWebUrl, '_blank'), 500);
              } catch (err) {
                // If clipboard fails, just open Instagram
                window.open('https://www.instagram.com', '_blank');
              }
            };
            
            // Share: copy article link to clipboard
            const handleFacebookShare = async (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                await navigator.clipboard.writeText(articleShareUrl);
              } catch {
                // Clipboard can fail on some browsers.
              }
              alert(
                language === "fr"
                  ? "Lien copie."
                  : "Link copied."
              );
            };

            const handleDownloadPreview = async (e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();

              try {
                // --- Layout constants ---
                const W = 1200;
                const IMG_H = 680; // top image area height
                const PAD_X = 48;  // horizontal padding in text panel
                const PAD_Y = 40;  // vertical padding in text panel
                const BORDER_W = 6; // sky-blue left border width

                // --- Pre-measure text to compute panel height ---
                const offscreen = document.createElement("canvas");
                offscreen.width = W;
                offscreen.height = 1;
                const measure = offscreen.getContext("2d")!;

                // Category
                const categoryText = (featured.category || "News");
                measure.font = "600 24px Inter, system-ui, sans-serif";
                const catH = 30;

                // Title — word wrap
                const title = getArticleTitle(featured);
                measure.font = "bold 44px Inter, system-ui, sans-serif";
                const titleMaxW = W - PAD_X - BORDER_W - 16 - 60; // left border + padding + right margin
                const titleWords = title.split(" ");
                const titleLines: string[] = [];
                let curLine = "";
                for (const word of titleWords) {
                  const test = curLine ? `${curLine} ${word}` : word;
                  if (measure.measureText(test).width > titleMaxW && curLine) {
                    titleLines.push(curLine);
                    curLine = word;
                  } else {
                    curLine = test;
                  }
                }
                if (curLine) titleLines.push(curLine);
                const titleLineH = 54;
                const titleH = Math.min(titleLines.length, 3) * titleLineH;

                // Excerpt — word wrap (full text)
                const excerptFull = getArticleExcerpt(featured);
                measure.font = "400 24px Inter, system-ui, sans-serif";
                const excerptWords = excerptFull.split(" ");
                const excerptLines: string[] = [];
                let eLine = "";
                for (const word of excerptWords) {
                  const test = eLine ? `${eLine} ${word}` : word;
                  if (measure.measureText(test).width > titleMaxW && eLine) {
                    excerptLines.push(eLine);
                    eLine = word;
                  } else {
                    eLine = test;
                  }
                }
                if (eLine) excerptLines.push(eLine);
                const excerptLineH = 34;
                const excerptH = excerptLines.length * excerptLineH;

                // URL branding row
                const urlRowH = 36;

                // Total text panel height
                const PANEL_H = PAD_Y + catH + 16 + titleH + 20 + excerptH + 28 + urlRowH + PAD_Y;
                const H = IMG_H + PANEL_H;

                // --- Create final canvas ---
                const canvas = document.createElement("canvas");
                canvas.width = W;
                canvas.height = H;
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error("canvas-ctx");

                // --- Background ---
                ctx.fillStyle = "#0f172a";
                ctx.fillRect(0, 0, W, H);

                // --- Load & draw article image ---
                const imgSrc = featured.imageUrl || "";
                if (imgSrc) {
                  const proxyUrl = /^https?:\/\//i.test(imgSrc)
                    ? `/api/image-proxy?url=${encodeURIComponent(imgSrc)}`
                    : imgSrc;

                  const img = new window.Image();
                  img.crossOrigin = "anonymous";
                  await new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                    img.src = proxyUrl;
                    setTimeout(resolve, 5000);
                  });

                  if (img.naturalWidth > 0) {
                    const imgRatio = img.naturalWidth / img.naturalHeight;
                    const slotRatio = W / IMG_H;
                    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
                    if (imgRatio > slotRatio) {
                      sw = img.naturalHeight * slotRatio;
                      sx = (img.naturalWidth - sw) / 2;
                    } else {
                      sh = img.naturalWidth / slotRatio;
                      const yOff = (featured.imagePosition ?? 50) / 100;
                      sy = (img.naturalHeight - sh) * yOff;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, IMG_H);
                  }
                }

                // --- Text panel background (dark card) ---
                ctx.fillStyle = "#0f172a";
                ctx.fillRect(0, IMG_H, W, PANEL_H);

                // --- Thin border line between image and text ---
                ctx.fillStyle = "rgba(255,255,255,0.08)";
                ctx.fillRect(0, IMG_H, W, 1);

                // --- Sky-blue left border ---
                ctx.fillStyle = "#0ea5e9";
                ctx.fillRect(PAD_X - BORDER_W - 4, IMG_H + PAD_Y - 4, BORDER_W, PANEL_H - PAD_Y * 2 + 8);

                // --- Draw category ---
                let textY = IMG_H + PAD_Y + 22;
                const textX = PAD_X + BORDER_W + 10;
                ctx.font = "600 24px Inter, system-ui, sans-serif";
                ctx.fillStyle = "#94a3b8"; // slate-400
                ctx.fillText(categoryText, textX, textY);
                textY += catH + 16;

                // --- Draw title ---
                ctx.font = "bold 44px Inter, system-ui, sans-serif";
                ctx.fillStyle = "#ffffff";
                titleLines.slice(0, 3).forEach((line) => {
                  ctx.fillText(line, textX, textY);
                  textY += titleLineH;
                });
                textY += 12;

                // --- Draw excerpt ---
                ctx.font = "400 24px Inter, system-ui, sans-serif";
                ctx.fillStyle = "#cbd5e1"; // slate-300
                excerptLines.forEach((line) => {
                  ctx.fillText(line, textX, textY);
                  textY += excerptLineH;
                });
                textY += 20;

                // --- Draw website URL branding at the bottom of the page ---
                const siteUrl = "www.liprobakin.com";
                ctx.font = "600 38px Inter, system-ui, sans-serif";
                const siteY = H - 24;
                ctx.textAlign = "center";
                ctx.strokeStyle = "rgba(2, 6, 23, 0.85)";
                ctx.lineWidth = 8;
                ctx.strokeText(siteUrl, W / 2, siteY);
                ctx.fillStyle = "#fb923c"; // orange-400
                ctx.fillText(siteUrl, W / 2, siteY);
                ctx.textAlign = "left";

                // --- Card border (subtle white border around entire card) ---
                ctx.strokeStyle = "rgba(255,255,255,0.1)";
                ctx.lineWidth = 2;
                const cR = 16;
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

                // --- Export ---
                const slugTitle = articleShareTitle
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "")
                  .slice(0, 60);

                const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
                if (!blob) throw new Error("preview-blob-failed");

                const fileName = `${slugTitle || "liprobakin-news"}-preview.png`;
                const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                const canShareFile =
                  typeof navigator !== "undefined" &&
                  "share" in navigator &&
                  "canShare" in navigator &&
                  navigator.canShare?.({ files: [new File([blob], fileName, { type: "image/png" })] });

                if (isMobile && canShareFile) {
                  try {
                    const file = new File([blob], fileName, { type: "image/png" });
                    await navigator.share({ files: [file], title: articleShareTitle });
                    return;
                  } catch {
                    // fall through
                  }
                }

                const downloadUrl = URL.createObjectURL(blob);

                if (isMobile) {
                  window.open(downloadUrl, "_blank", "noopener,noreferrer");
                  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
                  return;
                }

                const downloadLink = document.createElement("a");
                downloadLink.href = downloadUrl;
                downloadLink.download = fileName;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

              } catch {
                alert(language === "fr" ? "Échec du téléchargement de l'aperçu." : "Failed to download preview.");
              }
            };
            
            // X: Enhanced handler with app deep link attempt
            const handleXShare = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              
              const tweetText = `${articleShareTitle} - ${articleShareExcerpt}`;
              const xAppUrl = `twitter://post?message=${encodeURIComponent(tweetText + ' ' + articleShareUrl)}`;
              const xWebUrl = xShareUrl;
              
              // Open web share in popup
              window.open(xWebUrl, '_blank', 'width=600,height=400,scrollbars=yes');
              
              // Also try deep link for mobile
              if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                window.location.href = xAppUrl;
              }
            };

            const isExpanded = expandedArticleId === featured.id;
            // Desktop: 4 when collapsed, 2 when expanded
            // Mobile: always 2
            const desktopSecondaryArticles = isExpanded
              ? allSecondaryArticles.slice(0, 2)
              : allSecondaryArticles.slice(0, 4);
            
            return (
              <div className="space-y-5">
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-5 lg:col-span-7">
                  <article
                    className={`group overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 text-left shadow-lg shadow-black/30 transition-all duration-500 ease-out ${isExpanded ? "shadow-xl shadow-sky-500/5" : "hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl hover:shadow-sky-500/10"}`}
                  >
                    <div className={`relative overflow-hidden transition-all duration-500 ease-out ${isExpanded ? "h-56 sm:h-72 lg:h-[340px]" : "h-64 sm:h-80 lg:h-[420px]"}`}>
                      {featured.videoUrl ? (
                        <>
                          <video
                            src={featured.videoUrl}
                            className="h-full w-full object-cover"
                            autoPlay
                            muted={isFeaturedVideoMuted}
                            playsInline
                            onPlay={() => setIsVideoPlaying(true)}
                            onEnded={() => {
                              setIsVideoPlaying(false);
                              if (featuredVideoCompletionRef.current) return;
                              featuredVideoCompletionRef.current = true;
                              rotateToNextArticleWithDelay(featured.id);
                            }}
                            onLoadedMetadata={(event) => {
                              featuredVideoCompletionRef.current = false;
                              const start = Math.max(0, Number(featured.videoTrimStart || 0));
                              if (start > 0) {
                                try {
                                  event.currentTarget.currentTime = start;
                                } catch {
                                  // ignore seek errors
                                }
                              }
                            }}
                            onTimeUpdate={(event) => {
                              const end = Number(featured.videoTrimEnd || 0);
                              if (!end || featuredVideoCompletionRef.current) return;
                              if (event.currentTarget.currentTime >= end) {
                                featuredVideoCompletionRef.current = true;
                                event.currentTarget.pause();
                                setIsVideoPlaying(false);
                                rotateToNextArticleWithDelay(featured.id);
                              }
                            }}
                            onError={() => setIsVideoPlaying(false)}
                            style={{
                              transform: `scale(${Math.max(1, Number(featured.videoScale || 1))}) translate(${Number(featured.videoOffsetX || 0)}%, ${Number(featured.videoOffsetY || 0)}%)`,
                              transformOrigin: "center center",
                            }}
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setIsFeaturedVideoMuted((prev) => !prev);
                            }}
                            aria-label={isFeaturedVideoMuted ? (language === "fr" ? "Activer le son" : "Unmute video") : (language === "fr" ? "Couper le son" : "Mute video")}
                            className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/70"
                          >
                            <span>{isFeaturedVideoMuted ? "🔇" : "🔊"}</span>
                            <span>{isFeaturedVideoMuted ? (language === "fr" ? "Activer" : "Unmute") : (language === "fr" ? "Muet" : "Mute")}</span>
                          </button>
                        </>
                      ) : featured.imageUrl ? (
                        <Image
                          src={featured.imageUrl}
                          alt={getArticleTitle(featured)}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          style={{ objectPosition: `center ${featured.imagePosition ?? 50}%` }}
                          priority
                        />
                      ) : (
                        <div className="h-full w-full bg-slate-800" />
                      )}
                    </div>
                    {!isExpanded && (
                      <div className="article-text-content border-l-4 border-sky-500 px-4 py-4 transition-colors duration-300 group-hover:border-sky-400 sm:px-6 sm:py-5">
                        <h4 className="mb-2 text-sm font-medium text-slate-300 sm:text-base">{featured.category}</h4>
                        <h3 className="mb-3 text-2xl font-semibold leading-tight text-white sm:text-4xl">
                          {getArticleTitle(featured)}
                        </h3>
                        <p className="text-base leading-snug text-slate-300 sm:text-lg">
                          {getArticleExcerpt(featured)}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              expandArticle(featured.id);
                            }}
                            className="inline-flex items-center rounded-md border border-orange-400/60 px-3 py-1.5 text-sm font-medium text-orange-300 transition hover:border-orange-300 hover:text-orange-200"
                          >
                            {language === "fr" ? "Lire plus" : "Read more"}
                          </button>
                          {/* Social share icons */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleDownloadPreview}
                              aria-label={language === "fr" ? "Télécharger l'aperçu" : "Download preview"}
                              className="social-icon-gold inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-slate-300 transition cursor-pointer"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M12 3v11" />
                                <path d="m7 10 5 5 5-5" />
                                <path d="M4 20h16" />
                              </svg>
                            </button>
                            {/* WhatsApp */}
                            <a
                              href={whatsappShareUrl}
                              target="_blank"
                              rel="nofollow noopener noreferrer"
                              aria-label="WhatsApp"
                              onClick={(e) => e.stopPropagation()}
                              className="social-icon-gold inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-slate-300 transition cursor-pointer hover:border-green-400/60 hover:text-green-400"
                            >
                              <svg viewBox="0 0 32 32" className="h-4 w-4" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M16.21 4.41C9.973 4.41 4.917 9.465 4.917 15.7c0 2.134.592 4.13 1.62 5.832L4.5 27.59l6.25-2.002a11.24 11.24 0 0 0 5.46 1.404c6.234 0 11.29-5.055 11.29-11.29 0-6.237-5.056-11.292-11.29-11.292m0 20.69c-1.91 0-3.69-.57-5.173-1.553l-3.61 1.156 1.173-3.49a9.35 9.35 0 0 1-1.79-5.512c0-5.18 4.217-9.4 9.4-9.4s9.397 4.22 9.397 9.4c0 5.188-4.214 9.4-9.398 9.4zm5.293-6.832c-.284-.155-1.673-.906-1.934-1.012-.265-.106-.455-.16-.658.12s-.78.91-.954 1.096c-.176.186-.345.203-.628.048-.282-.154-1.2-.494-2.264-1.517-.83-.795-1.373-1.76-1.53-2.055s0-.445.15-.584c.134-.124.3-.326.45-.488.15-.163.203-.28.306-.47.104-.19.06-.36-.005-.506-.066-.147-.59-1.587-.81-2.173-.218-.586-.46-.498-.63-.505-.168-.007-.358-.038-.55-.045-.19-.007-.51.054-.78.332-.277.274-1.05.943-1.1 2.362-.055 1.418.926 2.826 1.064 3.023.137.2 1.874 3.272 4.76 4.537 2.888 1.264 2.9.878 3.43.85.53-.027 1.734-.633 2-1.297s.287-1.24.22-1.363c-.07-.123-.26-.203-.54-.357z" clipRule="evenodd"/></svg>
                            </a>
                            {/* Facebook */}
                            <a
                              href={facebookShareUrl}
                              target="_blank"
                              rel="nofollow noopener noreferrer"
                              aria-label="Facebook"
                              onClick={(e) => e.stopPropagation()}
                              className="social-icon-gold inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-slate-300 transition cursor-pointer hover:border-blue-400/60 hover:text-blue-400"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
                            </a>
                            {/* Copy link */}
                            <button
                              type="button"
                              onClick={handleFacebookShare}
                              aria-label={language === "fr" ? "Copier le lien" : "Copy link"}
                              className="social-icon-gold inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-slate-300 transition cursor-pointer"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
                                <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>

                </div>

                <div className={`space-y-4 lg:col-span-5 ${isExpanded ? "hidden lg:block" : ""}`}>
                    {desktopSecondaryArticles.map((article, index) => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => {
                          setIsArticleChanging(true);
                          setTimeout(() => {
                            setFeaturedArticleId(article.id);
                            expandArticle(null);
                            setIsArticleChanging(false);
                          }, 180);
                        }}
                        className={`group flex w-full items-start gap-3 border-t border-sky-500/50 pt-3 text-left ${index >= 2 ? "hidden md:flex" : ""}`}
                      >
                        <div className="relative h-24 w-40 flex-shrink-0 overflow-hidden rounded-md bg-slate-800 sm:h-28 sm:w-44">
                          {article.videoUrl ? (
                            <video
                              src={article.videoUrl}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedMetadata={(event) => {
                                const videoElement = event.currentTarget;
                                const trimStart = Math.max(0, Number(article.videoTrimStart || 0));
                                const trimEnd = Number(article.videoTrimEnd || 0);
                                const maxPoint = trimEnd > 0 ? trimEnd : (videoElement.duration || 0);
                                const targetTime = Math.min(trimStart + 3, Math.max(trimStart, maxPoint - 0.1));
                                if (targetTime > 0) {
                                  try {
                                    videoElement.currentTime = targetTime;
                                  } catch {
                                    // ignore seek issues for unsupported files
                                  }
                                }
                              }}
                              style={{
                                transform: `scale(${Math.max(1, Number(article.videoScale || 1))}) translate(${Number(article.videoOffsetX || 0)}%, ${Number(article.videoOffsetY || 0)}%)`,
                                transformOrigin: "center center",
                              }}
                            />
                          ) : article.imageUrl ? (
                            <Image
                              src={article.imageUrl}
                              alt={getArticleTitle(article)}
                              fill
                              className="object-cover transition duration-300 group-hover:scale-105"
                              style={{ objectPosition: `center ${article.imagePosition ?? 50}%` }}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-slate-300 line-clamp-1">{article.category}</h4>
                          <h3 className="mt-1 text-xl font-semibold leading-tight text-white line-clamp-2 transition-colors group-hover:text-sky-200 sm:text-2xl">
                            {getArticleTitle(article)}
                          </h3>
                          <p className="mt-1 text-base leading-snug text-slate-400 line-clamp-3">
                            {getArticleExcerpt(article)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
              </div>

              {/* Expanded article panel - spans full width below grid */}
              <div
                className={`news-expand-panel ${isExpanded ? "is-open" : "is-closed"}`}
                aria-hidden={!isExpanded}
              >
                <article ref={expandedArticlePanelRef} className="news-expand-panel-inner relative rounded-xl border border-sky-500/30 bg-[#0c1629] p-6 sm:p-8 shadow-2xl shadow-sky-900/20">
                  <button
                    type="button"
                    onClick={() => expandArticle(null)}
                    aria-label={language === "fr" ? "Fermer l'article" : "Close article"}
                    className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:border-white/30 hover:text-white"
                  >
                    <span className="text-lg leading-none">×</span>
                  </button>
                  <h2 className="news-expand-panel-title text-2xl font-bold text-white sm:text-3xl leading-tight">{getArticleTitle(featured)}</h2>
                  <p className="news-expand-panel-date mt-2 text-xs text-slate-500 tracking-wide">{formatTimeAgo(featured.createdAt || new Date())}</p>
                  <div className="relative mt-6 article-content-body space-y-4 text-base leading-relaxed text-slate-200">
                    {!!(featured.additionalMedia?.length || featured.additionalImageUrls?.length) &&
                      (featured.additionalMedia?.length
                        ? featured.additionalMedia
                            .map((item, index) => normalizeAdditionalMediaItem(item, index))
                            .filter((item): item is NormalizedAdditionalMediaItem => !!item)
                        : (featured.additionalImageUrls || [])
                            .map((url, index) => normalizeAdditionalMediaItem({ type: "image", url, order: index + 1 }, index))
                            .filter((item): item is NormalizedAdditionalMediaItem => !!item)
                      )
                        .sort((a, b) => a.order - b.order)
                        .map((mediaItem, index) => {
                          const wrapMode = normalizeWrapMode(mediaItem.textWrap);
                          const wrapSide = normalizeWrapSide(mediaItem.wrapSide);
                          const textWrapFloatClass = getTextWrapFloatClass(wrapMode, wrapSide);
                          const alignClass = isTextWrappingMode(wrapMode) ? "" : getAdditionalMediaAlignClass(mediaItem.align);
                          const usesTextWrap = isTextWrappingMode(wrapMode);
                          const shouldClearPreviousFloats = usesTextWrap && index > 0;
                          const offsetX = Math.round(Number(mediaItem.offsetX || 0));
                          const offsetY = Math.round(Number(mediaItem.offsetY || 0));
                          const widthPercent = Math.round(Number(mediaItem.widthPercent || 100));

                          const isWrapLikeMode = usesTextWrap || wrapMode === "topBottom";
                          const objectPosition = "50% 50%";

                          return (
                            <div
                              key={`${featured.id}-extra-media-${index}`}
                              className={`${getAdditionalMediaWidthClass(mediaItem.size)} ${alignClass} ${wrapMode === "front" || wrapMode === "behind" ? "absolute left-0 top-0" : "relative"} overflow-hidden rounded-xl border border-white/10 ${wrapMode === "front" ? "z-30" : ""} ${wrapMode === "behind" ? "z-0 opacity-70" : ""} ${textWrapFloatClass} ${wrapMode === "inline" ? "inline-block" : ""} ${wrapMode === "topBottom" || shouldClearPreviousFloats ? "clear-both" : ""}`}
                              style={{
                                height: `${Math.round(mediaItem.height)}px`,
                                width: `${widthPercent}%`,
                                left: wrapMode === "behind" || wrapMode === "front" ? `${offsetX}px` : undefined,
                                top: wrapMode === "behind" || wrapMode === "front" ? `${offsetY}px` : undefined,
                                shapeOutside: wrapMode === "tight" || wrapMode === "through" ? "inset(0 round 16px)" : undefined,
                                marginTop:
                                  wrapMode === "inline" || wrapMode === "behind" || wrapMode === "front"
                                    ? undefined
                                    : `${normalizeTextDistance(mediaItem.distanceTop) + (isWrapLikeMode ? offsetY : 0)}px`,
                                marginRight:
                                  wrapMode === "inline" || wrapMode === "behind" || wrapMode === "front"
                                    ? undefined
                                    : `${normalizeTextDistance(mediaItem.distanceRight)}px`,
                                marginBottom:
                                  wrapMode === "inline" || wrapMode === "behind" || wrapMode === "front"
                                    ? undefined
                                    : `${normalizeTextDistance(mediaItem.distanceBottom)}px`,
                                marginLeft:
                                  wrapMode === "inline" || wrapMode === "behind" || wrapMode === "front"
                                    ? undefined
                                    : `${normalizeTextDistance(mediaItem.distanceLeft)}px`,
                              }}
                            >
                              {mediaItem.type === "video" ? (
                                <AutoPlayOnVisibleVideo
                                  src={mediaItem.url}
                                  className="h-full w-full object-cover"
                                  style={{
                                    objectPosition,
                                  }}
                                />
                              ) : (
                                <Image
                                  src={mediaItem.url}
                                  alt={`${getArticleTitle(featured)} media ${index + 1}`}
                                  fill
                                  className="object-cover"
                                  style={{
                                    objectPosition,
                                  }}
                                  sizes="(max-width: 768px) 100vw, 900px"
                                  unoptimized
                                />
                              )}
                            </div>
                          );
                        })}
                    <ArticleContent htmlContent={getArticleSummary(featured)} className="text-base leading-relaxed text-slate-200" />
                    <div className="clear-both" />
                  </div>
                  <MentionedEntities htmlContent={getArticleSummary(featured)} language={language} />
                  <section className="mt-8 rounded-xl border border-slate-700/70 bg-slate-950/35 p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                        {language === "fr" ? "Commentaires" : "Comments"} ({articleComments.length})
                      </h3>
                      {rankedArticleComments.length > articleCommentsVisibleCount && (
                        <button
                          type="button"
                          onClick={() =>
                            setArticleCommentsVisibleCount((previous) => Math.min(previous + 6, rankedArticleComments.length))
                          }
                          className="rounded-full border border-cyan-400/50 px-3 py-1 text-xs font-semibold text-cyan-300 transition hover:border-cyan-300 hover:text-cyan-200"
                        >
                          + {language === "fr" ? "Voir plus" : "See more"}
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {rankedArticleComments.slice(0, articleCommentsVisibleCount).map((comment, index) => {
                        const commentReplies = sortedRepliesByCommentId[comment.id] ?? [];
                        const isTopLikedComment = index === 0 && comment.likesCount > 0;
                        return (
                        <article
                          key={comment.id}
                          className={`rounded-lg border p-3 ${
                            isTopLikedComment
                              ? "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                              : "border-white/10 bg-slate-900/70"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isTopLikedComment && (
                                <span className="rounded-full border border-cyan-300/60 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
                                  {language === "fr" ? "🏆 Top commentaire" : "🏆 Top comment"}
                                </span>
                              )}
                              <p className="text-sm font-semibold text-white">{comment.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] text-slate-400">
                                {comment.createdAt
                                  ? formatTimeAgo(comment.createdAt)
                                  : language === "fr"
                                    ? "à l'instant"
                                    : "just now"}
                              </p>
                              {comment.canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteArticleComment(comment.id)}
                                  disabled={deletingCommentId === comment.id}
                                  className="rounded border border-rose-400/50 px-2 py-0.5 text-[10px] font-semibold text-rose-300 transition hover:border-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {deletingCommentId === comment.id
                                    ? language === "fr"
                                      ? "Suppression..."
                                      : "Deleting..."
                                    : language === "fr"
                                      ? "Supprimer"
                                      : "Delete"}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{comment.message}</p>

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCommentLike(comment.id)}
                              className={`rounded border px-2.5 py-1 text-[11px] font-semibold transition ${
                                comment.likedByCurrentUser
                                  ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                                  : "border-white/20 text-slate-300 hover:border-white/40 hover:text-white"
                              }`}
                            >
                              👍 {comment.likesCount}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReplyCommentId((previous) => (previous === comment.id ? null : comment.id));
                                setCommentError(null);
                              }}
                              className="rounded border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-white/40 hover:text-white"
                            >
                              {language === "fr" ? "Répondre" : "Reply"}
                            </button>
                            {commentReplies.length > 0 && (
                              <span className="text-[11px] text-slate-400">
                                {commentReplies.length} {language === "fr" ? "réponse(s)" : "reply/replies"}
                              </span>
                            )}
                          </div>

                          {commentReplies.length > 0 && (
                            <div className="mt-3 space-y-2 border-l border-white/10 pl-3">
                              {commentReplies.map((reply) => (
                                <div key={reply.id} className="rounded-md border border-white/10 bg-slate-900/60 p-2">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-white">{reply.name}</p>
                                    <p className="text-[10px] text-slate-400">
                                      {reply.createdAt
                                        ? formatTimeAgo(reply.createdAt)
                                        : language === "fr"
                                          ? "à l'instant"
                                          : "just now"}
                                    </p>
                                  </div>
                                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{reply.message}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {activeReplyCommentId === comment.id && (
                            <div className="mt-3 space-y-2 rounded-md border border-white/10 bg-slate-900/50 p-3">
                              <input
                                type="text"
                                value={replyName}
                                onChange={(event) => setReplyName(event.target.value)}
                                placeholder={language === "fr" ? "Votre nom (optionnel)" : "Your name (optional)"}
                                maxLength={50}
                                className="w-full rounded border border-white/15 bg-slate-900/80 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
                              />
                              <textarea
                                value={replyMessage}
                                onChange={(event) => setReplyMessage(event.target.value)}
                                placeholder={language === "fr" ? "Écrire une réponse..." : "Write a reply..."}
                                maxLength={600}
                                rows={2}
                                className="w-full resize-y rounded border border-white/15 bg-slate-900/80 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveReplyCommentId(null)}
                                  className="rounded border border-white/20 px-2.5 py-1 text-[11px] text-slate-300 hover:border-white/40 hover:text-white"
                                >
                                  {language === "fr" ? "Annuler" : "Cancel"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSubmitCommentReply(comment.id)}
                                  disabled={isSubmittingReply}
                                  className="rounded border border-cyan-400/60 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isSubmittingReply
                                    ? language === "fr"
                                      ? "Publication..."
                                      : "Posting..."
                                    : language === "fr"
                                      ? "Répondre"
                                      : "Reply"}
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                        );
                      })}

                      {articleComments.length === 0 && (
                        <p className="text-sm text-slate-400">
                          {language === "fr" ? "Aucun commentaire pour le moment." : "No comments yet."}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <input
                        type="text"
                        value={commentWebsite}
                        onChange={(event) => setCommentWebsite(event.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        className="hidden"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={commentName}
                        onChange={(event) => setCommentName(event.target.value)}
                        placeholder={language === "fr" ? "Votre nom (optionnel)" : "Your name (optional)"}
                        maxLength={50}
                        className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
                      />
                      <textarea
                        value={commentMessage}
                        onChange={(event) => setCommentMessage(event.target.value)}
                        placeholder={language === "fr" ? "Ajouter un commentaire..." : "Add a comment..."}
                        maxLength={600}
                        rows={3}
                        className="w-full resize-y rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
                      />
                      {commentError && <p className="text-xs text-rose-300">{commentError}</p>}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleSubmitArticleComment}
                          disabled={isSubmittingComment}
                          className="rounded-lg border border-cyan-400/60 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmittingComment
                            ? language === "fr"
                              ? "Publication..."
                              : "Posting..."
                            : language === "fr"
                              ? "Publier"
                              : "Post comment"}
                        </button>
                      </div>
                    </div>
                  </section>
                  <div className="mt-8 border-t border-slate-700/50 pt-4">
                    {/* Social share bar */}
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{language === "fr" ? "Partager cet article" : "Share this article"}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* WhatsApp */}
                      <a
                        href={whatsappShareUrl}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition bg-[#25D366] hover:bg-[#20b958]"
                      >
                        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M16.21 4.41C9.973 4.41 4.917 9.465 4.917 15.7c0 2.134.592 4.13 1.62 5.832L4.5 27.59l6.25-2.002a11.24 11.24 0 0 0 5.46 1.404c6.234 0 11.29-5.055 11.29-11.29 0-6.237-5.056-11.292-11.29-11.292m0 20.69c-1.91 0-3.69-.57-5.173-1.553l-3.61 1.156 1.173-3.49a9.35 9.35 0 0 1-1.79-5.512c0-5.18 4.217-9.4 9.4-9.4s9.397 4.22 9.397 9.4c0 5.188-4.214 9.4-9.398 9.4zm5.293-6.832c-.284-.155-1.673-.906-1.934-1.012-.265-.106-.455-.16-.658.12s-.78.91-.954 1.096c-.176.186-.345.203-.628.048-.282-.154-1.2-.494-2.264-1.517-.83-.795-1.373-1.76-1.53-2.055s0-.445.15-.584c.134-.124.3-.326.45-.488.15-.163.203-.28.306-.47.104-.19.06-.36-.005-.506-.066-.147-.59-1.587-.81-2.173-.218-.586-.46-.498-.63-.505-.168-.007-.358-.038-.55-.045-.19-.007-.51.054-.78.332-.277.274-1.05.943-1.1 2.362-.055 1.418.926 2.826 1.064 3.023.137.2 1.874 3.272 4.76 4.537 2.888 1.264 2.9.878 3.43.85.53-.027 1.734-.633 2-1.297s.287-1.24.22-1.363c-.07-.123-.26-.203-.54-.357z" clipRule="evenodd"/></svg>
                        WhatsApp
                      </a>
                      {/* Facebook */}
                      <a
                        href={facebookShareUrl}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition bg-[#1877F2] hover:bg-[#1465d8]"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
                        Facebook
                      </a>
                      {/* X / Twitter */}
                      <a
                        href={xShareUrl}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition border border-white/20"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        X
                      </a>
                      {/* Copy link */}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(articleShareUrl);
                            alert(language === "fr" ? "\uD83D\uDCCB Lien copié !" : "\uD83D\uDCCB Link copied!");
                          } catch {
                            // ignore
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/40 hover:text-white"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        {language === "fr" ? "Copier le lien" : "Copy link"}
                      </button>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => expandArticle(null)}
                        className="text-sm font-medium text-slate-400 transition hover:text-cyan-400"
                      >
                        {language === "fr" ? "Fermer l'article" : "Close article"}
                      </button>
                    </div>
                  </div>
                </article>
              </div>

              <style jsx>{`
                .news-expand-panel {
                  max-height: 0;
                  margin-top: 0;
                  opacity: 0;
                  overflow: hidden;
                  pointer-events: none;
                  transform: translateY(-16px) scale(0.98);
                  filter: blur(6px);
                  transform-origin: top center;
                  transition:
                    max-height 700ms cubic-bezier(0.16, 1, 0.3, 1),
                    margin-top 500ms cubic-bezier(0.16, 1, 0.3, 1),
                    opacity 360ms ease,
                    transform 700ms cubic-bezier(0.16, 1, 0.3, 1),
                    filter 500ms ease;
                }

                .news-expand-panel.is-open {
                  max-height: 5000px;
                  margin-top: 1.5rem;
                  opacity: 1;
                  pointer-events: auto;
                  transform: translateY(0) scale(1);
                  filter: blur(0);
                }

                @media (max-width: 640px) {
                  .news-expand-panel.is-open {
                    max-height: 9999px;
                    overflow: visible;
                  }
                }

                .news-expand-panel-title {
                  animation: fadeSlideIn 400ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
                }
                .news-expand-panel-date {
                  animation: fadeSlideIn 400ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
                }
                .news-expand-panel .article-content-body {
                  animation: fadeSlideIn 450ms cubic-bezier(0.16, 1, 0.3, 1) 180ms both;
                }

                @keyframes fadeSlideIn {
                  0% {
                    opacity: 0;
                    transform: translateY(12px);
                  }
                  100% {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }

                .article-text-content {
                  animation: textFadeIn 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                @keyframes textFadeIn {
                  0% {
                    opacity: 0;
                    transform: translateY(-8px);
                  }
                  100% {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }

                .article-content-body :global(a) {
                  color: #22d3ee;
                  text-decoration: none;
                  transition: color 0.15s;
                }
                .article-content-body :global(a:hover) {
                  color: #67e8f9;
                  text-decoration: underline;
                }
              `}</style>
              </div>
            );
          })()}
        </section>
      )}

      {/* Fan Favorites Section - Shows right after news for logged-in fans */}
      {user && userProfile && userProfile.role === 'fan' && (
        <section className="mx-auto max-w-6xl px-4 md:px-8 pb-12">
          <div className="flex flex-col items-center gap-6">
            {/* Dropdown arrows */}
            <div className="flex gap-3">
              {/* Global Favorite Player Arrow */}
              {(userProfile.favoritePlayerMenId || userProfile.favoritePlayerWomenId) && (
                <button
                  onClick={() => setShowFavoritePlayer(!showFavoritePlayer)}
                  className="group relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:scale-105"
                  type="button"
                  aria-label="Toggle favorite player"
                >
                  <svg className="h-8 w-8 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 3c-1.2 0-2.4.6-3.2 1.6-.2.2-.4.4-.6.6-.1.1-.1.2-.2.3-.1-.1-.1-.2-.2-.3-.2-.2-.4-.4-.6-.6C10.4 3.6 9.2 3 8 3c-1.7 0-3 1.3-3 3 0 .8.3 1.6.8 2.2L6 8.4V20c0 .6.4 1 1 1h10c.6 0 1-.4 1-1V8.4l.2-.2c.5-.6.8-1.4.8-2.2 0-1.7-1.3-3-3-3zM16 19H8V9.2l.8-.8c.4-.4.6-1 .6-1.5 0-.6-.4-1-1-1-.3 0-.6.1-.8.3l-.2.2-.4-.4c-.2-.2-.5-.3-.8-.3-.6 0-1 .4-1 1 0 .5.2 1.1.6 1.5l.8.8V19h-.6v-8.8l-.8-.8C4.3 8.6 4 7.8 4 7c0-2.2 1.8-4 4-4 1.4 0 2.7.7 3.5 1.8.1.1.2.3.3.4.1.1.2.3.2.4 0-.1.1-.3.2-.4.1-.1.2-.3.3-.4C13.3 3.7 14.6 3 16 3c2.2 0 4 1.8 4 4 0 .8-.3 1.6-.8 2.2l-.8.8V19h-.4z"/>
                    <text x="12" y="15" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor">23</text>
                  </svg>
                  <svg 
                    className={`h-6 w-6 text-white/80 transition-transform duration-300 ${showFavoritePlayer ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Men's Team Arrow */}
              {userProfile.favoriteTeamMenId && (
                <button
                  onClick={() => setShowMenTeamFavorite(!showMenTeamFavorite)}
                  className="group relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-white/20 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:scale-100"
                  type="button"
                  aria-label="Toggle men's favorite team"
                >
                  <svg className="h-6 w-6 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                    <path d="M12 3c0 3-3 6-3 9s3 6 3 9" />
                    <path d="M21 12c-3 0-6-3-9-3s-6 3-9 3" />
                  </svg>
                  <svg 
                    className={`h-4 w-4 text-white/80 transition-transform duration-300 ${showMenTeamFavorite ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Women's Team Arrow */}
              {userProfile.favoriteTeamWomenId && (
                <button
                  onClick={() => setShowWomenTeamFavorite(!showWomenTeamFavorite)}
                  className="group relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-white/20 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:scale-100"
                  type="button"
                  aria-label="Toggle women's favorite team"
                >
                  <svg className="h-6 w-6 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                    <path d="M12 3c0 3-3 6-3 9s3 6 3 9" />
                    <path d="M21 12c-3 0-6-3-9-3s-6 3-9 3" />
                  </svg>
                  <svg 
                    className={`h-4 w-4 text-white/80 transition-transform duration-300 ${showWomenTeamFavorite ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Dropdown Content - Favorite Player */}
            {showFavoritePlayer && (userProfile.favoritePlayerMenId || userProfile.favoritePlayerWomenId) && (
              <div className="w-full max-w-3xl overflow-hidden rounded-t-none rounded-b-2xl border-x border-b border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-4 duration-500">
                <div className="p-8 text-center text-white/60">
                  <p>Favorite Player: {userProfile.favoritePlayerMenName || userProfile.favoritePlayerWomenName}</p>
                </div>
              </div>
            )}

            {/* Dropdown Content - Men's Team */}
            {showMenTeamFavorite && userProfile.favoriteTeamMenId && (
              <div className="w-full max-w-3xl overflow-hidden rounded-t-none rounded-b-2xl border-x border-b border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-4 duration-500">
                <FanFavoriteTeamCard teamId={userProfile.favoriteTeamMenId || ''} teamName={userProfile.favoriteTeamMenName || ''} />
              </div>
            )}

            {/* Dropdown Content - Women's Team */}
            {showWomenTeamFavorite && userProfile.favoriteTeamWomenId && (
              <div className="w-full max-w-3xl overflow-hidden rounded-t-none rounded-b-2xl border-x border-b border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-4 duration-500">
                <FanFavoriteTeamCard teamId={userProfile.favoriteTeamWomenId || ''} teamName={userProfile.favoriteTeamWomenName || ''} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Live Games Section - No label */}
      {liveGames.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 md:px-8">
          <div className={`flex flex-wrap gap-4 ${liveGames.length === 1 ? 'justify-center' : liveGames.length === 2 ? 'justify-center' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {liveGames.map((game) => {
              const hasLiveStream = Boolean((game.liveStreamUrl || "").trim());
              const homeScoreDisplay = typeof game.homeScore === "number" ? game.homeScore : 0;
              const awayScoreDisplay = typeof game.awayScore === "number" ? game.awayScore : 0;
              const activeTimeoutSide = game.activeTimeout?.side ?? null;
              const timeoutVerb = language === "fr" ? "Temps mort" : "Timeout";
              const periodDisplay = String(game.livePeriod || "").trim();
              const normalizedPeriodDisplay = periodDisplay
                ? /^(ht|mt|half|halftime|mi[-\s]?temps|pause|break)$/i.test(periodDisplay)
                  ? language === "fr"
                    ? "MT"
                    : "HT"
                  : /^q/i.test(periodDisplay)
                    ? periodDisplay.toUpperCase()
                    : `Q${periodDisplay}`
                : "";
              const clockDisplay = String(game.liveClock || "").trim();
              const wrapperWidthClass = liveGames.length < 3 ? 'w-full md:w-[calc(50%-0.5rem)] lg:w-[400px]' : 'w-full';
              return (
                <div key={game.id} className={wrapperWidthClass}>
                  <Link
                    href={`/game/${encodeURIComponent(game.id)}`}
                    className="relative block w-full overflow-hidden rounded-b-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:shadow-xl"
                  >
                    <div className="flex items-center justify-between p-3">
                      {/* Home Team */}
                      <div className="flex flex-1 items-center gap-2">
                        {game.homeTeamLogo && (
                          <div className="relative h-10 w-10 flex-shrink-0 rounded-full overflow-hidden bg-slate-800">
                            <Image
                              src={game.homeTeamLogo}
                              alt={game.homeTeam || "Home Team"}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-white">{game.homeTeam}</h3>
                        </div>
                      </div>

                      {/* Live Indicator */}
                      <div className="flex flex-col items-center gap-1 px-4">
                        <div className="relative flex items-center gap-1">
                          <div className="relative">
                            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            <div className="absolute inset-0 h-2 w-2 rounded-full bg-red-500 animate-ping" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider text-red-500 animate-pulse">
                            LIVE
                          </span>
                        </div>
                        <span className="text-sm font-black tabular-nums text-white">
                          {homeScoreDisplay} - {awayScoreDisplay}
                        </span>
                        {activeTimeoutSide && (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200 text-center">
                            {timeoutVerb} {activeTimeoutSide === "home" ? (game.homeTeam || "Team A") : (game.awayTeam || "Team B")}
                          </span>
                        )}
                        {(periodDisplay || clockDisplay) && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 text-center">
                            {normalizedPeriodDisplay}{normalizedPeriodDisplay && clockDisplay ? " • " : ""}{clockDisplay}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">
                          {game.gender === "men" ? "MEN" : "WOMEN"}
                        </span>
                        {game.venue && (
                          <span className="text-[10px] text-slate-500 text-center">
                            {game.venue}
                          </span>
                        )}
                      </div>

                      {/* Away Team */}
                      <div className="flex flex-1 items-center justify-end gap-2">
                        <div className="flex-1 text-right">
                          <h3 className="text-sm font-bold text-white">{game.awayTeam}</h3>
                        </div>
                        {game.awayTeamLogo && (
                          <div className="relative h-10 w-10 flex-shrink-0 rounded-full overflow-hidden bg-slate-800">
                            <Image
                              src={game.awayTeamLogo}
                              alt={game.awayTeam || "Away Team"}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/10 bg-black/20 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {hasLiveStream ? copy.ctaWatch : copy.ctaLiveScore}
                        </span>
                        <svg className="h-4 w-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Player Profile Card - Only for verified players */}
      {userProfile?.role === "player" && userProfile?.verificationStatus === "approved" && userProfile?.teamName && playerData && (
        <section className="mx-auto max-w-6xl px-4 pt-8 md:px-8">
          <div 
            className={`relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-2xl transition-all duration-500 overflow-hidden ${
              playerCardExpanded ? 'p-6' : 'cursor-pointer hover:border-white/30'
            }`}
            onClick={() => !playerCardExpanded && setPlayerCardExpanded(true)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPlayerCardExpanded(!playerCardExpanded);
              }}
              className="absolute right-4 top-4 z-10 text-slate-400 transition hover:text-white hover:scale-110"
              type="button"
              aria-label={playerCardExpanded ? "Collapse player card" : "Expand player card"}
            >
              {playerCardExpanded ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
            </button>
            
            {/* Collapsed View */}
            {!playerCardExpanded && (
              <div className="flex items-center gap-3 p-3">
                <div className="relative h-12 w-12 flex-shrink-0">
                  <Image
                    src={playerData.headshot || '/logos/liprobakin.png'}
                    alt={playerData.name}
                    fill
                    className="rounded-full border-2 border-white/20 object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white">{playerData.name}</h3>
                </div>
              </div>
            )}
            
            {/* Expanded View */}
            {playerCardExpanded && (
              <div className="space-y-4">
                <div className="flex flex-row items-start gap-4">
                  {/* Player Profile Pic - Top left */}
                  <div className="relative h-24 w-24 sm:h-32 sm:w-32 flex-shrink-0">
                    <Image
                      src={playerData.headshot || '/logos/liprobakin.png'}
                      alt={playerData.name}
                      fill
                      className="rounded-full border-4 border-white/20 object-cover"
                    />
                  </div>
                  
                  {/* Player Info - Always on right */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="border-b border-white/10 pb-2">
                      <h3 className="text-xl sm:text-2xl font-bold text-white truncate">{playerData.name}</h3>
                      <p className="text-sm text-slate-400">#{playerData.number} • {userProfile.teamName}</p>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
                      <div>
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">PTS</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{playerData.stats.pts}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">REB</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{playerData.stats.reb}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">AST</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{playerData.stats.pts ? Math.floor(Number(playerData.stats.pts) * 0.3) : '0'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">BLK</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{playerData.stats.stl}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Next Game - Full width with countdown */}
                {nextGame && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    {/* Header with countdown */}
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider">
                        {gameCountdown?.isGameDay ? (
                          <span className="text-yellow-400">
                            🏀 Game Day in {gameCountdown.hours > 0 && `${gameCountdown.hours}h `}{gameCountdown.minutes}m {gameCountdown.seconds}s
                          </span>
                        ) : gameCountdown ? (
                          <span>
                            <span className="text-slate-400">Next Game in </span>
                            <span className="text-blue-400 font-mono">
                              {gameCountdown.days > 0 && `${gameCountdown.days}d `}{gameCountdown.hours}h {gameCountdown.minutes}m
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Next Game</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-white">vs</span>
                        <span className="text-lg font-semibold text-white">
                          {nextGame.homeTeam === userProfile.teamName ? nextGame.awayTeam : nextGame.homeTeam}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">
                          {nextGame.dateTime ? formatGameDateTime(nextGame.dateTime, language) : "TBD"}
                        </p>
                        <p className="text-xs text-slate-400">{nextGame.venue}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Download Card Button */}
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    onClick={() => sharePlayerCard('ig')}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                    aria-label="Download Player Card"
                  >
                    <svg className="w-4 h-4 text-white/60 hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Content Sections */}
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-12 md:px-8">
        <div className="space-y-20">
        <section id="stats" className="space-y-8">
          <SectionHeader
            id="stats"
            title={sectionCopy.stats.title}
          />
          <div className="space-y-4">
            {spotlightGames.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-12 text-center">
                <p className="text-lg text-slate-400">{language === 'fr' ? "Aucun match n'est encore prévu." : "No upcoming games scheduled yet."}</p>
                <p className="mt-2 text-sm text-slate-500">{language === 'fr' ? "Revenez bientôt pour découvrir les prochaines rencontres !" : "Check back soon for the latest matchups!"}</p>
              </div>
            ) : (
              spotlightGames.map((matchup, gameIndex) => (
                <article
                  key={matchup.id}
                  className="grid gap-4 rounded-2xl border border-white/5 bg-slate-900/70 p-3 md:p-4 shadow-lg shadow-black/30 lg:grid-cols-[2fr_1fr] overflow-hidden"
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 min-w-0">
                    <MatchupTeam 
                      team={matchup.away.team} 
                      record={matchup.away.record}
                      logo={"awayTeamLogo" in matchup ? matchup.awayTeamLogo : undefined}
                      allFranchises={allFranchises}
                      gender={matchup.gender === "women" ? "women" : "men"}
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5 md:gap-2 text-center min-w-0 px-1">
                      <span className="rounded-full border border-white/15 px-2 md:px-2.5 py-0.5 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 whitespace-nowrap">
                        {matchup.gender === "men" ? "Men" : matchup.gender === "women" ? "Women" : matchup.status}
                      </span>
                      <div className="min-w-0 w-full">
                        <p className="text-xs md:text-sm font-semibold text-white truncate">{formatGameDateTime(matchup.tipoff, language)}</p>
                        <p className="text-[10px] md:text-xs text-slate-300 truncate">{matchup.venue}</p>
                        {matchup.isStartingSoon && (
                          <div className="mt-1 flex justify-center">
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200 whitespace-nowrap">
                              {language === "fr" ? "Débute bientôt" : "Starting soon"}
                            </span>
                          </div>
                        )}
                        {matchup.referees && matchup.referees.length > 0 && (
                          <p className="mt-0.5 md:mt-1 text-[10px] md:text-xs text-white truncate">
                            <span className="text-white/70 mr-1">Ref:</span>
                            {matchup.referees.map((ref, idx, arr) => (
                              <span key={ref.id} className="inline-flex items-center">
                                <Link
                                  href={`/referees/${ref.id}`}
                                  className="text-white hover:text-orange-300 underline decoration-white/30 underline-offset-4 transition-colors"
                                >
                                  {ref.displayName}
                                </Link>
                                {idx < arr.length - 1 && (
                                  <span className="text-white/60">{", "}</span>
                                )}
                              </span>
                            ))}
                          </p>
                        )}
                        {gameIndex === 0 && (
                          <CountdownTimer dateTime={matchup.dateTime} language={language} />
                        )}
                      </div>
                    </div>
                    <MatchupTeam 
                      team={matchup.home.team} 
                      record={matchup.home.record}
                      logo={"homeTeamLogo" in matchup ? matchup.homeTeamLogo : undefined}
                      allFranchises={allFranchises}
                      gender={matchup.gender === "women" ? "women" : "men"}
                    />
                  </div>
                  <div className="space-y-2 rounded-xl border border-white/5 bg-black/30 p-3 overflow-hidden flex flex-col items-center justify-center">
                    <div className="grid grid-cols-2 gap-3 min-w-0 w-full">
                      {matchup.leaders.map((leader) => (
                        <LeaderRow
                          key={`${matchup.id}-${leader.player}`}
                          leader={leader}
                          allFranchises={allFranchises}
                          gender={matchup.gender === "women" ? "women" : "men"}
                        />
                      ))}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section id="schedule" className="space-y-8">
          <SectionHeader
            id="schedule"
            eyebrow={sectionCopy.schedule.eyebrow}
            title={sectionCopy.schedule.title}
            titleHref="/calendrier"
            actions={
              <div className="flex items-center gap-2 ml-auto">
                <Link
                  href="/calendrier"
                  className="flex items-center gap-1.5 px-3 py-2 text-[10px] sm:text-xs font-medium uppercase tracking-wider text-blue-400 hover:text-blue-300 border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 rounded-xl transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="hidden sm:inline">{language === 'fr' ? 'Voir tout' : 'View all'}</span>
                </Link>
                <button
                  onClick={() => setShowCalendar(true)}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"
                  aria-label={language === 'fr' ? 'Ouvrir le calendrier' : 'Open calendar'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            }
          />
          
          {/* Calendar Drawer - Slides in from right */}
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-opacity duration-300 ${
              showCalendar ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setShowCalendar(false)}
          />
          
          {/* Calendar Panel */}
          <div 
            className={`fixed top-0 right-0 h-full w-[320px] max-w-[85vw] bg-slate-900/98 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[101] transform transition-transform duration-300 ease-out ${
              showCalendar ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-6 h-full overflow-y-auto">
              {/* Header with close button */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {language === 'fr' ? 'Calendrier' : 'Calendar'}
                </h3>
                <button
                  onClick={() => setShowCalendar(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={language === 'fr' ? 'Fermer' : 'Close'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    const newDate = new Date(selectedScheduleDate || new Date());
                    newDate.setMonth(newDate.getMonth() - 1);
                    setSelectedScheduleDate(newDate);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={language === 'fr' ? 'Mois précédent' : 'Previous month'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-white font-semibold">
                  {(selectedScheduleDate || new Date()).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    const newDate = new Date(selectedScheduleDate || new Date());
                    newDate.setMonth(newDate.getMonth() + 1);
                    setSelectedScheduleDate(newDate);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={language === 'fr' ? 'Mois suivant' : 'Next month'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {(language === 'fr' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((day, i) => (
                  <div key={i} className="text-center text-xs text-slate-500 py-1">{day}</div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const currentMonth = selectedScheduleDate || new Date();
                  const year = currentMonth.getFullYear();
                  const month = currentMonth.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const lastDay = new Date(year, month + 1, 0);
                  const startDay = language === 'fr' ? (firstDay.getDay() + 6) % 7 : firstDay.getDay();
                  const days = [];
                  
                  // Empty cells for days before month starts
                  for (let i = 0; i < startDay; i++) {
                    days.push(<div key={`empty-${i}`} className="p-2"></div>);
                  }
                  
                  // Days of the month
                  for (let day = 1; day <= lastDay.getDate(); day++) {
                    const date = new Date(year, month, day);
                    const isToday = new Date().toDateString() === date.toDateString();
                    const isSelected = selectedScheduleDate?.toDateString() === date.toDateString();
                    
                    // Check if there are games on this day
                    const hasGames = allScheduledGames.some(game => {
                      const gameDate = new Date(game.dateTime || '');
                      return gameDate.toDateString() === date.toDateString();
                    });
                    
                    days.push(
                      <button
                        key={day}
                        onClick={() => {
                          setSelectedScheduleDate(date);
                          setShowCalendar(false);
                        }}
                        className={`p-2 text-sm rounded-lg transition-all relative ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : isToday
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'hover:bg-white/10 text-white'
                        }`}
                      >
                        {day}
                        {hasGames && !isSelected && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500"></div>
                        )}
                      </button>
                    );
                  }
                  
                  return days;
                })()}
              </div>
              
              {/* Reset button */}
              <button
                onClick={() => {
                  setSelectedScheduleDate(null);
                  setShowCalendar(false);
                }}
                className="w-full mt-6 py-3 text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                {language === 'fr' ? 'Voir cette semaine' : 'Show this week'}
              </button>
            </div>
          </div>
          
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
              {/* Selected date indicator */}
              {selectedScheduleDate && (
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-slate-400">
                    {language === 'fr' ? 'Semaine du' : 'Week of'}{' '}
                    <span className="text-white font-medium">
                      {(() => {
                        const weekStart = new Date(selectedScheduleDate);
                        const day = weekStart.getDay();
                        const diff = language === 'fr' ? (day === 0 ? -6 : 1 - day) : -day;
                        weekStart.setDate(weekStart.getDate() + diff);
                        return weekStart.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
                      })()}
                    </span>
                  </span>
                  <button
                    onClick={() => setSelectedScheduleDate(null)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {language === 'fr' ? 'Retour à cette semaine' : 'Back to this week'}
                  </button>
                </div>
              )}
              
              <div 
                ref={scheduleScrollRef}
                className="space-y-4"
              >
                {(() => {
                  // Filter games based on selected date's week
                  const gamesToShow = selectedScheduleDate
                    ? (() => {
                        const weekStart = new Date(selectedScheduleDate);
                        const day = weekStart.getDay();
                        const diff = language === 'fr' ? (day === 0 ? -6 : 1 - day) : -day;
                        weekStart.setDate(weekStart.getDate() + diff);
                        weekStart.setHours(0, 0, 0, 0);
                        
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        weekEnd.setHours(23, 59, 59, 999);
                        
                        return allScheduledGames.filter(game => {
                          const gameDate = new Date(game.dateTime || '');
                          return gameDate >= weekStart && gameDate <= weekEnd;
                        });
                      })()
                    : weeklyScheduleGames;
                  
                  if (gamesToShow.length === 0) {
                    return (
                      <div className="py-8 text-center">
                        <p className="text-slate-400">{language === 'fr' ? "Aucun match n'est prévu cette semaine." : "No games scheduled for this week."}</p>
                      </div>
                    );
                  }
                  
                  return gamesToShow.slice(0, 5).map((game) => (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-white/5 bg-black/30 p-3 sm:p-4"
                  >
                    {/* Compact layout for mobile and desktop */}
                    <div className="space-y-2">
                      {/* Top Row: Date/Time on left, Venue & Gender on right (mobile) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-shrink-0">
                          <div className="text-xs md:text-sm font-semibold text-white">
                            {formatGameDateTime(game.tipoff, language)}
                          </div>
                          {game.referees && game.referees.length > 0 && (
                            <div className="text-[10px] md:text-xs text-white mt-0.5">
                              <span className="text-white/70 mr-1">Ref:</span>
                              {game.referees.map((ref, idx, arr) => (
                                <span key={ref.id} className="inline-flex items-center">
                                  <Link
                                    href={`/referees/${ref.id}`}
                                    className="text-white hover:text-orange-300 underline decoration-white/30 underline-offset-4 transition-colors"
                                  >
                                    {ref.displayName}
                                  </Link>
                                  {idx < arr.length - 1 && (
                                    <span className="text-white/60">{", "}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Venue & Gender - Horizontal on mobile, vertical on desktop */}
                        <div className="flex items-center gap-2 md:flex-col md:items-end md:gap-0.5 min-w-0">
                          <span className="text-[10px] md:text-xs text-slate-300 truncate">{game.venue}</span>
                          <span className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap flex-shrink-0">
                            {game.gender === "men" ? "M" : game.gender === "women" ? "W" : ""}
                          </span>
                        </div>
                      </div>
                      
                      {/* Bottom Row: Teams Section - Compact horizontal layout */}
                      <div className="flex items-center gap-2">
                        {/* Away Team */}
                        <Link href={`/team/${encodeURIComponent(game.away.team)}?gender=${game.gender}`} className="flex-1 flex items-center justify-end gap-1.5 min-w-0 group/away">
                          {game.awayTeamLogo && (
                            <Image
                              src={game.awayTeamLogo}
                              alt={game.away.team}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full border border-white/10 object-cover flex-shrink-0 transition-all duration-300 group-hover/away:scale-110 group-hover/away:rotate-[360deg] group-hover/away:border-blue-400/50 group-hover/away:shadow-lg group-hover/away:shadow-blue-500/20"
                            />
                          )}
                          <span className="text-xs md:text-sm font-medium text-white truncate transition-colors duration-300 group-hover/away:text-blue-300">{game.away.team}</span>
                        </Link>
                        
                        {/* VS Divider */}
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 flex-shrink-0 px-1">vs</span>
                        
                        {/* Home Team */}
                        <Link href={`/team/${encodeURIComponent(game.home.team)}?gender=${game.gender}`} className="flex-1 flex items-center justify-start gap-1.5 min-w-0 group/home">
                          <span className="text-xs md:text-sm font-medium text-white truncate transition-colors duration-300 group-hover/home:text-orange-300">{game.home.team}</span>
                          {game.homeTeamLogo && (
                            <Image
                              src={game.homeTeamLogo}
                              alt={game.home.team}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full border border-white/10 object-cover flex-shrink-0 transition-all duration-300 group-hover/home:scale-110 group-hover/home:rotate-[360deg] group-hover/home:border-orange-400/50 group-hover/home:shadow-lg group-hover/home:shadow-orange-500/20"
                            />
                          )}
                        </Link>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
          
          {/* Voir plus / See more - Animated button linking to /calendrier */}
          <div className="flex justify-center mt-6">
            <Link
              href="/calendrier"
              className="group relative flex items-center gap-3 rounded-full border border-white/10 bg-gradient-to-r from-slate-900/80 to-slate-800/80 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 hover:scale-105"
            >
              <span className="inline-block animate-bounce text-lg" style={{ animationDuration: '0.8s' }}>🏀</span>
              <span>{language === 'fr' ? 'Voir plus' : 'See more'}</span>
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
        </section>

        {/* Final Buzzer Section */}
        <section id="final-buzzer" className="space-y-8">
          <SectionHeader
            id="final-buzzer"
            eyebrow={sectionCopy.games.eyebrow}
            title={sectionCopy.games.title}
          />
          <div className="space-y-4">
            {completedGamesSorted.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-12 text-center">
                <p className="text-lg text-slate-400">No completed games yet.</p>
                <p className="mt-2 text-sm text-slate-500">Check back after games are finished!</p>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => scrollFinalBuzzer("prev")}
                  className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white transition hover:bg-black/80 md:flex"
                  aria-label={language === "fr" ? "Matchs précédents" : "Previous games"}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div
                  ref={finalBuzzerScrollRef}
                  className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
                >
                {completedGamesSorted.map((game) => {
                  const hasWinnerLoserScores =
                    typeof game.winnerScore === "number" && typeof game.loserScore === "number";
                  const hasHomeAwayScores =
                    typeof game.homeScore === "number" && typeof game.awayScore === "number";

                  const homeScore = hasWinnerLoserScores
                    ? game.winnerTeamId === game.homeTeamId
                      ? game.winnerScore
                      : game.loserScore
                    : hasHomeAwayScores
                      ? game.homeScore
                      : 0;

                  const awayScore = hasWinnerLoserScores
                    ? game.winnerTeamId === game.awayTeamId
                      ? game.winnerScore
                      : game.loserScore
                    : hasHomeAwayScores
                      ? game.awayScore
                      : 0;

                  const homeWon = game.winnerTeamId
                    ? game.winnerTeamId === game.homeTeamId
                    : homeScore > awayScore;
                  const awayWon = game.winnerTeamId
                    ? game.winnerTeamId === game.awayTeamId
                    : awayScore > homeScore;

                  const gameDate = game.dateObj
                    ? new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
                        day: "2-digit",
                        month: "2-digit",
                      }).format(game.dateObj)
                    : "";

                  const gameTime = game.dateObj
                    ? new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: language !== "fr",
                      }).format(game.dateObj)
                    : "";

                  const rawMatchday =
                    game.matchday ??
                    game.matchDay ??
                    game.journee ??
                    game.round ??
                    game.matchdayNumber ??
                    game.journeeNumber ??
                    game.gameweek ??
                    game.week;

                  const matchdayNumber = (() => {
                    if (typeof rawMatchday === "number" && Number.isFinite(rawMatchday)) {
                      return rawMatchday;
                    }
                    if (typeof rawMatchday === "string") {
                      const trimmed = rawMatchday.trim();
                      if (!trimmed) {
                        return null;
                      }
                      const numeric = Number(trimmed);
                      if (Number.isFinite(numeric)) {
                        return numeric;
                      }
                      const extracted = trimmed.match(/\d+/);
                      if (extracted) {
                        const parsed = Number(extracted[0]);
                        return Number.isFinite(parsed) ? parsed : null;
                      }
                    }
                    return null;
                  })();

                  const toAbbreviation = (teamName: string | undefined) => {
                    if (!teamName) return "---";
                    const words = teamName
                      .split(" ")
                      .map((value: string) => value.trim())
                      .filter(Boolean);
                    if (words.length === 1) {
                      return words[0].slice(0, 3).toUpperCase();
                    }
                    return words
                      .slice(0, 3)
                      .map((value: string) => value[0])
                      .join("")
                      .toUpperCase();
                  };
                  
                  return (
                    <Link
                      key={game.id}
                      href={`/game/${game.id}`}
                      className="card-lift animate-fade-in inline-block w-fit shrink-0 snap-start rounded-xl border border-white/10 bg-slate-950/80 p-3 sm:p-4 transition-all hover:border-orange-500/70 hover:bg-slate-900/90"
                    >
                      <div className="mb-2 flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
                        <span className="font-medium tracking-wide">{gameDate}{gameTime ? `  ${gameTime}` : ""}</span>
                        {game.winByForfeit === true && (
                          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-orange-200">
                            {language === "fr" ? "Victoire par forfait" : "Win per forfeit"}
                          </span>
                        )}
                      </div>

                      <div className="mb-2 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                        <span>{matchdayNumber !== null ? `${language === "fr" ? "Journée" : "Matchday"} ${matchdayNumber}` : (language === "fr" ? "Journée" : "Matchday")}</span>
                        <span>{game.gender === "men" ? "M" : game.gender === "women" ? "W" : ""}</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex w-fit items-center border border-white/5 bg-white/[0.02] px-2 py-1.5">
                          <div className="flex min-w-0 items-center gap-2">
                            {game.awayTeamLogo && (
                              <Image
                                src={game.awayTeamLogo}
                                alt={game.awayTeamName || "Away team"}
                                width={32}
                                height={32}
                                className="h-7 w-7 rounded-full border border-white/10 bg-white/5 object-cover"
                              />
                            )}
                            <span className={`text-xs font-semibold tracking-[0.12em] ${
                              awayWon ? "text-white" : "text-slate-400"
                            } inline-block w-[2.8rem]`}>
                              {toAbbreviation(game.awayTeamName)}
                            </span>
                            <span className={`text-lg font-bold ${
                              awayWon ? "text-white" : "text-slate-500"
                            } inline-block w-[2.2rem] text-right`}>
                              {awayScore ?? 0}
                            </span>
                          </div>
                        </div>

                        <div className="flex w-fit items-center border border-white/5 bg-white/[0.02] px-2 py-1.5">
                          <div className="flex min-w-0 items-center gap-2">
                            {game.homeTeamLogo && (
                              <Image
                                src={game.homeTeamLogo}
                                alt={game.homeTeamName || "Home team"}
                                width={32}
                                height={32}
                                className="h-7 w-7 rounded-full border border-white/10 bg-white/5 object-cover"
                              />
                            )}
                            <span className={`text-xs font-semibold tracking-[0.12em] ${
                              homeWon ? "text-white" : "text-slate-400"
                            } inline-block w-[2.8rem]`}>
                              {toAbbreviation(game.homeTeamName)}
                            </span>
                            <span className={`text-lg font-bold ${
                              homeWon ? "text-white" : "text-slate-500"
                            } inline-block w-[2.2rem] text-right`}>
                              {homeScore ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                </div>

                <button
                  type="button"
                  onClick={() => scrollFinalBuzzer("next")}
                  className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white transition hover:bg-black/80 md:flex"
                  aria-label={language === "fr" ? "Matchs suivants" : "Next games"}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </section>

        <section id="players" className="space-y-8">
          <SectionHeader
            id="players"
            eyebrow={sectionCopy.players.eyebrow}
            title={sectionCopy.players.title}
            actions={<GenderToggle value={playersGender} onChange={setPlayersGender} language={language} />}
          />
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">League Leader</p>
              <div className="flex flex-wrap gap-2">
                {playerMetricFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setPlayerMetric(filter.key)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition ${
                      playerMetric === filter.key
                        ? "border-white text-white"
                        : "border-white/30 text-slate-400 hover:border-white/60 hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {[...leagueTopPlayers]
                .filter((player) => player.teamGender === playersGender)
                .sort((a, b) => {
                  const statA = playerMetric === "pts" ? a.stats.pts
                    : playerMetric === "reb" ? a.stats.reb
                    : playerMetric === "ast" ? a.stats.ast
                    : playerMetric === "blk" ? a.stats.blk
                    : a.stats.evl;
                  const statB = playerMetric === "pts" ? b.stats.pts
                    : playerMetric === "reb" ? b.stats.reb
                    : playerMetric === "ast" ? b.stats.ast
                    : playerMetric === "blk" ? b.stats.blk
                    : b.stats.evl;
                  return statB - statA;
                })
                .slice(0, leagueLeadersExpanded ? 10 : 10)
                .map((player, index) => {
                const playerName = `${player.firstName} ${player.lastName}`.trim() || player.name || "";
                const playerImage = player.headshot || player.teamLogo || "/logos/liprobakin.png";
                const playerPhotoGlowKey = `${playersGender}-${player.id}`;
                const playerProfileUrl = player.number
                  ? `/player/${encodeURIComponent(player.teamName)}/${player.number}`
                  : `/team/${encodeURIComponent(player.teamName)}?gender=${playersGender}`;
                return (
                  <div
                    key={`${player.id}-${playerMetric}`}
                    className="card-lift animate-scale-in flex-shrink-0 w-[240px] sm:w-[280px] snap-start rounded-3xl border border-white/10 bg-slate-900/60 overflow-hidden hover:border-white/30 transition"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="p-4 sm:p-6 flex flex-col items-center text-center">
                      <span className="text-lg font-bold text-slate-300 mb-3">
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                      <Image
                        src={playerImage}
                        alt={`${playerName} portrait`}
                        width={180}
                        height={180}
                        data-standing-player-photo-id={playerPhotoGlowKey}
                        className={`rounded-full border-4 border-white/10 object-cover mb-4 ${
                          glowedStandingPlayerPhotos[playerPhotoGlowKey] ? "standings-player-photo-glow-once" : ""
                        }`}
                        style={{
                          width: 140,
                          height: 140,
                        }}
                      />
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-1">
                        #{player.number} · {player.teamName}
                      </p>
                      <Link
                        href={playerProfileUrl}
                        className="text-xl font-bold text-white mb-4 transition hover:text-blue-300"
                      >
                        {playerName}
                      </Link>
                      <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full">
                        <div>
                          <p className="text-xs uppercase text-slate-400">PTS</p>
                          <p className="text-base sm:text-lg font-bold text-white">{player.stats.pts}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">REB</p>
                          <p className="text-base sm:text-lg font-bold text-white">{player.stats.reb}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">AST</p>
                          <p className="text-base sm:text-lg font-bold text-white">{player.stats.ast}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">BLK</p>
                          <p className="text-base sm:text-lg font-bold text-white">{player.stats.blk}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">EVL</p>
                          <p className="text-base sm:text-lg font-bold text-white">{Math.round(player.stats.evl)}</p>
                        </div>
                      </div>
                      {player.isImport && (
                        <div className="mt-3 flex items-center justify-center gap-1">
                          <span className="text-emerald-400">★</span>
                          <span className="text-slate-300 italic font-medium">import</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {homepageStandings.length > 0 ? (
          <section id="standings" className="space-y-8">
            <SectionHeader
              id="standings"
              eyebrow={sectionCopy.standings.eyebrow}
              title={sectionCopy.standings.title}
              titleHref="/classement"
              autoShine={standingsAutoShine}
              shineMode="twice"
              actions={<GenderToggle value={standingsGender} onChange={setStandingsGender} language={language} />}
            />
            <div className="overflow-hidden rounded-2xl border border-white/5">
              <div className="max-sm:overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-20 bg-slate-950/70 backdrop-blur-xl text-sm uppercase tracking-[0.3em] text-slate-300 border-b border-white/10">
                    <tr>
                      <th className="pl-3 pr-1 py-2">N°</th>
                      <th className="pl-1 pr-3 py-2">{copy.standingsTable.team}</th>
                      <th className="px-3 py-2">{copy.standingsTable.wins}</th>
                      <th className="px-3 py-2">{copy.standingsTable.losses}</th>
                      <th className="px-3 py-2">{copy.standingsTable.totalPoints}</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {homepageStandings.map((row, index) => {
                      const franchise = findFranchiseByName(row.team, allFranchises);
                      const displayName = franchise ? formatFranchiseName(franchise) : normalizeTeamName(row.team);
                      const normalizedName = displayName.replace(/^espoir\s+espoir\s+/i, "Espoir ");
                      const truncatedName =
                        normalizedName.length > 15 ? `${normalizedName.slice(0, 12)}...` : normalizedName;
                      const loadedGameLogo = standingsLogosFromLoadedGames.get(normalizeTeamName(row.team).toLowerCase()) ?? null;
                      const teamLogo = getResolvedTeamLogo({
                        teamName: row.team,
                        logo: typeof row.logo === "string" && !row.logo.includes("/logos/liprobakin.png") ? row.logo : loadedGameLogo,
                        franchise,
                      });
                      const initials = normalizedName
                        .split(" ")
                        .map((word) => word[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      const linkTeamName = franchise ? displayName : row.team;
                      const rowGender = row.gender === "women" ? "women" : "men";
                      const teamRouteValue = row.teamId ? row.teamId : linkTeamName;
                      const teamHref = `/team/${encodeURIComponent(teamRouteValue)}?gender=${rowGender}`;

                      return (
                        <tr
                          key={row.teamKey ?? (row.teamId ? row.teamId : `${row.gender}:${row.team}:${index}`)}
                          className="odd:bg-white/5 hover:bg-orange-500/10 cursor-pointer transition-colors"
                        >
                          <td className="pl-3 pr-1 py-2 text-slate-300">
                            <Link href={teamHref} className="block">
                              {row.seed}
                            </Link>
                          </td>
                          <td className="pl-1 pr-3 py-2 font-semibold">
                            <Link
                              href={teamHref}
                              className="flex items-center gap-3 text-white transition-colors hover:text-orange-500"
                            >
                              {teamLogo ? (
                                <Image
                                  src={teamLogo}
                                  alt={`${displayName} logo`}
                                  width={28}
                                  height={28}
                                  className="h-7 w-7 rounded-full border border-white/10 bg-white/5 object-cover"
                                />
                              ) : (
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                                  {initials}
                                </span>
                              )}
                              <span className="truncate md:hidden" title={normalizedName}>
                                {truncatedName}
                              </span>
                              <span className="hidden md:inline truncate" title={normalizedName}>
                                {normalizedName}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-2">
                            <Link href={teamHref} className="block">
                              {row.wins}
                            </Link>
                          </td>
                          <td className="px-3 py-2">
                            <Link href={teamHref} className="block">
                              {row.losses}
                            </Link>
                          </td>
                          <td className="px-3 py-2 font-semibold text-white">
                            <Link href={teamHref} className="block">
                              {row.leaguePoints ?? getLeaguePoints(row.wins, row.losses)}
                            </Link>
                          </td>
                          <td className="px-2 py-2">
                            {row.rankChange === "up" ? (
                              <span className="text-emerald-400">▲</span>
                            ) : row.rankChange === "down" ? (
                              <span className="text-red-400">▼</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        <section id="teams" className="space-y-0">
          <SectionHeader
            id="teams"
            eyebrow={sectionCopy.teams.eyebrow}
            title={sectionCopy.teams.title}
            actions={<GenderToggle value={franchiseGender} onChange={setFranchiseGender} language={language} />}
          />
          
          {/* Search bar */}
          <div className="max-w-2xl mx-auto px-1 sm:px-0 -mt-px">
            <div className="relative">
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder={language === 'en' ? 'Choose your team...' : 'Choisissez votre équipe...'}
                className="w-full px-3.5 py-2.5 bg-slate-900/50 border-2 border-blue-500/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-base sm:text-[0.85rem]"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              />
              {teamSearch && (
                <button
                  onClick={() => setTeamSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {teamSearch && filteredFranchises.length === 0 && (
              <p className="mt-2 text-sm text-slate-400 text-center">
                {language === 'en' ? 'No teams found' : 'Aucune équipe trouvée'}
              </p>
            )}

          </div>
          
          <div className={`relative mt-3 sm:mt-4 ${teamSearch ? 'px-1 sm:px-4' : 'px-1 sm:px-0 md:w-screen md:left-1/2 md:right-1/2 md:-ml-[50vw] md:-mr-[50vw] md:px-0 md:relative'}`}>
            {teamSearch ? (
              // Search Results - auto-scrolling marquee format
              <div className="relative overflow-hidden">
                <div className="relative">
                  <div className="marquee-container overflow-hidden flex justify-center" style={{ width: '100%' }}>
                    <div className="marquee-content flex animate-marquee hover:animation-pause">
                      {/* First set of search results */}
                      {visibleFranchises.map((team) => {
                        const fullName = buildTeamDisplayName(team);
                        return (
                          <Link
                            key={`search-first-${fullName}`}
                            href={`/team/${encodeURIComponent(fullName)}?gender=${franchiseGender}`}
                            className="logo-showcase-item flex-shrink-0 mx-4 lg:mx-6 group"
                          >
                            <div className="logo-inner relative">
                              <div className="logo-innerInner p-4 transition-all duration-300 group-hover:scale-110">
                                {team.logo ? (
                                  <Image
                                    src={team.logo}
                                    alt={`${fullName} logo`}
                                    width={88}
                                    height={88}
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 object-cover shadow-lg transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))',
                                    }}
                                    priority={false}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div 
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${team.colors[0]}, ${team.colors[1]})`
                                    }}
                                  >
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                      {/* Duplicate set for seamless loop */}
                      {visibleFranchises.map((team) => {
                        const fullName = buildTeamDisplayName(team);
                        return (
                          <Link
                            key={`search-second-${fullName}`}
                            href={`/team/${encodeURIComponent(fullName)}?gender=${franchiseGender}`}
                            className="logo-showcase-item flex-shrink-0 mx-4 lg:mx-6 group"
                          >
                            <div className="logo-inner relative">
                              <div className="logo-innerInner p-4 transition-all duration-300 group-hover:scale-110">
                                {team.logo ? (
                                  <Image
                                    src={team.logo}
                                    alt={`${fullName} logo`}
                                    width={88}
                                    height={88}
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 object-cover shadow-lg transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))',
                                    }}
                                    priority={false}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div 
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${team.colors[0]}, ${team.colors[1]})`
                                    }}
                                  >
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Logo Showcase Marquee - new carousel design
              <div className="relative overflow-hidden">
                <div className="relative">
                  {/* Marquee Container */}
                  <div className="marquee-container overflow-hidden flex justify-center" style={{ width: '100%' }}>
                    <div className="marquee-content flex animate-marquee hover:animation-pause">
                      {/* First set of logos */}
                      {visibleFranchises.map((team) => {
                        const fullName = buildTeamDisplayName(team);
                        return (
                          <Link
                            key={`first-${fullName}`}
                            href={`/team/${encodeURIComponent(fullName)}?gender=${franchiseGender}`}
                            className="logo-showcase-item flex-shrink-0 mx-4 lg:mx-6 group"
                          >
                            <div className="logo-inner relative">
                              <div className="logo-innerInner p-4 transition-all duration-300 group-hover:scale-110">
                                {team.logo ? (
                                  <Image
                                    src={team.logo}
                                    alt={`${fullName} logo`}
                                    width={88}
                                    height={88}
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 object-cover shadow-lg transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))',
                                    }}
                                    priority={false}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div 
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${team.colors[0]}, ${team.colors[1]})`
                                    }}
                                  >
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                      {/* Duplicate set for seamless loop */}
                      {visibleFranchises.map((team) => {
                        const fullName = buildTeamDisplayName(team);
                        return (
                          <Link
                            key={`second-${fullName}`}
                            href={`/team/${encodeURIComponent(fullName)}?gender=${franchiseGender}`}
                            className="logo-showcase-item flex-shrink-0 mx-4 lg:mx-6 group"
                          >
                            <div className="logo-inner relative">
                              <div className="logo-innerInner p-4 transition-all duration-300 group-hover:scale-110">
                                {team.logo ? (
                                  <Image
                                    src={team.logo}
                                    alt={`${fullName} logo`}
                                    width={88}
                                    height={88}
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 object-cover shadow-lg transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))',
                                    }}
                                    priority={false}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div 
                                    className="h-[67px] w-[67px] lg:h-[84px] lg:w-[84px] rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br transition-all duration-300 group-hover:border-white/40 group-hover:shadow-xl"
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${team.colors[0]}, ${team.colors[1]})`
                                    }}
                                  >
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Committee Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRefs(false)}
              className="text-left"
              aria-label={language === "fr" ? "Afficher le comité" : "Show committee"}
            >
              {sectionCopy.committee.eyebrow ? (
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{sectionCopy.committee.eyebrow}</p>
              ) : null}
              <h2 id="committee-title" className="text-3xl font-semibold text-white">
                {sectionCopy.committee.title}
              </h2>
              {sectionCopy.committee.description ? (
                <p className="mt-2 text-sm text-slate-300">{sectionCopy.committee.description}</p>
              ) : null}
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block h-10 w-0.5 bg-slate-400/30" aria-hidden />
              <button
                type="button"
                onClick={() => setShowRefs(true)}
                className="group flex flex-col items-start transition-all duration-300"
                aria-label={language === "fr" ? "Afficher les arbitres" : "Show referees"}
              >
                <span className="gold-hover-text text-3xl font-semibold text-white transition-colors">
                  {language === "fr" ? "Arbitres" : "Referee"}
                </span>
              </button>
            </div>
          </div>
          
          {/* Sliding container for Committee/Refs transition */}
          <div className="relative overflow-hidden">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: showRefs ? "translateX(-100%)" : "translateX(0)" }}
            >
              {/* Committee View */}
              <div className="w-full flex-shrink-0">
                {(dynamicCommittee.length > 0 || dynamicCommission.length > 0) ? (
                  <div className="overflow-x-auto overflow-y-hidden pb-4 -mx-4 px-4">
                    <div className="flex gap-3 md:gap-4">
                      {/* Committee Members */}
                      {dynamicCommittee.map((member) => (
                        <Link
                          key={member.id}
                          href={`/staff/${member.id}`}
                          className="group relative overflow-hidden rounded-lg border border-white/10 bg-slate-900/50 transition-all hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10 flex-shrink-0 w-[162px] sm:w-[180px] md:w-[198px]"
                        >
                          <div className="aspect-[4/5] relative">
                            {member.photo ? (
                              <Image
                                src={member.photo}
                                alt={member.name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-900/20 via-slate-900 to-slate-900">
                                <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xl md:text-2xl font-bold text-white shadow-lg">
                                  {member.name.charAt(0)}
                                </div>
                              </div>
                            )}
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            {/* Info at bottom */}
                            <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                              <p className="font-semibold text-white text-xs md:text-sm truncate">{member.name}</p>
                              <p className="text-[10px] md:text-xs text-orange-400 truncate">{member.role}</p>
                            </div>
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                      {/* Commission Members - Blue styling */}
                      {dynamicCommission.map((member) => (
                        <Link
                          key={member.id}
                          href={`/staff/${member.id}`}
                          className="group relative overflow-hidden rounded-lg border border-white/10 bg-slate-900/50 transition-all hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 flex-shrink-0 w-[162px] sm:w-[180px] md:w-[198px]"
                        >
                          <div className="aspect-[4/5] relative">
                            {member.photo ? (
                              <Image
                                src={member.photo}
                                alt={member.name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-900/20 via-slate-900 to-slate-900">
                                <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xl md:text-2xl font-bold text-white shadow-lg">
                                  {member.name.charAt(0)}
                                </div>
                              </div>
                            )}
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            {/* Info at bottom */}
                            <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                              <p className="font-semibold text-white text-xs md:text-sm truncate">{member.name}</p>
                              <p className="text-[10px] md:text-xs text-blue-400 truncate">{member.role}</p>
                            </div>
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/20 bg-slate-900/30 py-12 text-center">
                    <p className="text-slate-400">{language === "fr" ? "Aucun membre du comité" : "No committee members yet"}</p>
                  </div>
                )}
              </div>
              
              {/* Refs View */}
              <div className="w-full flex-shrink-0">
                {dynamicReferees.length > 0 ? (
                  <div className="overflow-x-auto overflow-y-hidden pb-4 -mx-4 px-4">
                    <div className="flex gap-3 md:gap-4">
                      {dynamicReferees.map((ref) => (
                        <Link
                          key={ref.id}
                          href={`/referees/${ref.id}`}
                          className="group relative overflow-hidden rounded-lg border border-white/10 bg-slate-900/50 transition-all hover:border-slate-400/30 hover:shadow-lg hover:shadow-slate-400/10 flex-shrink-0 w-[162px] sm:w-[180px] md:w-[198px]"
                        >
                          <div className="aspect-[4/5] relative">
                            {ref.photo ? (
                              <Image
                                src={ref.photo}
                                alt={ref.name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800/50 via-slate-900 to-slate-900">
                                <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-600 text-xl md:text-2xl font-bold text-white shadow-lg">
                                  {ref.name.charAt(0)}
                                </div>
                              </div>
                            )}
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            {/* Info at bottom */}
                            <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                              <p className="font-semibold text-white text-xs md:text-sm truncate">{ref.name}</p>
                              <p className="text-[10px] md:text-xs text-slate-400 truncate">{ref.role}</p>
                            </div>
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-slate-400/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/20 bg-slate-900/30 py-12 text-center">
                    <p className="text-slate-400">{language === "fr" ? "Aucun arbitre" : "No referees yet"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        </div>
      </main>

      {/* Contact section */}
      {true && (
      <section className="mx-auto mt-8 w-full max-w-3xl px-4 pb-8">
        <div className="rounded-2xl border border-white/15 bg-slate-900/40 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
          <div className="mb-5 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-orange-200 sm:text-3xl">{copy.contact.title}</h2>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">{copy.contact.subtitle}</p>
          </div>

          {contactSuccess ? (
            <div className="rounded-xl border border-orange-300/30 bg-orange-500/10 p-6 text-center">
              <p className="text-lg font-semibold text-orange-200">{language === "fr" ? "Message envoyé !" : "Message sent!"}</p>
              <p className="mt-1 text-sm text-slate-300">{language === "fr" ? "Nous vous répondrons bientôt." : "We'll get back to you soon."}</p>
              <button
                type="button"
                onClick={() => {
                  setContactSuccess(false);
                  setContactNotice(null);
                }}
                className="mt-4 text-sm text-orange-300 underline hover:text-orange-200"
              >
                {language === "fr" ? "Envoyer un autre message" : "Send another message"}
              </button>
              {contactNotice && (
                <p className="mt-3 text-xs text-orange-200/90">{contactNotice}</p>
              )}
            </div>
          ) : (
          <form className="space-y-4" onSubmit={handleContactSubmit}>
            {contactError && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                {contactError}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.22em] text-orange-100" htmlFor="contact-first-name">
                  {copy.contact.firstName}
                </label>
                <input
                  id="contact-first-name"
                  type="text"
                  required
                  disabled={contactSubmitting}
                  value={contactForm.firstName}
                  onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                  placeholder={copy.contact.placeholderFirstName}
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-slate-400 focus:border-orange-300/60 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.22em] text-orange-100" htmlFor="contact-last-name">
                  {copy.contact.lastName}
                </label>
                <input
                  id="contact-last-name"
                  type="text"
                  required
                  disabled={contactSubmitting}
                  value={contactForm.lastName}
                  onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                  placeholder={copy.contact.placeholderLastName}
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-slate-400 focus:border-orange-300/60 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.22em] text-orange-100" htmlFor="contact-email">
                  {copy.contact.emailAddress}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  disabled={contactSubmitting}
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder={copy.contact.placeholderEmail}
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-slate-400 focus:border-orange-300/60 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.22em] text-orange-100" htmlFor="contact-phone">
                  {copy.contact.phoneOptional}
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  disabled={contactSubmitting}
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder={copy.contact.placeholderPhone}
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-slate-400 focus:border-orange-300/60 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.22em] text-orange-100" htmlFor="contact-message">
                {copy.contact.yourMessage}
              </label>
              <textarea
                id="contact-message"
                rows={4}
                required
                disabled={contactSubmitting}
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder={copy.contact.placeholderMessage}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-400 focus:border-orange-300/60 focus:outline-none disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={contactSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 px-5 py-2.5 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-950 transition hover:from-orange-300 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {contactSubmitting ? (language === "fr" ? "Envoi..." : "Sending...") : copy.contact.sendMessage}
              <span aria-hidden>➤</span>
            </button>
          </form>
          )}
        </div>
      </section>
      )}

      {/* Partners Strip - Before Footer */}
      {dynamicPartners.length > 0 && (
        <div className="border-t border-white/5 bg-black/30 py-7">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-center gap-7 sm:gap-10 flex-wrap">
              {dynamicPartners.slice(0, 6).map((partner) => (
                <div 
                  key={partner.id} 
                  className="flex-shrink-0 h-9 sm:h-11 opacity-60 hover:opacity-100 transition-opacity"
                >
                  {partner.logo ? (
                    <div className="relative h-full w-18 sm:w-22" style={{ width: '4.5rem' }}>
                      <Image
                        src={partner.logo}
                        alt={partner.name}
                        fill
                        className="object-contain"
                      />
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

      <footer className="border-t border-white/10 bg-black/50 py-6 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-center text-xs uppercase tracking-[0.3em] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <p>
              {copy.footerTagline}
            </p>
            <span className="hidden sm:inline text-slate-600">•</span>
            <a 
              href="https://buildbyland.com"
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-[10px] tracking-[0.4em] text-slate-500 hover:text-orange-400 transition-all duration-300"
            >
              <span className="uppercase">Built by</span>
              <span className="relative">
                <span className="font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent group-hover:from-orange-300 group-hover:via-amber-400 group-hover:to-orange-500 transition-all duration-300">
                  Landry Palata
                </span>
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-gradient-to-r from-orange-400 to-amber-500 group-hover:w-full transition-all duration-300"></span>
              </span>
              <svg className="w-3 h-3 text-orange-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{copy.languageLabel}</span>
              <div className="flex gap-2">
                {languageOptions.map((locale) => (
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
              <a
                href="https://www.facebook.com/Liprobakin/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/5 transition hover:border-white hover:bg-white/10"
                aria-label="Liprobakin on Facebook"
                title="Facebook"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M13.5 22v-8.01H16l.5-3H13.5V9.5c0-.87.29-1.5 1.63-1.5H16V5.1c-.23-.03-1.02-.1-2.02-.1-2.1 0-3.48 1.28-3.48 3.67v2.32H8v3h2.5V22h3z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/liprobakin_league/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/5 transition hover:border-white hover:bg-white/10"
                aria-label="Liprobakin on Instagram"
                title="Instagram"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                  <path d="M16 11.37a4 4 0 11-7.93 1.17 4 4 0 017.93-1.17z" />
                  <path d="M17.5 6.5h.01" />
                </svg>
              </a>
            </div>
            <Link
              href="/admin"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/5 transition hover:border-white hover:bg-white/10"
              aria-label="Admin Login"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          </div>
        </div>
      </footer>
      {selectedTeam ? (
        <RosterModal teamName={selectedTeam.label} onClose={() => setSelectedTeam(null)} allFranchises={allFranchises} />
      ) : null}
      {selectedPlayer ? (
        <PlayerStatsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      ) : null}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      {showProfilePopup && userProfile ? (
        <PlayerProfilePopup 
          userProfile={userProfile} 
          onClose={() => setShowProfilePopup(false)}
          language={language}
        />
      ) : null}
    </div>
  );
}
