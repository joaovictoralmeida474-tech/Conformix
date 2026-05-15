import handler from "../handler.mjs";
import { resolveApiPath } from "../lib/resolveApiPath.mjs";

export default async function adminDynamicRoute(req, res) {
  const tail = resolveApiPath(req);
  req.query = {
    ...req.query,
    path: tail ? `admin/${tail}` : "admin"
  };

  return handler(req, res);
}
