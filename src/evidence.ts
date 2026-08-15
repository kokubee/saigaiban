export type EvidenceAuthority = "official" | "resident" | "operator" | "reference";
export type EvidenceReview = "confirmed" | "unreviewed" | "disputed" | "unknown";
export type EvidenceFreshness = "fresh" | "stale" | "expired" | "unknown";

export type EvidenceProjection = {
  authority: EvidenceAuthority;
  review: EvidenceReview;
  freshness: EvidenceFreshness;
};

const FRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

export function freshnessFor(iso: string, now = Date.now()): EvidenceFreshness {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "unknown";
  const age = now - at;
  if (!Number.isFinite(age) || age < 0) return "unknown";
  if (age <= FRESH_AFTER_MS) return "fresh";
  if (age <= STALE_AFTER_MS) return "stale";
  return "expired";
}

export function reportEvidence(
  createdAt: string,
  role: "visitor" | "owner",
  now = Date.now(),
): EvidenceProjection {
  return {
    authority: role === "owner" ? "operator" : "resident",
    review: "unknown",
    freshness: freshnessFor(createdAt, now),
  };
}

export function evidenceLabel(evidence: EvidenceProjection): string {
  const authority =
    evidence.authority === "official"
      ? "公式情報"
      : evidence.authority === "operator"
        ? "店側の自己申告"
        : evidence.authority === "resident"
          ? "住民報告"
          : "参照情報";
  const review = evidence.review === "confirmed" ? "確認済み" : evidence.review === "disputed" ? "相反あり" : "未確認";
  const freshness = evidence.freshness === "stale"
    ? "・古い可能性あり"
    : evidence.freshness === "expired"
      ? "・期限切れ・古い可能性あり"
      : evidence.freshness === "unknown"
        ? "・鮮度不明"
        : "";
  return `${authority}・${review}${freshness}`;
}
