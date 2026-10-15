"use client";

import { useState } from "react";
import type { UiLang, NativeLang, TargetLang } from "../../types";
import type { AuthCredentials } from "../../hooks/useAuth";
import type { ThemeMode } from "../ClientHome";
import { API_BASE } from "../../lib/api";
import { allowedUiLangs } from "../../hooks/useLangConfig";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import styles from "./SettingsView.module.css";

interface SettingsViewProps {
  credentials: AuthCredentials;
  currentScore: number;
  goalScore: number;
  goalDate: string;
  theme: ThemeMode;
  uiLang: UiLang;
  nativeLang?: NativeLang;
  targetLang: TargetLang;
  onThemeChange: (theme: ThemeMode) => void;
  onUiLangChange: (lang: UiLang) => void;
  onNativeLangChange?: (lang: NativeLang) => void;
  onTargetLangChange: (lang: TargetLang) => void;
  onCredentialsChange: (updates: Partial<AuthCredentials>) => void;
  onCurrentScoreChange: (score: number) => void;
  onGoalScoreChange: (score: number) => void;
  onGoalDateChange: (date: string) => void;
  onRegister?: () => void;
  onLogin?: () => void;
  onLogout?: () => void;
  onApplyNinetyDayGoal: () => void;
  onSaveGoal: () => void;
}

const UI_LANG_LABEL: Record<string, string> = { zh: "中文", ja: "日本語" };

export function SettingsView(props: SettingsViewProps) {
  const {
    credentials, currentScore, goalScore, goalDate, theme, uiLang, targetLang,
    onThemeChange, onUiLangChange, onTargetLangChange,
    onCurrentScoreChange, onGoalScoreChange, onGoalDateChange,
    onLogout, onApplyNinetyDayGoal, onSaveGoal,
  } = props;
  const ja = uiLang === "ja";
  const l = (zh: string, jaText: string) => (ja ? jaText : zh);
  const allowed = allowedUiLangs(targetLang);
  const [micReset, setMicReset] = useState(false);

  const resetMicMode = () => {
    try { localStorage.removeItem("lb.rec.noParallel"); } catch { /* ignore */ }
    setMicReset(true);
  };

  return (
    <div className={styles.page} data-testid="settings-page">
      <h1 className={styles.pageTitle}>{l("设置", "設定")}</h1>

      <section className={styles.section} aria-labelledby="sec-learning">
        <div className={styles.sectionHead}>
          <h2 id="sec-learning" className={styles.sectionTitle}>{l("学习语言", "学習言語")}</h2>
          <p className={styles.sectionDesc}>{l("选择你正在练习的语言。界面语言会随之调整为合适的组合。", "練習する言語を選びます。表示言語は適切な組み合わせに自動調整されます。")}</p>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.rowTitle}>{l("我要学", "学習対象")}</span>
            <span className={styles.rowHint}>{l("跟读材料、词汇和语音识别都会切换", "教材・語彙・音声認識が切り替わります")}</span>
          </div>
          <div className={styles.segmented} role="group" aria-label={l("学习语言", "学習言語")}>
            <button type="button" className={styles.segBtn} aria-pressed={targetLang === "en"} onClick={() => onTargetLangChange("en")}>
              🇺🇸 {l("英语（TOEIC）", "英語（TOEIC）")}
            </button>
            <button type="button" className={styles.segBtn} aria-pressed={targetLang === "ja"} onClick={() => onTargetLangChange("ja")}>
              🇯🇵 {l("日语", "日本語")}
            </button>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.rowTitle}>{l("界面语言", "表示言語")}</span>
            <span className={styles.rowHint}>
              {targetLang === "ja" ? l("学日语时界面使用中文（讲解、翻译均为中文）", "日本語学習時は中国語 UI になります") : l("讲解、翻译和提示所使用的语言", "解説・訳・ヒントの言語")}
            </span>
          </div>
          <div className={styles.segmented} role="group" aria-label={l("界面语言", "表示言語")}>
            {(["zh", "ja"] as const).map((lang) => (
              <button key={lang} type="button" className={styles.segBtn} aria-pressed={uiLang === lang} disabled={!allowed.includes(lang)} onClick={() => onUiLangChange(lang)}>
                {UI_LANG_LABEL[lang]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sec-shadowing">
        <div className={styles.sectionHead}>
          <h2 id="sec-shadowing" className={styles.sectionTitle}>{l("跟读与录音", "シャドーイングと録音")}</h2>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.rowTitle}>{l("录音 + 识别同时进行", "録音と認識の同時実行")}</span>
            <span className={styles.rowHint}>{l("若某些安卓设备无法同时录音和识别，会自动切换为仅识别。点击可重新尝试。", "一部の Android 端末で同時実行できない場合は自動で認識のみになります。再試行できます。")}</span>
          </div>
          <button type="button" className={styles.linkBtn} onClick={resetMicMode}>
            {micReset ? l("已重置 ✓", "リセット済み ✓") : l("重新启用录音回放", "録音再生を再有効化")}
          </button>
        </div>
      </section>

      {targetLang === "en" && (
        <section className={styles.section} aria-labelledby="sec-goal">
          <div className={styles.sectionHead}>
            <h2 id="sec-goal" className={styles.sectionTitle}>{l("TOEIC 目标", "TOEIC 目標")}</h2>
            <p className={styles.sectionDesc}>{l("用于安排每日练习量（可选）", "毎日の練習量の目安に使います（任意）")}</p>
          </div>
          <div className={styles.fields}>
            <Input label={l("当前分数", "現在のスコア")} type="number" min={10} max={990} value={currentScore} onChange={(e) => onCurrentScoreChange(Number(e.target.value) || 10)} />
            <Input label={l("目标分数", "目標スコア")} type="number" min={10} max={990} value={goalScore} onChange={(e) => onGoalScoreChange(Number(e.target.value) || 10)} />
            <Input label={l("考试日期", "試験日")} type="date" value={goalDate} onChange={(e) => onGoalDateChange(e.target.value)} />
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onApplyNinetyDayGoal}>{l("一键设为 90 天后", "90日後に設定")}</Button>
            <Button onClick={onSaveGoal}>{l("保存目标", "目標を保存")}</Button>
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="sec-appearance">
        <div className={styles.sectionHead}>
          <h2 id="sec-appearance" className={styles.sectionTitle}>{l("外观", "外観")}</h2>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}><span className={styles.rowTitle}>{l("主题", "テーマ")}</span></div>
          <div className={styles.segmented} role="group" aria-label={l("主题", "テーマ")}>
            {(["light", "dark", "auto"] as const).map((m) => (
              <button key={m} type="button" className={styles.segBtn} aria-pressed={theme === m} onClick={() => onThemeChange(m)}>
                {m === "light" ? `☀️ ${l("浅色", "ライト")}` : m === "dark" ? `🌙 ${l("深色", "ダーク")}` : `💻 ${l("跟随系统", "自動")}`}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sec-account">
        <div className={styles.sectionHead}>
          <h2 id="sec-account" className={styles.sectionTitle}>{l("账户", "アカウント")}</h2>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.rowTitle}>{credentials.displayName || l("已登录", "ログイン中")}</span>
            <span className={styles.rowHint}>{credentials.email}</span>
          </div>
          {onLogout && <button type="button" className={styles.linkBtn} onClick={onLogout}>{l("退出登录", "ログアウト")}</button>}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sec-about">
        <div className={styles.sectionHead}>
          <h2 id="sec-about" className={styles.sectionTitle}>{l("关于", "このアプリについて")}</h2>
        </div>
        <div className={styles.row}>
          <span className={styles.rowHint}>API</span>
          <span className={styles.mono}>{API_BASE}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowHint}>{l("推荐浏览器", "推奨ブラウザ")}</span>
          <span className={styles.value}>{l("Android / 桌面版 Chrome", "Android / PC版 Chrome")}</span>
        </div>
      </section>
    </div>
  );
}
