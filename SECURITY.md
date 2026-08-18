# 災害板のセキュリティ

## 脆弱性の報告

再現可能な脆弱性、認証回避、個人情報の露出、secret の漏えいを見つけた場合は、公開 Issue に詳細を書かず、GitHub の [Security Advisories の非公開報告フォーム](https://github.com/kokubee/saigaiban/security/advisories/new) を使用してください。フォームが表示されない場合は、再現手順や値を公開せず、リポジトリ管理者へ非公開で連絡してください。

報告には、影響するコミットまたは URL、再現条件、影響範囲、可能なら安全な最小再現を含めてください。報告者の許可なく個人名を公開しません。公開 Issue には、token、cookie、IP アドレス、投稿本文、個人連絡先を貼らないでください。

## 運用上の安全境界

- 災害板は公式窓口ではありません。場所カード、住民報告、店側の自己申告、公式リンクを別の情報として扱います。
- 投稿は公開情報です。氏名、電話、URL、待ち合わせ、住所つきマッチングを保存・表示しません。
- 投稿受付は `PUBLIC_POSTING_MODE=off` が既定です。Turnstile、`RATE_LIMIT_HMAC_SECRET`、地域 allowlist、保存期間、通報対応を確認するまで開けないでください。
- Turnstile secret、rate-limit HMAC、`MODERATION_ADMIN_TOKEN` は Cloudflare secret としてのみ設定します。`vars`、リポジトリ、Issue、PR、ログへ置きません。
- `ip_hash` は日次 HMAC と短い保持期間でレート制限に使い、元の IP を保存しません。HMAC secret を失った場合は直ちにローテーションしてください。
- モデレーション API は Bearer token を要求します。token を URL、画面、クライアントコードへ埋め込まないでください。
- OpenNavi から取得したデータが古い、空、または異常な場合は推測で補わず、取得不能または未確認として表示します。

## デプロイと設定

- フォークは [wrangler.example.jsonc](wrangler.example.jsonc) から `wrangler.jsonc` を作り、自分の D1 を新規作成してください。本番の `database_id`、routes、GA4 ID は流用しません。
- migration は対象 DB を確認してから適用します。投稿を開ける前に、migration、実 D1 の監査、secret、Turnstile hostname、allowlist を確認してください。
- CI は test と typecheck だけを実行します。フォークの Cloudflare アカウントへ自動デプロイしません。
- GA4 を使う場合も、測定 ID は自分が管理するプロパティのものを `vars` に設定し、投稿本文・氏名・電話をイベントへ送らないでください。

## 依存関係と修正

依存関係の更新やセキュリティ修正は、既存の境界とテストを保った小さな PR にしてください。脆弱性対応で互換性を壊す場合は、影響範囲と移行手順を PR に明記します。
