import type { EvidenceProjection } from "./evidence.ts";

export type BoardMeta = {
  disaster: { id: string; label: string };
  areas: Array<{ slug: string; nameJa: string; prefCode: string; status: string }>;
  placeLicense?: { osm?: string; gsi?: string };
};

export type BoardPlace = {
  id: string;
  seed_key: string;
  name: string;
  area: string;
  category: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  source: string | null;
  data_basis_date: string | null;
  identity_only: boolean;
  maps_url: string;
};

export type BoardPlacesPage = {
  disaster_id: string;
  generated_at: string;
  next_cursor: string | null;
  places: BoardPlace[];
};

/** Official, operator-curated status projection from OpenNavi. */
export type BoardOfficialStatus = {
  name: string;
  area: string;
  category: string;
  status: "open" | "limited" | "closed";
  headline: string | null;
  sourceUrl: string;
  checkedAt: string;
  freshness: "fresh" | "stale";
  lat: number | null;
  lng: number | null;
};

export type BoardOfficialStatusPage = {
  disaster_id: string;
  area: string;
  generated_at: string;
  statuses: BoardOfficialStatus[];
};

export type Verdict = "open" | "limited" | "closed" | "still" | "changed" | "maps";

export type ReportRole = "visitor" | "owner";
export type ReportModerationStatus = "visible" | "hidden";
export type ReportReviewStatus = "unknown" | "confirmed" | "disputed";

export type Report = {
  id: string;
  place_id: string;
  area: string;
  seed_key: string | null;
  verdict: Verdict;
  note: string | null;
  created_at: string;
  role: ReportRole;
  prefer_maps: boolean;
  moderation_status?: ReportModerationStatus;
  review_status?: ReportReviewStatus;
  evidence?: EvidenceProjection;
};

export type PlaceSummary = {
  latest: Report | null;
  latestOwner: Report | null;
  count: number;
};

export type StayListing = {
  id: string;
  name: string;
  address: string;
  blurb: string | null;
  imageUrl: string | null;
  href: string;
  provider: "rakuten";
};

export type TourismProvider = {
  id: "rakuten" | "jalan";
  label: string;
  href: string;
};

export type TourismFetchResult = {
  status: "ok" | "unconfigured" | "unsupported" | "rate_limited" | "maintenance" | "error";
  message: string;
  listings: StayListing[];
  providers: TourismProvider[];
  creditHtml: string;
};

export type SupportEventCategory = "supplies" | "meal" | "medical" | "bath" | "collection";
export type SupportEventStatus = "scheduled" | "open" | "ended" | "check";
export type SupportEventFreshness = "fresh" | "stale" | "expired" | "unknown";

export type SupportEvent = {
  id: string;
  area: string;
  category: SupportEventCategory;
  title: string;
  organizer: string;
  venue: string;
  address: string | null;
  startsAt: string;
  endsAt: string;
  eligibility: string | null;
  description: string | null;
  sourceUrl: string;
  status: SupportEventStatus;
  checkedAt: string;
  freshness: SupportEventFreshness;
  contactNote: string | null;
};

export type SupportEventQueryResult = {
  available: boolean;
  events: SupportEvent[];
};

export type Env = {
  OPENNAVI_ORIGIN: string;
  SITE_ORIGIN: string;
  GA4_MEASUREMENT_ID?: string;
  RAKUTEN_APPLICATION_ID?: string;
  RAKUTEN_ACCESS_KEY?: string;
  /** Public OpenNavi dependency cache rollout: off (default), shadow, or on. */
  PUBLIC_READ_CACHE?: string;
  /** Public report intake: off (default) or on after P0 safety checks. */
  PUBLIC_POSTING_MODE?: string;
  /** Comma-separated area slugs that may accept reports when posting mode is on. */
  PUBLIC_POSTING_AREAS?: string;
  /** Cloudflare Turnstile site key (public); paired with the secret key. */
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** Comma-separated production hostnames accepted in Turnstile responses. */
  PUBLIC_TURNSTILE_HOSTNAMES?: string;
  /** Cloudflare Turnstile secret; configure as a Wrangler secret, never a public var. */
  TURNSTILE_SECRET_KEY?: string;
  /** HMAC secret for the short-lived rate-limit token; configure as a Wrangler secret. */
  RATE_LIMIT_HMAC_SECRET?: string;
  /** Admin token for moderation API; configure as a Wrangler secret. */
  MODERATION_ADMIN_TOKEN?: string;
  /** Curated support-event catalog is opt-in and remains off until its migration and data review are complete. */
  PUBLIC_SUPPORT_EVENTS_MODE?: string;
  DB: D1Database;
};
