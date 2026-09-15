/**
 * Canonical inventory of every permission string currently enforced on the
 * sabyBackend API routes (extracted from src/middlewares/auth.js,
 * src/middlewares/requireAccess.js and the v1 route files). The registry uses
 * this as the source of truth to guarantee every primitive capability maps to
 * a real backend route permission and that no route permission is left without
 * a capability home.
 */
export const BACKEND_ROUTE_PERMISSIONS = [
  // admin (People)
  "admin:assignRole",
  "admin:create",
  "admin:delete",
  "admin:read",
  "admin:update",
  // app (Applications)
  "app:assign",
  "app:create",
  "app:delete",
  "app:import",
  "app:read",
  "app:toggleStatus",
  "app:update",
  // settings
  "assign:setting",
  // analytics (Reports)
  "analytics:read",
  // api keys (Integrations)
  "apikey:create",
  "apikey:delete",
  "apikey:read",
  "apikey:regenerate",
  "apikey:update",
  // baseline (Compliance)
  "baselineintelligence:create",
  "baselineintelligence:read",
  "baselinejobs:create",
  "baselinejobs:read",
  // calendar
  "calendar:manage",
  "calendar:read",
  // captures (Applications)
  "captures:create",
  "captures:delete",
  "captures:read",
  "captures:update",
  // chat (Communication)
  "chat:channel:manage",
  "chat:conversation:create",
  "chat:conversation:read",
  "chat:conversation:update",
  "chat:group:manage",
  "chat:message:create",
  "chat:message:delete",
  "chat:message:read",
  "chat:message:update",
  // collections (Applications)
  "collection:create",
  "collection:delete",
  "collection:read",
  "collection:update",
  // compliance
  "compliance:manage",
  "compliance:read",
  // form submissions (Submissions)
  "create:form-submission",
  // project forms (Projects / Forms)
  "create:project-form",
  // storage files
  "create:storage:file",
  "create:storage:folder",
  // user form settings (People)
  "create:user-form-settings",
  "delete:form-submission",
  "delete:project-form",
  "delete:storage:file",
  "delete:storage:folder",
  "delete:user-form-settings",
  "delete:user-form-settings::userId",
  // department (Structure)
  "department:create",
  "department:delete",
  "department:read",
  "department:update",
  // events (Calendar)
  "event:create",
  "event:delete",
  "event:read",
  "event:update",
  "eventConfig:create",
  "eventConfig:delete",
  "eventConfig:read",
  "eventConfig:update",
  "export:department",
  "export:read",
  // data
  "getData",
  "import:department",
  "import:event",
  // inmail (Communication)
  "inmail:create",
  "inmail:delete",
  "inmail:read",
  "inmail:update",
  // level (Structure)
  "level:create",
  "level:delete",
  "level:read",
  "level:update",
  // data
  "manageData",
  // waitlist (People)
  "manageSabyUsers",
  // node (Structure)
  "node:activate",
  "node:create",
  "node:deactivate",
  "node:delete",
  "node:import",
  "node:manage",
  "node:move",
  "node:read",
  "node:update",
  // payments
  "payment:create",
  "payment:delete",
  "payment:read",
  "payment:update",
  // permissions (People)
  "permissions:create",
  "permissions:delete",
  "permissions:read",
  "permissions:update",
  // programs (Calendar)
  "program:create",
  "program:delete",
  "program:read",
  "program:update",
  // report
  "report:create",
  "report:delete",
  "report:read",
  "report:update",
  // role (People)
  "role:create",
  "role:delete",
  "role:permissions",
  "role:read",
  "role:update",
  // settings
  "setting:create",
  "setting:delete",
  "setting:read",
  "setting:update",
  "share:storage:file",
  "share:storage:folder",
  // statements (Payments)
  "statement:create",
  "statement:delete",
  "statement:read",
  "statement:update",
  "storage:read",
  // structures (Structure)
  "structures:create",
  "structures:delete",
  "structures:read",
  "structures:update",
  // submissions
  "submission:create",
  "submission:delete",
  "submission:manage",
  "submission:read",
  "submission:update",
  "update:form-submission",
  "update:project-form",
  "update:storage:file",
  "update:storage:folder",
  "update:user-form-settings",
  "update:user-form-settings::userId",
  // user (People)
  "user:assign",
  "user:create",
  "user:delete",
  "user:import",
  "user:manage",
  "user:read",
  "user:restore",
  "user:update",
  // validation (Compliance)
  "validation:delete",
  "validation:read",
  "validation:update",
  // audit (Reports)
  "view:audit-trail",
  "view:form-submission",
  "view:payment-flow",
  "view:project-form",
  "view:storage:file",
  "view:storage:folder",
  "view:user-form-settings",
  "view:user-form-settings::userId",
] as const

export type BackendRoutePermission = (typeof BACKEND_ROUTE_PERMISSIONS)[number]