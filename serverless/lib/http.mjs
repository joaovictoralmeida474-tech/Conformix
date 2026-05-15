export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.end(JSON.stringify(payload));
}

export function setAuthCookie(res, token, rememberMe = false) {
  const cookieName = "conformix_auth";
  const maxAge = rememberMe ? 7 * 24 * 60 * 60 : null;
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Priority=High"
  ];

  if (process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "true") {
    parts.push("Secure");
  }

  if (maxAge) {
    parts.push(`Max-Age=${maxAge}`);
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}
