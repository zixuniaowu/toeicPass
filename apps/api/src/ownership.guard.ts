/**
 * OwnershipGuard — ensures a user can only access/modify resources they own.
 *
 * Apply to any route that has a `:userId` or `:id` path param that corresponds
 * to the authenticated user's ID.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, TenantGuard, OwnershipGuard)
 *   @Patch('users/:userId/profile')
 *   updateProfile(...)
 *
 * Bypass options (via @OwnershipBypass decorator):
 *   - Roles in BYPASS_ROLES (coach, tenant_admin, super_admin) are exempt.
 *   - Decorate handler/controller with @OwnershipBypass() to skip the check.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "./types";
import { JwtUser } from "./auth";

/** Roles that are exempt from ownership enforcement. */
const BYPASS_ROLES: Role[] = ["coach", "tenant_admin", "super_admin"];

export const OWNERSHIP_BYPASS_KEY = "ownershipBypass";

/**
 * Decorate a route with `@OwnershipBypass()` to skip ownership checks.
 * Useful for admin endpoints that legitimately access any user's data.
 */
export const OwnershipBypass = () => SetMetadata(OWNERSHIP_BYPASS_KEY, true);

/**
 * The param name(s) checked against the authenticated user's ID.
 * Resolved in order: first match wins.
 */
const USER_PARAM_NAMES = ["userId", "id"] as const;

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Allow explicit bypass
    const bypass = this.reflector.getAllAndOverride<boolean>(
      OWNERSHIP_BYPASS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (bypass) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      user?: JwtUser;
      roles?: Role[];
      params?: Record<string, string>;
    }>();

    // Privileged roles bypass ownership enforcement
    const userRoles = req.roles ?? [];
    if (BYPASS_ROLES.some((r) => userRoles.includes(r))) {
      return true;
    }

    const authenticatedUserId = req.user?.sub;
    if (!authenticatedUserId) {
      throw new ForbiddenException("Authenticated user context missing");
    }

    // Find the first matching param
    const params = req.params ?? {};
    const targetUserId = USER_PARAM_NAMES.map((name) => params[name]).find(
      (val) => val !== undefined,
    );

    if (!targetUserId) {
      // No user-scoped param found — allow through (no ownership assertion possible)
      return true;
    }

    if (targetUserId !== authenticatedUserId) {
      throw new ForbiddenException(
        "You are not allowed to access or modify another user's data",
      );
    }

    return true;
  }
}
