"use client";

import type { AuthCredentials } from "../../hooks/useAuth";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import styles from "./LoginView.module.css";

interface LoginViewProps {
  credentials: AuthCredentials;
  isSubmitting: boolean;
  message: string;
  onCredentialsChange: (updates: Partial<AuthCredentials>) => void;
  onLogin: () => void;
  onRegister: () => void;
}

export function LoginView({
  credentials,
  isSubmitting,
  message,
  onCredentialsChange,
  onLogin,
  onRegister,
}: LoginViewProps) {
  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <CardTitle as="h1">登录 toeicPass</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={styles.loginGrid}>
            <Input
              label="Email"
              type="email"
              value={credentials.email}
              onChange={(e) => onCredentialsChange({ email: e.target.value })}
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={credentials.password}
              onChange={(e) => onCredentialsChange({ password: e.target.value })}
              autoComplete="current-password"
            />
          </div>

          <div className={styles.loginAction}>
            <Button onClick={onLogin} disabled={isSubmitting} fullWidth>
              {isSubmitting ? "处理中..." : "登录"}
            </Button>
          </div>

          <details className={styles.advanced}>
            <summary>组织信息（仅注册或多租户登录时填写）</summary>
            <div className={styles.grid}>
              <Input
                label="Tenant Code"
                value={credentials.tenantCode}
                onChange={(e) => onCredentialsChange({ tenantCode: e.target.value })}
                autoComplete="organization"
              />
              <Input
                label="Tenant Name（注册用）"
                value={credentials.tenantName}
                onChange={(e) => onCredentialsChange({ tenantName: e.target.value })}
                autoComplete="organization-title"
              />
              <Input
                label="Display Name（注册用）"
                value={credentials.displayName}
                onChange={(e) => onCredentialsChange({ displayName: e.target.value })}
                autoComplete="name"
              />
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={onRegister} disabled={isSubmitting} fullWidth>
                {isSubmitting ? "处理中..." : "注册并登录"}
              </Button>
            </div>
            <p className={styles.tip}>注册会使用上方填写的 Email 和 Password。</p>
          </details>

          <p className={styles.tip}>
            默认登录只需要 Email + Password。Tenant Code 仅在多租户账号或注册时需要。
          </p>
          <p className={styles.tip}>
            注意：`demo / owner@demo.com` 常用于调试，通常包含历史数据，不适合作为第一天学习账号。
          </p>
          <p className={styles.message}>{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
