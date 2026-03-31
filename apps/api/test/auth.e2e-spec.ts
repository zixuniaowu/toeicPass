import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./helpers";

describe("Auth e2e", () => {
  let app: INestApplication;
  const tenantCode = "auth-test";
  const email = "auth@test.com";
  const password = "toeic123";

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a new user", async () => {
    const register = await request(app.getHttpServer()).post("/api/v1/auth/register").send({
      tenantCode,
      tenantName: "Auth Test Org",
      email,
      password,
      displayName: "Auth User",
    });
    expect(register.status).toBe(201);
    expect(register.body.userId).toBeDefined();
  });

  it("logs in and receives JWT", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(login.status).toBe(201);
    expect(login.body.accessToken).toBeDefined();
    expect(login.body.tenantCode).toBe(tenantCode);
  });

  it("retrieves user profile with token", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password });
    const authHeader = `Bearer ${login.body.accessToken}`;

    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(me.status).toBe(200);
    expect(me.body.roles).toContain("tenant_admin");
  });

  it("rejects login with wrong password", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "wrong" });
    expect(login.status).toBe(401);
  });
});
