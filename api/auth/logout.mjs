import { sendJson } from "../lib/http.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Metodo nao permitido" });
  }

  const cookieOptions = [
    "conformix_auth=",
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Priority=High",
    "Max-Age=0"
  ];

  if (process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "true") {
    cookieOptions.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieOptions.join("; "));
  return sendJson(res, 200, { success: true });
}
