import { useState, useCallback } from "react";
import type { ConversationScenario, ConversationMessage, ConversationSession } from "../types";

// TOEIC-relevant conversation scenarios
const SCENARIOS: ConversationScenario[] = [
  {
    id: "office-meeting",
    title: "Office Meeting",
    titleCn: "办公室会议",
    description: "Practice scheduling and discussing meetings with colleagues",
    context: "You are in an office setting. A colleague wants to schedule a meeting with you about a project.",
    difficulty: 1,
    category: "office",
  },
  {
    id: "restaurant-order",
    title: "Restaurant Order",
    titleCn: "餐厅点餐",
    description: "Practice ordering food and asking about menu items",
    context: "You are at a restaurant for a business lunch. The server is ready to take your order.",
    difficulty: 1,
    category: "restaurant",
  },
  {
    id: "airport-checkin",
    title: "Airport Check-in",
    titleCn: "机场值机",
    description: "Practice checking in for a flight and handling luggage",
    context: "You are at the airport check-in counter for a business trip.",
    difficulty: 2,
    category: "airport",
  },
  {
    id: "hotel-reservation",
    title: "Hotel Reservation",
    titleCn: "酒店预订",
    description: "Practice making and modifying hotel reservations",
    context: "You are calling a hotel to make a reservation for a business trip.",
    difficulty: 2,
    category: "hotel",
  },
  {
    id: "phone-inquiry",
    title: "Phone Inquiry",
    titleCn: "电话咨询",
    description: "Practice making business phone calls and leaving messages",
    context: "You need to call a company to inquire about their services.",
    difficulty: 2,
    category: "phone",
  },
  {
    id: "job-interview",
    title: "Job Interview",
    titleCn: "工作面试",
    description: "Practice common job interview questions and responses",
    context: "You are in a job interview for a position at a multinational company.",
    difficulty: 3,
    category: "interview",
  },
  {
    id: "product-presentation",
    title: "Product Presentation",
    titleCn: "产品介绍",
    description: "Practice presenting a product to potential clients",
    context: "You are presenting your company's new product to potential business partners.",
    difficulty: 3,
    category: "meeting",
  },
  {
    id: "complaint-resolution",
    title: "Customer Complaint",
    titleCn: "客户投诉",
    description: "Practice handling and resolving customer complaints professionally",
    context: "A customer is calling to complain about a delayed shipment.",
    difficulty: 3,
    category: "phone",
  },
];

const newId = () => Math.random().toString(36).slice(2, 11);

export function useConversation() {
  const [scenarios] = useState<ConversationScenario[]>(SCENARIOS);
  const [activeSession, setActiveSession] = useState<ConversationSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState("");

  const startSession = useCallback((scenarioId: string) => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;

    const systemMessage: ConversationMessage = {
      id: newId(),
      role: "system",
      content: scenario.context,
      timestamp: new Date().toISOString(),
    };

    const assistantGreeting: ConversationMessage = {
      id: newId(),
      role: "assistant",
      content: getInitialGreeting(scenario),
      timestamp: new Date().toISOString(),
    };

    setActiveSession({
      scenarioId,
      messages: [systemMessage, assistantGreeting],
      startedAt: new Date().toISOString(),
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!activeSession || !text.trim()) return;

    const userMessage: ConversationMessage = {
      id: newId(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setActiveSession((prev) => {
      if (!prev) return null;
      return { ...prev, messages: [...prev.messages, userMessage] };
    });

    setInputText("");
    setIsLoading(true);

    // Simulate AI response (in production, this would call a real AI API)
    setTimeout(() => {
      const scenario = SCENARIOS.find((s) => s.id === activeSession.scenarioId);
      const response = generateResponse(text, scenario, activeSession.messages.length);

      const assistantMessage: ConversationMessage = {
        id: newId(),
        role: "assistant",
        content: response.content,
        timestamp: new Date().toISOString(),
        corrections: response.corrections,
        suggestions: response.suggestions,
      };

      setActiveSession((prev) => {
        if (!prev) return null;
        return { ...prev, messages: [...prev.messages, assistantMessage] };
      });
      setIsLoading(false);
    }, 800);
  }, [activeSession]);

  const endSession = useCallback(() => {
    setActiveSession(null);
    setInputText("");
  }, []);

  return {
    scenarios,
    activeSession,
    isLoading,
    inputText,
    setInputText,
    startSession,
    sendMessage,
    endSession,
  };
}

function getInitialGreeting(scenario: ConversationScenario): string {
  switch (scenario.category) {
    case "office":
      return "Hi! I was wondering if you have some time this week to discuss the project. When would be a good time for you?";
    case "restaurant":
      return "Good afternoon! Welcome to our restaurant. Here's the menu. Can I get you started with something to drink?";
    case "airport":
      return "Good morning! May I see your passport and ticket, please?";
    case "hotel":
      return "Thank you for calling the Grand Hotel. How may I help you today?";
    case "phone":
      return "Good morning, ABC Corporation. How may I direct your call?";
    case "interview":
      return "Hello, please have a seat. Thank you for coming in today. Why don't you start by telling me a little about yourself?";
    case "meeting":
      return "Thank you for meeting with us today. We're excited to learn more about your company's products.";
    case "shopping":
      return "Hello! Welcome to our store. Is there anything specific you're looking for today?";
    default:
      return "Hello! How can I help you today?";
  }
}

function generateResponse(
  userText: string,
  scenario: ConversationScenario | undefined,
  messageCount: number
): { content: string; corrections?: string[]; suggestions?: string[] } {
  const corrections: string[] = [];
  const suggestions: string[] = [];

  // Simple grammar checks
  if (userText.includes("i ") && !userText.includes("I ")) {
    corrections.push("Remember to capitalize 'I' when referring to yourself.");
  }
  if (userText.match(/\b(dont|cant|wont|isnt|arent)\b/i)) {
    corrections.push("Consider using the full form (do not, cannot, etc.) in formal contexts.");
  }

  // Generate contextual response based on scenario
  const responses = getContextualResponses(scenario?.category || "office", messageCount);
  const content = responses[Math.floor(Math.random() * responses.length)];

  // Add suggestions for improvement
  if (userText.split(" ").length < 5) {
    suggestions.push("Try to use longer, more complete sentences to practice fluency.");
  }

  return { content, corrections: corrections.length > 0 ? corrections : undefined, suggestions: suggestions.length > 0 ? suggestions : undefined };
}

function getContextualResponses(category: string, turn: number): string[] {
  if (turn < 4) {
    switch (category) {
      case "office":
        return [
          "That sounds good. Should we meet in the conference room or would you prefer a video call?",
          "Perfect. I'll send you a calendar invite. Is there anything specific you'd like to discuss?",
          "Great! I think we should review the timeline first. What do you think?",
        ];
      case "restaurant":
        return [
          "Excellent choice! Would you like that with a side salad or fries?",
          "I recommend our special today. It's fresh salmon with seasonal vegetables. Would you like to try it?",
          "Of course! Our chef's special today is grilled chicken with herbs. Can I get you anything else?",
        ];
      case "airport":
        return [
          "Thank you. Would you like a window or aisle seat?",
          "Do you have any bags to check in today?",
          "Your flight is on time. Gate B12 opens in about an hour. Is there anything else I can help you with?",
        ];
      case "hotel":
        return [
          "Certainly. What dates are you looking at for your stay?",
          "We have several room types available. Would you prefer a standard room or a suite?",
          "I can offer you a room with a city view. The rate is $150 per night. Would you like me to make that reservation?",
        ];
      case "phone":
        return [
          "One moment please, I'll transfer you to the right department.",
          "I'm afraid Mr. Johnson is in a meeting right now. Would you like to leave a message?",
          "Could you please spell your name for me? I want to make sure I have it correctly.",
        ];
      case "interview":
        return [
          "That's interesting. Can you tell me about a challenge you faced in your previous role and how you handled it?",
          "What attracted you to this position at our company?",
          "Where do you see yourself in five years?",
        ];
      default:
        return [
          "I understand. Could you tell me more about what you're looking for?",
          "That's a great question. Let me explain that for you.",
          "Sure, I'd be happy to help with that.",
        ];
    }
  } else {
    return [
      "Thank you for practicing with me! You're doing great. Would you like to continue or try a different scenario?",
      "Excellent communication! You've made good progress. Shall we continue or end this session?",
      "Great job! Remember to practice these phrases regularly. Want to keep going?",
    ];
  }
}
