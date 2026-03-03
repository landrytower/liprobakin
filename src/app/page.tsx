import type { Metadata } from "next";
import HomeContent from "./HomeContent";

// Firestore REST API base URL for the project
const FIRESTORE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ppop-35930";
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

type FirestoreField = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  timestampValue?: string;
  mapValue?: { fields: Record<string, FirestoreField> };
  arrayValue?: { values?: FirestoreField[] };
};

type FirestoreDocument = {
  fields?: Record<string, FirestoreField>;
};

async function fetchArticleMetadata(articleId: string) {
  try {
    const url = `${FIRESTORE_REST_BASE}/news/${encodeURIComponent(articleId)}`;
    const res = await fetch(url, { next: { revalidate: 300 } }); // cache for 5 min
    if (!res.ok) return null;
    const doc: FirestoreDocument = await res.json();
    if (!doc.fields) return null;

    const f = doc.fields;
    const title = f.title?.stringValue || "";
    const title_en = f.title_en?.stringValue || "";
    const summary = f.summary?.stringValue || "";
    const summary_en = f.summary_en?.stringValue || "";
    const headline = f.headline?.stringValue || "";
    const headline_en = f.headline_en?.stringValue || "";
    const imageUrl = f.imageUrl?.stringValue || "";

    // Strip HTML tags and collapse whitespace for clean previews
    const stripHtml = (html: string) =>
      html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();

    const rawDescription = headline || headline_en || summary || summary_en || "";

    return {
      title: stripHtml(title || title_en || "Liprobakin"),
      description: stripHtml(rawDescription).slice(0, 200),
      image: imageUrl || "https://liprobakin.com/logos/liprobakin.png",
    };
  } catch {
    return null;
  }
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const articleId = typeof params.article === "string" ? params.article : undefined;

  // Default site metadata
  const defaults: Metadata = {
    title: "Liprobakin | Official Basketball League",
    description:
      "Liprobakin - Official basketball league featuring teams, players, games, and standings.",
    openGraph: {
      title: "Liprobakin | Official Basketball League",
      description:
        "Liprobakin - Official basketball league featuring teams, players, games, and standings.",
      url: "https://liprobakin.com",
      siteName: "Liprobakin",
      images: [
        {
          url: "https://liprobakin.com/logos/liprobakin.png",
          width: 512,
          height: 512,
          alt: "Liprobakin",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Liprobakin | Official Basketball League",
      description:
        "Liprobakin - Official basketball league featuring teams, players, games, and standings.",
      images: ["https://liprobakin.com/logos/liprobakin.png"],
    },
  };

  if (!articleId) return defaults;

  // Fetch article from Firestore REST API for rich link previews
  const article = await fetchArticleMetadata(articleId);
  if (!article) return defaults;

  const articleUrl = `https://liprobakin.com/?article=${encodeURIComponent(articleId)}`;

  return {
    title: `${article.title} | Liprobakin`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      url: articleUrl,
      siteName: "Liprobakin",
      images: [
        {
          url: article.image,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: [article.image],
    },
  };
}

export default function Page() {
  return <HomeContent />;
}
