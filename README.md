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

## 動かし方

```
npm install
npm test
npm run dev
```

本番は Cloudflare Worker です。`OPENNAVI_ORIGIN` の初期値は `https://opennavi.org` です。localhost には倒れません。

## 投稿

見かけた人も、店の人も書けます。店側は「営業は Google マップを見てほしい」と自己申告できます。地図リンクは台帳にある検索URLだけを使い、Maps API キーは使いません。氏名・電話・待ち合わせは受けません。
