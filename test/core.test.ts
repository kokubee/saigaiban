import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml } from "../src/html.ts";
import { categoryLabel, isShelter } from "../src/labels.ts";
import { officialHubUrl, opennaviOrigin, stripPlace } from "../src/opennavi.ts";
import { cleanNote, parseVerdict, resolvePost } from "../src/reports.ts";

test("opennavi origin never falls back to localhost", () => {
  assert.equal(opennaviOrigin(""), "https://opennavi.org");
  assert.equal(opennaviOrigin("http://localhost:8787"), "https://opennavi.org");
  assert.equal(opennaviOrigin("https://opennavi.org/"), "https://opennavi.org");
});

test("official hub URL uses the town slug", () => {
  assert.equal(officialHubUrl("https://opennavi.org", "mobara"), "https://opennavi.org/a/mobara");
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
