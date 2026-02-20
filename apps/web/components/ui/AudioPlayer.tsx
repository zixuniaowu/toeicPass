"use client";

import { forwardRef } from "react";
import styles from "./AudioPlayer.module.css";

interface AudioPlayerProps {
  src: string;
  label?: string;
  compact?: boolean;
}

export const AudioPlayer = forwardRef<HTMLAudioElement, AudioPlayerProps>(
  ({ src, label, compact = false }, ref) => {
    return (
      <div className={`${styles.wrapper} ${compact ? styles.compact : ""}`}>
        {label && <p className={styles.label}>{label}</p>}
        <audio ref={ref} controls preload="none" src={src} className={styles.audio} />
      </div>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";
