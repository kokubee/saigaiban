import assert from "node:assert/strict";
import { test } from "node:test";
import { publicCacheMode } from "../src/cache.ts";
import { escapeHtml, gaSnippet, renderHome } from "../src/html.ts";
import { categoryLabel, isShelter } from "../src/labels.ts";
import { googleMapsSearchUrl } from "../src/maps.ts";
import { officialHubUrl, opennaviOrigin, stripPlace } from "../src/opennavi.ts";
import { cleanNote, parseVerdict, resolvePost } from "../src/reports.ts";

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
