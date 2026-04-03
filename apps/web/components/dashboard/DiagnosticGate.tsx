"use client";

import type { Locale } from "../../types";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import styles from "./DiagnosticGate.module.css";

const COPY = {
  zh: {
    title: "先完成自测，再生成计划",
    lead: "当前账号还没有完成基线自测。先做一次 20 题诊断，系统再给你 7 天计划与每日 60 分钟打卡。",
    item1: "题量：20 题（听读混合）",
    item2: "目标：拿到弱项分布与起点分数",
    item3: "完成后：自动进入错题强化，并开启个性化计划",
    start: "开始 20 题自测",
  },
  ja: {
    title: "まず自己診断を完了してください",
    lead: "まだベースライン診断が完了していません。20問の診断を受けて、7日間の学習プランを作成しましょう。",
    item1: "問題数：20問（リスニング＋リーディング）",
    item2: "目標：弱点の分布と現在のスコアを把握",
    item3: "完了後：間違い強化と個別プランが自動で開始されます",
    start: "20問の診断を開始",
  },
} as const;

interface DiagnosticGateProps {
  locale?: Locale;
  onStartDiagnostic: () => void;
}

export function DiagnosticGate({ locale = "zh", onStartDiagnostic }: DiagnosticGateProps) {
  const t = COPY[locale];
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={styles.panel}>
          <p className={styles.lead}>{t.lead}</p>
          <ul className={styles.list}>
            <li>{t.item1}</li>
            <li>{t.item2}</li>
            <li>{t.item3}</li>
          </ul>
          <Button onClick={onStartDiagnostic}>{t.start}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
