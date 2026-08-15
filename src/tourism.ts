import {
  addressMatchesArea,
  jalanSearchUrl,
  rakutenPrefectureSearchUrl,
  tourismAreaConfig,
  type TourismAreaConfig,
} from "./tourism-areas.ts";
import type { StayListing, TourismFetchResult, TourismProvider } from "./types.ts";

const RAKUTEN_SEARCH =
  "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731";
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_LISTINGS = 12;
const FETCH_TIMEOUT_MS = 8000;

/** 楽天指定のクレジット（改変禁止） */
export const RAKUTEN_CREDIT_HTML = `<!-- Rakuten Web Services Attribution Snippet FROM HERE -->
<a href="https://webservice.rakuten.co.jp/" target="_blank"><img src="https://webservice.rakuten.co.jp/img/credit/200709/credit_22121.gif" border="0" alt="Rakuten Web Service Center" title="Rakuten Web Service Center" width="221" height="21"/></a>
<!-- Rakuten Web Services Attribution Snippet TO HERE -->`;

const ALLOWED_HOSTS = new Set([
  "travel.rakuten.co.jp",
  "hotel.travel.rakuten.co.jp",
  "img.travel.rakuten.co.jp",
  "overseas.travel.rakuten.co.jp",
]);

type CacheEntry = { at: number; value: TourismFetchResult };

const cache = new Map<string, CacheEntry>();

export type RakutenCredentials = {
  applicationId: string;
  accessKey: string;
};

export function readRakutenCredentials(env: {
  RAKUTEN_APPLICATION_ID?: string;
  RAKUTEN_ACCESS_KEY?: string;
}): RakutenCredentials | null {
  const applicationId = String(env.RAKUTEN_APPLICATION_ID || "").trim();
  const accessKey = String(env.RAKUTEN_ACCESS_KEY || "").trim();
  if (!applicationId || !accessKey) return null;
  return { applicationId, accessKey };
}

function parseHttpsUrl(raw: unknown): URL | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** 外部遷移先として許す URL だけ通す。 */
export function allowlistedUrl(raw: unknown): string | null {
  const url = parseHttpsUrl(raw);
  if (!url || !ALLOWED_HOSTS.has(url.hostname)) return null;
  return url.toString();
}

export function allowlistedImageUrl(raw: unknown): string | null {
  const url = parseHttpsUrl(raw);
  if (!url) return null;
  if (
    !ALLOWED_HOSTS.has(url.hostname) &&
    !url.hostname.endsWith(".rakuten.co.jp") &&
    url.hostname !== "webservice.rakuten.co.jp"
  ) {
    return null;
  }
  return url.toString();
}

function providerLinks(nameJa: string): TourismProvider[] {
  return [
    {
      id: "rakuten",
      label: "楽天トラベルで探す",
      href: rakutenPrefectureSearchUrl(),
    },
    {
      id: "jalan",
      label: "じゃらんで探す",
      href: jalanSearchUrl(nameJa),
    },
  ];
}

function emptyResult(
  nameJa: string,
  status: TourismFetchResult["status"],
  message: string,
): TourismFetchResult {
  return {
    status,
    message,
    listings: [],
    providers: providerLinks(nameJa),
    creditHtml: RAKUTEN_CREDIT_HTML,
  };
}

type RawHotel = {
  hotelBasicInfo?: Record<string, unknown>;
};

type RakutenPageResult =
  | { ok: true; doc: unknown }
  | {
      ok: false;
      status: TourismFetchResult["status"];
      message: string;
    };

function unwrapHotels(doc: unknown): RawHotel[] {
  if (!doc || typeof doc !== "object") return [];
  const hotels = (doc as { hotels?: unknown }).hotels;
  if (!Array.isArray(hotels)) return [];
  const out: RawHotel[] = [];
  for (const row of hotels) {
    if (!row || typeof row !== "object") continue;
    const hotel = (row as { hotel?: unknown[] }).hotel;
    if (Array.isArray(hotel)) {
      const basic = hotel.find((part) => part && typeof part === "object" && "hotelBasicInfo" in part);
      if (basic && typeof basic === "object") out.push(basic as RawHotel);
      continue;
    }
    if ("hotelBasicInfo" in (row as object)) out.push(row as RawHotel);
  }
  return out;
}

function resultPageCount(doc: unknown): number {
  if (!doc || typeof doc !== "object") return 1;
  const raw = (doc as { pagingInfo?: { pageCount?: unknown } }).pagingInfo?.pageCount;
  const count = Number(raw);
  return Number.isInteger(count) && count > 0 ? Math.min(count, 10) : 1;
}

export function normalizeRakutenHotels(
  doc: unknown,
  config: TourismAreaConfig,
): StayListing[] {
  const listings: StayListing[] = [];
  for (const hotel of unwrapHotels(doc)) {
    const info = hotel.hotelBasicInfo || {};
    const name = String(info.hotelName || "").trim();
    const address = `${String(info.address1 || "")}${String(info.address2 || "")}`.trim();
    if (!name || !address) continue;
    if (!addressMatchesArea(address, config.addressMatchers)) continue;
    const href = allowlistedUrl(info.hotelInformationUrl || info.planListUrl);
    if (!href) continue;
    const imageUrl = allowlistedImageUrl(info.hotelThumbnailUrl || info.hotelImageUrl);
    const blurb = String(info.hotelSpecial || "").trim().slice(0, 80) || null;
    listings.push({
      id: String(info.hotelNo || href),
      name,
      address,
      blurb,
      imageUrl,
      href,
      provider: "rakuten",
    });
    if (listings.length >= MAX_LISTINGS) break;
  }
  return listings;
}

async function fetchRakutenPage(
  creds: RakutenCredentials,
  config: TourismAreaConfig,
  page: number,
): Promise<RakutenPageResult> {
  const qs = new URLSearchParams({
    applicationId: creds.applicationId,
    format: "json",
    formatVersion: "2",
    largeClassCode: config.rakuten.largeClassCode,
    middleClassCode: config.rakuten.middleClassCode,
    smallClassCode: config.rakuten.smallClassCode,
    datumType: "1",
    responseType: "small",
    hits: "30",
    page: String(page),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // 2026 API は Referer/Origin 必須。登録サイトと揃える。
    const res = await fetch(`${RAKUTEN_SEARCH}?${qs}`, {
      headers: {
        Accept: "application/json",
        accessKey: creds.accessKey,
        "User-Agent": "saigaiban/0.1 (+https://saigaiban.com)",
        Referer: "https://saigaiban.com/support",
        Origin: "https://saigaiban.com",
      },
      signal: controller.signal,
    });
    if (res.status === 429) {
      return { ok: false, status: "rate_limited", message: "いま混み合っています。下の公式検索から探してください。" };
    }
    if (res.status === 503) {
      return { ok: false, status: "maintenance", message: "予約サービスの保守中です。下の公式検索から探してください。" };
    }
    if (!res.ok) {
      return { ok: false, status: "error", message: "宿の一覧を取得できませんでした。下の公式検索から探してください。" };
    }
    return { ok: true, doc: await res.json() };
  } catch {
    return { ok: false, status: "error", message: "宿の一覧を取得できませんでした。下の公式検索から探してください。" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 町の宿一覧を返す。キーが無い／失敗しても公式検索リンクは必ず付ける。
 * 秘密はログにもレスポンスにも出さない。
 */
export async function fetchTourismForArea(
  slug: string,
  nameJa: string,
  creds: RakutenCredentials | null,
): Promise<TourismFetchResult> {
  const config = tourismAreaConfig(slug);
  if (!config) {
    return emptyResult(nameJa, "unsupported", "この町の宿泊一覧はまだ用意していません。");
  }

  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  if (!creds) {
    return emptyResult(
      nameJa,
      "unconfigured",
      "宿の一覧は準備中です。下の公式検索から探してください。",
    );
  }

  const pages: StayListing[] = [];
  let lastError: TourismFetchResult | null = null;
  let pageLimit = 1;
  for (let page = 1; page <= pageLimit && pages.length < MAX_LISTINGS; page += 1) {
    const result = await fetchRakutenPage(creds, config, page);
    if (!result.ok) {
      lastError = emptyResult(nameJa, result.status, result.message);
      break;
    }
    const batch = normalizeRakutenHotels(result.doc, config);
    pages.push(...batch);
    pageLimit = resultPageCount(result.doc);
  }

  if (lastError && pages.length === 0) {
    return lastError;
  }

  const value: TourismFetchResult = {
    status: "ok",
    message:
      pages.length === 0
        ? "この町に該当する宿が見つかりませんでした。下の公式検索も見てください。"
        : "泊まることで地域を応援できます。空室・料金・安全は予約先で確認してください。",
    listings: pages.slice(0, MAX_LISTINGS),
    providers: providerLinks(nameJa),
    creditHtml: RAKUTEN_CREDIT_HTML,
  };
  cache.set(slug, { at: Date.now(), value });
  return value;
}

/** テスト用にキャッシュを空にする。 */
export function clearTourismCache(): void {
  cache.clear();
}
