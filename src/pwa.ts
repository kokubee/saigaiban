import { OFFLINE_SNAPSHOT_MAX_BYTES, OFFLINE_SNAPSHOT_MAX_PLACES, OFFLINE_SNAPSHOT_SCHEMA } from "./offline.ts";

export const PWA_MANIFEST_PATH = "/manifest.webmanifest";
export const PWA_SERVICE_WORKER_PATH = "/sw.js";
export const PWA_OFFLINE_SHELL_PATH = "/pwa/offline-shell.html";
export const PWA_OFFLINE_SAVE_SCRIPT_PATH = "/pwa/offline-save.js";
export const PWA_OFFLINE_CLIENT_SCRIPT_PATH = "/pwa/offline-client.js";
export const PWA_ICON_PATH = "/pwa/icon.svg";

export function renderManifest(site: string): string {
  return JSON.stringify({
    name: "災害板 — 保存した地域",
    short_name: "災害板",
    start_url: `${site.replace(/\/+$/, "")}/`,
    scope: `${site.replace(/\/+$/, "")}/`,
    display: "standalone",
    background_color: "#eef7fb",
    theme_color: "#0f5c4c",
    lang: "ja",
    icons: [{ src: `${site.replace(/\/+$/, "")}${PWA_ICON_PATH}`, sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
  }, null, 2);
}

export function renderPwaIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="災害板"><rect width="512" height="512" rx="112" fill="#0f5c4c"/><path d="M256 90 390 148v96c0 92-58 164-134 198-76-34-134-106-134-198v-96z" fill="#eef7fb"/><path d="M177 251h158M177 312h111" fill="none" stroke="#0f5c4c" stroke-linecap="round" stroke-width="30"/><circle cx="177" cy="190" r="15" fill="#e4ad3a"/><circle cx="217" cy="190" r="15" fill="#e4ad3a"/><circle cx="257" cy="190" r="15" fill="#e4ad3a"/></svg>`;
}

export function renderServiceWorker(): string {
  return `const VERSION = "saigaiban-pwa-v1";
const SHELL = "${PWA_OFFLINE_SHELL_PATH}";
const STATIC_ASSETS = [
  SHELL,
  "${PWA_OFFLINE_CLIENT_SCRIPT_PATH}",
  "${PWA_OFFLINE_SAVE_SCRIPT_PATH}",
  "${PWA_MANIFEST_PATH}",
  "${PWA_ICON_PATH}",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && /^\\/a\\/[a-z0-9-]+\\/offline$/i.test(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(SHELL)));
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((cached) => cached || fetch(request)));
  }
});
`;
}

export function renderOfflineSaveClient(): string {
  return `const DB_NAME = "saigaiban-offline";
const STORE_NAME = "snapshots";
const SCHEMA = "${OFFLINE_SNAPSHOT_SCHEMA}";
const MAX_BYTES = ${OFFLINE_SNAPSHOT_MAX_BYTES};
const MAX_PLACES = ${OFFLINE_SNAPSHOT_MAX_PLACES};

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("このブラウザではオフライン保存を利用できません"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("端末の保存領域を開けませんでした"));
  });
}

function hasForbiddenKeys(value) {
  const forbidden = new Set(["moderation_status", "review_status", "owner_uid", "ownerUid", "token", "authorization", "note"]);
  const walk = (item) => {
    if (!item || typeof item !== "object") return false;
    if (Array.isArray(item)) return item.some(walk);
    return Object.entries(item).some(([key, child]) => forbidden.has(key) || walk(child));
  };
  return walk(value);
}

function validate(snapshot, slug) {
  if (!snapshot || snapshot.schema !== SCHEMA || snapshot.area?.slug !== slug) throw new Error("保存データの形式が不正です");
  if (!Array.isArray(snapshot.places) || snapshot.places.length > MAX_PLACES) throw new Error("保存対象が多すぎます");
  if (!Number.isFinite(snapshot.byteLength) || snapshot.byteLength > MAX_BYTES || new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_BYTES) throw new Error("保存データが大きすぎます");
  if (hasForbiddenKeys(snapshot)) throw new Error("保存できない項目が含まれています");
}

async function save(slug, snapshot) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(snapshot, slug);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(new Error("保存領域が不足しているか、保存に失敗しました"));
    tx.onabort = () => reject(new Error("保存領域が不足しているか、保存に失敗しました"));
  });
  db.close();
}

async function registerWorker() {
  if ("serviceWorker" in navigator) await navigator.serviceWorker.register("${PWA_SERVICE_WORKER_PATH}");
}

document.addEventListener("DOMContentLoaded", () => {
  void registerWorker().catch(() => {});
  for (const button of document.querySelectorAll("[data-offline-save]")) {
    button.addEventListener("click", async () => {
      const slug = button.getAttribute("data-area-slug") || "";
      const status = document.querySelector("[data-offline-status=\\\"" + slug + "\\\"]");
      if (!slug) return;
      button.disabled = true;
      if (status) status.textContent = "保存しています…";
      try {
        const response = await fetch("/api/offline-snapshot/" + encodeURIComponent(slug), { cache: "no-store", headers: { Accept: "application/json" } });
        const snapshot = await response.json().catch(() => null);
        if (!response.ok) throw new Error(snapshot?.error || "保存データを取得できませんでした");
        validate(snapshot, slug);
        await save(slug, snapshot);
        if (status) status.textContent = "保存しました（" + new Date(snapshot.capturedAt).toLocaleString("ja-JP") + "）。通信がないときは保存情報を表示できます。";
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "保存できませんでした";
      } finally {
        button.disabled = false;
      }
    });
  }
});
`;
}

export function renderOfflineClient(): string {
  return `const DB_NAME = "saigaiban-offline";
const STORE_NAME = "snapshots";

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("このブラウザではオフライン保存を利用できません"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("保存データを読み込めませんでした"));
  });
}

async function load(slug) {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(slug);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error("保存データを読み込めませんでした"));
    tx.oncomplete = () => db.close();
  });
}

async function remove(slug) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(slug);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(new Error("保存データを削除できませんでした"));
  });
  db.close();
}

async function fetchRevision(slug) {
  if (navigator.onLine === false) return null;
  const response = await fetch("/api/offline-revision/" + encodeURIComponent(slug), { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const revision = await response.json();
  if (revision?.schema !== "saigaiban.offline-revision/v1") return null;
  return revision;
}

function revisionMatches(snapshot, revision) {
  if (!revision) return true;
  const current = revision.reportRevision || {};
  const saved = snapshot.reportRevision || {};
  return snapshot.upstreamGeneratedAt === (revision.upstreamGeneratedAt || null)
    && (saved.latestCreatedAt || null) === (current.latestCreatedAt || null)
    && (saved.latestModeratedAt || null) === (current.latestModeratedAt || null);
}

function renderInvalidated(root, snapshot) {
  root.replaceChildren();
  root.append(text("h1", "保存情報を更新してください"));
  root.append(text("p", snapshot.area.nameJa + "の公開データに更新または非表示変更が見つかったため、古い保存内容は表示しません。", "lead"));
  root.append(text("p", "通信が戻っている場合は通常ページを開き、必要ならもう一度この地域を保存してください。", "caution"));
  const link = document.createElement("a");
  link.href = "/a/" + encodeURIComponent(snapshot.area.slug);
  link.textContent = "通常の地域ページを開く";
  root.append(link);
}

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = String(value || "");
  if (className) node.className = className;
  return node;
}

function verdictLabel(value) {
  return ({ open: "使えていた", limited: "制限があった", closed: "使えなかった", still: "前回と同じだった", changed: "変わっていた", maps: "Googleマップを見てほしい" })[value] || "未確認";
}

function evidenceLabel(evidence) {
  if (!evidence) return "未確認";
  const authority = evidence.authority === "operator" ? "店側の自己申告" : evidence.authority === "official" ? "公式情報" : "住民報告";
  const review = evidence.review === "confirmed" ? "確認済み" : evidence.review === "disputed" ? "相反あり" : "未確認";
  const freshness = evidence.freshness === "stale" ? "・古い可能性あり" : evidence.freshness === "expired" ? "・期限切れ・古い可能性あり" : "";
  return authority + "・" + review + freshness;
}

function safeLink(url, label) {
  if (typeof url !== "string" || !/^https:\\/\\/[^\\s<>]+$/i.test(url)) return null;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function render(snapshot) {
  const root = document.querySelector("[data-offline-root]");
  if (!root) return;
  root.replaceChildren();
  root.append(text("h1", snapshot.area.nameJa + "の保存情報"));
  root.append(text("p", "通信がないときに読むため、端末へ明示保存した情報です。現在の営業・開設・安全を保証しません。", "lead"));
  root.append(text("p", "保存日時: " + new Date(snapshot.capturedAt).toLocaleString("ja-JP") + "。通信が戻ったら通常ページで更新してください。", "caution"));
  const actions = document.createElement("p");
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "この保存情報を削除";
  deleteButton.addEventListener("click", async () => {
    deleteButton.disabled = true;
    try { await remove(snapshot.area.slug); location.reload(); } catch (error) { deleteButton.disabled = false; alert(error instanceof Error ? error.message : "削除できませんでした"); }
  });
  actions.append(deleteButton);
  root.append(actions);

  const list = document.createElement("div");
  list.className = "cards";
  for (const place of snapshot.places) {
    const card = document.createElement("article");
    card.className = "card";
    card.append(text("h2", place.name));
    card.append(text("p", [place.category, place.address].filter(Boolean).join(" ・ "), "note"));
    if (place.latestReport) card.append(text("p", "保存時点の最新報告: " + verdictLabel(place.latestReport.verdict) + "（" + new Date(place.latestReport.createdAt).toLocaleString("ja-JP") + "・" + evidenceLabel(place.latestReport.evidence) + "）"));
    else card.append(text("p", "保存時点では投稿がありません。", "note"));
    if (place.reportCount) card.append(text("p", "保存時点の報告件数: " + place.reportCount, "note"));
    const link = safeLink(place.mapsUrl, "地図で見る");
    if (link) { const p = document.createElement("p"); p.append(link); card.append(p); }
    list.append(card);
  }
  root.append(list);
  if (snapshot.officialStatuses?.length) {
    const section = document.createElement("section");
    section.className = "support-card";
    section.append(text("h2", "保存時点の公式確認"));
    for (const status of snapshot.officialStatuses) {
      const p = document.createElement("p");
      p.append(text("strong", status.name + ": " + (status.headline || status.status) + "（確認 " + new Date(status.checkedAt).toLocaleString("ja-JP") + "・" + (status.freshness === "stale" ? "要再確認" : "24時間以内") + "）"));
      const link = safeLink(status.sourceUrl, "出典");
      if (link) { p.append(document.createTextNode(" ")); p.append(link); }
      section.append(p);
    }
    root.append(section);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if ("serviceWorker" in navigator) void navigator.serviceWorker.register("${PWA_SERVICE_WORKER_PATH}").catch(() => {});
  const match = location.pathname.match(/^\\/a\\/([a-z0-9-]+)\\/offline$/i);
  const root = document.querySelector("[data-offline-root]");
  if (!match || !root) return;
  try {
    const snapshot = await load(decodeURIComponent(match[1]));
    if (!snapshot) { root.replaceChildren(text("h1", "保存情報がありません"), text("p", "通信できるときに市区町村ページから地域を保存してください。")); return; }
    const revision = await fetchRevision(snapshot.area.slug).catch(() => null);
    if (!revisionMatches(snapshot, revision)) { renderInvalidated(root, snapshot); return; }
    render(snapshot);
  } catch (error) {
    root.replaceChildren(text("h1", "保存情報を開けませんでした"), text("p", error instanceof Error ? error.message : "保存データを読み込めませんでした"));
  }
});
`;
}
