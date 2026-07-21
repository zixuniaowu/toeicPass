import { Controller, Get } from "@nestjs/common";

@Controller()
export class SystemController {
  @Get("health")
  getHealth(): { ok: true; service: string; time: string } {
    return {
      ok: true,
      service: "toeicpass-api",
      time: new Date().toISOString(),
    };
  }
}
