import { categoryLabel, isShelter, isShopLike, prefName } from "./labels.ts";
import { googleMapsSearchUrl } from "./maps.ts";
import { officialHubUrl, officialSupportUrl } from "./opennavi.ts";
import { evidenceLabel } from "./evidence.ts";
import { VERDICT_LABEL, VISITOR_VERDICTS, formatWhen } from "./reports.ts";
import { tourismAreaConfig } from "./tourism-areas.ts";
import type { BoardMeta, BoardPlace, PlaceSummary, Report, TourismFetchResult } from "./types.ts";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `
:root{--bg:#f3efe4;--ink:#2a241c;--muted:#6d6458;--card:#fffaf1;--line:#d7cbb6;--accent:#8a3b12;--paper:#fffdf8}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.65}
a{color:var(--accent)}
.wrap{max-width:920px;margin:0 auto;padding:20px 16px 64px}
.banner{background:#5c2a12;color:#fff8ee;padding:10px 16px;font-size:.92rem}
.banner a{color:#ffe0c2}
.lead{font-size:1.05rem}
.note{color:var(--muted);font-size:.92rem}
h1{font-size:1.55rem;margin:12px 0 8px}
h2{font-size:1.1rem;margin:28px 0 10px}
form{margin:16px 0}
label{display:block;margin:10px 0 4px;font-weight:700}
select,textarea,button{font:inherit}
select,textarea{width:100%;max-width:28rem;padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff}
.check{display:flex;gap:8px;align-items:flex-start;margin:10px 0;font-weight:400}
.owner{background:#fff4e8;border:1px solid #e8c8a0;border-radius:8px;padding:10px 12px;margin:10px 0}
textarea{min-height:4.5rem}
button{background:var(--accent);color:#fff8ee;border:0;border-radius:8px;padding:8px 16px;margin-top:10px}
.flash{background:#fff3d6;border:1px solid #e0c48a;padding:10px 12px;border-radius:8px}
.cards{display:grid;gap:10px}
@media(min-width:720px){.cards.towns{grid-template-columns:1fr 1fr 1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.card h3{margin:0 0 4px;font-size:1rem}
.tag{display:inline-block;background:#f0d9c2;color:#6a2e0d;font-size:.75rem;font-weight:700;padding:1px 7px;border-radius:999px;margin-right:6px}
.pref{margin:22px 0 8px;font-weight:700}
nav a{margin-right:12px}
.area-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 10px}
.area-tab{display:inline-block;background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;margin:0}
.area-tab[aria-current="page"]{background:var(--accent);border-color:var(--accent);color:#fff8ee}
.support-grid{display:grid;gap:12px}
@media(min-width:720px){.support-grid{grid-template-columns:1fr 1fr}}
.support-card{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:14px}
.support-card h2,.support-card h3{margin-top:0}
.caution{background:#fff3d6;border-left:4px solid #9c621c;padding:10px 12px;margin:14px 0}
.provider-links{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.provider-links a{display:inline-block;border:1px solid var(--accent);border-radius:8px;padding:7px 11px;text-decoration:none}
.stay{display:grid;grid-template-columns:96px 1fr;gap:12px}
.stay img{width:96px;height:72px;object-fit:cover;border-radius:6px;background:#eee}
.stay h3{margin:0 0 3px}
.credit{margin:18px 0}
.foot{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
`;

/** GA4。測定IDが無い／不正なら何も出さない。個人情報は送らない。 */
export function gaSnippet(measurementId: string | null | undefined): string {
  const id = String(measurementId || "").trim();
  if (!/^G-[A-Z0-9]+$/i.test(id)) return "";
  const safe = escapeHtml(id);
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${safe}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${safe}');
</script>
`;
}

function page(opts: {
  title: string;
  description: string;
  canonical: string;
  body: string;
  measurementId?: string | null;
}): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="canonical" href="${escapeHtml(opts.canonical)}">
<style>${CSS}</style>
${gaSnippet(opts.measurementId)}</head>
<body>
<div class="banner">ここは公式の窓口ではありません。場所の営業や開設は、地図と公式ハブで確認してください。</div>
<div class="wrap">${opts.body}</div>
</body>
</html>`;
}

export function renderHome(
  site: string,
  origin: string,
  meta: BoardMeta,
  measurementId?: string | null,
  selectedPref?: string | null,
): string {
  const byPref = new Map<string, typeof meta.areas>();
  for (const area of meta.areas) {
    const key = area.prefCode || "00";
    const list = byPref.get(key) || [];
    list.push(area);
    byPref.set(key, list);
  }
  const groups = [...byPref.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const activeCode = groups.some(([code]) => code === selectedPref)
    ? String(selectedPref)
    : groups[0]?.[0] || "";
  const activeAreas = (groups.find(([code]) => code === activeCode)?.[1] || [])
    .slice()
    .sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"));
  const tabs = groups.length
    ? `<nav class="area-tabs" aria-label="都道府県">${groups
        .map(([code]) => {
          const current = code === activeCode ? ` aria-current="page"` : "";
          return `<a class="area-tab" href="/?pref=${encodeURIComponent(code)}"${current}>${escapeHtml(prefName(code))}</a>`;
        })
        .join("")}</nav>`
    : "";
  const towns = activeAreas.length
    ? `<h2 class="pref">${escapeHtml(prefName(activeCode))}の市区町村</h2><div class="cards towns">${activeAreas
        .map(
          (a) => `<a class="card" href="/a/${escapeHtml(a.slug)}"><h3>${escapeHtml(a.nameJa)}</h3><p class="note">市区町村ページで場所一覧を開く</p></a>`,
        )
        .join("")}</div>`
    : `<p class="note">開いている市区町村はまだありません。</p>`;
  return page({
    title: "災害板 — 場所ごとのいまどうか",
    description: `${meta.disaster.label}の町ごとに、場所のカードを未確認から立てています。公式ではありません。`,
    canonical: `${site}/`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/about">この板について</a><a href="${escapeHtml(origin)}">OpenNavi（公式ハブ）</a></nav>
      <h1>災害板</h1>
      <p class="lead">${escapeHtml(meta.disaster.label)}について、場所ごとの「いまどうか」を書く板です。匿名の雑談スレではありません。</p>
      <p class="note">まず都道府県と市区町村を選びます。場所一覧と投稿は市区町村ページを開いた時だけ読み込みます。案内は <a href="${escapeHtml(origin)}">OpenNavi</a> へ。</p>
      ${tabs}
      ${towns}
      ${footer(origin, meta)}
    `,
  });
}

export function renderTown(
  site: string,
  origin: string,
  meta: BoardMeta,
  slug: string,
  places: BoardPlace[],
  showAll: boolean,
  summaries: Map<string, PlaceSummary>,
  measurementId?: string | null,
): string {
  const area = meta.areas.find((a) => a.slug === slug);
  if (!area) return renderNotFound(site, measurementId);
  const byCat = new Map<string, BoardPlace[]>();
  for (const place of places) {
    const list = byCat.get(place.category) || [];
    list.push(place);
    byCat.set(place.category, list);
  }
  const preview = showAll ? Infinity : 6;
  const sections = [...byCat.entries()]
    .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0]), "ja"))
    .map(([cat, list]) => {
      const shown = list.slice(0, preview);
      const more = list.length - shown.length;
      const cards = shown.map((p) => renderCard(slug, area.nameJa, p, summaries.get(p.id))).join("");
      const extra =
        more > 0
          ? `<p class="note"><a href="/a/${escapeHtml(slug)}?all=1">この種別をすべて見る（あと${more}件）</a></p>`
          : "";
      return `<h2>${escapeHtml(categoryLabel(cat))}</h2><div class="cards">${cards}</div>${extra}`;
    })
    .join("");
  return page({
    title: `${area.nameJa}の災害板`,
    description: `${area.nameJa}の場所カード。投稿は見た時点の話です。公式ではありません。`,
    canonical: `${site}/a/${slug}`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/about">この板について</a><a href="${escapeHtml(officialHubUrl(origin, slug))}">${escapeHtml(area.nameJa)}の公式ハブ</a></nav>
      <h1>${escapeHtml(area.nameJa)}の災害板</h1>
      <p class="lead">場所の正体に、「いまどうだったか」を書けます。投稿は見た時点の話で、公式ではありません。店の営業は地図、避難所の開設は公式ハブで確認してください。</p>
      ${sections || `<p class="note">この町の場所カードはまだありません。</p>`}
      ${footer(origin, meta)}
    `,
  });
}

function renderCard(slug: string, areaName: string, place: BoardPlace, summary?: PlaceSummary): string {
  const owner = summary?.latestOwner;
  const latest = summary?.latest;
  const mapsUrl = googleMapsSearchUrl(place.name, areaName, place.address);
  const steerMaps = Boolean(owner && (owner.prefer_maps || owner.verdict === "maps") && mapsUrl);
  const tag = steerMaps
    ? `<span class="tag">店側 地図へ</span>`
    : owner
      ? `<span class="tag">店側 ${escapeHtml(VERDICT_LABEL[owner.verdict])}</span>`
      : latest
        ? `<span class="tag">投稿 ${escapeHtml(VERDICT_LABEL[latest.verdict])}</span>`
        : `<span class="tag">未確認</span>`;
  const ownerLine = owner
    ? steerMaps
      ? `<div class="owner"><p>店側は、営業を Google マップの情報へ寄せています。自己申告で、公式確認ではありません。</p><p><a href="${escapeHtml(mapsUrl)}" rel="noopener">Googleマップの営業情報を見る</a></p></div>`
      : `<p class="note">店側の自己申告: ${escapeHtml(VERDICT_LABEL[owner.verdict])}（${escapeHtml(formatWhen(owner.created_at))}・公式ではない）</p>`
    : "";
  const latestLine = !steerMaps && latest && latest.role !== "owner"
    ? `<p class="note">見かけた人: ${escapeHtml(VERDICT_LABEL[latest.verdict])}（${escapeHtml(formatWhen(latest.created_at))}・${escapeHtml(evidenceLabel(latest.evidence || { authority: "resident", review: "unknown", freshness: "unknown" }))}）</p>`
    : !owner && !latest
      ? `<p class="note">まだ投稿はありません。</p>`
      : "";
  const shelter = isShelter(place.category)
    ? `<p class="note">指定場所の台帳です。いま開いている避難所とは限りません。</p>`
    : "";
  const maps = !steerMaps && mapsUrl
    ? `<a href="${escapeHtml(mapsUrl)}" rel="noopener">地図で見る</a>`
    : "";
  const addr = place.address ? `<p class="note">${escapeHtml(place.address)}</p>` : "";
  return `<article class="card">
    <h3>${tag}${escapeHtml(place.name)}</h3>
    ${addr}${shelter}${ownerLine}${latestLine}
    <p>${maps}${maps ? " ・ " : ""}<a href="/a/${escapeHtml(slug)}/p/${escapeHtml(place.id)}">いまどうかを書く</a></p>
  </article>`;
}

export function renderPlace(
  site: string,
  origin: string,
  meta: BoardMeta,
  slug: string,
  place: BoardPlace,
  reports: Report[],
  notice: string | null,
  measurementId?: string | null,
): string {
  const area = meta.areas.find((a) => a.slug === slug);
  const nameJa = area?.nameJa || slug;
  const mapsUrl = googleMapsSearchUrl(place.name, nameJa, place.address);
  const options = VISITOR_VERDICTS.map(
    (v) => `<option value="${v}">${escapeHtml(VERDICT_LABEL[v])}</option>`,
  ).join("");
  const history =
    reports.length === 0
      ? `<p class="note">まだ投稿はありません。</p>`
      : `<ul>${reports
          .map((r) => {
            const who = r.role === "owner" ? "店側" : "見かけた人";
            const note = r.note ? ` — ${escapeHtml(r.note)}` : "";
            const maps = r.prefer_maps ? " / 地図へ寄せる" : "";
            const evidence = r.evidence || { authority: r.role === "owner" ? "operator" : "resident", review: "unknown", freshness: "unknown" } as const;
            return `<li>${escapeHtml(formatWhen(r.created_at))}　${escapeHtml(who)}　${escapeHtml(VERDICT_LABEL[r.verdict])}　${escapeHtml(evidenceLabel(evidence))}${maps}${note}</li>`;
          })
          .join("")}</ul>`;
  const shelter = isShelter(place.category)
    ? `<p class="note">指定場所の台帳です。開設中かどうかは公式ハブで確認してください。</p>`
    : "";
  const maps = mapsUrl
    ? `<p><a href="${escapeHtml(mapsUrl)}" rel="noopener">Googleマップを見る</a></p>`
    : "";
  const ownerFields = isShopLike(place.category)
    ? `
        <label for="role">どなたですか</label>
        <select id="role" name="role">
          <option value="visitor">見かけた人</option>
          <option value="owner">自分の店・施設です</option>
        </select>
        ${
          mapsUrl
            ? `<label class="check"><input type="checkbox" name="prefer_maps" value="1"> 店側の場合、営業は Google マップの情報を見てほしい（自己申告）</label>`
            : ""
        }
        <p class="note">店側の投稿も確認はしていません。Google マップの営業情報へ寄せることもできます。</p>
      `
    : `<input type="hidden" name="role" value="visitor">`;
  return page({
    title: `${place.name} — ${nameJa}の災害板`,
    description: `${place.name}のいまどうか。投稿は見た時点の話です。公式ではありません。`,
    canonical: `${site}/a/${slug}/p/${place.id}`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/a/${escapeHtml(slug)}">${escapeHtml(nameJa)}</a><a href="${escapeHtml(officialHubUrl(origin, slug))}">公式ハブ</a></nav>
      <h1>${escapeHtml(place.name)}</h1>
      <p class="lead">見たときの様子、または店側の自己申告を書けます。氏名・電話・待ち合わせは受けません。公式発表の代わりにはなりません。</p>
      ${shelter}${maps}
      ${notice ? `<p class="flash">${escapeHtml(notice)}</p>` : ""}
      <form method="post" action="/a/${escapeHtml(slug)}/p/${escapeHtml(place.id)}">
        ${ownerFields}
        <label for="verdict">いまどうだったか</label>
        <select id="verdict" name="verdict">
          <option value="">選んでください</option>
          ${options}
        </select>
        <label for="note">短いメモ（任意・80字まで）</label>
        <textarea id="note" name="note" maxlength="80" placeholder="例: 15時ごろ、棚は少なかった"></textarea>
        <button type="submit">投稿する</button>
      </form>
      <h2>これまでの投稿</h2>
      ${history}
      ${footer(origin, meta)}
    `,
  });
}

export function renderAbout(site: string, origin: string, measurementId?: string | null): string {
  return page({
    title: "この板について — 災害板",
    description: "災害版は有事の被災地で使う、場所ごとの現地報告板です。公式情報と支援者向けの案内はOpenNaviへ。",
    canonical: `${site}/about`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="${escapeHtml(origin)}">OpenNavi（公式ハブ）</a></nav>
      <h1>この板について</h1>
      <p class="lead">災害版は、被災地で場所を探し、見た時の「いまどうか」を共有するための板です。自治体・社協などの公式発表や支援窓口の代わりにはなりません。</p>
      <h2>OpenNaviとの使い分け</h2>
      <ul>
        <li>被災地で場所を探す、見た様子を書く → この災害版</li>
        <li>公式発表を確認する、被災地の外から支援する → <a href="${escapeHtml(origin)}">OpenNavi</a></li>
      </ul>
      <h2>すること</h2>
      <p>OpenNavi が開いた町について、店や避難所などの場所カードを自動で立てます。最初は未確認です。見かけた人も、店の人も書けます。店側は Google マップの営業情報へ寄せることもできます。どれも公式確認ではありません。</p>
      <h2>しないこと</h2>
      <ul>
        <li>公式窓口の代わりにはならない</li>
        <li>支援者向けの公式情報・義援金・物資・災害ボランティア案内をここでまとめない</li>
        <li>場所台帳を「営業中」「開設中」として出さない</li>
        <li>匿名の雑談スレにしない</li>
        <li>人と人の仲介、住所つきのマッチングはしない</li>
      </ul>
      <h2>公式ハブとの関係</h2>
      <p>場所の名前と位置は <a href="${escapeHtml(origin)}">OpenNavi</a> の台帳から受け取り、災害版の報告は現地の補足として扱います。公式情報や被災地の外から支援する案内は <a href="${escapeHtml(officialSupportUrl(origin))}">OpenNaviの公式支援ページ</a> を見てください。災害版の支援URLはOpenNaviへ案内します。</p>
      ${footer(origin, null)}
    `,
  });
}

export function renderSupport(
  site: string,
  origin: string,
  meta: BoardMeta,
  measurementId?: string | null,
): string {
  const towns = meta.areas
    .filter((area) => Boolean(tourismAreaConfig(area.slug)))
    .sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"))
    .map(
      (area) =>
        `<a class="card" href="/support/tourism/${escapeHtml(area.slug)}"><h3>${escapeHtml(area.nameJa)}</h3><p class="note">宿を探して地域を応援する</p></a>`,
    )
    .join("");
  return page({
    title: "被災地応援 — 災害板",
    description: "公式情報を確かめる窓口と、落ち着いてから地域を訪れて応援する宿泊導線です。",
    canonical: `${site}/support`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/about">この板について</a><a href="${escapeHtml(officialSupportUrl(origin))}">公式の支援窓口</a></nav>
      <h1>被災地応援</h1>
      <p class="lead">いま必要な公式情報を確かめることと、状況が落ち着いてから地域を訪れて応援することを分けて案内します。</p>
      <div class="support-grid">
        <section class="support-card">
          <h2>公式の支援情報はOpenNaviへ</h2>
          <p><a href="${escapeHtml(officialSupportUrl(origin))}">OpenNaviの支援ページ</a></p>
          <p>現在災害の県・市区町村・社会福祉協議会などが出している、義援金、物資、災害ボランティア、罹災証明などの公式情報をまとめています。</p>
          <p class="note">災害救助法の適用を目安に開いた地域の公式情報を、掲載元の原文と確認時刻つきで案内します。寄付や現地活動の前に、必ずOpenNaviから公式ページを確認してください。</p>
        </section>
      </div>
      <h2>泊まって地域を応援する</h2>
      <div class="caution"><strong>避難先の案内ではありません。</strong> 観光で訪れてよい状況かを公的情報で確認し、宿の営業・空室・交通・安全は予約先で確かめてください。</div>
      <p>地域を選ぶと、宿泊予約サービスで宿を探せます。価格や評価の比較は行いません。</p>
      <div class="cards towns">${towns || `<p class="note">案内できる地域はまだありません。</p>`}</div>
      ${footer(origin, meta)}
    `,
  });
}

export function renderTourism(
  site: string,
  origin: string,
  meta: BoardMeta,
  slug: string,
  result: TourismFetchResult,
  measurementId?: string | null,
): string {
  const area = meta.areas.find((a) => a.slug === slug);
  if (!area) return renderNotFound(site, measurementId);
  const listings = result.listings
    .map((stay) => {
      const image = stay.imageUrl
        ? `<img src="${escapeHtml(stay.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<div aria-hidden="true"></div>`;
      const blurb = stay.blurb ? `<p>${escapeHtml(stay.blurb)}</p>` : "";
      return `<article class="card stay">
        ${image}
        <div>
          <h3>${escapeHtml(stay.name)}</h3>
          <p class="note">${escapeHtml(stay.address)}</p>
          ${blurb}
          <p><a href="${escapeHtml(stay.href)}" rel="noopener">楽天トラベルで宿の詳細・空室を見る</a></p>
        </div>
      </article>`;
    })
    .join("");
  const providers = result.providers
    .map((p) => `<a href="${escapeHtml(p.href)}" rel="noopener">${escapeHtml(p.label)}</a>`)
    .join("");
  return page({
    title: `${area.nameJa}に泊まって応援 — 災害板`,
    description: `${area.nameJa}の宿を予約サービスで探し、訪れて地域を応援するための入口です。`,
    canonical: `${site}/support/tourism/${slug}`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/a/${escapeHtml(slug)}">${escapeHtml(area.nameJa)}の板</a><a href="${escapeHtml(officialHubUrl(origin, slug))}">公式ハブ</a><a href="${escapeHtml(officialSupportUrl(origin))}">支援者向け公式情報</a></nav>
      <h1>${escapeHtml(area.nameJa)}に泊まって応援</h1>
      <div class="caution"><strong>避難先の案内ではありません。</strong> 観光で訪れてよい状況かを公的情報で確認し、宿の営業・空室・料金・交通・安全は予約先で確かめてください。</div>
      <p class="lead">${escapeHtml(result.message)}</p>
      <div class="provider-links">${providers}</div>
      ${listings ? `<h2>楽天トラベルに掲載されている宿</h2><div class="cards">${listings}</div>` : ""}
      <div class="credit">${result.creditHtml}</div>
      <p class="note">予約は各サービス上で行います。災害板は予約を受け付けず、価格・評価・口コミの比較もしません。</p>
      ${footer(origin, meta)}
    `,
  });
}

export function renderNotFound(site: string, measurementId?: string | null): string {
  return page({
    title: "見つかりません — 災害板",
    description: "指定した町の板はありません。",
    canonical: `${site}/`,
    measurementId,
    body: `<h1>見つかりません</h1><p><a href="/">開いている町の一覧へ</a></p>`,
  });
}

function footer(origin: string, meta: BoardMeta | null): string {
  const osm = meta?.placeLicense?.osm || "地図データは OpenStreetMap の寄与者によるものです（ODbL）。";
  const gsi = meta?.placeLicense?.gsi || "指定緊急避難場所は国土地理院データを含みます。";
  return `<footer class="foot">
    <p>${escapeHtml(osm)}</p>
    <p>${escapeHtml(gsi)}</p>
    <p>公式ハブ: <a href="${escapeHtml(origin)}">${escapeHtml(origin)}</a></p>
  </footer>`;
}

export function renderRobots(site: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`;
}

export function renderSitemap(site: string, slugs: string[]): string {
  const urls = [`${site}/`, `${site}/about`, ...slugs.map((s) => `${site}/a/${s}`)];
  const body = urls
    .map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
