export function listeningTracksByPart(partNo: number): string[] {
  const tracks: Record<number, string[]> = {
    1: [
      "/assets/audio/toeic-official/practice-test-1-part-1.mp3",
      "/assets/audio/toeic-official/practice-test-2-part-1.mp3",
    ],
    2: [
      "/assets/audio/toeic-official/practice-test-1-part-2.mp3",
      "/assets/audio/toeic-official/practice-test-2-part-2.mp3",
    ],
    3: [
      "/assets/audio/toeic-official/practice-test-1-part-3.mp3",
      "/assets/audio/toeic-official/practice-test-2-part-3.mp3",
    ],
    4: [
      "/assets/audio/toeic-official/practice-test-1-part-4.mp3",
      "/assets/audio/toeic-official/practice-test-2-part-4.mp3",
    ],
  };
  return tracks[partNo] ?? [];
}

export function isClipEligibleListeningTrack(url: string): boolean {
  if (!url.includes("/assets/audio/toeic-official/")) {
    return false;
  }
  return /practice-test-\d-part-\d\.mp3$/i.test(url);
}

export function listeningClipDuration(partNo: number): number {
  if (partNo === 1) return 11;
  if (partNo === 2) return 9;
  if (partNo === 3) return 24;
  return 26;
}

export function listeningOffsetRange(partNo: number): { intro: number; step: number; window: number } {
  if (partNo === 1) return { intro: 22, step: 13, window: 320 };
  if (partNo === 2) return { intro: 30, step: 10, window: 440 };
  if (partNo === 3) return { intro: 40, step: 26, window: 520 };
  return { intro: 40, step: 28, window: 540 };
}

export function parseFragmentStart(url: string): number | undefined {
  const fragment = url.split("#", 2)[1];
  if (!fragment) {
    return undefined;
  }
  const parsed = fragment.match(/(?:^|&)t=(\d+(?:\.\d+)?)(?:,\d+(?:\.\d+)?)?/i);
  if (!parsed) {
    return undefined;
  }
  const start = Number(parsed[1]);
  return Number.isFinite(start) ? start : undefined;
}

export function buildListeningClip(track: string, partNo: number, index: number, startOverride?: number): string {
  const clipSeconds = listeningClipDuration(partNo);
  const { intro, step, window } = listeningOffsetRange(partNo);
  const tracks = listeningTracksByPart(partNo);
  const trackIndex = tracks.indexOf(track);
  const normalizedTrackIndex = trackIndex >= 0 ? trackIndex : index % Math.max(tracks.length, 1);
  const sequence = Math.floor(index / Math.max(tracks.length, 1));
  const maxStart = Math.max(12, window - clipSeconds - 1);
  const derivedStart = intro + ((sequence + normalizedTrackIndex * 2) * step) % maxStart;
  const start = typeof startOverride === "number" ? startOverride : derivedStart;
  const end = start + clipSeconds;
  return `${track}#t=${start},${end}`;
}

export function normalizeListeningMediaUrl(
  mediaUrl: string | undefined,
  partNo: number,
  index: number,
  source?: string,
): string | undefined {
  if (partNo < 1 || partNo > 4) {
    return mediaUrl;
  }

  const fallback = listeningMediaFor(partNo, index);
  if (!mediaUrl) {
    if (source === "official_pack" && partNo <= 4) {
      return undefined;
    }
    return fallback;
  }

  const [trackPath] = mediaUrl.split("#", 1);
  if (!isClipEligibleListeningTrack(trackPath)) {
    return mediaUrl;
  }

  const clipStart = parseFragmentStart(mediaUrl);
  return buildListeningClip(trackPath, partNo, index, clipStart);
}

export function listeningMediaFor(partNo: number, index: number): string | undefined {
  const tracks = listeningTracksByPart(partNo);
  if (tracks.length === 0) {
    return undefined;
  }
  const track = tracks[index % tracks.length];
  return buildListeningClip(track, partNo, index);
}
