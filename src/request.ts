const MAX_REPORT_BODY_BYTES = 8 * 1024;

export function reportRequestHeadersAllowed(request: Request): boolean {
  const contentType = String(request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") return false;
  const rawLength = request.headers.get("content-length");
  if (!rawLength || !/^\d+$/.test(rawLength.trim())) return false;
  return Number(rawLength) <= MAX_REPORT_BODY_BYTES;
}

export const REPORT_BODY_MAX_BYTES = MAX_REPORT_BODY_BYTES;

export function adminRequestHeadersAllowed(request: Request): boolean {
  const contentType = String(request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const rawLength = request.headers.get("content-length");
  return contentType === "application/json" && Boolean(rawLength && /^\d+$/.test(rawLength.trim()) && Number(rawLength) <= 2 * 1024);
}
