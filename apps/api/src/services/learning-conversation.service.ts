import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { ConversationReplyDto } from "../dto";
import { ConversationService } from "@toeicpass/conversation-ai";

@Injectable()
export class LearningConversationService {
  private readonly logger = new Logger(LearningConversationService.name);
  private readonly engine: ConversationService;

  constructor() {
    this.engine = new ConversationService({
      geminiApiKey: process.env.GEMINI_API_KEY,
    });
  }

  listConversationScenarios() {
    return this.engine.listScenarios();
  }

  async generateConversationReply(
    dto: ConversationReplyDto,
  ): Promise<{ content: string; corrections: string[]; suggestions: string[] }> {
    try {
      return await this.engine.generateReply({
        scenarioId: dto.scenarioId,
        text: dto.text,
        history: dto.history,
      });
    } catch (err) {
      if ((err as Error).message?.includes("not found")) {
        throw new NotFoundException("Conversation scenario not found");
      }
      this.logger.warn(`Conversation reply error: ${(err as Error).message}`);
      throw err;
    }
  }
}
