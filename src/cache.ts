export type PublicCacheMode = "off" | "shadow" | "on";

function defaultCache(): Cache | null {
  try {
    if (typeof caches === "undefined") return null;
    return (caches as unknown as { default?: Cache }).default || null;
  } catch {
    return null;
  }
}

function cacheKey(url: string): Request {
  // Keep the key inside this Worker’s zone. OpenNavi is a separate Cloudflare
  // zone, and a Worker must not rely on being able to mutate another zone’s
  // cache namespace.
  const key = new URL("https://saigaiban.com/__edge-cache/opennavi");
  key.searchParams.set("url", url);
  return new Request(key, { method: "GET" });
}

export function publicCacheMode(raw?: string): PublicCacheMode {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "on" || value === "shadow") return value;
  return "off";
}

/** Fetch a public JSON dependency through the per-site edge cache when enabled. */
export async function getCachedJson(
  url: string,
  mode: PublicCacheMode,
  maxAgeSeconds: number,
  staleWhileRevalidateSeconds: number,
): Promise<unknown> {
  const cache = defaultCache();
  const key = cacheKey(url);

  if (cache && mode === "on") {
    const hit = await cache.match(key);
    if (hit) return hit.json();
  }

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "saigaiban/0.1 (+https://saigaiban.com)" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`opennavi ${res.status} ${url}`);

  const body = await res.text();
  if (cache && mode === "on") {
    // The header is useful to downstream HTTP caches; Cache API match/put
    // itself does not implement stale-while-revalidate.
    const headers = new Headers({
      "Content-Type": res.headers.get("Content-Type") || "application/json",
      "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
    });
    try {
      await cache.put(key, new Response(body, { status: 200, headers }));
    } catch {
      // Cache failure must never turn a valid upstream response into a 5xx.
    }
  }
  return JSON.parse(body) as unknown;
}
