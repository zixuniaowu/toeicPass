import { Role } from "./types";

export interface RequestContext {
  userId: string;
  tenantId: string;
  tenantCode: string;
  roles: Role[];
}
