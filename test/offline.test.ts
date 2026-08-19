import assert from "node:assert/strict";
import test from "node:test";
import { assertOfflineSnapshotSize, buildOfflineSnapshot, offlineSnapshotHasRawModerationFields } from "../src/offline.ts";
import { renderOfflineShell, renderTown } from "../src/html.ts";
import { renderManifest, renderOfflineClient, renderOfflineSaveClient, renderServiceWorker } from "../src/pwa.ts";
import worker from "../src/index.ts";
import type { Env } from "../src/types.ts";

const meta = {
  disaster: { id: "demo", label: "デモ災害" },
  areas: [{ slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active" }],
} as const;

const place = {
  id: "place-1",
  seed_key: "seed-1",
  name: "茂原駅",
  area: "mobara",
  category: "station",
  flags: ["shelter-designated"],
  lat: 35.4,
  lng: 140.3,
  address: "千葉県茂原市",
  source: "https://example.org/source",
  data_basis_date: "2026-08-18",
  identity_only: true,
  maps_url: "https://example.org/coordinate-url",
};

test("offline snapshot strips notes and raw moderation fields", () => {
  const snapshot = buildOfflineSnapshot({
    site: "https://saigaiban.example",
    origin: "https://opennavi.org",
    meta,
    area: meta.areas[0],
    places: [place],
    summaries: new Map([
      [place.id, {
        count: 2,
        latestOwner: null,
        latest: {
          id: "report-1",
          place_id: place.id,
          area: "mobara",
          seed_key: "seed-1",
          verdict: "open",
          note: "このメモは端末へ保存しない",
          created_at: "2026-08-18T00:00:00.000Z",
          role: "visitor",
          prefer_maps: false,
          moderation_status: "visible",
          review_status: "unknown",
          evidence: { authority: "resident", review: "unknown", freshness: "fresh" },
        },
      }],
    ]),
    officialStatuses: [{
      name: "茂原駅",
      area: "mobara",
      category: "station",
      status: "open",
      headline: "公式確認",
      sourceUrl: "https://example.org/official",
      checkedAt: "2026-08-18T00:00:00.000Z",
      freshness: "fresh",
      lat: null,
      lng: null,
    }],
  });

  assert.equal(snapshot.places[0].latestReport?.id, "report-1");
  assert.equal("note" in snapshot.places[0].latestReport!, false);
  assert.equal("moderation_status" in snapshot.places[0].latestReport!, false);
  assert.equal(snapshot.places[0].mapsUrl.includes("coordinate-url"), false);
  assert.deepEqual(snapshot.places[0].flags, ["shelter-designated"]);
  assert.equal(offlineSnapshotHasRawModerationFields(snapshot), false);
  assert.doesNotThrow(() => assertOfflineSnapshotSize(snapshot));
});

test("offline snapshot rejects more than the supported place count", () => {
  const places = Array.from({ length: 501 }, (_, index) => ({ ...place, id: `place-${index}` }));
  assert.throws(() => buildOfflineSnapshot({
    site: "https://saigaiban.example",
    origin: "https://opennavi.org",
    meta,
    area: meta.areas[0],
    places,
    summaries: new Map(),
  }), /500/);
});

test("PWA shell caches only explicit static assets", () => {
  const worker = renderServiceWorker();
  assert.match(worker, /saigaiban-pwa-v1/);
  assert.match(worker, /\/pwa\/offline-shell\.html/);
  assert.match(worker, /\/manifest\.webmanifest/);
  assert.doesNotMatch(worker, /cache\.put/);
  assert.doesNotMatch(worker, /\/api\//);
  assert.doesNotMatch(worker, /\/a\/\*/);
});

test("PWA public assets declare an installable shell and offline clients", () => {
  const manifest = renderManifest("https://saigaiban.example");
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /\/pwa\/icon\.svg/);
  assert.match(renderOfflineShell("https://saigaiban.example"), /data-offline-root/);
  assert.match(renderOfflineSaveClient(), /\/api\/offline-snapshot/);
  assert.match(renderOfflineClient(), /saigaiban-offline/);
  const townHtml = renderTown("https://saigaiban.example", "https://opennavi.org", meta, "mobara", [place], false, new Map(), null, false);
  assert.match(townHtml, /この地域を端末に保存/);
  assert.match(townHtml, /\/pwa\/offline-save\.js/);
  assert.match(townHtml, /\/a\/mobara\/offline/);
});

test("PWA asset routes are static and offline snapshot is no-store", async () => {
  const env = { OPENNAVI_ORIGIN: "https://opennavi.org", SITE_ORIGIN: "https://saigaiban.example", DB: {} } as unknown as Env;
  for (const [path, contentType] of [["/manifest.webmanifest", "application/manifest\\+json"], ["/sw.js", "application/javascript"], ["/pwa/offline-shell.html", "text/html"], ["/pwa/offline-save.js", "application/javascript"], ["/pwa/offline-client.js", "application/javascript"], ["/pwa/icon.svg", "image/svg\\+xml"]] as const) {
    const response = await worker.fetch(new Request(`https://saigaiban.example${path}`), env);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") || "", new RegExp(contentType));
  }

  const originalFetch = globalThis.fetch;
  const meta = { disaster: { id: "demo", label: "デモ災害" }, areas: [{ slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active" }] };
  const placeForRoute = { ...place, source: "https://example.org/source" };
  globalThis.fetch = async (input) => {
    const requestUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (requestUrl.includes("/api/board/meta")) return new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } });
    if (requestUrl.includes("/api/board/places?")) return new Response(JSON.stringify({ disaster_id: "demo", generated_at: "2026-08-18T00:00:00.000Z", next_cursor: null, places: [placeForRoute] }), { headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ statuses: [] }), { headers: { "content-type": "application/json" } });
  };
  try {
    const db = {
      prepare() {
        return { bind() { return {
          all: async () => ({ results: [{
            id: "report-1", place_id: place.id, area: "mobara", seed_key: "seed-1", verdict: "open", note: "保存しないメモ", created_at: "2026-08-18T00:00:00.000Z", role: "visitor", prefer_maps: 0, moderation_status: "visible", review_status: "unknown",
          }] }),
          first: async () => ({ latest_created_at: "2026-08-18T00:00:00.000Z", latest_moderated_at: null }),
        }; } };
      },
    };
    const response = await worker.fetch(new Request("https://saigaiban.example/api/offline-snapshot/mobara"), { ...env, DB: db } as unknown as Env);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((body.places as Array<Record<string, unknown>>)[0].reportCount, 1);
    assert.equal(offlineSnapshotHasRawModerationFields(body), false);
    assert.doesNotMatch(JSON.stringify(body), /保存しないメモ/);

    const revisionResponse = await worker.fetch(new Request("https://saigaiban.example/api/offline-revision/mobara"), { ...env, DB: db } as unknown as Env);
    const revision = await revisionResponse.json() as Record<string, unknown>;
    assert.equal(revisionResponse.status, 200);
    assert.equal(revisionResponse.headers.get("cache-control"), "no-store");
    assert.equal(revision.schema, "saigaiban.offline-revision/v1");
    assert.deepEqual(revision.reportRevision, { latestCreatedAt: "2026-08-18T00:00:00.000Z", latestModeratedAt: null });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
