# Third-Party Ad SDK Integration Guide

## Overview

This document outlines how to integrate external ad networks (Google AdSense, Google Ad Manager, etc.) into toeicPass's existing ad slot system to generate real ad revenue.

## Current Architecture

The app has a **self-serve ad placement system** with 4 slot types:

| Slot | Component | Trigger |
|------|-----------|---------|
| `banner_top` | `AdBanner` | Page load (persistent top banner) |
| `interstitial` | `InterstitialAd` | After session submit (fullscreen overlay) |
| `native_feed` | `NativeFeedAd` | Inline in results, lists |
| `reward_video` | `RewardVideoAd` | User opts in to earn extra attempts |

All ads are **only shown to free-tier users** (`show_ads: true` in plan features).

## Integration Strategy

### Phase 1: Google AdSense (Simplest, Fastest Revenue)

AdSense is the easiest entry point. It serves display ads automatically based on page content.

#### Setup Steps

1. **Create AdSense Account**
   - Apply at https://www.adsense.google.com/
   - Add site verification meta tag or ads.txt

2. **Install the Script**

   In `apps/web/app/layout.tsx`, add the AdSense script:
   ```tsx
   <Script
     src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
     crossOrigin="anonymous"
     strategy="afterInteractive"
   />
   ```

3. **Create Ad Unit Wrapper**

   Create `apps/web/components/ads/GoogleAdUnit.tsx`:
   ```tsx
   "use client";
   import { useEffect, useRef } from "react";

   interface GoogleAdUnitProps {
     slot: string;          // AdSense ad unit slot ID
     format?: "auto" | "rectangle" | "horizontal" | "vertical";
     responsive?: boolean;
     style?: React.CSSProperties;
   }

   export function GoogleAdUnit({ slot, format = "auto", responsive = true, style }: GoogleAdUnitProps) {
     const adRef = useRef<HTMLModElement>(null);
     const pushed = useRef(false);

     useEffect(() => {
       if (pushed.current) return;
       pushed.current = true;
       try {
         ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
       } catch (e) {
         // AdSense blocked by ad blocker
       }
     }, []);

     return (
       <ins
         ref={adRef}
         className="adsbygoogle"
         style={{ display: "block", ...style }}
         data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
         data-ad-slot={slot}
         data-ad-format={format}
         data-full-width-responsive={responsive ? "true" : "false"}
       />
     );
   }
   ```

4. **Replace Self-Serve Components**

   Modify `AdBanner`, `NativeFeedAd`, and `InterstitialAd` to use `GoogleAdUnit` when no self-serve ad is available:
   ```tsx
   // In AdBanner.tsx
   if (ads.length === 0) {
     return <GoogleAdUnit slot="1234567890" format="horizontal" />;
   }
   // ... render self-serve ad as fallback
   ```

#### AdSense Ad Formats Mapping

| App Slot | AdSense Format | Recommended Size |
|----------|---------------|-----------------|
| `banner_top` | Display ad (horizontal) | 728×90 (leaderboard) or responsive |
| `native_feed` | In-feed ad | Responsive in-content |
| `interstitial` | Not directly supported | Use overlay-style display ad |
| `reward_video` | Not supported | Keep self-serve or use AdMob |

### Phase 2: Google Ad Manager (GAM) + Header Bidding

For higher revenue with programmatic demand:

1. **Google Ad Manager (Free)**
   - Create GAM account at https://admanager.google.com/
   - Define ad units matching our 4 slots
   - Use GPT (Google Publisher Tag) for ad serving

2. **Install GPT**
   ```tsx
   // In layout.tsx
   <Script src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" strategy="afterInteractive" />
   ```

3. **Ad Unit Definition**
   ```tsx
   // In a useEffect or dedicated hook
   window.googletag = window.googletag || { cmd: [] };
   googletag.cmd.push(() => {
     googletag.defineSlot('/accountId/banner_top', [728, 90], 'div-banner-top')
       .addService(googletag.pubads());
     googletag.defineSlot('/accountId/native_feed', [300, 250], 'div-native-feed')
       .addService(googletag.pubads());
     googletag.pubads().enableSingleRequest();
     googletag.enableServices();
   });
   ```

### Phase 3: Video Ads (AdMob / IMA SDK)

For the `reward_video` slot, integrate Google IMA (Interactive Media Ads):

1. **IMA SDK** for web video ads
   ```html
   <script src="https://imasdk.googleapis.com/js/sdkloader/ima3.js"></script>
   ```

2. Replace `RewardVideoAd`'s simulated playback with actual IMA video:
   ```tsx
   // Create video container
   const adsLoader = new google.ima.AdsLoader(adDisplayContainer);
   adsLoader.addEventListener(
     google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
     onAdsManagerLoaded
   );
   // Request rewarded ad
   const adsRequest = new google.ima.AdsRequest();
   adsRequest.adTagUrl = REWARD_VIDEO_TAG_URL;
   adsLoader.requestAds(adsRequest);
   ```

## Environment Variables

Add these to `apps/web/.env.local`:
```
# Google AdSense
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_BANNER_SLOT=1234567890
NEXT_PUBLIC_ADSENSE_NATIVE_SLOT=0987654321

# Google Ad Manager (optional)
NEXT_PUBLIC_GAM_NETWORK_ID=/12345678

# IMA reward video (optional)
NEXT_PUBLIC_REWARD_VIDEO_TAG_URL=https://pubads.g.doubleclick.net/gampad/ads?...
```

## Hybrid Strategy (Recommended)

Use a **waterfall/hybrid approach**:

1. **Self-serve ads** (admin panel) take priority — direct deals and house ads
2. **AdSense/GAM backfill** when no self-serve ad is available
3. **Track both** through our existing event system

```tsx
// Unified ad rendering logic
function renderAd(selfServeAds: AdPlacement[], slot: string) {
  if (selfServeAds.length > 0) {
    return <SelfServeAd ad={selfServeAds[0]} />;  // Our own ad
  }
  return <GoogleAdUnit slot={ADSENSE_SLOTS[slot]} />;  // AdSense backfill
}
```

## Revenue Estimates

Based on TOEIC learning app demographics (Japan/China/Korea, adult learners):

| Metric | Conservative | Optimistic |
|--------|-------------|-----------|
| DAU | 1,000 | 10,000 |
| Pages/session | 5 | 10 |
| Banner CPM | $2-5 | $5-10 |
| Interstitial CPM | $8-15 | $15-30 |
| Daily banner revenue | $10-25 | $500-1000 |
| Daily interstitial revenue | $4-15 | $150-300 |
| Monthly total | $420-1,200 | $19,500-39,000 |

## Privacy & Compliance

- Add cookie consent banner for GDPR/CCPA compliance
- Google AdSense requires privacy policy page
- Japan's APPI: transparent data use disclosure
- China: ad labeling requirements (已标注 "AD"/"广告")

## Next Steps

1. Apply for Google AdSense account
2. Add `ads.txt` to `apps/web/public/ads.txt`
3. Create `GoogleAdUnit` component
4. Implement hybrid self-serve + AdSense waterfall
5. Add cookie consent UI
6. Monitor performance in GAM/AdSense dashboard
