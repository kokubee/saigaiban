import {
  renderAbout,
  renderHome,
  renderLegal,
  renderLlms,
  renderNotFound,
  renderOfflineShell,
  renderPlace,
  renderProtocol,
  renderRobots,
  renderSitemap,
  renderTown,
} from "./html.ts";
import {
  fetchMeta,
  fetchOfficialStatuses,
  fetchPlaceById,
  fetchPlaces,
  kumamotoResidentSupportUrl,
  officialSupportUrl,
  officialVictimUrl,
  opennaviOrigin,
} from "./opennavi.ts";
import {
  allowedOrigin,
  cleanNote,
  flagReport,
  insertReport,
  latestByPlaces,
  listReports,
  moderateReport,
  parseFlagReason,
  parseModerationAction,
  resolvePost,
} from "./reports.ts";
import { isKnownCategoryFromTaxonomy, isKnownPlaceFlag, isShopLike } from "./labels.ts";
import { publicPostingAreas, publicPostingEnabledForArea } from "./posting.ts";
import { purgeExpiredIpHashes, rateLimitConfigured, shortIpHmac } from "./rate-limit.ts";
import { adminRequestHeadersAllowed, reportRequestHeadersAllowed } from "./request.ts";
import { turnstileConfigured, turnstileHostnames, verifyTurnstile } from "./turnstile.ts";
import { listSupportEvents, publicSupportEventsEnabled } from "./support-events.ts";
import { buildHandoffDocument } from "./handoff.ts";
import { buildProtocolDiscoveryDocument } from "./protocol.ts";
import { buildOfflineSnapshot, OFFLINE_SNAPSHOT_MAX_PLACES, OfflineSnapshotError, type OfflineReportRevision } from "./offline.ts";
import { PWA_ICON_PATH, PWA_MANIFEST_PATH, PWA_OFFLINE_CLIENT_SCRIPT_PATH, PWA_OFFLINE_SAVE_SCRIPT_PATH, PWA_OFFLINE_SHELL_PATH, PWA_SERVICE_WORKER_PATH, renderManifest, renderOfflineClient, renderOfflineSaveClient, renderPwaIcon, renderServiceWorker } from "./pwa.ts";
import type { BoardPlace, Env, PlaceSummary } from "./types.ts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = opennaviOrigin(env.OPENNAVI_ORIGIN);
    const site = String(env.SITE_ORIGIN || "https://saigaiban.com").replace(/\/+$/, "");
    const measurementId = String(env.GA4_MEASUREMENT_ID || "").trim();
    const turnstileSiteKey = String(env.PUBLIC_TURNSTILE_SITE_KEY || "").trim();
    const turnstileAllowedHostnames = turnstileHostnames(env.PUBLIC_TURNSTILE_HOSTNAMES);
    const turnstileReady = turnstileConfigured(env.TURNSTILE_SECRET_KEY, turnstileSiteKey, turnstileAllowedHostnames);
    const postingAreas = publicPostingAreas(env.PUBLIC_POSTING_AREAS);
    const postingSecurityReady = turnstileReady && rateLimitConfigured(env.RATE_LIMIT_HMAC_SECRET);
    const postingEnabledForArea = (areaSlug: string): boolean =>
      postingSecurityReady && publicPostingEnabledForArea(env.PUBLIC_POSTING_MODE, areaSlug, postingAreas);
    const reportingEnabled = rateLimitConfigured(env.RATE_LIMIT_HMAC_SECRET);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const protocolHandoffPath = path.match(/^\/api\/opennavi\/v1\/handoff\/([a-z0-9-]+)$/i);
    const legacyHandoffPath = path.match(/^\/api\/handoff\/([a-z0-9-]+)$/i);
    const handoffPath = protocolHandoffPath || legacyHandoffPath;

    try {
      if (path === "/robots.txt") {
        return text(renderRobots(site), "text/plain; charset=utf-8");
      }
      if (path === PWA_MANIFEST_PATH) {
        return asset(renderManifest(site), "application/manifest+json; charset=utf-8", "public, max-age=300");
      }
      if (path === PWA_SERVICE_WORKER_PATH) {
        return asset(renderServiceWorker(), "application/javascript; charset=utf-8", "no-cache");
      }
      if (path === PWA_OFFLINE_SHELL_PATH) {
        return html(renderOfflineShell(site), 200, "public, max-age=31536000, immutable");
      }
      if (path === PWA_OFFLINE_CLIENT_SCRIPT_PATH) {
        return asset(renderOfflineClient(), "application/javascript; charset=utf-8", "public, max-age=31536000, immutable");
      }
      if (path === PWA_OFFLINE_SAVE_SCRIPT_PATH) {
        return asset(renderOfflineSaveClient(), "application/javascript; charset=utf-8", "public, max-age=31536000, immutable");
      }
      if (path === PWA_ICON_PATH) {
        return asset(renderPwaIcon(), "image/svg+xml; charset=utf-8", "public, max-age=31536000, immutable");
      }
      if (path === "/llms.txt") {
        return text(renderLlms(site, origin), "text/plain; charset=utf-8");
      }
      if (path === "/.well-known/opennavi.json") {
        return protocolJson(buildProtocolDiscoveryDocument(site, origin));
      }
      if (path === "/health") {
        return json({ ok: true });
      }
      if (path === "/legal" || path === "/terms" || path === "/privacy" || path === "/research") {
        return html(renderLegal(site, origin, path.slice(1) as "legal" | "terms" | "privacy" | "research", measurementId));
      }
      if (path === "/support" || path.startsWith("/support/tourism/")) {
        const destination = String(url.searchParams.get("destination") || url.searchParams.get("pref") || "").trim().toLowerCase();
        if (destination === "kumamoto" || destination === "43") {
          return Response.redirect(kumamotoResidentSupportUrl(), 302);
        }
        return Response.redirect(officialSupportUrl(origin), 302);
      }
      if (path === "/") {
        const pref = String(url.searchParams.get("pref") || "").trim().toLowerCase();
        if (pref === "kumamoto" || pref === "43") {
          return Response.redirect(kumamotoResidentSupportUrl(), 302);
        }
      }

      const flagPath = path.match(/^\/api\/reports\/([0-9a-f-]{8,})\/flag$/i);
      if (flagPath && request.method === "POST") {
        return handleFlag(request, env, site, flagPath[1]);
      }
      const moderationPath = path.match(/^\/api\/admin\/reports\/([0-9a-f-]{8,})\/moderate$/i);
      if (moderationPath && request.method === "POST") {
        return handleModeration(request, env, moderationPath[1]);
      }
      if (handoffPath && request.method === "OPTIONS") {
        return handoffOptions();
      }
      if (path === "/protocol" || path === "/protocol/opennavi/v1") {
        return html(renderProtocol(site, origin, measurementId));
      }

      const offlinePagePath = path.match(/^\/a\/([a-z0-9-]+)\/offline$/i);
      if (offlinePagePath) {
        if (request.method !== "GET") return html("<!doctype html><meta charset=\"utf-8\"><title>災害板</title><p>GETだけ利用できます。</p>", 405, "no-store");
        return html(renderOfflineShell(site), 200, "public, max-age=60");
      }

      const offlineSnapshotPath = path.match(/^\/api\/offline-snapshot\/([a-z0-9-]+)$/i);
      if (offlineSnapshotPath) {
        return handleOfflineSnapshot(request, env, site, origin, offlineSnapshotPath[1]);
      }
      const offlineRevisionPath = path.match(/^\/api\/offline-revision\/([a-z0-9-]+)$/i);
      if (offlineRevisionPath) {
        return handleOfflineRevision(request, env, origin, offlineRevisionPath[1]);
      }

      const earlyPlacePath = path.match(/^\/a\/([a-z0-9-]+)\/p\/([0-9a-f-]{8,})$/i);
      if (earlyPlacePath && request.method === "POST" && !postingEnabledForArea(earlyPlacePath[1])) {
        return redirect(site, `/a/${earlyPlacePath[1]}/p/${earlyPlacePath[2]}`, "現在は投稿受付を停止しています。公式ハブで確認してください。");
      }

      const meta = await fetchMeta(origin, env.PUBLIC_READ_CACHE);

      if (handoffPath) {
        return handleHandoff(request, env, site, origin, meta, handoffPath[1], url.searchParams.get("cursor"));
      }

      if (path === "/sitemap.xml") {
        return text(renderSitemap(site, meta.areas.map((a) => a.slug)), "application/xml; charset=utf-8");
      }
      if (path === "/about") {
        return html(renderAbout(site, origin, measurementId));
      }
      if (path === "/") {
        return html(renderHome(site, origin, meta, measurementId, url.searchParams.get("pref"), url.searchParams.get("region")));
      }

      const placePath = path.match(/^\/a\/([a-z0-9-]+)\/p\/([0-9a-f-]{8,})$/i);
      if (placePath) {
        const slug = placePath[1];
        const placeId = placePath[2];
        if (!meta.areas.some((a) => a.slug === slug)) return html(renderNotFound(site, measurementId), 404);
        const place = await fetchPlaceById(origin, placeId, env.PUBLIC_READ_CACHE);
        if (!place || place.area !== slug) return html(renderNotFound(site, measurementId), 404);

        if (request.method === "POST") {
          return handlePost(request, env, site, slug, place, postingEnabledForArea(slug), env.TURNSTILE_SECRET_KEY, turnstileAllowedHostnames);
        }
        const notice = url.searchParams.get("ok") === "1"
          ? "受け取りました。公式ではありません。地図と公式ハブも見てください。"
          : url.searchParams.get("flag") === "1"
            ? "通報を受け付けました。内容を確認します。"
            : url.searchParams.get("err");
        const reports = await listReports(env.DB, place.id);
        return html(renderPlace(site, origin, meta, slug, place, reports, notice, measurementId, postingEnabledForArea(slug), turnstileSiteKey, reportingEnabled), 200, "private, no-store");
      }

      const town = path.match(/^\/a\/([a-z0-9-]+)$/);
      if (town) {
        const slug = town[1];
        if (!meta.areas.some((a) => a.slug === slug)) return html(renderNotFound(site, measurementId), 404);
        const showAll = url.searchParams.get("all") === "1";
        const requestedCategory = String(url.searchParams.get("category") || "").trim();
        const selectedCategory = isKnownCategoryFromTaxonomy(requestedCategory, meta.taxonomy) ? requestedCategory : "";
        const requestedFlag = String(url.searchParams.get("flag") || "").trim();
        const selectedFlag = isKnownPlaceFlag(requestedFlag, meta.taxonomy) ? requestedFlag : "";
        const searchQuery = String(url.searchParams.get("q") || "").trim().slice(0, 40);
        const page = await fetchPlaces(origin, slug, {
          limit: showAll || selectedCategory || selectedFlag || searchQuery ? 200 : 80,
          ...(selectedCategory || selectedFlag ? { category: selectedCategory || "hinanjo" } : {}),
          ...(selectedFlag ? { flag: selectedFlag } : {}),
        }, env.PUBLIC_READ_CACHE);
        const [summaries, supportEvents, officialStatuses] = await Promise.all([
          latestByPlaces(env.DB, page.places.map((p) => p.id)),
          publicSupportEventsEnabled(env.PUBLIC_SUPPORT_EVENTS_MODE)
            ? listSupportEvents(env.DB, slug)
            : Promise.resolve({ available: false, events: [] }),
          fetchOfficialStatuses(origin, slug, selectedCategory || selectedFlag ? [selectedCategory || "hinanjo"] : [], env.PUBLIC_READ_CACHE),
        ]);
        return html(renderTown(site, origin, meta, slug, page.places, showAll, summaries, measurementId, postingEnabledForArea(slug), selectedCategory, searchQuery, supportEvents, officialStatuses, selectedFlag));
      }

      return html(renderNotFound(site, measurementId), 404);
    } catch {
      if (handoffPath) {
        return handoffJson({ ok: false, error: "引き継ぎデータを取得できません。" }, 502);
      }
      return html(
        `<!doctype html><meta charset="utf-8"><title>災害板</title><p>いま板を開けません。公式ハブを見てください。</p><p><a href="${officialVictimUrl(origin)}">OpenNavi（被災者向け）</a></p>`,
        502,
      );
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(purgeExpiredIpHashes(env.DB));
  },
};

async function handleOfflineSnapshot(
  request: Request,
  env: Env,
  site: string,
  origin: string,
  slug: string,
): Promise<Response> {
  if (request.method !== "GET") return offlineJson({ ok: false, error: "GETだけ利用できます。" }, 405);
  try {
    const meta = await fetchMeta(origin, env.PUBLIC_READ_CACHE);
    const area = meta.areas.find((candidate) => candidate.slug === slug);
    if (!area) return offlineJson({ ok: false, error: "地域が見つかりません。" }, 404);

    const placesById = new Map<string, BoardPlace>();
    let cursor: string | undefined;
    let upstreamGeneratedAt = "";
    for (let pageNumber = 0; pageNumber < 3; pageNumber += 1) {
      const page = await fetchPlaces(origin, slug, { limit: 200, ...(cursor ? { cursor } : {}) }, env.PUBLIC_READ_CACHE);
      upstreamGeneratedAt = page.generated_at || upstreamGeneratedAt;
      for (const place of page.places) placesById.set(place.id, place);
      if (placesById.size > OFFLINE_SNAPSHOT_MAX_PLACES) {
        return offlineJson({ ok: false, error: `保存対象が多すぎます（${OFFLINE_SNAPSHOT_MAX_PLACES}件まで）` }, 413);
      }
      if (!page.next_cursor) break;
      cursor = page.next_cursor;
      if (pageNumber === 2) return offlineJson({ ok: false, error: `保存対象が多すぎます（${OFFLINE_SNAPSHOT_MAX_PLACES}件まで）` }, 413);
    }

    const places = [...placesById.values()];
    const [summaries, officialStatuses, reportRevision] = await Promise.all([
      latestByPlacesInChunks(env.DB, places.map((place) => place.id)),
      fetchOfficialStatuses(origin, slug, [], env.PUBLIC_READ_CACHE),
      publicReportRevision(env.DB, slug),
    ]);
    const snapshot = buildOfflineSnapshot({
      site,
      origin,
      meta,
      area,
      places,
      summaries,
      officialStatuses,
      reportRevision,
      upstreamGeneratedAt: upstreamGeneratedAt || null,
    });
    return offlineJson(snapshot);
  } catch (error) {
    if (error instanceof OfflineSnapshotError) return offlineJson({ ok: false, error: error.message }, 413);
    return offlineJson({ ok: false, error: "保存データを取得できません。通信できるときにもう一度お試しください。" }, 502);
  }
}

async function handleOfflineRevision(request: Request, env: Env, origin: string, slug: string): Promise<Response> {
  if (request.method !== "GET") return offlineJson({ ok: false, error: "GETだけ利用できます。" }, 405);
  try {
    const meta = await fetchMeta(origin, env.PUBLIC_READ_CACHE);
    if (!meta.areas.some((area) => area.slug === slug)) return offlineJson({ ok: false, error: "地域が見つかりません。" }, 404);
    const page = await fetchPlaces(origin, slug, { limit: 1 }, env.PUBLIC_READ_CACHE);
    return offlineJson({
      schema: "saigaiban.offline-revision/v1",
      area: slug,
      upstreamGeneratedAt: page.generated_at || null,
      reportRevision: await publicReportRevision(env.DB, slug),
    });
  } catch {
    return offlineJson({ ok: false, error: "更新確認ができません。" }, 502);
  }
}

async function publicReportRevision(db: D1Database, area: string): Promise<OfflineReportRevision> {
  const row = await db.prepare(
    `SELECT MAX(created_at) AS latest_created_at, MAX(moderated_at) AS latest_moderated_at
       FROM reports WHERE area = ?`,
  ).bind(area).first<{ latest_created_at?: string | null; latest_moderated_at?: string | null }>();
  return {
    latestCreatedAt: row?.latest_created_at || null,
    latestModeratedAt: row?.latest_moderated_at || null,
  };
}

async function handleHandoff(
  request: Request,
  env: Env,
  site: string,
  origin: string,
  meta: Awaited<ReturnType<typeof fetchMeta>>,
  slug: string,
  rawCursor: string | null,
): Promise<Response> {
  if (request.method !== "GET") return handoffJson({ ok: false, error: "GETまたはOPTIONSだけ利用できます。" }, 405);
  const area = meta.areas.find((candidate) => candidate.slug === slug);
  if (!area) return handoffJson({ ok: false, error: "地域が見つかりません。" }, 404);
  try {
    const cursor = String(rawCursor || "").trim().slice(0, 256) || undefined;
    const page = await fetchPlaces(origin, slug, { limit: 200, ...(cursor ? { cursor } : {}) }, env.PUBLIC_READ_CACHE);
    const summaries = await latestByPlacesInChunks(env.DB, page.places.map((place) => place.id));
    return handoffJson(buildHandoffDocument(site, meta, area, page.places, summaries, page.generated_at || null, page.next_cursor || null));
  } catch {
    return handoffJson({ ok: false, error: "引き継ぎデータを取得できません。" }, 502);
  }
}

async function latestByPlacesInChunks(db: D1Database, placeIds: string[]): Promise<Map<string, PlaceSummary>> {
  const out = new Map<string, PlaceSummary>();
  for (let offset = 0; offset < placeIds.length; offset += 80) {
    const chunk = await latestByPlaces(db, placeIds.slice(offset, offset + 80));
    for (const [id, summary] of chunk) out.set(id, summary);
  }
  return out;
}

async function handlePost(
  request: Request,
  env: Env,
  site: string,
  slug: string,
  place: BoardPlace,
  postingEnabled: boolean,
  turnstileSecretKey?: string,
  turnstileAllowedHostnames: ReadonlySet<string> = new Set(["saigaiban.com", "www.saigaiban.com"]),
): Promise<Response> {
  const dest = `/a/${slug}/p/${place.id}`;
  if (request.method !== "POST") return Response.redirect(`${site}${dest}`, 303);
  if (!postingEnabled) {
    return redirect(site, dest, "現在は投稿受付を停止しています。公式ハブで確認してください。");
  }
  if (!allowedOrigin(request, site)) {
    return redirect(site, dest, "この画面から送ってください。");
  }
  if (!reportRequestHeadersAllowed(request)) {
    return redirect(site, dest, "投稿データの形式またはサイズが不正です。");
  }
  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  if (!ip) {
    return redirect(site, dest, "この接続では投稿を受け付けられません。");
  }
  const form = await request.formData();
  if (form.get("legal_consent") !== "on") {
    return redirect(site, dest, "利用規約とプライバシーポリシーへの同意が必要です。");
  }
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), turnstileSecretKey, ip, {
    action: "report_submit",
    allowedHostnames: turnstileAllowedHostnames,
  }))) {
    return redirect(site, dest, "確認に失敗しました。もう一度お試しください。");
  }
  const decided = resolvePost({
    roleRaw: form.get("role"),
    verdictRaw: form.get("verdict"),
    preferMapsRaw: form.get("prefer_maps"),
    hasMapsUrl: Boolean(place.name && slug),
    shopLike: isShopLike(place.category),
  });
  if (decided.error) return redirect(site, dest, decided.error);
  const cleaned = cleanNote(form.get("note"));
  if (cleaned.error) return redirect(site, dest, cleaned.error);
  const saved = await insertReport(env.DB, {
    placeId: place.id,
    area: slug,
    seedKey: place.seed_key,
    verdict: decided.verdict,
    note: cleaned.note,
    ipHash: (await shortIpHmac(ip, env.RATE_LIMIT_HMAC_SECRET)) || "",
    role: decided.role,
    preferMaps: decided.preferMaps,
    termsVersion: "2026-08-16",
    privacyVersion: "2026-08-16",
    consentedAt: new Date().toISOString(),
  });
  if (!saved.ok) return redirect(site, dest, saved.error);
  return Response.redirect(`${site}${dest}?ok=1`, 303);
}

async function handleFlag(request: Request, env: Env, site: string, reportId: string): Promise<Response> {
  const back = (message?: string): Response => {
    let target = new URL(site);
    try {
      const referer = request.headers.get("Referer");
      const candidate = referer ? new URL(referer) : null;
      if (candidate && candidate.origin === target.origin) target = candidate;
    } catch {
      // Use the site root for malformed or cross-origin referers.
    }
    target.searchParams.set(message ? "err" : "flag", message || "1");
    return Response.redirect(target.toString(), 303);
  };
  if (!allowedOrigin(request, site)) return back("この画面から送ってください。");
  if (!reportRequestHeadersAllowed(request)) return back("通報データの形式またはサイズが不正です。");
  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  if (!ip) return back("この接続では通報を受け付けられません。");
  const token = await shortIpHmac(ip, env.RATE_LIMIT_HMAC_SECRET);
  if (!token) return back("通報受付の準備ができていません。");
  const form = await request.formData();
  if (form.get("legal_consent") !== "on") return back("利用規約とプライバシーポリシーへの同意が必要です。");
  const reason = parseFlagReason(form.get("reason"));
  if (!reason) return back("通報理由を選んでください。");
  const result = await flagReport(env.DB, reportId, reason, token, {
    termsVersion: "2026-08-16",
    privacyVersion: "2026-08-16",
    consentedAt: new Date().toISOString(),
  });
  return result.ok ? back() : back(result.error);
}

async function handleModeration(request: Request, env: Env, reportId: string): Promise<Response> {
  if (!await secretMatches(request.headers.get("Authorization") || "", env.MODERATION_ADMIN_TOKEN || "")) {
    return json({ ok: false, error: "認証が必要です。" }, 401);
  }
  if (!adminRequestHeadersAllowed(request)) return json({ ok: false, error: "管理データの形式またはサイズが不正です。" }, 413);
  let body: { action?: unknown };
  try {
    body = await request.json() as { action?: unknown };
  } catch {
    return json({ ok: false, error: "JSONが不正です。" }, 400);
  }
  const action = parseModerationAction(body.action);
  if (!action) return json({ ok: false, error: "管理操作が不正です。" }, 400);
  const result = await moderateReport(env.DB, reportId, action, "moderator");
  return result.ok ? json({ ok: true }, 200) : json(result, 404);
}

async function secretMatches(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const prefix = "Bearer ";
  if (!provided.startsWith(prefix)) return false;
  const actual = provided.slice(prefix.length);
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(actual)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let diff = actual.length === expected.length ? 0 : 1;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function redirect(site: string, dest: string, err: string): Response {
  const u = new URL(dest, site);
  u.searchParams.set("err", err);
  return Response.redirect(u.toString(), 303);
}

function html(body: string, status = 200, cache = status >= 500 ? "no-store" : "public, max-age=60"): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cache,
    },
  });
}

function asset(body: string, type: string, cache: string): Response {
  return new Response(body, { headers: { "content-type": type, "cache-control": cache, "x-content-type-options": "nosniff" } });
}

function text(body: string, type: string): Response {
  return new Response(body, {
    headers: { "content-type": type, "cache-control": "public, max-age=300" },
  });
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function offlineJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function protocolJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}

function handoffOptions(): Response {
  return new Response(null, { status: 204, headers: handoffHeaders() });
}

function handoffJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: handoffHeaders(status),
  });
}

function handoffHeaders(status = 200): HeadersInit {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": status >= 500 ? "no-store" : "public, max-age=60, stale-while-revalidate=300",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "x-content-type-options": "nosniff",
  };
}
