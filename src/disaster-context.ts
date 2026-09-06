import type { BoardMeta } from "./types.ts";

export const NOTO_HEAVY_RAIN_DISASTER = {
  id: "r8-ishikawa-noto-heavy-rain-20260827",
  label: "令和8年8月27日からの大雨（石川県能登）",
} as const;

export const NOTO_HEAVY_RAIN_REGION_ID = "ishikawa-noto-heavy-rain";

export const FUKUI_HEAVY_RAIN_DISASTER = {
  id: "r8-fukui-heavy-rain-20260829",
  label: "令和8年8月福井大雨",
} as const;

export const FUKUI_HEAVY_RAIN_REGION_ID = "fukui-heavy-rain";

const NOTO_READ_ONLY_AREA_SLUGS = new Set([
  "hakui",
  "shika",
  "hodatsushimizu",
  "nakanoto",
]);

const FUKUI_HEAVY_RAIN_AREA_SLUGS = new Set([
  "fukui",
  "ono",
  "katsuyama",
  "awara",
  "sakai",
  "eiheiji",
]);

const DISASTER_BY_ID: Record<string, { id: string; label: string }> = {
  [FUKUI_HEAVY_RAIN_DISASTER.id]: FUKUI_HEAVY_RAIN_DISASTER,
  "r8-kumamoto-earthquake": { id: "r8-kumamoto-earthquake", label: "令和8年熊本地震" },
};

export function isNotoReadOnlyArea(areaSlug: string | null | undefined): boolean {
  return NOTO_READ_ONLY_AREA_SLUGS.has(String(areaSlug || "").trim().toLowerCase());
}

export function hasNotoReadOnlyArea(meta: BoardMeta): boolean {
  return meta.areas.some((area) => isNotoReadOnlyArea(area.slug));
}

function disasterForAreaSlug(meta: BoardMeta, areaSlug: string): { id: string; label: string } | null {
  if (isNotoReadOnlyArea(areaSlug)) return NOTO_HEAVY_RAIN_DISASTER;
  const area = meta.areas.find((item) => item.slug === areaSlug);
  const byId = area?.disasterId ? DISASTER_BY_ID[area.disasterId] : undefined;
  if (byId) return byId;
  if (area?.region?.id === FUKUI_HEAVY_RAIN_REGION_ID || FUKUI_HEAVY_RAIN_AREA_SLUGS.has(areaSlug)) {
    return FUKUI_HEAVY_RAIN_DISASTER;
  }
  return null;
}

/**
 * OpenNavi currently exposes one top-level disaster label while its place
 * ledger contains multiple regional activations. Keep the shared ledger, but
 * give each regional activation its own disaster identity at every public output.
 */
export function boardMetaForArea(meta: BoardMeta, areaSlug: string): BoardMeta {
  const disaster = disasterForAreaSlug(meta, areaSlug);
  if (!disaster || disaster.id === meta.disaster.id) return meta;
  return {
    ...meta,
    disaster: { id: disaster.id, label: disaster.label },
  };
}
