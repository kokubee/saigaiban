import type { BoardMeta, BoardOfficialStatus, BoardOfficialStatusPage, BoardPlace, BoardPlacesPage } from "./types.ts";
import { getCachedJson, publicCacheMode, type PublicCacheMode } from "./cache.ts";
import { normalizePlaceCategory } from "./labels.ts";

export const DEFAULT_OPENNAVI = "https://opennavi.org";
export const SUPPORTED_BOARD_SCHEMA = "opennavi.board/v1";
export const OPENNAVI_LINE_URL = "https://lin.ee/U9HwdQ1";
export const KUMAMOTO_RESIDENT_SUPPORT = "https://kumamoto-shien.jp/";
export const KUMAMOTO_ROAD_MAP = "https://www.mlit.go.jp/road/saigai/r8kumamoto/index.html";
export const KUMAMOTO_BODIK = "https://odcs.bodik.jp/kumamoto-r8/";

export function opennaviOrigin(raw?: string): string {
  const value = String(raw || "").trim().replace(/\/+$/, "");
  if (!value || value.includes("localhost") || value.includes("127.0.0.1")) {
    return DEFAULT_OPENNAVI;
  }
  return value;
}

export function officialHubUrl(origin: string, slug: string): string {
  return `${opennaviOrigin(origin)}/a/${encodeURIComponent(slug)}`;
}

export function officialSupportUrl(origin: string): string {
  return `${opennaviOrigin(origin)}/support`;
}

/** The Kumamoto resident board has been consolidated into the dedicated support navigator. */
export function kumamotoResidentSupportUrl(): string {
  return KUMAMOTO_RESIDENT_SUPPORT;
}

/** OpenNavi's resident/nearby entry, scoped to a town when one is known. */
export function officialVictimUrl(origin: string, slug?: string): string {
  const area = String(slug || "").trim();
  return area ? officialHubUrl(origin, area) : `${opennaviOrigin(origin)}/#open-areas`;
}

const FORBIDDEN = new Set([
  "status",
  "hours",
  "note",
  "phone",
  "confirm_still",
  "confirm_changed",
  "trust",
  "review_status",
  "owner_uid",
  "hidden",
]);

export function stripPlace(raw: unknown): BoardPlace | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = String(p.id || "").trim();
  const name = String(p.name || "").trim();
  const area = String(p.area || "").trim();
  if (!id || !name || !area) return null;
  const flags = Array.isArray(p.flags)
    ? [...new Set(p.flags.filter((value): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)))]
    : [];
  return {
    id,
    seed_key: String(p.seed_key || ""),
    name,
    area,
    category: normalizePlaceCategory(String(p.category || ""), name),
    flags,
    lat: typeof p.lat === "number" && Number.isFinite(p.lat) ? p.lat : null,
    lng: typeof p.lng === "number" && Number.isFinite(p.lng) ? p.lng : null,
    address: p.address ? String(p.address) : null,
    source: p.source ? String(p.source) : null,
    data_basis_date: p.data_basis_date ? String(p.data_basis_date) : null,
    identity_only: true,
    maps_url: String(p.maps_url || ""),
  };
}

export function placeHasForbiddenKeys(value: unknown): string[] {
  const found: string[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      if (FORBIDDEN.has(k)) found.push(k);
      walk(child);
    }
  };
  walk(value);
  return [...new Set(found)];
}

const OPENNAVI_CACHE_TTL = 60;
const OPENNAVI_CACHE_STALE = 300;

function cacheMode(raw?: string): PublicCacheMode {
  return publicCacheMode(raw);
}

function assertSupportedBoardContract(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const doc = value as Record<string, unknown>;
  if (typeof doc.schema === "string" && doc.schema !== SUPPORTED_BOARD_SCHEMA) {
    throw new Error("unsupported OpenNavi board schema");
  }
  const version = Number(doc.contractVersion);
  if (Number.isFinite(version) && version > 1) throw new Error("unsupported OpenNavi board contract version");
}

export async function fetchPlaceById(origin: string, id: string, publicReadCache?: string): Promise<BoardPlace | null> {
  const doc = await getCachedJson(
    `${opennaviOrigin(origin)}/api/board/places/${encodeURIComponent(id)}`,
    cacheMode(publicReadCache),
    OPENNAVI_CACHE_TTL,
    OPENNAVI_CACHE_STALE,
  );
  if (!doc || typeof doc !== "object") return null;
  assertSupportedBoardContract(doc);
  const place = (doc as { place?: unknown }).place;
  return stripPlace(place);
}

export async function fetchMeta(origin: string, publicReadCache?: string): Promise<BoardMeta> {
  const doc = (await getCachedJson(
    `${opennaviOrigin(origin)}/api/board/meta`,
    cacheMode(publicReadCache),
    OPENNAVI_CACHE_TTL,
    OPENNAVI_CACHE_STALE,
  )) as BoardMeta;
  assertSupportedBoardContract(doc);
  if (!doc?.disaster?.id || !Array.isArray(doc.areas)) throw new Error("invalid board meta");
  return {
    schema: typeof doc.schema === "string" ? doc.schema : undefined,
    contractVersion: Number.isFinite(Number(doc.contractVersion)) ? Number(doc.contractVersion) : undefined,
    capabilities: Array.isArray(doc.capabilities) ? doc.capabilities.filter((value): value is string => typeof value === "string") : undefined,
    taxonomy:
      doc.taxonomy && typeof doc.taxonomy === "object"
        ? {
            version: Number.isFinite(Number(doc.taxonomy.version)) ? Number(doc.taxonomy.version) : 1,
            categories: Array.isArray(doc.taxonomy.categories)
              ? doc.taxonomy.categories.flatMap((value) => value && typeof value.id === "string" && typeof value.label === "string" ? [{ id: value.id, label: value.label }] : [])
              : [],
            flags: Array.isArray(doc.taxonomy.flags)
              ? doc.taxonomy.flags.flatMap((value) => value && typeof value.id === "string" && typeof value.label === "string"
                ? [{ id: value.id, label: value.label, ...(Array.isArray(value.categories) ? { categories: value.categories.filter((category): category is string => typeof category === "string") } : {}) }]
                : [])
              : [],
          }
        : undefined,
    disaster: { id: String(doc.disaster.id), label: String(doc.disaster.label || "") },
    areas: doc.areas
      .filter((a) => a && a.status === "active" && a.slug)
      .map((a) => ({
        slug: String(a.slug),
        nameJa: String(a.nameJa || a.slug),
        prefCode: String(a.prefCode || ""),
        status: "active",
        region:
          a.region && typeof a.region === "object" && typeof a.region.id === "string" && typeof a.region.label === "string"
            ? {
                id: a.region.id,
                label: a.region.label,
                order: Number.isFinite(Number(a.region.order)) ? Number(a.region.order) : Number.MAX_SAFE_INTEGER,
              }
            : null,
      })),
    placeLicense: doc.placeLicense,
  };
}

export async function fetchPlaces(
  origin: string,
  area: string,
  opts: { category?: string; flag?: string; cursor?: string; limit?: number } = {},
  publicReadCache?: string,
): Promise<BoardPlacesPage> {
  const qs = new URLSearchParams();
  qs.set("area", area);
  qs.set("limit", String(Math.min(Math.max(opts.limit ?? 80, 1), 200)));
  if (opts.category) qs.set("category", opts.category);
  if (opts.flag) qs.set("flag", opts.flag);
  if (opts.cursor) qs.set("cursor", opts.cursor);
  const doc = (await getCachedJson(
    `${opennaviOrigin(origin)}/api/board/places?${qs}`,
    cacheMode(publicReadCache),
    OPENNAVI_CACHE_TTL,
    OPENNAVI_CACHE_STALE,
  )) as BoardPlacesPage | null;
  assertSupportedBoardContract(doc);
  const places = (doc?.places || []).map(stripPlace).filter((p): p is BoardPlace => Boolean(p));
  return {
    schema: typeof doc?.schema === "string" ? doc.schema : undefined,
    contractVersion: Number.isFinite(Number(doc?.contractVersion)) ? Number(doc?.contractVersion) : undefined,
    capabilities: Array.isArray(doc?.capabilities) ? doc.capabilities.filter((value): value is string => typeof value === "string") : undefined,
    disaster_id: String(doc?.disaster_id || ""),
    generated_at: String(doc?.generated_at || ""),
    next_cursor: doc?.next_cursor || null,
    places,
  };
}

/** Read-only official status overlay; identity cards still come from /api/board/places. */
export async function fetchOfficialStatuses(
  origin: string,
  area: string,
  categories: string[] = [],
  publicReadCache?: string,
): Promise<BoardOfficialStatus[]> {
  const qs = new URLSearchParams({ area });
  const normalized = categories.map((value) => value.trim()).filter(Boolean);
  if (normalized.length) qs.set("category", normalized.join(","));
  let doc: BoardOfficialStatusPage | null;
  try {
    doc = (await getCachedJson(
      `${opennaviOrigin(origin)}/api/board/official-status?${qs}`,
      cacheMode(publicReadCache),
      OPENNAVI_CACHE_TTL,
      OPENNAVI_CACHE_STALE,
    )) as BoardOfficialStatusPage | null;
  } catch {
    // The overlay is optional. A transient upstream failure must not take
    // down the identity-only board that already worked before this endpoint.
    return [];
  }
  if (!doc || !Array.isArray(doc.statuses)) return [];
  return doc.statuses.filter((status): status is BoardOfficialStatus =>
    Boolean(
      status &&
      typeof status.name === "string" &&
      typeof status.area === "string" &&
      typeof status.category === "string" &&
      ["open", "limited", "closed"].includes(status.status) &&
      typeof status.sourceUrl === "string" &&
      /^https:\/\/[^\s]+$/i.test(status.sourceUrl) &&
      ["fresh", "stale"].includes(status.freshness) &&
      (status.lat === null || (typeof status.lat === "number" && Number.isFinite(status.lat))) &&
      (status.lng === null || (typeof status.lng === "number" && Number.isFinite(status.lng))),
    ),
  );
}
