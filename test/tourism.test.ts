import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSitemap, renderSupport, renderTourism } from "../src/html.ts";
import {
  RAKUTEN_CREDIT_HTML,
  allowlistedImageUrl,
  allowlistedUrl,
  clearTourismCache,
  fetchTourismForArea,
  normalizeRakutenHotels,
  readRakutenCredentials,
} from "../src/tourism.ts";
import { jalanSearchUrl, tourismAreaConfig } from "../src/tourism-areas.ts";
import type { BoardMeta, TourismFetchResult } from "../src/types.ts";

const META: BoardMeta = {
  disaster: { id: "r8-chiba-heavy-rain", label: "令和8年8月千葉豪雨" },
  areas: [
    { slug: "mobara", nameJa: "茂原市", prefCode: "12", status: "active" },
    { slug: "unknown", nameJa: "未対応市", prefCode: "12", status: "active" },
  ],
};

test("tourism provider URLs only accept known HTTPS hosts", () => {
  assert.equal(
    allowlistedUrl("https://travel.rakuten.co.jp/HOTEL/1/1.html"),
    "https://travel.rakuten.co.jp/HOTEL/1/1.html",
  );
  assert.equal(allowlistedUrl("http://travel.rakuten.co.jp/HOTEL/1"), null);
  assert.equal(allowlistedUrl("https://evil.example/?next=travel.rakuten.co.jp"), null);
  assert.equal(
    allowlistedImageUrl("https://img.travel.rakuten.co.jp/share/HOTEL/1.jpg"),
    "https://img.travel.rakuten.co.jp/share/HOTEL/1.jpg",
  );
  assert.equal(allowlistedImageUrl("javascript:alert(1)"), null);
});

test("Rakuten results are restricted to the selected municipality", () => {
  const config = tourismAreaConfig("mobara");
  assert.ok(config);
  const doc = {
    hotels: [
      {
        hotelBasicInfo: {
          hotelNo: 1,
          hotelName: "茂原の宿",
          address1: "千葉県",
          address2: "茂原市高師1",
          hotelInformationUrl: "https://travel.rakuten.co.jp/HOTEL/1/1.html",
          hotelThumbnailUrl: "https://img.travel.rakuten.co.jp/share/HOTEL/1.jpg",
          hotelSpecial: "<b>地域の宿</b>",
        },
      },
      {
        hotelBasicInfo: {
          hotelNo: 2,
          hotelName: "隣町の宿",
          address1: "千葉県",
          address2: "東金市東金1",
          hotelInformationUrl: "https://travel.rakuten.co.jp/HOTEL/2/2.html",
        },
      },
      {
        hotelBasicInfo: {
          hotelNo: 3,
          hotelName: "危険なリンク",
          address1: "千葉県",
          address2: "茂原市高師2",
          hotelInformationUrl: "https://evil.example/steal",
        },
      },
    ],
  };
  const rows = normalizeRakutenHotels(doc, config);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "茂原の宿");
  assert.equal(rows[0].blurb, "<b>地域の宿</b>");
});

test("missing Rakuten credentials falls back without exposing secrets", async () => {
  clearTourismCache();
  assert.equal(readRakutenCredentials({}), null);
  assert.deepEqual(readRakutenCredentials({ RAKUTEN_APPLICATION_ID: "app", RAKUTEN_ACCESS_KEY: "key" }), {
    applicationId: "app",
    accessKey: "key",
  });
  const result = await fetchTourismForArea("mobara", "茂原市", null);
  assert.equal(result.status, "unconfigured");
  assert.equal(result.listings.length, 0);
  assert.match(result.providers.find((p) => p.id === "jalan")?.href || "", /keyword=/);
  assert.equal(JSON.stringify(result).includes("app"), false);
});

test("Rakuten rate limiting keeps both official search exits", async () => {
  clearTourismCache();
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  let safeCredentials = false;
  globalThis.fetch = async (input, init) => {
    requestCount += 1;
    const headers = new Headers(init?.headers);
    safeCredentials = headers.get("Referer") === "https://saigaiban.com/support"
      && headers.get("Origin") === "https://saigaiban.com"
      && headers.get("accessKey") === "secret-key"
      && !String(input).includes("secret-key");
    return new Response('{"error":"too_many_requests"}', { status: 429 });
  };
  try {
    const result = await fetchTourismForArea("mobara", "茂原市", {
      applicationId: "secret-app",
      accessKey: "secret-key",
    });
    assert.equal(result.status, "rate_limited");
    assert.equal(result.providers.length, 2);
    assert.equal(JSON.stringify(result).includes("secret-"), false);
    assert.equal(safeCredentials, true);

    await fetchTourismForArea("mobara", "茂原市", {
      applicationId: "secret-app",
      accessKey: "secret-key",
    });
    assert.equal(requestCount, 2, "transient provider errors must not be cached");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("support page delegates official disaster support to OpenNavi and separates tourism from evacuation", () => {
  const html = renderSupport("https://saigaiban.com", "https://opennavi.org", META);
  assert.match(html, /https:\/\/opennavi\.org\/support/);
  assert.match(html, /公式の支援情報はOpenNaviへ/);
  assert.match(html, /災害救助法の適用を目安に開いた地域/);
  assert.doesNotMatch(html, /bodik\.jp|熊本の公式発信/);
  assert.match(html, /避難先の案内ではありません/);
  assert.match(html, /泊まって地域を応援/);
  assert.doesNotMatch(html, /unknown.*泊まって応援/);
});

test("tourism page escapes provider content and includes exact credits", () => {
  const result: TourismFetchResult = {
    status: "ok",
    message: "予約先で確認",
    listings: [
      {
        id: "1",
        name: "<script>alert(1)</script>",
        address: "茂原市",
        blurb: "<b>紹介</b>",
        imageUrl: null,
        href: "https://travel.rakuten.co.jp/HOTEL/1/1.html",
        provider: "rakuten",
      },
    ],
    providers: [
      { id: "rakuten", label: "楽天トラベルで探す", href: "https://travel.rakuten.co.jp/yado/chiba/chiba.html" },
      { id: "jalan", label: "じゃらんで探す", href: jalanSearchUrl("茂原市") },
    ],
    creditHtml: RAKUTEN_CREDIT_HTML,
  };
  const html = renderTourism("https://saigaiban.com", "https://opennavi.org", META, "mobara", result);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /&lt;b&gt;紹介&lt;\/b&gt;/);
  assert.match(html, /避難先の案内ではありません/);
  assert.match(html, /価格・評価・口コミの比較もしません/);
  assert.ok(html.includes(RAKUTEN_CREDIT_HTML));
});

test("sitemap keeps the disaster board focused on resident pages", () => {
  const xml = renderSitemap("https://saigaiban.com", ["mobara", "unknown"]);
  assert.doesNotMatch(xml, /saigaiban\.com\/support/);
  assert.doesNotMatch(xml, /support\/tourism/);
  assert.match(xml, /<loc>https:\/\/saigaiban\.com\/a\/mobara<\/loc>/);
});
