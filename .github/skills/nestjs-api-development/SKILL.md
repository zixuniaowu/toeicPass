---
name: nestjs-api-development
description: 'NestJS API development patterns for this monorepo. Use when: creating new API endpoints, adding controllers, services, guards, interceptors, modules, DTOs, or working with NestJS dependency injection, request context, multi-tenancy, RBAC, or database operations.'
---

# NestJS API Development

## Architecture

This project uses NestJS with a domain-driven service layer:

- **Controllers** — HTTP entry points at `apps/api/src/controllers/`
- **Services** — Business logic at `apps/api/src/services/`
- **Guards** — Auth + RBAC: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`
- **Interceptors** — `AuditInterceptor` logs all write operations
- **Store** — Data layer via `StoreService` (in-memory + PGLite for tests, PostgreSQL for prod)

## Request Context

Every authenticated endpoint receives `req.context` via TenantGuard:

```typescript
interface RequestContext {
  tenantId: string;
  userId: string;
  role: 'learner' | 'coach' | 'tenant_admin' | 'super_admin';
}
```

All domain service methods require `context: RequestContext` as first parameter.

## Creating a New Endpoint

1. Add DTO class with `class-validator` decorators in `dto.ts`
2. Add controller method with proper decorators: `@Post()`, `@UseGuards()`, `@Roles()`
3. Add service method accepting `(ctx: RequestContext, ...params)`
4. Add store method for data persistence
5. Add E2E test in `test/<feature>.e2e-spec.ts`

## Controller Pattern

```typescript
@Controller('features')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class FeatureController {
  constructor(private readonly appService: AppService) {}

  @Post()
  @Roles('learner', 'coach')
  async create(@Req() req: Request & { context: RequestContext }, @Body() dto: CreateDto) {
    return this.appService.createFeature(req.context, dto);
  }
}
```

## E2E Test Pattern

```typescript
describe('Feature', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    // Login to get token
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@demo.com', password: 'pass1234', tenantCode: 'demo' });
    token = res.body.token;
  });

  it('should create feature', () => {
    return request(app.getHttpServer())
      .post('/api/v1/feature')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-code', 'demo')
      .send({ name: 'test' })
      .expect(201);
  });

  afterAll(() => app.close());
});
```

## Key Conventions
- Use `ValidationPipe` with `whitelist: true` globally
- Use `HttpException` subclasses for client errors (400, 403, 404)
- All database queries filter by `tenant_id` (enforced in StoreService)
- Critical endpoints support idempotency keys
- JWT expiration: 7 days
