export type PublicPostingMode = "off" | "on";

/**
 * Public report intake is deliberately closed unless the deployment opts in.
 * Any missing, malformed, or unexpected value remains closed.
 */
export function publicPostingMode(raw?: string): PublicPostingMode {
  return String(raw || "").trim().toLowerCase() === "on" ? "on" : "off";
}

export function publicPostingEnabled(raw?: string): boolean {
  return publicPostingMode(raw) === "on";
}
