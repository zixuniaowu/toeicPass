# @toeicpass/ad-system — 規格書 (Specification)

> **Version**: 1.0.0 · **Last updated**: 2026-04-18

---

## 1. 概要

`@toeicpass/ad-system` 是一个零框架耦合的广告投放、事件追踪与分析模块。

**设计原则：**
- **Backend (`src/`)**: 纯 TypeScript，不依赖任何 Web 框架（NestJS、Express 等均可）
- **Frontend (`web/`)**: React 组件，通过 Props 注入 API 函数，不耦合路由或状态管理
- **存储抽象**: 宿主应用实现 `IAdStore` 接口即可接入任何数据库

```
┌─────────────────────────────────────────────────┐
│                  宿主应用 (Host App)              │
│                                                   │
│  ┌──────────┐ implements  ┌──────────────────┐   │
│  │ IAdStore │────────────>│   AdService      │   │
│  │ (DB层)   │             │ (纯业务逻辑)      │   │
│  └──────────┘             └──────────────────┘   │
│        │                          │               │
│        │ persist                  │ API 响应      │
│        ▼                          ▼               │
│  ┌──────────┐             ┌──────────────────┐   │
│  │ Database │             │  REST / GraphQL   │   │
│  └──────────┘             └──────────────────┘   │
│                                   │               │
│                                   ▼               │
│                           ┌──────────────────┐   │
│                           │  React 组件       │   │
│                           │  (AdBanner, etc.) │   │
│                           └──────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 2. 类型定义 (Type Reference)

### 2.1 核心类型 (`src/types.ts`)

#### AdSlot
```typescript
type AdSlot = "banner_top" | "interstitial" | "native_feed" | "reward_video";
```
| 值 | 用途 | 典型位置 |
|---|---|---|
| `banner_top` | 横幅广告 | 页面顶部/底部 |
| `interstitial` | 插页广告 | 操作间(如交卷后) |
| `native_feed` | 信息流广告 | 列表间嵌入 |
| `reward_video` | 激励视频 | 用户主动触发 |

#### AdEventType
```typescript
type AdEventType = "impression" | "click" | "dismiss" | "reward_complete";
```

#### AdPlacement
```typescript
interface AdPlacement {
  id: string;              // 唯一标识
  slot: AdSlot;            // 广告位类型
  title: string;           // 广告标题
  imageUrl?: string;       // 图片 URL (可选)
  linkUrl: string;         // 点击跳转 URL
  ctaText: string;         // CTA 按钮文字
  priority: number;        // 优先级 (高优先显示)
  targetPlans: string[];   // 目标用户计划 (如 ["free", "basic"])
  isActive: boolean;       // 是否启用
  impressions: number;     // 曝光次数
  clicks: number;          // 点击次数
  startsAt?: string;       // 投放开始时间 (ISO 8601)
  expiresAt?: string;      // 投放结束时间 (ISO 8601)
  createdAt: string;       // 创建时间 (ISO 8601)
}
```

#### AdEvent
```typescript
interface AdEvent {
  id: string;
  placementId: string;
  userId?: string;
  eventType: AdEventType;
  createdAt: string;
}
```

#### AdStats
```typescript
interface AdStats {
  totalPlacements: number;
  activePlacements: number;
  totalImpressions: number;
  totalClicks: number;
  ctr: number;            // 点击率 (百分比, 如 2.35)
  bySlot: Record<string, { count: number; impressions: number; clicks: number }>;
  recentEvents: Array<{ id: string; placementId: string; eventType: string; createdAt: string }>;
}
```

### 2.2 接口

#### IAdStore — 存储抽象 (宿主应用实现)
```typescript
interface IAdStore {
  adPlacements: AdPlacement[];  // 广告数据数组 (可读写)
  adEvents: AdEvent[];          // 事件日志数组 (可读写)
  persistSnapshot(): void;      // 持久化回调 (写DB/文件)
}
```

#### AdServiceConfig — 服务配置
```typescript
interface AdServiceConfig {
  generateId?: () => string;    // ID 生成函数 (默认: Date+random)
  nowIso?: () => string;        // 时间戳函数 (默认: new Date().toISOString())
}
```

#### CreateAdInput / UpdateAdInput — DTO
```typescript
interface CreateAdInput {
  slot: string;
  title: string;
  imageUrl?: string;
  linkUrl: string;
  ctaText: string;
  priority: number;
  targetPlans: string[];
  startsAt?: string;
  expiresAt?: string;
}

interface UpdateAdInput {
  slot?: string;
  title?: string;
  imageUrl?: string;
  linkUrl?: string;
  ctaText?: string;
  priority?: number;
  targetPlans?: string[];
  isActive?: boolean;
  startsAt?: string;
  expiresAt?: string;
}
```

---

## 3. 后端 API 参考 (AdService)

### 构造函数
```typescript
new AdService(store: IAdStore, config?: AdServiceConfig)
```

### 3.1 用户侧方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `getAdsForUser` | `(planCode: string, slot?: string) => AdPlacement[]` | 获取当前用户可见广告。按 priority 降序。自动过滤: 未激活、计划不匹配、未到投放时间、已过期。 |
| `recordAdEvent` | `(placementId: string, userId: string \| undefined, eventType: AdEventType) => void` | 记录广告事件。自动累加 `impressions` / `clicks` 计数。 |

### 3.2 管理侧方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `listAllAds` | `() => AdPlacement[]` | 列出全部广告 (按 priority 降序) |
| `getAdStats` | `() => AdStats` | 获取汇总统计 (CTR、各 slot 数据、最近 50 条事件) |
| `createAd` | `(data: CreateAdInput) => AdPlacement` | 创建新广告。自动赋 ID、初始化计数器。 |
| `updateAd` | `(adId: string, data: UpdateAdInput) => AdPlacement \| null` | 部分更新。未提供的字段保持不变。返回 null 表示未找到。 |
| `deleteAd` | `(adId: string) => boolean` | 删除广告。返回 false 表示未找到。 |
| `seedIfEmpty` | `(seeds: Array<...>) => AdPlacement[]` | 仅在无广告时批量插入种子数据。返回创建的广告列表。 |

---

## 4. 前端组件参考 (`web/`)

### 4.1 API 注入接口

```typescript
// 用户侧 API
interface AdApiFunctions {
  fetchAds: (slot?: string) => Promise<AdPlacement[]>;
  recordAdEvent: (placementId: string, eventType: string) => Promise<void>;
}

// 管理侧 API (扩展用户侧)
interface AdminAdApiFunctions extends AdApiFunctions {
  fetchAdminAds: () => Promise<AdPlacement[]>;
  fetchAdStats: () => Promise<AdStats | null>;
  createAd: (data: Record<string, unknown>) => Promise<AdPlacement | null>;
  updateAd: (adId: string, data: Record<string, unknown>) => Promise<AdPlacement | null>;
  deleteAd: (adId: string) => Promise<boolean>;
}
```

### 4.2 组件一览

| 组件 | Props | 说明 |
|---|---|---|
| `<AdBanner>` | `locale, showAds, slot?, api` | 横幅广告。支持 AdSense waterfall。 |
| `<NativeFeedAd>` | `locale, showAds, api` | 信息流嵌入广告卡片。 |
| `<InterstitialAd>` | `locale, showAds, slot?, autoCloseSeconds?, onClose, api` | 插页全屏广告。支持自动关闭倒计时。 |
| `<RewardVideoAd>` | `locale, onRewardEarned, onSkip, api` | 激励视频。完成后触发奖励回调。 |
| `<GoogleAdUnit>` | (内部使用) | AdSense 集成单元。 |
| `<AdManagerView>` | `locale, api` | 完整的管理后台面板：CRUD + 统计。 |

### 4.3 多语言支持

所有组件内置 `zh` (简体中文) 和 `ja` (日语) 两种 locale。通过 `locale` prop 切换。

### 4.4 AdSense Waterfall

通过环境变量配置 Google AdSense 回退：
```
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_BANNER_SLOT=1234567890
NEXT_PUBLIC_ADSENSE_NATIVE_SLOT=0987654321
```
机制：优先显示自有广告 → 无自有广告时回退到 AdSense 填充。

---

## 5. 事件追踪流

```
用户看到广告         用户点击广告         用户关闭广告
     │                    │                    │
     ▼                    ▼                    ▼
 impression            click              dismiss
     │                    │                    │
     ▼                    ▼                    ▼
 AdService.            AdService.          AdService.
 recordAdEvent()       recordAdEvent()     recordAdEvent()
     │                    │                    │
     ▼                    ▼                    ▼
 impressions++         clicks++           (仅记录事件)
     │                    │                    │
     └────────────────────┴────────────────────┘
                          │
                          ▼
                    adEvents[] 日志
                          │
                          ▼
                    getAdStats()
                    ├─ totalImpressions
                    ├─ totalClicks
                    ├─ CTR = clicks/impressions × 100
                    ├─ bySlot 分组统计
                    └─ recentEvents (最近 50 条)
```

---

## 6. 种子数据 (DEFAULT_AD_SEEDS)

包内提供 7 条预设广告用于快速引导，覆盖全部 4 种 slot 类型。

| Slot | 标题 | Priority |
|---|---|---|
| banner_top | StudyForge - AI学習プラットフォーム | 110 |
| banner_top | LangBoost オープンソース on GitHub | 100 |
| interstitial | StudyForge - AI搭載の学習プラットフォーム | 92 |
| interstitial | LangBoost はオープンソースです | 85 |
| native_feed | StudyForge - AI学習をもっと身近に | 88 |
| native_feed | GitHub でコントリビュート歓迎 | 75 |
| reward_video | 追加練習チャンスを獲得 | 95 |

---

## 7. 文件结构

```
packages/ad-system/
├── package.json            # 包描述 (可发布)
├── tsconfig.json           # TypeScript 编译配置
├── README.md               # 快速入门
├── SPEC.md                 # 本文档 — 完整规格书
├── INTEGRATION.md          # 分步集成指南
├── CHANGELOG.md            # 版本变更记录
├── src/                    # 后端 (纯 TypeScript)
│   ├── index.ts            # 入口: 导出 AdService + types
│   ├── ad.service.ts       # 核心服务类
│   ├── types.ts            # 全部类型定义
│   └── seeds.ts            # 预设广告种子数据
└── web/                    # 前端 (React + CSS Modules)
    ├── index.ts            # 入口: 导出全部组件 + types
    ├── types.ts            # 前端专用类型 (Props, API 接口)
    ├── lib/
    │   └── ad-provider.ts  # AdSense 配置与工具函数
    └── components/
        ├── AdBanner.tsx     + .module.css
        ├── NativeFeedAd.tsx + .module.css
        ├── InterstitialAd.tsx + .module.css
        ├── RewardVideoAd.tsx  + .module.css
        ├── GoogleAdUnit.tsx
        └── AdManagerView.tsx  + .module.css
```
