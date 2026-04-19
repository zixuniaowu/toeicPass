"use client";

import { useState } from "react";
import type { UiLang, TargetLang } from "../../types";
import styles from "./LanguageSetupPopup.module.css";

interface LanguageSetupPopupProps {
  onConfirm: (uiLang: UiLang, targetLang: TargetLang) => void;
}

const LANG_OPTIONS: { value: UiLang; flag: string; label: string; desc: string }[] = [
  { value: "zh", flag: "🇨🇳", label: "中文", desc: "Chinese" },
  { value: "ja", flag: "🇯🇵", label: "日本語", desc: "Japanese" },
  { value: "en", flag: "🇺🇸", label: "English", desc: "English" },
];

const TARGET_OPTIONS: { value: TargetLang; flag: string; label: string }[] = [
  { value: "en", flag: "🇺🇸", label: "English" },
  { value: "ja", flag: "🇯🇵", label: "日本語 (Japanese)" },
];

export function LanguageSetupPopup({ onConfirm }: LanguageSetupPopupProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLang, setSelectedLang] = useState<UiLang | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetLang | null>(null);

  const handleLangSelect = (lang: UiLang) => {
    setSelectedLang(lang);
    // Auto-suggest target: if native is en → target ja, otherwise target en
    setSelectedTarget(lang === "en" ? "ja" : "en");
    setStep(2);
  };

  const handleConfirm = () => {
    if (selectedLang && selectedTarget) {
      onConfirm(selectedLang, selectedTarget);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        {step === 1 && (
          <>
            <h2 className={styles.title}>Welcome to LangBoost</h2>
            <p className={styles.subtitle}>What is your native language?</p>
            <div className={styles.options}>
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={styles.optionBtn}
                  onClick={() => handleLangSelect(opt.value)}
                >
                  <span className={styles.optionFlag}>{opt.flag}</span>
                  <span className={styles.optionLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className={styles.title}>
              {selectedLang === "zh" ? "你想学什么语言？" : selectedLang === "ja" ? "何を学びますか？" : "What do you want to learn?"}
            </h2>
            <div className={styles.options}>
              {TARGET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.optionBtn} ${selectedTarget === opt.value ? styles.optionBtnActive : ""}`}
                  onClick={() => setSelectedTarget(opt.value)}
                >
                  <span className={styles.optionFlag}>{opt.flag}</span>
                  <span className={styles.optionLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep(1)}>
                ← {selectedLang === "zh" ? "返回" : selectedLang === "ja" ? "戻る" : "Back"}
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleConfirm}
                disabled={!selectedTarget}
              >
                {selectedLang === "zh" ? "开始学习" : selectedLang === "ja" ? "学習を始める" : "Start Learning"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
