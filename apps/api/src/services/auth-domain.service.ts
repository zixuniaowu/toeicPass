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
  private readonly defaultAccountEnabled = (process.env.DEFAULT_ACCOUNT_ENABLED ?? "true").toLowerCase() !== "false";
  private readonly defaultTenantCode = (process.env.DEFAULT_TENANT_CODE ?? "demo").trim();
  private readonly defaultTenantName = (process.env.DEFAULT_TENANT_NAME ?? "Demo Tenant").trim();
  private readonly defaultEmail = (process.env.DEFAULT_ACCOUNT_EMAIL ?? "owner@demo.com").trim().toLowerCase();
  private readonly defaultPassword = process.env.DEFAULT_ACCOUNT_PASSWORD ?? "toeic123";
  private readonly defaultDisplayName = (process.env.DEFAULT_ACCOUNT_DISPLAY_NAME ?? "Demo Owner").trim();

  constructor(
    private readonly store: StoreService,
    private readonly jwtService: JwtService,
  ) {}

  private async ensureDefaultAccountOnDemand(
    normalizedEmail: string,
    password: string,
    requestedTenantCode?: string,
  ): Promise<void> {
    if (!this.defaultAccountEnabled) {
      return;
    }
    if (!this.defaultEmail || !this.defaultPassword || !this.defaultTenantCode) {
      return;
    }
    if (normalizedEmail !== this.defaultEmail || password !== this.defaultPassword) {
      return;
    }

    const tenantCode = requestedTenantCode?.trim() || this.defaultTenantCode;
    if (tenantCode !== this.defaultTenantCode) {
      return;
    }

    let tenant = this.store.tenants.find((item) => item.code === this.defaultTenantCode);
    if (!tenant) {
      tenant = {
        id: newId(),
        code: this.defaultTenantCode,
        name: this.defaultTenantName || this.defaultTenantCode,
        createdAt: nowIso(),
      };
      this.store.tenants.push(tenant);
    }

    let user = this.store.users.find((item) => item.email === this.defaultEmail);
    if (!user) {
      const passwordHash = await hash(this.defaultPassword, 10);
      user = {
        id: newId(),
        email: this.defaultEmail,
        passwordHash,
        displayName: this.defaultDisplayName || "Demo Owner",
        isActive: true,
        createdAt: nowIso(),
      };
      this.store.users.push(user);
    } else {
      // Keep demo account always usable in demo deployments (HF/local preview).
      user.passwordHash = await hash(this.defaultPassword, 10);
      if (!user.displayName) {
        user.displayName = this.defaultDisplayName || "Demo Owner";
      }
      user.isActive = true;
    }

    const membership = this.store.memberships.find(
      (item) => item.tenantId === tenant.id && item.userId === user.id,
    );
    if (!membership) {
      this.store.memberships.push({
        id: newId(),
        tenantId: tenant.id,
        userId: user.id,
        role: "tenant_admin",
      });
    }

    this.store.ensureSeedQuestions(tenant.id, user.id);
    this.store.ensureSeedVocabularyCards(tenant.id, user.id);
  }

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
    await this.ensureDefaultAccountOnDemand(normalizedEmail, dto.password, dto.tenantCode);
    const user = this.store.users.find((item) => item.email === normalizedEmail);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (!user.passwordHash || typeof user.passwordHash !== "string") {
      throw new UnauthorizedException("Invalid credentials");
    }
    let matched = false;
    try {
      matched = await compare(dto.password, user.passwordHash);
    } catch {
      throw new UnauthorizedException("Invalid credentials");
    }
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
