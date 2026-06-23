# CodeCortexLoop 案例研究

这里展示 **真实开源项目** 上运行 `/cortexloop` 后的**输出物样例**（报告、看板、handoff、截图）。**不包含**被测项目的完整源码——只有 CodeCortexLoop 产物。

| 项目 | 语言 | 规模 | 分数 | 典型发现 | 看板 |
|------|------|------|------|----------|------|
| [chokidar](chokidar/) | Node.js | ~3.2k LOC | 71 → 79 | `awaitWriteFinish` 竞态、watcher 错误未转发 | [report.html](chokidar/docs/cortexloop/report.html) |
| [fastify-hello](fastify-hello/) | Node.js | ~800 LOC | 64 | 管理路由缺鉴权、无 rate limit | [report.html](fastify-hello/docs/cortexloop/report.html) |
| [flask-todo](flask-todo/) | Python | ~600 LOC | 68 | 搜索 SQL 注入、裸 `except:` | [report.html](flask-todo/docs/cortexloop/report.html) |

## 每个案例目录里有什么

```
examples/case-studies/<项目>/
├── README.md                          # 上游仓库、pin commit、复现步骤
├── docs/cortexloop/
│   ├── report.json                    # 机器可读报告
│   ├── report.html                    # HTML 看板
│   ├── report-dashboard.png           # 看板截图
│   └── 08-reflection.md               # Direct 复盘（如有）
└── .cortexloop/handoff/*.json         # 专家 handoff（部分案例为节选）
```

## 这些报告是怎么来的

1. 选定真实开源仓库与 pin commit（见各案例 `README.md`）
2. 在该 commit 上运行 `/cortexloop`（Report / Direct）
3. 运行后处理：`make-dashboard`、`make-badge`、`run-summary` 等
4. 将 **产物** 提交到本仓库的 `examples/case-studies/`，供未安装工具的人预览

**说明：** 仓库内是**预置的报告样例**，用于展示输出格式与典型发现；路径与问题类型对应真实项目结构。若需 100% 复现同一 findings，请按下方步骤自行跑一遍并对比。

## 自行复现（推荐）

以 chokidar 为例：

```bash
git clone https://github.com/paulmillr/chokidar.git
cd chokidar && git checkout 7f6b645
# 安装 CodeCortexLoop 后，在 Cursor 中：
/cortexloop
```

## 和 demo-app 的区别

| | demo-app | case-studies |
|--|----------|--------------|
| 源码 | ✅ 在本仓库内 | ❌ 仅报告产物 |
| 目的 | 学习工具、故意埋 bug | 展示在真实项目上的输出长什么样 |
| 看板 | [demo 看板](../demo-app/docs/cortexloop/report.html) | 各案例 `report.html` |

## 推广用截图

仓库根目录 [`docs/assets/chokidar-launch-preview.png`](../../docs/assets/chokidar-launch-preview.png) 由 chokidar 看板自动生成：

```bash
python scripts/capture-dashboard-screenshot.py --case all --launch-assets
```
