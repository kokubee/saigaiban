import { categoryLabel, isShelter, prefName } from "./labels.ts";
import { officialHubUrl, officialSupportUrl } from "./opennavi.ts";
import type { BoardMeta, BoardPlace } from "./types.ts";

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
.cards{display:grid;gap:10px}
@media(min-width:720px){.cards.towns{grid-template-columns:1fr 1fr 1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.card h3{margin:0 0 4px;font-size:1rem}
.tag{display:inline-block;background:#f0d9c2;color:#6a2e0d;font-size:.75rem;font-weight:700;padding:1px 7px;border-radius:999px;margin-right:6px}
.pref{margin:22px 0 8px;font-weight:700}
nav a{margin-right:12px}
.foot{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
`;

function page(opts: { title: string; description: string; canonical: string; body: string }): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="canonical" href="${escapeHtml(opts.canonical)}">
<style>${CSS}</style>
</head>
<body>
<div class="banner">ここは公式の窓口ではありません。場所の営業や開設は、地図と公式ハブで確認してください。</div>
<div class="wrap">${opts.body}</div>
</body>
</html>`;
}

export function renderHome(site: string, origin: string, meta: BoardMeta): string {
  const byPref = new Map<string, typeof meta.areas>();
  for (const area of meta.areas) {
    const key = area.prefCode || "00";
    const list = byPref.get(key) || [];
    list.push(area);
    byPref.set(key, list);
  }
  const groups = [...byPref.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const towns = groups
    .map(([code, areas]) => {
      const cards = areas
        .sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"))
        .map(
          (a) => `<a class="card" href="/a/${escapeHtml(a.slug)}"><h3>${escapeHtml(a.nameJa)}</h3><p class="note">未確認の場所カード</p></a>`,
        )
        .join("");
      return `<h2 class="pref">${escapeHtml(prefName(code))}</h2><div class="cards towns">${cards}</div>`;
    })
    .join("");
  return page({
    title: "災害板 — 場所ごとのいまどうか",
    description: `${meta.disaster.label}の町ごとに、場所のカードを未確認から立てています。公式ではありません。`,
    canonical: `${site}/`,
    body: `
      <nav><a href="/">災害板</a><a href="/about">この板について</a><a href="${escapeHtml(officialSupportUrl(origin))}">公式の支援窓口</a></nav>
      <h1>災害板</h1>
      <p class="lead">${escapeHtml(meta.disaster.label)}について、場所ごとの「いまどうか」を書く板です。匿名の雑談スレではありません。</p>
      <p class="note">カードは場所の名前と位置だけです。開いている保証はありません。公式の案内は <a href="${escapeHtml(origin)}">OpenNavi</a> へ。</p>
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
): string {
  const area = meta.areas.find((a) => a.slug === slug);
  if (!area) return renderNotFound(site);
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
      const cards = shown.map((p) => renderCard(p)).join("");
      const extra =
        more > 0
          ? `<p class="note"><a href="/a/${escapeHtml(slug)}?all=1">この種別の未確認をすべて見る（あと${more}件）</a></p>`
          : "";
      return `<h2>${escapeHtml(categoryLabel(cat))}</h2><div class="cards">${cards}</div>${extra}`;
    })
    .join("");
  return page({
    title: `${area.nameJa}の災害板`,
    description: `${area.nameJa}の場所カード。いまの営業や開設は未確認です。公式ではありません。`,
    canonical: `${site}/a/${slug}`,
    body: `
      <nav><a href="/">災害板</a><a href="/about">この板について</a><a href="${escapeHtml(officialHubUrl(origin, slug))}">${escapeHtml(area.nameJa)}の公式ハブ</a></nav>
      <h1>${escapeHtml(area.nameJa)}の災害板</h1>
      <p class="lead">ここに並ぶのは場所の正体です。すべてのカードは未確認です。店の営業は地図、避難所の開設は公式ハブで確認してください。</p>
      ${sections || `<p class="note">この町の場所カードはまだありません。</p>`}
      ${footer(origin, meta)}
    `,
  });
}

function renderCard(place: BoardPlace): string {
  const shelter = isShelter(place.category)
    ? `<p class="note">指定場所の台帳です。いま開いている避難所とは限りません。</p>`
    : "";
  const maps = place.maps_url
    ? `<p><a href="${escapeHtml(place.maps_url)}" rel="noopener">地図で見る</a></p>`
    : "";
  const addr = place.address ? `<p class="note">${escapeHtml(place.address)}</p>` : "";
  return `<article class="card">
    <h3><span class="tag">未確認</span>${escapeHtml(place.name)}</h3>
    ${addr}${shelter}${maps}
  </article>`;
}

export function renderAbout(site: string, origin: string): string {
  return page({
    title: "この板について — 災害板",
    description: "災害板は公式ハブではありません。OpenNavi の場所台帳から、町ごとの未確認カードを立てます。人と人の仲介はしません。",
    canonical: `${site}/about`,
    body: `
      <nav><a href="/">災害板</a><a href="${escapeHtml(origin)}">OpenNavi（公式ハブ）</a></nav>
      <h1>この板について</h1>
      <p class="lead">災害板は、場所ごとの「いまどうか」を書くための板です。自治体や社協の公式発表の代わりにはなりません。</p>
      <h2>すること</h2>
      <p>OpenNavi が開いた町について、店や避難所などの場所カードを自動で立てます。最初の表示はすべて未確認です。</p>
      <h2>しないこと</h2>
      <ul>
        <li>公式窓口の代わりにはならない</li>
        <li>場所台帳を「営業中」「開設中」として出さない</li>
        <li>匿名の雑談スレにしない</li>
        <li>人と人の仲介、住所つきのマッチングはしない</li>
      </ul>
      <h2>公式ハブとの関係</h2>
      <p>場所の名前と位置は <a href="${escapeHtml(origin)}">OpenNavi</a> の台帳から受け取っています。義援金・物資・災害ボランティアの受付は <a href="${escapeHtml(officialSupportUrl(origin))}">公式の支援ページ</a> を見てください。</p>
      ${footer(origin, null)}
    `,
  });
}

export function renderNotFound(site: string): string {
  return page({
    title: "見つかりません — 災害板",
    description: "指定した町の板はありません。",
    canonical: `${site}/`,
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
