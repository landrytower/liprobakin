import { NextResponse } from "next/server";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

type YouTubeLiveCreateRequest = {
  title?: string;
  description?: string;
  gameId?: string;
  privacyStatus?: "private" | "unlisted" | "public";
};

const callYouTube = async (
  path: string,
  token: string,
  init?: RequestInit
) => {
  const response = await fetch(`${YOUTUBE_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const bodyText = await response.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    parsedBody = bodyText;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: parsedBody,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: parsedBody,
  };
};

export async function POST(request: Request) {
  const token = process.env.YOUTUBE_OAUTH_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        error:
          "Missing YOUTUBE_OAUTH_ACCESS_TOKEN on server. Add a valid YouTube OAuth access token in environment variables.",
      },
      { status: 500 }
    );
  }

  let payload: YouTubeLiveCreateRequest = {};
  try {
    payload = (await request.json()) as YouTubeLiveCreateRequest;
  } catch {
    payload = {};
  }

  const now = new Date();
  const startAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
  const title = payload.title?.trim() || `Liprobakin Live${payload.gameId ? ` - ${payload.gameId}` : ""}`;
  const description = payload.description?.trim() || "Auto-generated live stream from Liprobakin admin.";
  const privacyStatus = payload.privacyStatus || "unlisted";

  const broadcastRes = await callYouTube(
    `/liveBroadcasts?part=snippet,status,contentDetails`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          title,
          description,
          scheduledStartTime: startAt,
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
          enableDvr: true,
          recordFromStart: true,
        },
      }),
    }
  );

  if (!broadcastRes.ok) {
    return NextResponse.json(
      { error: "Failed to create YouTube broadcast", details: broadcastRes.error },
      { status: 500 }
    );
  }

  const broadcast = broadcastRes.data as {
    id?: string;
    snippet?: { title?: string };
  };

  const broadcastId = broadcast?.id;
  if (!broadcastId) {
    return NextResponse.json(
      { error: "YouTube broadcast created but no broadcast id returned." },
      { status: 500 }
    );
  }

  const streamRes = await callYouTube(`/liveStreams?part=snippet,cdn,status`, token, {
    method: "POST",
    body: JSON.stringify({
      snippet: {
        title: `${title} Stream`,
      },
      cdn: {
        frameRate: "variable",
        ingestionType: "rtmp",
        resolution: "variable",
      },
    }),
  });

  if (!streamRes.ok) {
    return NextResponse.json(
      { error: "Failed to create YouTube stream", details: streamRes.error },
      { status: 500 }
    );
  }

  const stream = streamRes.data as {
    id?: string;
    cdn?: {
      ingestionInfo?: {
        ingestionAddress?: string;
        streamName?: string;
      };
    };
  };

  const streamId = stream?.id;
  if (!streamId) {
    return NextResponse.json(
      { error: "YouTube stream created but no stream id returned." },
      { status: 500 }
    );
  }

  const bindRes = await callYouTube(
    `/liveBroadcasts/bind?part=id,contentDetails&id=${encodeURIComponent(
      broadcastId
    )}&streamId=${encodeURIComponent(streamId)}`,
    token,
    { method: "POST" }
  );

  if (!bindRes.ok) {
    return NextResponse.json(
      { error: "Failed to bind YouTube stream to broadcast", details: bindRes.error },
      { status: 500 }
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${broadcastId}`;
  const studioUrl = `https://studio.youtube.com/video/${broadcastId}/livestreaming`;
  const ingestionAddress = stream?.cdn?.ingestionInfo?.ingestionAddress || "";
  const streamName = stream?.cdn?.ingestionInfo?.streamName || "";

  return NextResponse.json({
    broadcastId,
    streamId,
    title: broadcast?.snippet?.title || title,
    watchUrl,
    studioUrl,
    rtmpUrl: ingestionAddress,
    streamKey: streamName,
    fullIngestUrl:
      ingestionAddress && streamName ? `${ingestionAddress}/${streamName}` : undefined,
  });
}
