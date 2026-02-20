import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { StoreService } from "./store.service";
import { Role } from "./types";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export interface JwtUser {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? "dev-secret",
    });
  }

  validate(payload: JwtUser): JwtUser {
    return payload;
  }
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly store: StoreService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtUser;
      tenantId?: string;
      tenantCode?: string;
      roles?: Role[];
    }>();
    const tenantCode = req.headers["x-tenant-code"];
    if (!tenantCode) {
      throw new UnauthorizedException("Missing x-tenant-code header");
    }
    const tenant = this.store.tenants.find((item) => item.code === tenantCode);
    if (!tenant) {
      throw new UnauthorizedException("Tenant not found");
    }
    if (!req.user) {
      throw new UnauthorizedException("Missing user context");
    }

    const memberRoles = this.store.memberships
      .filter((item) => item.tenantId === tenant.id && item.userId === req.user?.sub)
      .map((item) => item.role);

    if (memberRoles.length === 0) {
      throw new UnauthorizedException("No membership in tenant");
    }

    req.tenantId = tenant.id;
    req.tenantCode = tenant.code;
    req.roles = memberRoles;
    return true;
  }
}
