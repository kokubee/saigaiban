export const OPENNAVI_PROTOCOL_NAME = "OpenNavi Protocol" as const;
export const OPENNAVI_PROTOCOL_VERSION = "1.0" as const;
export const OPENNAVI_HANDOFF_PROFILE = "handoff/v1" as const;
export const HANDOFF_SCHEMA = "saigaiban.handoff/v1" as const;

export function handoffApiUrl(site: string, slug = "{area-slug}"): string {
  return `${normalizeSite(site)}/api/opennavi/v1/handoff/${slug === "{area-slug}" ? slug : encodeURIComponent(slug)}`;
}

export function legacyHandoffApiUrl(site: string, slug = "{area-slug}"): string {
  return `${normalizeSite(site)}/api/handoff/${slug === "{area-slug}" ? slug : encodeURIComponent(slug)}`;
}

export type ProtocolDiscoveryDocument = {
  schema: "opennavi.discovery/v1";
  protocol: {
    name: typeof OPENNAVI_PROTOCOL_NAME;
    version: typeof OPENNAVI_PROTOCOL_VERSION;
    profiles: Array<{
      id: "handoff";
      version: "1";
      schema: typeof HANDOFF_SCHEMA;
      mediaType: "application/json";
      methods: ["GET", "OPTIONS"];
      endpoint: string;
      legacyEndpoint: string;
      documentation: string;
      pagination: "cursor";
    }>;
  };
  service: {
    name: "災害板";
    role: "prepared-place-master";
    site: string;
    about: string;
    sourceOfTruth: "local-site-after-handoff";
  };
  dependencies: {
    areaMeta: string;
    placeMaster: string;
  };
  policy: {
    readOnly: true;
    cors: true;
    identityOnly: true;
    publicReportProjection: "latest-public-report-only";
    excludedFields: string[];
  };
};

export function buildProtocolDiscoveryDocument(site: string, origin: string): ProtocolDiscoveryDocument {
  const normalizedSite = normalizeSite(site);
  const normalizedOrigin = normalizeSite(origin);
  return {
    schema: "opennavi.discovery/v1",
    protocol: {
      name: OPENNAVI_PROTOCOL_NAME,
      version: OPENNAVI_PROTOCOL_VERSION,
      profiles: [{
        id: "handoff",
        version: "1",
        schema: HANDOFF_SCHEMA,
        mediaType: "application/json",
        methods: ["GET", "OPTIONS"],
        endpoint: handoffApiUrl(normalizedSite),
        legacyEndpoint: legacyHandoffApiUrl(normalizedSite),
        documentation: `${normalizedSite}/protocol/opennavi/v1`,
        pagination: "cursor",
      }],
    },
    service: {
      name: "災害板",
      role: "prepared-place-master",
      site: `${normalizedSite}/`,
      about: `${normalizedSite}/about`,
      sourceOfTruth: "local-site-after-handoff",
    },
    dependencies: {
      areaMeta: `${normalizedOrigin}/api/board/meta`,
      placeMaster: `${normalizedOrigin}/api/board/places`,
    },
    policy: {
      readOnly: true,
      cors: true,
      identityOnly: true,
      publicReportProjection: "latest-public-report-only",
      excludedFields: ["phone", "owner_uid", "hidden", "review_status", "maps_url"],
    },
  };
}

function normalizeSite(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}
