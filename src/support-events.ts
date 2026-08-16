import type {
  SupportEvent,
  SupportEventCategory,
  SupportEventFreshness,
  SupportEventQueryResult,
  SupportEventStatus,
} from "./types.ts";

const CATEGORY_LABELS: Record<SupportEventCategory, string> = {
  supplies: "物資配布",
  meal: "炊き出し・食事",
  medical: "無料診療・巡回診療",
  bath: "入浴支援",
  collection: "支援物資の受付・配布",
};

const STATUS_LABELS: Record<SupportEventStatus, string> = {
  scheduled: "予定",
  open: "受付中",
  ended: "終了",
  check: "要確認",
};

const FRESHNESS_LABELS: Record<SupportEventFreshness, string> = {
  fresh: "確認日時24時間以内",
  stale: "古い可能性あり",
  expired: "期限切れ・要確認",
  unknown: "確認日時不明",
};

const CATEGORIES = new Set<SupportEventCategory>(Object.keys(CATEGORY_LABELS) as SupportEventCategory[]);
const STATUSES = new Set<SupportEventStatus>(Object.keys(STATUS_LABELS) as SupportEventStatus[]);
const AREA_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const MAX_AGE_FRESH_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_STALE_MS = 72 * 60 * 60 * 1000;

type SupportEventRow = {
  id?: unknown;
  area?: unknown;
  category?: unknown;
  title?: unknown;
  organizer?: unknown;
  venue?: unknown;
  address?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  eligibility?: unknown;
  description?: unknown;
  source_url?: unknown;
  status?: unknown;
  checked_at?: unknown;
  contact_note?: unknown;
};

function text(value: unknown, max: number): string | null {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result && result.length <= max ? result : null;
}

function nullableText(value: unknown, max: number): string | null {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result ? (result.length <= max ? result : null) : null;
}

function httpsUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.hostname === "localhost" || url.hostname === "127.0.0.1") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function supportEventCategoryLabel(category: SupportEventCategory): string {
  return CATEGORY_LABELS[category];
}

export function supportEventStatusLabel(status: SupportEventStatus): string {
  return STATUS_LABELS[status];
}

export function supportEventFreshnessLabel(freshness: SupportEventFreshness): string {
  return FRESHNESS_LABELS[freshness];
}

export function publicSupportEventsEnabled(raw?: string): boolean {
  return String(raw || "").trim().toLowerCase() === "on";
}

export function supportEventFreshness(checkedAt: string, now = Date.now()): SupportEventFreshness {
  const checked = Date.parse(checkedAt);
  if (!Number.isFinite(checked) || checked > now) return "unknown";
  const age = now - checked;
  if (age <= MAX_AGE_FRESH_MS) return "fresh";
  if (age <= MAX_AGE_STALE_MS) return "stale";
  return "expired";
}

export function parseSupportEvent(raw: SupportEventRow, now = Date.now()): SupportEvent | null {
  const id = text(raw.id, 80);
  const area = text(raw.area, 80);
  const category = text(raw.category, 32) as SupportEventCategory | null;
  const title = text(raw.title, 160);
  const organizer = text(raw.organizer, 160);
  const venue = text(raw.venue, 160);
  const startsAt = text(raw.starts_at, 64);
  const endsAt = text(raw.ends_at, 64);
  const sourceUrl = httpsUrl(raw.source_url);
  const checkedAt = text(raw.checked_at, 64);
  const status = text(raw.status, 16) as SupportEventStatus | null;
  if (!id || !ID_RE.test(id) || !area || !AREA_RE.test(area) || !category || !CATEGORIES.has(category) || !title || !organizer || !venue || !startsAt || !endsAt || !sourceUrl || !checkedAt || !status || !STATUSES.has(status)) return null;
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const freshness = supportEventFreshness(checkedAt, now);
  const displayStatus: SupportEventStatus = endMs <= now
    ? "ended"
    : freshness !== "fresh"
      ? "check"
      : startMs > now
        ? "scheduled"
        : status === "open"
          ? "open"
          : "check";
  return {
    id,
    area,
    category,
    title,
    organizer,
    venue,
    address: nullableText(raw.address, 240),
    startsAt,
    endsAt,
    eligibility: nullableText(raw.eligibility, 240),
    description: nullableText(raw.description, 800),
    sourceUrl,
    status: displayStatus,
    checkedAt,
    freshness,
    contactNote: nullableText(raw.contact_note, 240),
  };
}

export async function listSupportEvents(db: D1Database, area: string, now = Date.now(), limit = 50): Promise<SupportEventQueryResult> {
  if (!AREA_RE.test(area)) return { available: true, events: [] };
  try {
    const { results } = await db
      .prepare(
        `SELECT id, area, category, title, organizer, venue, address, starts_at, ends_at,
                eligibility, description, source_url, status, checked_at, contact_note
           FROM support_events
          WHERE area = ? AND published = 1
          ORDER BY starts_at ASC
          LIMIT ?`,
      )
      .bind(area, Math.min(Math.max(limit, 1), 100))
      .all<SupportEventRow>();
    const events = (results || [])
      .map((row) => parseSupportEvent(row, now))
      .filter((event): event is SupportEvent => Boolean(event));
    return { available: true, events };
  } catch {
    // The feature stays non-blocking while migration or the curated catalog is not installed.
    return { available: false, events: [] };
  }
}
