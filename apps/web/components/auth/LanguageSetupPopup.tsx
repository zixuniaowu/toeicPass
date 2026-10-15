"use client";

import type { UiLang, TargetLang } from "../../types";
import styles from "./LanguageSetupPopup.module.css";

interface LanguageSetupPopupProps {
  onConfirm: (uiLang: UiLang, targetLang: TargetLang) => void;
}

const OPTIONS: { target: TargetLang; flag: string; label: string; desc: string }[] = [
  { target: "en", flag: "🇺🇸", label: "我要学英语（TOEIC）", desc: "英语跟读 · 发音纠正 · 词根词汇" },
  { target: "ja", flag: "🇯🇵", label: "我要学日语", desc: "日语跟读 · 发音纠正 · 商务/日常/IT 日语" },
];

/** First-run choice: what am I learning? The UI language defaults to Chinese. */
export function LanguageSetupPopup({ onConfirm }: LanguageSetupPopupProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="lang-setup-title">
      <div className={styles.popup}>
        <h2 id="lang-setup-title" className={styles.title}>欢迎使用 toeicPass 跟读训练</h2>
        <p className={styles.subtitle}>你想练习哪种语言？</p>
        <div className={styles.options}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.target}
              type="button"
              className={styles.optionBtn}
              onClick={() => onConfirm("zh", opt.target)}
            >
              <span className={styles.optionFlag}>{opt.flag}</span>
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{opt.label}</span>
                <span className={styles.optionDesc}>{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <p className={styles.footnote}>界面语言默认中文，之后可在「设置」中修改。</p>
      </div>
    </div>
  );
}
