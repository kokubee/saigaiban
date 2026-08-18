# 災害板への貢献

災害板は、OpenNavi の場所台帳から市区町村ごとの「未確認」カードを表示する OSS です。公式窓口ではなく、人と人を仲介するサービスでもありません。変更を提案する前に [README.md](README.md)、[AGENTS.md](AGENTS.md)、[DESIGN.md](DESIGN.md)、[OpenNavi Protocol v1](docs/opennavi-protocol-v1.md) を読んでください。

## 守る境界

- 場所は OpenNavi の `board` 系 API だけを読みます。`/api/spots` を追加しません。
- カードは未確認から始めます。投稿や台帳だけを根拠に営業中・開設中・安全と断定しません。
- 公式情報は、出典 URL と確認時刻を別の情報として表示します。
- 氏名、電話、URL、待ち合わせ、住所つきマッチングを受け付けません。
- 地図は施設名などから作る検索 URL を使い、台帳の座標 URL をそのまま表示しません。Maps API キーは使いません。
- 投稿・通報・管理 API の secret（Turnstile、rate-limit HMAC、モデレーション token など）を `vars`、Issue、PR、テストログへ書きません。
- Protocol の発見情報と handoff 契約を変える場合は、実装と [docs/opennavi-protocol-v1.md](docs/opennavi-protocol-v1.md) を同じ PR で更新します。

## 開発環境

Node.js 22 系と Wrangler を推奨します。

```bash
npm install
```

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

`wrangler.jsonc` の D1 `database_id`、`SITE_ORIGIN`、必要な routes を自分の Cloudflare アカウント用に編集してください。本番の D1 ID やドメインを流用しないでください。

```bash
npx wrangler d1 migrations apply saigaiban --local
```

ローカル secret は `.dev.vars` に置けます。投稿は `PUBLIC_POSTING_MODE=off` のまま、Turnstile と `RATE_LIMIT_HMAC_SECRET` を確認してから検討してください。

## テストと型チェック

変更前後に次を実行します。

```bash
npm test
```

```bash
npm run typecheck
```

挙動を変える PR には、対応する `test/*.test.ts` の追加・更新を含めてください。CI は test と typecheck のみを実行し、フォーク先へ自動デプロイしません。

## Pull Request

PR の説明に次を含めてください。

1. 何を変えたか、なぜ必要か。
2. `npm test` と `npm run typecheck` の結果。
3. 公式情報・個人情報・secret・OpenNavi Protocol への影響。
4. UI 文言や状態表示が「公式ではない」「未確認」「自己申告」の区別を保っていること。

本番の `database_id`、独自ドメイン、計測 ID、secret はコミットしないでください。大きな設計変更や新しい地域の扱いは、先に Issue で意図とデータの正本を共有してください。

## 歓迎する変更

- アクセシビリティ、低速回線、キーボード操作の改善
- テスト、型、安全側のレート制限・モデレーション強化
- Protocol 互換を保つ handoff の明確化
- ドキュメント、翻訳、誤解を減らす表示の改善

次の変更は災害板の役割から外れるため、別プロジェクトとして提案してください。

- 公式発表の代替や営業中・安全の自動断定
- 個人間マッチング、チャット、連絡先交換
- OpenNavi 台帳の複製マスター化

## ライセンス

貢献は [MIT License](LICENSE) の下で受け入れます。
