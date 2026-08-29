import type { BoardMeta } from "./types.ts";

export const NOTO_HEAVY_RAIN_DISASTER = {
  id: "r8-ishikawa-noto-heavy-rain-20260827",
  label: "令和8年8月27日からの大雨（石川県能登）",
} as const;

export const NOTO_HEAVY_RAIN_REGION_ID = "ishikawa-noto-heavy-rain";

const NOTO_READ_ONLY_AREA_SLUGS = new Set([
  "hakui",
  "shika",
  "hodatsushimizu",
  "nakanoto",
]);

export function isNotoReadOnlyArea(areaSlug: string | null | undefined): boolean {
  return NOTO_READ_ONLY_AREA_SLUGS.has(String(areaSlug || "").trim().toLowerCase());
}

export function hasNotoReadOnlyArea(meta: BoardMeta): boolean {
  return meta.areas.some((area) => isNotoReadOnlyArea(area.slug));
}

/**
 * OpenNavi currently exposes one top-level disaster label while its place
 * ledger contains multiple regional activations. Keep the shared ledger, but
 * give the Noto activation its own disaster identity at every public output.
 */
export function boardMetaForArea(meta: BoardMeta, areaSlug: string): BoardMeta {
  if (!isNotoReadOnlyArea(areaSlug)) return meta;
  return {
    ...meta,
    disaster: { ...NOTO_HEAVY_RAIN_DISASTER },
  };
}
