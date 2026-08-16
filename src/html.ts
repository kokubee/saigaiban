import { CATEGORY_FILTERS, categoryDescription, categoryLabel, isShelter, isShopLike, isKnownCategory, prefName } from "./labels.ts";
import { googleMapsSearchUrl } from "./maps.ts";
import { KUMAMOTO_RESIDENT_SUPPORT, KUMAMOTO_ROAD_MAP, officialHubUrl, officialSupportUrl, officialVictimUrl } from "./opennavi.ts";
import { evidenceLabel } from "./evidence.ts";
import { VERDICT_LABEL, VISITOR_VERDICTS, formatWhen } from "./reports.ts";
import { supportEventCategoryLabel, supportEventFreshnessLabel, supportEventStatusLabel } from "./support-events.ts";
import { tourismAreaConfig } from "./tourism-areas.ts";
import type { BoardMeta, BoardPlace, PlaceSummary, Report, SupportEventQueryResult, TourismFetchResult } from "./types.ts";
import { HANDOFF_SCHEMA, OPENNAVI_HANDOFF_PROFILE, OPENNAVI_PROTOCOL_NAME, OPENNAVI_PROTOCOL_VERSION, handoffApiUrl, legacyHandoffApiUrl } from "./protocol.ts";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

const CSS = `
:root{
  color-scheme:light;
  --bg:#eef7fb;
  --ink:#173247;
  --muted:#5c7180;
  --card:#ffffff;
  --line:#c8dce8;
  --accent:#0b6b78;
  --accent-strong:#07525f;
  --paper:#fbfdff;
  --mint:#dff4ed;
  --sky:#deeffc;
  --sun:#fff0c2;
  --coral:#ffe1d9;
  --lavender:#e8e7fb;
  --shadow:0 16px 42px rgb(34 83 105 / 10%);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;line-height:1.7}
body{position:relative;min-width:320px;overflow-x:hidden}
body::before,body::after{content:"";position:fixed;pointer-events:none;z-index:0;border-radius:999px;filter:blur(2px);opacity:.7}
body::before{width:42vw;height:42vw;max-width:620px;max-height:620px;top:-18vw;right:-12vw;background:radial-gradient(circle at 30% 35%,rgb(99 193 185 / 28%),transparent 62%)}
body::after{width:34vw;height:34vw;max-width:520px;max-height:520px;bottom:-14vw;left:-12vw;background:radial-gradient(circle at 50% 50%,rgb(252 190 89 / 20%),transparent 64%)}
a{color:var(--accent);text-underline-offset:3px}
a:hover{color:var(--accent-strong)}
.wrap{position:relative;z-index:1;max-width:1120px;margin:0 auto;padding:24px 20px 80px}
.banner{position:relative;z-index:2;background:linear-gradient(90deg,#15536b 0%,#0b6b78 52%,#2a7e82 100%);color:#f5fdff;padding:11px 20px;font-size:.92rem;letter-spacing:.01em;box-shadow:0 4px 18px rgb(10 78 96 / 14%)}
.banner a{color:#f2ffd0}
.wrap>nav:first-child{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 44px;padding:8px 10px;border:1px solid rgb(255 255 255 / 75%);border-radius:16px;background:rgb(255 255 255 / 74%);box-shadow:0 8px 24px rgb(32 86 107 / 8%);backdrop-filter:blur(12px)}
.wrap>nav:first-child a{display:inline-flex;align-items:center;min-height:40px;padding:7px 12px;border-radius:10px;text-decoration:none;font-weight:700;color:var(--ink);transition:background .2s ease,transform .2s ease}
.wrap>nav:first-child a:first-child{background:var(--accent);color:#fff}
.wrap>nav:first-child a:hover{background:var(--sky);transform:translateY(-1px)}
.wrap>nav:first-child a:first-child:hover{background:var(--accent-strong);color:#fff}
.lead{max-width:68ch;font-size:clamp(1.05rem,1.7vw,1.25rem);line-height:1.8;color:#29495c;margin:0 0 22px}
.note{color:var(--muted);font-size:.92rem}
.wrap>h1{position:relative;max-width:20ch;width:100%;margin:0 0 14px;font-size:clamp(2.35rem,6vw,4.75rem);line-height:1.1;letter-spacing:-.045em;font-weight:800;color:#123d51}
.wrap>h1::after{content:"";display:block;width:78px;height:7px;margin-top:18px;border-radius:99px;background:linear-gradient(90deg,#f4b647 0 36%,#e88067 36% 69%,#62b8af 69% 100%);box-shadow:0 6px 16px rgb(229 145 91 / 20%)}
h2{font-size:clamp(1.2rem,2.3vw,1.55rem);line-height:1.25;margin:46px 0 12px;letter-spacing:-.02em}
.wrap>h2{display:flex;align-items:center;gap:12px}
.wrap>h2::after{content:"";height:1px;flex:1;background:linear-gradient(90deg,var(--line),transparent)}
form{margin:18px 0}
label{display:block;margin:12px 0 5px;font-weight:700;color:#24485b}
select,textarea,button{font:inherit}
select,textarea{width:100%;max-width:32rem;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);box-shadow:inset 0 1px 0 rgb(255 255 255 / 80%)}
select:focus,textarea:focus,.search-form input:focus{outline:3px solid rgb(11 107 120 / 22%);outline-offset:1px;border-color:var(--accent)}
.check{display:flex;gap:8px;align-items:flex-start;margin:12px 0;font-weight:400}
.check input{margin-top:.35em;accent-color:var(--accent)}
.owner{background:var(--mint);border:1px solid #acdacc;border-radius:14px;padding:12px 14px;margin:12px 0}
.flag{display:inline-flex;gap:6px;align-items:center;margin-left:8px}
.flag select,.flag button{font-size:.8rem;padding:4px 7px;margin:0}
textarea{min-height:5.2rem}
button{background:var(--accent);color:#fff;border:0;border-radius:12px;padding:10px 18px;margin-top:10px;font-weight:800;cursor:pointer;box-shadow:0 6px 14px rgb(8 86 98 / 18%);transition:transform .2s ease,background .2s ease,box-shadow .2s ease}
button:hover{background:var(--accent-strong);transform:translateY(-1px);box-shadow:0 8px 18px rgb(8 86 98 / 24%)}
button:active{transform:translateY(1px) scale(.98)}
.flash{background:var(--mint);border:1px solid #acdacc;padding:12px 14px;border-radius:14px;color:#18554e}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px;grid-auto-flow:dense}
.cards.towns{grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}
.card{--card-accent:var(--accent);position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 18px 16px;box-shadow:var(--shadow);transition:transform .24s ease,box-shadow .24s ease,border-color .24s ease;text-decoration:none;color:var(--ink)}
.card::before{content:"";display:block;width:54px;height:5px;margin-bottom:12px;border-radius:99px;background:var(--card-accent)}
.card:nth-child(4n+2){--card-accent:#e47d63;background:linear-gradient(145deg,#fff 0%,#fff7f1 100%)}
.card:nth-child(4n+3){--card-accent:#e0ad39;background:linear-gradient(145deg,#fff 0%,#fffbed 100%)}
.card:nth-child(4n+4){--card-accent:#756fc0;background:linear-gradient(145deg,#fff 0%,#f6f5ff 100%)}
.card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--card-accent) 46%,var(--line));box-shadow:0 22px 46px rgb(35 82 105 / 16%)}
.card h3{margin:0 0 6px;font-size:1.06rem;line-height:1.45;color:var(--ink)}
.card p{margin:8px 0}
.card>a{color:inherit}
.tag{display:inline-block;background:var(--sun);border:1px solid #efd896;color:#6d4b0e;font-size:.75rem;font-weight:800;line-height:1.4;padding:2px 8px;border-radius:999px;margin-right:7px;vertical-align:2px}
.pref{margin:22px 0 8px;font-weight:800}
nav a{margin-right:0}
.area-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 12px}
.area-tab{display:inline-block;background:rgb(255 255 255 / 76%);border:1px solid var(--line);border-radius:999px;padding:7px 13px;text-decoration:none;margin:0;transition:transform .2s ease,background .2s ease}
.area-tab:hover{transform:translateY(-1px);background:var(--sky)}
.area-tab[aria-current="page"]{background:var(--accent);border-color:var(--accent);color:#fff}
.town-tools{position:relative;isolation:isolate;background:linear-gradient(135deg,#ffffff 0%,#e4f5f4 58%,#fff2cc 100%);border:1px solid #b8d9dc;border-radius:20px;padding:20px;margin:28px 0 18px;box-shadow:0 18px 38px rgb(47 111 122 / 12%)}
.town-tools::after{content:"";position:absolute;inset:auto 18px 0 auto;width:86px;height:5px;border-radius:99px;background:#e8896d;opacity:.85}
.town-tools h2{margin:0 0 10px;font-size:1.1rem}
.category-filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 16px}
.category-filter{display:inline-block;border:1px solid #b9d5df;border-radius:999px;background:rgb(255 255 255 / 80%);padding:7px 12px;text-decoration:none;transition:transform .2s ease,background .2s ease,border-color .2s ease}
.category-filter:hover{transform:translateY(-1px);background:var(--sky);border-color:#86b9c8}
.category-filter[aria-current="page"]{background:var(--accent);border-color:var(--accent);color:#fff}
.category-note{color:var(--muted);font-size:.9rem;margin:-3px 0 10px}
.search-form{display:flex;gap:8px;max-width:40rem}
.search-form input{flex:1;min-width:0;padding:11px 13px;border:1px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink)}
.search-form button{margin:0;white-space:nowrap}
.result-count{margin:10px 0 0;color:var(--muted);font-size:.9rem}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.support-grid{display:grid;gap:14px}
@media(min-width:720px){.support-grid{grid-template-columns:1fr 1fr}}
.support-card{background:linear-gradient(145deg,#fff 0%,#eef8ff 100%);border:1px solid #bcdce9;border-radius:18px;padding:18px;box-shadow:var(--shadow)}
.support-card h2,.support-card h3{margin-top:0}
.event-list{display:grid;gap:12px}
.event-card{background:#fff;border:1px solid var(--line);border-left:6px solid #e4ad3a;border-radius:14px;padding:14px 16px;box-shadow:0 10px 26px rgb(44 84 100 / 8%)}
.event-card h3{margin:0 0 5px;font-size:1.03rem}
.event-meta{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0;color:var(--muted);font-size:.88rem}
.event-meta .tag{margin:0}
.caution{background:var(--sun);border:1px solid #efd896;border-left:5px solid #d29b23;padding:12px 14px;margin:16px 0;border-radius:12px;color:#664b16}
.provider-links{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.provider-links a{display:inline-block;border:1px solid var(--accent);border-radius:12px;padding:9px 12px;text-decoration:none;background:#fff;color:var(--accent);font-weight:700}
.provider-links a:hover{background:var(--accent);color:#fff}
.stay{display:grid;grid-template-columns:96px 1fr;gap:12px}
.stay img{width:96px;height:72px;object-fit:cover;border-radius:10px;background:#e9f2f7}
.stay h3{margin:0 0 3px}
.credit{margin:18px 0}
.table-wrap{overflow-x:auto;margin:14px 0}.table-wrap table{width:100%;min-width:760px;border-collapse:collapse;font-size:.85rem;line-height:1.55}.table-wrap th,.table-wrap td{padding:9px 10px;border:1px solid var(--line);vertical-align:top;text-align:left}.table-wrap thead th{white-space:nowrap;background:var(--sky)}.table-wrap tbody th{white-space:nowrap;background:#f4fafc}
.legal-toc{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--paper);font-size:.9rem}.legal-toc a{text-decoration:none}.legal-toc a+a::before{content:"・";color:var(--muted);margin-right:8px}.legal-hold{margin:16px 0;padding:12px 14px;border-left:4px solid #d29b23;background:var(--sun);border-radius:0 12px 12px 0}
.foot{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}.foot a{color:var(--accent)}
.analytics-consent{position:fixed;right:16px;bottom:16px;z-index:20;max-width:min(520px,calc(100vw - 32px));padding:14px 16px;border:1px solid #b9d6df;border-radius:16px;background:rgb(255 255 255 / 96%);box-shadow:0 18px 48px rgb(20 65 83 / 18%)}
.analytics-consent p{margin:0 0 8px}.analytics-consent button{margin:0 6px 0 0}.analytics-consent a{font-size:.9rem}
@keyframes soft-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion:no-preference){
  .wrap>h1,.wrap>.lead,.town-tools{animation:soft-rise .55s cubic-bezier(.16,1,.3,1) both}
  .wrap>.lead{animation-delay:.06s}
  .town-tools{animation-delay:.12s}
  .cards .card{animation:soft-rise .5s cubic-bezier(.16,1,.3,1) both}
  .cards .card:nth-child(2){animation-delay:.04s}.cards .card:nth-child(3){animation-delay:.08s}.cards .card:nth-child(4){animation-delay:.12s}
}
@media(max-width:719px){
  .wrap{padding:18px 14px 56px}
  .wrap>nav:first-child{margin-bottom:32px;gap:6px}
  .wrap>nav:first-child a{min-height:38px;padding:6px 10px;font-size:.9rem}
  .wrap>h1{font-size:clamp(2.15rem,11vw,3.25rem)}
  .town-tools{padding:16px;margin-top:24px}
  .search-form{display:grid;grid-template-columns:1fr auto}
  .search-form input{width:100%}
  .cards{grid-template-columns:1fr}
  .card{padding:16px}
  .stay{grid-template-columns:80px 1fr}.stay img{width:80px;height:64px}
}
`;

/** GA4。測定IDが無い／不正なら何も出さない。個人情報は送らない。 */
export function gaSnippet(measurementId: string | null | undefined): string {
  const id = String(measurementId || "").trim();
  if (!/^G-[A-Z0-9]+$/i.test(id)) return "";
  const safe = escapeHtml(id);
  return `<script>
(function(){
  var key='saigaiban_analytics_consent_v1';
  function cookie(name){var m=document.cookie.match(new RegExp('(?:^|; )'+name+'=([^;]*)'));return m?decodeURIComponent(m[1]):'';}
  function load(){
    if(document.getElementById('ga4-gtag')) return;
    window.dataLayer=window.dataLayer||[]; window.gtag=function(){window.dataLayer.push(arguments);};
    window.gtag('js',new Date()); /* gtag('config', '${safe}') is sent only after consent. */ window.gtag('config','${safe}',{send_page_view:false});
    var s=document.createElement('script'); s.id='ga4-gtag'; s.async=true; s.src='https://www.googletagmanager.com/gtag/js?id=${safe}'; document.head.appendChild(s);
    window.gtag('event','page_view',{page_path:location.pathname,page_location:location.origin+location.pathname,page_title:document.title});
  }
  function set(v){document.cookie=key+'='+encodeURIComponent(v)+'; Max-Age=31536000; Path=/; SameSite=Lax'; location.reload();}
  document.addEventListener('DOMContentLoaded',function(){var b=document.getElementById('analytics-consent');var c=cookie(key);if(c==='granted') load();if(!b||c) return;b.hidden=false;b.querySelector('[data-analytics-allow]').addEventListener('click',function(){set('granted')});b.querySelector('[data-analytics-deny]').addEventListener('click',function(){set('denied')});});
})();
</script>`;
}

function page(opts: {
  title: string;
  description: string;
  canonical: string;
  body: string;
  measurementId?: string | null;
}): string {
  const site = new URL(opts.canonical).origin;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="canonical" href="${escapeHtml(opts.canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="災害板">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.description)}">
<meta property="og:url" content="${escapeHtml(opts.canonical)}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(opts.title)}">
<meta name="twitter:description" content="${escapeHtml(opts.description)}">
<script type="application/ld+json">${jsonForHtml({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${site}/#website`, name: "災害板", url: `${site}/`, inLanguage: "ja" },
      { "@type": "WebPage", "@id": `${opts.canonical}#webpage`, url: opts.canonical, name: opts.title, description: opts.description, inLanguage: "ja", isPartOf: { "@id": `${site}/#website` } },
    ],
  })}</script>
<style>${CSS}</style>
${gaSnippet(opts.measurementId)}</head>
<body>
<div class="banner">ここは公式の窓口ではありません。場所の営業や開設は、地図と公式ハブで確認してください。</div>
<aside id="analytics-consent" class="analytics-consent" hidden><p>アクセス解析（Google Analytics）を許可しますか？拒否しても災害情報は閲覧できます。</p><button type="button" data-analytics-allow>許可する</button><button type="button" data-analytics-deny>許可しない</button> <a href="/legal#privacy">詳しく見る</a></aside>
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
  const victimUrl = officialVictimUrl(origin);
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
      <nav><a href="/">災害板</a><a href="/about">この板について</a><a href="${escapeHtml(victimUrl)}">OpenNavi（被災者向け）</a></nav>
      <h1>災害板</h1>
      <p class="lead">${escapeHtml(meta.disaster.label)}について、場所ごとの「いまどうか」を書く板です。匿名の雑談スレではありません。</p>
      <p class="note">まず都道府県と市区町村を選びます。場所一覧と投稿は市区町村ページを開いた時だけ読み込みます。自治体・インフラの公式情報は <a href="${escapeHtml(victimUrl)}">OpenNaviの被災者向け入口</a> へ。</p>
      <section class="support-card external-entry" aria-labelledby="kumamoto-entry-title">
        <h2 id="kumamoto-entry-title">熊本の情報・支援先</h2>
        <p>熊本の被災者向け情報は専用ナビに集約しています。支援する方はOpenNaviの支援先ページから熊本を選んでください。</p>
        <div class="provider-links">
          <a href="${KUMAMOTO_RESIDENT_SUPPORT}" target="_blank" rel="noreferrer"><strong>くまもと被災者支援ナビ ↗</strong><span>給水・支援金・り災証明など</span></a>
          <a href="${KUMAMOTO_ROAD_MAP}" target="_blank" rel="noreferrer"><strong>国土交通省 通れるマップ ↗</strong><span>道路の通行規制・緊急車両が通れる区間</span></a>
          <a href="${escapeHtml(officialSupportUrl(origin))}?destination=kumamoto"><strong>熊本を外から支援する ↗</strong><span>公式支援・寄付・買って支援・旅して支援</span></a>
        </div>
      </section>
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
  allowPosting = false,
  selectedCategory?: string,
  searchQuery?: string,
  supportEvents: SupportEventQueryResult = { available: false, events: [] },
): string {
  const area = meta.areas.find((a) => a.slug === slug);
  if (!area) return renderNotFound(site, measurementId);
  const category = selectedCategory && isKnownCategory(selectedCategory) ? selectedCategory : "";
  const query = String(searchQuery || "").trim().slice(0, 40);
  const normalizedQuery = query.toLocaleLowerCase("ja-JP");
  const categoryPlaces = category ? places.filter((place) => place.category === category) : places;
  const filteredPlaces = normalizedQuery
    ? categoryPlaces.filter((place) => [place.name, place.address || "", categoryLabel(place.category)].join(" ").toLocaleLowerCase("ja-JP").includes(normalizedQuery))
    : categoryPlaces;
  const orderedPlaces = [...filteredPlaces].sort((a, b) => comparePlaceActivity(a, b, summaries));
  const byCat = new Map<string, BoardPlace[]>();
  for (const place of orderedPlaces) {
    const list = byCat.get(place.category) || [];
    list.push(place);
    byCat.set(place.category, list);
  }
  const preview = showAll || Boolean(category || query) ? Infinity : 6;
  const queryString = (nextCategory = category) => {
    const params = new URLSearchParams();
    if (nextCategory) params.set("category", nextCategory);
    if (query) params.set("q", query);
    return params.toString();
  };
  const primaryFilterIds = new Set(["conv", "gas", "food", "hinanjo"]);
  const filterCategories = CATEGORY_FILTERS.filter(({ id }) => isKnownCategory(id) && (primaryFilterIds.has(id) || id === category || places.some((place) => place.category === id))).filter(({ label }, index, all) => all.findIndex((item) => item.label === label) === index);
  const filterLinks = [`<a class="category-filter" href="/a/${escapeHtml(slug)}${queryString() ? `?${escapeHtml(queryString(""))}` : ""}"${category ? "" : " aria-current=\"page\""}>すべて</a>`, ...filterCategories.map(({ id, label }) => {
    const qs = queryString(id);
    return `<a class="category-filter" href="/a/${escapeHtml(slug)}?${escapeHtml(qs)}"${category === id ? " aria-current=\"page\"" : ""}>${escapeHtml(label)}</a>`;
  })].join("");
  const sections = [...byCat.entries()]
    .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0]), "ja"))
    .map(([cat, list]) => {
      const shown = list.slice(0, preview);
      const more = list.length - shown.length;
      const cards = shown.map((p) => renderCard(slug, area.nameJa, p, summaries.get(p.id), allowPosting)).join("");
      const extra =
        more > 0
          ? `<p class="note"><a href="/a/${escapeHtml(slug)}?${escapeHtml(queryString(cat))}&all=1">この種別をすべて見る（あと${more}件）</a></p>`
          : "";
      return `<h2>${escapeHtml(categoryLabel(cat))}</h2><p class="category-note">${escapeHtml(categoryDescription(cat))}</p><div class="cards">${cards}</div>${extra}`;
    })
    .join("");
  const tools = `<section class="town-tools" aria-labelledby="town-tools-title">
    <h2 id="town-tools-title">まず探す場所を絞る</h2>
    <nav class="category-filters" aria-label="場所のカテゴリ">${filterLinks}</nav>
    <form class="search-form" method="get" action="/a/${escapeHtml(slug)}">
      ${category ? `<input type="hidden" name="category" value="${escapeHtml(category)}">` : ""}
      <label class="sr-only" for="town-search">場所を検索</label>
      <input id="town-search" name="q" type="search" maxlength="40" value="${escapeHtml(query)}" placeholder="店名・施設名・住所で検索">
      <button type="submit">検索</button>
    </form>
    <p class="result-count">${orderedPlaces.length}件表示${category ? `・${escapeHtml(categoryLabel(category))}` : ""}${query ? `・「${escapeHtml(query)}」` : ""}・最近の報告がある場所を上位表示</p>
  </section>`;
  return page({
    title: `${area.nameJa}の災害板`,
    description: `${area.nameJa}の場所カード。投稿は見た時点の話です。公式ではありません。`,
    canonical: `${site}/a/${slug}`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/about">この板について</a><a href="${escapeHtml(officialHubUrl(origin, slug))}">${escapeHtml(area.nameJa)}の公式ハブ</a></nav>
      <h1>${escapeHtml(area.nameJa)}の災害板</h1>
      <p class="lead">${allowPosting ? "場所の正体に、「いまどうだったか」を書けます。" : "場所ごとのこれまでの報告を確認できます。"} 投稿は見た時点の話で、公式ではありません。店の営業は地図、避難所の開設は公式ハブで確認してください。</p>
      ${tools}
      ${renderSupportEvents(origin, area.nameJa, supportEvents)}
      ${sections || `<p class="note">条件に合う場所がありません。カテゴリを戻すか、検索語を短くしてみてください。</p>`}
      ${footer(origin, meta, slug)}
    `,
  });
}

function renderSupportEvents(origin: string, areaName: string, result: SupportEventQueryResult): string {
  if (!result.available) return "";
  const official = officialSupportUrl(origin);
  if (!result.events.length) {
    return `<section class="support-card" aria-labelledby="support-events-title">
      <h2 id="support-events-title">${escapeHtml(areaName)}の支援イベント</h2>
      <p class="note">この板で確認できる物資配布・炊き出し等はまだありません。最新の公式情報は <a href="${escapeHtml(official)}">OpenNaviの支援ページ</a> で確認してください。</p>
    </section>`;
  }
  const cards = result.events.map((event) => {
    const address = event.address ? `<br><span class="note">${escapeHtml(event.address)}</span>` : "";
    const eligibility = event.eligibility ? `<p><strong>対象:</strong> ${escapeHtml(event.eligibility)}</p>` : "";
    const description = event.description ? `<p>${escapeHtml(event.description)}</p>` : "";
    const contact = event.contactNote ? `<p class="note">${escapeHtml(event.contactNote)}</p>` : "";
    const freshness = supportEventFreshnessLabel(event.freshness);
    const mapsUrl = googleMapsSearchUrl(event.venue, areaName, event.address);
    return `<article class="event-card">
      <h3><span class="tag">${escapeHtml(supportEventStatusLabel(event.status))}</span>${escapeHtml(event.title)}</h3>
      <div class="event-meta"><span>${escapeHtml(supportEventCategoryLabel(event.category))}</span><span>確認: ${escapeHtml(formatEventDate(event.checkedAt))}・${escapeHtml(freshness)}</span></div>
      <p><strong>日時:</strong> ${escapeHtml(formatEventRange(event.startsAt, event.endsAt))}</p>
      <p><strong>会場:</strong> ${escapeHtml(event.venue)}${address ? `<br>${address}` : ""}</p>
      <p><strong>主催:</strong> ${escapeHtml(event.organizer)}</p>
      ${eligibility}${description}${contact}
      <p>${mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" rel="noopener">会場をGoogleマップで確認</a> ・ ` : ""}<a href="${escapeHtml(event.sourceUrl)}" rel="noopener">掲載元の公式ページを確認する</a></p>
    </article>`;
  }).join("");
  return `<section class="support-card" aria-labelledby="support-events-title">
    <h2 id="support-events-title">${escapeHtml(areaName)}の支援イベント</h2>
    <p class="note">日時・会場・受付状態は掲載元の公式ページで必ず確認してください。災害板は受付や予約を行いません。</p>
    <div class="event-list">${cards}</div>
  </section>`;
}

function formatEventDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "不明";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
}

function formatEventRange(startsAt: string, endsAt: string): string {
  return `${formatEventDate(startsAt)}〜${formatEventDate(endsAt)}`;
}

function renderCard(slug: string, areaName: string, place: BoardPlace, summary?: PlaceSummary, allowPosting = false): string {
  const owner = summary?.latestOwner;
  const latest = summary?.latest;
  const mapsUrl = googleMapsSearchUrl(place.name, areaName, place.address);
  const steerMaps = Boolean(owner && (owner.prefer_maps || owner.verdict === "maps") && mapsUrl);
  const ownerEvidence = owner?.evidence || { authority: "operator", review: "unknown", freshness: "unknown" } as const;
  const tag = steerMaps
    ? `<span class="tag">店側 地図へ</span>`
    : owner
      ? `<span class="tag">店側 ${escapeHtml(VERDICT_LABEL[owner.verdict])}</span>`
      : latest
        ? `<span class="tag">投稿 ${escapeHtml(VERDICT_LABEL[latest.verdict])}</span>`
        : `<span class="tag">未確認</span>`;
  const ownerLine = owner
    ? steerMaps
      ? `<div class="owner"><p>店側は、営業を Google マップの情報へ寄せています（${escapeHtml(evidenceLabel(ownerEvidence))}）。</p><p><a href="${escapeHtml(mapsUrl)}" rel="noopener">Googleマップの営業情報を見る</a></p></div>`
      : `<p class="note">店側の自己申告: ${escapeHtml(VERDICT_LABEL[owner.verdict])}（${escapeHtml(formatWhen(owner.created_at))}・${escapeHtml(activityWindowLabel(owner.created_at))}・${escapeHtml(evidenceLabel(ownerEvidence))}）</p>`
    : "";
  const latestLine = !steerMaps && latest && latest.role !== "owner"
    ? `<p class="note">見かけた人: ${escapeHtml(VERDICT_LABEL[latest.verdict])}（${escapeHtml(formatWhen(latest.created_at))}・${escapeHtml(activityWindowLabel(latest.created_at))}・${escapeHtml(evidenceLabel(latest.evidence || { authority: "resident", review: "unknown", freshness: "unknown" }))}）</p>`
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
    <p>${maps}${maps ? " ・ " : ""}<a href="/a/${escapeHtml(slug)}/p/${escapeHtml(place.id)}">${allowPosting ? "いまどうかを書く" : "これまでの報告を見る"}</a></p>
  </article>`;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function activityWindowLabel(iso: string, now = Date.now()): string {
  const created = Date.parse(iso);
  if (!Number.isFinite(created) || created > now) return "時刻不明";
  const age = now - created;
  if (age <= SIX_HOURS_MS) return "直近6時間";
  if (age <= TWELVE_HOURS_MS) return "6〜12時間前";
  if (age <= DAY_MS) return "12〜24時間前";
  return "24時間超";
}

function activityRank(summary: PlaceSummary | undefined, now = Date.now()): [number, number, number] {
  const latest = summary?.latest;
  if (!latest) return [4, 0, 0];
  const created = Date.parse(latest.created_at);
  if (!Number.isFinite(created) || created > now) return [4, 0, summary?.count || 0];
  const age = now - created;
  const bucket = age <= SIX_HOURS_MS ? 0 : age <= TWELVE_HOURS_MS ? 1 : age <= DAY_MS ? 2 : 3;
  return [bucket, -created, -(summary?.count || 0)];
}

function comparePlaceActivity(a: BoardPlace, b: BoardPlace, summaries: Map<string, PlaceSummary>): number {
  const ar = activityRank(summaries.get(a.id));
  const br = activityRank(summaries.get(b.id));
  return ar[0] - br[0] || ar[1] - br[1] || ar[2] - br[2] || a.name.localeCompare(b.name, "ja");
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
  allowPosting = false,
  turnstileSiteKey?: string | null,
  allowReporting = false,
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
            const flag = allowReporting ? `<form class="flag" method="post" action="/api/reports/${escapeHtml(r.id)}/flag"><select name="reason" aria-label="通報理由"><option value="misleading">内容が不正確</option><option value="privacy">個人情報</option><option value="unsafe">危険な内容</option><option value="other">その他</option></select><label class="check"><input type="checkbox" name="legal_consent" required>規約・ポリシーに同意</label><button type="submit">通報</button></form>` : "";
            return `<li>${escapeHtml(formatWhen(r.created_at))}　${escapeHtml(who)}　${escapeHtml(VERDICT_LABEL[r.verdict])}　${escapeHtml(evidenceLabel(evidence))}${maps}${note}${flag}</li>`;
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
  const postingNotice = allowPosting
    ? ""
    : `<p class="caution">現在は投稿受付を停止しています。最新情報は <a href="${escapeHtml(officialHubUrl(origin, slug))}">公式ハブ</a> で確認してください。</p>`;
  const reportForm = allowPosting
    ? `<form method="post" action="/a/${escapeHtml(slug)}/p/${escapeHtml(place.id)}">
        ${ownerFields}
        <label for="verdict">いまどうだったか</label>
        <select id="verdict" name="verdict">
          <option value="">選んでください</option>
          ${options}
        </select>
        <label for="note">短いメモ（任意・80字まで）</label>
        <textarea id="note" name="note" maxlength="80" placeholder="例: 15時ごろ、棚は少なかった"></textarea>
        <label class="check"><input type="checkbox" name="legal_consent" required> <a href="/legal#terms">利用規約</a>と<a href="/legal#privacy">プライバシーポリシー</a>を確認し、投稿に同意します。</label>
        <div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey || "")}" data-action="report_submit"></div>
        <button type="submit">投稿する</button>
      </form><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  return page({
    title: `${place.name} — ${nameJa}の災害板`,
    description: `${place.name}のいまどうか。投稿は見た時点の話です。公式ではありません。`,
    canonical: `${site}/a/${slug}/p/${place.id}`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/a/${escapeHtml(slug)}">${escapeHtml(nameJa)}</a><a href="${escapeHtml(officialHubUrl(origin, slug))}">公式ハブ</a></nav>
      <h1>${escapeHtml(place.name)}</h1>
      <p class="lead">${allowPosting ? "見たときの様子、または店側の自己申告を書けます。" : "見たときの様子や、これまでの報告を確認できます。"} 氏名・電話・待ち合わせは受けません。公式発表の代わりにはなりません。</p>
      ${shelter}${maps}
      ${notice ? `<p class="flash">${escapeHtml(notice)}</p>` : ""}
      ${postingNotice}${reportForm}
      <h2>これまでの投稿</h2>
      ${history}
      ${footer(origin, meta, slug)}
    `,
  });
}

export function renderAbout(site: string, origin: string, measurementId?: string | null): string {
  const victimUrl = officialVictimUrl(origin);
  return page({
    title: "この板について — 災害板",
    description: "災害板は、平時から場所マスターを準備し、災害時にすぐ使えるようにしておく掲示板です。現地サイトの開設後は、そちらへ引き継ぎます。",
    canonical: `${site}/about`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/protocol/opennavi/v1">OpenNavi Protocol</a><a href="${escapeHtml(victimUrl)}">OpenNavi（被災者向け）</a></nav>
      <h1>この板について</h1>
      <p class="lead">災害板は、OpenNaviが持つ場所マスターを平時から受け取り、災害が起きた地域ですぐ開けるよう準備している災害時の入口です。現地の公式サイトや専用サイトが立ち上がったら、最新情報の正本をそちらへ引き継ぎます。自治体・社協などの公式発表や支援窓口の代わりにはなりません。</p>
      <h2>平時から準備していること</h2>
      <p>OpenNaviの場所マスター（名前・位置・種別）をもとに、市区町村ごとの場所カードをいつでも開ける形に保ちます。災害が起きる前から、場所の正体を整えておくことで、発災時にゼロから台帳を作らずに済むようにします。</p>
      <h2>災害が起きたとき</h2>
      <p>対象地域の場所カードをすぐ表示し、公開済みの現地報告を場所ごとに確認できるようにします。カードは最初から未確認です。投稿は見た時点の補足であり、営業中・開設中・安全を保証するものではありません。</p>
      <h2>現地サイトへの引き継ぎ</h2>
      <p>自治体や地域の運営者による現地サイトが立ち上がったら、最新情報の正本と公式案内は現地サイトへ移します。災害板は場所マスターと公開済みの補足を読み取り専用のOpenNavi Protocol API（<code>/api/opennavi/v1/handoff/{area-slug}</code>）で渡し、現地サイト側の案内を優先する役割に切り替えます。受け渡し手順は<a href="/protocol/opennavi/v1">OpenNavi Protocol v1の仕様書</a>で確認できます。</p>
      <h2>OpenNaviとの使い分け</h2>
      <ul>
        <li>被災地で場所を探す、見た様子を書く → この災害版</li>
        <li>公式発表を確認する → <a href="${escapeHtml(victimUrl)}">OpenNaviの被災者向け入口</a></li>
      </ul>
      <h2>災害板がしないこと</h2>
      <ul>
        <li>公式窓口の代わりにはならない</li>
        <li>支援者向けの公式情報・義援金・物資・災害ボランティア案内をここでまとめない</li>
        <li>場所台帳を「営業中」「開設中」として出さない</li>
        <li>匿名の雑談スレにしない</li>
        <li>人と人の仲介、住所つきのマッチングはしない</li>
      </ul>
      <h2>公式ハブとの関係</h2>
      <p>場所の名前と位置は <a href="${escapeHtml(victimUrl)}">OpenNaviの被災者向け入口</a> の台帳から受け取り、災害版の報告は現地の補足として扱います。被災地の外から支援する案内は <a href="${escapeHtml(officialSupportUrl(origin))}">OpenNaviの公式支援ページ</a> を見てください。災害版の支援URLはOpenNaviへ案内します。</p>
      ${footer(origin, null)}
    `,
  });
}

export function renderProtocol(site: string, origin: string, measurementId?: string | null): string {
  const normalizedSite = site.replace(/\/+$/, "");
  const discoveryUrl = `${normalizedSite}/.well-known/opennavi.json`;
  const handoffUrl = handoffApiUrl(normalizedSite);
  const legacyUrl = legacyHandoffApiUrl(normalizedSite);
  return page({
    title: "OpenNavi Protocol v1 — 災害板",
    description: "災害板から現地サイトへ場所マスターと公開済みの最新補足を引き継ぐための仕様です。",
    canonical: `${normalizedSite}/protocol/opennavi/v1`,
    measurementId,
    body: `
      <nav><a href="/">災害板</a><a href="/about">この板について</a><a href="${escapeHtml(discoveryUrl)}">機械向け発見情報</a></nav>
      <h1>${OPENNAVI_PROTOCOL_NAME} v${escapeHtml(OPENNAVI_PROTOCOL_VERSION)}</h1>
      <p class="lead">災害板が平時から準備している場所マスターを、自治体や地域運営者の現地サイトへ安全に引き継ぐための公開仕様です。</p>
      <section class="support-card">
        <h2>現地サイト運営者の手順</h2>
        <ol>
          <li><a href="${escapeHtml(discoveryUrl)}"><code>${escapeHtml(discoveryUrl)}</code></a>を取得し、対応プロファイルを確認します。</li>
          <li>正規API <code>${escapeHtml(handoffUrl)}</code> に地域slugを入れてGETします。</li>
          <li><code>pagination.nextCursor</code> がある間は、<code>?cursor=...</code>で続きのページを取得します。</li>
          <li><code>handoff.phase</code>と<code>handoff.next</code>を保存し、現地サイトが立ち上がったら現地サイトを正本にします。</li>
        </ol>
      </section>
      <h2>引き継がれる情報</h2>
      <ul>
        <li>場所ID、名前、市区町村、カテゴリ</li>
        <li>公開された位置、住所、出典、データ基準日</li>
        <li>公開済みで非表示になっていない最新報告と報告件数</li>
      </ul>
      <h2>引き継がれない情報</h2>
      <ul>
        <li>電話番号、個人名、待ち合わせ、連絡先</li>
        <li>非表示報告、管理者用ID、レビュー内部値</li>
        <li>座標入りの地図URLや、OpenNavi・災害板の内部フィールド</li>
      </ul>
      <h2>正本の扱い</h2>
      <p>現在の災害板は<code>prepared</code>フェーズです。<code>handoff.next</code>は<code>local-site</code>を示します。現地サイトが立ち上がった後は、自治体・事業者・社協などの一次情報と現地サイトの案内を正本として扱い、災害板の住民報告を公式情報へ昇格させません。</p>
      <h2>エンドポイント</h2>
      <ul>
        <li>正規: <a href="${escapeHtml(handoffUrl)}"><code>${escapeHtml(handoffUrl)}</code></a></li>
        <li>互換: <a href="${escapeHtml(legacyUrl)}"><code>${escapeHtml(legacyUrl)}</code></a></li>
        <li>上流の場所マスター: <a href="${escapeHtml(`${origin.replace(/\/+$/, "")}/api/board/places`)}"><code>${escapeHtml(`${origin.replace(/\/+$/, "")}/api/board/places`)}</code></a></li>
      </ul>
      <p class="note">プロファイル: <code>${OPENNAVI_HANDOFF_PROFILE}</code> ／ レスポンススキーマ: <code>${HANDOFF_SCHEMA}</code> ／ GET・OPTIONS・CORS対応、書き込みなし。</p>
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
      ${footer(origin, meta, slug)}
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

function footer(origin: string, meta: BoardMeta | null, slug?: string): string {
  return `<footer class="foot">
    <p>場所台帳: <a href="https://www.openstreetmap.org/copyright" rel="license noopener">© OpenStreetMap contributors</a>（ODbL）</p>
    <p>避難所台帳: <a href="https://web2.gsi.go.jp/bousaichiri/hinanbasho-menseki.html" rel="noopener">国土地理院「指定緊急避難場所・指定避難所データ」</a>（利用上の注意に従って利用）</p>
    <p class="note">避難所データは台帳であり、開設中とは限りません。最新状況は自治体・公式ハブで確認してください。</p>
    <p>OpenNavi被災者向け入口: <a href="${escapeHtml(officialVictimUrl(origin, slug))}">${escapeHtml(officialVictimUrl(origin, slug))}</a></p>
    <p><a href="/legal#terms">利用規約</a> · <a href="/legal#privacy">プライバシーポリシー</a> · <a href="/legal#research">研究利用について</a></p>
  </footer>`;
}

export function renderLegal(
  site: string,
  origin: string,
  _kind: "legal" | "terms" | "privacy" | "research",
  measurementId?: string | null,
): string {
  const updated = "2026年8月16日";
  const researchSection = `<section id="research"><h2>統計情報と研究利用について</h2><p>災害版では、サービスの利用状況を個人との対応関係がない統計情報に加工し、運用報告、研究、論文、学会発表等で利用・公表することがあります。</p><p>対象となるのは、期間別・地域別・情報カテゴリ別の閲覧件数、利用件数、掲載データ件数、応答時間などの集計情報です。</p><p>IPアドレス、投稿本文、通報本文、検索語、個人単位の閲覧履歴、その他個人を識別または推測できる情報は公表しません。少人数の地域や時間帯については、他の区分とまとめるなど、個人が推測されない形に加工します。</p><p>個人単位の行動履歴、投稿本文、通報本文などを研究対象として利用する場合は、この統計利用とは分け、研究案件ごとに目的と対象データを説明して別途同意を取得します。拒否しても閲覧や通常利用を妨げません。</p></section>`;
  const body = `<nav><a href="/">災害板</a><a href="/about">この板について</a></nav><h1>利用規約・プライバシー・研究利用</h1><p class="lead">災害版の利用条件、情報の取扱い、研究利用を一つにまとめています。</p><p class="note">最終更新日：${updated}</p><nav class="legal-toc" aria-label="法務情報の目次"><a href="#terms">利用規約</a><a href="#privacy">プライバシー</a><a href="#research">研究利用</a></nav><section id="terms"><h2>利用規約</h2><p>災害情報の閲覧に同意を強制せず、投稿・通報の入口で利用条件を確認します。</p><p>災害版は見た時点の現地報告を扱う掲示板で、自治体、気象庁、消防、OpenNaviその他の公式発表や緊急通報の代わりではありません。投稿は未確認情報として扱われます。</p><p>氏名、電話番号、住所、現在地、待ち合わせ、病名などの個人情報、虚偽・なりすまし・差別・脅迫・救助を装う投稿、不正アクセスを禁止します。危険、個人情報、誤情報を含む投稿は非表示・削除することがあります。</p><p>外部サービスの運営者は災害版とは別です。安全確保のため投稿受付を変更・停止することがあります。本規約は日本法に準拠します。問い合わせはOpenNaviの<a href="${escapeHtml(officialVictimUrl(origin))}">お問い合わせ</a>から送信してください。</p></section><section id="privacy"><h2>プライバシーポリシー</h2><p>災害版運営が情報を取り扱います。自治体、社協、外部投稿サービス、OpenNaviとは別サービスです。運営者の正式な名称・住所は、本人からの請求に応じて遅滞なく開示します。</p><p>投稿・通報の本文、地域、時刻、同意した規約・ポリシーの版と日時、Turnstile検証結果、レート制限用のIP由来識別子、許可された解析情報を、投稿公開、確認、不正利用対策、問い合わせ対応、障害調査、安全な運用、サービス改善のために扱います。</p><h3>外部送信・委託</h3><div class="table-wrap"><table><thead><tr><th>送信先</th><th>送信情報</th><th>目的</th><th>保存・設定</th><th>停止・拒否</th></tr></thead><tbody><tr><th>災害版運営</th><td>現地報告・通報本文、地域、時刻、同意版・日時、Turnstile結果、IP由来識別子</td><td>投稿公開、通報対応、安全運用</td><td>Cloudflare基盤・運用ログ。目的に必要な期間だけ保存</td><td>投稿・通報を送信しない</td></tr><tr><th>Cloudflare, Inc.（Cloudflare）</th><td>IP、ブラウザ・通信メタデータ</td><td>ホスティング、配信、防御</td><td>Cloudflareの契約・ログ設定</td><td>各社設定に依存</td></tr><tr><th><a href="https://marketingplatform.google.com/about/analytics/terms/jp/" target="_blank" rel="noreferrer">Google LLC（Google Analytics）</a></th><td>許可後のページ閲覧、Cookie等の識別子</td><td>利用状況の把握と改善</td><td>同意後のみ。Google側の保持設定</td><td>同意バナーで拒否、Cookie削除</td></tr><tr><th>OpenNavi運営</th><td>災害版から公式ハブへ遷移した事実と通常のHTTPアクセス</td><td>公式情報への案内</td><td>OpenNavi側のポリシーに従う</td><td>遷移しない</td></tr></tbody></table></div><p>アクセス解析は初期状態で無効です。拒否しても閲覧を妨げません。各情報は利用目的に必要な期間だけ保存し、目的達成後または不要となった情報を削除・匿名化します。法令上保存が必要な情報は、その期間保持します。</p><p>個人情報の開示・訂正・削除・利用停止は、OpenNaviの<a href="${escapeHtml(officialVictimUrl(origin))}">お問い合わせ窓口</a>から請求してください。</p></section><section id="research"><h2>研究利用について</h2><p>研究・論文への利用は、サービス利用やアクセス解析とは別の任意同意です。この説明だけで包括的な研究同意を取得しません。</p><p>研究利用開始日は2026年8月16日（案件ごとの同意取得後）です。それ以前の投稿本文、Cloudflareアクセスログ、Google Analytics過去データ、Webhook・通報・確認履歴、IP由来識別子、その他の運用ログは研究利用へ転用しません。</p><p>研究案件ごとに対象、匿名化、公表範囲、保存期間、撤回方法を説明して同意を取得します。拒否しても閲覧や通常利用を妨げません。</p></section>`;
  return page({ title: "利用規約・プライバシー・研究利用｜災害板", description: "災害版の利用規約、プライバシーポリシー、研究利用方針", canonical: `${site}/legal`, measurementId, body: `${body.replace(/<section id="research">[\s\S]*?<\/section>$/, researchSection).replace("統計情報と研究利用について", "統計情報の利用について")}${footer(origin, null)}` });
}

export function renderRobots(site: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /health\nSitemap: ${site}/sitemap.xml\n`;
}

export function renderLlms(site: string, origin: string): string {
  return `# 災害板

> 災害時に、OpenNaviの場所台帳をもとに市区町村ごとの場所カードと、見た時点の現地報告を表示する掲示板です。

災害板は自治体・気象庁・消防・事業者の公式発表、緊急通報、避難所の開設判断、寄付や予約の受付を代替しません。カードや投稿は公式確認ではなく、最新状況は一次情報で確認してください。

## 公開していること
- 市区町村ごとの場所カードと、場所に紐づく現地報告
- 未確認、住民報告、店側の自己申告、古い可能性の区別
- 掲載元の公式URLと確認日時がある支援イベント（公開設定時）
- OpenNaviの被災者向け公式ハブへの導線
- 利用規約・プライバシーポリシー・統計情報の利用方針

## しないこと
- 支援者向けの義援金、支援物資、災害ボランティアの公式一覧を災害板で管理しない（OpenNaviへ案内する）
- 被災者向けの日時付き支援イベントも、掲載元の公式URLと確認日時があるものだけを表示する
- 地域全体の停電・断水を場所報告へ混在させない
- 人探し、個人宅への直接支援、住所・電話・待ち合わせの仲介をしない
- 未確認のSNS投稿を公式情報として掲載しない

## 主要ページ
- ${site}/ — 都道府県・市区町村の入口
- ${site}/about — 災害版とOpenNaviの役割分担
- ${site}/protocol/opennavi/v1 — 現地サイト運営者向けOpenNavi Protocol仕様
- ${site}/legal — 利用規約・プライバシー・統計情報の利用方針
- ${site}/robots.txt — クロール方針
- ${site}/sitemap.xml — 公開ページ一覧
- ${site}/.well-known/opennavi.json — OpenNavi Protocolの対応情報
- ${site}/api/opennavi/v1/handoff/{area-slug} — 現地サイトへ引き継ぐための公開読み取りAPI（続きは?cursor=...）
- ${origin}/ — OpenNaviの被災者向け公式ハブ
- ${origin}/support — 支援者向け公式情報

## データの扱い
場所の正体はOpenNaviの公開APIから読み込みます。現地サイトが立ち上がったら、そちらを正本として扱ってください。投稿が存在しても、営業中・開設中・安全を保証するものではありません。災害版の公開情報は、取得時点と投稿時点を基準に扱います。
`;
}

export function renderSitemap(site: string, slugs: string[]): string {
  const urls = [`${site}/`, `${site}/about`, `${site}/legal`, ...slugs.map((s) => `${site}/a/${s}`)];
  const body = urls
    .map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
