export type UpstreamFreshness = "fresh" | "stale" | "expired" | "unknown";

const FRESH_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 72 * 60 * 60 * 1000;

/** Classify the age of an OpenNavi-generated response without implying current status. */
export function upstreamFreshnessFor(iso: string | null | undefined, now = Date.now()): UpstreamFreshness {
  const generated = Date.parse(String(iso || ""));
  if (!Number.isFinite(generated) || generated > now) return "unknown";
  const age = now - generated;
  if (age <= FRESH_MS) return "fresh";
  if (age <= STALE_MS) return "stale";
  return "expired";
}

export function upstreamFreshnessLabel(value: UpstreamFreshness): string {
  if (value === "fresh") return "24時間以内に取得";
  if (value === "stale") return "24時間超・要再確認";
  if (value === "expired") return "72時間超・古い可能性あり";
  return "更新時刻不明";
}

export function formatUpstreamGeneratedAt(iso: string | null | undefined): string {
  const timestamp = Date.parse(String(iso || ""));
  if (!Number.isFinite(timestamp)) return "不明";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
