import express from "express";

import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { auth, requirePermission } from "../../shared/middlewares/auth.js";
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

router.get("/", auth, requirePermission(PERMISSIONS.SUPPLIERS_VIEW), listSuppliers);
router.post("/", auth, requirePermission(PERMISSIONS.SUPPLIERS_MANAGE), createSupplier);
router.get("/export/excel", auth, requirePermission(PERMISSIONS.SUPPLIERS_EXPORT), exportSupplierExcel);
router.get("/cnpj/:cnpj", auth, requirePermission(PERMISSIONS.SUPPLIERS_MANAGE), buscarCNPJ);
router.get(
  "/:id/documents/:documentId/download",
  auth,
  requirePermission(PERMISSIONS.SUPPLIERS_VIEW),
  downloadSupplierDocument
);
router.get(
  "/:id/evaluations/:evaluationId/download",
  auth,
  requirePermission(PERMISSIONS.SUPPLIERS_VIEW),
  downloadEvaluationDocument
);
router.post(
  "/:id/documents",
  auth,
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  supplierDocumentsUpload.any(),
  syncSupplierDocuments
);
router.get("/:id", auth, requirePermission(PERMISSIONS.SUPPLIERS_VIEW), getSupplier);
router.put("/:id", auth, requirePermission(PERMISSIONS.SUPPLIERS_MANAGE), updateSupplier);
router.delete("/:id", auth, requirePermission(PERMISSIONS.SUPPLIERS_MANAGE), deleteSupplier);
router.post(
  "/:id/evaluations",
  auth,
  requirePermission(PERMISSIONS.SUPPLIERS_EVALUATE),
  evaluationDocumentsUpload.single("evaluationDocument"),
  evaluateSupplier
);

export default router;
