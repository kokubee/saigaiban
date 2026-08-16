import type { BoardMeta, BoardPlace, PlaceSummary, Report } from "./types.ts";
import {
  HANDOFF_SCHEMA,
  OPENNAVI_HANDOFF_PROFILE,
  OPENNAVI_PROTOCOL_NAME,
  OPENNAVI_PROTOCOL_VERSION,
  handoffApiUrl,
  legacyHandoffApiUrl,
} from "./protocol.ts";

export { HANDOFF_SCHEMA } from "./protocol.ts";

export type HandoffReport = {
  id: string;
  verdict: Report["verdict"];
  note: string | null;
  createdAt: string;
  role: Report["role"];
  preferMaps: boolean;
  evidence: Report["evidence"] | null;
};

export type HandoffPlace = {
  id: string;
  name: string;
  area: string;
  category: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  source: string | null;
  dataBasisDate: string | null;
  identityOnly: true;
  reportCount: number;
  latestReport: HandoffReport | null;
};

export type HandoffDocument = {
  schema: typeof HANDOFF_SCHEMA;
  protocol: {
    name: typeof OPENNAVI_PROTOCOL_NAME;
    version: typeof OPENNAVI_PROTOCOL_VERSION;
    profile: typeof OPENNAVI_HANDOFF_PROFILE;
  };
  kind: "prepared-place-master";
  generatedAt: string;
  source: {
    site: string;
    about: string;
    api: string;
    legacyApi: string;
  };
  handoff: {
    phase: "prepared";
    next: "local-site";
    statement: string;
  };
  disaster: BoardMeta["disaster"];
  area: {
    slug: string;
    nameJa: string;
    prefCode: string;
    active: boolean;
  };
  license: BoardMeta["placeLicense"] | null;
  upstream: {
    generatedAt: string | null;
  };
  pagination: {
    nextCursor: string | null;
  };
  places: HandoffPlace[];
};

function projectReport(report: Report | null): HandoffReport | null {
  if (!report) return null;
  return {
    id: report.id,
    verdict: report.verdict,
    note: report.note,
    createdAt: report.created_at,
    role: report.role,
    preferMaps: report.prefer_maps,
    evidence: report.evidence || null,
  };
}

export function buildHandoffDocument(
  site: string,
  meta: BoardMeta,
  area: BoardMeta["areas"][number],
  places: BoardPlace[],
  summaries: Map<string, PlaceSummary>,
  upstreamGeneratedAt: string | null = null,
  nextCursor: string | null = null,
  generatedAt = new Date().toISOString(),
): HandoffDocument {
  const normalizedSite = site.replace(/\/+$/, "");
  return {
    schema: HANDOFF_SCHEMA,
    protocol: {
      name: OPENNAVI_PROTOCOL_NAME,
      version: OPENNAVI_PROTOCOL_VERSION,
      profile: OPENNAVI_HANDOFF_PROFILE,
    },
    kind: "prepared-place-master",
    generatedAt,
    source: {
      site: normalizedSite,
      about: `${normalizedSite}/about`,
      api: handoffApiUrl(normalizedSite, area.slug),
      legacyApi: legacyHandoffApiUrl(normalizedSite, area.slug),
    },
    handoff: {
      phase: "prepared",
      next: "local-site",
      statement: "現地サイトが立ち上がったら、現地サイトを正本として引き継いでください。",
    },
    disaster: meta.disaster,
    area: {
      slug: area.slug,
      nameJa: area.nameJa,
      prefCode: area.prefCode,
      active: area.status === "active",
    },
    license: meta.placeLicense || null,
    upstream: { generatedAt: upstreamGeneratedAt || null },
    pagination: { nextCursor: nextCursor || null },
    places: places.map((place) => {
      const summary = summaries.get(place.id);
      return {
        id: place.id,
        name: place.name,
        area: place.area,
        category: place.category,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        source: place.source,
        dataBasisDate: place.data_basis_date,
        identityOnly: true,
        reportCount: summary?.count || 0,
        latestReport: projectReport(summary?.latest || null),
      };
    }),
  };
}
