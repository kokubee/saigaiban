import {
  renderAbout,
  renderHome,
  renderNotFound,
  renderPlace,
  renderRobots,
  renderSitemap,
  renderTown,
} from "./html.ts";
import { fetchMeta, fetchPlaceById, fetchPlaces, officialSupportUrl, opennaviOrigin } from "./opennavi.ts";
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
import { isKnownCategory, isShopLike } from "./labels.ts";
import { publicPostingEnabled } from "./posting.ts";
import { purgeExpiredIpHashes, rateLimitConfigured, shortIpHmac } from "./rate-limit.ts";
import { adminRequestHeadersAllowed, reportRequestHeadersAllowed } from "./request.ts";
import { turnstileConfigured, turnstileHostnames, verifyTurnstile } from "./turnstile.ts";
import type { BoardPlace, Env } from "./types.ts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = opennaviOrigin(env.OPENNAVI_ORIGIN);
    const site = String(env.SITE_ORIGIN || "https://saigaiban.com").replace(/\/+$/, "");
    const measurementId = String(env.GA4_MEASUREMENT_ID || "").trim();
    const turnstileSiteKey = String(env.PUBLIC_TURNSTILE_SITE_KEY || "").trim();
    const turnstileAllowedHostnames = turnstileHostnames(env.PUBLIC_TURNSTILE_HOSTNAMES);
    const turnstileReady = turnstileConfigured(env.TURNSTILE_SECRET_KEY, turnstileSiteKey, turnstileAllowedHostnames);
    const postingEnabled = publicPostingEnabled(env.PUBLIC_POSTING_MODE) && turnstileReady && rateLimitConfigured(env.RATE_LIMIT_HMAC_SECRET);
    const reportingEnabled = rateLimitConfigured(env.RATE_LIMIT_HMAC_SECRET);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/robots.txt") {
        return text(renderRobots(site), "text/plain; charset=utf-8");
      }
      if (path === "/health") {
        return json({ ok: true });
      }
      if (path === "/support" || path.startsWith("/support/tourism/")) {
        return Response.redirect(officialSupportUrl(origin), 302);
      }

      const flagPath = path.match(/^\/api\/reports\/([0-9a-f-]{8,})\/flag$/i);
      if (flagPath && request.method === "POST") {
        return handleFlag(request, env, site, flagPath[1]);
      }
      const moderationPath = path.match(/^\/api\/admin\/reports\/([0-9a-f-]{8,})\/moderate$/i);
      if (moderationPath && request.method === "POST") {
        return handleModeration(request, env, moderationPath[1]);
      }

      const earlyPlacePath = path.match(/^\/a\/([a-z0-9-]+)\/p\/([0-9a-f-]{8,})$/i);
      if (earlyPlacePath && request.method === "POST" && !postingEnabled) {
        return redirect(site, `/a/${earlyPlacePath[1]}/p/${earlyPlacePath[2]}`, "現在は投稿受付を停止しています。公式ハブで確認してください。");
      }

      const meta = await fetchMeta(origin, env.PUBLIC_READ_CACHE);

      if (path === "/sitemap.xml") {
        return text(renderSitemap(site, meta.areas.map((a) => a.slug)), "application/xml; charset=utf-8");
      }
      if (path === "/about") {
        return html(renderAbout(site, origin, measurementId));
      }
      if (path === "/") {
        return html(renderHome(site, origin, meta, measurementId, url.searchParams.get("pref")));
      }

      const placePath = path.match(/^\/a\/([a-z0-9-]+)\/p\/([0-9a-f-]{8,})$/i);
      if (placePath) {
        const slug = placePath[1];
        const placeId = placePath[2];
        if (!meta.areas.some((a) => a.slug === slug)) return html(renderNotFound(site, measurementId), 404);
        const place = await fetchPlaceById(origin, placeId, env.PUBLIC_READ_CACHE);
        if (!place || place.area !== slug) return html(renderNotFound(site, measurementId), 404);

        if (request.method === "POST") {
          return handlePost(request, env, site, slug, place, postingEnabled, env.TURNSTILE_SECRET_KEY, turnstileAllowedHostnames);
        }
        const notice = url.searchParams.get("ok") === "1"
          ? "受け取りました。公式ではありません。地図と公式ハブも見てください。"
          : url.searchParams.get("flag") === "1"
            ? "通報を受け付けました。内容を確認します。"
            : url.searchParams.get("err");
        const reports = await listReports(env.DB, place.id);
        return html(renderPlace(site, origin, meta, slug, place, reports, notice, measurementId, postingEnabled, turnstileSiteKey, reportingEnabled), 200, "private, no-store");
      }

      const town = path.match(/^\/a\/([a-z0-9-]+)$/);
      if (town) {
        const slug = town[1];
        if (!meta.areas.some((a) => a.slug === slug)) return html(renderNotFound(site, measurementId), 404);
        const showAll = url.searchParams.get("all") === "1";
        const requestedCategory = String(url.searchParams.get("category") || "").trim();
        const selectedCategory = isKnownCategory(requestedCategory) ? requestedCategory : "";
        const searchQuery = String(url.searchParams.get("q") || "").trim().slice(0, 40);
        const page = await fetchPlaces(origin, slug, {
          limit: showAll || selectedCategory || searchQuery ? 200 : 80,
          ...(selectedCategory ? { category: selectedCategory } : {}),
        }, env.PUBLIC_READ_CACHE);
        const summaries = await latestByPlaces(env.DB, page.places.map((p) => p.id));
        return html(renderTown(site, origin, meta, slug, page.places, showAll, summaries, measurementId, postingEnabled, selectedCategory, searchQuery));
      }

      return html(renderNotFound(site, measurementId), 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "error";
      return html(
        `<!doctype html><meta charset="utf-8"><title>災害板</title><p>いま板を開けません。公式ハブを見てください。</p><p><a href="${origin}">OpenNavi</a></p><!-- ${message.replace(/</g, "")} -->`,
        502,
      );
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(purgeExpiredIpHashes(env.DB));
  },
};

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
  const reason = parseFlagReason(form.get("reason"));
  if (!reason) return back("通報理由を選んでください。");
  const result = await flagReport(env.DB, reportId, reason, token);
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

function html(body: string, status = 200, cache = "public, max-age=60"): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cache,
    },
  });
}

function text(body: string, type: string): Response {
  return new Response(body, {
    headers: { "content-type": type, "cache-control": "public, max-age=300" },
  });
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
