import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { getMaxUploadSizeBytes } from "../config/security.js";

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

function pdfOnlyFilter(_, file, callback) {
  const originalName = String(file.originalname || "").toLowerCase();
  const mimeType = String(file.mimetype || "").toLowerCase();
  const isPdf = mimeType === "application/pdf" || originalName.endsWith(".pdf");

  if (!isPdf) {
    callback(new Error("Apenas arquivos PDF sao permitidos"));
    return;
  }

  callback(null, true);
}

function buildUpload(uploadRoot, maxFiles = 1) {
  return multer({
    storage: buildStorage(uploadRoot),
    fileFilter: pdfOnlyFilter,
    limits: {
      fileSize: getMaxUploadSizeBytes(),
      files: maxFiles
    }
  });
}

export const supplierDocumentsUpload = buildUpload(supplierUploadRoot, 20);
export const evaluationDocumentsUpload = buildUpload(evaluationUploadRoot, 1);
