import express from "express";

import { auth } from "../../shared/middlewares/auth.js";
import {
  evaluationDocumentsUpload,
  supplierDocumentsUpload
} from "../../shared/middlewares/upload.js";
import {
  buscarCNPJ,
  createSupplier,
  downloadEvaluationDocument,
  downloadSupplierDocument,
  getSupplier,
  deleteSupplier,
  evaluateSupplier,
  exportSupplierExcel,
  listSuppliers,
  syncSupplierDocuments,
  updateSupplier
} from "./supplierController.js";

const router = express.Router();

router.get("/", auth, listSuppliers);
router.post("/", auth, createSupplier);
router.get("/export/excel", auth, exportSupplierExcel);
router.get("/cnpj/:cnpj", auth, buscarCNPJ);
router.get("/:id/documents/:documentId/download", auth, downloadSupplierDocument);
router.get("/:id/evaluations/:evaluationId/download", auth, downloadEvaluationDocument);
router.post("/:id/documents", auth, supplierDocumentsUpload.any(), syncSupplierDocuments);
router.get("/:id", auth, getSupplier);
router.put("/:id", auth, updateSupplier);
router.delete("/:id", auth, deleteSupplier);
router.post("/:id/evaluations", auth, evaluationDocumentsUpload.single("evaluationDocument"), evaluateSupplier);

export default router;
