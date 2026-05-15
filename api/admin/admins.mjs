import { listAdmins } from "../../backend/src/modules/admin/adminController.js";
import { PERMISSIONS } from "../../backend/src/shared/auth/permissions.js";
import { createRouteHandler } from "../lib/runController.mjs";

export default createRouteHandler(listAdmins, {
  method: "GET",
  permission: PERMISSIONS.ADMINS_VIEW
});
