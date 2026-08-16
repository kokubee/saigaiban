import assert from "node:assert/strict";
import { test } from "node:test";
import { renderAbout, renderProtocol } from "../src/html.ts";
import worker from "../src/index.ts";
import { buildHandoffDocument } from "../src/handoff.ts";
import { buildProtocolDiscoveryDocument } from "../src/protocol.ts";
import type { BoardMeta, BoardPlace, Env } from "../src/types.ts";

const meta: BoardMeta = {
  disaster: { id: "r8", label: "テスト災害" },
  areas: [{ slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active" }],
};

const place: BoardPlace = {
  id: "place-1234",
  seed_key: "spot:conv:mobara:テスト店",
  name: "テスト店",
  area: "mobara",
  category: "conv",
  lat: 35.4,
  lng: 140.3,
  address: "千葉県茂原市",
  source: "openstreetmap",
  data_basis_date: "2026-08-01",
  identity_only: true,
  maps_url: "https://www.google.com/maps/search/?api=1&query=35.4,140.3",
};

test("handoff document keeps the public identity boundary", () => {
  const document = buildHandoffDocument(
    "https://saigaiban.com/",
    meta,
    meta.areas[0],
    [place],
    new Map([[place.id, { latest: null, latestOwner: null, count: 0 }]]),
    "2026-08-16T00:00:00.000Z",
    "next-page",
    "2026-08-16T00:01:00.000Z",
  );
  assert.equal(document.schema, "saigaiban.handoff/v1");
  assert.deepEqual(document.protocol, { name: "OpenNavi Protocol", version: "1.0", profile: "handoff/v1" });
  assert.equal(document.handoff.phase, "prepared");
  assert.equal(document.handoff.next, "local-site");
  assert.match(document.handoff.statement, /現地サイト/);
  assert.equal(document.source.api, "https://saigaiban.com/api/opennavi/v1/handoff/mobara");
  assert.equal(document.source.legacyApi, "https://saigaiban.com/api/handoff/mobara");
  assert.equal(document.pagination.nextCursor, "next-page");
  assert.equal(document.places[0].identityOnly, true);
  assert.equal(document.places[0].lat, 35.4);
  assert.equal(document.places[0].reportCount, 0);
  assert.equal(document.places[0].latestReport, null);
  assert.equal("maps_url" in document.places[0], false);
  assert.equal("seed_key" in document.places[0], false);
});

test("well-known discovery describes the versioned protocol", () => {
  const document = buildProtocolDiscoveryDocument("https://saigaiban.com/", "https://opennavi.org/");
  assert.equal(document.schema, "opennavi.discovery/v1");
  assert.equal(document.protocol.name, "OpenNavi Protocol");
  assert.equal(document.protocol.version, "1.0");
  assert.equal(document.protocol.profiles[0].endpoint, "https://saigaiban.com/api/opennavi/v1/handoff/{area-slug}");
  assert.equal(document.protocol.profiles[0].legacyEndpoint, "https://saigaiban.com/api/handoff/{area-slug}");
  assert.equal(document.protocol.profiles[0].documentation, "https://saigaiban.com/protocol/opennavi/v1");
  assert.equal(document.dependencies.placeMaster, "https://opennavi.org/api/board/places");
  assert.equal(document.service.sourceOfTruth, "local-site-after-handoff");
  assert.equal(document.policy.readOnly, true);
});

test("about page explains preparation and local-site handoff", () => {
  const html = renderAbout("https://saigaiban.com", "https://opennavi.org");
  assert.match(html, /平時から場所マスター/);
  assert.match(html, /災害が起きたとき/);
  assert.match(html, /現地サイトへの引き継ぎ/);
  assert.match(html, /\/api\/opennavi\/v1\/handoff\/\{area-slug\}/);
  assert.match(html, /現地サイトが立ち上がったら/);
  assert.match(html, /OpenNavi Protocol v1の仕様書/);
});

test("public protocol page explains the handoff steps and boundaries", () => {
  const html = renderProtocol("https://saigaiban.com", "https://opennavi.org");
  assert.match(html, /OpenNavi Protocol v1\.0/);
  assert.match(html, /現地サイト運営者の手順/);
  assert.match(html, /api\/opennavi\/v1\/handoff/);
  assert.match(html, /電話番号、個人名、待ち合わせ/);
  assert.match(html, /現地サイトが立ち上がった後は/);
  assert.match(html, /saigaiban\.handoff\/v1/);
});

test("handoff endpoint is read-only, CORS-enabled, and area-scoped", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async (input) => {
    fetchCount += 1;
    const requestUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (requestUrl.includes("/api/board/meta")) {
      return new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } });
    }
    if (requestUrl.includes("/api/board/places?")) {
      return new Response(JSON.stringify({ disaster_id: "r8", generated_at: "2026-08-16T00:00:00Z", next_cursor: null, places: [place] }), { headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected fetch: ${requestUrl}`);
  };
  const db = {
    prepare() {
      return { bind() { return { all: async () => ({ results: [] }) }; } };
    },
  };
  const env = {
    OPENNAVI_ORIGIN: "https://opennavi.org",
    SITE_ORIGIN: "https://saigaiban.com",
    DB: db,
  } as unknown as Env;
  try {
    const preflight = await worker.fetch(new Request("https://saigaiban.com/api/handoff/mobara", { method: "OPTIONS" }), env);
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
    assert.equal(fetchCount, 0);

    const discovery = await worker.fetch(new Request("https://saigaiban.com/.well-known/opennavi.json"), env);
    assert.equal(discovery.status, 200);
    assert.equal(discovery.headers.get("content-type"), "application/json; charset=utf-8");
    const discoveryBody = await discovery.json() as { schema: string; protocol: { profiles: Array<{ endpoint: string; documentation: string }> } };
    assert.equal(discoveryBody.schema, "opennavi.discovery/v1");
    assert.equal(discoveryBody.protocol.profiles[0].endpoint, "https://saigaiban.com/api/opennavi/v1/handoff/{area-slug}");
    assert.equal(discoveryBody.protocol.profiles[0].documentation, "https://saigaiban.com/protocol/opennavi/v1");
    assert.equal(fetchCount, 0);

    const protocolPage = await worker.fetch(new Request("https://saigaiban.com/protocol/opennavi/v1"), env);
    assert.equal(protocolPage.status, 200);
    assert.match(await protocolPage.text(), /現地サイト運営者の手順/);
    assert.equal(fetchCount, 0);

    const response = await worker.fetch(new Request("https://saigaiban.com/api/opennavi/v1/handoff/mobara"), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const body = await response.json() as { schema: string; area: { slug: string }; places: Array<Record<string, unknown>> };
    assert.equal(body.schema, "saigaiban.handoff/v1");
    assert.equal(body.area.slug, "mobara");
    assert.equal(body.places.length, 1);
    assert.equal("maps_url" in body.places[0], false);

    const legacy = await worker.fetch(new Request("https://saigaiban.com/api/handoff/mobara"), env);
    assert.equal(legacy.status, 200);

    const method = await worker.fetch(new Request("https://saigaiban.com/api/handoff/mobara", { method: "POST" }), env);
    assert.equal(method.status, 405);
    const unknown = await worker.fetch(new Request("https://saigaiban.com/api/handoff/unknown"), env);
    assert.equal(unknown.status, 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
