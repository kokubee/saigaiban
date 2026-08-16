# OpenNavi Protocol v1

災害時に、平時から準備した場所マスターを地域サイトへ安全に引き継ぐための公開プロトコルです。

このリポジトリでは、`OpenNavi Handoff Profile v1` を提供します。災害板は初動の入口であり、自治体や地域運営者の現地サイトが立ち上がった後は、現地サイトを正本として扱います。

現地サイト運営者向けの公開説明ページ: <https://saigaiban.com/protocol/opennavi/v1>

## 発見

対応サイトは次のJSONを公開します。

```text
GET https://saigaiban.com/.well-known/opennavi.json
```

発見ドキュメントのスキーマは `opennavi.discovery/v1` です。ここからプロトコルのバージョン、プロファイル、正規エンドポイント、互換エンドポイント、依存する場所マスターの出典を確認できます。

## Handoff Profile v1

正規エンドポイントは次のとおりです。

```text
GET https://saigaiban.com/api/opennavi/v1/handoff/{area-slug}
```

ブラウザや別ドメインの地域サイトから利用できるよう、`OPTIONS` とCORSに対応します。認証・書き込みはありません。場所が多い地域では、レスポンスの `pagination.nextCursor` を次の `cursor` クエリへ渡して取得を続けます。

従来の次のURLは互換エイリアスです。

```text
GET https://saigaiban.com/api/handoff/{area-slug}
```

新規実装は、必ずバージョン付きの正規エンドポイントを使います。

## レスポンスの意味

レスポンスの `schema` は `saigaiban.handoff/v1`、`protocol` は `OpenNavi Protocol` の `handoff/v1` を示します。

- `kind`: `prepared-place-master`
- `handoff.phase`: 現在のフェーズ。現行実装は `prepared`
- `handoff.next`: 次に正本となるサイト。現行実装は `local-site`
- `area`: 市区町村の識別子と表示名
- `places`: 場所マスターの公開projection
- `places[].latestReport`: 公開済みで非表示になっていない最新報告だけ
- `places[].reportCount`: その場所に紐づく公開報告の件数
- `upstream.generatedAt`: 上流の場所APIの生成時刻
- `pagination.nextCursor`: 続きがない場合は `null`

`handoff.phase` は将来の運用で `prepared`、`active`、`handed_off`、`archived` を使えるように予約しています。現地サイトが立ち上がった場合、`handoff.next` と現地サイトの公式案内を優先し、災害板の報告を公式情報へ昇格させません。

## 公開境界

引き継ぐのは、場所を識別するための公開情報と、すでに災害板で公開されている最新の補足だけです。

含めるもの:

- 場所ID、名前、市区町村、カテゴリ
- 公開された緯度・経度、住所、出典、データ基準日
- 最新の公開報告の状態、短いメモ、投稿時刻、立場、証拠projection

含めないもの:

- 電話番号、個人名、待ち合わせ、連絡先
- 非表示報告、管理者用ID、レビュー内部値
- 台帳に含まれる座標入りの地図URL
- OpenNaviや災害板の内部フィールド

`authority`、`review`、`freshness` は別々の軸です。住民報告や店側の自己申告が管理者に確認されても、公式情報へ自動昇格しません。現地サイトは、自治体・事業者・社協などの一次情報を正本として表示します。

## 互換性

- `opennavi.discovery/v1` と `saigaiban.handoff/v1` は、同じメジャーバージョンの間で後方互換を保ちます。
- 新しい必須項目を追加するときはメジャーバージョンを上げます。
- 既存項目の意味を変更せず、追加項目は利用側が無視できる形にします。
- 旧 `/api/handoff/{area-slug}` は、少なくともHandoff Profile v1の提供期間中は残します。

## 実装例

1. `/.well-known/opennavi.json` を取得する。
2. `protocol.profiles` から `handoff` の正規エンドポイントを選ぶ。
3. 対象地域の `area-slug` でGETする。
4. `handoff.phase`、`handoff.next`、`generatedAt`、`upstream.generatedAt` を保存する。
5. `pagination.nextCursor` がある間は続きのページを取得する。
6. 現地サイトが正本になったら、災害板の報告を補足表示へ切り替え、公式案内を現地サイトへ移す。
