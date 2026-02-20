import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./auth";
import { Role } from "./types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ roles?: Role[] }>();
    const roles = req.roles ?? [];
    const allowed = requiredRoles.some((role) => roles.includes(role));
    if (!allowed) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
