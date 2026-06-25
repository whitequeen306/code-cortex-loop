# CodeCortexLoop

**一条命令，七位领域专家，可自我进化的 Playbook。**

面向 AI 编码工具的「写完代码后」流水线：**正确性 → 安全 → 测试 → 错误处理 → 性能 → 精简 → 清理** —— 配套健康分、HTML 看板、handoff 接力、双语 Playbook、基线棘轮与 CI 集成。

[![健康分徽章](examples/demo-app/.cortexloop/health-badge.svg)](examples/demo-app/docs/cortexloop/report.html)

## 全流程（自建索引 → MAP → Pass 1–7 → 自进化）

在聊天里输入 `/cortexloop` 后，Orchestrator 按固定步骤执行。**磁盘是接力总线**，聊天窗口只做调度；大项目也不会在 Pass 1 之后断链。

```mermaid
flowchart TB
  subgraph prep [准备]
    Q["Step 0 选模式 Report/Direct + scope"]
    P0["Step 0.5 playbook query 召回已验证模式"]
    R1["Step 1 init-run 按运行时间建 run 目录"]
  end

  subgraph index [自建文件索引]
    M1["Step 2a build-scope-manifest scope 落盘"]
    M2["Step 2b CortexScope Index MAP 热点图"]
  end

  subgraph depth [七专家深扫]
    P["Step 3 Pass 1–7 子 agent 串行"]
    CV["Step 3.5 跨 pass defer 回收"]
  end

  subgraph out [产出]
    AGG["Step 4–5 聚合 report + runs 归档"]
    SYNC["Step 5b sync-run-latest 看板/CI 快照"]
  end

  subgraph direct [Direct 可选]
    FIX["分组修复 + 每步测试"]
    RV["re-verify 再跑 Pass 1–7"]
  end

  subgraph evolve [自进化]
    REF["Step 6 reflect 追加 08-reflection"]
    PB["playbook record 写入 playbook.json"]
  end

  NEXT["下次 /cortexloop → Step 0.5 优先 recall"]

  Q --> P0 --> R1 --> M1 --> M2 --> P --> CV --> AGG --> SYNC
  AGG --> FIX --> RV --> REF --> PB --> NEXT
  P0 -.->|"verified 模式"| P
  NEXT -.-> P0
```

| 阶段 | 做什么 | 关键产物 |
|------|--------|----------|
| **0. 启动** | 选 Report / Direct / CI，选 recent / whole | 用户意图 |
| **0.5 召回** | 从 Playbook 查**已验证**修复模式（候选默认不可见） | 调查优先级提示 |
| **1. Run 归档** | `init-run.mjs` 创建 `docs/cortexloop/runs/2026-06-25_14-30/`，**运行时间可读**（如 `2026年6月25日 14:30`） | `.cortexloop/run-meta.json` |
| **2a. Scope 索引** | Git 收集 scope，**路径落盘不进 prompt** | `scope-manifest.json` · `scope-paths.json` |
| **2b. MAP** | **CortexScope Index** 秒级建热点图（churn · import 图 · pattern · 入口启发式）；>100 文件自动启用 | `scope-map.json` |
| **3. Pass 1–7** | 7 路专家**子 agent 串行**；优先 hotspot + mustReview + longTailSample；handoff 落盘 | `{runDir}/01–07*.md` · `.cortexloop/handoff/*.json` |
| **3.5** | 回收跨 pass 孤儿 defer | 补全 handoff |
| **4–5. 报告** | 健康分、findings、HTML 看板；**不覆盖历史 run** | `{runDir}/report.json` · `00-summary.md` |
| **5b. 同步** | 最新 run 复制到 `docs/cortexloop/` 供 CI/徽章 | `report.json`（latest） |
| **Direct** | 按 severity 分组修复 → 测试 → **re-verify** 再扫一遍 | 修复前 → 修复后分数 |
| **6. 自进化** | reflect → **追加** `08-reflection.md` → `playbook record` | `.cortexloop/playbook.json`（下次 Step 0.5 用） |

**闭环一句话：** 自建 scope/MAP 索引告诉专家「先查哪」→ 七 pass 深扫并归档 → Direct 修完复验 → Playbook 记住模式 → **下次运行先 recall，再索引、再 MAP、再 Pass**。

推荐首次使用：**Report 看分与报告 → 认可后再 Direct**。

---

## 核心能力

| 能力 | 说明 |
|------|------|
| **七专家串行** | Orchestrator 调度 7 路独立专家（Cursor/Claude/OpenCode：`Task`；Qoder：`Agent`；Trae：SOLO 委派） |
| **健康分 0–100** | 七维打分 + 总分；Direct 模式输出 **修复前 → 修复后** |
| **三种模式** | Report（只诊断）· Direct（修复+复验）· CI（门禁） |
| **Playbook** | 项目内学习修复模式（候选/已验证，防幻觉） |
| **零依赖脚本** | 看板、徽章、history、ci-gate 纯 Node，无 npm 依赖 |
| **大项目上下文工程** | 磁盘接力 + Map→Depth + 结构化压缩；600+ 文件 scope 下 7 pass 不断链 |

---

## 大项目上下文工程

> 借鉴 SWE-Agent 长程上下文管理、CodeDelegator 角色分离、Magistrate/RepoReviewer 分层审查、Cursor Subagents 隔离上下文等思路，解决 **「Pass 1 跑完、Pass 2 起不来」** 的真实痛点——不是压缩分析质量，而是让 orchestrator **永远保持瘦身**。

### 要解决的难题

| 症状 | 根因 |
|------|------|
| Pass 1 完成后主会话说「启动 Pass 2」却不 Task | orchestrator 上下文被 Pass 1 全文撑爆 |
| 607 个文件 inline 进 prompt | scope 列表占满 token，调度层先于分析层崩溃 |
| 用户发「继续」后长时间无响应 | 接近满的上下文 + 二次规划 → Cursor 超时 |

**旧模式**：聊天窗口 = 接力总线 → 大项目必断。  
**新模式**：**磁盘 = 接力总线**，聊天窗口只做调度。

### 借鉴的方法 → CodeCortexLoop 落地

| 思路 | 业界参考 | 我们怎么做 |
|------|----------|------------|
| **Thin Orchestrator** | CodeDelegator、agent-review-orchestrator | 主会话只读 anchor/summary；禁止粘贴专家报告 |
| **Artifact-driven Handoff** | Cursor Subagents 文档 | 全量 handoff/report 落盘；orchestrator 只收 `PASS_COMPLETE` |
| **On-demand Retrieval** | Claude Code、Confucius SDK | `scope-manifest.json` + `scope-paths.json`；专家 grep/codegraph 按需读 |
| **Map → Depth** | Magistrate、RepoReviewer、LLM Map-Reduce | `fileCount > 100` 先 **CortexScope Index** 确定性 map，再 7 pass 定点深扫 |
| **Structured Compaction** | CAT (ACL 2026 Findings)、Zylos Research | 每 pass 后写 `context-anchor.md` + `handoff-summary.json` |

### 架构：磁盘即接力总线

```mermaid
flowchart TB
  subgraph disk ["磁盘 — 唯一真相源"]
    SM["scope-manifest.json"]
    SP["scope-paths.json"]
    MAP["scope-map.json"]
    H["handoff/*.json"]
    RPT["docs/cortexloop/*.md"]
    ANCHOR["context-anchor.md"]
  end

  ORCH["Orchestrator 极瘦上下文"] -->|"Task 委派"| EX["Expert 子 agent 新上下文"]
  EX -->|"Read 按需"| SM
  EX -->|"Read 按需"| SP
  EX -->|"Write 全量"| H
  EX -->|"PASS_COMPLETE 仅"| ORCH
  ORCH -->|"compact 每 pass"| ANCHOR
  ORCH -->|"Step 4 全量 merge"| H
```

### 新增脚本（零 npm 依赖）

```bash
node scripts/build-scope-manifest.mjs --mode=whole    # scope 落盘 + 大 scope 自动 scope-map
node scripts/build-scope-map.mjs                        # 单独跑 CortexScope Index MAP
node scripts/compact-context.mjs --init --mode=direct   # 初始化 context anchor
node scripts/handoff-summary.mjs --through=3            # 压缩摘要给 orchestrator
node scripts/compact-context.mjs --pass=3 --next-pass=4 # 每 pass 后结构化压缩
```

### CortexScope Index（MAP 专用轻量索引）

借鉴 codegraph「**预索引落盘、按需查询**」思想，但不依赖 MCP 或 npm：

| 信号 | 作用 |
|------|------|
| Git churn | 近期改动文件/目录加权 |
| Regex import 图 | 找高扇入 hub 文件 |
| 入口启发式 | main/index/Controller/IPC 等 |
| Pass 分桶 pattern | security/errorHandling 等关键词强制 mustReview |

**与 codegraph MCP 的关系**：互补非替代。CortexScope Index 负责 MAP 阶段秒级出图；Pass 内若已装 codegraph 可继续 `codegraph_trace` 深挖。

**防遗漏**：MAP 是**优先级排序**不是范围裁剪。`scope-paths.json` 仍含全量路径；`mustReview` + `longTailSample` 强制专家扫非 hotspot 区域；低置信度时可选 LLM enrich（最多 5 个 hotspot）。

### 质量不会降的原因

- **压缩的是 orchestrator 聊天上下文**，不是 expert 分析证据链
- 7 个专家仍在**独立子上下文**中读完整 prior handoffs + 按需拉代码
- Step 4 仍从磁盘 **全量 handoff JSON** 聚合 findings；Evidence + Confidence 规则不变
- Step 3.5 跨 pass defer 回收机制不变

大 scope trade-off：**非 hotspot 区域深度降低**（非消失）——`longTailSample` + `mustReview` 缓解；要全库等深 scan 可缩小 scope 或提高 `scope.longTailSampleCount`；小 scope（<100 文件）不触发 Map。

---

## 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/whitequeen306/code-cortex-loop/master/scripts/install-remote.sh | bash -s cursor
```

Windows（PowerShell）：

```powershell
irm https://raw.githubusercontent.com/whitequeen306/code-cortex-loop/master/scripts/install-remote.ps1 | iex; Install-CodeCortexLoop -Tool cursor
```

将 `cursor` 换成 `claude` | `qoder` | `trae` | `opencode` | `codex` | `all`。安装后**重启工具**，在聊天里输入 `/cortexloop`。

本地 clone 安装：

```powershell
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd code-cortex-loop
.\scripts\install.ps1 -Tool cursor   # macOS/Linux: ./scripts/install.sh cursor
```

---

## 我适不适合用？（三个问题）

任意一条答 **否** → 大概率不需要（这很正常）：

| 问题 | 原因 |
|------|------|
| 你常用 **Cursor**、**Claude Code**、**OpenCode**、**Qoder**、**Trae（SOLO）** 或 **Codex** 吗？ | Cursor/Claude/OpenCode：`Task`；Qoder：`Agent`；Trae：SOLO；Codex：显式 spawn |
| 改动量 **≥ 几百行** 或是一个完整功能吗？ | 改个 typo 用 linter 就够了 |
| 能接受每次 **约 3–10 分钟** 跑完整流程吗？ | 见下方 [性能预算](#性能预算)；小 PR 用 `/cortexloop-quick` |

---

## 和现成方案比

| | CodeCortexLoop | CodeRabbit / Copilot Review | SonarQube / Snyk | 自己写 Cursor rules |
|--|----------------|----------------------------|------------------|---------------------|
| **跑在哪** | AI IDE 会话里 | 托管 PR 机器人 | CI / 服务端 | 你的聊天 |
| **多领域审查** | 7 路专家串行 | 单次 review | 规则扫描 | 看你怎么 prompt |
| **项目内学习** | Playbook（候选/已验证） | 产品记忆 | 基线/issue | 手动维护 |
| **成本** | 你的模型 token | 订阅 | 授权/云 | 写规则的时间 |
| **适合谁** | 已习惯 Cursor/Claude/Qoder Agent 的开发者 | 零配置 PR review 的团队 | 合规/静态分析 | 爱折腾的人 |

**不是 SaaS**，是 **harness + 零依赖脚本**，让现有 AI 工具像一支有流程的审查团队。

---

## 怎么工作

```mermaid
flowchart LR
  pre["分析前查 Playbook"] --> orch["Orchestrator 指挥"]
  orch --> e1["专家1 正确性"]
  e1 --> e2["专家2 安全"]
  e2 --> e7["…专家7"]
  e7 --> score["汇总 + 健康分"]
  score --> out{"Report / Direct / CI"}
  out -->|Direct| fix["修复 + 复验"]
  fix --> reflect["反思 → Playbook"]
  reflect -.-> pre
```

- **Orchestrator**（主会话）：定 scope、按序委派专家、汇总 handoff、打分；**禁止**自己 inline 做 pass 分析
- **领域专家**（每 pass 一个独立子 agent）：只负责本领域，写类别报告 + handoff JSON，供下游专家阅读
  - **Cursor / Claude Code / OpenCode**：通过 `Task` 工具启动（OpenCode 需配置 `permission.task`）
  - **Qoder**：通过内置 `Agent` 工具委派 `~/.qoder/agents/` 中的自定义智能体（阻塞、独立上下文）
  - **Trae**：在 **SOLO 模式**下由 SOLO Coder 按顺序委派 `~/.trae/agents/` 中的 7 个自定义智能体
- **分析串行、修复串行**（Direct 模式下每组修复后跑测试）

### 七专家固定顺序

| 步 | Pass | 专家 | 类别报告 | Handoff |
|----|------|-------------|----------|---------|
| 1 | `review` | `code-reviewer` | `01-correctness.md` | `.cortexloop/handoff/01-correctness.json` |
| 2 | `security` | `security-auditor` | `02-security.md` | `.cortexloop/handoff/02-security.json` |
| 3 | `tests` | `test-engineer` | `05-tests.md` | `.cortexloop/handoff/03-tests.json` |
| 4 | `errorHandling` | `silent-failure-hunter` | `06-error-handling.md` | `.cortexloop/handoff/04-error-handling.json` |
| 5 | `performance` | `performance-analyst` | `03-performance.md` | `.cortexloop/handoff/05-performance.json` |
| 6 | `simplicity` | `code-simplifier` | `04-simplicity.md` | `.cortexloop/handoff/06-simplicity.json` |
| 7 | `cleanup` | `cleanup-curator` | `07-cleanup.md` | `.cortexloop/handoff/07-cleanup.json` |

合约与边界：`passes/README.md` · Handoff Schema：`schemas/pass-handoff.schema.json`

---

## 三种工作模式

| 模式 | 触发 | 行为 |
|------|------|------|
| **Report** | `/cortexloop` 默认询问 | 写出报告 + 看板，**停下等你确认**再改代码 |
| **Direct** | 选择 Direct | 分组修复 → 每组跑测试 → **复验重跑七专家** → 输出修复前后得分 → 自动反思写入 Playbook |
| **CI** | `/cortexloop --ci` 或配置 `ci.enabled` | 无交互，写 `report.json`，跑 `ci-gate`，可选 PR 评论 |

---

## 命令一览

| 命令 | 用途 |
|------|------|
| `/cortexloop` | 完整 7 pass；询问 Report / Direct 与范围 |
| `/cortexloop-quick` | 3 pass：审查 + 安全 + 错误处理；适合小改动 |
| `/cortexloop-deep` | 7 pass 整库深扫 |
| `/cortexloop-security` | 安全 + 错误处理 + 依赖清理 |
| `/cortexloop-pre-pr` | PR 前：近期改动，High+ 须清零 |
| `/cortexloop-baseline` | 接受或对比技术债基线 |
| `/cortexloop-reflect` | 手动复盘并写入 Playbook |

---

## 跑完会得到什么

| 产物 | 路径 | 说明 |
|------|------|------|
| 概览 | `docs/cortexloop/00-summary.md` | 人类可读总结 + 健康分 |
| 分类报告 | `docs/cortexloop/01-*.md` … `07-*.md` | 各领域明细 |
| 机器报告 | `docs/cortexloop/report.json` | CI 门禁输入（须含 `"generatedBy":"cortexloop"`） |
| **HTML 看板** | `docs/cortexloop/report.html` | 浏览器直接打开，含分数环、类别条、问题表 |
| 运行统计 | `docs/cortexloop/run-summary.md` | pass 数、耗时、估算 token |
| Handoff | `.cortexloop/handoff/*.json` | 每 pass 结构化交接 |
| Scope 清单 | `.cortexloop/scope-manifest.json`、`.cortexloop/scope-paths.json` | 大 scope 按需读取，不进 prompt |
| 风险地图 | `.cortexloop/scope-map.json` | CortexScope Index 热点 + mustReview + longTailSample（>100 文件） |
| 上下文锚点 | `.cortexloop/context-anchor.md`、`.cortexloop/run-state.json` | orchestrator 瘦身调度 |
| Handoff 摘要 | `.cortexloop/handoff-summary.json` | 每 pass 压缩摘要 |
| 趋势 / 徽章 | `.cortexloop/history.json`、`.cortexloop/health-badge.svg` | README 可嵌入徽章 |
| Playbook | `.cortexloop/playbook.json` | 英文，**仅模型 query** |
| Playbook 中文 | `.cortexloop/playbook-zh.md` | 人类阅读，模型不读 |
| 复盘 | `docs/cortexloop/08-reflection.md` | Direct 成功后自动生成 |

`report.json` 写出后自动跑后处理（badge、看板、历史、PR 评论体）。也可手动：

```bash
node scripts/validate-handoffs.mjs
node scripts/run-summary.mjs --out=docs/cortexloop/run-summary.md
node scripts/make-dashboard.mjs docs/cortexloop/report.json
```

---

## 健康分（0–100）

按**未解决**问题扣分，Direct 模式展示 **修复前 → 修复后**：

| 严重度 | 扣分 |
|--------|------|
| Critical | -25 |
| High | -10 |
| Medium | -4 |
| Low | -1 |

每条计入分数的 finding 须含 **Evidence + Confidence**；低置信猜测不进计分，只进 Open Questions。

---

## Playbook 自我进化

v2.2 核心：**记忆是召回（去哪查），不是权威（该信什么）** —— 命中只提示优先排查区，修法每次重新推导验证。

| 层级 | 含义 |
|------|------|
| **verified** | 多样且已验证，query 默认展示 |
| **candidate** | 未确认假设，禁止自动套用 |
| **quarantined** | 失败/过低置信，不展示 |

```bash
# 分析前（默认仅 verified）
node scripts/playbook.mjs query --category=security,errorHandling --lang=js --global-merge

# Direct 复验成功后
node scripts/playbook.mjs record .cortexloop/reflection.json

# CI/人工确认或负反馈
node scripts/playbook.mjs feedback --signature=<sig> --outcome=external_verified --evidence="ci: run 123"
```

详见 [docs/GUIDE.md#自我进化learning-loop](docs/GUIDE.md) 与 `rules/learning-loop.mdc`。

---

## 工具支持

| 工具 | 安装参数 | 配置目录 | 子 agent |
|------|----------|----------|----------|
| **Cursor** | `cursor` | `~/.cursor/` | ✅ Task 完整 |
| **Claude Code** | `claude` | `~/.claude/` | ✅ Task 完整 |
| **OpenCode** | `opencode` | `~/.config/opencode/` | ✅ Task（需 `permission.task`；见 [adapters/opencode/](adapters/opencode/)） |
| **Qoder** | `qoder` | `~/.qoder/` | ✅ Agent 工具（需主会话启用 Agent；见 [adapters/qoder/](adapters/qoder/)） |
| **Trae** | `trae` | `~/.trae/` | ⚡ SOLO 模式 + 自定义智能体（见 [adapters/trae/](adapters/trae/)） |
| **Codex** | `codex` | `~/.codex/` | ⚡ 显式 spawn + TOML 子 agent（见 [adapters/codex/](adapters/codex/)） |

未配置子 agent 或用户确认时才会退化为单会话 fallback。OpenCode 与 Cursor 共用 Task 流程。各工具差异：[adapters/](adapters/)。

> **ZCode**（智谱 Z.ai ADE）是独立产品，与 Trae 不同，当前**未适配** CodeCortexLoop。

### Qoder 快速上手

1. 安装：`.\scripts\install-qoder.ps1`（或 `./scripts/install.sh qoder`），**重启 Qoder**
2. 确认 `~/.qoder/agents/` 下有 7 个专家（`code-reviewer.md` 等）
3. 在 **Agent 模式**聊天中运行 `/cortexloop`；主会话须启用 **Agent 工具**
4. Bootstrap 应显示 `✅ Qoder native subagent mode`；orchestrator 按 pass 顺序委派 7 专家
5. 若 Agent 工具不可用，可手动按顺序调用 `/code-reviewer` → … → `/cleanup-curator`

详见 [adapters/qoder/README.md](adapters/qoder/README.md)。

### Trae 快速上手（SOLO 模式）

1. 安装：`.\scripts\install-trae.ps1`（国内版目录为 `.trae-cn`），**重启 Trae**
2. **切换到 SOLO 模式**（左上角模式切换）
3. 在 SOLO Coder 设置中启用 7 个自定义智能体（来自 `~/.trae/agents/`）
4. 运行 `/cortexloop`；Bootstrap 应显示 `✅ Trae partial subagent mode`
5. SOLO Coder 按 pass 顺序委派专家；每步写 report + handoff JSON

普通 IDE 聊天（非 SOLO）会退化为单会话。详见 [adapters/trae/README.md](adapters/trae/README.md)。

### Codex 快速上手（显式 spawn）

1. 安装：`.\scripts\install-codex.ps1`（或 `./scripts/install.sh codex`），**重启 Codex**
2. 将 `~/.codex/codex.cortexloop.example.toml` 的 `[agents]` 合并进 `config.toml`（`max_depth = 1`）
3. 确认 `~/.codex/agents/` 下有 7 个 `.toml` 专家
4. 合并 `AGENTS.cortexloop.md` 到项目或用户的 `AGENTS.md`
5. 运行 `/prompts:cortexloop` 或明确要求：**按 pass 顺序逐个 spawn 子 agent**；Bootstrap 应显示 `✅ Codex partial subagent mode`
6. CLI 可用 `/agent` 查看子 agent 线程

Codex **不会自动 spawn**——必须在 prompt 里写清顺序。详见 [adapters/codex/README.md](adapters/codex/README.md)。

### OpenCode 快速上手

1. 安装：`.\scripts\install-opencode.ps1`，**重启 OpenCode**
2. 将 `~/.config/opencode/opencode.cortexloop.example.json` 中的 `permission.task` 合并进你的 `opencode.json`
3. 确认 `~/.config/opencode/agents/` 下 7 个专家含 `mode: subagent`
4. 用 **Build** 主 agent 运行 `/cortexloop` → Bootstrap 应显示 OpenCode Task 模式
5. 若 Task 被权限拒绝，可手动 `@code-reviewer` → … → `@cleanup-curator`

详见 [adapters/opencode/README.md](adapters/opencode/README.md)。

---

## 项目配置（可选）

```bash
cp cortexloop.config.example.json cortexloop.config.json
cp .cortexloopignore.example .cortexloopignore
```

`cortexloop.config.json` 可覆盖 preset、scope、启用哪些 pass、CI 阈值、Playbook 路径等。行内抑制：`// cortexloop-ignore CL-001`。

---

## CI / GitHub Actions

第 1 步：你的 AI 工具产出 `docs/cortexloop/report.json`（例如 `/cortexloop-pre-pr --ci`）。

第 2 步：仓库根目录的复合 Action：

```yaml
name: CodeCortexLoop
on: [pull_request]

jobs:
  gate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      # - run: your-ai-cli /cortexloop-pre-pr --ci
      - uses: whitequeen306/code-cortex-loop@v2.2.0
        with:
          report-path: docs/cortexloop/report.json
          max-high: '0'
          comment: 'true'
```

老项目债太多？先 `/cortexloop-baseline` 接受基线，再 `ci-gate --baseline` 只拦**新增** Critical/High。完整示例：[.github/workflows/cortexloop-example.yml](.github/workflows/cortexloop-example.yml)。

---

## 真实项目案例：LianYu-PC

[![Report → Direct 先后对比](docs/assets/lianyu-pc-showcase.png)](examples/lianyu-pc/docs/cortexloop/showcase.html)

在 **Vue 3 + Spring Boot 全栈项目**上跑 `/cortexloop-deep` **Report 模式**（2026-06-22，整库扫描）。上图展示 **Report 诊断 → Direct 修复示意** 的先后对比；完整 81 条明细见标准看板。

| 阶段 | 健康分 | Critical / High / Medium / Low | 说明 |
|------|--------|--------------------------------|------|
| **Report 诊断** | **32** | 9 / 32 / 31 / 9 | 真实扫描产物 |
| **Direct 示意*** | **84** | 0 / 0 / 31 / 9 | 按 reflection 清零 Critical+High（41 项）后重算 |

\* Direct 右侧为**示意得分**（非完整七专家复验）；LianYu-PC 原项目有 `08-reflection.md` 记录修复，完整复验待重跑。

**典型发现：** 验证码表达式泄露 · SSE 错误仍持久化 · 前端轮询静默失败 · 认证/SSE 核心路径零测试

| 链接 | 说明 |
|------|------|
| [showcase.html](examples/lianyu-pc/docs/cortexloop/showcase.html) | **Report → Direct 对比看板**（上图来源） |
| [report.html](examples/lianyu-pc/docs/cortexloop/report.html) | 标准看板（含全部 finding 表） |
| [00-summary.md](examples/lianyu-pc/docs/cortexloop/00-summary.md) | 人类可读摘要 |
| [examples/lianyu-pc/](examples/lianyu-pc/) | 案例目录说明 |

> 产物为 Report 模式拷贝，**不含** LianYu-PC 源码，**未修改**原项目。  
> **想查看此项目：** [github.com/whitequeen306/LianYuPC](https://github.com/whitequeen306/LianYuPC)

### 教学用 Demo

[examples/demo-app/](examples/demo-app/) — 故意写满 bug 的小项目，适合第一次试 `/cortexloop`。

---

## 性能预算

| 模式 | Pass 数 | 预估耗时* | 预估 token* |
|------|---------|-----------|-------------|
| `/cortexloop-quick` | 3 | ~2–4 分钟 | ~8万–15万 |
| `/cortexloop` | 7 | ~5–12 分钟 | ~20万–45万 |
| `/cortexloop-deep` | 7 + 整库 | ~10–25 分钟 | ~40万–90万 |

\* 约 500 行 scope、Cursor/Claude；[详细方法 →](docs/PERFORMANCE.md)

后处理脚本（badge/看板/历史）：中位数 **~416ms**（实测，无 LLM）。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/GUIDE.md](docs/GUIDE.md) | **完整指南（中文）**：基线棘轮、后处理、适配器、致谢 |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | 性能预算与测量 |
| [docs/LAUNCH-zh.md](docs/LAUNCH-zh.md) | 推广文案 |
| [passes/README.md](passes/README.md) | 七专家合约 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 参与贡献 |
| [CHANGELOG.md](CHANGELOG.md) | 版本历史 |

<details>
<summary>可选：demo 动画 GIF</summary>

![Direct 模式修复前后 58→82](docs/assets/cortexloop-demo.gif)

</details>

---

## 仓库结构

```
commands/     # /cortexloop 系列 slash command
passes/       # 七专家串行合约
agents/       # 领域专家 persona
skills/       # cortexloop-expert-core（公共）+ 各领域 depth skill + reflect
rules/        # workflow、learning-loop、refactor-safety …
scripts/      # ci-gate、playbook、scope-manifest、compact-context、看板、安装脚本（零 npm 依赖）
schemas/      # report、config、handoff JSON schema
examples/     # demo-app + lianyu-pc（真实大项目 Report）
action.yml    # GitHub 复合 Action
```

---

## 许可证

MIT —— 见 [LICENSE](LICENSE)
