# 推广素材 — CodeCortexLoop v2.2.0（中文版）

发帖时**先贴 GIF + 一张看板截图**，不要一上来堆功能列表。英文版见 [LAUNCH.md](LAUNCH.md)。

---

## 素材在哪里？（优先用真实 case study 截图，别用 demo GIF）

| 素材 | 路径 | 用途 |
|------|------|------|
| **推荐：LianYu showcase** | [docs/assets/lianyu-pc-showcase.png](../docs/assets/lianyu-pc-showcase.png) | r/cursor、Release、README 首图 |
| 标准看板（81 findings） | [examples/lianyu-pc/docs/cortexloop/report.html](../examples/lianyu-pc/docs/cortexloop/report.html) | 浏览器截图 → 推特 / 掘金 |
| 对比看板 | [examples/lianyu-pc/docs/cortexloop/showcase.html](../examples/lianyu-pc/docs/cortexloop/showcase.html) | Report → Direct 对比 |
| 教学 demo 看板 | [examples/demo-app/docs/cortexloop/report.html](../examples/demo-app/docs/cortexloop/report.html) | 第一次试用 |
| demo GIF（可选） | `docs/assets/cortexloop-demo.gif` | 动画备选，不如上面真实 |

**重新生成 LianYu showcase 图：**

```bash
node scripts/make-showcase-dashboard.mjs examples/lianyu-pc/docs/cortexloop/report.json \
  --out=examples/lianyu-pc/docs/cortexloop/showcase.html
python scripts/capture-showcase-screenshot.py
```

---

## 创建 GitHub Release 时怎么贴

1. 打开 https://github.com/whitequeen306/code-cortex-loop/releases/new
2. **Choose a tag:** `v2.2.0`（或当前版本）
3. **Release title:** `v2.x — 七专家流水线 + LianYu-PC 真实案例`
4. **描述里：**
   - 拖入 `docs/assets/cortexloop-demo.gif`（若有）
   - 拖入 `docs/assets/lianyu-pc-showcase.png` 或 report.html 截图
   - 写 2–3 句：LianYu-PC 整库 Report **32 分**，81 条 finding，典型问题含验证码泄露、SSE 静默失败
5. 发布

---

## r/cursor（中文社区可发 r/cursor 英文帖 + 国内论坛中文帖）

**标题：** CodeCortexLoop — 在 Cursor 里 `/cortexloop` 跑 7 路专家审查 + 健康分 + 可进化 Playbook

**正文：**

给 Cursor / Claude Code 用的「写完代码后」流水线 harness（Qoder/Trae/Codex 见文档，体验可能降级）：

- 一条命令串行跑 7 个审查 pass（正确性 → 安全 → 测试 → …）
- 产出 HTML 健康分看板（0–100）
- Direct 模式修复 + 复验，经验写入 Playbook（候选/已验证两层，防幻觉）
- CI/安装零额外依赖：门禁、徽章、PR 评论脚本仅需 Node

**不是给所有人用的** —— 适合已经习惯 Cursor Agent、想要结构化审查而不是随口「帮我 review」的人。小改动先试 `/cortexloop-lite`。

在 **LianYu-PC**（Vue 3 + Spring Boot 全栈）上 `/cortexloop-deep` Report：**健康分 32**，81 条 finding。

- 仓库：https://github.com/whitequeen306/code-cortex-loop
- 安装：`curl -fsSL https://raw.githubusercontent.com/whitequeen306/code-cortex-loop/master/scripts/install-remote.sh | bash -s cursor`
- 案例看板：clone 后打开 `examples/lianyu-pc/docs/cortexloop/report.html`

（附上 GIF + LianYu 看板截图）

前几个 issue 争取 24 小时内回复。

---

## V2EX / 掘金 / 知乎（中文）

**标题：** 开源：CodeCortexLoop — 给 Cursor 用的七专家代码审查流水线

**正文要点：**

1. 一句话：一条 `/cortexloop`，七个领域专家接力，输出健康分和 HTML 看板
2. **三张图：** GIF（可选）+ LianYu 看板截图 + demo-app 看板
3. **诚实说明：** 完整 Task 子 agent 隔离以 Cursor / Claude Code / OpenCode 为最佳；其它工具需额外配置
4. **和 CodeRabbit / Sonar 的区别：** 不是托管 SaaS，是 harness + 脚本，吃你自己的模型 token
5. 链接仓库 + 一行安装命令

---

## Hacker News（Show HN，英文）

**Title:** Show HN: CodeCortexLoop – seven-expert post-coding pipeline for Cursor/Claude Code

**Body:**（同英文 LAUNCH.md，略）

Case study: https://github.com/whitequeen306/code-cortex-loop/tree/main/examples/lianyu-pc

---

## 推特 / X

**帖 1（带 GIF 或 showcase 图）：**

> 做了 CodeCortexLoop：Cursor 里 `/cortexloop` 串行 7 路审查，输出健康分看板
>
> 小改动用 `/cortexloop-lite`。不是 SaaS，是 harness + 脚本。
>
> github.com/whitequeen306/code-cortex-loop

**帖 2（case study）：**

> 在 LianYu-PC（Vue + Spring Boot）上跑 `/cortexloop-deep` Report：
> • 健康分 32，81 条 finding
> • 验证码泄露、SSE 静默失败、核心路径零测试
>
> 预生成看板：examples/lianyu-pc/docs/cortexloop/report.html

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

- [ ] GIF 或 showcase 图能在本地打开
- [ ] LianYu 看板能在浏览器打开：`examples/lianyu-pc/docs/cortexloop/report.html`
- [ ] GitHub Release 已创建并附上截图
- [ ] README 顶部一行安装命令可用
- [ ] 准备好 24h 内回复前 5 个 issue
