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
  const rules: Array<{ token: string; pattern: RegExp }> = [
    { token: "bicycles", pattern: /(bicycle|bike|fence|parked)/ },
    { token: "truck", pattern: /(truck|box|loading|unloading|delivery)/ },
    { token: "filing", pattern: /(filing|cabinet|drawer|office)/ },
    { token: "restaurant", pattern: /(restaurant|dining|table|chair|seated|meal)/ },
    { token: "construction", pattern: /(construction|worker|hard hat|helmet|building|rebar|steel)/ },
    { token: "library", pattern: /(library|book|bookshelf|shelf|reading)/ },
    { token: "warehouse", pattern: /(warehouse|shelf|storage|aisle|inventory|boxes)/ },
    { token: "garden", pattern: /(garden|flower|path|bush|hedge|bloom)/ },
    { token: "meeting", pattern: /(meeting|presentation|sticky note|whiteboard|laptop|colleague)/ },
    { token: "airport", pattern: /(airplane|plane|aircraft|flying|landing|runway|airport|tarmac)/ },
    { token: "kitchen", pattern: /(kitchen|cooking|pot|pan|stove|apron|recipe)/ },
    { token: "parking", pattern: /(parking|car|vehicle|lot|space|parked)/ },
    { token: "classroom", pattern: /(classroom|desk|chalkboard|blackboard|student|chair)/ },
    { token: "supermarket", pattern: /(supermarket|grocery|product|cereal|aisle|shopping)/ },
    { token: "boat", pattern: /(boat|lake|water|mountain|rowing|canoe)/ },
    { token: "park", pattern: /(park|grass|tree|outdoor|walking|lawn)/ },
  ];
  const rule = rules.find((r) => image.includes(r.token));
  if (!rule) {
    return false;
  }
  return rule.pattern.test(corpus);
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
