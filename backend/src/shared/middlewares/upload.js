import fs from "fs";
import multer from "multer";
import { getMaxUploadSizeBytes } from "../config/security.js";
import { getEvaluationUploadsRoot, getInvoiceUploadsRoot, getSupplierUploadsRoot } from "../uploads.js";

const supplierUploadRoot = getSupplierUploadsRoot();
const evaluationUploadRoot = getEvaluationUploadsRoot();
const invoiceUploadRoot = getInvoiceUploadsRoot();

function buildStorage(uploadRoot) {
  return multer.diskStorage({
    destination: (_, __, callback) => {
      try {
        fs.mkdirSync(uploadRoot, { recursive: true });
      } catch (error) {
        callback(error);
        return;
      }

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

function invoiceFileFilter(_, file, callback) {
  const originalName = String(file.originalname || "").toLowerCase();
  const mimeType = String(file.mimetype || "").toLowerCase();
  const isPdf = mimeType === "application/pdf" || originalName.endsWith(".pdf");
  const isXml =
    mimeType.includes("xml") ||
    originalName.endsWith(".xml") ||
    originalName.endsWith(".txt");

  if (!isPdf && !isXml) {
    callback(new Error("Apenas arquivos PDF ou XML sao permitidos"));
    return;
  }

  callback(null, true);
}

function buildUpload(uploadRoot, maxFiles = 1, fileFilter = pdfOnlyFilter) {
  return multer({
    storage: buildStorage(uploadRoot),
    fileFilter,
    limits: {
      fileSize: getMaxUploadSizeBytes(),
      files: maxFiles
    }
  });
}

export const supplierDocumentsUpload = buildUpload(supplierUploadRoot, 20);
export const evaluationDocumentsUpload = buildUpload(evaluationUploadRoot, 1);
export const invoiceDocumentsUpload = buildUpload(invoiceUploadRoot, 2, invoiceFileFilter);
