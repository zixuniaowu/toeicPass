"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdPlacement, AdStats } from "../../src/types";
import type { AdManagerViewProps, AdminAdApiFunctions } from "../types";
import styles from "./AdManagerView.module.css";

const SLOT_OPTIONS = ["banner_top", "interstitial", "native_feed", "reward_video"] as const;
const PLAN_OPTIONS = ["free", "basic", "premium", "enterprise"] as const;

const COPY = {
  zh: {
    title: "广告管理",
    subtitle: "管理广告位、查看投放效果",
    statsTitle: "数据概览",
    totalPlacements: "广告位总数",
    activePlacements: "活跃广告",
    totalImpressions: "总展示量",
    totalClicks: "总点击量",
    ctr: "点击率",
    slotBreakdown: "分类统计",
    recentEvents: "最近事件",
    adList: "广告列表",
    createAd: "新建广告",
    editAd: "编辑",
    deleteAd: "删除",
    save: "保存",
    cancel: "取消",
    slot: "广告位",
    adTitle: "标题",
    imageUrl: "图片URL",
    linkUrl: "链接URL",
    ctaText: "按钮文案",
    priority: "优先级",
    targetPlans: "目标计划",
    isActive: "启用",
    startsAt: "开始时间",
    expiresAt: "结束时间",
    impressions: "展示",
    clicks: "点击",
    confirmDelete: "确定要删除这条广告吗？",
    noAds: "还没有广告。点击「新建广告」开始。",
    loading: "加载中...",
    slotLabels: { banner_top: "顶部横幅", interstitial: "插页广告", native_feed: "信息流", reward_video: "激励视频" } as Record<string, string>,
    eventTypes: { impression: "展示", click: "点击", dismiss: "关闭", reward_complete: "激励完成" } as Record<string, string>,
  },
  ja: {
    title: "広告管理",
    subtitle: "広告枠を管理し、配信効果を確認",
    statsTitle: "データ概要",
    totalPlacements: "広告枠合計",
    activePlacements: "アクティブ広告",
    totalImpressions: "総インプレッション",
    totalClicks: "総クリック",
    ctr: "CTR",
    slotBreakdown: "スロット別統計",
    recentEvents: "最近のイベント",
    adList: "広告一覧",
    createAd: "新規作成",
    editAd: "編集",
    deleteAd: "削除",
    save: "保存",
    cancel: "キャンセル",
    slot: "スロット",
    adTitle: "タイトル",
    imageUrl: "画像URL",
    linkUrl: "リンクURL",
    ctaText: "CTAテキスト",
    priority: "優先度",
    targetPlans: "対象プラン",
    isActive: "有効",
    startsAt: "開始日時",
    expiresAt: "終了日時",
    impressions: "表示",
    clicks: "クリック",
    confirmDelete: "この広告を削除してもよろしいですか？",
    noAds: "広告がまだありません。「新規作成」をクリックしてください。",
    loading: "読み込み中...",
    slotLabels: { banner_top: "トップバナー", interstitial: "インタースティシャル", native_feed: "ネイティブフィード", reward_video: "リワード動画" } as Record<string, string>,
    eventTypes: { impression: "表示", click: "クリック", dismiss: "閉じる", reward_complete: "リワード完了" } as Record<string, string>,
  },
} as const;

interface AdFormData {
  slot: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  ctaText: string;
  priority: number;
  targetPlans: string[];
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
}

const emptyForm: AdFormData = {
  slot: "banner_top",
  title: "",
  imageUrl: "",
  linkUrl: "",
  ctaText: "",
  priority: 50,
  targetPlans: ["free"],
  isActive: true,
  startsAt: "",
  expiresAt: "",
};

export function AdManagerView({ locale, api }: AdManagerViewProps) {
  const copy = COPY[locale];

  const [ads, setAds] = useState<AdPlacement[]>([]);
  const [stats, setStats] = useState<AdStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<AdFormData>({ ...emptyForm });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [adList, adStats] = await Promise.all([
      api.fetchAdminAds(),
      api.fetchAdStats(),
    ]);
    setAds(adList);
    setStats(adStats);
    setIsLoading(false);
  }, [api]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async () => {
    const ad = await api.createAd({
      slot: form.slot,
      title: form.title,
      imageUrl: form.imageUrl || undefined,
      linkUrl: form.linkUrl,
      ctaText: form.ctaText,
      priority: form.priority,
      targetPlans: form.targetPlans,
      startsAt: form.startsAt || undefined,
      expiresAt: form.expiresAt || undefined,
    });
    if (ad) {
      setShowCreate(false);
      setForm({ ...emptyForm });
      void loadData();
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await api.updateAd(editingId, {
      slot: form.slot,
      title: form.title,
      imageUrl: form.imageUrl || undefined,
      linkUrl: form.linkUrl,
      ctaText: form.ctaText,
      priority: form.priority,
      targetPlans: form.targetPlans,
      isActive: form.isActive,
      startsAt: form.startsAt || undefined,
      expiresAt: form.expiresAt || undefined,
    });
    setEditingId(null);
    setForm({ ...emptyForm });
    void loadData();
  };

  const handleDelete = async (adId: string) => {
    if (!confirm(copy.confirmDelete)) return;
    await api.deleteAd(adId);
    void loadData();
  };

  const startEdit = (ad: AdPlacement) => {
    setEditingId(ad.id);
    setShowCreate(false);
    setForm({
      slot: ad.slot,
      title: ad.title,
      imageUrl: ad.imageUrl ?? "",
      linkUrl: ad.linkUrl,
      ctaText: ad.ctaText,
      priority: ad.priority,
      targetPlans: ad.targetPlans as string[],
      isActive: ad.isActive,
      startsAt: ad.startsAt ?? "",
      expiresAt: ad.expiresAt ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowCreate(false);
    setForm({ ...emptyForm });
  };

  const updateField = <K extends keyof AdFormData>(key: K, value: AdFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePlan = (plan: string) => {
    setForm((prev) => ({
      ...prev,
      targetPlans: prev.targetPlans.includes(plan)
        ? prev.targetPlans.filter((p) => p !== plan)
        : [...prev.targetPlans, plan],
    }));
  };

  if (isLoading) {
    return <div className={styles.container}><p>{copy.loading}</p></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{copy.title}</h2>
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{copy.totalPlacements}</span>
            <strong className={styles.statValue}>{stats.totalPlacements}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{copy.activePlacements}</span>
            <strong className={styles.statValue}>{stats.activePlacements}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{copy.totalImpressions}</span>
            <strong className={styles.statValue}>{stats.totalImpressions.toLocaleString()}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{copy.totalClicks}</span>
            <strong className={styles.statValue}>{stats.totalClicks.toLocaleString()}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{copy.ctr}</span>
            <strong className={styles.statValue}>{stats.ctr}%</strong>
          </div>
        </div>
      )}

      {stats && Object.keys(stats.bySlot).length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{copy.slotBreakdown}</h3>
          <div className={styles.slotGrid}>
            {Object.entries(stats.bySlot).map(([slot, data]) => (
              <div key={slot} className={styles.slotCard}>
                <span className={styles.slotName}>{copy.slotLabels[slot] ?? slot}</span>
                <div className={styles.slotStats}>
                  <span>{data.count} ads</span>
                  <span>{copy.impressions}: {data.impressions}</span>
                  <span>{copy.clicks}: {data.clicks}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{copy.adList}</h3>
          <button
            className={styles.createBtn}
            onClick={() => { setShowCreate(true); setEditingId(null); setForm({ ...emptyForm }); }}
          >
            + {copy.createAd}
          </button>
        </div>

        {(showCreate || editingId) && (
          <div className={styles.formCard}>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label>{copy.slot}</label>
                <select value={form.slot} onChange={(e) => updateField("slot", e.target.value)}>
                  {SLOT_OPTIONS.map((s) => (
                    <option key={s} value={s}>{copy.slotLabels[s] ?? s}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label>{copy.adTitle}</label>
                <input value={form.title} onChange={(e) => updateField("title", e.target.value)} />
              </div>
              <div className={styles.formField}>
                <label>{copy.imageUrl}</label>
                <input value={form.imageUrl} onChange={(e) => updateField("imageUrl", e.target.value)} placeholder="https://..." />
              </div>
              <div className={styles.formField}>
                <label>{copy.linkUrl}</label>
                <input value={form.linkUrl} onChange={(e) => updateField("linkUrl", e.target.value)} placeholder="https://..." />
              </div>
              <div className={styles.formField}>
                <label>{copy.ctaText}</label>
                <input value={form.ctaText} onChange={(e) => updateField("ctaText", e.target.value)} />
              </div>
              <div className={styles.formField}>
                <label>{copy.priority}</label>
                <input type="number" value={form.priority} onChange={(e) => updateField("priority", Number(e.target.value))} />
              </div>
              <div className={styles.formField}>
                <label>{copy.targetPlans}</label>
                <div className={styles.checkGroup}>
                  {PLAN_OPTIONS.map((plan) => (
                    <label key={plan} className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={form.targetPlans.includes(plan)}
                        onChange={() => togglePlan(plan)}
                      />
                      {plan}
                    </label>
                  ))}
                </div>
              </div>
              {editingId && (
                <div className={styles.formField}>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => updateField("isActive", e.target.checked)}
                    />
                    {copy.isActive}
                  </label>
                </div>
              )}
              <div className={styles.formField}>
                <label>{copy.startsAt}</label>
                <input type="datetime-local" value={form.startsAt} onChange={(e) => updateField("startsAt", e.target.value)} />
              </div>
              <div className={styles.formField}>
                <label>{copy.expiresAt}</label>
                <input type="datetime-local" value={form.expiresAt} onChange={(e) => updateField("expiresAt", e.target.value)} />
              </div>
            </div>
            <div className={styles.formActions}>
              <button className={styles.saveBtn} onClick={editingId ? handleUpdate : handleCreate}>
                {copy.save}
              </button>
              <button className={styles.cancelBtn} onClick={cancelEdit}>
                {copy.cancel}
              </button>
            </div>
          </div>
        )}

        {ads.length === 0 && !showCreate && (
          <p className={styles.empty}>{copy.noAds}</p>
        )}

        {ads.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{copy.slot}</th>
                  <th>{copy.adTitle}</th>
                  <th>{copy.ctaText}</th>
                  <th>{copy.priority}</th>
                  <th>{copy.targetPlans}</th>
                  <th>{copy.isActive}</th>
                  <th>{copy.impressions}</th>
                  <th>{copy.clicks}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad.id} className={!ad.isActive ? styles.inactive : ""}>
                    <td><span className={styles.slotBadge}>{copy.slotLabels[ad.slot] ?? ad.slot}</span></td>
                    <td>{ad.title}</td>
                    <td>{ad.ctaText}</td>
                    <td>{ad.priority}</td>
                    <td>{(ad.targetPlans as string[]).join(", ")}</td>
                    <td>{ad.isActive ? "✓" : "✗"}</td>
                    <td>{ad.impressions}</td>
                    <td>{ad.clicks}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button className={styles.editBtn} onClick={() => startEdit(ad)}>{copy.editAd}</button>
                        <button className={styles.deleteBtn} onClick={() => void handleDelete(ad.id)}>{copy.deleteAd}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stats && stats.recentEvents.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{copy.recentEvents}</h3>
          <div className={styles.eventList}>
            {stats.recentEvents.slice(0, 20).map((evt) => (
              <div key={evt.id} className={styles.eventItem}>
                <span className={styles.eventType}>{copy.eventTypes[evt.eventType] ?? evt.eventType}</span>
                <span className={styles.eventTime}>{new Date(evt.createdAt).toLocaleString()}</span>
                <span className={styles.eventId}>#{evt.placementId.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
