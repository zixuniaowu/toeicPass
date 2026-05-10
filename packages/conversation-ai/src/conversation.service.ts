import type {
  ConversationScenario,
  ConversationReplyInput,
  ConversationReplyResult,
  ConversationServiceConfig,
  ConversationTargetLanguage,
} from "./types";
import { DEFAULT_SCENARIOS } from "./scenarios";

/**
 * Core conversation AI service.
 *
 * Usage:
 * ```ts
 * const svc = new ConversationService({ geminiApiKey: process.env.GEMINI_API_KEY });
 * const scenarios = svc.listScenarios();
 * const reply = await svc.generateReply({ scenarioId: "office-meeting", text: "Hello" });
 * ```
 */
export class ConversationService {
  private readonly geminiKey?: string;
  private readonly scenarios: ConversationScenario[];
  private readonly model: string;

  constructor(config?: ConversationServiceConfig) {
    this.geminiKey = config?.geminiApiKey;
    this.scenarios = config?.scenarios ?? DEFAULT_SCENARIOS;
    this.model = config?.model ?? "gemini-2.0-flash";
  }

  /** Return all available conversation scenarios. */
  listScenarios(): ConversationScenario[] {
    return this.scenarios;
  }

  /**
   * Generate a conversation reply using Gemini AI (if available) or rule-based fallback.
   * @param dto - The user's input including scenario, text, and conversation history.
   * @throws Error if the scenario ID is not found.
   */
  async generateReply(dto: ConversationReplyInput): Promise<ConversationReplyResult> {
    const scenario = this.scenarios.find((s) => s.id === dto.scenarioId);
    if (!scenario) {
      throw new Error(`Conversation scenario not found: ${dto.scenarioId}`);
    }
    const text = dto.text.trim();
    const historyLength = dto.history?.length ?? 0;

    if (this.geminiKey) {
      try {
        return await this.generateAiReply(scenario, text, dto.history ?? []);
      } catch {
        // Fall through to rule-based
      }
    }

    // Rule-based fallback
    const corrections: string[] = [];
    const suggestions: string[] = [];
    if (scenario.targetLanguage === "ja") {
      if (/[A-Za-z]/.test(text) && !/[ぁ-んァ-ン一-龯]/.test(text)) {
        corrections.push("できるだけ日本語で答えてみましょう。ひらがな・カタカナ・漢字のどれでも大丈夫です。");
      }
      if (text.length < 12) {
        suggestions.push("もう一文足して、理由や状況を補足すると自然な日本語になります。");
      }
      if (!/[。！？]$/.test(text) && !/(です|ます|でした|ました)$/.test(text)) {
        suggestions.push("文末を「です・ます」調にすると、より丁寧な会話になります。");
      }
    } else {
      if (/\bi\s/.test(text) && !/\bI\b/.test(text)) {
        corrections.push("Remember to capitalize 'I' in formal English.");
      }
      if (/\b(dont|cant|wont|isnt|arent)\b/i.test(text)) {
        corrections.push("Use full forms (do not/cannot) for TOEIC-style formal responses.");
      }
      if (text.split(/\s+/).filter(Boolean).length < 6) {
        suggestions.push("Try adding one supporting sentence to make your response clearer.");
      }
      if (!/[.!?]$/.test(text)) {
        suggestions.push("Add punctuation at the end to improve readability.");
      }
    }

    const content = this.conversationResponseByCategory(
      scenario.category,
      historyLength,
      scenario.targetLanguage,
    );
    return { content, corrections, suggestions };
  }

  private async generateAiReply(
    scenario: ConversationScenario,
    userText: string,
    history: string[],
  ): Promise<ConversationReplyResult> {
    const systemPrompt = this.buildSystemPrompt(scenario);

    const messages: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (let i = 0; i < history.length; i++) {
      messages.push({
        role: i % 2 === 0 ? "user" : "model",
        parts: [{ text: history[i] }],
      });
    }

    messages.push({ role: "user", parts: [{ text: userText }] });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.geminiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      throw new Error("No content in Gemini response");
    }

    const parsed = JSON.parse(raw) as {
      content?: string;
      corrections?: string[];
      suggestions?: string[];
    };

    return {
      content: parsed.content ?? (scenario.targetLanguage === "ja"
        ? "もう少し詳しく教えてください。"
        : "Could you tell me more about that?"),
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  }

  private buildSystemPrompt(scenario: ConversationScenario): string {
    if (scenario.targetLanguage === "ja") {
      return [
        `You are a Japanese conversation practice partner for JLPT-style speaking practice.`,
        `Scenario: "${scenario.title}" - ${scenario.context}`,
        `Difficulty level: ${scenario.difficulty}/3.`,
        ``,
        `Your task:`,
        `1. Reply naturally in Japanese as the conversation partner (1-3 sentences, appropriate to the scenario).`,
        `2. Check the learner's Japanese for grammar, particles, vocabulary, and politeness issues.`,
        `3. Provide helpful suggestions to improve their Japanese response.`,
        ``,
        `Respond ONLY with valid JSON (no markdown, no code fences):`,
        `{"content":"<your reply>","corrections":["<error1>",...],"suggestions":["<tip1>",...]}`,
      ].join("\n");
    }

    return [
      `You are an English conversation practice partner for TOEIC test preparation.`,
      `Scenario: "${scenario.title}" - ${scenario.context}`,
      `Difficulty level: ${scenario.difficulty}/3.`,
      ``,
      `Your task:`,
      `1. Reply naturally in English as the conversation partner (1-3 sentences, appropriate to the scenario).`,
      `2. Check the learner's English for grammar, vocabulary, and formality errors.`,
      `3. Provide helpful suggestions to improve their response.`,
      ``,
      `Respond ONLY with valid JSON (no markdown, no code fences):`,
      `{"content":"<your reply>","corrections":["<error1>",...],"suggestions":["<tip1>",...]}`,
    ].join("\n");
  }

  private conversationResponseByCategory(
    category: ConversationScenario["category"],
    historyLength: number,
    targetLanguage: ConversationTargetLanguage,
  ): string {
    const earlyTurn = historyLength < 4;
    const bank: Record<ConversationScenario["category"], string[]> = targetLanguage === "ja"
      ? {
          office: earlyTurn
            ? [
                "承知しました。では、会議は何時から始めますか。",
                "ありがとうございます。確認したい点を二つ教えてください。",
              ]
            : [
                "いい流れです。次は理由を一つ添えると、より自然な日本語になります。",
                "具体的な情報を一つ足すと、さらに伝わりやすくなります。",
              ],
          restaurant: earlyTurn
            ? [
                "かしこまりました。お飲み物は何になさいますか。",
                "はい、本日のおすすめもございます。",
              ]
            : ["丁寧な表現を使うと、さらに自然な会話になります。"],
          airport: earlyTurn
            ? [
                "承知しました。お荷物をこちらに置いてください。",
                "窓側と通路側のどちらをご希望ですか。",
              ]
            : ["次は搭乗時間について一つ質問してみましょう。"],
          hotel: earlyTurn
            ? [
                "かしこまりました。ご予約のお名前をお願いいたします。",
                "はい、チェックインは午後三時からです。",
              ]
            : ["丁寧な依頼表現を入れると、もっと自然です。"],
          shopping: earlyTurn
            ? [
                "はい、どの商品をお探しですか。",
                "こちらの棚にございます。ほかに必要なものはありますか。",
              ]
            : ["数量や希望をもう少し具体的に伝えると自然です。"],
          meeting: earlyTurn
            ? [
                "ありがとうございます。まず最初の目標を確認しましょう。",
                "承知しました。納期についてもう少し詳しく教えてください。",
              ]
            : ["次は具体的な数字を入れると、伝わりやすくなります。"],
          phone: earlyTurn
            ? [
                "はい、お電話ありがとうございます。ご用件をお願いします。",
                "少々お待ちください。担当者におつなぎします。",
              ]
            : ["短く丁寧に依頼すると、より自然な電話表現になります。"],
          interview: earlyTurn
            ? [
                "ありがとうございます。自己紹介を一分ほどでお願いします。",
                "では、これまでの経験を一つ教えてください。",
              ]
            : ["結論のあとに具体例を加えると、面接らしい答えになります。"],
        }
      : {
      office: earlyTurn
            ? [
                "That sounds good. Should we meet in person or join by video call?",
                "Great. Could you share two agenda items you want to prioritize?",
                "Friday works. I will send a calendar invite in a few minutes.",
              ]
            : [
                "Good progress. To improve your TOEIC score, add one concrete detail in your next reply.",
                "Nice response. Try using a transition like 'In addition' for stronger organization.",
              ],
      restaurant: earlyTurn
            ? [
                "Certainly. Would you like still water or sparkling water with your meal?",
                "Great choice. Do you have any dietary restrictions I should note?",
              ]
            : ["Excellent. Please summarize your order in one complete sentence."],
      airport: earlyTurn
            ? [
                "Sure. Do you prefer an aisle seat or a window seat?",
                "Could you place your bag on the scale, please?",
              ]
            : ["Good. Please ask one follow-up question about boarding time."],
      hotel: earlyTurn
            ? [
                "Of course. What dates would you like to book?",
                "We have both standard and business rooms available tonight.",
              ]
            : ["Great. Try adding a polite closing sentence to finish naturally."],
      shopping: earlyTurn
            ? [
                "Sure. What size are you looking for?",
                "We have a discount if you buy two items today.",
              ]
            : ["Nice. Try explaining your reason more clearly in the next response."],
      meeting: earlyTurn
            ? [
                "Thanks for the overview. Could you clarify the expected delivery date?",
                "That proposal sounds solid. What KPI will we track first?",
              ]
            : ["Good business tone. Add one number to make your point more precise."],
      phone: earlyTurn
            ? [
                "Certainly. Could you spell your name, please?",
                "I can transfer you now. Please hold for a moment.",
              ]
            : ["Good. In TOEIC, concise and polite requests usually score better."],
      interview: earlyTurn
            ? [
                "Thank you. Could you describe one project where you solved a difficult problem?",
                "Good answer. What strength would your previous manager mention?",
              ]
            : ["Strong effort. Add specific results (percent, time, revenue) in your next answer."],
        };
    const choices = bank[category];
    return choices[Math.floor(Math.random() * choices.length)];
  }
}
