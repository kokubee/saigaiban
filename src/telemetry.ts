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

export type TelemetryParams = Readonly<Record<string, TelemetryValue>>;

export function sanitizeTelemetry(
  event: TelemetryEventName,
  params: TelemetryParams = {},
): Record<string, TelemetryValue> {
  const allowed = new Set(ALLOWED_KEYS[event]);
  const out: Record<string, TelemetryValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!allowed.has(key)) continue;
    if (typeof value === "string" && value.length > 80) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

export function telemetryAllowlist(event: TelemetryEventName): readonly string[] {
  return ALLOWED_KEYS[event];
}
