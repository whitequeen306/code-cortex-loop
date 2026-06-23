# 推广素材 — CodeCortexLoop v2.2.0（中文版）

发帖时**先贴 GIF + 一张看板截图**，不要一上来堆功能列表。英文版见 [LAUNCH.md](LAUNCH.md)。

---

## 素材在哪里？（优先用真实 case study 截图，别用 demo GIF）

| 素材 | 路径 | 用途 |
|------|------|------|
| **推荐：chokidar 合成图** | `docs/assets/chokidar-launch-preview.png` | r/cursor、Release、README 首图 |
| 健康分 + 类别条形图 | `docs/assets/chokidar-report-hero.png` | 推特缩略图 |
| 问题列表（findings 表） | `docs/assets/chokidar-report-findings.png` | 第二条帖 / 评论区 |
| 完整看板 | `docs/assets/chokidar-report-full.png` | GitHub Release |
| 各 case 完整 PNG | `examples/case-studies/<repo>/docs/cortexloop/report-dashboard.png` | 案例页 |
| demo GIF（可选） | `docs/assets/cortexloop-demo.gif` | 动画备选，不如上面真实 |

**重新生成截图：**

```bash
python scripts/capture-dashboard-screenshot.py --case all --launch-assets
```

HTML 源文件（浏览器可打开）：`examples/case-studies/chokidar/docs/cortexloop/report.html`

---

## 创建 GitHub Release 时怎么贴

1. 打开 https://github.com/whitequeen306/code-cortex-loop/releases/new
2. **Choose a tag:** `v2.2.0`
3. **Release title:** `v2.2.0 — 七专家流水线 + 真实 case study`
4. **描述里：**
   - 拖入 `docs/assets/cortexloop-demo.gif`（或 Markdown：`![demo](../docs/assets/cortexloop-demo.gif)`）
   - 拖入你截好的 `chokidar-dashboard.png`
   - 写 2–3 句：chokidar 跑完 71 分，Direct 后 79 分，发现 watcher 错误被吞
5. 发布

---

## r/cursor（中文社区可发 r/cursor 英文帖 + 国内论坛中文帖）

**标题：** CodeCortexLoop — 在 Cursor 里 `/cortexloop` 跑 7 路专家审查 + 健康分 + 可进化 Playbook

**正文：**

给 Cursor / Claude Code 用的「写完代码后」流水线 harness（其它工具会退化为单会话，文档里写清楚了）：

- 一条命令串行跑 7 个审查 pass（正确性 → 安全 → 测试 → …）
- 产出 HTML 健康分看板（0–100）
- Direct 模式修复 + 复验，经验写入 Playbook（候选/已验证两层，防幻觉）
- 零 npm 依赖脚本：CI 门禁、徽章、PR 评论

**不是给所有人用的** —— 适合已经习惯 Cursor Agent、想要结构化审查而不是随口「帮我 review」的人。

在 **chokidar**（npm 文件监听库）上实跑：发现 watcher 错误被吞（High），Direct 后 **71 → 79**。

- 仓库：https://github.com/whitequeen306/code-cortex-loop
- 安装：`curl -fsSL https://raw.githubusercontent.com/whitequeen306/code-cortex-loop/main/scripts/install-remote.sh | bash -s cursor`
- 案例看板：clone 后打开 `examples/case-studies/chokidar/docs/cortexloop/report.html`

（附上 GIF + chokidar 看板截图）

前几个 issue 争取 24 小时内回复。

---

## V2EX / 掘金 / 知乎（中文）

**标题：** 开源：CodeCortexLoop — 给 Cursor 用的七专家代码审查流水线

**正文要点：**

1. 一句话：一条 `/cortexloop`，七个领域专家接力，输出健康分和 HTML 看板
2. **三张图：** GIF + chokidar 看板截图 + （可选）demo-app 看板
3. **诚实说明：** 完整 Task 子 agent 隔离只有 Cursor / Claude Code；其它工具是 fallback
4. **和 CodeRabbit / Sonar 的区别：** 不是托管 SaaS，是 harness + 脚本，吃你自己的模型 token
5. 链接仓库 + 一行安装命令

---

## Hacker News（Show HN，英文）

**Title:** Show HN: CodeCortexLoop – seven-expert post-coding pipeline for Cursor/Claude Code

**Body:**（同英文 LAUNCH.md，略）

Case study: https://github.com/whitequeen306/code-cortex-loop/tree/main/examples/case-studies/chokidar

---

## 推特 / X

**帖 1（带 GIF）：**

> 做了 CodeCortexLoop：Cursor 里 `/cortexloop` 串行 7 路审查，输出健康分看板
>
> [贴 docs/assets/cortexloop-demo.gif]
>
> 不是 SaaS，是 harness + 脚本。Cursor / Claude Code 体验最好。
>
> github.com/whitequeen306/code-cortex-loop

**帖 2（case study）：**

> 在 chokidar（npm 文件监听）上跑了一次：
> • 发现 watcher 错误被吞（High）
> • Direct 后 71 → 79
>
> 不用安装也能在仓库里看预生成报告：
> examples/case-studies/chokidar/docs/cortexloop/report.html

---

## Issue 响应 SLA（发布后头两周）

| 优先级 | 目标响应 |
|--------|----------|
| Cursor / Claude 安装失败 | < 24h |
| 脚本 bug（ci-gate、playbook 等） | < 48h |
| 功能请求 | 确认收到 + 打 label，不承诺排期 |
| 「为什么不直接用 X？」 | 指向 README 竞品对比表 |

适合标 `good first issue` 的：文档笔误、case study 元数据、安装脚本边界情况。

---

## 发帖前检查清单

- [ ] GIF 能在本地打开：`docs/assets/cortexloop-demo.gif`
- [ ] chokidar 看板能在浏览器打开并截图
- [ ] GitHub Release 已创建并附上 GIF + 截图
- [ ] README 顶部一行安装命令可用
- [ ] 准备好 24h 内回复前 5 个 issue
