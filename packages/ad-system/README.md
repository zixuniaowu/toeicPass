# @toeicpass/ad-system

> 可复用的广告投放、事件追踪与分析模块 — 后端服务 + React 前端组件。像积木一样拿来就用。

**零框架耦合** · **TypeScript** · **React (可选)** · **AdSense Waterfall**

## 文档一览

| 文档 | 说明 |
|---|---|
| [SPEC.md](./SPEC.md) | 完整规格书 — 全部类型定义、API 参考、事件流、架构图 |
| [INTEGRATION.md](./INTEGRATION.md) | 分步集成指南 — 从安装到上线 7 步完成 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更记录 |

## 快速开始

### 安装

```bash
npm install @toeicpass/ad-system
```

### 后端 (30 秒)

```typescript
import { AdService, DEFAULT_AD_SEEDS } from "@toeicpass/ad-system";
import type { IAdStore } from "@toeicpass/ad-system";

// 1. 实现存储接口
const store: IAdStore = {
  adPlacements: [],
  adEvents: [],
  persistSnapshot: () => { /* 写 DB */ },
};

// 2. 创建服务
const adService = new AdService(store);

// 3. 种子引导
adService.seedIfEmpty(DEFAULT_AD_SEEDS);

// 4. 使用
const ads = adService.getAdsForUser("free", "banner_top");
adService.recordAdEvent(ads[0].id, "user-123", "impression");
```

### 前端 (30 秒)

```tsx
import { AdBanner, NativeFeedAd } from "@toeicpass/ad-system/web";
import type { AdApiFunctions } from "@toeicpass/ad-system/web";

const api: AdApiFunctions = {
  fetchAds: (slot?) => fetch(`/api/ads?slot=${slot ?? ""}`).then(r => r.json()),
  recordAdEvent: (id, type) => fetch(`/api/ads/${id}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: type }),
  }).then(() => {}),
};

<AdBanner locale="zh" showAds={true} api={api} />
<NativeFeedAd locale="zh" showAds={true} api={api} />
```

## 架构

```
┌─────────────┐  implements  ┌──────────┐
│  IAdStore   │─────────────>│ AdService│  ← 纯 TypeScript, 无框架依赖
│  (你的 DB)  │              └──────────┘
└─────────────┘                    │
                                   ▼
                             REST / GraphQL
                                   │
                                   ▼
                         ┌──────────────────┐
                         │ React 组件        │  ← 通过 Props 注入 API
                         │ (AdBanner, etc.)  │     不耦合路由/状态管理
                         └──────────────────┘
```

## 功能列表

| 功能 | 说明 |
|---|---|
| 4 种广告位 | banner_top · interstitial · native_feed · reward_video |
| 用户计划定向 | 按 free/basic/premium 等计划展示不同广告 |
| 时间窗口调度 | startsAt / expiresAt 控制投放时段 |
| 事件追踪 | impression · click · dismiss · reward_complete |
| CTR 分析 | 按 slot 分组的曝光/点击/CTR 统计 |
| AdSense Waterfall | 自有广告优先，无广告时回退 Google AdSense |
| 管理面板 | 完整 CRUD + 统计仪表盘 (React 组件) |
| 种子数据 | 7 条预设广告，一行代码引导 |
| 多语言 | 中文 (zh) + 日语 (ja) |

## 仅使用后端？

不需要 React。后端部分是纯 TypeScript，不依赖任何 Web 框架或 UI 库。

```typescript
import { AdService } from "@toeicpass/ad-system";
// React 是 optional peerDependency，不安装也不报错
```

## License

MIT
