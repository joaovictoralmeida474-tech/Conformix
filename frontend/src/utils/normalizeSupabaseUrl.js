export function normalizeSupabaseUrl(url) {
  let normalized = String(url || "").trim();

  if (!normalized) {
    return "";
  }

  normalized = normalized
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/auth\/v1\/?$/i, "")
    .replace(/\/+$/, "");

  try {
    const parsed = new URL(normalized);

    if (parsed.hostname.includes("supabase.co") && parsed.pathname && parsed.pathname !== "/") {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return normalized;
  }

  return normalized;
}
