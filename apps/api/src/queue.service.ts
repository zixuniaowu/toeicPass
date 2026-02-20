import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly redisUrl = process.env.REDIS_URL;
  private readonly localJobs: Array<{ name: string; payload: unknown }> = [];
  private redis?: IORedis;
  private queue?: Queue;

  constructor() {
    if (this.redisUrl) {
      this.redis = new IORedis(this.redisUrl, {
        maxRetriesPerRequest: null,
      });
      this.queue = new Queue("toeic-jobs", { connection: this.redis });
    }
  }

  async enqueue(name: string, payload: unknown): Promise<void> {
    if (this.queue) {
      await this.queue.add(name, payload, {
        removeOnComplete: 200,
        removeOnFail: 1000,
      });
      return;
    }

    this.localJobs.push({ name, payload });
  }

  getLocalJobs(): Array<{ name: string; payload: unknown }> {
    return this.localJobs;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    await this.redis?.quit();
  }
}
