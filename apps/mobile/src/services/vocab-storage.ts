import AsyncStorage from "@react-native-async-storage/async-storage";
import { createInitialProgress, sm2Grade, type CardProgress } from "./sm2";

type ProgressMap = Record<string, CardProgress>;

const STORAGE_KEY = "toeicpass.vocab-progress.v1";

export async function loadProgress(): Promise<ProgressMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export async function saveProgress(map: ProgressMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getGradeCounts(progress: ProgressMap, now: number = Date.now()) {
  let due = 0;
  let learning = 0;
  let mastered = 0;
  for (const p of Object.values(progress)) {
    if (!p.lastGrade) continue;
    if (p.intervalDays >= 14 && (p.lastGrade ?? 0) >= 4) {
      mastered++;
    } else if (p.dueAt <= now) {
      due++;
    } else {
      learning++;
    }
  }
  return { due, learning, mastered };
}

export function getCardProgress(progress: ProgressMap, word: string): CardProgress {
  return progress[word] ?? createInitialProgress();
}

export function gradeCard(
  progress: ProgressMap,
  word: string,
  grade: 1 | 3 | 5,
  now: number = Date.now(),
): ProgressMap {
  const current = getCardProgress(progress, word);
  const updated = sm2Grade(current, grade, now);
  return { ...progress, [word]: updated };
}
