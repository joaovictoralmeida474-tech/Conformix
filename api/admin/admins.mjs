import { createAdmin, listAdmins } from "../../backend/src/modules/admin/adminController.js";
import { PERMISSIONS } from "../../backend/src/shared/auth/permissions.js";
import { createMethodRouteHandler } from "../lib/runController.mjs";

export default createMethodRouteHandler({
  GET: { handler: listAdmins, permission: PERMISSIONS.ADMINS_VIEW },
  POST: { handler: createAdmin, permission: PERMISSIONS.ADMINS_MANAGE }
});
