import { NextRequest, NextResponse } from "next/server";

const AT_API_URL = "https://api.africastalking.com/version1/messaging";

export async function POST(req: NextRequest) {
  const { phone, firstName, lastName, menPlayers, womenPlayers } = await req.json().catch(() => ({}));

  if (!phone || !Array.isArray(menPlayers) || !Array.isArray(womenPlayers)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey  = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    // SMS not configured — return 200 so the client doesn't retry
    console.warn("Africa's Talking credentials not set — skipping SMS");
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  const name = [firstName, lastName].filter(Boolean).join(" ") || "votant";

  const lines: string[] = [
    `🏀 LIPROBAKIN All-Star 2026`,
    `Merci ${name}! Votre vote est confirmé.`,
    ``,
    `♂ Hommes (${menPlayers.length}):`,
    menPlayers.join(", "),
    ``,
    `♀ Femmes (${womenPlayers.length}):`,
    womenPlayers.join(", "),
  ];
  const message = lines.join("\n");

  const body = new URLSearchParams({ username, to: phone, message });
  const senderId = process.env.AT_SENDER_ID;
  if (senderId) body.set("from", senderId);

  try {
    const res = await fetch(AT_API_URL, {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const json = await res.json().catch(() => null);
    return NextResponse.json({ ok: res.ok, result: json });
  } catch (err) {
    console.error("Africa's Talking SMS error:", err);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }
}
