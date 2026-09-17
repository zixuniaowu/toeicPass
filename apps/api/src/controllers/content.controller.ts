import { Controller, Get, Query } from "@nestjs/common";
import { ContentService } from "../services/content.service";

/**
 * Public content distribution endpoints. No auth: mobile app flavors fetch
 * their shadowing materials here on startup without requiring an account.
 */
@Controller("content")
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get("shadowing")
  listShadowingMaterials(
    @Query("language") language?: string,
    @Query("since") since?: string,
  ) {
    const lang = language === "ja" ? "ja" : "en";
    return this.contentService.listPublishedMaterials(lang, since);
  }
}
