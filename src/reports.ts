import type { PlaceSummary, Report, Verdict } from "./types.ts";

export const VERDICTS: Verdict[] = ["open", "limited", "closed", "still", "changed"];

export const VERDICT_LABEL: Record<Verdict, string> = {
  open: "使えていた",
  limited: "制限があった",
  closed: "使えなかった",
  still: "前回と同じだった",
  changed: "変わっていた",
};

const NOTE_MAX = 80;

export function parseVerdict(raw: unknown): Verdict | null {
  const value = String(raw || "").trim();
  return (VERDICTS as string[]).includes(value) ? (value as Verdict) : null;
}

export function cleanNote(raw: unknown): { note: string | null; error?: string } {
  const note = String(raw || "").replace(/\s+/g, " ").trim();
  if (!note) return { note: null };
  if (note.length > NOTE_MAX) return { note: null, error: "メモは80字までです。" };
  if (/https?:\/\//i.test(note) || /www\./i.test(note)) {
    return { note: null, error: "URLは書けません。" };
  }
  if (/[0-9０-９]{8,}/.test(note) || /0\d{1,3}[-(]?\d{2,4}/.test(note)) {
    return { note: null, error: "電話番号は書けません。" };
  }
  if (/@/.test(note) || /line\s*id/i.test(note)) {
    return { note: null, error: "連絡先は書けません。" };
  }
  if (/(待ち合わせ|迎えに|来てください|dm|マッチング|個人情報)/i.test(note)) {
    return { note: null, error: "人と会う約束や仲介の文は書けません。" };
  }
  return { note };
}

export function allowedOrigin(request: Request, site: string): boolean {
  const origin = request.headers.get("Origin") || "";
  const referer = request.headers.get("Referer") || "";
  const allowed = [site, site.replace("https://", "https://www.")];
  if (origin) return allowed.some((a) => origin === a);
  if (referer) return allowed.some((a) => referer.startsWith(a + "/"));
  return false;
}

export async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(`saigaiban:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function insertReport(
  db: D1Database,
  args: {
    placeId: string;
    area: string;
    seedKey: string;
    verdict: Verdict;
    note: string | null;
    ipHash: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const recent = await db
    .prepare(
      `SELECT created_at FROM reports
        WHERE ip_hash = ? AND place_id = ?
        ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(args.ipHash, args.placeId)
    .first<{ created_at: string }>();
  if (recent?.created_at) {
    const age = Date.now() - Date.parse(recent.created_at);
    if (Number.isFinite(age) && age < 10 * 60 * 1000) {
      return { ok: false, error: "同じ場所への投稿は、しばらく間をあけてください。" };
    }
  }
  await db
    .prepare(
      `INSERT INTO reports (id, place_id, area, seed_key, verdict, note, created_at, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      args.placeId,
      args.area,
      args.seedKey || null,
      args.verdict,
      args.note,
      new Date().toISOString(),
      args.ipHash,
    )
    .run();
  return { ok: true };
}

export async function latestByPlaces(db: D1Database, placeIds: string[]): Promise<Map<string, PlaceSummary>> {
  const out = new Map<string, PlaceSummary>();
  if (placeIds.length === 0) return out;
  const chunk = placeIds.slice(0, 80);
  const marks = chunk.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT id, place_id, area, seed_key, verdict, note, created_at
         FROM reports WHERE place_id IN (${marks})
         ORDER BY created_at DESC`,
    )
    .bind(...chunk)
    .all<Report>();
  const counts = new Map<string, number>();
  for (const row of results || []) {
    counts.set(row.place_id, (counts.get(row.place_id) || 0) + 1);
    if (!out.has(row.place_id)) {
      out.set(row.place_id, { latest: row, count: 0 });
    }
  }
  for (const [id, summary] of out) {
    summary.count = counts.get(id) || 0;
  }
  return out;
}

export async function listReports(db: D1Database, placeId: string, limit = 20): Promise<Report[]> {
  const { results } = await db
    .prepare(
      `SELECT id, place_id, area, seed_key, verdict, note, created_at
         FROM reports WHERE place_id = ?
         ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(placeId, limit)
    .all<Report>();
  return results || [];
}

export function formatWhen(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(new Date(ms)).replace(" ", " ")} ごろ`;
}
