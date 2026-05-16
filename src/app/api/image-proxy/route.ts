import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST_SUFFIXES = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "googleusercontent.com",
  "liprobakin.com",
  "vercel.app",
];

const isAllowedHost = (hostname: string) =>
  ALLOWED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));

const isPrivateOrLocalHost = (hostname: string): boolean => {
  const lowerHost = hostname.toLowerCase();
  if (lowerHost === "localhost" || lowerHost === "127.0.0.1" || lowerHost === "::1") {
    return true;
  }

  const ipv4Match = lowerHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("url")?.trim();
  if (!imageUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
  }

  if (!["https:", "http:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  if (isPrivateOrLocalHost(parsedUrl.hostname) || !isAllowedHost(parsedUrl.hostname)) {
    return NextResponse.json({ error: "URL host not allowed" }, { status: 403 });
  }

  try {
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      cache: "force-cache",
      next: { revalidate: 3600 },
      headers: { Accept: "image/*,*/*;q=0.8" },
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }

    const contentType = upstreamResponse.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await upstreamResponse.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}
