# 災害板 P-1 現行実装ベースライン

確認日: 2026-08-16  
対象: `/Users/kokubee/code2026/saigaiban` `main`
コード基準: `382b1b7`
計画更新: `66952a3`
P0初回実装: `dc93a54`（証拠・鮮度projection、テレメトリallowlist）
P0安全化追補: `b339277`（投稿受付ゲート、テレメトリ値検証、鮮度期限、店側カード表示）
P0読み取り専用追補: `9501d27`（既知値検証、OFF時文言、外部取得前拒否、D1書込みゼロテスト）
P0 Turnstile追補: `15ad074`（siteverify、失敗時停止、フォームwidget、検証テスト）

## 1. P-1の判定

P-1「Baseline / Contract Reconciliation」は完了とする。ここではコードを変更せず、現行実装・OpenNavi依存・未実装を分離した。

P0以降の開始条件は、次の3点である。

1. 住民報告のwrite ownershipを災害板へ一本化する方針を承認する
2. `authority`／`review`／`freshness` を別軸にした公開projectionを定義する
3. `place_reports` と将来の `lifeline_reports` を別契約にする

### write ownership決定記録

- `saigaiban` は将来の `place_reports`（場所カードに紐づく現地観測）の正本候補とする。
- OpenNaviの `/lifelines` は地域全体の停電・断水報告として別契約のlegacy経路に残し、災害板へ自動複製しない。
- 本コミットではOpenNavi側を変更せず、二重書込を避けるため災害板の公開投稿は `PUBLIC_POSTING_MODE=off` に固定する。
- `saigaiban` の投稿を再開するか、OpenNavi `/lifelines` をread-only／管理者専用へ移行するかは、OpenNaviリポジトリ側の別承認で確定する。

## 2. 現行データフロー

### 公開読み取り

| 画面 | 災害板の処理 | 依存先 |
|---|---|---|
| `/` | `fetchMeta()` で地域一覧だけ取得 | OpenNavi `/api/board/meta` |
| `/a/:slug` | `fetchPlaces()` と `latestByPlaces()` を取得 | OpenNavi `/api/board/places`、災害板D1 `reports` |
| `/a/:slug/p/:id` | `fetchPlaceById()` と `listReports()` を取得 | OpenNavi `/api/board/places/:id`、災害板D1 `reports` |
| `/support` | OpenNavi公式支援ハブへリダイレクト | OpenNavi `/support` |
| `/support/tourism/:slug` | 楽天／じゃらんの地域別補助表示 | 外部プロバイダ（公式支援情報ではない） |

### 書き込み

| データ | 現在の正本 | 現在の経路 | P0以降の扱い |
|---|---|---|---|
| 店舗・施設の現地報告 | 災害板D1 `reports` | 場所詳細POST | `place_reports`として継続・安全化 |
| 地域全体の停電・断水報告 | OpenNavi D1 | OpenNavi `/lifelines` POST/PATCH/confirm | legacy/read-onlyまたは管理者専用へ移行検討 |
| 公式停電・断水要約 | OpenNavi | OpenNavi公式板 | 災害板はリンク・参照のみ |
| 支援・旅行補助 | OpenNavi／外部プロバイダ | 災害板は表示・リダイレクト | 公式支援と旅行補助を混同しない |

現状は、住民報告のwrite pathが災害板とOpenNaviに分かれている。災害板の投稿再開より前に、二重正本を解消する。

## 3. 表示契約の現状

### 3.1 災害板が現在持っている値

- 場所: `id`, `name`, `area`, `category`, `source`, `data_basis_date`, `identity_only`
- 報告: `verdict`, `note`, `created_at`, `role`, `prefer_maps`
- 要約: 場所ごとの最新報告、店側自己申告、報告件数

### 3.2 まだ分離されていない値

現在の `verdict` と表示タグだけでは、次の3つを一つの軸にしてしまう。

```ts
authority: "official" | "resident" | "operator" | "reference"
review: "confirmed" | "unreviewed" | "disputed" | "unknown"
freshness: "fresh" | "stale" | "expired" | "unknown"
```

P0ではこのprojectionを追加し、「店側が入力した」ことと「運営が確認した」ことを別表示にする。`role=owner` は認証済み所有者ではなく、当面は「店側の自己申告」とする。24時間以内を `fresh`、24〜72時間を `stale`、72時間超を `expired`、未来時刻・不正時刻を `unknown` とし、カード・履歴の両方で鮮度ラベルを表示する。

## 4. 安全性の現状とP2前提

| 項目 | 現状 | 再開前の条件 |
|---|---|---|
| Origin/Referer | `allowedOrigin()` で確認 | 維持 |
| クールダウン | IPハッシュ＋場所ID、10分 | 期間salt付きHMACへ移行 |
| bot対策 | Turnstileのsiteverifyを実装済み。鍵未設定時は受付停止 | secret/site keyを本番secretとして設定し、実検証を確認 |
| IP識別子 | `SHA-256("saigaiban:"+IP)`を保存 | 短期用途に限定し、期限後削除 |
| owner判定 | フォーム値を自己申告として保存 | 認証済み所有者と表示しない |
| 内容制限 | URL、電話、連絡先、待ち合わせ等を拒否 | 既存テストを維持・拡張 |
| 通報・非表示 | 現行の公開POSTには未実装 | 投稿再開前に管理経路を用意 |

P2では、`observedAt` と `confirmedAt` を同一時刻に自動設定しない。既存行は `created_at` を観測・投稿時刻の暫定値とし、確認時刻は別に扱う移行規則を決める。

## 5. オフライン・キャッシュの現状

### 災害板自身

- Service Worker、IndexedDBの明示保存、印刷用スナップショットは未実装
- HTML公開レスポンスは既定 `public, max-age=60`
- 場所詳細POSTは書き込み後にリダイレクトし、成功表示をクエリで返す
- OpenNavi依存のCache APIは `PUBLIC_READ_CACHE=off` が既定
- `shadow` は現状、cacheへ書かずorigin応答を返す。P4で「書くが返さない＋差分測定」に変更する
- OpenNavi依存fetchにETag、timeout、再試行上限はない

### OpenNaviとの境界

- OpenNavi側にIndexedDBスナップショットがある場合も、災害板のService Worker自動キャッシュとは別物
- 災害板がオフラインデータを持つ場合は、`OfflineOfficialAction[]` の型付きprojectionだけを保存する
- `supportOfficial` のraw objectを再帰走査し、旅行予約や応援購入まで「公式」と表示しない

## 6. P0のテスト項目

P0実装時に、最低限次のテストを追加する。

1. `authority=resident` の報告が「公式確認」と表示されない
2. `review=confirmed` でも `authority` が `resident` のまま残る
3. `freshness=stale`／`expired` の報告が一覧の先頭で営業中と誤認されない
4. `role=owner` が「認証済み所有者」と表示されない
5. URL・電話・個人連絡先・待ち合わせが保存されない
6. OpenNaviの非公開キー（`hidden`, `owner_uid`, `review_status`等）が災害板へ流れない
7. OpenNavi 5xx／timeout／不正JSON時に推測データを返さない
8. `PUBLIC_READ_CACHE=shadow` の挙動が「cacheへ書く・originを返す・差分を測る」になる
9. `place_reports` に地域全体の停電・断水レコードを混在させない
10. telemetryがallowlist外のキー、未知の地域・カテゴリ・need・kind・verdict、本文を送信しない
11. 投稿OFFのPOSTがOpenNavi取得とD1書込みの前に拒否される

## 7. P-1で変更しないもの

- OpenNaviリポジトリのコード、D1、LINE設定、ADMIN_TOKEN
- 災害板の本番D1データ
- `PUBLIC_READ_CACHE` の本番値
- 外部支援・旅行プロバイダへの送信
- 投稿受付の再開

P-1のベースラインをもとに、P0追補では投稿受付を既定OFFに固定した。`PUBLIC_POSTING_MODE=on` は、write ownershipの承認とTurnstile・短期HMAC・保持期限・管理経路の実装後に限って有効化する。OpenNavi側の変更はこのリポジトリへ混ぜない。
