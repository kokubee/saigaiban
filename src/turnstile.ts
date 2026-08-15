const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_HOSTNAMES = new Set(["saigaiban.com", "www.saigaiban.com"]);
const DEFAULT_TIMEOUT_MS = 5_000;

export type TurnstileOptions = Readonly<{
  action: string;
  allowedHostnames: ReadonlySet<string>;
  timeoutMs?: number;
}>;

export function turnstileHostnames(raw?: string): ReadonlySet<string> {
  const values = String(raw || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[a-z0-9.-]+$/.test(value));
  return new Set(values.length > 0 ? values : DEFAULT_HOSTNAMES);
}

export function turnstileConfigured(secretKey?: string, siteKey?: string, allowedHostnames?: ReadonlySet<string>): boolean {
  const secret = String(secretKey || "").trim();
  const site = String(siteKey || "").trim();
  return secret.length > 0 && /^[A-Za-z0-9._~-]{10,200}$/.test(site) && Boolean(allowedHostnames?.size);
}

export async function verifyTurnstile(
  token: unknown,
  secretKey: string | undefined,
  remoteIp?: string | null,
  options: TurnstileOptions = { action: "report_submit", allowedHostnames: DEFAULT_HOSTNAMES },
): Promise<boolean> {
  const secret = String(secretKey || "").trim();
  const responseToken = String(token || "").trim();
  if (!secret || !responseToken || responseToken.length > 2048 || !options.action || !options.allowedHostnames.size) return false;
  const body = new URLSearchParams({ secret, response: responseToken });
  const ip = String(remoteIp || "").trim();
  if (ip) body.set("remoteip", ip);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown; action?: unknown; hostname?: unknown };
    return result?.success === true
      && result.action === options.action
      && typeof result.hostname === "string"
      && options.allowedHostnames.has(result.hostname.toLowerCase());
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
