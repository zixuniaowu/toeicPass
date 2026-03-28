import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AppService } from "./app.service";
import { hashPayload } from "./utils";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly appService: AppService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      body?: unknown;
      user?: { sub?: string };
      tenantId?: string;
    }>();

    const method = req.method.toUpperCase();
    const shouldAudit = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    if (!shouldAudit) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.appService.addAuditLog({
          tenantId: req.tenantId,
          actorUserId: req.user?.sub,
          action: `${method} ${req.path}`,
          entityType: "http",
          payloadHash: hashPayload(req.body ?? {}),
        });
        this.appService.persistStore();
      }),
    );
  }
}
