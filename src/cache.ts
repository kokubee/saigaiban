export type PublicCacheMode = "off" | "shadow" | "on";
const OPENNAVI_FETCH_TIMEOUT_MS = 5_000;
const MAX_OPENNAVI_JSON_BYTES = 1_000_000;

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
  let shadowHit: Response | null = null;

  if (cache && mode === "on") {
    const hit = await cache.match(key);
    if (hit) {
      try {
        return await hit.json();
      } catch {
        // Ignore malformed cache entries and fall back to origin.
      }
    }
  }
  if (cache && mode === "shadow") {
    shadowHit = (await cache.match(key)) || null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENNAVI_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "saigaiban/0.1 (+https://saigaiban.com)" },
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`opennavi ${res.status} ${url}`);

    const declaredLength = Number(res.headers.get("content-length") || "0");
    if (declaredLength > MAX_OPENNAVI_JSON_BYTES) throw new Error(`opennavi response too large ${url}`);
    const body = await readBoundedText(res, MAX_OPENNAVI_JSON_BYTES);
    if (cache && mode === "shadow" && shadowHit) {
      try {
        const cachedBody = await shadowHit.text();
        console.log(JSON.stringify({ event: "opennavi_cache_shadow_compare", same: cachedBody === body }));
      } catch {
        console.log(JSON.stringify({ event: "opennavi_cache_shadow_compare", same: false }));
      }
    }
    if (cache && (mode === "on" || mode === "shadow")) {
      // The header is useful to downstream HTTP caches; Cache API match/put
      // itself does not implement stale-while-revalidate.
      const headers = new Headers({
        "Content-Type": res.headers.get("Content-Type") || "application/json",
        ...(res.headers.get("ETag") ? { ETag: res.headers.get("ETag") as string } : {}),
        ...(res.headers.get("Last-Modified") ? { "Last-Modified": res.headers.get("Last-Modified") as string } : {}),
        "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
      });
      try {
        await cache.put(key, new Response(body, { status: 200, headers }));
      } catch {
        // Cache failure must never turn a valid upstream response into a 5xx.
      }
    }
    return JSON.parse(body) as unknown;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("response too large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
