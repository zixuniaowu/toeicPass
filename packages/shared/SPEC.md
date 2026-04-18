# @toeicpass/shared — 規格書 (Specification)

> **Version**: 1.0.0 · **Last updated**: 2026-04-18

---

## 1. 概要

`@toeicpass/shared` 是 toeicPass 生态的共享类型定义包。提供后端 (API) 和前端 (Web) 之间统一的 TypeScript 类型契约。

**包的定位：** 纯类型 + 常量，零运行时代码，零依赖。

---

## 2. 类型定义 (Type Reference)

### 2.1 LearningActionCommand

学习操作指令枚举。前后端统一使用。

```typescript
type LearningActionCommand =
  | "practice:start"    // 练习模式
  | "diagnostic:start"  // 诊断测试
  | "mock:start"        // 模拟考试
  | "mistakes:start"    // 错题回顾
  | "vocab:start"       // 词汇练习
  | "shadowing:start";  // 跟读训练
```

| 指令 | 说明 | 典型触发场景 |
|---|---|---|
| `practice:start` | 按 Part / 难度练习题目 | 学习页点击"开始练习" |
| `diagnostic:start` | 诊断测试，确定基准分 | 首次使用 / 定期评估 |
| `mock:start` | 完整模拟考试 (200 题) | 模考页面 |
| `mistakes:start` | 错题本再练习 | 错题页面 |
| `vocab:start` | 词汇卡片练习 | 词汇页面 |
| `shadowing:start` | 听力跟读训练 | 听力练习页面 |

### 2.2 LearningPartGroup

TOEIC 考试分区。

```typescript
type LearningPartGroup = "listening" | "reading";
```

### 2.3 SessionFilters

练习/诊断/模考的筛选参数。

```typescript
type SessionFilters = {
  partNo?: number;           // Part 编号 (1-7)
  difficulty?: number;       // 难度等级
  partGroup?: LearningPartGroup;  // 听力/阅读
};
```

### 2.4 Locale

支持的 UI 语言。

```typescript
type Locale = "zh" | "ja";
```

### 2.5 SessionMode

会话模式。

```typescript
type SessionMode = "diagnostic" | "practice" | "mock";
```

### 2.6 Role

RBAC 角色。

```typescript
type Role = "learner" | "coach" | "tenant_admin" | "super_admin";
```

| 角色 | 权限范围 |
|---|---|
| `learner` | 学习功能、个人数据 |
| `coach` | 学员管理、成绩查看 |
| `tenant_admin` | 租户管理、题目管理 |
| `super_admin` | 全平台管理 |

---

## 3. 当前使用情况

| 引用位置 | 导入的类型 |
|---|---|
| `apps/api/src/learning-action.ts` | `LearningActionCommand`, `LearningPartGroup` |
| `apps/api/src/types.ts` | `Role` |
| `apps/web/types/index.ts` | `Locale`, `SessionMode`, `SessionFilters` |
| `apps/web/lib/learning-action.ts` | `LearningActionCommand`, `SessionFilters` |

---

## 4. 文件结构

```
packages/shared/
├── package.json        # 包描述 (可发布)
├── tsconfig.json       # TypeScript 编译配置
├── README.md           # 快速入门
├── SPEC.md             # 本文档 — 规格书
├── CHANGELOG.md        # 版本变更记录
└── src/
    └── index.ts        # 全部类型导出 (唯一源文件)
```
