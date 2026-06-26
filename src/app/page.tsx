import HomeLoading from "./HomeLoading";
import HomeClient from "./HomeClient";
import { generateHomeArticleMetadata } from "./articleMetadata";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import type { CachedNewsArticle } from "./HomeContent";

export const revalidate = 60;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props) {
  return generateHomeArticleMetadata(searchParams);
}

async function fetchInitialNews(): Promise<CachedNewsArticle[]> {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("news").orderBy("createdAt", "desc").limit(10).get();
    const isFirebaseUrl = (url?: string) =>
      !!url &&
      (url.includes("firebasestorage.googleapis.com") ||
        url.includes("storage.googleapis.com"));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || "",
        title_en: data.title_en || "",
        summary: data.summary || "",
        summary_en: data.summary_en || "",
        category: data.category || "News",
        headline: data.headline || "",
        headline_en: data.headline_en || "",
        imageUrl: isFirebaseUrl(data.imageUrl) ? data.imageUrl : undefined,
        additionalMedia: Array.isArray(data.additionalMedia) ? data.additionalMedia : [],
        additionalImageUrls: Array.isArray(data.additionalImageUrls)
          ? data.additionalImageUrls.filter((u: unknown) =>
              isFirebaseUrl(typeof u === "string" ? u : "")
            )
          : [],
        videoUrl: isFirebaseUrl(data.videoUrl) ? data.videoUrl : undefined,
        videoTrimStart: data.videoTrimStart ?? 0,
        videoTrimEnd: data.videoTrimEnd ?? null,
        videoScale: data.videoScale ?? 1,
        videoOffsetX: data.videoOffsetX ?? 0,
        videoOffsetY: data.videoOffsetY ?? 0,
        imagePosition: data.imagePosition ?? 50,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        author: data.author || "LIPROBAKIN Staff",
        authorPhoto: data.authorPhoto || "",
        isPaused: data.isPaused || false,
      };
    });
  } catch {
    return [];
  }
}

export default async function Page() {
  const initialNews = await fetchInitialNews();
  return (
    <>
      <div id="home-loading-shell">
        <HomeLoading />
      </div>
      <HomeClient initialNews={initialNews} />
    </>
  );
}
