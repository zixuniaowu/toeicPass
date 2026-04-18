# @toeicpass/conversation-ai — 集成指南 (Integration Guide)

本文档帮助你将 `@toeicpass/conversation-ai` 集成到一个全新的项目中。

---

## 前提条件

- Node.js >= 18 (需要原生 `fetch`)
- TypeScript >= 5.0
- 后端: 任意框架 (NestJS, Express, Fastify, Hono, etc.)
- 前端: React >= 18 (仅使用 `web/` 导出时需要)
- (可选) Google Gemini API Key — 无 Key 也可运行 (规则引擎模式)

---

## Step 1: 安装

### 方式 A: npm 安装 (独立项目)
```bash
npm install @toeicpass/conversation-ai
```

### 方式 B: Monorepo workspace 引用
```json
// package.json
{
  "dependencies": {
    "@toeicpass/conversation-ai": "workspace:*"
  }
}
```

### 方式 C: 直接复制
将 `packages/conversation-ai/` 目录复制到新项目中，在 `tsconfig.json` 中配置路径：
```json
{
  "compilerOptions": {
    "paths": {
      "@toeicpass/conversation-ai": ["./lib/conversation-ai/src"],
      "@toeicpass/conversation-ai/web": ["./lib/conversation-ai/web"]
    }
  }
}
```

---

## Step 2: 初始化 ConversationService (后端)

### 2a: 最简模式 (无 AI Key)
```typescript
import { ConversationService } from "@toeicpass/conversation-ai";

const conversationService = new ConversationService();
// 自动使用内置 8 个场景 + 规则引擎回复
```

### 2b: 启用 Gemini AI
```typescript
import { ConversationService } from "@toeicpass/conversation-ai";

const conversationService = new ConversationService({
  geminiApiKey: process.env.GEMINI_API_KEY,
  model: "gemini-2.0-flash",  // 可选，默认值
});
```

### 2c: 自定义场景
```typescript
import { ConversationService, DEFAULT_SCENARIOS } from "@toeicpass/conversation-ai";
import type { ConversationScenario } from "@toeicpass/conversation-ai";

const customScenarios: ConversationScenario[] = [
  ...DEFAULT_SCENARIOS,
  {
    id: "business-email",
    title: "Business Email",
    titleCn: "商务邮件",
    description: "Practice writing professional emails",
    context: "You are composing an email to a client about project timeline changes.",
    difficulty: 2,
    category: "office",
  },
];

const conversationService = new ConversationService({
  geminiApiKey: process.env.GEMINI_API_KEY,
  scenarios: customScenarios,
});
```

---

## Step 3: 暴露 REST API (后端)

以下示例适用于 Express。NestJS/Fastify/Hono 等可等效转换。

```typescript
import express from "express";

const app = express();
app.use(express.json());

// 获取场景列表
app.get("/api/conversation/scenarios", (req, res) => {
  res.json(conversationService.listScenarios());
});

// 生成 AI 回复
app.post("/api/conversation/reply", async (req, res) => {
  try {
    const { scenarioId, text, history } = req.body;
    const result = await conversationService.generateReply({
      scenarioId,
      text,
      history: history ?? [],
    });
    res.json({
      success: true,
      content: result.content,
      corrections: result.corrections,
      suggestions: result.suggestions,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
```

### NestJS 示例

```typescript
import { Controller, Get, Post, Body } from "@nestjs/common";
import { ConversationService } from "@toeicpass/conversation-ai";

@Controller("api/conversation")
export class ConversationController {
  private readonly svc: ConversationService;

  constructor() {
    this.svc = new ConversationService({
      geminiApiKey: process.env.GEMINI_API_KEY,
    });
  }

  @Get("scenarios")
  listScenarios() {
    return this.svc.listScenarios();
  }

  @Post("reply")
  async reply(@Body() body: { scenarioId: string; text: string; history?: string[] }) {
    const result = await this.svc.generateReply({
      scenarioId: body.scenarioId,
      text: body.text,
      history: body.history ?? [],
    });
    return { success: true, ...result };
  }
}
```

---

## Step 4: 集成前端组件 (React)

### 4a: 创建 API 绑定
```typescript
// lib/conversation-api.ts
import type { ConversationApiFunctions } from "@toeicpass/conversation-ai/web";

export const conversationApi: ConversationApiFunctions = {
  fetchScenarios: async () => {
    const res = await fetch("/api/conversation/scenarios");
    return res.json();
  },
  sendReply: async (payload) => {
    const res = await fetch("/api/conversation/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};
```

### 4b: 使用组件
```tsx
import { ConversationView } from "@toeicpass/conversation-ai/web";
import { conversationApi } from "./lib/conversation-api";

function PracticePage() {
  return (
    <div style={{ height: "100vh" }}>
      <ConversationView locale="zh" api={conversationApi} />
    </div>
  );
}
```

### 4c: 在 Next.js App Router 中使用
```tsx
// app/practice/conversation/page.tsx
"use client";

import { ConversationView } from "@toeicpass/conversation-ai/web";
import { conversationApi } from "@/lib/conversation-api";

export default function ConversationPage() {
  return <ConversationView locale="zh" api={conversationApi} />;
}
```

---

## Step 5: 语音功能说明

`ConversationView` 内置 Web Speech API 支持，**无需额外配置**。

| 功能 | 要求 | 说明 |
|---|---|---|
| 语音识别 (STT) | Chrome / Edge / Safari | 按住麦克风按钮说话 |
| 语音合成 (TTS) | 所有现代浏览器 | AI 回复自动朗读 |

**不支持语音的降级方案：** 组件会自动隐藏麦克风按钮，仅显示文本输入框。

---

## Step 6: 环境变量参考

| 变量 | 必须 | 说明 |
|---|---|---|
| `GEMINI_API_KEY` | 否 | Google Gemini API 密钥。不设置则使用规则引擎 |

### 获取 Gemini API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 创建 API Key (免费额度: 15 RPM / 100万 tokens/月)
3. 设置环境变量: `export GEMINI_API_KEY=your-key-here`

---

## 常见问题 (FAQ)

### Q: 没有 Gemini API Key 能用吗？
A: 可以。构造 `ConversationService()` 时不传 `geminiApiKey`，自动使用规则引擎。规则引擎提供：语法检查 (大写 I、缩写词)、长度提示、标点提示、按场景分类的固定回复。

### Q: 怎么添加新场景？
A: 在配置中传入 `scenarios` 数组。每个场景需要 `id`, `title`, `titleCn`, `description`, `context`, `difficulty` (1-3), `category` (8 种之一)。

### Q: 规则引擎的回复质量如何？
A: 回复是预设的固定句子（每个 category 2-3 条前期 + 1-2 条后期），不如 AI 自然，但语法纠正和建议功能完整。适合演示/测试/离线场景。

### Q: 可以换成 OpenAI / Claude 吗？
A: 当前直接调用 Gemini REST API。替换需要修改 `conversation.service.ts` 中的 `generateAiReply` 方法（约 40 行）。接口保持不变。

### Q: 前端组件可以自定义样式吗？
A: 使用 CSS Modules (`ConversationView.module.css`)，类名带 hash，不会与宿主应用冲突。需要覆盖时可用更高优先级选择器或修改 CSS 文件。

### Q: 只用后端不用前端组件可以吗？
A: 可以。`import from "@toeicpass/conversation-ai"` 即可。React 是 `peerDependency` 且标记为 `optional`。
