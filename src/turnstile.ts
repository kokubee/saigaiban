const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileConfigured(secretKey?: string, siteKey?: string): boolean {
  const secret = String(secretKey || "").trim();
  const site = String(siteKey || "").trim();
  return secret.length > 0 && /^[A-Za-z0-9._~-]{10,200}$/.test(site);
}

export async function verifyTurnstile(
  token: unknown,
  secretKey: string | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = String(secretKey || "").trim();
  const responseToken = String(token || "").trim();
  if (!secret || !responseToken) return false;
  const body = new URLSearchParams({ secret, response: responseToken });
  const ip = String(remoteIp || "").trim();
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result?.success === true;
  } catch {
    return false;
  }
}
