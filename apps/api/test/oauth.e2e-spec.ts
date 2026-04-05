import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./helpers";

describe("OAuth Login E2E", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unsupported OAuth provider", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth/login")
      .send({ provider: "facebook", code: "test-code" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Unsupported");
  });

  it("rejects empty provider", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth/login")
      .send({ provider: "", code: "test-code" });
    expect(res.status).toBe(400);
  });

  it("rejects empty code", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth/login")
      .send({ provider: "google", code: "" });
    expect(res.status).toBe(400);
  });

  it("rejects missing provider field", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth/login")
      .send({ code: "test-code" });
    expect(res.status).toBe(400);
  });

  it("rejects missing code field", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth/login")
      .send({ provider: "google" });
    expect(res.status).toBe(400);
  });

  it("google login returns error when server not configured", async () => {
    // Without GOOGLE_CLIENT_ID/SECRET env vars, should fail gracefully
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth/login")
      .send({ provider: "google", code: "fake-auth-code" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("not configured");
  });

  it("wechat login returns error when server not configured", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth/login")
      .send({ provider: "wechat", code: "fake-auth-code" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("not configured");
  });

  it("line login returns error when server not configured", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth/login")
      .send({ provider: "line", code: "fake-auth-code" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("not configured");
  });
});
