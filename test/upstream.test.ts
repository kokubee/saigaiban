import assert from "node:assert/strict";
import { test } from "node:test";
import { formatUpstreamGeneratedAt, upstreamFreshnessFor, upstreamFreshnessLabel } from "../src/upstream.ts";

test("OpenNavi generated timestamps are classified without asserting current status", () => {
  const now = Date.parse("2026-08-24T00:00:00Z");
  assert.equal(upstreamFreshnessFor("2026-08-23T12:00:00Z", now), "fresh");
  assert.equal(upstreamFreshnessFor("2026-08-22T00:00:00Z", now), "stale");
  assert.equal(upstreamFreshnessFor("2026-08-20T00:00:00Z", now), "expired");
  assert.equal(upstreamFreshnessFor("2026-08-25T00:00:00Z", now), "unknown");
  assert.equal(upstreamFreshnessFor("not-a-date", now), "unknown");
  assert.equal(upstreamFreshnessLabel("stale"), "24時間超・要再確認");
  assert.match(formatUpstreamGeneratedAt("2026-08-23T12:34:00Z"), /2026(?:年|\/)8(?:月|\/)23/);
});
