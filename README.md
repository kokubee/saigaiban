# 災害板（saigaiban）

OpenNavi の場所台帳から、町ごとの掲示板を立てる OSS です。

- 公開サイト: https://saigaiban.com
- 公式ハブ: https://opennavi.org
- この板は公式ではありません。場所カードは最初から「未確認」です。

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

## 動かし方

```
npm install
npm test
npm run dev
```

本番は Cloudflare Worker です。`OPENNAVI_ORIGIN` の初期値は `https://opennavi.org` です。localhost には倒れません。

計測は `GA4_MEASUREMENT_ID`（本番は `G-4KQPS1LRHV`）を HTML の head に載せます。未設定や不正な値のときはスクリプトを出しません。投稿本文・氏名・電話は送りません。

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
