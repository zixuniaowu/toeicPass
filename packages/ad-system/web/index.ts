// @toeicpass/ad-system/web — Frontend entry point
//
// Re-exports all web components, hooks, and utilities.
// Components accept API callbacks as props to stay decoupled from any specific API client.

export { AdBanner } from "./components/AdBanner";
export { NativeFeedAd } from "./components/NativeFeedAd";
export { InterstitialAd } from "./components/InterstitialAd";
export { RewardVideoAd } from "./components/RewardVideoAd";
export { GoogleAdUnit } from "./components/GoogleAdUnit";
export { AdManagerView } from "./components/AdManagerView";

export {
  isAdSenseEnabled,
  getAdSenseSlot,
  ADSENSE_SLOTS,
} from "./lib/ad-provider";

export type { AdSlotType } from "./lib/ad-provider";

export type {
  AdBannerProps,
  NativeFeedAdProps,
  InterstitialAdProps,
  RewardVideoAdProps,
  AdManagerViewProps,
  AdApiFunctions,
  AdminAdApiFunctions,
} from "./types";
