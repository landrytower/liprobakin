import HomeLoading from "./HomeLoading";
import HomeClient from "./HomeClient";
import { generateHomeArticleMetadata } from "./articleMetadata";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import type { CachedNewsArticle, CommitteeMember } from "./HomeContent";

export const revalidate = 60;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props) {
  return generateHomeArticleMetadata(searchParams);
}

const isFirebaseUrl = (url?: string) =>
  !!url &&
  (url.includes("firebasestorage.googleapis.com") || url.includes("storage.googleapis.com"));

function rolePriority(role: string): number {
  const r = role.toLowerCase().trim();
  if (r.includes("president") || r.includes("président")) return 1;
  if ((r.includes("1") || r.includes("first") || r.includes("1er") || r.includes("premier")) && r.includes("vice")) return 2;
  if ((r.includes("2") || r.includes("second") || r.includes("2e") || r.includes("deuxième")) && r.includes("vice")) return 3;
  if (r.includes("secr") || r.includes("secretary")) return 4;
  if (r.includes("tres") || r.includes("trés") || r.includes("treasurer")) return 5;
  return 999;
}

async function fetchAllInitialData() {
  const db = getAdminFirestore();

  const [newsSnap, committeeSnap, commissionSnap, refereesSnap] = await Promise.all([
    db.collection("news").orderBy("createdAt", "desc").limit(10).get().catch(() => null),
    db.collection("committee").get().catch(() => null),
    db.collection("commission").get().catch(() => null),
    db.collection("referees").get().catch(() => null),
  ]);

  const news: CachedNewsArticle[] = newsSnap
    ? newsSnap.docs.map((d) => {
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
      })
    : [];

  const committee: CommitteeMember[] = committeeSnap
    ? committeeSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            role: data.role || "",
            photo: data.photo || "",
          };
        })
        .sort((a, b) => {
          const diff = rolePriority(a.role) - rolePriority(b.role);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        })
    : [];

  const commission: CommitteeMember[] = commissionSnap
    ? commissionSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            role: data.role || "",
            photo: data.photo || "",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const referees: CommitteeMember[] = refereesSnap
    ? refereesSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            role: "Arbitre",
            photo: data.headshot || "",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return { news, committee, commission, referees };
}

export default async function Page() {
  const { news, committee, commission, referees } = await fetchAllInitialData();
  return (
    <>
      <div id="home-loading-shell">
        <HomeLoading />
      </div>
      <HomeClient
        initialNews={news}
        initialCommittee={committee}
        initialCommission={commission}
        initialReferees={referees}
      />
    </>
  );
}
