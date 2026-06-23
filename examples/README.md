# CodeCortexLoop Examples

## 真实大项目报告 — [lianyu-pc/](lianyu-pc/)

Vue 3 + Spring Boot 全栈项目 **LianYu-PC** 的 `/cortexloop-deep` **Report 模式**产物（2026-06-22）。

- [showcase.html](lianyu-pc/docs/cortexloop/showcase.html) — 优化可视化（README 首图）
- [report.html](lianyu-pc/docs/cortexloop/report.html) — 完整标准看板
- [report.json](lianyu-pc/docs/cortexloop/report.json) — 81 条 finding

## 教学 Demo — [demo-app/](demo-app/)

故意写满 bug 的迷你应用 + 预置报告，适合第一次试 `/cortexloop`。

```bash
start examples/demo-app/docs/cortexloop/report.html   # Windows
```

## 重新生成 LianYu showcase 图

```bash
node scripts/make-showcase-dashboard.mjs examples/lianyu-pc/docs/cortexloop/report.json \
  --out=examples/lianyu-pc/docs/cortexloop/showcase.html \
  --title="LianYu-PC" --subtitle="Vue 3 + Spring Boot · 全栈"
python scripts/capture-showcase-screenshot.py
```
