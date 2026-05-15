import { listDepartments } from "../../backend/src/modules/admin/adminController.js";
import { PERMISSIONS } from "../../backend/src/shared/auth/permissions.js";
import { createRouteHandler } from "../lib/runController.mjs";

export default createRouteHandler(listDepartments, {
  method: "GET",
  permission: PERMISSIONS.DEPARTMENTS_VIEW
});
