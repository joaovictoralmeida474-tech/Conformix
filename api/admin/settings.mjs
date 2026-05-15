import { getSettings } from "../../backend/src/modules/admin/adminController.js";
import { PERMISSIONS } from "../../backend/src/shared/auth/permissions.js";
import { createRouteHandler } from "../lib/runController.mjs";

export default createRouteHandler(getSettings, {
  method: "GET",
  permission: PERMISSIONS.ADMIN_ACCESS
});
