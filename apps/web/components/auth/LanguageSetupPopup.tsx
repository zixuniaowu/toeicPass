"use client";

import type { UiLang, TargetLang } from "../../types";
import styles from "./LanguageSetupPopup.module.css";

interface LanguageSetupPopupProps {
  onConfirm: (uiLang: UiLang, targetLang: TargetLang) => void;
}

const OPTIONS: { target: TargetLang; ui: UiLang; flag: string; label: string; desc: string }[] = [
  { target: "en", ui: "zh", flag: "🇺🇸", label: "我要学英语（TOEIC）", desc: "英语跟读 · 发音纠正 · 词根词汇" },
  { target: "ja", ui: "zh", flag: "🇯🇵", label: "我要学日语", desc: "日语跟读 · 发音纠正 · 商务/日常/IT 日语" },
  { target: "ja", ui: "en", flag: "🇬🇧", label: "I'm learning Japanese (English UI)", desc: "Japanese shadowing · pronunciation feedback · business / daily / IT Japanese" },
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
              key={`${opt.target}-${opt.ui}`}
              type="button"
              className={styles.optionBtn}
              onClick={() => onConfirm(opt.ui, opt.target)}
            >
              <span className={styles.optionFlag}>{opt.flag}</span>
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{opt.label}</span>
                <span className={styles.optionDesc}>{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <p className={styles.footnote}>界面语言可之后在「设置」中修改。 · You can change the UI language later in Settings.</p>
      </div>
    </div>
  );
}
