import {
  renderAbout,
  renderHome,
  renderNotFound,
  renderPlace,
  renderRobots,
  renderSitemap,
  renderTown,
} from "./html.ts";
import { fetchMeta, fetchPlaceById, fetchPlaces, opennaviOrigin } from "./opennavi.ts";
import {
  allowedOrigin,
  cleanNote,
  hashIp,
  insertReport,
  latestByPlaces,
  listReports,
  parseVerdict,
} from "./reports.ts";
import type { BoardPlace, Env } from "./types.ts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = opennaviOrigin(env.OPENNAVI_ORIGIN);
    const site = String(env.SITE_ORIGIN || "https://saigaiban.com").replace(/\/+$/, "");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/robots.txt") {
        return text(renderRobots(site), "text/plain; charset=utf-8");
      }
      if (path === "/health") {
        return json({ ok: true });
      }

      const meta = await fetchMeta(origin);

      if (path === "/sitemap.xml") {
        return text(renderSitemap(site, meta.areas.map((a) => a.slug)), "application/xml; charset=utf-8");
      }
      if (path === "/about") {
        return html(renderAbout(site, origin));
      }
      if (path === "/") {
        return html(renderHome(site, origin, meta));
      }

      const placePath = path.match(/^\/a\/([a-z0-9-]+)\/p\/([0-9a-f-]{8,})$/i);
      if (placePath) {
        const slug = placePath[1];
        const placeId = placePath[2];
        if (!meta.areas.some((a) => a.slug === slug)) return html(renderNotFound(site), 404);
        const place = await fetchPlaceById(origin, placeId);
        if (!place || place.area !== slug) return html(renderNotFound(site), 404);

        if (request.method === "POST") {
          return handlePost(request, env, site, slug, place);
        }
        const notice = url.searchParams.get("ok") === "1" ? "受け取りました。公式ではありません。地図と公式ハブも見てください。" : url.searchParams.get("err");
        const reports = await listReports(env.DB, place.id);
        return html(renderPlace(site, origin, meta, slug, place, reports, notice), 200, "private, no-store");
      }

      const town = path.match(/^\/a\/([a-z0-9-]+)$/);
      if (town) {
        const slug = town[1];
        if (!meta.areas.some((a) => a.slug === slug)) return html(renderNotFound(site), 404);
        const showAll = url.searchParams.get("all") === "1";
        const page = await fetchPlaces(origin, slug, { limit: showAll ? 200 : 80 });
        const summaries = await latestByPlaces(env.DB, page.places.map((p) => p.id));
        return html(renderTown(site, origin, meta, slug, page.places, showAll, summaries));
      }

      return html(renderNotFound(site), 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "error";
      return html(
        `<!doctype html><meta charset="utf-8"><title>災害板</title><p>いま板を開けません。公式ハブを見てください。</p><p><a href="${origin}">OpenNavi</a></p><!-- ${message.replace(/</g, "")} -->`,
        502,
      );
    }
  },
};

async function handlePost(
  request: Request,
  env: Env,
  site: string,
  slug: string,
  place: BoardPlace,
): Promise<Response> {
  const dest = `/a/${slug}/p/${place.id}`;
  if (request.method !== "POST") return Response.redirect(`${site}${dest}`, 303);
  if (!allowedOrigin(request, site)) {
    return redirect(site, dest, "この画面から送ってください。");
  }
  const form = await request.formData();
  const verdict = parseVerdict(form.get("verdict"));
  if (!verdict) return redirect(site, dest, "いまどうだったかを選んでください。");
  const cleaned = cleanNote(form.get("note"));
  if (cleaned.error) return redirect(site, dest, cleaned.error);
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
  const saved = await insertReport(env.DB, {
    placeId: place.id,
    area: slug,
    seedKey: place.seed_key,
    verdict,
    note: cleaned.note,
    ipHash: await hashIp(ip),
  });
  if (!saved.ok) return redirect(site, dest, saved.error);
  return Response.redirect(`${site}${dest}?ok=1`, 303);
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

function json(body: unknown): Response {
  return Response.json(body);
}
