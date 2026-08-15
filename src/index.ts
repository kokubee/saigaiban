import { renderAbout, renderHome, renderNotFound, renderRobots, renderSitemap, renderTown } from "./html.ts";
import { fetchMeta, fetchPlaces, opennaviOrigin } from "./opennavi.ts";
import type { Env } from "./types.ts";

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

      const town = path.match(/^\/a\/([a-z0-9-]+)$/);
      if (town) {
        const slug = town[1];
        if (!meta.areas.some((a) => a.slug === slug)) return html(renderNotFound(site), 404);
        const showAll = url.searchParams.get("all") === "1";
        const page = await fetchPlaces(origin, slug, { limit: showAll ? 200 : 80 });
        return html(renderTown(site, origin, meta, slug, page.places, showAll));
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

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
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
