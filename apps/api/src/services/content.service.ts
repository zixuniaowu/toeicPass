import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UpsertShadowingMaterialDto } from "../dto";
import { RequestContext } from "../context";
import { FuriganaSegment, ShadowingMaterialRecord, ShadowingTranslations } from "../types";
import { StoreService } from "../store.service";
import { nowIso } from "../utils";
import { JapaneseReadingService } from "./japanese-reading.service";

export interface ShadowingContentResponse {
  serverTime: string;
  language: "en" | "ja";
  materials: ShadowingMaterialRecord[];
}

const MATERIAL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

function normalizeTranslations(input?: Record<string, string>): ShadowingTranslations {
  const translations: ShadowingTranslations = {};
  if (input) {
    for (const key of ["zh", "ja", "en"] as const) {
      const value = String(input[key] ?? "").trim();
      if (value.length > 0) {
        translations[key] = value;
      }
    }
  }
  return translations;
}

@Injectable()
export class ContentService {
  private readonly annotationCache = new Map<string, FuriganaSegment[][]>();

  constructor(
    private readonly store: StoreService,
    private readonly japaneseReadingService: JapaneseReadingService,
  ) {}

  /**
   * Public endpoint for mobile/web clients. `since` is a previous
   * `serverTime` (or any ISO timestamp): only materials updated after it are
   * returned, so clients can do incremental sync.
   */
  async listPublishedMaterials(language: "en" | "ja", since?: string): Promise<ShadowingContentResponse> {
    const serverTime = nowIso();
    const sinceMs = since ? this.parseSince(since) : null;
    const materials = this.store.shadowingMaterials
      .filter((material) => material.language === language && material.published)
      .filter((material) => (sinceMs === null ? true : Date.parse(material.updatedAt) > sinceMs))
      .sort((a, b) => a.id.localeCompare(b.id));

    const withAnnotations = await Promise.all(
      materials.map((material) => this.attachAnnotations(material)),
    );
    return { serverTime, language, materials: withAnnotations };
  }

  /**
   * Japanese sentences get furigana segments computed with kuromoji so mobile
   * clients can display readings without bundling a tokenizer. Results are
   * cached per material version.
   */
  private async attachAnnotations(material: ShadowingMaterialRecord): Promise<ShadowingMaterialRecord> {
    if (material.language !== "ja") {
      return material;
    }
    const cacheKey = `${material.id}:${material.updatedAt}`;
    let cached = this.annotationCache.get(cacheKey);
    if (!cached) {
      cached = await Promise.all(
        material.sentences.map((sentence) => this.japaneseReadingService.annotateSentence(sentence.text)),
      );
      this.annotationCache.set(cacheKey, cached);
    }
    return {
      ...material,
      sentences: material.sentences.map((sentence, index) => ({
        ...sentence,
        annotations: cached[index] ?? [],
      })),
    };
  }

  listAllMaterials(language?: "en" | "ja"): ShadowingMaterialRecord[] {
    return this.store.shadowingMaterials
      .filter((material) => (language ? material.language === language : true))
      .sort((a, b) => a.language.localeCompare(b.language) || a.id.localeCompare(b.id));
  }

  createMaterial(ctx: RequestContext, dto: UpsertShadowingMaterialDto): ShadowingMaterialRecord {
    const id = dto.id?.trim();
    if (!id) {
      throw new BadRequestException("Material id is required when creating");
    }
    if (!MATERIAL_ID_PATTERN.test(id)) {
      throw new BadRequestException("Material id must be kebab-case (letters, digits, dashes)");
    }
    if (this.store.shadowingMaterials.some((material) => material.id === id)) {
      throw new ConflictException(`Shadowing material already exists: ${id}`);
    }
    const now = nowIso();
    const material: ShadowingMaterialRecord = {
      id,
      language: dto.language,
      title: dto.title,
      translations: normalizeTranslations(dto.translations),
      source: dto.source?.trim() || "",
      category: dto.category?.trim() || "speech",
      difficulty: dto.difficulty ?? 2,
      ...(dto.youtubeVideoId?.trim() ? { youtubeVideoId: dto.youtubeVideoId.trim() } : {}),
      sentences: dto.sentences.map((sentence) => ({
        id: sentence.id,
        text: sentence.text,
        translations: normalizeTranslations(sentence.translations),
        ...(typeof sentence.startSec === "number" ? { startSec: sentence.startSec } : {}),
        ...(typeof sentence.endSec === "number" ? { endSec: sentence.endSec } : {}),
      })),
      published: dto.published ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.store.shadowingMaterials.push(material);
    void this.store.persistSnapshot();
    return material;
  }

  updateMaterial(_ctx: RequestContext, materialId: string, dto: UpsertShadowingMaterialDto): ShadowingMaterialRecord {
    const material = this.store.shadowingMaterials.find((item) => item.id === materialId);
    if (!material) {
      throw new NotFoundException(`Shadowing material not found: ${materialId}`);
    }
    material.language = dto.language;
    material.title = dto.title;
    material.translations = normalizeTranslations(dto.translations);
    material.source = dto.source?.trim() || "";
    material.category = dto.category?.trim() || material.category;
    material.difficulty = dto.difficulty ?? material.difficulty;
    if (dto.youtubeVideoId !== undefined) {
      if (dto.youtubeVideoId.trim().length > 0) {
        material.youtubeVideoId = dto.youtubeVideoId.trim();
      } else {
        delete material.youtubeVideoId;
      }
    }
    material.sentences = dto.sentences.map((sentence) => ({
      id: sentence.id,
      text: sentence.text,
      translations: normalizeTranslations(sentence.translations),
      ...(typeof sentence.startSec === "number" ? { startSec: sentence.startSec } : {}),
      ...(typeof sentence.endSec === "number" ? { endSec: sentence.endSec } : {}),
    }));
    material.updatedAt = nowIso();
    void this.store.persistSnapshot();
    return material;
  }

  setPublished(materialId: string, published: boolean): ShadowingMaterialRecord {
    const material = this.store.shadowingMaterials.find((item) => item.id === materialId);
    if (!material) {
      throw new NotFoundException(`Shadowing material not found: ${materialId}`);
    }
    material.published = published;
    material.updatedAt = nowIso();
    void this.store.persistSnapshot();
    return material;
  }

  deleteMaterial(materialId: string): { materialId: string; deleted: boolean } {
    const index = this.store.shadowingMaterials.findIndex((item) => item.id === materialId);
    if (index < 0) {
      throw new NotFoundException(`Shadowing material not found: ${materialId}`);
    }
    this.store.shadowingMaterials.splice(index, 1);
    void this.store.persistSnapshot();
    return { materialId, deleted: true };
  }

  private parseSince(since: string): number {
    const parsed = Date.parse(since);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException("since must be an ISO-8601 timestamp");
    }
    return parsed;
  }
}
