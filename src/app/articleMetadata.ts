import type { Metadata } from "next";

const SITE_URL = "https://liprobakin.com";
const DEFAULT_IMAGE_URL = `${SITE_URL}/logos/liprobakin.png`;
const FIRESTORE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ppop-35930";
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type FirestoreField = {
  stringValue?: string;
};

type FirestoreDocument = {
  fields?: Record<string, FirestoreField>;
};

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();

const toAbsoluteImageUrl = (value?: string) => {
  const normalized = value?.trim();
  if (!normalized) return DEFAULT_IMAGE_URL;

  try {
    return new URL(normalized, SITE_URL).toString();
  } catch {
    return DEFAULT_IMAGE_URL;
  }
};

async function fetchArticleMetadata(articleId: string) {
  try {
    const url = `${FIRESTORE_REST_BASE}/news/${encodeURIComponent(articleId)}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;

    const doc: FirestoreDocument = await res.json();
    if (!doc.fields) return null;

    const f = doc.fields;
    const title = f.title?.stringValue || "";
    const titleEn = f.title_en?.stringValue || "";
    const summary = f.summary?.stringValue || "";
    const summaryEn = f.summary_en?.stringValue || "";
    const headline = f.headline?.stringValue || "";
    const headlineEn = f.headline_en?.stringValue || "";
    const imageUrl = f.imageUrl?.stringValue || "";
    const rawDescription = headline || headlineEn || summary || summaryEn || "";
    const cleanTitle = stripHtml(title || titleEn || "Liprobakin");
    const cleanDescription = stripHtml(rawDescription).slice(0, 200);

    return {
      title: cleanTitle,
      description: cleanDescription || "Liprobakin basketball news and updates.",
      image: toAbsoluteImageUrl(imageUrl),
    };
  } catch {
    return null;
  }
}

export const defaultHomeMetadata: Metadata = {
  title: "Liprobakin | Official Basketball League",
  description:
    "Liprobakin - Official basketball league featuring teams, players, games, and standings.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Liprobakin | Official Basketball League",
    description:
      "Liprobakin - Official basketball league featuring teams, players, games, and standings.",
    url: SITE_URL,
    siteName: "Liprobakin",
    images: [
      {
        url: DEFAULT_IMAGE_URL,
        width: 1200,
        height: 630,
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
    images: [DEFAULT_IMAGE_URL],
  },
};

export async function generateHomeArticleMetadata(searchParams: SearchParams): Promise<Metadata> {
  const params = await searchParams;
  const articleId = typeof params.article === "string" ? params.article : undefined;

  if (!articleId) {
    return defaultHomeMetadata;
  }

  const article = await fetchArticleMetadata(articleId);
  if (!article) {
    return defaultHomeMetadata;
  }

  const articleUrl = `${SITE_URL}/?article=${encodeURIComponent(articleId)}`;

  return {
    title: `${article.title} | Liprobakin`,
    description: article.description,
    alternates: {
      canonical: articleUrl,
    },
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
    other: {
      "og:image:secure_url": article.image,
      "twitter:image:src": article.image,
    },
  };
}

export const canonicalArticleShareUrl = (articleId: string) =>
  `${SITE_URL}/?article=${encodeURIComponent(articleId)}`;