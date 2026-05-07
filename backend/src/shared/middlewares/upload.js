import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supplierUploadRoot = path.resolve(__dirname, "../../uploads/suppliers");
const evaluationUploadRoot = path.resolve(__dirname, "../../uploads/evaluations");

fs.mkdirSync(supplierUploadRoot, { recursive: true });
fs.mkdirSync(evaluationUploadRoot, { recursive: true });

function buildStorage(uploadRoot) {
  return multer.diskStorage({
    destination: (_, __, callback) => {
      callback(null, uploadRoot);
    },
    filename: (_, file, callback) => {
      const safeName = String(file.originalname || "documento")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      callback(null, `${Date.now()}-${safeName}`);
    }
  });
}

export const supplierDocumentsUpload = multer({ storage: buildStorage(supplierUploadRoot) });
export const evaluationDocumentsUpload = multer({ storage: buildStorage(evaluationUploadRoot) });
