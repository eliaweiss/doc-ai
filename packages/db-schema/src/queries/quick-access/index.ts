/**
 * Quick Access Query Functions
 *
 * All queries are scoped to orgId and userId for multi-tenant safety.
 */

export { createQuickAccess } from "./createQuickAccess";
export { deleteQuickAccess } from "./deleteQuickAccess";
export { listQuickAccessForOrg } from "./listQuickAccessForOrg";
export { reorderQuickAccess } from "./reorderQuickAccess";
export { seedDefaultQuickAccess } from "./seedDefaultQuickAccess";
