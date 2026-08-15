import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml } from "../src/html.ts";
import { categoryLabel, isShelter } from "../src/labels.ts";
import { officialHubUrl, opennaviOrigin, stripPlace } from "../src/opennavi.ts";

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
