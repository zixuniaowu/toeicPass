import { Body, Controller, Get, Header, HttpCode, Post, Query } from "@nestjs/common";
import { JapaneseReadingService } from "../services/japanese-reading.service";
import { ContentService } from "../services/content.service";

/**
 * Public content distribution endpoints. No auth: mobile app flavors fetch
 * their shadowing materials here on startup without requiring an account.
 */
@Controller("content")
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly japaneseReadingService: JapaneseReadingService,
  ) {}

  /**
   * Convert recognized Japanese text (kanji/kana mix) into a hiragana reading so
   * the mobile app can score it at mora level. Digits are spelled out client-side.
   */
  @Post("ja/reading")
  @HttpCode(200)
  async japaneseReading(@Body() body: { text?: string }) {
    const text = String(body?.text ?? "").trim().slice(0, 400);
    const segments = await this.japaneseReadingService.annotateSentence(text);
    return { readingText: segments.map((s) => s.reading).join(""), segments };
  }

  @Get("shadowing")
  @Header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  listShadowingMaterials(
    @Query("language") language?: string,
    @Query("since") since?: string,
  ) {
    const lang = language === "ja" ? "ja" : "en";
    return this.contentService.listPublishedMaterials(lang, since);
  }
}
