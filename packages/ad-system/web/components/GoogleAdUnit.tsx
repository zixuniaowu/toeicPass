"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface GoogleAdUnitProps {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  responsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function GoogleAdUnit({
  slot,
  format = "auto",
  responsive = true,
  style,
  className,
}: GoogleAdUnitProps) {
  const pushed = useRef(false);
  const clientId = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID : undefined;

  useEffect(() => {
    if (!clientId || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense blocked by ad blocker — silent fail
    }
  }, [clientId]);

  if (!clientId) return null;

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block", ...style }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}

export default GoogleAdUnit;
