import { createUser, listUsers } from "../../backend/src/modules/admin/adminController.js";
import { PERMISSIONS } from "../../backend/src/shared/auth/permissions.js";
import { createMethodRouteHandler } from "../lib/runController.mjs";

export default createMethodRouteHandler({
  GET: { handler: listUsers, permission: PERMISSIONS.USERS_VIEW },
  POST: { handler: createUser, permission: PERMISSIONS.USERS_MANAGE }
});
