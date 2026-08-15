/**
 * Build a human-readable Google Maps search URL.
 *
 * The OpenNavi ledger may contain a coordinate-based URL.  The disaster board
 * deliberately does not reuse it: a name + municipality query is easier for
 * Google Maps to resolve to the same named facility and remains useful when
 * coordinates move or are rounded.
 */
export function googleMapsSearchUrl(
  placeName: string,
  areaName: string,
  address?: string | null,
): string {
  const query = [placeName, areaName, address]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
