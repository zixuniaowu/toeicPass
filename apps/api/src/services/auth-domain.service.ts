import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { LoginDto, OAuthLoginDto, RegisterDto } from "../dto";
import { RequestContext } from "../context";
import { StoreService } from "../store.service";
import { newId, nowIso } from "../utils";

@Injectable()
export class AuthDomainService {
  private readonly logger = new Logger(AuthDomainService.name);
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

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string; tenantCode: string }> {
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
    const refreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken, tenantCode: activeTenant.code };
  }

  /** Issue a new refresh token for the given user, invalidating any prior tokens. */
  private async issueRefreshToken(userId: string): Promise<string> {
    // Revoke previous tokens for this user
    this.store.refreshTokens
      .filter((rt) => rt.userId === userId && !rt.revoked)
      .forEach((rt) => { rt.revoked = true; });

    const rawToken = randomBytes(48).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    this.store.refreshTokens.push({
      id: newId(),
      userId,
      tokenHash,
      expiresAt,
      revoked: false,
      createdAt: nowIso(),
    });

    return rawToken;
  }

  /**
   * Exchange a valid refresh token for a new access token + refresh token pair.
   * Implements refresh token rotation: the presented token is revoked immediately.
   */
  async exchangeRefreshToken(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
    const record = this.store.refreshTokens.find(
      (rt) => rt.tokenHash === tokenHash && !rt.revoked,
    );

    if (!record) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    if (new Date(record.expiresAt) < new Date()) {
      record.revoked = true;
      throw new UnauthorizedException("Refresh token has expired");
    }

    // Rotate: revoke the used token
    record.revoked = true;

    const user = this.store.users.find((u) => u.id === record.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User account not found or inactive");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    const newRefreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken: newRefreshToken };
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

  /**
   * OAuth login/registration.
   * Exchanges provider + authorization code for an access token.
   * On first OAuth login, creates user + default tenant membership.
   */
  async oauthLogin(dto: OAuthLoginDto): Promise<{ accessToken: string; tenantCode: string; isNewUser: boolean }> {
    const provider = dto.provider.toLowerCase().trim();
    const supportedProviders = ["google", "wechat", "line"];
    if (!supportedProviders.includes(provider)) {
      throw new BadRequestException(`Unsupported OAuth provider: ${provider}. Supported: ${supportedProviders.join(", ")}`);
    }

    const oauthProfile = await this.exchangeOAuthCode(provider, dto.code, dto.redirectUri);

    let user = this.store.users.find(
      (item) => item.oauthProvider === provider && item.oauthProviderId === oauthProfile.id,
    );
    let isNewUser = false;

    if (!user) {
      // Check if email already exists (link OAuth to existing email-based account)
      if (oauthProfile.email) {
        const normalizedEmail = oauthProfile.email.toLowerCase().trim();
        user = this.store.users.find((item) => item.email === normalizedEmail);
        if (user) {
          // Link OAuth provider to existing account
          user.oauthProvider = provider;
          user.oauthProviderId = oauthProfile.id;
        }
      }

      if (!user) {
        // Create new user
        isNewUser = true;
        user = {
          id: newId(),
          email: oauthProfile.email ?? `${provider}_${oauthProfile.id}@oauth.local`,
          passwordHash: "",
          displayName: oauthProfile.name ?? `${provider} User`,
          isActive: true,
          oauthProvider: provider,
          oauthProviderId: oauthProfile.id,
          createdAt: nowIso(),
        };
        this.store.users.push(user);
      }
    }

    // Resolve tenant
    const tenantCode = dto.tenantCode?.trim() || this.defaultTenantCode;
    let tenant = this.store.tenants.find((item) => item.code === tenantCode);
    if (!tenant) {
      tenant = {
        id: newId(),
        code: tenantCode,
        name: tenantCode,
        createdAt: nowIso(),
      };
      this.store.tenants.push(tenant);
    }

    // Ensure membership
    const membership = this.store.memberships.find(
      (item) => item.tenantId === tenant!.id && item.userId === user!.id,
    );
    if (!membership) {
      const tenantUsers = this.store.memberships.filter((item) => item.tenantId === tenant!.id);
      const role = tenantUsers.length === 0 ? "tenant_admin" : "learner";
      this.store.memberships.push({
        id: newId(),
        tenantId: tenant.id,
        userId: user.id,
        role: role as "learner" | "tenant_admin",
      });
    }

    this.store.ensureSeedQuestions(tenant.id, user.id);
    this.store.ensureSeedVocabularyCards(tenant.id, user.id);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return { accessToken, tenantCode: tenant.code, isNewUser };
  }

  private async exchangeOAuthCode(
    provider: string,
    code: string,
    redirectUri?: string,
  ): Promise<{ id: string; email?: string; name?: string }> {
    switch (provider) {
      case "google":
        return this.exchangeGoogleCode(code, redirectUri);
      case "wechat":
        return this.exchangeWechatCode(code);
      case "line":
        return this.exchangeLineCode(code, redirectUri);
      default:
        throw new BadRequestException(`Unsupported provider: ${provider}`);
    }
  }

  private async exchangeGoogleCode(
    code: string,
    redirectUri?: string,
  ): Promise<{ id: string; email?: string; name?: string }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException("Google OAuth is not configured on this server");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri ?? "",
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      this.logger.warn(`Google token exchange failed: ${tokenRes.status}`);
      throw new UnauthorizedException("Google OAuth token exchange failed");
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new UnauthorizedException("Google OAuth: no access token received");
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      throw new UnauthorizedException("Failed to fetch Google profile");
    }

    const profile = (await profileRes.json()) as { id: string; email?: string; name?: string };
    return { id: profile.id, email: profile.email, name: profile.name };
  }

  private async exchangeWechatCode(code: string): Promise<{ id: string; email?: string; name?: string }> {
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;
    if (!appId || !appSecret) {
      throw new BadRequestException("WeChat OAuth is not configured on this server");
    }

    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}&grant_type=authorization_code`,
    );

    if (!tokenRes.ok) {
      this.logger.warn(`WeChat token exchange failed: ${tokenRes.status}`);
      throw new UnauthorizedException("WeChat OAuth token exchange failed");
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; openid?: string };
    if (!tokenData.access_token || !tokenData.openid) {
      throw new UnauthorizedException("WeChat OAuth: missing token or openid");
    }

    const profileRes = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${encodeURIComponent(tokenData.access_token)}&openid=${encodeURIComponent(tokenData.openid)}`,
    );

    if (!profileRes.ok) {
      throw new UnauthorizedException("Failed to fetch WeChat profile");
    }

    const profile = (await profileRes.json()) as { openid: string; nickname?: string };
    return { id: profile.openid, name: profile.nickname };
  }

  private async exchangeLineCode(
    code: string,
    redirectUri?: string,
  ): Promise<{ id: string; email?: string; name?: string }> {
    const channelId = process.env.LINE_CHANNEL_ID;
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelId || !channelSecret) {
      throw new BadRequestException("LINE OAuth is not configured on this server");
    }

    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri ?? "",
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    if (!tokenRes.ok) {
      this.logger.warn(`LINE token exchange failed: ${tokenRes.status}`);
      throw new UnauthorizedException("LINE OAuth token exchange failed");
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new UnauthorizedException("LINE OAuth: no access token received");
    }

    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      throw new UnauthorizedException("Failed to fetch LINE profile");
    }

    const profile = (await profileRes.json()) as { userId: string; displayName?: string };
    return { id: profile.userId, name: profile.displayName };
  }
}
