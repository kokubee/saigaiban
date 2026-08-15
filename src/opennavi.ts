import type { BoardMeta, BoardPlace, BoardPlacesPage } from "./types.ts";
import { getCachedJson, publicCacheMode, type PublicCacheMode } from "./cache.ts";
import { normalizePlaceCategory } from "./labels.ts";

export const DEFAULT_OPENNAVI = "https://opennavi.org";

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
  return {
    id,
    seed_key: String(p.seed_key || ""),
    name,
    area,
    category: normalizePlaceCategory(String(p.category || ""), name),
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

export async function fetchPlaceById(origin: string, id: string, publicReadCache?: string): Promise<BoardPlace | null> {
  const doc = await getCachedJson(
    `${opennaviOrigin(origin)}/api/board/places/${encodeURIComponent(id)}`,
    cacheMode(publicReadCache),
    OPENNAVI_CACHE_TTL,
    OPENNAVI_CACHE_STALE,
  );
  if (!doc || typeof doc !== "object") return null;
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
  if (!doc?.disaster?.id || !Array.isArray(doc.areas)) throw new Error("invalid board meta");
  return {
    disaster: { id: String(doc.disaster.id), label: String(doc.disaster.label || "") },
    areas: doc.areas
      .filter((a) => a && a.status === "active" && a.slug)
      .map((a) => ({
        slug: String(a.slug),
        nameJa: String(a.nameJa || a.slug),
        prefCode: String(a.prefCode || ""),
        status: "active",
      })),
    placeLicense: doc.placeLicense,
  };
}

export async function fetchPlaces(
  origin: string,
  area: string,
  opts: { category?: string; cursor?: string; limit?: number } = {},
  publicReadCache?: string,
): Promise<BoardPlacesPage> {
  const qs = new URLSearchParams();
  qs.set("area", area);
  qs.set("limit", String(Math.min(Math.max(opts.limit ?? 80, 1), 200)));
  if (opts.category) qs.set("category", opts.category);
  if (opts.cursor) qs.set("cursor", opts.cursor);
  const doc = (await getCachedJson(
    `${opennaviOrigin(origin)}/api/board/places?${qs}`,
    cacheMode(publicReadCache),
    OPENNAVI_CACHE_TTL,
    OPENNAVI_CACHE_STALE,
  )) as BoardPlacesPage | null;
  const places = (doc?.places || []).map(stripPlace).filter((p): p is BoardPlace => Boolean(p));
  return {
    disaster_id: String(doc?.disaster_id || ""),
    generated_at: String(doc?.generated_at || ""),
    next_cursor: doc?.next_cursor || null,
    places,
  };
}
