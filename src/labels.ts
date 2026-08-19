import type { BoardTaxonomy } from "./types.ts";

export const PREF_NAMES: Record<string, string> = {
  "01": "北海道",
  "02": "青森県",
  "03": "岩手県",
  "04": "宮城県",
  "05": "秋田県",
  "06": "山形県",
  "07": "福島県",
  "08": "茨城県",
  "09": "栃木県",
  "10": "群馬県",
  "11": "埼玉県",
  "12": "千葉県",
  "13": "東京都",
  "14": "神奈川県",
  "15": "新潟県",
  "16": "富山県",
  "17": "石川県",
  "18": "福井県",
  "19": "山梨県",
  "20": "長野県",
  "21": "岐阜県",
  "22": "静岡県",
  "23": "愛知県",
  "24": "三重県",
  "25": "滋賀県",
  "26": "京都府",
  "27": "大阪府",
  "28": "兵庫県",
  "29": "奈良県",
  "30": "和歌山県",
  "31": "鳥取県",
  "32": "島根県",
  "33": "岡山県",
  "34": "広島県",
  "35": "山口県",
  "36": "徳島県",
  "37": "香川県",
  "38": "愛媛県",
  "39": "高知県",
  "40": "福岡県",
  "41": "佐賀県",
  "42": "長崎県",
  "43": "熊本県",
  "44": "大分県",
  "45": "宮崎県",
  "46": "鹿児島県",
  "47": "沖縄県",
};

const CATEGORY_LABELS: Record<string, string> = {
  hinanjo: "避難所",
  water: "水",
  water_spot: "給水",
  toilet: "トイレ",
  bath: "入浴",
  laundry: "洗濯",
  gas: "給油",
  conv: "コンビニ",
  super: "スーパー",
  shop: "店",
  food: "食事",
  meal: "食事",
  hospital: "病院・診療所",
  pharmacy: "薬局",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  hinanjo: "指定避難所・指定緊急避難場所の台帳。開設中とは限りません。",
  hospital: "病院・診療所。診療時間や受診可否は公式案内で確認してください。",
  pharmacy: "薬局。営業や在庫は公式案内・店舗へ確認してください。",
  laundry: "クリーニング店・コインランドリー。",
  gas: "給油所。営業や給油可否は現地・公式情報で確認してください。",
  food: "飲食店・食事の場所。",
  meal: "飲食店・食事の場所。",
  conv: "コンビニエンスストア。",
  super: "スーパー・食品店。",
  water_spot: "給水所。開設状況は公式情報で確認してください。",
  water: "水に関する場所・情報。",
  toilet: "トイレ。利用可否は現地で確認してください。",
  bath: "入浴施設。営業や利用可否は公式情報で確認してください。",
  shop: "その他の店舗・サービス。",
};

export const CATEGORY_FILTERS: Array<{ id: string; label: string }> = [
  { id: "conv", label: "コンビニ" },
  { id: "gas", label: "給油" },
  { id: "food", label: "食事" },
  { id: "meal", label: "食事" },
  { id: "hinanjo", label: "避難所" },
  { id: "water_spot", label: "給水" },
  { id: "toilet", label: "トイレ" },
  { id: "bath", label: "入浴" },
  { id: "laundry", label: "洗濯" },
  { id: "super", label: "スーパー" },
  { id: "shop", label: "店" },
  { id: "water", label: "水" },
  { id: "hospital", label: "病院・診療所" },
  { id: "pharmacy", label: "薬局" },
];

export const SHELTER_FLAG_FILTERS: Array<{ id: string; label: string }> = [
  { id: "shelter-designated", label: "指定避難所" },
  { id: "shelter-emergency-place", label: "緊急避難場所" },
];

const CATEGORY_ALIASES: Record<string, string> = {
  clinic: "hospital",
  medical: "hospital",
  drugstore: "pharmacy",
  drug_store: "pharmacy",
  convenience: "conv",
  fuel: "gas",
  restaurant: "food",
};

const LAUNDRY_NAME = /(クリーニング|コインランドリー|ランドリー|洗濯)/iu;
const MEDICAL_NAME = /(病院|医院|クリニック|診療所|内科|外科|歯科|眼科|整形|皮膚科|泌尿器科|耳鼻|産婦人科|小児科)/iu;

export function prefName(code: string): string {
  return PREF_NAMES[code] || (code ? `都道府県(${code})` : "その他");
}

export function categoryLabel(id: string): string {
  return CATEGORY_LABELS[id] || "その他";
}

export function categoryLabelFromTaxonomy(id: string, taxonomy?: BoardTaxonomy): string {
  return taxonomy?.categories.find((category) => category.id === id)?.label || categoryLabel(id);
}

export function categoryDescription(id: string): string {
  return CATEGORY_DESCRIPTIONS[id] || "場所の種類が特定できないカード。公式・現地で確認してください。";
}

export function isKnownCategory(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, id);
}

export function isKnownCategoryFromTaxonomy(id: string, taxonomy?: BoardTaxonomy): boolean {
  return isKnownCategory(id) || Boolean(taxonomy?.categories.some((category) => category.id === id));
}

export function isKnownPlaceFlag(id: string, taxonomy?: BoardTaxonomy): boolean {
  return SHELTER_FLAG_FILTERS.some((flag) => flag.id === id) || Boolean(taxonomy?.flags.some((flag) => flag.id === id));
}

export function placeFlagLabel(id: string, taxonomy?: BoardTaxonomy): string | null {
  return taxonomy?.flags.find((flag) => flag.id === id)?.label || SHELTER_FLAG_FILTERS.find((flag) => flag.id === id)?.label || null;
}

export function shelterDesignationLabel(flags: string[], taxonomy?: BoardTaxonomy): string | null {
  for (const id of flags) {
    const label = placeFlagLabel(id, taxonomy);
    const isShelterFlag = SHELTER_FLAG_FILTERS.some((flag) => flag.id === id) || Boolean(taxonomy?.flags.some((flag) => flag.id === id && flag.categories?.includes("hinanjo")));
    if (label && isShelterFlag) return label;
  }
  return null;
}

/** Normalize upstream tags while correcting only unambiguous name/category conflicts. */
export function normalizePlaceCategory(rawCategory: string, placeName: string): string {
  const raw = String(rawCategory || "").trim().toLowerCase();
  const category = CATEGORY_ALIASES[raw] || raw;
  const name = String(placeName || "").trim();
  if (LAUNDRY_NAME.test(name)) return "laundry";
  if (MEDICAL_NAME.test(name)) return "hospital";
  return category;
}

export function isShelter(category: string): boolean {
  return category === "hinanjo";
}

export function isShopLike(category: string): boolean {
  return ["conv", "super", "food", "gas", "laundry", "bath", "shop", "meal"].includes(category);
}
