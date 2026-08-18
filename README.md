# 災害板（saigaiban）

OpenNavi の場所台帳から、町ごとの掲示板を立てる OSS です。

- 公開サイト: https://saigaiban.com
- 公式ハブ: https://opennavi.org
- この板は公式ではありません。場所カードは最初から「未確認」です。

上記の公開 URL は参照デプロイです。フォークでは、API 例のホストを自分の `SITE_ORIGIN` に置き換えてください。

## このリポジトリの位置づけ

- 公式窓口ではありません。場所カードは「未確認」から始まります。
- 場所マスターは OpenNavi API を読みます。災害板は自前の場所台帳を持ちません。
- 人と人の仲介、氏名・電話・待ち合わせ、住所つきマッチングは実装しません。
- 営業中・開設中・安全を災害板の判断として断定しません。

## 役割

| | OpenNavi | 災害板 |
|---|---|---|
| 持つもの | 場所の正体（名前・位置・種別） | 町ごとの未確認カード |
| 言わないこと | 台帳＝営業中 | 公式発表の代わり |
| やらないこと | 自由スレ、人の仲介 | 同じ |

場所は `GET https://opennavi.org/api/board/meta` と `GET https://opennavi.org/api/board/places` だけを読みます。`/api/spots` は使いません。

公式の休業・一部営業情報を運営が一次URL付きで確認した場合は、補助的に
`GET https://opennavi.org/api/board/official-status?area=<slug>` を読み、同じ町・カテゴリ・店名の
カードへ出典付きで重ねます。これは場所マスターや住民投稿を営業中へ昇格させる仕組みではなく、
`fresh`（24時間以内）／`stale`（72時間以内）の鮮度を表示します。公式一覧から消えただけの店を
自動で休業・閉店にはしません。

## OpenNavi Protocol

災害板は、平時からOpenNaviの場所マスターをもとに市区町村ごとの表示を準備し、災害時の初動で使えるようにします。現地の公式サイトや専用サイトが立ち上がったら、そちらを正本として案内します。

対応情報は `/.well-known/opennavi.json` で取得できます。現時点では `OpenNavi Handoff Profile v1` を提供しています。

現地サイトの運営者向け説明は [OpenNavi Protocol v1](https://saigaiban.com/protocol/opennavi/v1) で公開しています。

```text
GET https://saigaiban.com/.well-known/opennavi.json
GET https://saigaiban.com/api/opennavi/v1/handoff/{area-slug}
```

レスポンスは `saigaiban.handoff/v1` です。場所の名前・位置・種別・住所・出典・データ基準日と、公開済みの最新報告（件数を含む）を返します。`pagination.nextCursor` があれば、同じAPIに `?cursor=...` を付けて続きのページを取得できます。連絡先、非公開項目、座標入りの地図URL、非表示報告は返しません。`handoff.phase` は現在の災害板が「prepared」であること、`handoff.next` は現地サイト（`local-site`）へ正本を移すことを示します。APIは公開読み取り専用で、`GET` とCORSの`OPTIONS`に対応します。

従来の `GET /api/handoff/{area-slug}` は互換エイリアスとして残します。新規連携はバージョン付きの `/api/opennavi/v1/handoff/{area-slug}` を使用してください。

## 自分の Cloudflare で動かす

設定のひな形は [wrangler.example.jsonc](wrangler.example.jsonc) です。本番の設定ファイルや D1 ID はコミットしません。
本番設定・デプロイ手順は、公開ソースとは分離した非公開の ops リポジトリで管理します。

1. 依存関係を入れ、設定を作成する。

   ```bash
   npm install
   cp wrangler.example.jsonc wrangler.jsonc
   ```

2. `wrangler.jsonc` の `SITE_ORIGIN`、`PUBLIC_TURNSTILE_HOSTNAMES`、必要なら `routes` を自分の環境に書き換える。

3. 自分の Cloudflare アカウントで D1 を作成し、出力された `database_id` を `wrangler.jsonc` に設定する。既存の本番 D1 ID は流用しない。

   ```bash
   npx wrangler d1 create saigaiban
   ```

4. ローカル migration を適用してテストする。

   ```bash
   npx wrangler d1 migrations apply saigaiban --local
   ```

   ```bash
   npm test
   ```

   ```bash
   npm run typecheck
   ```

5. 投稿を開く前に、Turnstile とレート制限 HMAC を必ず設定する。既定の `PUBLIC_POSTING_MODE=off` のまま起動し、地域 allowlist と実データを確認してから段階的に変更する。

6. 本番 D1 へ migration を適用する場合は、デプロイ前に対象アカウント・DB・migration の内容を確認する。

   ```bash
   npx wrangler d1 migrations apply saigaiban --remote
   ```

7. テストと型チェックが通ったあとに、自分の Cloudflare アカウントへデプロイする。

   ```bash
   npm run deploy
   ```

`wrangler.jsonc` はローカル専用として `.gitignore` 済みです。フォーク先への自動デプロイは CI に含めていません。

### 環境変数と秘密情報

公開設定（`vars`）と secret を混ぜないでください。Turnstile secret、rate-limit HMAC、モデレーション token は `wrangler secret put` だけで設定し、リポジトリ・`vars`・Issue・PR に書きません。

| 名前 | 種別 | 必須 | 用途 |
|---|---|---|---|
| `OPENNAVI_ORIGIN` | var | 推奨 | 場所台帳を読む OpenNavi origin |
| `SITE_ORIGIN` | var | 推奨 | このフォークの公開 origin |
| `PUBLIC_POSTING_MODE` | var | 任意 | `off` / `on` |
| `PUBLIC_POSTING_AREAS` | var | 任意 | 投稿を許可する地域 slug（カンマ区切り） |
| `PUBLIC_SUPPORT_EVENTS_MODE` | var | 任意 | 支援イベントカタログの公開モード |
| `PUBLIC_READ_CACHE` | var | 任意 | `off` / `shadow` / `on` |
| `PUBLIC_TURNSTILE_SITE_KEY` | var | 投稿時 | Turnstile 公開キー |
| `PUBLIC_TURNSTILE_HOSTNAMES` | var | 投稿時 | Turnstile の許可ホスト名 |
| `GA4_MEASUREMENT_ID` | var | 任意 | 自分が管理する GA4 測定 ID |
| `TURNSTILE_SECRET_KEY` | **secret** | 投稿時 | Turnstile 検証 |
| `RATE_LIMIT_HMAC_SECRET` | **secret** | 投稿・通報時 | IP の短期ハッシュとクールダウン |
| `MODERATION_ADMIN_TOKEN` | **secret** | モデレーション時 | 管理 API の Bearer token |
| `RAKUTEN_APPLICATION_ID` | **secret** | 任意 | 楽天トラベル連携 |
| `RAKUTEN_ACCESS_KEY` | **secret** | 任意 | 楽天トラベル連携 |

secret の設定例:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

```bash
npx wrangler secret put RATE_LIMIT_HMAC_SECRET
```

```bash
npx wrangler secret put MODERATION_ADMIN_TOKEN
```

```bash
npx wrangler secret put RAKUTEN_APPLICATION_ID
```

```bash
npx wrangler secret put RAKUTEN_ACCESS_KEY
```

ローカルでは `.dev.vars` を使えます。`.dev.vars` は gitignore 済みで、秘密をコミットしないでください。

## 投稿

見かけた人も、店の人も書けます。店側は「営業は Google マップを見てほしい」と自己申告できます。地図リンクは施設名・市区町村名（住所があれば補助）から生成する検索URLを使い、台帳の座標URLは表示しません。Maps API キーは使いません。氏名・電話・待ち合わせは受けません。

トップは都道府県タブと市区町村への入口だけを表示します。場所一覧と投稿サマリーは市区町村ページを開いた時だけ取得するため、トップアクセスが全地域のデータ更新を連鎖させません。

## 被災地応援

災害版は支援者向けのページを持たず、`/support` に来た場合も OpenNavi の公式支援ハブへリダイレクトします。災害版は場所カード・現地報告に絞ります。

熊本の被災者向け案内は `https://saigaiban.com/support?destination=kumamoto` または `?pref=43` から [くまもと被災者支援ナビ](https://kumamoto-shien.jp/) へ切り替えます。熊本の案内はこの専用サービスへ集約し、災害版で並列掲載しません。

被災者向けの物資配布・炊き出し・無料診療・入浴支援などは、掲載元の公式URLと確認日時を必須にした読み取り専用カタログで扱います。カタログは既定で停止しており、データの確認とD1 migration適用が完了するまで公開しません。災害版は受付・予約・公式判断を行いません。

- 県・市区町村・社会福祉協議会の義援金、物資、災害ボランティア、罹災証明などは [OpenNaviの公式支援ページ](https://opennavi.org/support) で確認します。
- 支援者向けの公式情報、義援金、物資、災害ボランティア、復旧後の地域応援はOpenNavi側で扱います。

OpenNaviと災害版は、原則として災害救助法の適用を目安に小規模な災害から立ち上げ、激甚災害の指定を待つ設計ではありません。復旧が進んだ地域は、公式情報の更新を終えて役目を閉じます。次の対象が北海道など別地域になっても、現在災害の設定と公式ソースを差し替えて再利用します。

現在の画面設計と再利用ルールは [DESIGN.md](DESIGN.md) に記録しています。
