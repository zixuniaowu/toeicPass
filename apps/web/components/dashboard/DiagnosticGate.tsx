"use client";

import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import styles from "./DiagnosticGate.module.css";

interface DiagnosticGateProps {
  onStartDiagnostic: () => void;
}

export function DiagnosticGate({ onStartDiagnostic }: DiagnosticGateProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">先完成自测，再生成计划</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={styles.panel}>
          <p className={styles.lead}>当前账号还没有完成基线自测。先做一次 20 题诊断，系统再给你 7 天计划与每日 60 分钟打卡。</p>
          <ul className={styles.list}>
            <li>题量：20 题（听读混合）</li>
            <li>目标：拿到弱项分布与起点分数</li>
            <li>完成后：自动进入错题强化，并开启个性化计划</li>
          </ul>
          <Button onClick={onStartDiagnostic}>开始 20 题自测</Button>
        </div>
      </CardContent>
    </Card>
  );
}
