import express from "express";

import { PERMISSIONS } from "../../shared/auth/permissions.js";
import { auth, requirePermission } from "../../shared/middlewares/auth.js";
import { invoiceDocumentsUpload } from "../../shared/middlewares/upload.js";
import {
  createInvoice,
  deleteInvoice,
  deleteInvoiceFile,
  downloadInvoiceFile,
  getInvoice,
  listInvoices,
  updateInvoice,
  updateInvoiceStatus,
  uploadInvoiceFiles
} from "./nfsController.js";

const router = express.Router();

router.get("/", auth, requirePermission(PERMISSIONS.NFS_VIEW), listInvoices);
router.get("/:id", auth, requirePermission(PERMISSIONS.NFS_VIEW), getInvoice);
router.post("/", auth, requirePermission(PERMISSIONS.NFS_MANAGE), createInvoice);
router.put("/:id", auth, requirePermission(PERMISSIONS.NFS_MANAGE), updateInvoice);
router.patch(
  "/:id/status",
  auth,
  requirePermission(PERMISSIONS.NFS_MANAGE),
  updateInvoiceStatus
);
router.post(
  "/:id/files",
  auth,
  requirePermission(PERMISSIONS.NFS_MANAGE),
  invoiceDocumentsUpload.fields([
    { name: "pdfFile", maxCount: 1 },
    { name: "xmlFile", maxCount: 1 }
  ]),
  uploadInvoiceFiles
);
router.get(
  "/:id/files/:kind/download",
  auth,
  requirePermission(PERMISSIONS.NFS_VIEW),
  downloadInvoiceFile
);
router.delete(
  "/:id/files/:kind",
  auth,
  requirePermission(PERMISSIONS.NFS_MANAGE),
  deleteInvoiceFile
);
router.delete("/:id", auth, requirePermission(PERMISSIONS.NFS_MANAGE), deleteInvoice);

export default router;
