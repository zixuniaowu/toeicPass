# toeicPass 第一性原理报告（2026-05-05）

## 1. 项目最小目标

从第一性原理看，`toeicPass` 的核心不是“做一个多语言网站”，而是完成下面这条学习闭环：

1. 用户明确自己的 `UI 语言 / 母语 / 学习目标语言`
2. 系统据此提供正确的学习内容入口
3. 用户完成练习
4. 系统返回可执行反馈
5. 反馈进入复习、错题、词汇和后续推荐

只要这 5 步里有任何一步没有真正受 `targetLang` 驱动，多语言能力就只是“界面翻译”，而不是“目标语言学习系统”。

## 2. 当前系统真实状态

### 已经成立的基础层

- `packages/shared` 已有 `UiLang`、`NativeLang`、`TargetLang`、`LangConfig`
- `apps/web/lib/i18n.ts` 已有 `createT()`
- `apps/web/hooks/useLangConfig.ts` 已能持久化三维语言配置
- `TopBar`、`SettingsView`、`ClientHome` 已具备 UI 语言 / 目标语言的控制链路
- `Locale` deprecated alias 已保留，旧组件还能继续运行

结论：语言配置基础设施不是当前瓶颈，内容和功能接入才是瓶颈。

### 本轮完成的关键闭环修复

#### A. 顶栏语言控制真正生效

- `TopBar` 现在实际渲染 UI 语言与目标语言切换
- 已补回归测试，覆盖渲染、切换和 `aria-pressed` 状态

#### B. 英语母语者首次引导流程真正上线

- `LanguageSetupPopup` 原本已存在，但未接入任何页面
- 现已在 `ClientHome` 中接入 `isFirstVisit` / `setLangConfig`
- 首次访问时会强制完成 UI 语言与目标语言选择，再进入系统

#### C. Conversation AI 不再是“仅英语模式”

- `@toeicpass/conversation-ai` 场景增加 `targetLanguage`
- 新增日语会话场景
- Gemini system prompt 已按英语 / 日语分流
- rule-based fallback 已按英语 / 日语分流
- 前端会按 `targetLang` 过滤场景，并切换语音识别 / 语音播放语言

结论：会话练习现在已经从“固定英语”升级为“受目标语言驱动的功能模块”。

## 3. 仍然阻塞系统演进的真实瓶颈

### 3.1 内容模型仍未完全统一

手工维护的 Shadowing / News 种子数据仍大量使用：

- `titleCn`
- `translation`

而不是统一的：

```ts
translations: {
  zh: string;
  ja: string;
  en: string;
}
```

TED / Japanese YouTube 的生成 snapshot 已经迁移到统一 `translations` 结构，但剩余手工种子内容还没有完全跟上。

这意味着：

- `targetLang` 还不能在全部内容源上稳定驱动展示
- 组件内部不得不做额外兼容逻辑
- 后续增加英文 UI 或更多目标语言时，迁移成本会继续上升

### 3.2 文案体系仍然分裂

仓库里仍有 11 个组件保留本地 `COPY` 常量。

这会造成三个问题：

1. 新语言无法通过词典统一接入
2. 文案修改无法一次完成
3. `uiLang` 只是“部分组件可用”的能力，不是平台级能力

### 3.3 Writing 已形成基础双语链路，并具备稳定 rubric

`ClientHome` 中的 `writing` 入口已经可以进入 `WritingView`，并且前后端已按 `targetLang` 做了基础分流：日语目标下会切换文案、计数单位，并走独立的确定性 rubric 评估分支；当前结果还会返回总评、rubric breakdown、next step、更细粒度的 `focusSignals`、drill checklist、revision prompt、可直接套用的 `sentenceFrames`，以及基于 `focusArea` 导向 grammar / vocab / shadowing 的后续训练入口。

这说明写作模块当前的真实状态不是“缺入口”，而是“基础双语链路、稳定评分、结构化反馈、细粒度诊断、改写指令、句型骨架和基础训练导流已建立，但 prompt、训练素材和更深的专项反馈仍需继续增强”。

### 3.4 日语内容层仍缺核心资产

目前仍缺：

- JLPT 词汇已完成首批 N5/N4/N3 卡包，且当前 deck 已补成 `zh` / `ja` / `en` 三语结构；N2/N1 尚未接入
- JLPT 文法已具备最小卡片链路，但还不是完整训练体系
- 日语阅读已具备最小 passage + furigana 视图，但还不是完整答题训练体系
- JLPT 模拟考试
- 与上述内容配套的 dashboard / 推荐逻辑

结论：系统已经具备多语言骨架，并且日语词汇已经打通第一条真实内容链路，当前首批 JLPT deck 也具备了三语结构；但日语学习产品仍未形成完整的内容供给层。

## 4. 优先级判断

从第一性原理看，接下来的顺序不应是“先把所有新功能都加上”，而应是：

### Priority 1: 完成剩余内容结构统一

在已完成 Shadowing / News 应用层迁移、TED / Japanese YouTube snapshot 生成产物迁移、并为 Vocab 接入 `translations.definition/example` 结构的基础上，继续把剩余手工 Shadowing / News 种子与 Vocab 内容统一到同一套多语字段。

原因：如果剩余手工种子内容和 Vocab 仍停留在旧结构，`targetLang` 仍会被兼容逻辑拖住，内容分发无法彻底稳定。

### Priority 2: 提升 Writing 双语反馈深度

在已打通 `targetLang` 基础分流、稳定 rubric、结构化反馈、改写指令和基础训练导流的前提下，继续增强英语 / 日语写作的 prompt、反馈深度与训练素材联动。

原因：写作入口、稳定评分和基础 coaching 结构已经恢复，但反馈深度与内容联动仍不足以支撑更完整的长期学习闭环，仍是当前明显的能力短板之一。

### Priority 3: 清空剩余 COPY 组件

把分散在组件内的 `COPY` 迁回 `t()`。

原因：不统一文案层，就无法稳定支持 `uiLang = en` 的全局体验。

### Priority 4: 继续补日语学习资产

在当前已接入且已补成三语结构的 JLPT N5/N4/N3 词汇链路、最小 JLPT 文法卡片链路和最小 JLPT 阅读链路上，继续补 N2/N1、更完整的文法训练、阅读答题闭环与模拟。

原因：否则会把新内容继续堆到旧结构上，技术债只会扩大。

## 5. 本轮验证结果

已完成验证：

- Web focused test: `npm -w apps/web exec vitest run test/TopBar.test.tsx`
- Web focused test: `npm -w apps/web exec vitest run test/ClientHome.onboarding.test.tsx`
- API E2E: `npm -w apps/api exec -- jest --config ./test/jest-e2e.json test/conversation.e2e-spec.ts --runInBand`

本轮新增或确认通过的关键行为：

- TopBar 的三语 UI / 目标语言切换
- 首次访问语言引导流程
- Conversation API 的日语场景与日语回复

## 6. 最终判断

`toeicPass` 当前最重要的事实不是“缺少多语言框架”，而是：

- 框架层已经基本具备
- 控制层已经开始围绕 `LangConfig` 收敛
- 真正拖慢项目的是内容结构不统一，以及少数功能链路没有被 `targetLang` 真正接管

因此，后续开发应坚持一个判断标准：

> 每加一个多语言功能，都要检查它是否真的让 `targetLang` 改变了内容、交互或反馈；如果没有，它就还不是完成态。