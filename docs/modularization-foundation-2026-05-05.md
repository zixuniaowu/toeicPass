# 模块化基础收口 2026-05-05

## 本轮落地结果

- 应用层不再通过 `tsconfig paths` 和测试别名直连 `packages/*/src`，而是通过 workspace 包出口消费内部模块。
- 根仓库新增统一模块命令：`build:packages`、`typecheck:packages`、`dev:packages`。
- 可复用包统一继承 `tsconfig.package-base.json`，减少重复配置和漂移。
- `@toeicpass/shared` 补齐了 `exports`，和其他可复用包保持同一边界模型。
- `apps/api` 与 `apps/web` 现在显式声明了对内部模块的依赖，宿主与积木的关系从“约定”变成“依赖事实”。

这一步不是最终的模块化完成态，但它把最关键的一层立住了：之后抽出来的模块会先是“包”，再是“代码片段”。

## 现在最合理的工具组合

当前阶段建议继续采用下面这组工具，而不是马上引入更重的 monorepo 平台：

1. `npm workspaces`
2. `package exports`
3. `TypeScript tsc`
4. `concurrently`

原因很直接：

- 这个仓库已经有多个可复用包，但包数量还没有多到必须上 `Nx` 或 `Turborepo` 才能活下去。
- 现在最大的痛点不是任务图缓存，而是模块边界没有真正站稳；先把边界做对，比先上复杂工具更值钱。
- `tsc` 对当前这些包足够稳定，特别是 `@toeicpass/conversation-ai`、`@toeicpass/ad-system` 这种同时有后端入口和 React 入口的结构，继续用 `tsc` 的成本和风险都最低。
- `concurrently` 已经在仓库里，拿来补包级 watch 足够，不需要为了开发并发再引入一层工具。

## 什么时候再引入 Turborepo

当下面任意一条成立时，再引入 `Turborepo` 会比较合理：

- 可复用包增长到 8 个以上。
- CI 因为重复构建包和应用而明显变慢。
- 同一轮开发经常只改 1 个包，却要重复跑整仓构建。
- 需要远程缓存或更清晰的任务依赖图。

到那个阶段，建议是：

1. 保留 `npm workspaces` 作为包管理基础。
2. 把 `Turborepo` 只引入为任务编排和缓存层。
3. 不要现在就切到 `Nx`，除非团队明确需要更强的生成器、约束规则和治理平台。

## 下一批最值得拆成积木的模块

### 1. Shadowing 模块

当前主耦合点：`apps/web/components/shadowing/ShadowingView.tsx`，约 1228 行。

建议拆成：

- `@toeicpass/shadowing-core`
- `@toeicpass/shadowing-react`

先抽的边界：

- 内容适配器：YouTube / 新闻 / 本地材料统一成同一输入接口。
- 语音适配器：录音、识别、合成语音不要直接绑在页面组件里。
- 练习状态机：句子切换、完成状态、播放控制、纠音结果归一化。

这样以后你做新的语言训练系统时，可以直接复用 shadowing 核心，不必带走当前页面的 UI 细节。

### 2. Learning Core 模块

当前主耦合点：`apps/api/src/services/learning-domain.service.ts`，约 2049 行。

建议拆成：

- `@toeicpass/learning-session-core`
- `@toeicpass/study-plan-core`
- `@toeicpass/mistake-review-core`

先抽的边界：

- 题目筛选和选题策略
- attempt / submit / scoring 流程
- 学习计划生成
- 错题复练排序逻辑

需要保留在宿主应用里的内容：

- `RequestContext`
- NestJS controller / guard / interceptor
- tenant / user / audit 的接入层

也就是说，领域规则抽出去，平台上下文留在宿主里。

### 3. Question Bank / Audit 模块

当前主耦合点集中在题库脚本和题目策略文件，例如：

- `apps/api/src/question-policy.ts`
- `apps/api/scripts/audit-question-quality.ts`
- `apps/api/scripts/add-questions.js`

建议拆成：

- `@toeicpass/question-bank-core`
- `@toeicpass/question-quality-audit`

这类模块适合后续给别的考试系统复用，因为它们更偏内容规则，不依赖当前产品壳层。

## 拆分原则

后续继续模块化时，建议只拆满足下面条件的代码：

1. 宿主无关：离开当前 NestJS / Next.js 壳层仍然成立。
2. 输入输出稳定：可以定义清晰接口，而不是靠共享全局状态。
3. 复用场景明确：新系统确实会复用，而不是“也许以后会用”。
4. 能独立构建和类型检查：拆出来后必须能单独验证。

如果一个功能暂时还强依赖 tenant、HTTP、页面结构，就先在应用内继续拆服务或 hook，不急着升格为 package。