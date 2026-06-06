import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// Set VOTE_TOKEN_SECRET in your Vercel env vars for production
const SECRET = process.env.VOTE_TOKEN_SECRET ?? "liprobakin-allstar-2026-default";

export const TOKEN_MIN_AGE_MS = 45_000;   // must be at least 45s old
export const TOKEN_MAX_AGE_MS = 7_200_000; // expires after 2h

export function createVoteToken(): string {
  const payload = { ts: Date.now(), jti: randomBytes(16).toString("hex") };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyVoteToken(token: string): { ts: number; jti: string } | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx < 0) return null;
    const encoded = token.slice(0, dotIdx);
    const sig     = token.slice(dotIdx + 1);
    const expected = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    const sigBuf = Buffer.from(sig,      "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    return JSON.parse(Buffer.from(encoded, "base64url").toString()) as { ts: number; jti: string };
  } catch {
    return null;
  }
}
