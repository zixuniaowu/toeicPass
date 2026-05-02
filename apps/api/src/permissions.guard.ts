import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY, Permission, ROLE_PERMISSIONS } from "./permissions.decorator";
import { Role } from "./types";

/**
 * Enforces fine-grained permissions defined by `@RequirePermissions(...)`.
 *
 * This guard must run AFTER `JwtAuthGuard` + `TenantGuard` so that
 * `req.roles` is already populated with the user's tenant-scoped roles.
 *
 * A user passes if ANY of their roles grants ALL of the required permissions.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions required → allow through (roles guard handles role checks)
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ roles?: Role[] }>();
    const userRoles = req.roles ?? [];

    // Collect all permissions granted by the user's roles
    const grantedPermissions = new Set<string>(
      userRoles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []),
    );

    const missing = required.filter((p) => !grantedPermissions.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required permissions: ${missing.join(", ")}`,
      );
    }

    return true;
  }
}
