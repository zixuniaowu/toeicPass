import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./helpers";

describe("Shadowing content e2e", () => {
  let app: INestApplication;
  const tenantCode = "content-test";
  const email = "content@test.com";
  const password = "toeic123";
  let authHeader: string;

  beforeAll(async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).post("/api/v1/auth/register").send({
      tenantCode,
      tenantName: "Content Test Org",
      email,
      password,
      displayName: "Content Admin",
    });

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password });
    authHeader = `Bearer ${login.body.accessToken}`;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("serves published English materials without auth", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/content/shadowing?language=en");
    expect(res.status).toBe(200);
    expect(res.body.serverTime).toBeDefined();
    expect(res.body.language).toBe("en");
    const materials = res.body.materials as Array<Record<string, unknown>>;
    expect(materials.length).toBeGreaterThan(0);
    for (const material of materials) {
      expect(material.language).toBe("en");
      expect(material.published).toBe(true);
      expect(Array.isArray(material.sentences)).toBe(true);
    }
    const ids = materials.map((material) => material.id);
    expect(ids).toContain("jobs-stanford");
    expect(ids).toContain("yt-jobs-stanford");
  });

  it("serves published Japanese materials without auth", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/content/shadowing?language=ja");
    expect(res.status).toBe(200);
    const materials = res.body.materials as Array<Record<string, unknown>>;
    expect(materials.length).toBeGreaterThan(0);
    for (const material of materials) {
      expect(material.language).toBe("ja");
    }
    const ids = materials.map((material) => material.id);
    expect(ids).toContain("yt-ja-easy-japanese");
  });

  it("supports incremental sync via since", async () => {
    const before = await request(app.getHttpServer()).get("/api/v1/content/shadowing?language=en");
    const serverTime = before.body.serverTime as string;

    const create = await request(app.getHttpServer())
      .post("/api/v1/admin/shadowing-materials")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        id: "e2e-sync-material",
        language: "en",
        title: "Sync Check Material",
        source: "e2e",
        category: "speech",
        difficulty: 1,
        sentences: [{ id: 1, text: "Hello sync world.", translations: { zh: "你好，同步世界。" } }],
        published: true,
      });
    expect(create.status).toBe(201);

    const delta = await request(app.getHttpServer()).get(
      `/api/v1/content/shadowing?language=en&since=${encodeURIComponent(serverTime)}`,
    );
    expect(delta.status).toBe(200);
    const ids = (delta.body.materials as Array<{ id: string }>).map((material) => material.id);
    expect(ids).toEqual(["e2e-sync-material"]);
  });

  it("rejects admin create with a duplicate id", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/shadowing-materials")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        id: "e2e-sync-material",
        language: "en",
        title: "Duplicate",
        sentences: [{ id: 1, text: "dup" }],
      });
    expect(res.status).toBe(409);
  });

  it("updates a material and exposes changes to clients", async () => {
    const update = await request(app.getHttpServer())
      .put("/api/v1/admin/shadowing-materials/e2e-sync-material")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        language: "en",
        title: "Sync Check Material v2",
        source: "e2e",
        category: "speech",
        difficulty: 2,
        sentences: [
          { id: 1, text: "Hello sync world.", translations: { zh: "你好，同步世界。" } },
          { id: 2, text: "One more sentence.", translations: { zh: "再来一句。" } },
        ],
        published: true,
      });
    expect(update.status).toBe(200);
    expect(update.body.title).toBe("Sync Check Material v2");
    expect(update.body.sentences).toHaveLength(2);

    const res = await request(app.getHttpServer()).get("/api/v1/content/shadowing?language=en");
    const material = (res.body.materials as Array<Record<string, unknown>>).find(
      (item) => item.id === "e2e-sync-material",
    );
    expect(material?.title).toBe("Sync Check Material v2");
  });

  it("hides unpublished materials from the public endpoint", async () => {
    const unpublish = await request(app.getHttpServer())
      .post("/api/v1/admin/shadowing-materials/e2e-sync-material/unpublish")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(unpublish.status).toBe(201);
    expect(unpublish.body.published).toBe(false);

    const res = await request(app.getHttpServer()).get("/api/v1/content/shadowing?language=en");
    const ids = (res.body.materials as Array<{ id: string }>).map((material) => material.id);
    expect(ids).not.toContain("e2e-sync-material");

    const adminList = await request(app.getHttpServer())
      .get("/api/v1/admin/shadowing-materials?language=en")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(adminList.status).toBe(200);
    expect((adminList.body as Array<{ id: string }>).map((item) => item.id)).toContain("e2e-sync-material");
  });

  it("deletes a material", async () => {
    const del = await request(app.getHttpServer())
      .delete("/api/v1/admin/shadowing-materials/e2e-sync-material")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    const res = await request(app.getHttpServer()).get("/api/v1/content/shadowing?language=en");
    const ids = (res.body.materials as Array<{ id: string }>).map((material) => material.id);
    expect(ids).not.toContain("e2e-sync-material");
  });

  it("rejects admin material writes without a valid session", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/shadowing-materials")
      .set("x-tenant-code", tenantCode)
      .send({
        id: "no-auth-material",
        language: "en",
        title: "No Auth",
        sentences: [{ id: 1, text: "nope" }],
      });
    expect([401, 403]).toContain(res.status);
  });
});
