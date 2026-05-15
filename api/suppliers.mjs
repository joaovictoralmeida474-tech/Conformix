import { listSuppliers } from "../backend/src/modules/supplier/supplierController.js";
import { PERMISSIONS } from "../backend/src/shared/auth/permissions.js";
import { createRouteHandler } from "./lib/runController.mjs";

export default createRouteHandler(listSuppliers, {
  method: "GET",
  permission: PERMISSIONS.SUPPLIERS_VIEW
});
