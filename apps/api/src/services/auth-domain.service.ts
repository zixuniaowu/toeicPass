import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { LoginDto, RegisterDto } from "../dto";
import { RequestContext } from "../context";
import { StoreService } from "../store.service";
import { newId, nowIso } from "../utils";

@Injectable()
export class AuthDomainService {
  constructor(
    private readonly store: StoreService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ userId: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingUser = this.store.users.find((item) => item.email === normalizedEmail);
    if (existingUser) {
      throw new BadRequestException("Email already registered");
    }

    let tenant = this.store.tenants.find((item) => item.code === dto.tenantCode);
    if (!tenant) {
      tenant = {
        id: newId(),
        code: dto.tenantCode,
        name: dto.tenantName,
        createdAt: nowIso(),
      };
      this.store.tenants.push(tenant);
    }

    const passwordHash = await hash(dto.password, 10);
    const user = {
      id: newId(),
      email: normalizedEmail,
      passwordHash,
      displayName: dto.displayName,
      isActive: true,
      createdAt: nowIso(),
    };
    this.store.users.push(user);

    const tenantUsers = this.store.memberships.filter((item) => item.tenantId === tenant!.id);
    const role = tenantUsers.length === 0 ? "tenant_admin" : "learner";
    this.store.memberships.push({
      id: newId(),
      tenantId: tenant.id,
      userId: user.id,
      role,
    });

    this.store.ensureSeedQuestions(tenant.id, user.id);
    this.store.ensureSeedVocabularyCards(tenant.id, user.id);

    return { userId: user.id };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; tenantCode: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = this.store.users.find((item) => item.email === normalizedEmail);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const matched = await compare(dto.password, user.passwordHash);
    if (!matched) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const requestedTenantCode = dto.tenantCode?.trim();
    let tenant = requestedTenantCode
      ? this.store.tenants.find((item) => item.code === requestedTenantCode)
      : undefined;

    if (requestedTenantCode && !tenant) {
      throw new UnauthorizedException("Tenant not found");
    }

    if (tenant) {
      const tenantId = tenant.id;
      const membership = this.store.memberships.find(
        (item) => item.tenantId === tenantId && item.userId === user.id,
      );
      if (!membership) {
        throw new UnauthorizedException("No tenant access");
      }
    } else {
      const memberships = this.store.memberships.filter((item) => item.userId === user.id);
      if (memberships.length === 0) {
        throw new UnauthorizedException("No tenant access");
      }
      if (memberships.length > 1) {
        throw new BadRequestException("Multiple tenants found. Please provide tenant code.");
      }
      tenant = this.store.tenants.find((item) => item.id === memberships[0].tenantId);
      if (!tenant) {
        throw new UnauthorizedException("Tenant not found");
      }
    }

    const activeTenant = tenant;
    this.store.ensureSeedQuestions(activeTenant.id, user.id);
    this.store.ensureSeedVocabularyCards(activeTenant.id, user.id);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { accessToken, tenantCode: activeTenant.code };
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = this.store.users.find((item) => item.id === userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { accessToken };
  }

  getMe(ctx: RequestContext): {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    tenantId: string;
  } {
    const user = this.store.users.find((item) => item.id === ctx.userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: ctx.roles,
      tenantId: ctx.tenantId,
    };
  }
}
