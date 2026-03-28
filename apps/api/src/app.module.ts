import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AppService } from "./app.service";
import { AuditInterceptor } from "./audit.interceptor";
import { JwtStrategy, TenantGuard } from "./auth";
import { AdminController } from "./controllers/admin.controller";
import { AuthController } from "./controllers/auth.controller";
import { EnterpriseController } from "./controllers/enterprise.controller";
import { LearningController } from "./controllers/learning.controller";
import { QueueService } from "./queue.service";
import { RolesGuard } from "./roles.guard";
import { AdminQuestionService } from "./services/admin-question.service";
import { AuthDomainService } from "./services/auth-domain.service";
import { EnterpriseIpService } from "./services/enterprise-ip.service";
import { LearningConversationService } from "./services/learning-conversation.service";
import { LearningDomainService } from "./services/learning-domain.service";
import { StoreService } from "./store.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-secret",
      signOptions: { expiresIn: "7d" },
    }),
  ],
  controllers: [AuthController, LearningController, AdminController, EnterpriseController],
  providers: [
    AppService,
    StoreService,
    QueueService,
    AuthDomainService,
    AdminQuestionService,
    EnterpriseIpService,
    LearningConversationService,
    LearningDomainService,
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
