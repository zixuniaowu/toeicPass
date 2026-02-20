import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AppController, AuthController } from "./app.controller";
import { AppService } from "./app.service";
import { AuditInterceptor } from "./audit.interceptor";
import { JwtStrategy, TenantGuard } from "./auth";
import { QueueService } from "./queue.service";
import { RolesGuard } from "./roles.guard";
import { StoreService } from "./store.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-secret",
      signOptions: { expiresIn: "7d" },
    }),
  ],
  controllers: [AuthController, AppController],
  providers: [
    AppService,
    StoreService,
    QueueService,
    JwtStrategy,
    TenantGuard,
    RolesGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
