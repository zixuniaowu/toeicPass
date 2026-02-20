"use client";

import Link from "next/link";
import type { AuthCredentials } from "../../hooks/useAuth";
import { API_BASE } from "../../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import styles from "./SettingsView.module.css";

interface SettingsViewProps {
  credentials: AuthCredentials;
  goalScore: number;
  goalDate: string;
  onCredentialsChange: (updates: Partial<AuthCredentials>) => void;
  onGoalScoreChange: (score: number) => void;
  onGoalDateChange: (date: string) => void;
  onRegister: () => void;
  onLogin: () => void;
  onSaveGoal: () => void;
}

export function SettingsView({
  credentials,
  goalScore,
  goalDate,
  onCredentialsChange,
  onGoalScoreChange,
  onGoalDateChange,
  onRegister,
  onLogin,
  onSaveGoal,
}: SettingsViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">账户与目标设置</CardTitle>
      </CardHeader>

      <CardContent>
        <div className={styles.grid}>
          <div className={styles.box}>
            <h3>账户</h3>
            <Input
              label="Tenant Code"
              value={credentials.tenantCode}
              onChange={(e) => onCredentialsChange({ tenantCode: e.target.value })}
            />
            <Input
              label="Tenant Name"
              value={credentials.tenantName}
              onChange={(e) => onCredentialsChange({ tenantName: e.target.value })}
            />
            <Input
              label="Display Name"
              value={credentials.displayName}
              onChange={(e) => onCredentialsChange({ displayName: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={credentials.email}
              onChange={(e) => onCredentialsChange({ email: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              value={credentials.password}
              onChange={(e) => onCredentialsChange({ password: e.target.value })}
            />
            <div className={styles.actions}>
              <Button onClick={onRegister}>注册</Button>
              <Button variant="secondary" onClick={onLogin}>
                登录
              </Button>
            </div>
          </div>

          <div className={styles.box}>
            <h3>目标</h3>
            <Input
              label="目标分数"
              type="number"
              min={10}
              max={990}
              value={goalScore}
              onChange={(e) => onGoalScoreChange(Number(e.target.value) || 10)}
            />
            <Input
              label="考试日期"
              type="date"
              value={goalDate}
              onChange={(e) => onGoalDateChange(e.target.value)}
            />
            <Button onClick={onSaveGoal}>保存目标</Button>
          </div>
        </div>

        <div className={styles.box}>
          <h3>系统状态</h3>
          <ul className={styles.statusList}>
            <li>
              <span>Web</span>
              <strong>:8000</strong>
            </li>
            <li>
              <span>API</span>
              <strong>:8001</strong>
            </li>
            <li>
              <span>API Base</span>
              <strong className={styles.mono}>{API_BASE}</strong>
            </li>
            <li>
              <span>Official Audio</span>
              <a href="https://www.toeic.com.hk/Track/" target="_blank" rel="noreferrer">
                toeic.com.hk
              </a>
            </li>
            <li>
              <span>IP API</span>
              <Link href="/api-guide">查看端点</Link>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
