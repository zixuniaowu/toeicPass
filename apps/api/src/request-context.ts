import { UnauthorizedException } from "@nestjs/common";
import { JwtUser } from "./auth";
import { RequestContext } from "./context";

export type ReqShape = {
  user?: JwtUser;
  tenantId?: string;
  tenantCode?: string;
  roles?: RequestContext["roles"];
};

export const toCtx = (req: ReqShape): RequestContext => {
  if (!req.user?.sub || !req.tenantId || !req.tenantCode || !req.roles) {
    throw new UnauthorizedException("Missing request context");
  }
  return {
    userId: req.user.sub,
    tenantId: req.tenantId,
    tenantCode: req.tenantCode,
    roles: req.roles,
  };
};
