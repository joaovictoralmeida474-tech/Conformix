import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const backendRoot = path.resolve(currentDir, "../../..");

const envCandidates = [
  path.join(backendRoot, ".env"),
  path.join(process.cwd(), ".env")
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

function fillEnvAlias(targetKey, aliases) {
  const currentValue = String(process.env[targetKey] || "").trim();

  if (currentValue) {
    return;
  }

  for (const alias of aliases) {
    const aliasValue = String(process.env[alias] || "").trim();

    if (aliasValue) {
      process.env[targetKey] = aliasValue;
      return;
    }
  }
}

fillEnvAlias("SUPABASE_URL", ["VITE_SUPABASE_URL"]);
fillEnvAlias("SUPABASE_ANON_KEY", ["VITE_SUPABASE_ANON_KEY"]);
