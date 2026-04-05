# @toeicpass/ad-system

Reusable ad placement, serving, and analytics module — backend + frontend.

## Installation

```bash
npm install @toeicpass/ad-system
```

Or as a workspace reference in monorepo `package.json`:
```json
{ "dependencies": { "@toeicpass/ad-system": "workspace:*" } }
```

## Backend Usage

```typescript
import { AdService, DEFAULT_AD_SEEDS } from "@toeicpass/ad-system";
import type { IAdStore } from "@toeicpass/ad-system";

// Implement the store interface for your database
const store: IAdStore = {
  adPlacements: [],
  adEvents: [],
  persistSnapshot: () => { /* save to DB */ },
};

const adService = new AdService(store);

// Seed default ads on first run
adService.seedIfEmpty();

// Get ads for a user based on their plan
const ads = adService.getAdsForUser("free", "banner_top");

// Record events
adService.recordAdEvent("placement-id", "user-123", "impression");

// Admin operations
const all = adService.listAllAds();
const stats = adService.getAdStats();
const newAd = adService.createAd({ slot: "banner_top", title: "...", linkUrl: "...", ctaText: "...", priority: 10, targetPlans: ["free", "basic"] });
adService.updateAd("ad-id", { isActive: false });
adService.deleteAd("ad-id");
```

## Frontend Usage

```tsx
import { AdBanner, NativeFeedAd, InterstitialAd, RewardVideoAd, AdManagerView } from "@toeicpass/ad-system/web";
import type { AdApiFunctions, AdminAdApiFunctions } from "@toeicpass/ad-system/web";

// Bind your API functions
const adApi: AdApiFunctions = {
  fetchAds: (slot?) => fetch(`/api/ads?slot=${slot}`).then(r => r.json()),
  recordAdEvent: (id, type) => fetch(`/api/ads/${id}/event`, { method: "POST", body: JSON.stringify({ eventType: type }) }),
};

// Use in your app
<AdBanner locale="zh" api={adApi} />
<NativeFeedAd locale="zh" api={adApi} index={0} />
<InterstitialAd locale="zh" api={adApi} trigger="session_complete" />
<RewardVideoAd locale="zh" api={adApi} onRewardEarned={() => console.log("Reward!")} />

// Admin panel
const adminApi: AdminAdApiFunctions = {
  ...adApi,
  fetchAllAds: () => fetch("/api/admin/ads").then(r => r.json()),
  fetchAdStats: () => fetch("/api/admin/ads/stats").then(r => r.json()),
  createAd: (data) => fetch("/api/admin/ads", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
  updateAd: (id, data) => fetch(`/api/admin/ads/${id}`, { method: "PATCH", body: JSON.stringify(data) }).then(r => r.json()),
  deleteAd: (id) => fetch(`/api/admin/ads/${id}`, { method: "DELETE" }),
};

<AdManagerView locale="zh" api={adminApi} />
```

## Architecture

- **Backend** (`src/`): Pure TypeScript — no framework dependency. Uses `IAdStore` interface for database abstraction.
- **Frontend** (`web/`): React components with CSS Modules. Uses `AdApiFunctions` interface for API abstraction.
- **No coupling** to auth, routing, or state management — inject via props/constructor.

### Slot Types
- `banner_top` — Header/footer banner ads
- `interstitial` — Full-screen between actions
- `native_feed` — In-feed cards
- `reward_video` — Watch-to-unlock rewards

### Features
- Plan-tier targeting (show different ads to free vs premium users)
- Impression/click/dismiss/reward tracking
- Google AdSense hybrid waterfall support
- Admin CRUD + analytics dashboard
- 10 seed ads included for quick bootstrapping
