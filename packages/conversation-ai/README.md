# @toeicpass/conversation-ai

Reusable AI conversation module with voice-first chat — backend + frontend.

## Installation

```bash
npm install @toeicpass/conversation-ai
```

Or as a workspace reference in monorepo `package.json`:
```json
{ "dependencies": { "@toeicpass/conversation-ai": "workspace:*" } }
```

## Backend Usage

```typescript
import { ConversationService, DEFAULT_SCENARIOS } from "@toeicpass/conversation-ai";
import type { ConversationServiceConfig } from "@toeicpass/conversation-ai";

const config: ConversationServiceConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY,  // optional — falls back to rule-based
  modelName: "gemini-2.0-flash",             // optional, default shown
  scenarios: DEFAULT_SCENARIOS,              // optional, use built-in 8 scenarios
};

const service = new ConversationService(config);

// List available conversation topics
const scenarios = service.listScenarios();

// Generate a reply to user input
const result = await service.generateReply({
  scenarioId: "office-meeting",
  text: "I think we should meet on Friday.",
  history: ["Hello, when can we schedule the meeting?"],
});

console.log(result.content);      // AI response
console.log(result.corrections);  // Grammar corrections
console.log(result.suggestions);  // Improvement tips
```

## Frontend Usage

```tsx
import { ConversationView } from "@toeicpass/conversation-ai/web";
import type { ConversationApiFunctions } from "@toeicpass/conversation-ai/web";

// Bind your API functions
const conversationApi: ConversationApiFunctions = {
  fetchScenarios: () => fetch("/api/conversation/scenarios").then(r => r.json()),
  sendReply: (payload) => fetch("/api/conversation/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(r => r.json()),
};

// Use in your app
<ConversationView locale="zh" api={conversationApi} />
```

## Architecture

- **Backend** (`src/`): Pure TypeScript. Google Gemini 2.0 Flash for AI replies, automatic rule-based fallback when no API key.
- **Frontend** (`web/`): React component with CSS Modules, Web Speech API for STT/TTS.
- **No framework dependency** — works with any Node.js backend (Express, Fastify, NestJS, etc.)

### 8 Built-in Scenarios
| ID | Title | Difficulty |
|----|-------|-----------|
| office-meeting | Office Meeting | 1 |
| restaurant-order | Restaurant Order | 1 |
| airport-checkin | Airport Check-in | 2 |
| hotel-reservation | Hotel Reservation | 2 |
| phone-inquiry | Phone Inquiry | 2 |
| job-interview | Job Interview | 3 |
| product-presentation | Product Presentation | 3 |
| complaint-resolution | Customer Complaint | 3 |

### Voice Features
- **Speech-to-Text**: Press-and-hold microphone, speaks English
- **Text-to-Speech**: AI responses are read aloud automatically
- **Bilingual UI**: Chinese (zh) and Japanese (ja) interface
- **Full-screen chat**: Mobile-optimized layout with large fonts
- **Corrections & suggestions**: Real-time feedback on grammar and vocabulary

### AI Configuration
- Default: Google Gemini 2.0 Flash (free tier)
- Falls back to rule-based responses when `GEMINI_API_KEY` is not set
- Customizable model name, scenarios, and prompts via `ConversationServiceConfig`
