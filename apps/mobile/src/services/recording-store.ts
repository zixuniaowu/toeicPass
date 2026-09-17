import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

const RECORDINGS_DIR = `${FileSystem.documentDirectory}shadowing-recordings/`;
const INDEX_KEY = "shadowing.recordings.v1";
const MAX_RECORDINGS = 50;

export type SavedRecording = {
  id: string;
  /** Persistent file:// uri inside the app's documents directory. */
  uri: string;
  materialId: string;
  materialTitle: string;
  sentenceIndex: number;
  sentenceText: string;
  lang: "en" | "ja";
  createdAt: string;
};

export async function ensureRecordingsDir(): Promise<string> {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
  return RECORDINGS_DIR;
}

export async function listRecordings(): Promise<SavedRecording[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedRecording[]) : [];
  } catch {
    return [];
  }
}

function safeFileBase(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "clip"
  );
}

/**
 * Copy a recognizer cache file into the app's documents directory so it
 * survives cache cleanup, and record it in the AsyncStorage index.
 * Keeps at most MAX_RECORDINGS entries (oldest deleted first).
 */
export async function saveRecording(input: {
  sourceUri: string;
  materialId: string;
  materialTitle: string;
  sentenceIndex: number;
  sentenceText: string;
  lang: "en" | "ja";
}): Promise<SavedRecording | null> {
  try {
    const dir = await ensureRecordingsDir();
    const createdAt = new Date().toISOString();
    const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${id}-${safeFileBase(input.sentenceText)}.wav`;
    const destUri = `${dir}${fileName}`;
    await FileSystem.copyAsync({ from: input.sourceUri, to: destUri });

    const recording: SavedRecording = {
      id,
      uri: destUri,
      materialId: input.materialId,
      materialTitle: input.materialTitle,
      sentenceIndex: input.sentenceIndex,
      sentenceText: input.sentenceText,
      lang: input.lang,
      createdAt,
    };

    const existing = await listRecordings();
    const next = [recording, ...existing];
    const trimmed = next.slice(0, MAX_RECORDINGS);
    const removed = next.slice(MAX_RECORDINGS);
    for (const item of removed) {
      try {
        await FileSystem.deleteAsync(item.uri, { idempotent: true });
      } catch {
        // File may already be gone; index cleanup still proceeds.
      }
    }
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(trimmed));
    return recording;
  } catch {
    return null;
  }
}

export async function deleteRecording(id: string): Promise<SavedRecording[]> {
  const existing = await listRecordings();
  const target = existing.find((item) => item.id === id);
  if (target) {
    try {
      await FileSystem.deleteAsync(target.uri, { idempotent: true });
    } catch {
      // Ignore missing files.
    }
  }
  const next = existing.filter((item) => item.id !== id);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
  return next;
}
