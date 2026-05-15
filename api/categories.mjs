import { listCategories } from "../backend/src/modules/category/categoryController.js";
import { PERMISSIONS } from "../backend/src/shared/auth/permissions.js";
import { createRouteHandler } from "./lib/runController.mjs";

export default createRouteHandler(listCategories, {
  method: "GET",
  permission: PERMISSIONS.CATEGORIES_VIEW
});
