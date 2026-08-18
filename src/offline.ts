import { googleMapsSearchUrl } from "./maps.ts";
import type { BoardMeta, BoardOfficialStatus, BoardPlace, PlaceSummary, Report, Verdict } from "./types.ts";

export const OFFLINE_SNAPSHOT_SCHEMA = "saigaiban.offline/v1" as const;
export const OFFLINE_SNAPSHOT_MAX_BYTES = 2 * 1024 * 1024;
export const OFFLINE_SNAPSHOT_MAX_PLACES = 500;

export type OfflineSnapshotReport = {
  id: string;
  verdict: Verdict;
  createdAt: string;
  role: Report["role"];
  preferMaps: boolean;
  evidence: Report["evidence"] | null;
};

export type OfflineSnapshotPlace = {
  id: string;
  name: string;
  area: string;
  category: string;
  address: string | null;
  source: string | null;
  dataBasisDate: string | null;
  mapsUrl: string;
  reportCount: number;
  latestReport: OfflineSnapshotReport | null;
};

export type OfflineSnapshotOfficialStatus = {
  name: string;
  area: string;
  category: string;
  status: BoardOfficialStatus["status"];
  headline: string | null;
  sourceUrl: string;
  checkedAt: string;
  freshness: BoardOfficialStatus["freshness"];
};

export type OfflineReportRevision = {
  latestCreatedAt: string | null;
  latestModeratedAt: string | null;
};

export type OfflineSnapshot = {
  schema: typeof OFFLINE_SNAPSHOT_SCHEMA;
  capturedAt: string;
  upstreamGeneratedAt: string | null;
  source: { site: string; origin: string };
  disaster: BoardMeta["disaster"];
  area: { slug: string; nameJa: string };
  reportRevision: OfflineReportRevision;
  places: OfflineSnapshotPlace[];
  officialStatuses: OfflineSnapshotOfficialStatus[];
  byteLength: number;
};

export class OfflineSnapshotError extends Error {
  readonly code: "too_large" | "invalid";

  constructor(code: "too_large" | "invalid", message: string) {
    super(message);
    this.code = code;
    this.name = "OfflineSnapshotError";
  }
}

function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function projectReport(report: Report | null): OfflineSnapshotReport | null {
  if (!report) return null;
  return {
    id: report.id,
    verdict: report.verdict,
    createdAt: report.created_at,
    role: report.role,
    preferMaps: report.prefer_maps,
    evidence: report.evidence || null,
  };
}

function publicHttpsUrl(value: string): string | null {
  return /^https:\/\/[^\s<>]+$/i.test(value) ? value : null;
}

export function buildOfflineSnapshot(input: {
  site: string;
  origin: string;
  meta: BoardMeta;
  area: BoardMeta["areas"][number];
  places: BoardPlace[];
  summaries: Map<string, PlaceSummary>;
  officialStatuses?: BoardOfficialStatus[];
  reportRevision?: OfflineReportRevision;
  upstreamGeneratedAt?: string | null;
  capturedAt?: string;
}): OfflineSnapshot {
  const capturedAt = input.capturedAt || new Date().toISOString();
  const places = input.places.map((place) => {
    const summary = input.summaries.get(place.id);
    return {
      id: place.id,
      name: place.name,
      area: place.area,
      category: place.category,
      address: place.address,
      source: publicHttpsUrl(String(place.source || "")),
      dataBasisDate: place.data_basis_date,
      mapsUrl: googleMapsSearchUrl(place.name, input.area.nameJa, place.address),
      reportCount: summary?.count || 0,
      latestReport: projectReport(summary?.latest || null),
    } satisfies OfflineSnapshotPlace;
  });
  const officialStatuses = (input.officialStatuses || []).flatMap((status) => {
    const sourceUrl = publicHttpsUrl(status.sourceUrl);
    if (!sourceUrl) return [];
    return [{
      name: status.name,
      area: status.area,
      category: status.category,
      status: status.status,
      headline: status.headline,
      sourceUrl,
      checkedAt: status.checkedAt,
      freshness: status.freshness,
    } satisfies OfflineSnapshotOfficialStatus];
  });
  const base = {
    schema: OFFLINE_SNAPSHOT_SCHEMA,
    capturedAt,
    upstreamGeneratedAt: input.upstreamGeneratedAt || null,
    source: { site: input.site.replace(/\/+$/, ""), origin: input.origin.replace(/\/+$/, "") },
    disaster: input.meta.disaster,
    area: { slug: input.area.slug, nameJa: input.area.nameJa },
    reportRevision: input.reportRevision || { latestCreatedAt: null, latestModeratedAt: null },
    places,
    officialStatuses,
  };
  const snapshot = { ...base, byteLength: jsonByteLength(base) };
  assertOfflineSnapshotSize(snapshot);
  return snapshot;
}

export function assertOfflineSnapshotSize(snapshot: OfflineSnapshot, maxBytes = OFFLINE_SNAPSHOT_MAX_BYTES): void {
  if (snapshot.places.length > OFFLINE_SNAPSHOT_MAX_PLACES) {
    throw new OfflineSnapshotError("too_large", `保存対象が多すぎます（${OFFLINE_SNAPSHOT_MAX_PLACES}件まで）`);
  }
  if (!Number.isFinite(snapshot.byteLength) || snapshot.byteLength > maxBytes) {
    throw new OfflineSnapshotError("too_large", `保存データが大きすぎます（${snapshot.byteLength} bytes）`);
  }
}

export function offlineSnapshotHasRawModerationFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const forbidden = new Set(["moderation_status", "review_status", "owner_uid", "ownerUid", "token", "authorization", "note"]);
  const walk = (item: unknown): boolean => {
    if (!item || typeof item !== "object") return false;
    if (Array.isArray(item)) return item.some(walk);
    return Object.entries(item as Record<string, unknown>).some(([key, child]) => forbidden.has(key) || walk(child));
  };
  return walk(value);
}
