import assert from "node:assert/strict";
import { test } from "node:test";
import { getCachedJson, publicCacheMode } from "../src/cache.ts";
import { evidenceLabel, freshnessFor, reportEvidence } from "../src/evidence.ts";
import { escapeHtml, gaSnippet, renderHome, renderPlace, renderTown } from "../src/html.ts";
import { categoryLabel, isShelter } from "../src/labels.ts";
import { googleMapsSearchUrl } from "../src/maps.ts";
import { officialHubUrl, opennaviOrigin, stripPlace } from "../src/opennavi.ts";
import { cleanNote, flagReport, moderateReport, parseFlagReason, parseModerationAction, parseVerdict, resolvePost } from "../src/reports.ts";
import { publicPostingEnabled, publicPostingMode } from "../src/posting.ts";
import { purgeExpiredIpHashes, rateLimitConfigured, shortIpHmac } from "../src/rate-limit.ts";
import { reportRequestHeadersAllowed } from "../src/request.ts";
import { sanitizeTelemetry, telemetryAllowlist } from "../src/telemetry.ts";
import { turnstileConfigured, turnstileHostnames, verifyTurnstile } from "../src/turnstile.ts";
import worker from "../src/index.ts";
import type { Env } from "../src/types.ts";

test("opennavi origin never falls back to localhost", () => {
  assert.equal(opennaviOrigin(""), "https://opennavi.org");
  assert.equal(opennaviOrigin("http://localhost:8787"), "https://opennavi.org");
  assert.equal(opennaviOrigin("https://opennavi.org/"), "https://opennavi.org");
});

test("public OpenNavi cache is opt-in", () => {
  assert.equal(publicCacheMode(undefined), "off");
  assert.equal(publicCacheMode("off"), "off");
  assert.equal(publicCacheMode("shadow"), "shadow");
  assert.equal(publicCacheMode("on"), "on");
});

test("shadow cache writes but returns the origin response", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = (globalThis as typeof globalThis & { caches?: unknown }).caches;
  let fetches = 0;
  let puts = 0;
  const entries = new Map<string, Response>();
  const cache = {
    async match(request: Request) {
      return entries.get(request.url) || undefined;
    },
    async put(request: Request, response: Response) {
      puts += 1;
      entries.set(request.url, response);
    },
  };
  (globalThis as typeof globalThis & { caches?: unknown }).caches = { default: cache };
  globalThis.fetch = async () => {
    fetches += 1;
    return new Response(JSON.stringify({ source: "origin", version: 2 }), {
      headers: { "content-type": "application/json", etag: '"v2"' },
    });
  };
  try {
    const result = await getCachedJson("https://opennavi.org/api/board/meta", "shadow", 60, 300);
    assert.deepEqual(result, { source: "origin", version: 2 });
    assert.equal(fetches, 1);
    assert.equal(puts, 1);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as typeof globalThis & { caches?: unknown }).caches = originalCaches;
  }
});

test("cache fetch passes an abort signal and malformed cache falls back to origin", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = (globalThis as typeof globalThis & { caches?: unknown }).caches;
  let sawSignal = false;
  const key = new Request("https://saigaiban.com/__edge-cache/opennavi?url=https%3A%2F%2Fopennavi.org%2Fapi%2Fboard%2Fmeta");
  const cache = {
    async match() {
      return new Response("not-json");
    },
    async put() {},
  };
  (globalThis as typeof globalThis & { caches?: unknown }).caches = { default: cache };
  globalThis.fetch = async (_input, init) => {
    sawSignal = Boolean(init?.signal);
    return new Response(JSON.stringify({ source: "origin" }), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.deepEqual(await getCachedJson("https://opennavi.org/api/board/meta", "on", 60, 300), { source: "origin" });
    assert.equal(sawSignal, true);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as typeof globalThis & { caches?: unknown }).caches = originalCaches;
  }
});

test("evidence separates authority, review, and freshness", () => {
  const now = Date.parse("2026-08-16T00:00:00Z");
  const resident = reportEvidence("2026-08-15T12:00:00Z", "visitor", now);
  assert.deepEqual(resident, { authority: "resident", review: "unknown", freshness: "fresh" });
  assert.equal(evidenceLabel(resident), "住民報告・未確認");
  assert.equal(freshnessFor("2026-08-14T00:00:00Z", now), "stale");
  assert.equal(freshnessFor("2026-08-12T00:00:00Z", now), "expired");
  assert.equal(freshnessFor("2026-08-17T00:00:00Z", now), "unknown");
  assert.equal(freshnessFor("not-a-date", now), "unknown");
  assert.equal(evidenceLabel({ authority: "resident", review: "unknown", freshness: "expired" }), "住民報告・未確認・期限切れ・古い可能性あり");
});

test("telemetry keeps an event-specific allowlist and drops free text", () => {
  const context = { areaSlugs: new Set(["mobara"]) };
  const params = sanitizeTelemetry("report_submit", {
    area: "mobara",
    category: "conv",
    verdict: "open",
    note: "個人情報を含む自由文",
  }, context);
  assert.deepEqual(params, { area: "mobara", category: "conv", verdict: "open" });
  assert.deepEqual(sanitizeTelemetry("report_submit", {
    area: "茂原市",
    category: "日本語自由文",
    verdict: "知らない",
  }, context), {});
  assert.deepEqual(sanitizeTelemetry("need_select", { area: "mobara", need: "call_me_09012345678" }, context), { area: "mobara" });
  assert.deepEqual(sanitizeTelemetry("official_open", { area: "mobara", kind: "free-form" }, context), { area: "mobara" });
  assert.deepEqual(sanitizeTelemetry("report_submit", { area: "not-a-real-area", category: "conv", verdict: "open" }, context), { category: "conv", verdict: "open" });
  assert.deepEqual(telemetryAllowlist("zero_result"), ["area", "category"]);
});

test("public posting is closed unless explicitly enabled", () => {
  assert.equal(publicPostingMode(undefined), "off");
  assert.equal(publicPostingMode("unexpected"), "off");
  assert.equal(publicPostingEnabled(undefined), false);
  assert.equal(publicPostingEnabled("on"), true);
});

test("Turnstile must be configured and verified before intake can open", async () => {
  const hosts = turnstileHostnames("saigaiban.com,www.saigaiban.com");
  assert.equal(turnstileConfigured("secret", "", hosts), false);
  assert.equal(turnstileConfigured("secret", "site-key-123456", hosts), true);
  assert.equal(await verifyTurnstile("", "secret"), false);
  const originalFetch = globalThis.fetch;
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body || "");
    return new Response(JSON.stringify({ success: true, action: "report_submit", hostname: "saigaiban.com" }), { status: 200 });
  };
  try {
    assert.equal(await verifyTurnstile("token-123", "secret", "192.0.2.1", { action: "report_submit", allowedHostnames: hosts }), true);
    const body = new URLSearchParams(requestBody);
    assert.equal(body.get("secret"), "secret");
    assert.equal(body.get("response"), "token-123");
    assert.equal(body.get("remoteip"), "192.0.2.1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("report POST headers are bounded before formData", () => {
  assert.equal(reportRequestHeadersAllowed(new Request("https://saigaiban.com", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "content-length": "120" },
  })), true);
  assert.equal(reportRequestHeadersAllowed(new Request("https://saigaiban.com", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "content-length": "9000" },
  })), false);
  assert.equal(reportRequestHeadersAllowed(new Request("https://saigaiban.com", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "120" },
  })), false);
});

test("moderation inputs are finite and the admin route fails closed", async () => {
  assert.equal(parseFlagReason("privacy"), "privacy");
  assert.equal(parseFlagReason("free-form"), null);
  assert.equal(parseModerationAction("hide"), "hide");
  assert.equal(parseModerationAction("delete-all"), null);
  const response = await worker.fetch(
    new Request("https://saigaiban.com/api/admin/reports/12345678/moderate", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "18" },
      body: JSON.stringify({ action: "hide" }),
    }),
    { OPENNAVI_ORIGIN: "https://opennavi.org", SITE_ORIGIN: "https://saigaiban.com", DB: {} } as unknown as Env,
  );
  assert.equal(response.status, 401);
});

test("rate-limit identity is a rotating HMAC and short secret is required", async () => {
  assert.equal(rateLimitConfigured("short"), false);
  assert.equal(rateLimitConfigured("12345678901234567890123456789012"), true);
  assert.equal(await shortIpHmac("192.0.2.1"), null);
  const secret = "12345678901234567890123456789012";
  const today = await shortIpHmac("192.0.2.1", secret, Date.parse("2026-08-16T12:00:00Z"));
  const tomorrow = await shortIpHmac("192.0.2.1", secret, Date.parse("2026-08-17T12:00:00Z"));
  assert.ok(today);
  assert.ok(tomorrow);
  assert.notEqual(today, tomorrow);
  let purgeSql = "";
  const db = {
    prepare(sql: string) {
      purgeSql = sql;
      return { run: async () => ({ success: true }) };
    },
  };
  await purgeExpiredIpHashes(db as never);
  assert.match(purgeSql, /SET ip_hash = NULL/);
  assert.match(purgeSql, /24 hours/);
});

test("place page hides the report form while public posting is closed", () => {
  const meta = {
    disaster: { id: "r8-chiba-heavy-rain", label: "令和8年千葉県豪雨" },
    areas: [{ slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active" }],
  };
  const place = {
    id: "place-1234",
    seed_key: "spot:conv:mobara:店",
    name: "テスト店",
    area: "mobara",
    category: "conv",
    lat: null,
    lng: null,
    address: null,
    source: "openstreetmap",
    data_basis_date: null,
    identity_only: true,
    maps_url: "",
  };
  const html = renderPlace("https://saigaiban.com", "https://opennavi.org", meta, "mobara", place, [], null, null, false);
  assert.doesNotMatch(html, /<form method="post"/);
  assert.doesNotMatch(html, /書けます/);
  assert.match(html, /投稿受付を停止しています/);
  const townHtml = renderTown("https://saigaiban.com", "https://opennavi.org", meta, "mobara", [place], false, new Map(), null, false);
  assert.doesNotMatch(townHtml, /いまどうかを書く/);
  assert.match(townHtml, /これまでの報告を見る/);
  assert.match(townHtml, /場所を絞る/);
  assert.match(townHtml, /コンビニ/);
  assert.match(townHtml, /name="q"/);
  const filtered = renderTown("https://saigaiban.com", "https://opennavi.org", meta, "mobara", [place], false, new Map(), null, false, "conv", "テスト");
  assert.match(filtered, /value="テスト"/);
  assert.match(filtered, /category=conv/);
});

test("reporting UI is hidden until the independent HMAC gate is ready", () => {
  const meta = {
    disaster: { id: "r8-chiba-heavy-rain", label: "令和8年千葉県豪雨" },
    areas: [{ slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active" }],
  };
  const place = {
    id: "place-1234", seed_key: "spot:conv:mobara:店", name: "テスト店", area: "mobara", category: "conv",
    lat: null, lng: null, address: null, source: "openstreetmap", data_basis_date: null, identity_only: true, maps_url: "",
  };
  const report = { id: "report-1234", place_id: place.id, area: "mobara", seed_key: place.seed_key, verdict: "open" as const, note: null, created_at: "2026-08-16T01:00:00Z", role: "visitor" as const, prefer_maps: false };
  const hidden = renderPlace("https://saigaiban.com", "https://opennavi.org", meta, "mobara", place, [report], null, null, false, null, false);
  assert.doesNotMatch(hidden, /\/api\/reports\/report-1234\/flag/);
  const ready = renderPlace("https://saigaiban.com", "https://opennavi.org", meta, "mobara", place, [report], null, null, false, null, true);
  assert.match(ready, /\/api\/reports\/report-1234\/flag/);
});

test("moderation preserves publication and review state independently and audits atomically", async () => {
  const sqls: string[] = [];
  const db = {
    prepare(sql: string) {
      sqls.push(sql);
      return {
        bind(..._args: unknown[]) {
          return { first: async () => ({ id: "report-1" }), run: async () => ({ success: true }) };
        },
      };
    },
    batch: async (statements: unknown[]) => {
      sqls.push(`batch:${statements.length}`);
      return [];
    },
  } as unknown as D1Database;
  assert.deepEqual(await moderateReport(db, "report-1", "confirm", "moderator"), { ok: true });
  assert.match(sqls.find((sql) => sql.includes("UPDATE reports")) || "", /review_status/);
  assert.doesNotMatch(sqls.find((sql) => sql.includes("UPDATE reports")) || "", /moderation_status/);
  assert.ok(sqls.includes("batch:2"));
  sqls.length = 0;
  await moderateReport(db, "report-1", "hide", "moderator");
  assert.match(sqls.find((sql) => sql.includes("UPDATE reports")) || "", /moderation_status/);
  assert.doesNotMatch(sqls.find((sql) => sql.includes("UPDATE reports")) || "", /review_status/);
});

test("flag cooldown uses SQLite julianday arithmetic", async () => {
  const sqls: string[] = [];
  const db = {
    prepare(sql: string) {
      sqls.push(sql);
      return { bind() { return { first: async () => sql.includes("FROM reports") ? ({ id: "report-1" }) : null, run: async () => ({ success: true }) }; } };
    },
  } as unknown as D1Database;
  const result = await flagReport(db, "report-1", "other", "ip-hash");
  assert.deepEqual(result, { ok: true });
  assert.match(sqls.find((sql) => sql.includes("report_flags")) || "", /julianday\(created_at\)/);
});

test("successful report flag returns to the source page with a 303", async () => {
  const db = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            first: async () => sql.includes("FROM reports") ? ({ id: "deadbeef-1234" }) : null,
            run: async () => ({ success: true }),
          };
        },
      };
    },
  } as unknown as D1Database;
  const body = "reason=privacy";
  const response = await worker.fetch(
    new Request("https://saigaiban.com/api/reports/deadbeef-1234/flag", {
      method: "POST",
      headers: {
        Origin: "https://saigaiban.com",
        Referer: "https://saigaiban.com/a/mobara/p/place-1234",
        "CF-Connecting-IP": "192.0.2.1",
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(body.length),
      },
      body,
    }),
    {
      OPENNAVI_ORIGIN: "https://opennavi.org",
      SITE_ORIGIN: "https://saigaiban.com",
      PUBLIC_POSTING_MODE: "off",
      RATE_LIMIT_HMAC_SECRET: "12345678901234567890123456789012",
      DB: db,
    } as unknown as Env,
  );
  assert.equal(response.status, 303);
  const location = new URL(response.headers.get("location") || "https://saigaiban.com/");
  assert.equal(location.pathname, "/a/mobara/p/place-1234");
  assert.equal(location.searchParams.get("flag"), "1");
});

test("POST rejects before OpenNavi or D1 access while public posting is closed", async () => {
  const originalFetch = globalThis.fetch;
  let externalFetches = 0;
  let d1Accesses = 0;
  globalThis.fetch = async () => {
    externalFetches += 1;
    throw new Error("unexpected external fetch");
  };
  const db = new Proxy({}, {
    get() {
      d1Accesses += 1;
      throw new Error("unexpected D1 access");
    },
  });
  try {
    const response = await worker.fetch(
      new Request("https://saigaiban.com/a/mobara/p/12345678", { method: "POST" }),
      {
        OPENNAVI_ORIGIN: "https://opennavi.org",
        SITE_ORIGIN: "https://saigaiban.com",
        PUBLIC_POSTING_MODE: "off",
        DB: db,
      } as unknown as Env,
    );
    assert.equal(response.status, 303);
    assert.equal(externalFetches, 0);
    assert.equal(d1Accesses, 0);
    const location = new URL(response.headers.get("location") || "https://saigaiban.com/");
    assert.equal(location.searchParams.get("err"), "現在は投稿受付を停止しています。公式ハブで確認してください。");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("official hub URL uses the town slug", () => {
  assert.equal(officialHubUrl("https://opennavi.org", "mobara"), "https://opennavi.org/a/mobara");
});

test("Google Maps links search by place name and municipality, never coordinates", () => {
  const url = googleMapsSearchUrl("イオン大網白里店", "大網白里市", "千葉県大網白里市みやこ野1-1");
  assert.match(url, /google\.com\/maps\/search\/\?api=1&query=/);
  assert.match(decodeURIComponent(url), /イオン大網白里店/);
  assert.match(decodeURIComponent(url), /大網白里市/);
  assert.doesNotMatch(url, /35\.4|140\.3/);
});

test("stripPlace keeps identity only and drops empty rows", () => {
  const place = stripPlace({
    id: "p1",
    seed_key: "spot:conv:茂原市:店",
    name: "店",
    area: "mobara",
    category: "conv",
    lat: 35.4,
    lng: 140.3,
    address: null,
    source: "openstreetmap",
    data_basis_date: null,
    identity_only: true,
    maps_url: "https://www.google.com/maps/search/?api=1&query=35.4,140.3",
    status: "open",
  });
  assert.ok(place);
  assert.equal(place.identity_only, true);
  assert.equal(place.name, "店");
  assert.equal("status" in place, false);
  assert.equal(stripPlace({ id: "", name: "x", area: "mobara" }), null);
});

test("labels", () => {
  assert.equal(categoryLabel("conv"), "コンビニ");
  assert.equal(isShelter("hinanjo"), true);
  assert.equal(isShelter("conv"), false);
});

test("escapeHtml", () => {
  assert.equal(escapeHtml(`<a href="x">`), "&lt;a href=&quot;x&quot;&gt;");
});

test("gaSnippet emits gtag only for a valid measurement id", () => {
  assert.equal(gaSnippet(""), "");
  assert.equal(gaSnippet("UA-123"), "");
  assert.equal(gaSnippet("G-4KQPS1LRHV\"><script>"), "");
  const html = gaSnippet("G-4KQPS1LRHV");
  assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-4KQPS1LRHV/);
  assert.match(html, /gtag\('config', 'G-4KQPS1LRHV'\)/);
});

test("home page head includes GA4 when configured", () => {
  const html = renderHome(
    "https://saigaiban.com",
    "https://opennavi.org",
    {
      disaster: { id: "r8-chiba-heavy-rain", label: "令和8年千葉県豪雨" },
      areas: [{ slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active" }],
    },
    "G-4KQPS1LRHV",
  );
  assert.match(html, /id=G-4KQPS1LRHV/);
  assert.match(html, /gtag\('config', 'G-4KQPS1LRHV'\)/);
  assert.equal(renderHome("https://saigaiban.com", "https://opennavi.org", {
    disaster: { id: "r8-chiba-heavy-rain", label: "令和8年千葉県豪雨" },
    areas: [],
  }).includes("googletagmanager"), false);
});

test("home shows one prefecture at a time behind tabs", () => {
  const meta = {
    disaster: { id: "r8-chiba-heavy-rain", label: "令和8年千葉県豪雨" },
    areas: [
      { slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active" },
      { slug: "kumamoto", nameJa: "熊本市", prefCode: "43", status: "active" },
    ],
  };
  const first = renderHome("https://saigaiban.com", "https://opennavi.org", meta);
  assert.match(first, /茂原市/);
  assert.doesNotMatch(first, /熊本市の/);
  assert.match(first, /\?pref=43/);
  const second = renderHome("https://saigaiban.com", "https://opennavi.org", meta, null, "43");
  assert.match(second, /熊本市/);
  assert.doesNotMatch(second, /茂原市の市区町村/);
});

test("verdict and note rules reject matching and contacts", () => {
  assert.equal(parseVerdict("open"), "open");
  assert.equal(parseVerdict("営業中"), null);
  assert.equal(cleanNote("15時ごろ棚が少なかった").note, "15時ごろ棚が少なかった");
  assert.match(cleanNote("https://example.com").error || "", /URL/);
  assert.match(cleanNote("09012345678").error || "", /電話/);
  assert.match(cleanNote("LINE IDはabc").error || "", /連絡先/);
  assert.match(cleanNote("駅前で待ち合わせ").error || "", /仲介/);
});

test("owner can steer visitors to Google Maps without claiming official hours", () => {
  const post = resolvePost({
    roleRaw: "owner",
    verdictRaw: "",
    preferMapsRaw: "1",
    hasMapsUrl: true,
    shopLike: true,
  });
  assert.equal(post.role, "owner");
  assert.equal(post.preferMaps, true);
  assert.equal(post.verdict, "maps");
  assert.equal(post.error, undefined);
  const visitorMaps = resolvePost({
    roleRaw: "visitor",
    verdictRaw: "maps",
    preferMapsRaw: "",
    hasMapsUrl: true,
    shopLike: true,
  });
  assert.ok(visitorMaps.error);
});
