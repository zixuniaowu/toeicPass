# @toeicpass/conversation-ai

> 可复用的 AI 对话练习模块 — TOEIC 英语口语训练、语法纠错、改进建议。像积木一样拿来就用。

**Gemini AI + 规则引擎双模** · **语音识别/合成** · **TypeScript** · **React (可选)**

## 文档一览

| 文档 | 说明 |
|---|---|
| [SPEC.md](./SPEC.md) | 完整规格书 — 全部类型定义、API 参考、AI 流程图、场景目录 |
| [INTEGRATION.md](./INTEGRATION.md) | 分步集成指南 — 从安装到上线 6 步完成 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更记录 |

## 快速开始

### 安装

```bash
npm install @toeicpass/conversation-ai
```

### 后端 (30 秒)

```typescript
import { ConversationService } from "@toeicpass/conversation-ai";

// 无 API Key 也能运行 (规则引擎模式)
const svc = new ConversationService({
  geminiApiKey: process.env.GEMINI_API_KEY, // 可选
});

// 列出场景
const scenarios = svc.listScenarios(); // 内置 8 个 TOEIC 场景

// 生成回复
const reply = await svc.generateReply({
  scenarioId: "office-meeting",
  text: "I think we should meet on Friday.",
  history: ["Hello, when can we schedule the meeting?"],
});

console.log(reply.content);      // "Friday works. I will send a calendar invite."
console.log(reply.corrections);  // ["Remember to capitalize 'I'..."]
console.log(reply.suggestions);  // ["Try adding one supporting sentence..."]
```

### 前端 (30 秒)

```tsx
import { ConversationView } from "@toeicpass/conversation-ai/web";
import type { ConversationApiFunctions } from "@toeicpass/conversation-ai/web";

const api: ConversationApiFunctions = {
  fetchScenarios: () => fetch("/api/conversation/scenarios").then(r => r.json()),
  sendReply: (p) => fetch("/api/conversation/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  }).then(r => r.json()),
};

<ConversationView locale="zh" api={api} />
```

## 架构

```
ConversationService
├─ Gemini API (主通道)     ← 有 Key 时使用
│   temperature=0.7, JSON 模式
│   系统提示: 场景 + 难度 + 输出格式
└─ 规则引擎 (备用通道)     ← 无 Key / API 失败时自动降级
    ├─ 语法检查: 大写I、缩写词、句子长度、标点
    └─ 场景回复: 8 类 category × 前期/后期

            │
            ▼

ConversationView (React)
├─ 场景选择 → 对话界面 → 纠错/建议展示
├─ 🎤 Web Speech API (STT) — 按住说话
├─ 🔊 SpeechSynthesis (TTS) — 自动朗读
└─ CSS Modules 样式隔离
```

## 内置 8 个场景

| 场景 | 难度 | 类别 |
|---|---|---|
| 🏢 办公室会议 | ⭐ | office |
| 🍽️ 餐厅点餐 | ⭐ | restaurant |
| ✈️ 机场值机 | ⭐⭐ | airport |
| 🏨 酒店预订 | ⭐⭐ | hotel |
| 📞 电话咨询 | ⭐⭐ | phone |
| 💼 工作面试 | ⭐⭐⭐ | interview |
| 📊 产品介绍 | ⭐⭐⭐ | meeting |
| 📋 客户投诉 | ⭐⭐⭐ | phone |

## 核心特性

| 特性 | 说明 |
|---|---|
| AI 双通道 | Gemini 2.0 Flash (主) + 规则引擎 (备)，全自动降级 |
| 语法纠错 | 实时检查大写、缩写、句长、标点 |
| 改进建议 | AI 或规则引擎给出可执行的提升建议 |
| 语音练习 | 按住说话 (STT) + 自动朗读 (TTS) |
| 多语言 UI | 中文 (zh) + 日语 (ja) |
| 自定义场景 | 传入自定义 scenarios 数组即可 |
| 零框架依赖 | 后端纯 TypeScript，适配任何框架 |

## 仅使用后端？

不需要 React。后端部分是纯 TypeScript：

```typescript
import { ConversationService } from "@toeicpass/conversation-ai";
// React 是 optional peerDependency，不安装也不报错
```

## License

MIT
