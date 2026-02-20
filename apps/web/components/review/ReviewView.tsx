"use client";

import type { SubmitReport, ReviewItem } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { AudioPlayer } from "../ui/AudioPlayer";
import styles from "./ReviewView.module.css";

interface ReviewViewProps {
  sessionResult: SubmitReport | null;
  onLoadDueCards: () => void;
}

export function ReviewView({ sessionResult, onLoadDueCards }: ReviewViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">复盘中心</CardTitle>
        <Button variant="secondary" onClick={onLoadDueCards}>
          载入到期错题
        </Button>
      </CardHeader>

      <CardContent>
        {!sessionResult && (
          <p className={styles.empty}>先完成一次训练提交，这里会显示逐题解析和回放。</p>
        )}

        {sessionResult && (
          <>
            <div className={styles.summary}>
              <p>
                总分 {sessionResult.scoreTotal} (L{sessionResult.scoreL} / R{sessionResult.scoreR})
              </p>
              <p>
                答对 {sessionResult.correct} / {sessionResult.answered}
              </p>
            </div>

            <div className={styles.list}>
              {sessionResult.review.map((item, idx) => (
                <ReviewItemCard key={`${item.questionId}-${idx}`} item={item} index={idx} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ReviewItemCardProps {
  item: ReviewItem;
  index: number;
}

function ReviewItemCard({ item, index }: ReviewItemCardProps) {
  return (
    <div className={styles.item}>
      <div className={styles.itemHeader}>
        <strong>Q{index + 1} · Part {item.partNo}</strong>
        <Badge variant={item.isCorrect ? "success" : "error"}>
          {item.isCorrect ? "正确" : "错误"}
        </Badge>
      </div>

      {item.imageUrl && item.partNo === 1 && (
        <div className={styles.imageWrap}>
          <img src={item.imageUrl} alt={`Part ${item.partNo ?? 0} visual`} className={styles.image} />
        </div>
      )}

      {item.mediaUrl && (item.partNo ?? 0) <= 4 && (
        <AudioPlayer src={item.mediaUrl} label="听力回放" compact />
      )}

      <p className={styles.stem}>{item.stem}</p>
      <p className={styles.answer}>
        你的答案: {item.selectedKey ?? "未作答"} | 正确答案: {item.correctKey ?? "-"}
      </p>
      <p className={styles.explanation}>解析: {item.explanation}</p>
    </div>
  );
}
