import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getRuntimeUploadsBaseDir() {
  if (process.env.VERCEL === "1") {
    return path.join(os.tmpdir(), "conformix-uploads");
  }

  return path.resolve(__dirname, "../uploads");
}

export function getSupplierUploadsRoot() {
  return path.join(getRuntimeUploadsBaseDir(), "suppliers");
}

export function getEvaluationUploadsRoot() {
  return path.join(getRuntimeUploadsBaseDir(), "evaluations");
}
