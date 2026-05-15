export function resolveApiPath(req) {
  const raw = req.query?.path;

  if (Array.isArray(raw)) {
    return raw.map((segment) => String(segment || "").trim()).filter(Boolean).join("/");
  }

  if (raw) {
    return String(raw).replace(/^\/+/, "").replace(/\/+$/g, "");
  }

  const url = String(req.url || "").split("?")[0];
  const apiMatch = url.match(/\/api\/(.+)$/i);

  if (apiMatch?.[1]) {
    return apiMatch[1];
  }

  return "";
}

export function rebuildApiUrl(req) {
  const originalPath = resolveApiPath(req);
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "path") continue;

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
      continue;
    }

    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return `/api/${originalPath}${queryString ? `?${queryString}` : ""}`;
}
