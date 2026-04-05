// @toeicpass/ad-system — Backend entry point

export { AdService } from "./ad.service";
export { DEFAULT_AD_SEEDS } from "./seeds";

export type {
  AdSlot,
  AdEventType,
  AdPlacement,
  AdEvent,
  AdStats,
  IAdStore,
  AdServiceConfig,
  CreateAdInput,
  UpdateAdInput,
  RecordAdEventInput,
} from "./types";
