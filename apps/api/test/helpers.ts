import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

export async function registerAndLogin(
  app: INestApplication,
  opts: { tenantCode: string; email: string; password: string; displayName?: string },
): Promise<{ accessToken: string; authHeader: string }> {
  await request(app.getHttpServer()).post("/api/v1/auth/register").send({
    tenantCode: opts.tenantCode,
    tenantName: "Test Org",
    email: opts.email,
    password: opts.password,
    displayName: opts.displayName ?? "Tester",
  });

  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email: opts.email, password: opts.password });

  const accessToken = login.body.accessToken;
  return { accessToken, authHeader: `Bearer ${accessToken}` };
}

export function countSentences(text: string): number {
  return (text.match(/[.!?](\s|$)/g) ?? []).length;
}

export function isAlignedPart1Visual(question: {
  stem: string;
  imageUrl?: string;
  options: Array<{ text: string }>;
}): boolean {
  const image = (question.imageUrl ?? "").toLowerCase();
  const corpus = `${question.stem} ${question.options.map((opt) => opt.text).join(" ")}`.toLowerCase();
  if (image.includes("bicycles")) {
    return /(bicycle|bike|fence|parked)/.test(corpus);
  }
  if (image.includes("truck") || image.includes("unloading")) {
    return /(truck|box|loading|unloading|delivery)/.test(corpus);
  }
  if (image.includes("filing") || image.includes("cabinet")) {
    return /(filing|cabinet|drawer|office)/.test(corpus);
  }
  return false;
}

export function isSupportedAction(action: string): boolean {
  const normalized = action.trim();
  const [command] = normalized.split("?");
  const allowed = new Set([
    "practice:start",
    "diagnostic:start",
    "mock:start",
    "mistakes:start",
    "vocab:start",
    "shadowing:start",
  ]);
  return allowed.has(command);
}

export function parseAction(action: string): { command: string; query: URLSearchParams } {
  const normalized = action.trim();
  const [command, rawQuery] = normalized.split("?");
  return {
    command,
    query: new URLSearchParams(rawQuery ?? ""),
  };
}
