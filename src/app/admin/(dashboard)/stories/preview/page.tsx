"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import ArticleContent from "@/components/ArticleContent";
import MentionedEntities from "@/components/MentionedEntities";
import { useAdmin } from "../../layout";

type AdditionalMediaSize = "full" | "half" | "third";
type AdditionalMediaAlign = "left" | "center" | "right";
type CanonicalAdditionalMediaWrap = "inline" | "square" | "tight" | "through" | "topBottom" | "behind" | "front";
type AdditionalMediaWrap = CanonicalAdditionalMediaWrap | "wrap" | "break";
type AdditionalMediaWrapSide = "bothSides" | "leftOnly" | "rightOnly" | "largestOnly";

type PreviewMediaItem = {
  type: "image" | "video";
  url: string;
  size: AdditionalMediaSize;
  align: AdditionalMediaAlign;
  textWrap?: AdditionalMediaWrap;
  wrapSide?: AdditionalMediaWrapSide;
  height: number;
  order: number;
  widthPercent?: number;
  offsetX?: number;
  offsetY?: number;
  distanceTop?: number;
  distanceRight?: number;
  distanceBottom?: number;
  distanceLeft?: number;
};

type PreviewPayload = {
  id?: string | null;
  title?: string;
  summary?: string;
  author?: string;
  createdAtIso?: string;
  additionalMedia?: PreviewMediaItem[];
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

const NEWS_MAIN_PREVIEW_STORAGE_KEY = "news-main-preview-draft";
const MIN_ADDITIONAL_MEDIA_HEIGHT = 160;
const MAX_ADDITIONAL_MEDIA_HEIGHT = 640;
const MIN_ADDITIONAL_MEDIA_WIDTH = 35;
const MAX_ADDITIONAL_MEDIA_WIDTH = 100;
const MIN_FIXED_MEDIA_TRANSLATE_X = -5000;
const MAX_FIXED_MEDIA_TRANSLATE_X = 5000;
const MIN_FIXED_MEDIA_TRANSLATE_Y = -5000;
const MAX_FIXED_MEDIA_TRANSLATE_Y = 5000;
const MIN_MEDIA_TEXT_DISTANCE = 0;
const MAX_MEDIA_TEXT_DISTANCE = 48;
const DEFAULT_MEDIA_TEXT_DISTANCE = 12;

const MAX_RESET_WRAP_OFFSET_X = 240;
const MAX_RESET_WRAP_OFFSET_Y = 480;

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const sanitizeMediaForResetBounds = (item: PreviewMediaItem): PreviewMediaItem => {
  const wrapMode = normalizeWrapMode(item.textWrap);
  const usesTextWrap = wrapMode === "square" || wrapMode === "tight" || wrapMode === "through";
  const usesWrapLayoutOffsets = usesTextWrap || wrapMode === "topBottom";

  const distanceTop = normalizeTextDistance(item.distanceTop);
  const distanceLeft = normalizeTextDistance(item.distanceLeft);

  // Reset should restore the original size exactly; only clamp offsets to keep media in-bounds.
  const widthPercent = Number.isFinite(Number(item.widthPercent)) ? Number(item.widthPercent) : 100;
  const height = Number.isFinite(Number(item.height)) ? Number(item.height) : 320;

  const rawOffsetX = Math.round(Number(item.offsetX || 0));
  const rawOffsetY = Math.round(Number(item.offsetY || 0));

  if (wrapMode === "behind" || wrapMode === "front") {
    return {
      ...item,
      widthPercent,
      height,
      // Fixed-position media uses absolute coordinates within the article body.
      // Keep them non-negative and within a reasonable safety range.
      offsetX: clampNumber(rawOffsetX, 0, MAX_FIXED_MEDIA_TRANSLATE_X),
      offsetY: clampNumber(rawOffsetY, 0, MAX_FIXED_MEDIA_TRANSLATE_Y),
    };
  }

  if (usesWrapLayoutOffsets) {
    return {
      ...item,
      widthPercent,
      height,
      // Prevent negative margins that can push media outside the left/top edge on reset.
      offsetX: clampNumber(rawOffsetX, -distanceLeft, MAX_RESET_WRAP_OFFSET_X),
      offsetY: clampNumber(rawOffsetY, -distanceTop, MAX_RESET_WRAP_OFFSET_Y),
    };
  }

  return {
    ...item,
    widthPercent,
    height,
    offsetX: 0,
    offsetY: 0,
  };
};

type PlacementMenuMode = "topLeft" | "bottom" | "free";

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

const normalizeWrapSide = (side?: AdditionalMediaWrapSide): AdditionalMediaWrapSide => {
  if (side === "leftOnly" || side === "rightOnly" || side === "largestOnly" || side === "bothSides") {
    return side;
  }
  return "bothSides";
};

const normalizeTextDistance = (value?: number): number => {
  return Math.max(MIN_MEDIA_TEXT_DISTANCE, Math.min(MAX_MEDIA_TEXT_DISTANCE, Number(value ?? DEFAULT_MEDIA_TEXT_DISTANCE)));
};

const getTextWrapFloatClass = (wrapMode: CanonicalAdditionalMediaWrap, wrapSide: AdditionalMediaWrapSide): string => {
  if (!(wrapMode === "square" || wrapMode === "tight" || wrapMode === "through")) {
    return "";
  }
  if (wrapSide === "leftOnly") return "float-right";
  return "float-left";
};

function formatTimeAgo(createdAt: Date, language: "en" | "fr") {
  const now = Date.now();
  const diffMs = Math.max(0, now - createdAt.getTime());
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (language === "fr") {
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${days} j`;
  }

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

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
              // Browser autoplay policy can block play before user interaction.
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

const readPreviewPayload = (): PreviewPayload | null => {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(NEWS_MAIN_PREVIEW_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PreviewPayload;
  } catch {
    return null;
  }
};

export default function StoriesMainPreviewPage() {
  const router = useRouter();
  const { language } = useAdmin();
  const initialPayload = readPreviewPayload();
  const [payload] = useState<PreviewPayload | null>(initialPayload);
  const [initialMediaList] = useState<PreviewMediaItem[]>(() =>
    [...(initialPayload?.additionalMedia || [])]
      .map((item) => {
        const canonicalWrap = normalizeWrapMode(item.textWrap);
        return {
          ...item,
          textWrap: canonicalWrap === "inline" ? "square" : canonicalWrap,
          wrapSide: normalizeWrapSide(item.wrapSide),
        };
      })
      .sort((a, b) => a.order - b.order)
  );
  const [mediaList, setMediaList] = useState<PreviewMediaItem[]>(() =>
    initialMediaList.map((item) => ({ ...item }))
  );
  const [editableSummary] = useState<string>(initialPayload?.summary || "");
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [dragHud, setDragHud] = useState<{
    index: number;
    mode: "pan" | "resize" | "resizeX" | "resizeY";
    x: number;
    y: number;
  } | null>(null);
  const [placementMenuMode, setPlacementMenuMode] = useState<Record<number, PlacementMenuMode>>({});
  const placementMenuModeRef = useRef<Record<number, PlacementMenuMode>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const articleIdRef = useRef<string | null | undefined>(initialPayload?.id);
  const articleBodyRef = useRef<HTMLDivElement | null>(null);
  const mediaListRef = useRef<PreviewMediaItem[]>([]);
  const dragStateRef = useRef<{
    index: number;
    lastY: number;
    lastX: number;
    mode: "pan" | "resize" | "resizeX" | "resizeXLeft" | "resizeY" | "resizeYBottom";
    startHeight: number;
    startWidth: number;
  } | null>(null);

  const createdAt = payload?.createdAtIso ? new Date(payload.createdAtIso) : new Date();
  const resolvedCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

  useEffect(() => {
    mediaListRef.current = mediaList;
  }, [mediaList]);

  useEffect(() => {
    placementMenuModeRef.current = placementMenuMode;
  }, [placementMenuMode]);

  useEffect(() => {
    setMediaList((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const canonicalWrap = normalizeWrapMode(item.textWrap);
        const nextWrap: CanonicalAdditionalMediaWrap = canonicalWrap === "inline" ? "square" : canonicalWrap;
        const nextWrapSide = normalizeWrapSide(item.wrapSide);
        const sanitized = sanitizeMediaForResetBounds({ ...item, textWrap: nextWrap, wrapSide: nextWrapSide });
        if (
          nextWrap !== item.textWrap ||
          nextWrapSide !== item.wrapSide ||
          sanitized.offsetX !== item.offsetX ||
          sanitized.offsetY !== item.offsetY ||
          sanitized.widthPercent !== item.widthPercent ||
          sanitized.height !== item.height
        ) {
          changed = true;
          return sanitized;
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, []);

  // Ensure articleIdRef stays in sync with sessionStorage
  useEffect(() => {
    if (!articleIdRef.current) {
      const fresh = readPreviewPayload();
      if (fresh?.id) {
        articleIdRef.current = fresh.id;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !payload) return;
    const nextPayload: PreviewPayload = {
      ...payload,
      summary: editableSummary,
      additionalMedia: mediaList,
    };
    window.sessionStorage.setItem(NEWS_MAIN_PREVIEW_STORAGE_KEY, JSON.stringify(nextPayload));
  }, [editableSummary, mediaList, payload]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;

      const delta = event.clientY - drag.lastY;
      const deltaX = event.clientX - drag.lastX;

      if (drag.mode === "pan") {
        setMediaList((prev) => {
          const next = [...prev];
          const current = next[drag.index];
          if (!current) return prev;

          const wrapMode = normalizeWrapMode(current.textWrap);
          const wantsFreePlacement = placementMenuModeRef.current[drag.index] === "free";
          const nextWrapMode: CanonicalAdditionalMediaWrap = wantsFreePlacement ? "square" : wrapMode;
          const isFixedPosition = nextWrapMode === "behind" || nextWrapMode === "front";

          const widthPercent = Math.round(Number(current.widthPercent || 100));
          const heightPx = Math.round(Number(current.height || 320));

          let nextOffsetX = Math.round((current.offsetX || 0) + deltaX);
          let nextOffsetY = Math.round((current.offsetY || 0) + delta);

          if (isFixedPosition) {
            const container = articleBodyRef.current;
            const rect = container?.getBoundingClientRect();
            if (rect) {
              const itemWidthPx = Math.max(0, Math.round((rect.width * widthPercent) / 100));
              const maxX = Math.max(0, Math.round(rect.width - itemWidthPx));
              const maxY = Math.max(0, Math.round(rect.height - heightPx));
              nextOffsetX = clampNumber(nextOffsetX, 0, maxX);
              nextOffsetY = clampNumber(nextOffsetY, 0, maxY);
            } else {
              nextOffsetX = clampNumber(nextOffsetX, 0, MAX_FIXED_MEDIA_TRANSLATE_X);
              nextOffsetY = clampNumber(nextOffsetY, 0, MAX_FIXED_MEDIA_TRANSLATE_Y);
            }
          } else {
            nextOffsetX = clampNumber(nextOffsetX, MIN_FIXED_MEDIA_TRANSLATE_X, MAX_FIXED_MEDIA_TRANSLATE_X);
            nextOffsetY = clampNumber(nextOffsetY, MIN_FIXED_MEDIA_TRANSLATE_Y, MAX_FIXED_MEDIA_TRANSLATE_Y);
          }

          if ((current.offsetX || 0) === nextOffsetX && (current.offsetY || 0) === nextOffsetY) {
            return prev;
          }
          next[drag.index] = {
            ...current,
            textWrap: nextWrapMode,
            align: isFixedPosition ? "left" : current.align,
            offsetX: nextOffsetX,
            offsetY: nextOffsetY,
          };
          setDragHud({ index: drag.index, mode: "pan", x: nextOffsetX, y: nextOffsetY });
          return next;
        });
        dragStateRef.current = { ...drag, lastY: event.clientY, lastX: event.clientX };
        return;
      }

      if (drag.mode === "resize") {
        setMediaList((prev) => {
          const next = [...prev];
          const current = next[drag.index];
          if (!current) return prev;
          const nextWidth = Math.max(
            MIN_ADDITIONAL_MEDIA_WIDTH,
            Math.min(MAX_ADDITIONAL_MEDIA_WIDTH, Math.round(drag.startWidth + deltaX * 0.15))
          );
          const nextHeight = Math.max(
            MIN_ADDITIONAL_MEDIA_HEIGHT,
            Math.min(MAX_ADDITIONAL_MEDIA_HEIGHT, Math.round(drag.startHeight + delta * 0.9))
          );
          if ((current.widthPercent || 100) === nextWidth && current.height === nextHeight) {
            return prev;
          }
          next[drag.index] = { ...current, widthPercent: nextWidth, height: nextHeight };
          setDragHud({ index: drag.index, mode: "resize", x: nextWidth, y: nextHeight });
          return next;
        });
        return;
      }

      if (drag.mode === "resizeX") {
        setMediaList((prev) => {
          const next = [...prev];
          const current = next[drag.index];
          if (!current) return prev;
          const nextWidth = Math.max(
            MIN_ADDITIONAL_MEDIA_WIDTH,
            Math.min(MAX_ADDITIONAL_MEDIA_WIDTH, Math.round(drag.startWidth + deltaX * 0.15))
          );
          if ((current.widthPercent || 100) === nextWidth) {
            return prev;
          }
          next[drag.index] = { ...current, widthPercent: nextWidth };
          setDragHud({ index: drag.index, mode: "resizeX", x: nextWidth, y: Number(current.height || 320) });
          return next;
        });
        return;
      }

      if (drag.mode === "resizeXLeft") {
        setMediaList((prev) => {
          const next = [...prev];
          const current = next[drag.index];
          if (!current) return prev;
          const nextWidth = Math.max(
            MIN_ADDITIONAL_MEDIA_WIDTH,
            Math.min(MAX_ADDITIONAL_MEDIA_WIDTH, Math.round(drag.startWidth - deltaX * 0.15))
          );
          if ((current.widthPercent || 100) === nextWidth) {
            return prev;
          }
          next[drag.index] = { ...current, widthPercent: nextWidth };
          setDragHud({ index: drag.index, mode: "resizeX", x: nextWidth, y: Number(current.height || 320) });
          return next;
        });
        return;
      }

      if (drag.mode === "resizeY") {
        setMediaList((prev) => {
          const next = [...prev];
          const current = next[drag.index];
          if (!current) return prev;
          const nextHeight = Math.max(
            MIN_ADDITIONAL_MEDIA_HEIGHT,
            Math.min(MAX_ADDITIONAL_MEDIA_HEIGHT, Math.round(drag.startHeight - delta * 0.9))
          );
          if (current.height === nextHeight) {
            return prev;
          }
          next[drag.index] = { ...current, height: nextHeight };
          setDragHud({ index: drag.index, mode: "resizeY", x: Number(current.widthPercent || 100), y: nextHeight });
          return next;
        });
        return;
      }

      if (drag.mode === "resizeYBottom") {
        setMediaList((prev) => {
          const next = [...prev];
          const current = next[drag.index];
          if (!current) return prev;
          const nextHeight = Math.max(
            MIN_ADDITIONAL_MEDIA_HEIGHT,
            Math.min(MAX_ADDITIONAL_MEDIA_HEIGHT, Math.round(drag.startHeight + delta * 0.9))
          );
          if (current.height === nextHeight) {
            return prev;
          }
          next[drag.index] = { ...current, height: nextHeight };
          setDragHud({ index: drag.index, mode: "resizeY", x: Number(current.widthPercent || 100), y: nextHeight });
          return next;
        });
        return;
      }

      dragStateRef.current = { ...drag, lastY: event.clientY, lastX: event.clientX };
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setDragHud(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  const startMediaDrag = (index: number, mode: "pan" | "resize" | "resizeX" | "resizeXLeft" | "resizeY" | "resizeYBottom", event: ReactPointerEvent<HTMLElement>) => {
    const item = mediaListRef.current[index];
    setSelectedMediaIndex(index);
    if (mode === "pan") {
      setMediaList((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current) return prev;
        next[index] = {
          ...current,
          textWrap: "square",
          wrapSide: "bothSides",
        };
        return next;
      });
    }
    dragStateRef.current = {
      index,
      lastY: event.clientY,
      lastX: event.clientX,
      mode,
      startHeight: Number(item?.height || 320),
      startWidth: Number(item?.widthPercent || 100),
    };
    if (mode === "pan") {
      setDragHud({ index, mode: "pan", x: Number(item?.offsetX || 0), y: Number(item?.offsetY || 0) });
    } else if (mode === "resize" || mode === "resizeX" || mode === "resizeXLeft" || mode === "resizeY" || mode === "resizeYBottom") {
      setDragHud({
        index,
        mode: mode === "resizeXLeft" ? "resizeX" : mode === "resizeYBottom" ? "resizeY" : mode,
        x: Number(item?.widthPercent || 100),
        y: Number(item?.height || 320),
      });
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMediaPointerDown = (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    startMediaDrag(index, "pan", event);
  };

  const applyPicturePlacement = (index: number, mode: PlacementMenuMode) => {
    setPlacementMenuMode((prev) => {
      const next = {
        ...prev,
        [index]: mode,
      };
      placementMenuModeRef.current = next;
      return next;
    });

    setMediaList((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;

      if (mode === "topLeft") {
        next[index] = {
          ...current,
          textWrap: "square",
          wrapSide: "bothSides",
          align: "left",
          offsetX: 0,
          offsetY: 0,
        };
        return next;
      }

      if (mode === "bottom") {
        next[index] = {
          ...current,
          textWrap: "square",
          wrapSide: "bothSides",
          align: "left",
          offsetX: 0,
          offsetY: 240,
        };
        return next;
      }

      next[index] = {
        ...current,
        textWrap: "square",
        wrapSide: "bothSides",
        align: "left",
        offsetX: 0,
        offsetY: 0,
      };
      return next;
    });
  };

  const selectAdjacentMedia = (currentIndex: number, direction: "prev" | "next") => {
    const total = mediaListRef.current.length;
    if (total <= 1) return;
    const delta = direction === "next" ? 1 : -1;
    const targetIndex = (currentIndex + delta + total) % total;
    setSelectedMediaIndex(targetIndex);
  };

  const resetMediaToOriginal = (index: number) => {
    setMediaList((prev) => {
      const original = initialMediaList[index];
      if (!original) return prev;
      const next = [...prev];
      next[index] = sanitizeMediaForResetBounds({ ...original });
      return next;
    });
    setPlacementMenuMode((prev) => ({
      ...prev,
      [index]: "bottom",
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaveError(null);
    
    // Use ref first, fall back to payload, then re-read from sessionStorage
    let articleId = articleIdRef.current || payload?.id;
    if (!articleId) {
      const freshPayload = readPreviewPayload();
      articleId = freshPayload?.id;
      if (articleId) articleIdRef.current = articleId;
    }

    if (!articleId && payload?.title) {
      try {
        const newsRef = collection(firebaseDB, "news");
        const titleQuery = query(newsRef, where("title", "==", payload.title), limit(10));
        const snapshot = await getDocs(titleQuery);
        if (!snapshot.empty) {
          const matches = snapshot.docs
            .map((entry) => ({ id: entry.id, data: entry.data() as { summary?: string; createdAt?: unknown } }))
            .filter((entry) => {
              if (!payload.summary) return true;
              return (entry.data.summary || "") === payload.summary;
            });

          if (matches.length > 0) {
            articleId = matches[0].id;
            articleIdRef.current = articleId;
          } else if (snapshot.docs[0]) {
            articleId = snapshot.docs[0].id;
            articleIdRef.current = articleId;
          }
        }
      } catch (resolveError) {
        console.error("Failed to resolve article id from preview payload:", resolveError);
      }
    }
    
    if (!articleId) {
      setSaveError(language === "fr" 
        ? "Retournez à l'éditeur, modifiez l'article puis cliquez Aperçu." 
        : "Go back to editor, edit the article, then click Preview.");
      return;
    }
    
    setSaving(true);
    setSaveSuccess(false);
    try {
      const additionalMediaData = mediaList.map((item) => ({
        type: item.type,
        url: item.url,
        size: item.size,
        align: item.align,
        textWrap: item.textWrap,
        wrapSide: item.wrapSide,
        height: item.height,
        order: item.order,
        widthPercent: item.widthPercent,
        offsetX: item.offsetX,
        offsetY: item.offsetY,
        distanceTop: item.distanceTop,
        distanceRight: item.distanceRight,
        distanceBottom: item.distanceBottom,
        distanceLeft: item.distanceLeft,
      }));
      await updateDoc(doc(firebaseDB, "news", articleId), {
        additionalMedia: additionalMediaData,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Failed to save media changes:", error);
      setSaveError(language === "fr" ? "Erreur lors de l'enregistrement" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!payload) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <div className="mx-auto max-w-4xl rounded-xl border border-white/10 bg-[#0c1629] p-6">
          <p className="text-sm text-slate-300">
            {language === "fr"
              ? "Aucun aperçu disponible. Retournez à l'éditeur et cliquez sur Aperçu."
              : "No preview draft found. Return to editor and click Preview."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin/stories")}
            className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            {language === "fr" ? "Retour" : "Back"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl">
        {(() => {
          const actionButtons = (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  saveSuccess
                    ? "bg-green-600 text-white"
                    : saveError
                      ? "bg-red-600 text-white"
                      : saving
                        ? "bg-orange-600/50 text-white/70 cursor-wait"
                        : "bg-orange-600 text-white hover:bg-orange-500"
                }`}
              >
                {saveSuccess ? (
                  <>
                    <span>✓</span>
                    {language === "fr" ? "Enregistré" : "Saved"}
                  </>
                ) : saveError ? (
                  <>
                    <span>!</span>
                    {language === "fr" ? "Erreur" : "Error"}
                  </>
                ) : saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {language === "fr" ? "Enregistrement..." : "Saving..."}
                  </>
                ) : (
                  language === "fr" ? "Enregistrer" : "Save"
                )}
              </button>
              <button
                type="button"
                onClick={() => setMobilePreview((prev) => !prev)}
                className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  mobilePreview
                    ? "border-sky-400/60 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                }`}
              >
                {language === "fr" ? "Mobile" : "Mobile"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/stories")}
                aria-label={language === "fr" ? "Fermer l'aperçu" : "Close preview"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:border-white/30 hover:text-white"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </>
          );

          const article = (
            <article
              className={`news-expand-panel-inner relative rounded-xl border border-sky-500/30 bg-[#0c1629] ${
                mobilePreview ? "p-4 shadow-none" : "p-6 sm:p-8 shadow-2xl shadow-sky-900/20"
              }`}
            >
              {!mobilePreview && (
                <div className="absolute right-4 top-4 flex items-center gap-2">{actionButtons}</div>
              )}

              {!mobilePreview && saveError && (
                <div className="absolute right-4 top-16 max-w-xs rounded-lg border border-red-500/50 bg-red-900/80 px-3 py-2 text-xs text-red-200 shadow-lg">
                  {saveError}
                </div>
              )}

              <h2 className="news-expand-panel-title text-2xl font-bold text-white sm:text-3xl leading-tight">
                {payload.title || (language === "fr" ? "Titre de l'article" : "Story Title")}
              </h2>
              <p className="news-expand-panel-date mt-2 text-xs text-slate-500 tracking-wide">
                {formatTimeAgo(resolvedCreatedAt, language)}
              </p>

              <div ref={articleBodyRef} className="relative z-10 mt-6 article-content-body space-y-4 text-base leading-relaxed text-slate-200">
            {mediaList.map((mediaItem, index) => {
              const wrapMode = normalizeWrapMode(mediaItem.textWrap);
              const wrapSide = normalizeWrapSide(mediaItem.wrapSide);
              const textWrapFloatClass = getTextWrapFloatClass(wrapMode, wrapSide);
              const usesTextWrap = wrapMode === "square" || wrapMode === "tight" || wrapMode === "through";
              const shouldClearPreviousFloats = usesTextWrap && index > 0;
              const alignClass = usesTextWrap ? "" : getAdditionalMediaAlignClass(mediaItem.align);
              const distanceTop = normalizeTextDistance(mediaItem.distanceTop);
              const distanceRight = normalizeTextDistance(mediaItem.distanceRight);
              const distanceBottom = normalizeTextDistance(mediaItem.distanceBottom);
              const distanceLeft = normalizeTextDistance(mediaItem.distanceLeft);
              const offsetX = Math.round(Number(mediaItem.offsetX || 0));
              const offsetY = Math.round(Number(mediaItem.offsetY || 0));
              const widthPercent = Math.round(Number(mediaItem.widthPercent || 100));

              const isWrapLikeMode = usesTextWrap || wrapMode === "topBottom";
              const objectPosition = "50% 50%";

              return (
                <div
                  key={`preview-media-${index}`}
                  className={`${getAdditionalMediaWidthClass(mediaItem.size)} ${alignClass} ${wrapMode === "front" || wrapMode === "behind" ? "absolute left-0 top-0" : "relative"} overflow-visible rounded-xl border ${selectedMediaIndex === index ? "border-blue-400 ring-2 ring-blue-400/70" : "border-white/10"} ${wrapMode === "front" ? "z-30" : ""} ${wrapMode === "behind" && selectedMediaIndex !== index ? "z-0 opacity-70" : ""} ${wrapMode === "behind" && selectedMediaIndex === index ? "z-0" : ""} ${textWrapFloatClass} ${wrapMode === "inline" ? "inline-block" : ""} ${wrapMode === "topBottom" || shouldClearPreviousFloats ? "clear-both" : ""} ${dragHud?.index === index ? "z-40 opacity-80" : ""}`}
                  style={{
                    height: `${Math.round(mediaItem.height)}px`,
                    width: `${widthPercent}%`,
                    left: wrapMode === "behind" || wrapMode === "front" ? `${offsetX}px` : undefined,
                    top: wrapMode === "behind" || wrapMode === "front" ? `${offsetY}px` : undefined,
                    shapeOutside: wrapMode === "tight" || wrapMode === "through" ? "inset(0 round 16px)" : undefined,
                    marginTop:
                      wrapMode === "inline" || wrapMode === "behind" || wrapMode === "front"
                        ? undefined
                        : `${distanceTop + (isWrapLikeMode ? offsetY : 0)}px`,
                    marginRight:
                      wrapMode === "inline" || wrapMode === "behind" || wrapMode === "front"
                        ? undefined
                        : `${distanceRight}px`,
                    marginBottom:
                      wrapMode === "inline" || wrapMode === "behind" || wrapMode === "front"
                        ? undefined
                        : `${distanceBottom}px`,
                    marginLeft:
                      wrapMode === "inline" || wrapMode === "behind" || wrapMode === "front"
                        ? undefined
                        : `${distanceLeft}px`,
                  }}
                  onClick={() => setSelectedMediaIndex(index)}
                  onPointerDown={(event) => handleMediaPointerDown(index, event)}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
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
                        alt={`Preview media ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 900px"
                        style={{
                          objectPosition,
                        }}
                        unoptimized
                      />
                    )}
                  </div>

                  {selectedMediaIndex === index && (
                    <div className="pointer-events-none absolute inset-0 z-20">
                      <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-[2px] bg-blue-500" />
                      <button
                        type="button"
                        onPointerDown={(event) => startMediaDrag(index, "resizeY", event)}
                        aria-label={language === "fr" ? "Ajuster la hauteur" : "Adjust height"}
                        className="pointer-events-auto absolute left-1/2 -top-1 z-30 h-2.5 w-2.5 -translate-x-1/2 cursor-ns-resize rounded-[2px] border border-white/60 bg-blue-500"
                      />
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-[2px] bg-blue-500" />
                      <button
                        type="button"
                        onPointerDown={(event) => startMediaDrag(index, "resizeXLeft", event)}
                        aria-label={language === "fr" ? "Ajuster la largeur" : "Adjust width"}
                        className="pointer-events-auto absolute -left-1 top-1/2 z-30 h-2.5 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-[2px] border border-white/60 bg-blue-500"
                      />
                      <button
                        type="button"
                        onPointerDown={(event) => startMediaDrag(index, "resizeX", event)}
                        aria-label={language === "fr" ? "Ajuster la largeur" : "Adjust width"}
                        className="pointer-events-auto absolute -right-1 top-1/2 z-30 h-2.5 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-[2px] border border-white/60 bg-blue-500"
                      />
                      <span className="absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-[2px] bg-blue-500" />
                      <button
                        type="button"
                        onPointerDown={(event) => startMediaDrag(index, "resizeYBottom", event)}
                        aria-label={language === "fr" ? "Ajuster la hauteur" : "Adjust height"}
                        className="pointer-events-auto absolute -bottom-1 left-1/2 z-30 h-2.5 w-2.5 -translate-x-1/2 cursor-ns-resize rounded-[2px] border border-white/60 bg-blue-500"
                      />
                      <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-[2px] bg-blue-500" />
                    </div>
                  )}
                  <button
                    type="button"
                    onPointerDown={(event) => startMediaDrag(index, "resize", event)}
                    aria-label={language === "fr" ? "Redimensionner le média" : "Resize media"}
                    className="absolute -bottom-1 -right-1 z-30 h-4 w-4 rounded-[2px] border border-white/60 bg-blue-500"
                  />
                  {dragHud?.index === index && (
                    <div className="pointer-events-none absolute bottom-3 left-3 z-40 rounded-xl border border-slate-200/30 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg">
                      {dragHud.mode === "resize"
                        ? `W: ${dragHud.x.toFixed(0)}%   H: ${dragHud.y.toFixed(0)}px`
                        : dragHud.mode === "resizeX"
                          ? `W: ${dragHud.x.toFixed(0)}%`
                          : dragHud.mode === "resizeY"
                            ? `H: ${dragHud.y.toFixed(0)}px`
                          : `X: ${dragHud.x.toFixed(1)}   Y: ${dragHud.y.toFixed(1)}`}
                    </div>
                  )}
                  {selectedMediaIndex === index && (
                    (() => {
                      const mode = placementMenuMode[index] || "bottom";
                      const anchorClass = mode === "topLeft" ? "left-2 top-2" : "bottom-2 right-2";
                      return (
                        <div
                          className={`absolute z-30 flex flex-col gap-1 rounded-xl border border-slate-200/20 bg-white/95 p-2 shadow-xl ${anchorClass}`}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              applyPicturePlacement(index, "topLeft");
                            }}
                            className={`flex h-7 items-center rounded-md px-2 text-xs font-semibold ${mode === "topLeft" ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                          >
                            {language === "fr" ? "Haut gauche" : "Top left"}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              applyPicturePlacement(index, "bottom");
                            }}
                            className={`flex h-7 items-center rounded-md px-2 text-xs font-semibold ${mode === "bottom" ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                          >
                            {language === "fr" ? "Bas" : "Bottom"}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              applyPicturePlacement(index, "free");
                            }}
                            className={`flex h-7 items-center rounded-md px-2 text-xs font-semibold ${mode === "free" ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                          >
                            {language === "fr" ? "Libre" : "Free"}
                          </button>
                          <button
                            type="button"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              if (placementMenuModeRef.current[index] !== "free") {
                                applyPicturePlacement(index, "free");
                              }
                              startMediaDrag(index, "pan", event);
                            }}
                            className="flex h-7 items-center rounded-md px-2 text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100"
                          >
                            {language === "fr" ? "Glisser image" : "Drag picture"}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              resetMediaToOriginal(index);
                            }}
                            className="flex h-7 items-center rounded-md px-2 text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100"
                          >
                            {language === "fr" ? "Réinitialiser" : "Reset"}
                          </button>
                          {mediaList.length > 1 && (
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectAdjacentMedia(index, "prev");
                                }}
                                className="flex h-7 items-center justify-center rounded-md bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                {language === "fr" ? "Préc." : "Prev"}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectAdjacentMedia(index, "next");
                                }}
                                className="flex h-7 items-center justify-center rounded-md bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                {language === "fr" ? "Suiv." : "Next"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
            <ArticleContent
              htmlContent={editableSummary || `<p>${language === "fr" ? "Aucun contenu pour le moment..." : "No content yet..."}</p>`}
              className="text-base leading-relaxed text-slate-200"
            />
            <div className="clear-both" />
              </div>

              {!!mediaList.length && !mobilePreview && (
                <p className="mt-3 text-xs text-slate-500">
                  {language === "fr"
                    ? "Glissez le média librement dans la page. Les poignées latérales et haut/bas redimensionnent par côté, le coin ↘ redimensionne largeur + hauteur. Les boutons Haut gauche / Bas / Libre sont des positions préréglées, et Glisser image permet un placement libre."
                    : "Drag media freely across the page. Side and top/bottom handles resize per edge, and the ↘ corner resizes width + height. Top left / Bottom / Free are presets, and Drag picture enables free placement."}
                </p>
              )}

              <MentionedEntities htmlContent={editableSummary || ""} language={language} />
            </article>
          );

          if (!mobilePreview) {
            return article;
          }

          return (
            <div className="mx-auto w-full max-w-sm">
              <div className="mb-3 flex items-center justify-end gap-2">{actionButtons}</div>
              {saveError && (
                <div className="mb-3 rounded-lg border border-red-500/50 bg-red-900/40 px-3 py-2 text-xs text-red-200">
                  {saveError}
                </div>
              )}
              <div className="relative mx-auto aspect-[9/19.5] w-full rounded-[2.75rem] border border-white/15 bg-white/5 p-2">
                <div className="absolute left-1/2 top-2 h-6 w-28 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/80" />
                <div className="h-full overflow-hidden rounded-[2.3rem] border border-white/10 bg-slate-950">
                  <div className="h-full overflow-y-auto p-3">{article}</div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
