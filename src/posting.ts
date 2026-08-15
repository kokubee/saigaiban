export type PublicPostingMode = "off" | "on";

const AREA_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeAreaSlug(raw?: string): string | null {
  const slug = String(raw || "").trim().toLowerCase();
  return AREA_SLUG_PATTERN.test(slug) ? slug : null;
}

/**
 * Public report intake is deliberately closed unless the deployment opts in.
 * Any missing, malformed, or unexpected value remains closed.
 */
export function publicPostingMode(raw?: string): PublicPostingMode {
  return String(raw || "").trim().toLowerCase() === "on" ? "on" : "off";
}

export function publicPostingEnabled(raw?: string): boolean {
  return publicPostingMode(raw) === "on";
}

/**
 * Parse the explicit disaster-area allowlist. Invalid or empty entries are
 * ignored so a typo can never widen the posting surface.
 */
export function publicPostingAreas(raw?: string): ReadonlySet<string> {
  const areas = new Set<string>();
  for (const entry of String(raw || "").split(",")) {
    const slug = normalizeAreaSlug(entry);
    if (slug) areas.add(slug);
  }
  return areas;
}

/**
 * Posting is opt-in twice: global mode must be on and the requested area must
 * be present in the explicit allowlist. An absent allowlist therefore stays
 * fail-closed even if someone accidentally sets PUBLIC_POSTING_MODE=on.
 */
export function publicPostingEnabledForArea(
  rawMode: string | undefined,
  areaSlug: string | undefined,
  allowedAreas: ReadonlySet<string>,
): boolean {
  if (!publicPostingEnabled(rawMode)) return false;
  const normalized = normalizeAreaSlug(areaSlug);
  return Boolean(normalized && allowedAreas.has(normalized));
}
