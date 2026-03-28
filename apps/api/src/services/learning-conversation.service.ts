import { Injectable, NotFoundException } from "@nestjs/common";
import { ConversationReplyDto } from "../dto";
import { ConversationScenario } from "../types";

const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  {
    id: "office-meeting",
    title: "Office Meeting",
    titleCn: "办公室会议",
    description: "Practice scheduling and discussing meetings with colleagues",
    context: "You are in an office setting. A colleague wants to schedule a meeting about a project.",
    difficulty: 1,
    category: "office",
  },
  {
    id: "restaurant-order",
    title: "Restaurant Order",
    titleCn: "餐厅点餐",
    description: "Practice ordering food and asking about menu items",
    context: "You are at a restaurant during a business lunch and need to order politely.",
    difficulty: 1,
    category: "restaurant",
  },
  {
    id: "airport-checkin",
    title: "Airport Check-in",
    titleCn: "机场值机",
    description: "Practice check-in, baggage, and flight questions",
    context: "You are at an airport check-in counter for a business trip.",
    difficulty: 2,
    category: "airport",
  },
  {
    id: "hotel-reservation",
    title: "Hotel Reservation",
    titleCn: "酒店预订",
    description: "Practice reservation changes and hotel requests",
    context: "You are calling a hotel to book or modify a reservation.",
    difficulty: 2,
    category: "hotel",
  },
  {
    id: "phone-inquiry",
    title: "Phone Inquiry",
    titleCn: "电话咨询",
    description: "Practice business phone inquiry and message leaving",
    context: "You are calling a company to ask for service details.",
    difficulty: 2,
    category: "phone",
  },
  {
    id: "job-interview",
    title: "Job Interview",
    titleCn: "工作面试",
    description: "Practice interview answers with clearer structure",
    context: "You are attending an interview at an international company.",
    difficulty: 3,
    category: "interview",
  },
  {
    id: "product-presentation",
    title: "Product Presentation",
    titleCn: "产品介绍",
    description: "Practice presenting value proposition to clients",
    context: "You are presenting a new product to potential business partners.",
    difficulty: 3,
    category: "meeting",
  },
  {
    id: "complaint-resolution",
    title: "Customer Complaint",
    titleCn: "客户投诉",
    description: "Practice handling complaints with professional tone",
    context: "A customer reports a delayed shipment and expects a solution.",
    difficulty: 3,
    category: "phone",
  },
];

@Injectable()
export class LearningConversationService {
  listConversationScenarios() {
    return CONVERSATION_SCENARIOS;
  }

  generateConversationReply(
    dto: ConversationReplyDto,
  ): { content: string; corrections: string[]; suggestions: string[] } {
    const scenario = CONVERSATION_SCENARIOS.find((item) => item.id === dto.scenarioId);
    if (!scenario) {
      throw new NotFoundException("Conversation scenario not found");
    }
    const text = dto.text.trim();
    const historyLength = dto.history?.length ?? 0;

    const corrections: string[] = [];
    const suggestions: string[] = [];
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

    const content = this.conversationResponseByCategory(scenario.category, historyLength);
    return { content, corrections, suggestions };
  }

  private conversationResponseByCategory(category: ConversationScenario["category"], historyLength: number): string {
    const earlyTurn = historyLength < 4;
    const bank: Record<ConversationScenario["category"], string[]> = {
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
