export type TelemetryEventName =
  | "area_open"
  | "need_select"
  | "official_open"
  | "report_submit"
  | "zero_result"
  | "time_to_first_action";

type TelemetryValue = string | number | boolean;

const ALLOWED_KEYS: Record<TelemetryEventName, readonly string[]> = {
  area_open: ["area"],
  need_select: ["area", "need"],
  official_open: ["area", "kind"],
  report_submit: ["area", "category", "verdict"],
  zero_result: ["area", "category"],
  time_to_first_action: ["area", "elapsed_ms"],
};

const TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const CATEGORIES = new Set(["hinanjo", "water", "water_spot", "toilet", "bath", "laundry", "gas", "conv", "super", "shop", "food", "meal"]);
const NEEDS = new Set(["safety", "water", "food", "toilet", "fuel", "medical", "bath", "transport"]);
const OFFICIAL_KINDS = new Set(["hub", "support", "lifeline", "evacuation", "medical", "water", "power"]);
const VERDICTS = new Set(["open", "limited", "closed", "still", "changed", "maps"]);

function validToken(value: TelemetryValue): boolean {
  return typeof value === "string" && TOKEN.test(value);
}

function validVerdict(value: TelemetryValue): boolean {
  return typeof value === "string" && VERDICTS.has(value);
}

function validFrom(value: TelemetryValue, known: ReadonlySet<string>): boolean {
  return typeof value === "string" && known.has(value);
}

function validElapsed(value: TelemetryValue): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3_600_000;
}

const VALUE_RULES: Record<TelemetryEventName, Partial<Record<string, (value: TelemetryValue) => boolean>>> = {
  area_open: { area: validToken },
  need_select: { area: validToken, need: (value) => validFrom(value, NEEDS) },
  official_open: { area: validToken, kind: (value) => validFrom(value, OFFICIAL_KINDS) },
  report_submit: { area: validToken, category: (value) => validFrom(value, CATEGORIES), verdict: validVerdict },
  zero_result: { area: validToken, category: (value) => validFrom(value, CATEGORIES) },
  time_to_first_action: { area: validToken, elapsed_ms: validElapsed },
};

export type TelemetryParams = Readonly<Record<string, TelemetryValue>>;
export type TelemetryContext = Readonly<{ areaSlugs: ReadonlySet<string> }>;

export function sanitizeTelemetry(
  event: TelemetryEventName,
  params: TelemetryParams = {},
  context?: TelemetryContext,
): Record<string, TelemetryValue> {
  const allowed = new Set(ALLOWED_KEYS[event]);
  const out: Record<string, TelemetryValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!allowed.has(key)) continue;
    if (typeof value === "string" && value.length > 80) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    if (key === "area" && (typeof value !== "string" || !context?.areaSlugs.has(value))) continue;
    const validate = VALUE_RULES[event][key];
    if (!validate || !validate(value)) continue;
    out[key] = value;
  }
  return out;
}

export function telemetryAllowlist(event: TelemetryEventName): readonly string[] {
  return ALLOWED_KEYS[event];
}
