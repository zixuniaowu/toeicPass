import { createHash, randomUUID } from "node:crypto";

export const nowIso = (): string => new Date().toISOString();

export const newId = (): string => randomUUID();

export const hashPayload = (payload: unknown): string =>
  createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
