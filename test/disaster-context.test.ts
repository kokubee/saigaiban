import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boardMetaForArea,
  isNotoReadOnlyArea,
  NOTO_HEAVY_RAIN_DISASTER,
  NOTO_HEAVY_RAIN_REGION_ID,
} from "../src/disaster-context.ts";
import { renderHome, renderPlace, renderTown } from "../src/html.ts";
import worker from "../src/index.ts";
import type { BoardMeta, BoardPlace, Env } from "../src/types.ts";

const meta: BoardMeta = {
  disaster: { id: "r8-chiba-heavy-rain", label: "令和8年8月千葉豪雨" },
  areas: [
    { slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active", region: { id: "chiba-heavy-rain", label: "千葉県（大雨）", order: 1 } },
    { slug: "hakui", nameJa: "羽咋市", prefCode: "17", status: "active", region: { id: NOTO_HEAVY_RAIN_REGION_ID, label: "石川・能登（大雨）", order: 7 } },
    { slug: "shika", nameJa: "志賀町", prefCode: "17", status: "active", region: { id: NOTO_HEAVY_RAIN_REGION_ID, label: "石川・能登（大雨）", order: 7 } },
    { slug: "hodatsushimizu", nameJa: "宝達志水町", prefCode: "17", status: "active", region: { id: NOTO_HEAVY_RAIN_REGION_ID, label: "石川・能登（大雨）", order: 7 } },
    { slug: "nakanoto", nameJa: "中能登町", prefCode: "17", status: "active", region: { id: NOTO_HEAVY_RAIN_REGION_ID, label: "石川・能登（大雨）", order: 7 } },
  ],
};

const place: BoardPlace = {
  id: "12345678-abcd-4abc-8abc-123456789012",
  seed_key: "hakui:test",
  name: "羽咋市役所",
  area: "hakui",
  category: "hinanjo",
  lat: null,
  lng: null,
  address: "石川県羽咋市",
  source: "test",
  data_basis_date: "2026-08-29",
  identity_only: true,
  maps_url: "",
};

test("Noto disaster context is limited to the four approved municipalities", () => {
  for (const slug of ["hakui", "shika", "hodatsushimizu", "nakanoto"]) {
    assert.equal(isNotoReadOnlyArea(slug), true);
    assert.deepEqual(boardMetaForArea(meta, slug).disaster, NOTO_HEAVY_RAIN_DISASTER);
  }
  assert.equal(isNotoReadOnlyArea("mobara"), false);
  assert.equal(boardMetaForArea(meta, "mobara"), meta);
});

test("home opens on Noto and preserves the Chiba tab", () => {
  const html = renderHome("https://saigaiban.com", "https://opennavi.org", meta);
  assert.match(html, /令和8年8月27日からの大雨（石川県能登）/);
  assert.match(html, /読み取り専用で公開中/);
  assert.match(html, /投稿受付は準備中です/);
  assert.match(html, /石川・能登（大雨）/);
  assert.match(html, /千葉県（大雨）/);
  assert.match(html, new RegExp(`href="/\\?region=${NOTO_HEAVY_RAIN_REGION_ID}" aria-current="page"`));
});

test("Noto town and place pages show the regional disaster and no posting form", () => {
  const regionalMeta = boardMetaForArea(meta, "hakui");
  const town = renderTown("https://saigaiban.com", "https://opennavi.org", regionalMeta, "hakui", [place], false, new Map());
  const detail = renderPlace("https://saigaiban.com", "https://opennavi.org", regionalMeta, "hakui", place, [], null);

  for (const html of [town, detail]) {
    assert.match(html, /令和8年8月27日からの大雨（石川県能登）/);
    assert.match(html, /読み取り専用です/);
    assert.doesNotMatch(html, /令和8年8月千葉豪雨/);
    assert.doesNotMatch(html, /<button type="submit">投稿する<\/button>/);
  }
});

test("Noto POST stays closed even if public posting is mistakenly enabled", async () => {
  const env = {
    OPENNAVI_ORIGIN: "https://opennavi.org",
    SITE_ORIGIN: "https://saigaiban.com",
    PUBLIC_POSTING_MODE: "on",
    PUBLIC_POSTING_AREAS: "hakui",
    PUBLIC_TURNSTILE_SITE_KEY: "configured-site-key",
    PUBLIC_TURNSTILE_HOSTNAMES: "saigaiban.com",
    TURNSTILE_SECRET_KEY: "configured-secret",
    RATE_LIMIT_HMAC_SECRET: "12345678901234567890123456789012",
    DB: {} as D1Database,
  } satisfies Env;
  const response = await worker.fetch(
    new Request(`https://saigaiban.com/a/hakui/p/${place.id}`, { method: "POST" }),
    env,
  );
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location") || "", /err=/);
  assert.match(decodeURIComponent(response.headers.get("location") || ""), /投稿受付を停止しています/);
});
