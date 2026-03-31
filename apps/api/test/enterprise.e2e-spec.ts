import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, registerAndLogin } from "./helpers";

describe("Enterprise IP e2e", () => {
  let app: INestApplication;
  const tenantCode = "ent-test";
  const email = "admin@ent-test.com";
  const password = "toeic123";
  let authHeader = "";
  let campaignId = "";
  let candidateId = "";
  let secondCandidateId = "";
  let sessionId = "";

  beforeAll(async () => {
    app = await createTestApp();
    const auth = await registerAndLogin(app, { tenantCode, email, password, displayName: "Admin" });
    authHeader = auth.authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates an IP campaign", async () => {
    const campaign = await request(app.getHttpServer())
      .post("/api/v1/ip/campaigns")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ name: "Q3 TOEIC IP", mode: "official", plannedDate: "2026-08-15" });
    expect(campaign.status).toBe(201);
    campaignId = campaign.body.id;
  });

  it("imports candidates with deduplication", async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/candidates/import`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        candidates: [
          { employeeNo: "E1001", fullName: "Alice Chen", email: "alice@example.com" },
          { employeeNo: "E1002", fullName: "Bob Lin", email: "bob@example.com" },
        ],
      });
    expect(first.status).toBe(201);
    expect(first.body.imported).toBe(2);

    const dedupe = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/candidates/import`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        candidates: [
          { employeeNo: "E1001", fullName: "Alice Chen", email: "alice@example.com" },
          { fullName: "Alice Chen" },
          { fullName: "Carol Wu" },
        ],
      });
    expect(dedupe.status).toBe(201);
    expect(dedupe.body.imported).toBe(1);

    const candidates = await request(app.getHttpServer())
      .get(`/api/v1/ip/campaigns/${campaignId}/candidates`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(candidates.status).toBe(200);
    expect(candidates.body.length).toBe(3);
    candidateId = candidates.body[0].id;
    secondCandidateId = candidates.body[1].id;
  });

  it("creates sessions and manages roster", async () => {
    const session = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/sessions`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        sessionCode: "S1",
        startsAt: "2026-08-15T01:00:00.000Z",
        endsAt: "2026-08-15T03:00:00.000Z",
        seatCapacity: 40,
      });
    expect(session.status).toBe(201);
    sessionId = session.body.id;

    const sessionList = await request(app.getHttpServer())
      .get(`/api/v1/ip/campaigns/${campaignId}/sessions`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(sessionList.status).toBe(200);
    expect(sessionList.body[0]).toMatchObject({
      seatCapacity: expect.any(Number),
      rosterSize: expect.any(Number),
      availableSeats: expect.any(Number),
      statusCount: expect.objectContaining({
        invited: expect.any(Number),
        absent: expect.any(Number),
      }),
    });
  });

  it("runs candidate check-in lifecycle", async () => {
    const absent = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/absent`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId: secondCandidateId });
    expect(absent.status).toBe(201);
    expect(absent.body.status).toBe("absent");

    const absentCheckin = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/check-in`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId: secondCandidateId });
    expect(absentCheckin.status).toBe(400);

    const checkin = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/check-in`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId });
    expect(checkin.status).toBe(201);
    expect(checkin.body.status).toBe("checked_in");

    const start = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/start`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId });
    expect(start.status).toBe(201);
    expect(start.body.status).toBe("in_progress");

    const submit = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId });
    expect(submit.status).toBe(201);
    expect(submit.body.status).toBe("submitted");
  });

  it("imports results and generates report", async () => {
    const rejectAbsent = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/results/import`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ rows: [{ candidateId: secondCandidateId, scoreL: 280, scoreR: 300 }] });
    expect(rejectAbsent.status).toBe(400);

    const importResults = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/results/import`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ rows: [{ candidateId, scoreL: 300, scoreR: 320 }] });
    expect(importResults.status).toBe(201);
    expect(importResults.body.imported).toBe(1);

    const report = await request(app.getHttpServer())
      .get(`/api/v1/ip/campaigns/${campaignId}/reports`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(report.status).toBe(200);
    expect(report.body.campaignId).toBe(campaignId);
    expect(report.body.statusBreakdown).toMatchObject({
      invited: expect.any(Number),
      submitted: expect.any(Number),
      absent: expect.any(Number),
    });
    expect(typeof report.body.attendanceRate).toBe("number");
    expect(typeof report.body.submissionRate).toBe("number");
  });
});
