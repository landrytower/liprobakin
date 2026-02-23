import { NextResponse } from "next/server";

function isPrivateOrLocalHost(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  if (lowerHost === "localhost" || lowerHost === "127.0.0.1" || lowerHost === "::1") {
    return true;
  }

  const ipv4Match = lowerHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url")?.trim();

  if (!target) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  if (isPrivateOrLocalHost(parsedUrl.hostname)) {
    return NextResponse.json({ error: "Blocked host" }, { status: 403 });
  }

  try {
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: "Unable to fetch image", status: upstreamResponse.status },
        { status: 502 }
      );
    }

    const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream";
    const body = await upstreamResponse.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
  }
}
