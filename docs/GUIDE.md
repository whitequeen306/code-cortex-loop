# CodeCortexLoop — Full Guide

Detailed documentation moved from README for a cleaner first impression. Start with [README](../README.md) for install and quick judgment.

---

## 核心能力

| 能力 | 说明 |
|------|------|
| **七专家串行协作** | `/cortexloop` 按固定顺序启动 7 个领域专家（Task 子 agent），每人只负责本领域；orchestrator 只调度与汇总，不 inline 分析 |
| **健康分（0–100）** | 按类别打分 + 总分，Direct 修复后给出 **修复前 → 修复后** 对比 |
| **可自我进化** | 内置 **Playbook 记忆库**（防幻觉信任模型：候选/已验证、负信号、外部预言机优先） |
| **可视化看板** | 自包含的 `report.html`，浏览器直接打开 |
| **趋势 + 徽章** | `history.json` 记录历次得分趋势 |
| **基线棘轮** | 老项目历史欠债一次性接受，CI 只对**新增**问题报错 |
| **CI / GitHub Action** | 内置复合 Action |
| **零依赖** | 所有后处理脚本均为零 npm 依赖的纯 Node 脚本 |

## 工作模式

- **Report 模式** —— 写出报告 + handoff + 看板，停下等你确认
- **Direct 模式** —— 分组增量修复、复验时重跑七专家管道，自动反思沉淀
- **CI 模式** —— 机器可读报告 + 退出码 + 可选 PR 评论

## 工具支持与退化模式

| 工具 | Task 子 agent | 体验 |
|------|---------------|------|
| **Cursor** | 完整支持 | 7 个独立 Task 串行，领域隔离 |
| **Claude Code** | 完整支持 | 同上 |
| **Qoder / Trae / OpenCode / Codex** | 退化 | 单会话按 pass 顺序自我分段，**无真正子 agent 隔离** |

Orchestrator 在 Bootstrap 时会打印 `⚠️ Falling back to single-session mode` 当检测到非 Cursor/Claude 环境。

## 命令

| 命令 | 用途 |
|------|------|
| `/cortexloop` | 完整流水线 |
| `/cortexloop-quick` | 专家 1+2+4（审查 + 安全 + 错误处理） |
| `/cortexloop-deep` | 全部 7 专家、整库扫描 |
| `/cortexloop-security` | 安全 + 错误处理 + 依赖清理 |
| `/cortexloop-pre-pr` | PR 前门禁 |
| `/cortexloop-baseline` | 接受或对比技术债基线 |
| `/cortexloop-reflect` | 手动反思并写入 Playbook |

## 七专家串行协作

| 步 | Pass | 专家 (Task) | Handoff |
|----|------|-------------|---------|
| 1 | `review` | `code-reviewer` | `.cortexloop/handoff/01-correctness.json` |
| 2 | `security` | `security-auditor` | `.cortexloop/handoff/02-security.json` |
| 3 | `tests` | `test-engineer` | `.cortexloop/handoff/03-tests.json` |
| 4 | `errorHandling` | `silent-failure-hunter` | `.cortexloop/handoff/04-error-handling.json` |
| 5 | `performance` | `performance-analyst` | `.cortexloop/handoff/05-performance.json` |
| 6 | `simplicity` | `code-simplifier` | `.cortexloop/handoff/06-simplicity.json` |
| 7 | `cleanup` | `cleanup-curator` | `.cortexloop/handoff/07-cleanup.json` |

Schema：`schemas/pass-handoff.schema.json`。合约：`passes/README.md`。

## 自我进化（Learning Loop）

详见 README 链接与 `rules/learning-loop.mdc`。核心：**召回而非权威** —— 命中只提示优先排查区，修法每次重新推导验证。

```bash
node scripts/playbook.mjs query --category=performance,simplicity,errorHandling --lang=js
node scripts/playbook.mjs record .cortexloop/reflection.json
node scripts/playbook.mjs feedback --signature=<sig> --outcome=external_verified
```

## 健康分

| 严重度 | 扣分 |
|--------|------|
| Critical | -25 |
| High | -10 |
| Medium | -4 |
| Low | -1 |

## 后处理脚本

```bash
node scripts/validate-handoffs.mjs          # fail-fast if handoffs missing/invalid
node scripts/run-summary.mjs                # pass count, duration, est. tokens
node scripts/record-history.mjs docs/cortexloop/report.json
node scripts/make-badge.mjs docs/cortexloop/report.json
node scripts/make-dashboard.mjs docs/cortexloop/report.json
node scripts/pr-comment.mjs docs/cortexloop/report.json
```

## 基线棘轮

```bash
node scripts/baseline.mjs accept docs/cortexloop/report.json
node scripts/baseline.mjs diff docs/cortexloop/report.json
node scripts/ci-gate.mjs docs/cortexloop/report.json --baseline
```

## 项目配置

```bash
cp cortexloop.config.example.json cortexloop.config.json
cp .cortexloopignore.example .cortexloopignore
```

## CI / GitHub Actions

```yaml
- uses: whitequeen306/code-cortex-loop@v2.2.0
  with:
    report-path: docs/cortexloop/report.json
    max-high: '0'
```

完整示例：[.github/workflows/cortexloop-example.yml](../.github/workflows/cortexloop-example.yml)

## 各工具安装路径

| 工具 | 配置目录 |
|------|----------|
| Cursor | `~/.cursor/` |
| Claude Code | `~/.claude/` |
| Qoder | `~/.qoder/` |
| Trae | `~/.trae/` |
| OpenCode | `~/.config/opencode/` |
| Codex | `~/.codex/` |

各工具差异见 [adapters/](../adapters/)。

## 输出产物

| 文件 | 说明 |
|------|------|
| `docs/cortexloop/report.json` | 机器可读 |
| `docs/cortexloop/report.html` | 可视化看板 |
| `docs/cortexloop/run-summary.md` | 本次运行统计 |
| `.cortexloop/handoff/*.json` | 七专家 handoff |
| `.cortexloop/playbook.json` | 英文 Playbook（模型） |
| `.cortexloop/playbook-zh.md` | 中文 Playbook（人类） |

## Demo 与 Case Studies

- [examples/demo-app](../examples/demo-app/) — 故意写满 bug 的学习样例
- [examples/case-studies](../examples/case-studies/) — 真实开源仓库分析报告

## 性能预算

见 [PERFORMANCE.md](PERFORMANCE.md)。

## 致谢

- [superpowers](https://github.com/obra/superpowers)
- [Anthropic claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
- [performance-deity](https://github.com/v0idOS/performance-deity)
