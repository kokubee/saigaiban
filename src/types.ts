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

export type Verdict = "open" | "limited" | "closed" | "still" | "changed" | "maps";

export type ReportRole = "visitor" | "owner";

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
};

export type PlaceSummary = {
  latest: Report | null;
  latestOwner: Report | null;
  count: number;
};

export type Env = {
  OPENNAVI_ORIGIN: string;
  SITE_ORIGIN: string;
  GA4_MEASUREMENT_ID?: string;
  DB: D1Database;
};
