import { reportEvidence } from "./evidence.ts";
import type { PlaceSummary, Report, ReportModerationStatus, ReportReviewStatus, ReportRole, Verdict } from "./types.ts";

export const VERDICTS: Verdict[] = ["open", "limited", "closed", "still", "changed", "maps"];

export const VISITOR_VERDICTS: Verdict[] = ["open", "limited", "closed", "still", "changed"];

export const VERDICT_LABEL: Record<Verdict, string> = {
  open: "使えていた",
  limited: "制限があった",
  closed: "使えなかった",
  still: "前回と同じだった",
  changed: "変わっていた",
  maps: "Googleマップを見てほしい",
};

const NOTE_MAX = 80;

export function parseVerdict(raw: unknown): Verdict | null {
  const value = String(raw || "").trim();
  return (VERDICTS as string[]).includes(value) ? (value as Verdict) : null;
}

export function parseRole(raw: unknown): ReportRole {
  return String(raw || "").trim() === "owner" ? "owner" : "visitor";
}

export function wantsMaps(raw: unknown): boolean {
  const value = String(raw || "").trim().toLowerCase();
  return value === "1" || value === "on" || value === "true";
}

function asReport(row: Report & { prefer_maps?: number | boolean; role?: string; moderation_status?: string; review_status?: string }): Report {
  const role = row.role === "owner" ? "owner" : "visitor";
  const review: ReportReviewStatus = row.review_status === "confirmed" || row.review_status === "disputed" ? row.review_status : "unknown";
  const moderation: ReportModerationStatus = row.moderation_status === "hidden" ? "hidden" : "visible";
  const evidence = reportEvidence(row.created_at, role);
  evidence.review = review;
  return {
    ...row,
    role,
    prefer_maps: Boolean(row.prefer_maps),
    moderation_status: moderation,
    review_status: review,
    evidence,
  };
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

export function resolvePost(input: {
  roleRaw: unknown;
  verdictRaw: unknown;
  preferMapsRaw: unknown;
  hasMapsUrl: boolean;
  shopLike: boolean;
}): { role: ReportRole; verdict: Verdict; preferMaps: boolean; error?: string } {
  const role = parseRole(input.roleRaw);
  const preferMaps = role === "owner" && wantsMaps(input.preferMapsRaw);
  let verdict = parseVerdict(input.verdictRaw);
  if (role === "owner" && !input.shopLike) {
    return { role, verdict: "open", preferMaps: false, error: "店・施設のカードだけ、店側として書けます。" };
  }
  if (preferMaps && !input.hasMapsUrl) {
    return { role, verdict: "maps", preferMaps: false, error: "この場所には地図リンクがありません。" };
  }
  if (role === "visitor" && verdict === "maps") {
    return { role, verdict: "open", preferMaps: false, error: "見かけた人は、見たときの様子を選んでください。" };
  }
  if (!verdict && preferMaps) verdict = "maps";
  if (!verdict) {
    return { role, verdict: "open", preferMaps: false, error: "いまどうだったかを選んでください。" };
  }
  if (role === "visitor" && !VISITOR_VERDICTS.includes(verdict)) {
    return { role, verdict, preferMaps: false, error: "いまどうだったかを選んでください。" };
  }
  return { role, verdict, preferMaps };
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
    role: ReportRole;
    preferMaps: boolean;
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
      `INSERT INTO reports (id, place_id, area, seed_key, verdict, note, created_at, ip_hash, role, prefer_maps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      args.role,
      args.preferMaps ? 1 : 0,
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
      `SELECT id, place_id, area, seed_key, verdict, note, created_at, role, prefer_maps, moderation_status, review_status
         FROM reports WHERE place_id IN (${marks})
           AND (moderation_status IS NULL OR moderation_status != 'hidden')
         ORDER BY created_at DESC`,
    )
    .bind(...chunk)
    .all<Report>();
  const counts = new Map<string, number>();
  for (const raw of results || []) {
    const row = asReport(raw);
    counts.set(row.place_id, (counts.get(row.place_id) || 0) + 1);
    const current = out.get(row.place_id) || { latest: null, latestOwner: null, count: 0 };
    if (!current.latest) current.latest = row;
    if (row.role === "owner" && !current.latestOwner) current.latestOwner = row;
    out.set(row.place_id, current);
  }
  for (const [id, summary] of out) {
    summary.count = counts.get(id) || 0;
  }
  return out;
}

export async function listReports(db: D1Database, placeId: string, limit = 20): Promise<Report[]> {
  const { results } = await db
    .prepare(
      `SELECT id, place_id, area, seed_key, verdict, note, created_at, role, prefer_maps, moderation_status, review_status
         FROM reports WHERE place_id = ?
           AND (moderation_status IS NULL OR moderation_status != 'hidden')
         ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(placeId, limit)
    .all<Report>();
  return (results || []).map(asReport);
}

export type FlagReason = "privacy" | "misleading" | "unsafe" | "other";
export type ModerationAction = "hide" | "restore" | "confirm" | "dispute" | "dismiss";

export function parseFlagReason(raw: unknown): FlagReason | null {
  const value = String(raw || "").trim();
  return ["privacy", "misleading", "unsafe", "other"].includes(value) ? value as FlagReason : null;
}

export function parseModerationAction(raw: unknown): ModerationAction | null {
  const value = String(raw || "").trim();
  return ["hide", "restore", "confirm", "dispute", "dismiss"].includes(value) ? value as ModerationAction : null;
}

export async function flagReport(
  db: D1Database,
  reportId: string,
  reason: FlagReason,
  ipHash: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const report = await db.prepare("SELECT id FROM reports WHERE id = ? LIMIT 1").bind(reportId).first<{ id: string }>();
  if (!report) return { ok: false, error: "報告が見つかりません。" };
  const recent = await db
    .prepare(
      `SELECT id FROM report_flags
         WHERE report_id = ? AND ip_hash = ? AND created_at > datetime('now', '-10 minutes')
         LIMIT 1`,
    )
    .bind(reportId, ipHash)
    .first<{ id: string }>();
  if (recent) return { ok: false, error: "通報はしばらく間をあけてください。" };
  await db
    .prepare("INSERT INTO report_flags (id, report_id, reason, created_at, ip_hash) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), reportId, reason, new Date().toISOString(), ipHash)
    .run();
  return { ok: true };
}

export async function moderateReport(
  db: D1Database,
  reportId: string,
  action: ModerationAction,
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const report = await db.prepare("SELECT id FROM reports WHERE id = ? LIMIT 1").bind(reportId).first<{ id: string }>();
  if (!report) return { ok: false, error: "報告が見つかりません。" };
  const moderation = action === "hide" ? "hidden" : "visible";
  const review = action === "confirm" ? "confirmed" : action === "dispute" ? "disputed" : action === "dismiss" ? "unknown" : null;
  if (review) {
    await db
      .prepare("UPDATE reports SET moderation_status = ?, review_status = ?, moderated_at = ?, moderated_by = ? WHERE id = ?")
      .bind(moderation, review, new Date().toISOString(), actorId, reportId)
      .run();
  } else {
    await db
      .prepare("UPDATE reports SET moderation_status = ?, moderated_at = ?, moderated_by = ? WHERE id = ?")
      .bind(moderation, new Date().toISOString(), actorId, reportId)
      .run();
  }
  await db
    .prepare("INSERT INTO moderation_audit (id, report_id, action, actor_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), reportId, action, actorId, new Date().toISOString())
    .run();
  return { ok: true };
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
