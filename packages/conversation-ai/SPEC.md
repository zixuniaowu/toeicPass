# @toeicpass/conversation-ai — 規格書 (Specification)

> **Version**: 1.0.0 · **Last updated**: 2026-04-18

---

## 1. 概要

`@toeicpass/conversation-ai` 是一个 TOEIC 英语口语/对话练习 AI 模块。

**设计原则：**
- **Backend (`src/`)**: 纯 TypeScript，不依赖任何 Web 框架
- **Frontend (`web/`)**: 单一 React 组件 `<ConversationView>`，通过 Props 注入 API，内置 Web Speech API 语音支持
- **AI 双通道**: Google Gemini API (主) + 规则引擎 (备)，无 API Key 也能运行

```
┌─────────────────────────────────────────────────┐
│                  宿主应用 (Host App)              │
│                                                   │
│  ┌──────────────┐         ┌──────────────────┐   │
│  │ GEMINI_API_  │ optional│ ConversationSvc  │   │
│  │ KEY (env)    │────────>│  (AI + Fallback) │   │
│  └──────────────┘         └──────────────────┘   │
│                                   │               │
│                                   │ API 响应      │
│                                   ▼               │
│                           ┌──────────────────┐   │
│                           │  REST Endpoint   │   │
│                           └──────────────────┘   │
│                                   │               │
│                                   ▼               │
│                           ┌──────────────────┐   │
│                           │ ConversationView │   │
│                           │ (React + Speech) │   │
│                           └──────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 2. 类型定义 (Type Reference)

### 2.1 核心类型 (`src/types.ts`)

#### ConversationScenario
```typescript
interface ConversationScenario {
  id: string;              // 场景唯一标识 (如 "office-meeting")
  title: string;           // 英文标题
  titleCn: string;         // 中文标题
  description: string;     // 场景描述
  context: string;         // AI 系统提示词中的上下文说明
  difficulty: 1 | 2 | 3;  // 难度等级
  category: "office" | "restaurant" | "airport" | "hotel"
           | "shopping" | "meeting" | "phone" | "interview";
}
```

#### ConversationMessage
```typescript
interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;         // ISO 8601
  corrections?: string[];    // 语法纠错
  suggestions?: string[];    // 改进建议
}
```

#### ConversationSession
```typescript
interface ConversationSession {
  scenarioId: string;
  messages: ConversationMessage[];
  startedAt: string;         // ISO 8601
  score?: number;            // 会话评分 (可选)
  feedback?: string;         // 总结反馈 (可选)
}
```

#### ConversationReplyInput
```typescript
interface ConversationReplyInput {
  scenarioId: string;        // 当前场景 ID
  text: string;              // 用户输入文本
  history?: string[];        // 对话历史 (交替排列)
}
```

#### ConversationReplyResult
```typescript
interface ConversationReplyResult {
  content: string;           // AI 回复
  corrections: string[];     // 语法纠正 (空数组表示无错误)
  suggestions: string[];     // 改进建议 (空数组表示无建议)
}
```

### 2.2 配置

#### ConversationServiceConfig
```typescript
interface ConversationServiceConfig {
  geminiApiKey?: string;                  // Gemini API 密钥 (缺省时用规则引擎)
  scenarios?: ConversationScenario[];     // 自定义场景 (缺省用内置 8 个)
  model?: string;                         // Gemini 模型名 (默认 "gemini-2.0-flash")
}
```

### 2.3 前端接口 (`web/types.ts`)

#### ConversationApiFunctions
```typescript
interface ConversationApiFunctions {
  fetchScenarios: () => Promise<ConversationScenario[]>;
  sendReply: (payload: {
    scenarioId: string;
    text: string;
    history: string[];
  }) => Promise<{
    success: boolean;
    content?: string;
    corrections?: string[];
    suggestions?: string[];
    error?: string;
  }>;
}
```

#### ConversationViewProps
```typescript
interface ConversationViewProps {
  locale: "zh" | "ja";
  api: ConversationApiFunctions;
}
```

---

## 3. 后端 API 参考 (ConversationService)

### 构造函数
```typescript
new ConversationService(config?: ConversationServiceConfig)
```

### 方法一览

| 方法 | 签名 | 说明 |
|---|---|---|
| `listScenarios` | `() => ConversationScenario[]` | 返回所有可用场景列表 (内置 8 个或自定义) |
| `generateReply` | `(dto: ConversationReplyInput) => Promise<ConversationReplyResult>` | 生成 AI 回复。scenarioId 不存在时抛 Error |

### generateReply 内部流程

```
输入: { scenarioId, text, history }
          │
          ▼
  场景查找 (scenarios.find)
  ├─ 未找到 → throw Error
  └─ 找到 → 继续
          │
          ▼
  有 geminiApiKey?
  ├─ 是 → Gemini API 调用
  │       ├─ 成功 → 返回 { content, corrections, suggestions }
  │       └─ 失败 → 降级到规则引擎
  └─ 否 → 规则引擎
          │
          ▼
  规则引擎:
  ├─ 检查大写 "I"
  ├─ 检查缩写词 (dont → do not)
  ├─ 检查句子长度
  ├─ 检查尾部标点
  └─ 按 category + historyLength 选择回复
          │
          ▼
  返回 { content, corrections, suggestions }
```

### Gemini API 调用细节

| 参数 | 值 |
|---|---|
| 端点 | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| 模型 | 默认 `gemini-2.0-flash` |
| temperature | 0.7 |
| maxOutputTokens | 300 |
| responseMimeType | `application/json` |
| 系统提示 | 包含场景标题、上下文、难度等级 |
| 输出格式 | `{"content":"...","corrections":[...],"suggestions":[...]}` |

---

## 4. 内置场景 (DEFAULT_SCENARIOS)

| ID | 标题 | 中文 | 难度 | 类别 |
|---|---|---|---|---|
| `office-meeting` | Office Meeting | 办公室会议 | 1 | office |
| `restaurant-order` | Restaurant Order | 餐厅点餐 | 1 | restaurant |
| `airport-checkin` | Airport Check-in | 机场值机 | 2 | airport |
| `hotel-reservation` | Hotel Reservation | 酒店预订 | 2 | hotel |
| `phone-inquiry` | Phone Inquiry | 电话咨询 | 2 | phone |
| `job-interview` | Job Interview | 工作面试 | 3 | interview |
| `product-presentation` | Product Presentation | 产品介绍 | 3 | meeting |
| `complaint-resolution` | Customer Complaint | 客户投诉 | 3 | phone |

难度分布：Level 1 × 2、Level 2 × 3、Level 3 × 3

### 8 个 category 的规则引擎回复

每个 category 包含：
- **前期回复** (historyLength < 4): 2-3 条场景化应答
- **后期回复** (historyLength >= 4): 1-2 条学习指导建议

---

## 5. 前端组件参考 (`web/`)

### ConversationView

全屏对话界面，支持语音输入/输出。

| Props | 类型 | 必填 | 说明 |
|---|---|---|---|
| `locale` | `"zh" \| "ja"` | 是 | UI 语言 |
| `api` | `ConversationApiFunctions` | 是 | API 注入 |

**内置功能：**
- 场景选择列表 (显示标题、中文标题、难度标签)
- 对话消息列表 (用户 + AI，含纠错/建议展开)
- 文本输入 + 发送按钮
- 🎤 按住说话 (Web Speech API SpeechRecognition)
- 🔊 AI 回复自动朗读 (SpeechSynthesis)
- 移动端优化布局
- CSS Modules 样式隔离

### 语音 API 细节

| 功能 | API | 说明 |
|---|---|---|
| 语音识别 | `webkitSpeechRecognition` / `SpeechRecognition` | lang="en-US", continuous=false |
| 语音合成 | `SpeechSynthesis.speak()` | lang="en-US", rate=0.9 |

---

## 6. 文件结构

```
packages/conversation-ai/
├── package.json              # 包描述 (可发布)
├── tsconfig.json             # TypeScript 编译配置
├── README.md                 # 快速入门
├── SPEC.md                   # 本文档 — 完整规格书
├── INTEGRATION.md            # 分步集成指南
├── CHANGELOG.md              # 版本变更记录
├── src/                      # 后端 (纯 TypeScript)
│   ├── index.ts              # 入口: 导出 ConversationService + types
│   ├── conversation.service.ts # 核心服务类 (Gemini + 规则引擎)
│   ├── types.ts              # 全部类型定义
│   └── scenarios.ts          # 8 个内置 TOEIC 场景
└── web/                      # 前端 (React + CSS Modules)
    ├── index.ts              # 入口: 导出 ConversationView + types
    ├── types.ts              # 前端专用类型 (Props, API 接口)
    ├── speech-recognition.d.ts  # Web Speech API 类型声明
    ├── ConversationView.tsx  # 全屏对话组件
    └── ConversationView.module.css  # 样式
```
