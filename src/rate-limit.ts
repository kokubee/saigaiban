const RETENTION_MS = 24 * 60 * 60 * 1000;

function dayBucket(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export async function shortIpHmac(ip: string, secretKey?: string, now = Date.now()): Promise<string | null> {
  const secret = String(secretKey || "").trim();
  const value = String(ip || "").trim();
  if (!secret || !value) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${dayBucket(now)}:${value}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function rateLimitConfigured(secretKey?: string): boolean {
  return String(secretKey || "").trim().length >= 32;
}

export async function purgeExpiredIpHashes(db: D1Database): Promise<void> {
  await db
    .prepare(
      `UPDATE reports
          SET ip_hash = NULL
        WHERE ip_hash IS NOT NULL
          AND julianday(created_at) < julianday('now', '-24 hours')`,
    )
    .run();
  await db
    .prepare(
      `UPDATE report_flags
          SET ip_hash = NULL
        WHERE ip_hash IS NOT NULL
          AND julianday(created_at) < julianday('now', '-24 hours')`,
    )
    .run();
}

export const IP_HASH_RETENTION_MS = RETENTION_MS;
