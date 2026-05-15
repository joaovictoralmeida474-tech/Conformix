import { createDepartment, listDepartments } from "../../backend/src/modules/admin/adminController.js";
import { PERMISSIONS } from "../../backend/src/shared/auth/permissions.js";
import { createMethodRouteHandler } from "../lib/runController.mjs";

export default createMethodRouteHandler({
  GET: { handler: listDepartments, permission: PERMISSIONS.DEPARTMENTS_VIEW },
  POST: { handler: createDepartment, permission: PERMISSIONS.DEPARTMENTS_MANAGE }
});
