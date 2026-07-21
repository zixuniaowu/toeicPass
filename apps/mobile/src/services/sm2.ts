export type CardProgress = {
  easeFactor: number;
  intervalDays: number;
  dueAt: number; // timestamp ms
  lastGrade: 1 | 3 | 5 | null;
};

const INITIAL_EF = 2.5;
const MIN_EF = 1.3;

export function createInitialProgress(): CardProgress {
  return { easeFactor: INITIAL_EF, intervalDays: 0, dueAt: 0, lastGrade: null };
}

export function sm2Grade(
  progress: CardProgress,
  grade: 1 | 3 | 5,
  now: number = Date.now(),
): CardProgress {
  const q = grade;
  const ef = Math.max(MIN_EF, progress.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  let interval: number;
  if (q < 3) {
    interval = 1;
  } else if (progress.lastGrade == null || progress.lastGrade! < 3) {
    interval = 1;
  } else if (progress.intervalDays === 1) {
    interval = 6;
  } else {
    interval = Math.round(progress.intervalDays * ef);
  }

  const dueAt = now + interval * 86400000;

  return { easeFactor: ef, intervalDays: interval, dueAt, lastGrade: grade };
}
