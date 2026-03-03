"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAdmin } from "../layout";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import CategorySelector from "@/components/CategorySelector";
import { getCategoryById } from "@/data/newsCategories";
import { logAuditAction } from "@/lib/auditLog";

// Dynamically import RichTextEditor to avoid SSR issues
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Article = {
  id: string;
  title: string;
  headline: string;
  summary: string;
  category?: string;
  author?: string;
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
  imagePosition?: number;
  videoTrimStart?: number;
  videoTrimEnd?: number;
  videoScale?: number;
  videoOffsetX?: number;
  videoOffsetY?: number;
  createdAt?: { seconds: number };
  isPaused?: boolean;
};

type AdditionalMediaSize = "full" | "half" | "third";
type CanonicalAdditionalMediaWrap = "inline" | "square" | "tight" | "through" | "topBottom" | "behind" | "front";
type AdditionalMediaWrap = CanonicalAdditionalMediaWrap | "wrap" | "break";
type AdditionalMediaWrapSide = "bothSides" | "leftOnly" | "rightOnly" | "largestOnly";
type AdditionalMediaAlign = "left" | "center" | "right";

type AdditionalMediaItem = {
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

type MainPreviewPayload = {
  title?: string;
  summary?: string;
  author?: string;
  additionalMedia?: Partial<AdditionalMediaItem>[];
};

const MAX_ADDITIONAL_STORY_MEDIA = 3;
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
const MIN_FIXED_MEDIA_TRANSLATE_X = -5000;
const MAX_FIXED_MEDIA_TRANSLATE_X = 5000;
const MIN_FIXED_MEDIA_TRANSLATE_Y = -5000;
const MAX_FIXED_MEDIA_TRANSLATE_Y = 5000;
const MIN_MEDIA_TEXT_DISTANCE = 0;
const MAX_MEDIA_TEXT_DISTANCE = 48;
const DEFAULT_MEDIA_TEXT_DISTANCE = 12;
const NEWS_MAIN_PREVIEW_STORAGE_KEY = "news-main-preview-draft";

const isTrustedNewsMediaUrl = (url?: string | null) => {
  if (!url) return false;
  const normalized = url.trim();
  if (!normalized) return false;
  return normalized.includes("firebasestorage.googleapis.com") || normalized.includes("storage.googleapis.com");
};

const getMediaKindFromUrl = (url?: string | null): "image" | "video" => {
  if (!url) return "image";
  const normalized = url.toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/.test(normalized) ? "video" : "image";
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
  item: Partial<AdditionalMediaItem> | null | undefined,
  fallbackIndex: number,
  allowUntrustedUrl = false
): AdditionalMediaItem | null => {
  if (!item) return null;
  const type = item.type === "video" ? "video" : item.type === "image" ? "image" : null;
  const url = typeof item.url === "string" ? item.url.trim() : "";
  if (!type || !url || (!allowUntrustedUrl && !isTrustedNewsMediaUrl(url))) return null;

  const size: AdditionalMediaSize = item.size === "half" || item.size === "third" ? item.size : "full";
  const align: AdditionalMediaAlign = item.align === "left" || item.align === "right" ? item.align : "center";
  const textWrap = normalizeWrapMode(item.textWrap);
  const wrapSide = normalizeWrapSide(item.wrapSide);
  const height = Math.max(
    MIN_ADDITIONAL_MEDIA_HEIGHT,
    Math.min(MAX_ADDITIONAL_MEDIA_HEIGHT, Number(item.height || DEFAULT_ADDITIONAL_MEDIA_HEIGHT))
  );
  const order = Math.max(1, Math.min(MAX_ADDITIONAL_STORY_MEDIA, Math.round(Number(item.order || fallbackIndex + 1))));
  const widthPercent = Math.max(
    MIN_ADDITIONAL_MEDIA_WIDTH,
    Math.min(MAX_ADDITIONAL_MEDIA_WIDTH, Number(item.widthPercent || DEFAULT_ADDITIONAL_MEDIA_WIDTH))
  );
  const isFixedPosition = textWrap === "behind" || textWrap === "front";
  const offsetX = Math.max(
    isFixedPosition ? MIN_FIXED_MEDIA_TRANSLATE_X : MIN_ADDITIONAL_MEDIA_OFFSET_X,
    Math.min(isFixedPosition ? MAX_FIXED_MEDIA_TRANSLATE_X : MAX_ADDITIONAL_MEDIA_OFFSET_X, Number(item.offsetX || 0))
  );
  const offsetY = Math.max(
    isFixedPosition ? MIN_FIXED_MEDIA_TRANSLATE_Y : MIN_ADDITIONAL_MEDIA_OFFSET_Y,
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

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "News & Stories",
    subtitle: "Create and manage articles",
    createStory: "Create Story",
    editStory: "Edit Story",
    publishedStories: "Published Stories", 
    noStories: "No stories published yet",
    articleTitle: "Title",
    headline: "Headline",
    summary: "Content",
    category: "Category",
    author: "Author",
    coverPhoto: "Cover Photo",
    additionalPhotos: "Additional Media",
    coverVideo: "Cover Video",
    mediaHelp: "Upload a cover picture or a video (required)",
    additionalPhotosHelp: "Add up to 3 extra media items (image or video) for the full article view",
    additionalPhotoLabel: "Additional media",
    existingAdditionalPhoto: "Existing additional media",
    removeAdditional: "Remove",
    mediaSize: "Media size",
    mediaAlign: "Position",
      mediaWrap: "Text behavior",
      wrapInline: "In line",
      wrapWrap: "Wrap text",
      wrapBreak: "Break text",
      wrapBehind: "Behind text",
      wrapFront: "In front of text",
    mediaWidth: "Width",
    mediaOffsetX: "Move left / right",
    mediaHeight: "Height",
    mediaOffsetY: "Move up / down",
    mediaOrder: "Order in article",
    sizeFull: "Full width",
    sizeHalf: "Large",
    sizeThird: "Medium",
    alignLeft: "Left",
    alignCenter: "Center",
    alignRight: "Right",
    mainPagePreview: "Main page preview",
    selectedVideo: "Selected video",
    existingVideo: "Video already saved for this story",
    chooseCoverFrame: "Choose video frame as cover",
    moveToFrame: "Move to the frame you want and set it as cover image",
    frameTime: "Frame time",
    useFrameAsCover: "Use this frame as cover",
    frameSaved: "Cover image saved from selected video frame",
    requiredCoverMedia: "Please upload a cover picture or cover video before publishing.",
    processingVideo: "Processing video edits...",
    videoEditTitle: "Mini video editor",
    videoEditHelp: "Trim the clip and adjust position.",
    trimStart: "Trim start",
    trimEnd: "Trim end",
    moveLeftRight: "Move left / right",
    moveUpDown: "Move up / down",
    publish: "Publish",
    update: "Update",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    clear: "Clear",
    noImage: "No image",
    adjustPosition: "Adjust Position",
    preview: "Preview",
    imagePositionTitle: "Adjust Image Position",
    imagePositionDesc: "Adjust the slider to position the image correctly in the story card.",
    previewStoryCard: "Preview (story card)",
    verticalPosition: "Vertical Position",
    top: "Top",
    bottom: "Bottom",
    centered: "Centered",
    positionHelp: "0% = shows top of image, 50% = centered, 100% = shows bottom",
    done: "Done",
    mentionHint: "Use @ to mention players",
    newStory: "New Story",
    saving: "Saving...",
  },
  fr: {
    title: "Actualités & Histoires",
    subtitle: "Créer et gérer les articles",
    createStory: "Créer un Article", 
    editStory: "Modifier l'Article",
    publishedStories: "Articles Publiés",
    noStories: "Aucun article publié",
    articleTitle: "Titre",
    headline: "Accroche",
    summary: "Contenu",
    category: "Catégorie",
    author: "Auteur",
    coverPhoto: "Photo de Couverture",
    additionalPhotos: "Médias Supplémentaires",
    coverVideo: "Vidéo de Couverture",
    mediaHelp: "Ajoutez une image de couverture ou une vidéo (obligatoire)",
    additionalPhotosHelp: "Ajoutez jusqu'à 3 médias supplémentaires (image ou vidéo) pour la vue article complète",
    additionalPhotoLabel: "Média supplémentaire",
    existingAdditionalPhoto: "Média supplémentaire existant",
    removeAdditional: "Supprimer",
    mediaSize: "Taille du média",
      mediaWrap: "Habillage du texte",
      wrapInline: "En ligne",
      wrapWrap: "Renvoyer le texte",
      wrapBreak: "Saut de texte",
      wrapBehind: "Derrière le texte",
      wrapFront: "Devant le texte",
    mediaAlign: "Position",
    mediaWidth: "Largeur",
    mediaOffsetX: "Déplacer gauche / droite",
    mediaHeight: "Hauteur",
    mediaOffsetY: "Déplacer haut / bas",
    mediaOrder: "Ordre dans l'article",
    sizeFull: "Pleine largeur",
    sizeHalf: "Grand",
    sizeThird: "Moyen",
    alignLeft: "Gauche",
    alignCenter: "Centre",
    alignRight: "Droite",
    mainPagePreview: "Aperçu page d'accueil",
    selectedVideo: "Vidéo sélectionnée",
    existingVideo: "Vidéo déjà enregistrée pour cet article",
    chooseCoverFrame: "Choisir une image de couverture depuis la vidéo",
    moveToFrame: "Déplacez-vous à l'instant voulu puis définissez cette image comme couverture",
    frameTime: "Instant de l'image",
    useFrameAsCover: "Utiliser cette image comme couverture",
    frameSaved: "Image de couverture enregistrée depuis la vidéo",
    requiredCoverMedia: "Veuillez ajouter une image de couverture ou une vidéo de couverture avant de publier.",
    processingVideo: "Traitement des modifications vidéo...",
    videoEditTitle: "Mini éditeur vidéo",
    videoEditHelp: "Coupez la durée et ajustez la position.",
    trimStart: "Début",
    trimEnd: "Fin",
    moveLeftRight: "Déplacer gauche / droite",
    moveUpDown: "Déplacer haut / bas",
    publish: "Publier",
    update: "Mettre à jour",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    clear: "Effacer",
    noImage: "Pas d'image",
    adjustPosition: "Ajuster position",
    preview: "Aperçu",
    imagePositionTitle: "Ajuster la position de l'image",
    imagePositionDesc: "Ajustez le curseur pour positionner l'image correctement dans la carte de l'histoire.",
    previewStoryCard: "Aperçu (carte d'histoire)",
    verticalPosition: "Position verticale",
    top: "Haut",
    bottom: "Bas",
    centered: "Centré",
    positionHelp: "0% = montre le haut de l'image, 50% = centré, 100% = montre le bas",
    done: "Terminé",
    mentionHint: "Utilisez @ pour mentionner des joueurs",
    newStory: "Nouvel Article",
    saving: "Enregistrement...",
  },
};

export default function StoriesPage() {
  const router = useRouter();
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];
  const showLegacyAdditionalMedia = false;

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState({
    title: "",
    headline: "",
    summary: "",
    category: "",
    author: "",
    imageUrl: "",
    additionalMedia: Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => null as AdditionalMediaItem | null),
    additionalImageUrls: [] as string[],
    videoUrl: "",
    imagePosition: 50,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoScale: 1,
    videoOffsetX: 0,
    videoOffsetY: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [additionalMediaFiles, setAdditionalMediaFiles] = useState<(File | null)[]>(
    Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => null)
  );
  const [additionalMediaKinds, setAdditionalMediaKinds] = useState<("image" | "video" | null)[]>(
    Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => null)
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [additionalMediaPreviews, setAdditionalMediaPreviews] = useState<string[]>(
    Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => "")
  );
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoFrameTime, setVideoFrameTime] = useState(0);
  const [frameStatus, setFrameStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [showImagePositionModal, setShowImagePositionModal] = useState(false);
  const [imagePositionY, setImagePositionY] = useState(50);
  const videoFrameRef = useRef<HTMLVideoElement | null>(null);

  const getEffectiveTrimBounds = useCallback(() => {
    const start = Math.max(0, Number(form.videoTrimStart || 0));
    const fallbackEnd = videoDuration > 0 ? videoDuration : Number.MAX_SAFE_INTEGER;
    const requestedEnd = Number(form.videoTrimEnd || 0);
    const end = requestedEnd > start ? requestedEnd : fallbackEnd;
    return { start, end };
  }, [form.videoTrimStart, form.videoTrimEnd, videoDuration]);

  const seekPreviewTo = useCallback((seconds: number) => {
    if (!videoFrameRef.current) return;
    try {
      videoFrameRef.current.currentTime = Math.max(0, seconds);
      setVideoFrameTime(Math.max(0, seconds));
    } catch {
      // ignore seek errors for unsupported files
    }
  }, []);

  useEffect(() => {
    if (!videoFrameRef.current || videoDuration <= 0) return;
    const { start, end } = getEffectiveTrimBounds();
    const current = videoFrameRef.current.currentTime;
    if (current < start || current > end) {
      seekPreviewTo(start);
    }
  }, [form.videoTrimStart, form.videoTrimEnd, videoDuration, getEffectiveTrimBounds, seekPreviewTo]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(firebaseDB, "news"), orderBy("createdAt", "desc")));
      setArticles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Article)));
    } catch (error) { console.error("Error fetching articles:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawPreview = window.sessionStorage.getItem(NEWS_MAIN_PREVIEW_STORAGE_KEY);
    if (!rawPreview) return;

    try {
      const previewPayload = JSON.parse(rawPreview) as MainPreviewPayload;
      const restoredAdditionalMedia = Array.isArray(previewPayload.additionalMedia)
        ? previewPayload.additionalMedia
            .map((item, index) => normalizeAdditionalMediaItem(item, index, true))
            .filter((item): item is AdditionalMediaItem => !!item)
            .slice(0, MAX_ADDITIONAL_STORY_MEDIA)
        : [];

      if (!restoredAdditionalMedia.length) return;

      const paddedAdditionalMedia: (AdditionalMediaItem | null)[] = [
        ...restoredAdditionalMedia,
        ...Array.from({ length: Math.max(0, MAX_ADDITIONAL_STORY_MEDIA - restoredAdditionalMedia.length) }, () => null),
      ];

      const restoredPreviews = [
        ...restoredAdditionalMedia.map((item) => item.url),
        ...Array.from({ length: Math.max(0, MAX_ADDITIONAL_STORY_MEDIA - restoredAdditionalMedia.length) }, () => ""),
      ];

      const restoredKinds = [
        ...restoredAdditionalMedia.map((item) => item.type),
        ...Array.from({ length: Math.max(0, MAX_ADDITIONAL_STORY_MEDIA - restoredAdditionalMedia.length) }, () => null),
      ];

      setForm((prev) => ({
        ...prev,
        title: typeof previewPayload.title === "string" ? previewPayload.title : prev.title,
        summary: typeof previewPayload.summary === "string" ? previewPayload.summary : prev.summary,
        author: typeof previewPayload.author === "string" ? previewPayload.author : prev.author,
        additionalMedia: paddedAdditionalMedia,
        additionalImageUrls: restoredAdditionalMedia.filter((item) => item.type === "image").map((item) => item.url),
      }));
      setAdditionalMediaPreviews(restoredPreviews);
      setAdditionalMediaKinds(restoredKinds);
    } catch {
      // Ignore invalid preview payload
    }
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({
      title: "",
      headline: "",
      summary: "",
      category: "",
      author: "",
      imageUrl: "",
      additionalMedia: Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => null as AdditionalMediaItem | null),
      additionalImageUrls: [],
      videoUrl: "",
      imagePosition: 50,
      videoTrimStart: 0,
      videoTrimEnd: 0,
      videoScale: 1,
      videoOffsetX: 0,
      videoOffsetY: 0,
    });
    setImagePreview("");
    setImageFile(null);
    setAdditionalMediaFiles(Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => null));
    setAdditionalMediaPreviews(Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => ""));
    setAdditionalMediaKinds(Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => null));
    setVideoFile(null);
    setVideoPreviewUrl("");
    setVideoDuration(0);
    setVideoFrameTime(0);
    setFrameStatus("");
    setImagePositionY(50);
  };

  const handleEdit = (article: Article) => {
    setEditing(article);
    const imgPos = article.imagePosition ?? 50;
    const trustedCoverImage = isTrustedNewsMediaUrl(article.imageUrl) ? article.imageUrl ?? "" : "";
    const trustedCoverVideo = isTrustedNewsMediaUrl(article.videoUrl) ? article.videoUrl ?? "" : "";
    const normalizedAdditionalMedia = Array.isArray(article.additionalMedia)
      ? article.additionalMedia
          .map((item, index) => normalizeAdditionalMediaItem(item, index))
          .filter((item): item is AdditionalMediaItem => !!item)
          .slice(0, MAX_ADDITIONAL_STORY_MEDIA)
      : (article.additionalImageUrls ?? [])
          .filter((url): url is string => isTrustedNewsMediaUrl(url))
          .slice(0, MAX_ADDITIONAL_STORY_MEDIA)
          .map((url, index) =>
            normalizeAdditionalMediaItem({ type: "image", url, order: index + 1 }, index)
          )
          .filter((item): item is AdditionalMediaItem => !!item);
    const normalizedAdditionalImages = normalizedAdditionalMedia
      .filter((item) => item.type === "image")
      .map((item) => item.url);
    const paddedAdditionalMedia: (AdditionalMediaItem | null)[] = [
      ...normalizedAdditionalMedia,
      ...Array.from({ length: Math.max(0, MAX_ADDITIONAL_STORY_MEDIA - normalizedAdditionalMedia.length) }, () => null),
    ];
    const paddedAdditionalPreview = [
      ...normalizedAdditionalMedia.map((item) => item.url),
      ...Array.from({ length: Math.max(0, MAX_ADDITIONAL_STORY_MEDIA - normalizedAdditionalMedia.length) }, () => ""),
    ];
    const paddedAdditionalKinds = [
      ...normalizedAdditionalMedia.map((item) => item.type),
      ...Array.from({ length: Math.max(0, MAX_ADDITIONAL_STORY_MEDIA - normalizedAdditionalMedia.length) }, () => null),
    ];
    setForm({ 
      title: article.title, 
      headline: article.headline, 
      summary: article.summary, 
      category: article.category || "", 
      author: article.author || "", 
      imageUrl: trustedCoverImage,
      additionalMedia: paddedAdditionalMedia,
      additionalImageUrls: normalizedAdditionalImages,
      videoUrl: trustedCoverVideo,
      imagePosition: imgPos,
      videoTrimStart: article.videoTrimStart ?? 0,
      videoTrimEnd: article.videoTrimEnd ?? 0,
      videoScale: article.videoScale ?? 1,
      videoOffsetX: article.videoOffsetX ?? 0,
      videoOffsetY: article.videoOffsetY ?? 0,
    });
    setImagePreview(trustedCoverImage);
    setImageFile(null); 
    setAdditionalMediaFiles(Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, () => null));
    setAdditionalMediaPreviews(paddedAdditionalPreview);
    setAdditionalMediaKinds(paddedAdditionalKinds);
    setVideoFile(null);
    setVideoPreviewUrl(trustedCoverVideo);
    setVideoDuration(0);
    setVideoFrameTime(0);
    setFrameStatus("");
    setImagePositionY(imgPos);
  };

  const updateFormField = (field: keyof typeof form, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setImageFile(f);
      setImagePreview(URL.createObjectURL(f));
      setVideoFile(null);
      if (videoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      setVideoPreviewUrl("");
      setForm((prev) => ({ ...prev, imageUrl: "", videoUrl: "" }));
      setVideoDuration(0);
      setVideoFrameTime(0);
      setFrameStatus("");
    }
  };

  const handleAdditionalMediaChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    const mediaKind: "image" | "video" | null = file
      ? (file.type.startsWith("video/") ? "video" : "image")
      : (form.additionalMedia[index]?.type ?? null);

    if (file) {
      setForm((prev) => {
        const nextAdditionalMedia = [...prev.additionalMedia];
        const current = nextAdditionalMedia[index];
        nextAdditionalMedia[index] = normalizeAdditionalMediaItem({
          type: mediaKind || "image",
          url: current?.url || `local-preview-${index}`,
          size: current?.size,
          align: current?.align,
          textWrap: current?.textWrap,
          wrapSide: current?.wrapSide,
          height: current?.height,
          order: current?.order ?? index + 1,
          widthPercent: current?.widthPercent,
          offsetX: current?.offsetX,
          offsetY: current?.offsetY,
          distanceTop: current?.distanceTop,
          distanceRight: current?.distanceRight,
          distanceBottom: current?.distanceBottom,
          distanceLeft: current?.distanceLeft,
        }, index, true);
        return {
          ...prev,
          additionalMedia: nextAdditionalMedia,
        };
      });
    }

    setAdditionalMediaFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });

    setAdditionalMediaKinds((prev) => {
      const next = [...prev];
      next[index] = mediaKind;
      return next;
    });

    setAdditionalMediaPreviews((prev) => {
      const next = [...prev];
      next[index] = file ? URL.createObjectURL(file) : (form.additionalMedia[index]?.url ?? "");
      return next;
    });
  };

  const removeAdditionalMedia = (index: number) => {
    setAdditionalMediaFiles((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });

    setAdditionalMediaPreviews((prev) => {
      const next = [...prev];
      next[index] = "";
      return next;
    });

    setAdditionalMediaKinds((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });

    setForm((prev) => {
      const nextAdditionalMedia = [...prev.additionalMedia];
      nextAdditionalMedia[index] = null;
      const nextAdditionalImageUrls = nextAdditionalMedia
        .filter((item): item is AdditionalMediaItem => !!item && item.type === "image")
        .map((item) => item.url);

      return {
        ...prev,
        additionalMedia: nextAdditionalMedia,
        additionalImageUrls: nextAdditionalImageUrls,
      };
    });
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setVideoFile(f);
    setFrameStatus("");
    setVideoDuration(0);
    setVideoFrameTime(0);
    if (videoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    if (f) {
      setVideoPreviewUrl(URL.createObjectURL(f));
      setImageFile(null);
      setImagePreview("");
      setForm((prev) => ({
        ...prev,
        imageUrl: "",
        videoUrl: "",
        videoTrimStart: 0,
        videoTrimEnd: 0,
        videoScale: 1,
        videoOffsetX: 0,
        videoOffsetY: 0,
      }));
    } else {
      setVideoPreviewUrl(form.videoUrl || "");
    }
  };

  const handleCaptureVideoFrame = () => {
    const videoElement = videoFrameRef.current;
    if (!videoElement) return;

    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;
    if (!width || !height) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(videoElement, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const coverFile = new File([blob], `cover-${Date.now()}.jpg`, { type: "image/jpeg" });
      setImageFile(coverFile);
      setVideoFile(null);
      if (videoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      setVideoPreviewUrl("");
      setForm((prev) => ({ ...prev, imageUrl: "", videoUrl: "" }));
      setImagePreview(URL.createObjectURL(coverFile));
      setFrameStatus(copy.frameSaved);
    }, "image/jpeg", 0.92);
  };

  const clearCoverImage = () => {
    setImageFile(null);
    setImagePreview("");
    setForm((prev) => ({ ...prev, imageUrl: "" }));
  };

  const clearCoverVideo = () => {
    setVideoFile(null);
    if (videoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoPreviewUrl("");
    setVideoDuration(0);
    setVideoFrameTime(0);
    setFrameStatus("");
    setForm((prev) => ({
      ...prev,
      videoUrl: "",
      videoTrimStart: 0,
      videoTrimEnd: 0,
      videoScale: 1,
      videoOffsetX: 0,
      videoOffsetY: 0,
    }));
  };

  const processVideoWithCanvas = async (
    sourceFile: File,
    options: {
      trimStart: number;
      trimEnd: number | null;
      scale: number;
      offsetX: number;
      offsetY: number;
    }
  ): Promise<File> => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      return sourceFile;
    }

    const sourceUrl = URL.createObjectURL(sourceFile);
    const sourceVideo = document.createElement("video");
    sourceVideo.src = sourceUrl;
    sourceVideo.muted = false;
    sourceVideo.volume = 0;
    sourceVideo.playsInline = true;
    sourceVideo.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      sourceVideo.onloadedmetadata = () => resolve();
      sourceVideo.onerror = () => reject(new Error("Unable to load source video for processing"));
    });

    const width = sourceVideo.videoWidth || 1280;
    const height = sourceVideo.videoHeight || 720;
    const duration = sourceVideo.duration || 0;

    const start = Math.max(0, Math.min(options.trimStart || 0, Math.max(0, duration - 0.1)));
    const requestedEnd = options.trimEnd ?? duration;
    const end = Math.max(start + 0.1, Math.min(requestedEnd, duration || requestedEnd));
    const targetScale = Math.max(1, options.scale || 1);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(sourceUrl);
      return sourceFile;
    }

    const stream = canvas.captureStream(30);
    const captureStreamFn = (sourceVideo as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
    if (typeof captureStreamFn === "function") {
      try {
        const sourceStream = captureStreamFn.call(sourceVideo);
        sourceStream.getAudioTracks().forEach((track) => stream.addTrack(track));
      } catch {
        // continue without source audio track when browser blocks captureStream
      }
    }
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 6_000_000,
      audioBitsPerSecond: 128_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const finishedBlobPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    await new Promise<void>((resolve) => {
      sourceVideo.onseeked = () => resolve();
      sourceVideo.currentTime = start;
    });

    recorder.start(120);
    await sourceVideo.play();

    const rampDuration = Math.min(3, Math.max(0.1, end - start));
    let rafId = 0;

    await new Promise<void>((resolve) => {
      const render = () => {
        const current = sourceVideo.currentTime;
        if (current >= end) {
          sourceVideo.pause();
          recorder.stop();
          if (rafId) cancelAnimationFrame(rafId);
          resolve();
          return;
        }

        context.clearRect(0, 0, width, height);
        const elapsed = Math.max(0, current - start);
        const progress = Math.min(1, elapsed / rampDuration);
        const animatedScale = 1 + (targetScale - 1) * progress;

        const drawWidth = width * animatedScale;
        const drawHeight = height * animatedScale;
        const offsetPxX = (options.offsetX / 100) * (width * 0.5);
        const offsetPxY = (options.offsetY / 100) * (height * 0.5);
        const drawX = (width - drawWidth) / 2 + offsetPxX;
        const drawY = (height - drawHeight) / 2 + offsetPxY;

        context.drawImage(sourceVideo, drawX, drawY, drawWidth, drawHeight);
        rafId = requestAnimationFrame(render);
      };

      rafId = requestAnimationFrame(render);
    });

    const processedBlob = await finishedBlobPromise;
    URL.revokeObjectURL(sourceUrl);

    if (!processedBlob.size) {
      return sourceFile;
    }

    const baseName = sourceFile.name.replace(/\.[^.]+$/, "");
    return new File([processedBlob], `${baseName}-edited.webm`, { type: processedBlob.type || "video/webm" });
  };

  const saveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.headline || !form.summary) return;
    setSaving(true);
    try {
      const existingCoverImageUrl = isTrustedNewsMediaUrl(form.imageUrl) ? form.imageUrl.trim() : "";
      const existingCoverVideoUrl = isTrustedNewsMediaUrl(form.videoUrl) ? form.videoUrl.trim() : "";

      let imgUrl = existingCoverImageUrl;
      if (imageFile) {
        const path = `news/${Date.now()}.png`;
        const storageReference = storageRef(firebaseStorage, path);
        await uploadBytes(storageReference, imageFile);
        imgUrl = await getDownloadURL(storageReference);
      }

      const normalizedExistingAdditionalMedia: (AdditionalMediaItem | null)[] = Array.from(
        { length: MAX_ADDITIONAL_STORY_MEDIA },
        (_, index) => {
          return normalizeAdditionalMediaItem(form.additionalMedia[index], index);
        }
      );

      const nextAdditionalMedia = [...normalizedExistingAdditionalMedia];

      await Promise.all(
        additionalMediaFiles.map(async (additionalFile, index) => {
          if (!additionalFile) return;
          const path = `news/${Date.now()}-${index + 1}-${additionalFile.name}`;
          const storageReference = storageRef(firebaseStorage, path);
          await uploadBytes(storageReference, additionalFile);
          const currentItem = nextAdditionalMedia[index] ?? normalizeAdditionalMediaItem(form.additionalMedia[index], index, true);
          nextAdditionalMedia[index] = normalizeAdditionalMediaItem({
            type: additionalFile.type.startsWith("video/") ? "video" : "image",
            url: await getDownloadURL(storageReference),
            size: currentItem?.size,
            align: currentItem?.align,
            textWrap: currentItem?.textWrap,
            wrapSide: currentItem?.wrapSide,
            height: currentItem?.height,
            order: currentItem?.order ?? index + 1,
            widthPercent: currentItem?.widthPercent,
            offsetX: currentItem?.offsetX,
            offsetY: currentItem?.offsetY,
            distanceTop: currentItem?.distanceTop,
            distanceRight: currentItem?.distanceRight,
            distanceBottom: currentItem?.distanceBottom,
            distanceLeft: currentItem?.distanceLeft,
          }, index);
        })
      );

      const savedAdditionalMedia = nextAdditionalMedia
        .filter((item): item is AdditionalMediaItem => !!item)
        .filter((item) => isTrustedNewsMediaUrl(item.url));
      const savedAdditionalImageUrls = savedAdditionalMedia
        .filter((item) => item.type === "image")
        .map((item) => item.url.trim())
        .filter((url) => url.length > 0);

      let savedVideoUrl = existingCoverVideoUrl;
      if (videoFile) {
        const shouldProcessVideo =
          Number(form.videoTrimStart || 0) > 0 ||
          Number(form.videoTrimEnd || 0) > 0 ||
          Number(form.videoScale || 1) > 1 ||
          Number(form.videoOffsetX || 0) !== 0 ||
          Number(form.videoOffsetY || 0) !== 0;

        let uploadVideoFile = videoFile;
        if (shouldProcessVideo) {
          setFrameStatus(copy.processingVideo);
          try {
            uploadVideoFile = await processVideoWithCanvas(videoFile, {
              trimStart: Number(form.videoTrimStart || 0),
              trimEnd: Number(form.videoTrimEnd || 0) > 0 ? Number(form.videoTrimEnd) : null,
              scale: Number(form.videoScale || 1),
              offsetX: Number(form.videoOffsetX || 0),
              offsetY: Number(form.videoOffsetY || 0),
            });
          } catch (processingError) {
            console.warn("Video processing fallback to original file:", processingError);
          }
        }

        const path = `news/${Date.now()}-${uploadVideoFile.name}`;
        const storageReference = storageRef(firebaseStorage, path);
        await uploadBytes(storageReference, uploadVideoFile);
        savedVideoUrl = await getDownloadURL(storageReference);
      }

      if (!imgUrl && !savedVideoUrl) {
        setFrameStatus(copy.requiredCoverMedia);
        return;
      }

      const normalizedTrimStart = Math.max(0, Number(form.videoTrimStart || 0));
      const normalizedTrimEnd = Number(form.videoTrimEnd || 0);
      const videoEditsBakedIntoFile = !!videoFile;
      const data = {
        title: form.title.trim(),
        headline: form.headline.trim(),
        summary: form.summary,
        category: form.category || null,
        author: form.author || null,
        authorPhoto: currentAdminUser?.photo || null,
        imageUrl: imgUrl || null,
        additionalMedia: savedAdditionalMedia.length ? savedAdditionalMedia : null,
        additionalImageUrls: savedAdditionalImageUrls.length ? savedAdditionalImageUrls : null,
        videoUrl: savedVideoUrl || null,
        imagePosition: form.imagePosition,
        videoTrimStart: videoEditsBakedIntoFile ? 0 : normalizedTrimStart,
        videoTrimEnd: videoEditsBakedIntoFile ? null : (normalizedTrimEnd > normalizedTrimStart ? normalizedTrimEnd : null),
        videoScale: videoEditsBakedIntoFile ? 1 : Math.max(1, Number(form.videoScale || 1)),
        videoOffsetX: videoEditsBakedIntoFile ? 0 : Number(form.videoOffsetX || 0),
        videoOffsetY: videoEditsBakedIntoFile ? 0 : Number(form.videoOffsetY || 0),
        updatedAt: serverTimestamp(),
      };
      if (editing) { 
        await updateDoc(doc(firebaseDB, "news", editing.id), data);
        await logAuditAction(
          "article_updated", 
          currentAdminUser?.id || "unknown", 
          currentAdminUser?.email || "unknown", 
          "news", 
          editing.id, 
          form.title.trim(), 
          {
            category: form.category,
            author: form.author,
            hasImage: !!imgUrl,
            additionalImagesCount: savedAdditionalMedia.length,
            hasVideo: !!savedVideoUrl,
          }
        );
      } else { 
        const newRef = await addDoc(collection(firebaseDB, "news"), { ...data, createdAt: serverTimestamp() });
        await logAuditAction(
          "article_created", 
          currentAdminUser?.id || "unknown", 
          currentAdminUser?.email || "unknown", 
          "news", 
          newRef.id, 
          form.title.trim(), 
          {
            category: form.category,
            author: form.author,
            hasImage: !!imgUrl,
            additionalImagesCount: savedAdditionalMedia.length,
            hasVideo: !!savedVideoUrl,
          }
        );
      }
      resetForm();
      fetchArticles();
    } catch (error) { 
      console.error("Error saving article:", error); 
    }
    finally { 
      setSaving(false); 
    }
  };

  const deleteArticle = async (id: string) => {
    const article = articles.find(a => a.id === id);
    if (!confirm("Delete this article?")) return;
    try { 
      await deleteDoc(doc(firebaseDB, "news", id));
      await logAuditAction(
        "article_deleted", 
        currentAdminUser?.id || "unknown", 
        currentAdminUser?.email || "unknown", 
        "news", 
        id, 
        article?.title || "Unknown", 
        {
          category: article?.category,
        }
      );
      fetchArticles(); 
    } catch (error) { console.error(error); }
  };

  const formatDate = (ts?: { seconds: number }) => ts ? new Date(ts.seconds * 1000).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  const canManageNews = currentAdminUser?.permissions?.canManageNews;
  const hasCoverImageSelected = !!imageFile || (!!imagePreview && !videoFile && !(form.videoUrl || videoPreviewUrl));
  const hasCoverVideoSelected = !!videoFile || !!form.videoUrl || !!videoPreviewUrl;
  const previewAdditionalMedia = Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, (_, index) => {
    const previewUrl = additionalMediaPreviews[index] || form.additionalMedia[index]?.url || "";
    if (!previewUrl) return null;
    const currentItem = form.additionalMedia[index];
    return normalizeAdditionalMediaItem({
      type: additionalMediaKinds[index] || currentItem?.type || getMediaKindFromUrl(previewUrl),
      url: previewUrl,
      size: currentItem?.size,
      align: currentItem?.align,
      textWrap: currentItem?.textWrap,
      wrapSide: currentItem?.wrapSide,
      height: currentItem?.height,
      order: currentItem?.order ?? index + 1,
      widthPercent: currentItem?.widthPercent,
      offsetX: currentItem?.offsetX,
      offsetY: currentItem?.offsetY,
      distanceTop: currentItem?.distanceTop,
      distanceRight: currentItem?.distanceRight,
      distanceBottom: currentItem?.distanceBottom,
      distanceLeft: currentItem?.distanceLeft,
    }, index, true);
  })
    .filter((item): item is AdditionalMediaItem => !!item)
    .sort((a, b) => a.order - b.order);

  const openMainPagePreview = () => {
    if (typeof window === "undefined") return;

    const previewPayload = {
      id: editing?.id || null,
      title: form.title,
      summary: form.summary,
      author: form.author,
      createdAtIso: new Date().toISOString(),
      language,
      additionalMedia: previewAdditionalMedia,
    };

    window.sessionStorage.setItem(NEWS_MAIN_PREVIEW_STORAGE_KEY, JSON.stringify(previewPayload));
    router.push("/admin/stories/preview");
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{copy.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p>
        </div>
      </div>

      {/* Create/Edit Story Form */}
      {canManageNews && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              📰 {editing ? copy.editStory : copy.createStory}
            </h2>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                {copy.newStory}
              </button>
            )}
          </div>

          <form onSubmit={saveArticle} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  {copy.articleTitle} *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormField("title", e.target.value)}
                  placeholder={copy.articleTitle}
                  required
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  {copy.category}
                </label>
                <CategorySelector
                  value={form.category}
                  onChange={(categoryId) => updateFormField("category", categoryId)}
                  language={language}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {copy.headline} *
              </label>
              <input
                type="text"
                value={form.headline}
                onChange={(e) => updateFormField("headline", e.target.value)}
                placeholder={copy.headline}
                required
                className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">
                {copy.summary} * <span className="text-slate-500">({copy.mentionHint})</span>
              </label>
              <RichTextEditor
                content={form.summary}
                onChange={(html) => updateFormField("summary", html)}
                language={language}
                placeholder={language === 'fr' ? "Écrivez votre article ici... Utilisez @ pour mentionner un joueur." : "Write your article here... Use @ to mention a player."}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {copy.author}
              </label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => updateFormField("author", e.target.value)}
                placeholder={copy.author}
                className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Cover Media + Additional Media */}
            <div className="space-y-3">
              <p className="text-xs text-slate-500">{copy.mediaHelp}</p>
              <label className="block text-sm font-medium text-slate-400">
                {language === "fr" ? "Média de Couverture" : "Cover Media"}
              </label>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-400">{copy.coverPhoto}</label>
                  <input
                    type="file"
                    accept="image/*"
                    title="Upload cover photo"
                    onChange={handleImageChange}
                    disabled={hasCoverVideoSelected}
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-500 file:text-white file:cursor-pointer hover:file:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {hasCoverVideoSelected && (
                    <p className="text-[10px] text-slate-500">
                      {language === "fr"
                        ? "La vidéo de couverture est déjà choisie. Supprimez-la pour ajouter une image."
                        : "Cover video is already selected. Remove it to upload an image."}
                    </p>
                  )}
                  {(imageFile || form.imageUrl || imagePreview) && (
                    <button
                      type="button"
                      onClick={clearCoverImage}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      {language === "fr" ? "Supprimer l'image" : "Remove image"}
                    </button>
                  )}
                  <div className="flex gap-2">
                    {/* Adjust Position Button */}
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => setShowImagePositionModal(true)}
                        className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-300 transition hover:bg-purple-500/20"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        {copy.adjustPosition}
                      </button>
                    )}
                    {/* Preview Button */}
                    {(form.title || form.headline || form.summary) && (
                      <button
                        type="button"
                        onClick={openMainPagePreview}
                        className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 transition hover:bg-blue-500/20"
                      >
                        👁️ {copy.preview}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">{copy.coverVideo}</label>
                  <input
                    type="file"
                    accept="video/*"
                    title="Upload cover video"
                    onChange={handleVideoChange}
                    disabled={hasCoverImageSelected}
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-500 file:text-white file:cursor-pointer hover:file:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {hasCoverImageSelected && (
                    <p className="text-[10px] text-slate-500">
                      {language === "fr"
                        ? "L'image de couverture est déjà choisie. Supprimez-la pour ajouter une vidéo."
                        : "Cover image is already selected. Remove it to upload a video."}
                    </p>
                  )}
                  {(videoFile || form.videoUrl || videoPreviewUrl) && (
                    <button
                      type="button"
                      onClick={clearCoverVideo}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      {language === "fr" ? "Supprimer la vidéo" : "Remove video"}
                    </button>
                  )}
                  {(videoFile || form.videoUrl) && (
                    <p className="text-xs text-slate-400">
                      {videoFile ? `${copy.selectedVideo}: ${videoFile.name}` : copy.existingVideo}
                    </p>
                  )}
                </div>
              </div>

              {showLegacyAdditionalMedia && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">{copy.additionalPhotos}</label>
                  <p className="text-xs text-slate-500">{copy.additionalPhotosHelp}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Array.from({ length: MAX_ADDITIONAL_STORY_MEDIA }, (_, index) => (
                      <div key={`additional-photo-${index}`} className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                        <label className="block text-xs text-slate-400">
                          {copy.additionalPhotoLabel} {index + 1}
                        </label>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          title={`Upload additional media ${index + 1}`}
                          onChange={(event) => handleAdditionalMediaChange(index, event)}
                          className="w-full text-xs text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-orange-500 file:px-2 file:py-1 file:text-xs file:text-white hover:file:bg-orange-600"
                        />
                        {(additionalMediaFiles[index] || form.additionalMedia[index]) && (
                          <button
                            type="button"
                            onClick={() => removeAdditionalMedia(index)}
                            className="rounded border border-white/20 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/5"
                          >
                            {copy.removeAdditional}
                          </button>
                        )}
                        {additionalMediaPreviews[index] && additionalMediaKinds[index] === "video" && (
                          <video
                            src={additionalMediaPreviews[index]}
                            className="h-24 w-full rounded border border-white/10 bg-black object-cover"
                            controls
                            muted
                            playsInline
                          />
                        )}
                        {additionalMediaPreviews[index] && additionalMediaKinds[index] !== "video" && (
                          <div className="relative h-24 overflow-hidden rounded border border-white/10">
                            <Image
                              src={additionalMediaPreviews[index]}
                              alt={`${copy.additionalPhotoLabel} ${index + 1}`}
                              fill
                              className="object-cover"
                              sizes="180px"
                              unoptimized
                            />
                          </div>
                        )}
                        {form.additionalMedia[index] && (
                          <p className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
                            {language === "fr"
                              ? "Utilisez la page Aperçu pour redimensionner et positionner ce média."
                              : "Use the Preview page to resize and position this media."}
                          </p>
                        )}
                        {!additionalMediaFiles[index] && form.additionalMedia[index] && (
                          <p className="text-[10px] text-slate-500">{copy.existingAdditionalPhoto}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(imagePreview && !hasCoverVideoSelected) && (
                <div className="relative h-32 overflow-hidden rounded-lg border border-white/10">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                    sizes="300px"
                    unoptimized
                    style={{ objectPosition: `center ${form.imagePosition ?? 50}%` }}
                  />
                </div>
              )}

              {(videoPreviewUrl || form.videoUrl) && !hasCoverImageSelected && (
                <div className="space-y-3 rounded-lg border border-white/10 bg-slate-800/30 p-3">
                    <p className="text-xs font-medium text-slate-300">{copy.chooseCoverFrame}</p>
                    <p className="text-xs text-slate-500">{copy.moveToFrame}</p>
                    <video
                      ref={videoFrameRef}
                      src={videoPreviewUrl || form.videoUrl}
                      className="h-40 w-full rounded-md bg-black object-contain"
                      controls
                      muted
                      playsInline
                      onTimeUpdate={(event) => {
                        const { start, end } = getEffectiveTrimBounds();
                        const current = event.currentTarget.currentTime;
                        setVideoFrameTime(current);
                        if (current < start) {
                          seekPreviewTo(start);
                          return;
                        }
                        if (current > end) {
                          event.currentTarget.pause();
                          seekPreviewTo(end);
                        }
                      }}
                      onPlay={(event) => {
                        const { start } = getEffectiveTrimBounds();
                        if (event.currentTarget.currentTime < start) {
                          seekPreviewTo(start);
                        }
                      }}
                      onLoadedMetadata={(event) => {
                        const duration = event.currentTarget.duration || 0;
                        setVideoDuration(duration);
                        setVideoFrameTime(event.currentTarget.currentTime || 0);
                        setForm((prev) => {
                          const boundedStart = Math.min(Math.max(0, prev.videoTrimStart || 0), Math.max(0, duration - 0.1));
                          let boundedEnd = prev.videoTrimEnd || 0;
                          if (!boundedEnd || boundedEnd > duration) {
                            boundedEnd = duration;
                          }
                          if (boundedEnd <= boundedStart) {
                            boundedEnd = Math.min(duration, boundedStart + 1);
                          }
                          return {
                            ...prev,
                            videoTrimStart: boundedStart,
                            videoTrimEnd: boundedEnd,
                          };
                        });
                        const initialStart = Math.max(0, Number(form.videoTrimStart || 0));
                        if (initialStart > 0) {
                          seekPreviewTo(initialStart);
                        }
                      }}
                      style={{
                        transform: `scale(${form.videoScale ?? 1}) translate(${form.videoOffsetX ?? 0}%, ${form.videoOffsetY ?? 0}%)`,
                        transformOrigin: "center center",
                      }}
                    />
                    {videoDuration > 0 && (
                      <div className="space-y-3 rounded-md border border-white/10 bg-slate-900/40 p-3">
                        <p className="text-xs font-semibold text-slate-300">{copy.videoEditTitle}</p>
                        <p className="text-xs text-slate-500">{copy.videoEditHelp}</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{copy.trimStart}</span>
                            <span>{Number(form.videoTrimStart || 0).toFixed(1)}s</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={videoDuration}
                            step={0.1}
                            title="Trim start"
                            value={Math.min(Number(form.videoTrimStart || 0), Math.max(0, Number(form.videoTrimEnd || videoDuration) - 0.1))}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => {
                                const end = Number(prev.videoTrimEnd || videoDuration);
                                const nextStart = Math.min(value, Math.max(0.1, end - 0.1));
                                seekPreviewTo(nextStart);
                                return { ...prev, videoTrimStart: nextStart };
                              });
                            }}
                            className="w-full accent-orange-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{copy.trimEnd}</span>
                            <span>{Number(form.videoTrimEnd || videoDuration).toFixed(1)}s</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={videoDuration}
                            step={0.1}
                            title="Trim end"
                            value={Math.max(Number(form.videoTrimEnd || videoDuration), Number(form.videoTrimStart || 0) + 0.1)}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => {
                                const start = Number(prev.videoTrimStart || 0);
                                const nextEnd = Math.max(value, Math.min(videoDuration, start + 0.1));
                                if (videoFrameRef.current && videoFrameRef.current.currentTime > nextEnd) {
                                  seekPreviewTo(nextEnd);
                                }
                                return { ...prev, videoTrimEnd: nextEnd };
                              });
                            }}
                            className="w-full accent-orange-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{copy.moveLeftRight}</span>
                            <span>{Number(form.videoOffsetX || 0).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min={-30}
                            max={30}
                            step={1}
                            title="Move left/right"
                            value={Number(form.videoOffsetX || 0)}
                            onChange={(event) => setForm((prev) => ({ ...prev, videoOffsetX: Number(event.target.value) }))}
                            className="w-full accent-orange-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{copy.moveUpDown}</span>
                            <span>{Number(form.videoOffsetY || 0).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min={-30}
                            max={30}
                            step={1}
                            title="Move up/down"
                            value={Number(form.videoOffsetY || 0)}
                            onChange={(event) => setForm((prev) => ({ ...prev, videoOffsetY: Number(event.target.value) }))}
                            className="w-full accent-orange-500"
                          />
                        </div>
                      </div>
                    )}
                    {videoDuration > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{copy.frameTime}</span>
                          <span>{videoFrameTime.toFixed(1)}s / {videoDuration.toFixed(1)}s</span>
                        </div>
                        <input
                          type="range"
                          title="Frame time"
                          min={Math.max(0, Number(form.videoTrimStart || 0))}
                          max={Math.max(Math.max(0, Number(form.videoTrimStart || 0)) + 0.1, Number(form.videoTrimEnd || videoDuration))}
                          step={0.1}
                          value={Math.min(
                            Math.max(videoFrameTime, Math.max(0, Number(form.videoTrimStart || 0))),
                            Math.max(Math.max(0, Number(form.videoTrimStart || 0)) + 0.1, Number(form.videoTrimEnd || videoDuration))
                          )}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setVideoFrameTime(value);
                            if (videoFrameRef.current) {
                              seekPreviewTo(value);
                            }
                          }}
                          className="w-full accent-orange-500"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleCaptureVideoFrame}
                      className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20"
                    >
                      {copy.useFrameAsCover}
                    </button>
                    {frameStatus && <p className="text-xs text-emerald-400">{frameStatus}</p>}
                </div>
              )}
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? copy.saving : editing ? copy.update : copy.publish}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5"
              >
                {copy.clear}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Published Stories List */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="mb-4 text-lg font-bold text-white">{copy.publishedStories} ({articles.length})</h2>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-16 text-center">
            <div className="text-5xl mb-4">📰</div>
            <p className="text-base font-semibold text-slate-300">{copy.noStories}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <div key={article.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-800/30 p-4 hover:bg-slate-800/50 transition">
                {article.imageUrl ? (
                  <div className="relative h-20 w-28 flex-shrink-0 rounded-lg overflow-hidden">
                    <Image 
                      src={article.imageUrl} 
                      alt={article.title} 
                      fill 
                      className="object-cover" 
                      unoptimized 
                      style={{ objectPosition: `center ${article.imagePosition ?? 50}%` }}
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-28 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-white/10 bg-slate-900/50">
                    <span className="text-xs text-slate-600">{copy.noImage}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {article.category && getCategoryById(article.category) && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-sm">{getCategoryById(article.category)?.icon}</span>
                      <span className="text-[10px] text-orange-400 uppercase font-medium">
                        {language === 'fr' 
                          ? getCategoryById(article.category)?.labelFr 
                          : getCategoryById(article.category)?.label}
                      </span>
                    </div>
                  )}
                  <h3 className="text-sm font-semibold text-white truncate">{article.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-1">{article.headline}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{formatDate(article.createdAt)}</p>
                </div>
                {canManageNews && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button 
                      onClick={() => handleEdit(article)} 
                      className="px-3 py-1.5 rounded-lg border border-white/20 text-xs text-slate-300 hover:bg-white/5 transition"
                    >
                      {copy.edit}
                    </button>
                    <button 
                      onClick={() => deleteArticle(article.id)} 
                      className="px-3 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-300 hover:bg-red-500/10 transition"
                    >
                      {copy.delete}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Image Position Modal */}
      {showImagePositionModal && imagePreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setShowImagePositionModal(false)}>
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{copy.imagePositionTitle}</h3>
              <button
                onClick={() => setShowImagePositionModal(false)}
                className="text-slate-400 hover:text-white transition"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-sm text-slate-400 mb-4">{copy.imagePositionDesc}</p>
            
            <div className="mb-6">
              <p className="text-xs text-slate-500 mb-2">{copy.previewStoryCard}</p>
              <div className="max-w-md mx-auto rounded-xl overflow-hidden border border-white/10 bg-slate-800/50">
                <div 
                  className="relative w-full h-48 overflow-hidden"
                  style={{
                    backgroundImage: `url(${imagePreview})`,
                    backgroundSize: 'cover',
                    backgroundPosition: `center ${imagePositionY}%`,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h4 className="text-white font-bold text-lg line-clamp-2 drop-shadow-lg">
                      {form.title || 'Story Title'}
                    </h4>
                    <p className="text-orange-400 text-sm mt-1 drop-shadow">
                      {form.headline || 'Headline'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">{copy.verticalPosition}</label>
                <span className="text-sm text-slate-400">{imagePositionY}%</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500">{copy.top}</span>
                <input
                  type="range"
                  title="Vertical position"
                  min="0"
                  max="100"
                  value={imagePositionY}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    setImagePositionY(newValue);
                    updateFormField("imagePosition", newValue);
                  }}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <span className="text-xs text-slate-500">{copy.bottom}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">{copy.positionHelp}</p>
            </div>
            
            <div className="flex justify-center gap-2 mb-6">
              <button
                type="button"
                onClick={() => {
                  setImagePositionY(25);
                  updateFormField("imagePosition", 25);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  imagePositionY === 25 
                    ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {copy.top}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImagePositionY(50);
                  updateFormField("imagePosition", 50);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  imagePositionY === 50 
                    ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {copy.centered}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImagePositionY(75);
                  updateFormField("imagePosition", 75);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  imagePositionY === 75 
                    ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {copy.bottom}
              </button>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowImagePositionModal(false)}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
              >
                {copy.done}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
