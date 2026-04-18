# @toeicpass/shared

> toeicPass 生态的共享类型定义包 — 零运行时、零依赖、纯 TypeScript 类型。

## 文档

| 文档 | 说明 |
|---|---|
| [SPEC.md](./SPEC.md) | 规格书 — 全部类型说明、使用场景、引用情况 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更记录 |

## 安装

```bash
npm install @toeicpass/shared
```

或 monorepo workspace 引用：
```json
{ "dependencies": { "@toeicpass/shared": "workspace:*" } }
```

## 使用

```typescript
import type {
  LearningActionCommand,
  LearningPartGroup,
  SessionFilters,
  Locale,
  SessionMode,
  Role,
} from "@toeicpass/shared";

// 示例
const action: LearningActionCommand = "practice:start";
const filters: SessionFilters = { partNo: 5, difficulty: 2 };
const locale: Locale = "zh";
const role: Role = "learner";
```

## 导出一览

| 类型 | 说明 |
|---|---|
| `LearningActionCommand` | 6 种学习操作指令 |
| `LearningPartGroup` | `"listening"` \| `"reading"` |
| `SessionFilters` | 练习筛选参数 (partNo, difficulty, partGroup) |
| `Locale` | `"zh"` \| `"ja"` |
| `SessionMode` | `"diagnostic"` \| `"practice"` \| `"mock"` |
| `Role` | 4 种 RBAC 角色 |

## 包特点

- **纯类型** — 不包含运行时代码，不增加打包体积
- **零依赖** — 无 peerDependencies
- **前后端共用** — API 和 Web 项目导入同一类型源

## License

MIT
