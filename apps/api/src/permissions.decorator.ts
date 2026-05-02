/**
 * Fine-grained permissions system built on top of the RBAC roles.
 *
 * Usage:
 *   @RequirePermissions('question:publish', 'question:delete')
 *   async deleteQuestion(...) {}
 *
 * Permissions follow the `resource:action` convention.
 */
import { SetMetadata } from "@nestjs/common";

// ── Permission definitions ────────────────────────────────────────────────────

export const QUESTION_PERMISSIONS = [
  "question:read",
  "question:create",
  "question:update",
  "question:publish",
  "question:archive",
  "question:delete",
] as const;

export const USER_PERMISSIONS = [
  "user:read_own",
  "user:update_own",
  "user:read_any",
  "user:update_any",
  "user:delete_any",
] as const;

export const TENANT_PERMISSIONS = [
  "tenant:read",
  "tenant:manage",
  "tenant:invite",
] as const;

export const ENTERPRISE_PERMISSIONS = [
  "enterprise:campaign_create",
  "enterprise:campaign_manage",
  "enterprise:result_import",
  "enterprise:candidate_import",
] as const;

export const ANALYTICS_PERMISSIONS = [
  "analytics:read_own",
  "analytics:read_tenant",
  "analytics:read_all",
] as const;

export type Permission =
  | (typeof QUESTION_PERMISSIONS)[number]
  | (typeof USER_PERMISSIONS)[number]
  | (typeof TENANT_PERMISSIONS)[number]
  | (typeof ENTERPRISE_PERMISSIONS)[number]
  | (typeof ANALYTICS_PERMISSIONS)[number];

// ── Role → Permission mapping ─────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  learner: [
    "question:read",
    "user:read_own",
    "user:update_own",
    "analytics:read_own",
  ],
  coach: [
    "question:read",
    "question:create",
    "question:update",
    "user:read_own",
    "user:update_own",
    "user:read_any",
    "analytics:read_own",
    "analytics:read_tenant",
    "enterprise:campaign_manage",
    "enterprise:result_import",
  ],
  tenant_admin: [
    "question:read",
    "question:create",
    "question:update",
    "question:publish",
    "question:archive",
    "user:read_own",
    "user:update_own",
    "user:read_any",
    "user:update_any",
    "tenant:read",
    "tenant:manage",
    "tenant:invite",
    "analytics:read_own",
    "analytics:read_tenant",
    "enterprise:campaign_create",
    "enterprise:campaign_manage",
    "enterprise:result_import",
    "enterprise:candidate_import",
  ],
  super_admin: [
    "question:read",
    "question:create",
    "question:update",
    "question:publish",
    "question:archive",
    "question:delete",
    "user:read_own",
    "user:update_own",
    "user:read_any",
    "user:update_any",
    "user:delete_any",
    "tenant:read",
    "tenant:manage",
    "tenant:invite",
    "analytics:read_own",
    "analytics:read_tenant",
    "analytics:read_all",
    "enterprise:campaign_create",
    "enterprise:campaign_manage",
    "enterprise:result_import",
    "enterprise:candidate_import",
  ],
};

// ── Decorator ─────────────────────────────────────────────────────────────────

export const PERMISSIONS_KEY = "permissions";

/**
 * Attach required permissions to a route handler.
 * The `PermissionsGuard` will verify that the authenticated user's role
 * grants ALL listed permissions.
 *
 * @example
 *   @RequirePermissions('question:publish')
 *   @Patch(':id/publish')
 *   publishQuestion(...) {}
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
