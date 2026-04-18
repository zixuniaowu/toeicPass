# @toeicpass/ad-system — 集成指南 (Integration Guide)

本文档帮助你将 `@toeicpass/ad-system` 集成到一个全新的项目中。

---

## 前提条件

- Node.js >= 18
- TypeScript >= 5.0
- 后端: 任意框架 (NestJS, Express, Fastify, Hono, etc.)
- 前端: React >= 18 (仅使用 `web/` 导出时需要)

---

## Step 1: 安装

### 方式 A: npm 安装 (独立项目)
```bash
npm install @toeicpass/ad-system
```

### 方式 B: Monorepo workspace 引用
```json
// package.json
{
  "dependencies": {
    "@toeicpass/ad-system": "workspace:*"
  }
}
```

### 方式 C: 直接复制 (最简单)
将 `packages/ad-system/` 目录复制到新项目中，在 `tsconfig.json` 中配置路径：
```json
{
  "compilerOptions": {
    "paths": {
      "@toeicpass/ad-system": ["./lib/ad-system/src"],
      "@toeicpass/ad-system/web": ["./lib/ad-system/web"]
    }
  }
}
```

---

## Step 2: 实现 IAdStore (后端存储)

这是唯一必须实现的接口。以下是三种常见实现。

### 2a: 内存实现 (开发/测试用)
```typescript
import type { IAdStore, AdPlacement, AdEvent } from "@toeicpass/ad-system";

class InMemoryAdStore implements IAdStore {
  adPlacements: AdPlacement[] = [];
  adEvents: AdEvent[] = [];
  persistSnapshot(): void { /* no-op for in-memory */ }
}
```

### 2b: PostgreSQL 实现
```typescript
import type { IAdStore, AdPlacement, AdEvent } from "@toeicpass/ad-system";
import { Pool } from "pg";

class PgAdStore implements IAdStore {
  adPlacements: AdPlacement[] = [];
  adEvents: AdEvent[] = [];
  
  constructor(private pool: Pool) {}

  async loadFromDb(): Promise<void> {
    const { rows: placements } = await this.pool.query("SELECT * FROM ad_placements");
    this.adPlacements = placements.map(row => ({
      id: row.id,
      slot: row.slot,
      title: row.title,
      imageUrl: row.image_url,
      linkUrl: row.link_url,
      ctaText: row.cta_text,
      priority: row.priority,
      targetPlans: row.target_plans,
      isActive: row.is_active,
      impressions: row.impressions,
      clicks: row.clicks,
      startsAt: row.starts_at?.toISOString(),
      expiresAt: row.expires_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
    }));
    
    const { rows: events } = await this.pool.query(
      "SELECT * FROM ad_events ORDER BY created_at DESC LIMIT 1000"
    );
    this.adEvents = events.map(row => ({
      id: row.id,
      placementId: row.placement_id,
      userId: row.user_id,
      eventType: row.event_type,
      createdAt: row.created_at.toISOString(),
    }));
  }

  persistSnapshot(): void {
    // Batch upsert placements to DB
    // (Implement with your preferred pattern: immediate write or debounced)
  }
}
```

### 2c: 文件系统实现 (快速原型)
```typescript
import type { IAdStore, AdPlacement, AdEvent } from "@toeicpass/ad-system";
import fs from "fs";

class FileAdStore implements IAdStore {
  adPlacements: AdPlacement[] = [];
  adEvents: AdEvent[] = [];
  private filePath: string;

  constructor(filePath = "./data/ads.json") {
    this.filePath = filePath;
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      this.adPlacements = data.placements ?? [];
      this.adEvents = data.events ?? [];
    }
  }

  persistSnapshot(): void {
    fs.writeFileSync(this.filePath, JSON.stringify({
      placements: this.adPlacements,
      events: this.adEvents,
    }, null, 2));
  }
}
```

---

## Step 3: 初始化 AdService (后端)

```typescript
import { AdService, DEFAULT_AD_SEEDS } from "@toeicpass/ad-system";

// 1. 创建 Store 实例
const store = new InMemoryAdStore();

// 2. 创建 Service 实例
const adService = new AdService(store);

// 3. (可选) 种子数据引导
adService.seedIfEmpty(DEFAULT_AD_SEEDS);
```

---

## Step 4: 暴露 REST API (后端)

以下示例适用于 Express。NestJS/Fastify/Hono 等可等效转换。

```typescript
import express from "express";

const app = express();
app.use(express.json());

// === 用户侧 ===

// 获取可见广告
app.get("/api/ads", (req, res) => {
  const userPlan = req.user?.plan ?? "free"; // 从认证中获取用户计划
  const slot = req.query.slot as string | undefined;
  res.json(adService.getAdsForUser(userPlan, slot));
});

// 记录广告事件
app.post("/api/ads/:id/event", (req, res) => {
  const { eventType } = req.body;
  adService.recordAdEvent(req.params.id, req.user?.id, eventType);
  res.json({ ok: true });
});

// === 管理侧 (需要鉴权) ===

app.get("/api/admin/ads", requireAdmin, (req, res) => {
  res.json(adService.listAllAds());
});

app.get("/api/admin/ads/stats", requireAdmin, (req, res) => {
  res.json(adService.getAdStats());
});

app.post("/api/admin/ads", requireAdmin, (req, res) => {
  res.json(adService.createAd(req.body));
});

app.patch("/api/admin/ads/:id", requireAdmin, (req, res) => {
  const result = adService.updateAd(req.params.id, req.body);
  result ? res.json(result) : res.status(404).json({ error: "Not found" });
});

app.delete("/api/admin/ads/:id", requireAdmin, (req, res) => {
  adService.deleteAd(req.params.id)
    ? res.json({ ok: true })
    : res.status(404).json({ error: "Not found" });
});
```

---

## Step 5: 集成前端组件 (React)

### 5a: 创建 API 绑定
```typescript
// lib/ad-api.ts
import type { AdApiFunctions } from "@toeicpass/ad-system/web";

export const adApi: AdApiFunctions = {
  fetchAds: async (slot?) => {
    const url = slot ? `/api/ads?slot=${slot}` : "/api/ads";
    const res = await fetch(url);
    return res.json();
  },
  recordAdEvent: async (placementId, eventType) => {
    await fetch(`/api/ads/${placementId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType }),
    });
  },
};
```

### 5b: 使用组件
```tsx
import { AdBanner, NativeFeedAd, InterstitialAd, RewardVideoAd } from "@toeicpass/ad-system/web";
import { adApi } from "./lib/ad-api";

function MyPage() {
  return (
    <div>
      {/* 页面顶部横幅 */}
      <AdBanner locale="zh" showAds={true} api={adApi} />

      {/* 列表中嵌入广告 */}
      <ul>
        {items.map((item, i) => (
          <>
            <li key={item.id}>{item.name}</li>
            {i === 2 && <NativeFeedAd locale="zh" showAds={true} api={adApi} />}
          </>
        ))}
      </ul>
    </div>
  );
}
```

### 5c: 管理面板
```tsx
import { AdManagerView } from "@toeicpass/ad-system/web";
import type { AdminAdApiFunctions } from "@toeicpass/ad-system/web";

const adminApi: AdminAdApiFunctions = {
  ...adApi,
  fetchAdminAds: () => fetch("/api/admin/ads").then(r => r.json()),
  fetchAdStats: () => fetch("/api/admin/ads/stats").then(r => r.json()),
  createAd: (data) => fetch("/api/admin/ads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(r => r.json()),
  updateAd: (id, data) => fetch(`/api/admin/ads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(r => r.json()),
  deleteAd: (id) => fetch(`/api/admin/ads/${id}`, { method: "DELETE" }).then(r => r.ok),
};

function AdminPage() {
  return <AdManagerView locale="zh" api={adminApi} />;
}
```

---

## Step 6: (可选) AdSense Waterfall

在 `.env.local` 中配置 Google AdSense：
```env
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_BANNER_SLOT=1234567890
NEXT_PUBLIC_ADSENSE_NATIVE_SLOT=0987654321
```

机制：`<AdBanner>` 和 `<NativeFeedAd>` 会先尝试加载自有广告。如果无可用广告，会自动渲染 `<GoogleAdUnit>` 作为回退。无需代码修改。

---

## Step 7: PostgreSQL Schema (如果使用持久化)

```sql
CREATE TABLE IF NOT EXISTS ad_placements (
  id text PRIMARY KEY,
  slot text NOT NULL CHECK (slot IN ('banner_top', 'interstitial', 'native_feed', 'reward_video')),
  title text NOT NULL,
  image_url text,
  link_url text NOT NULL,
  cta_text text NOT NULL,
  priority int NOT NULL DEFAULT 0,
  target_plans text[] NOT NULL DEFAULT '{free}',
  is_active boolean NOT NULL DEFAULT true,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_events (
  id text PRIMARY KEY,
  placement_id text NOT NULL REFERENCES ad_placements(id) ON DELETE CASCADE,
  user_id text,
  event_type text NOT NULL CHECK (event_type IN ('impression', 'click', 'dismiss', 'reward_complete')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_events_placement ON ad_events(placement_id);
CREATE INDEX idx_ad_events_type ON ad_events(event_type, created_at);
```

---

## 常见问题 (FAQ)

### Q: 只用后端不用前端组件可以吗？
A: 可以。`import from "@toeicpass/ad-system"` 即可使用纯 TypeScript 服务。React 是 `peerDependency` 且标记为 `optional`。

### Q: 可以添加自定义 AdSlot 类型吗？
A: 当前 `AdSlot` 是固定的 4 种类型。如果需要扩展，可以 fork 后修改 `src/types.ts` 中的 `AdSlot` 类型。

### Q: 如何在非 React 框架 (Vue, Svelte) 中使用？
A: 后端部分直接使用。前端需要根据 `web/types.ts` 中的 Props 接口自行实现组件。组件逻辑可参考 `web/components/` 中的实现。

### Q: persistSnapshot 多久调用一次？
A: 每次 `createAd`、`updateAd`、`deleteAd` 执行后自动调用。`recordAdEvent` 不触发 persist (仅累加内存计数)。如果需要事件持久化，宿主应用可定时 batch write。
