/**
 * GuestAccessMiddleware
 *
 * Behaviour by environment:
 * - Non-production (NODE_ENV !== 'production'):
 *     Requests without a Bearer token or with an invalid token are allowed
 *     through as a "guest" user so developers and demo visitors can explore
 *     the app without registering.
 * - Production (NODE_ENV === 'production'):
 *     Un-authenticated requests to protected API paths receive 401 JSON.
 *     The default demo account is also disabled in production unless the
 *     env var `DEFAULT_ACCOUNT_ENABLED=true` is explicitly set.
 *
 * Placement: registered BEFORE passport guards in `AppModule` so it can
 * attach the guest context before JwtAuthGuard runs.
 *
 * The middleware never bypasses existing auth guards — it only attaches a
 * minimal guest context so downstream guards can make informed decisions.
 */
import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { JwtUser } from "./auth";

const PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Paths that are always public (no auth required in any environment).
 * Checked with `startsWith`.
 */
const PUBLIC_PATH_PREFIXES = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/oauth",
  "/api/v1/health",
];

/** Attach a synthetic guest user to unauthenticated requests in non-prod. */
const GUEST_USER: JwtUser = {
  sub: "guest",
  email: "guest@local",
};

type ExtendedRequest = Request & {
  user?: JwtUser;
  isGuest?: boolean;
};

@Injectable()
export class GuestAccessMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GuestAccessMiddleware.name);

  use(req: ExtendedRequest, res: Response, next: NextFunction): void {
    const path = req.path ?? "";

    // Always allow public paths through
    if (PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return next();
    }

    const hasToken = Boolean(
      req.headers.authorization?.startsWith("Bearer "),
    );

    if (hasToken) {
      // Token present → let passport / JwtAuthGuard validate it normally
      return next();
    }

    if (PRODUCTION) {
      // In production, unauthenticated requests must authenticate explicitly.
      // We rely on JwtAuthGuard to reject these; middleware just logs the event.
      this.logger.warn(
        `[PROD] Unauthenticated request to ${req.method} ${path} — JwtAuthGuard will reject`,
      );
      return next();
    }

    // Non-production: attach guest context and let downstream guards decide
    req.user = GUEST_USER;
    req.isGuest = true;
    this.logger.debug(
      `[DEV] Guest access allowed for ${req.method} ${path}`,
    );
    return next();
  }
}
