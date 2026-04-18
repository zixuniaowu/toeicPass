# LangBoost — 日语 · 英语 口语强化平台

[**🚀 Live Demo on Hugging Face**](https://huggingface.co/spaces/jackywangsh/toeicPass)

AI 驱动的多语言口语练习平台，支持日语和英语跟读训练、语法强化、词汇复习、模拟考试、错题本、AI 会话等功能。

## ✨ 主要功能

### 🎧 跟读训练 (Shadowing)
- **YouTube 跟读** — 自动拉取 YouTube 字幕，逐句跟读练习
- **日语ふりがな** — 自动标注假名，支持开关切换
- **英语 IPA 音标** — 逐词音标显示
- **语音识别** — 实时录音对比，纠正发音
- **Cinema 模式** — 沉浸式视频+字幕分屏练习
- **TED 演讲 / 新闻跟读** — 每日更新素材

### 📝 TOEIC 备考
- Part 1-7 分项练习，自适应难度
- 模拟考试 + 分数换算 + 分项反馈
- 错题本 + 间隔重复卡片
- AI 图解析 + 成绩预测

### 🗣 AI 会话
- AI 驱动的错误分析和解释
- 多轮会话，实时口语练习

### 📊 学习分析
- 各 Part 正确率、速度、留存率趋势
- 成绩预测 + 瓶颈预警

## 技术架构

```
langboost/
├── apps/
│   ├── api/          NestJS REST API (port 8001)
│   └── web/          Next.js 15 frontend (port 8000)
├── packages/
│   ├── ad-system/    广告系统
│   ├── conversation-ai/  AI 会话引擎
│   └── shared/       共享类型
├── db/               PostgreSQL schema + migrations
└── docs/             架构文档
```

| 层 | 技术栈 |
|---|--------|
| API | NestJS, TypeScript, JWT + RBAC, 多租户 |
| Web | Next.js 15, React, CSS Modules |
| DB | PostgreSQL 15+ (PGLite for tests) |
| Analytics | Umami (隐私友好) |
| CI/CD | GitHub Actions → Hugging Face Spaces |
| Container | Docker (Node 20) |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器 (API + Web)
npm run dev

# 或分别启动
npm run dev:api      # API only (port 8001)
npm run dev:web:hot  # Web only (port 8000)
```

| URL | 说明 |
|-----|------|
| `http://localhost:8000` | Web 前端 |
| `http://localhost:8001/api/v1` | API |

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 (API + Web) |
| `npm run build` | 生产构建 |
| `npm test` | 运行测试 |
| `npm run lint` | TypeScript 类型检查 |
| `npm run db:migrate` | 数据库迁移 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8001` | API 端口 |
| `JWT_SECRET` | `dev-secret` | JWT 签名密钥 |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS 允许来源 |
| `DATABASE_URL` | — | PostgreSQL 连接字符串 |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | — | Umami 访客统计 ID |

## 部署

### Docker

```bash
docker build -t langboost .
docker run -p 7860:7860 langboost
```

### Hugging Face Spaces

每次 push 到 `main` 自动同步到 Hugging Face Spaces。

需要的 GitHub secrets: `HF_TOKEN`, `HF_REPO_ID`

## License

MIT

## Documentation

- [System Blueprint](docs/system-blueprint.md) — Architecture and product goals
- [API Contract](docs/api-contract-v1.md) — REST API specification
- [Official Question Sources](docs/official-question-sources.md) — Licensed content guidelines
- [Official Question Pack](docs/official-question-pack.md) — Built-in TOEIC-style content

## License

ISC
