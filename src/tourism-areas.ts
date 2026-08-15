/**
 * 町ごとの宿泊検索設定。
 * 楽天の地区コードは広域なので、表示前に住所の市町名で絞り込む。
 */

export type TourismAreaConfig = {
  slug: string;
  /** 住所に含まれるべき文字列（隣接自治体の宿を落とす） */
  addressMatchers: string[];
  /** 楽天トラベル地区コード */
  rakuten: {
    largeClassCode: "japan";
    middleClassCode: string;
    smallClassCode: string;
  };
};

/** 千葉県の楽天地区コード（middleClassCode は tiba） */
const CHIBA = "tiba" as const;

/**
 * OpenNavi の active 町に対応する設定。
 * slug がここに無い町は、応援ページでは地域選択に出さない（meta で active でも宿一覧は作らない）。
 */
export const TOURISM_AREA_CONFIG: Record<string, TourismAreaConfig> = {
  // 千葉
  "chiba-chuo": {
    slug: "chiba-chuo",
    addressMatchers: ["千葉市中央区"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "chiba" },
  },
  "chiba-hanamigawa": {
    slug: "chiba-hanamigawa",
    addressMatchers: ["千葉市花見川区"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "chiba" },
  },
  "chiba-inage": {
    slug: "chiba-inage",
    addressMatchers: ["千葉市稲毛区"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "chiba" },
  },
  "chiba-midori": {
    slug: "chiba-midori",
    addressMatchers: ["千葉市緑区"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "chiba" },
  },
  "chiba-mihama": {
    slug: "chiba-mihama",
    addressMatchers: ["千葉市美浜区"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "chiba" },
  },
  "chiba-wakaba": {
    slug: "chiba-wakaba",
    addressMatchers: ["千葉市若葉区"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "chiba" },
  },
  // 京葉
  funabashi: {
    slug: "funabashi",
    addressMatchers: ["船橋市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "keiyo" },
  },
  ichikawa: {
    slug: "ichikawa",
    addressMatchers: ["市川市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "keiyo" },
  },
  narashino: {
    slug: "narashino",
    addressMatchers: ["習志野市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "keiyo" },
  },
  yachiyo: {
    slug: "yachiyo",
    addressMatchers: ["八千代市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "keiyo" },
  },
  // 松戸・柏
  matsudo: {
    slug: "matsudo",
    addressMatchers: ["松戸市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "kashiwa" },
  },
  kashiwa: {
    slug: "kashiwa",
    addressMatchers: ["柏市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "kashiwa" },
  },
  abiko: {
    slug: "abiko",
    addressMatchers: ["我孫子市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "kashiwa" },
  },
  kamagaya: {
    slug: "kamagaya",
    addressMatchers: ["鎌ケ谷市", "鎌ヶ谷市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "kashiwa" },
  },
  shiroi: {
    slug: "shiroi",
    addressMatchers: ["白井市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "kashiwa" },
  },
  // 成田・佐倉
  sakura: {
    slug: "sakura",
    addressMatchers: ["佐倉市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "narita" },
  },
  inzai: {
    slug: "inzai",
    addressMatchers: ["印西市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "narita" },
  },
  shisui: {
    slug: "shisui",
    addressMatchers: ["酒々井町"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "narita" },
  },
  tomisato: {
    slug: "tomisato",
    addressMatchers: ["富里市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "narita" },
  },
  yachimata: {
    slug: "yachimata",
    addressMatchers: ["八街市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "narita" },
  },
  yotsukaido: {
    slug: "yotsukaido",
    addressMatchers: ["四街道市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "narita" },
  },
  // 九十九里・東金・茂原
  kujukuri: {
    slug: "kujukuri",
    addressMatchers: ["九十九里町"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "choshi" },
  },
  togane: {
    slug: "togane",
    addressMatchers: ["東金市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "choshi" },
  },
  mobara: {
    slug: "mobara",
    addressMatchers: ["茂原市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "choshi" },
  },
  oamishirasato: {
    slug: "oamishirasato",
    addressMatchers: ["大網白里市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "choshi" },
  },
  sanmu: {
    slug: "sanmu",
    addressMatchers: ["山武市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "choshi" },
  },
  shirako: {
    slug: "shirako",
    addressMatchers: ["白子町"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "choshi" },
  },
  nagara: {
    slug: "nagara",
    addressMatchers: ["長柄町"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "choshi" },
  },
  // 館山
  tateyama: {
    slug: "tateyama",
    addressMatchers: ["館山市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "tateyama" },
  },
  // 市原
  ichihara: {
    slug: "ichihara",
    addressMatchers: ["市原市"],
    rakuten: { largeClassCode: "japan", middleClassCode: CHIBA, smallClassCode: "uchibo" },
  },
};

export function tourismAreaConfig(slug: string): TourismAreaConfig | null {
  return TOURISM_AREA_CONFIG[slug] || null;
}

/** じゃらん公式の地域キーワード検索（HTTPS）。APIキーは使わない。 */
export function jalanSearchUrl(nameJa: string): string {
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(nameJa)}`;
}

/** 楽天トラベル公式の千葉県宿泊一覧（API障害時の逃げ道）。 */
export function rakutenPrefectureSearchUrl(): string {
  return "https://travel.rakuten.co.jp/yado/chiba/chiba.html";
}

export function addressMatchesArea(address: string, matchers: string[]): boolean {
  const text = String(address || "");
  return matchers.some((m) => text.includes(m));
}
