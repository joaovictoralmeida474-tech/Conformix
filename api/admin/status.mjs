import "../../backend/src/shared/config/loadEnv.js";
import { resolveDatabaseUrl, isDatabaseConfigured } from "../../backend/src/shared/config/databaseEnv.js";
import { testDatabaseConnection } from "../../backend/src/shared/database/platformBootstrap.js";
import { sendJson } from "../lib/http.mjs";

export default async function handler(_req, res) {
  resolveDatabaseUrl();

  const configured = isDatabaseConfigured();
  const connected = configured ? await testDatabaseConnection() : false;

  return sendJson(res, 200, {
    databaseConfigured: configured,
    databaseConnected: connected,
    vercel: process.env.VERCEL === "1"
  });
}
