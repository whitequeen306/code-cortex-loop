# Launch materials — CodeCortexLoop v2.2.0

Use these drafts when posting to communities. **Lead with the GIF and one case study**, not a feature list. 中文版：[LAUNCH-zh.md](LAUNCH-zh.md)

Assets (prefer **real case study screenshots** over the demo GIF):

| Asset | Path | Use for |
|-------|------|---------|
| **Launch composite (recommended)** | [docs/assets/lianyu-pc-showcase.png](../docs/assets/lianyu-pc-showcase.png) | Reddit, Release, README |
| Standard dashboard (81 findings) | [examples/lianyu-pc/docs/cortexloop/report.html](../examples/lianyu-pc/docs/cortexloop/report.html) | Screenshot for social |
| Before/after showcase | [examples/lianyu-pc/docs/cortexloop/showcase.html](../examples/lianyu-pc/docs/cortexloop/showcase.html) | Report → Direct narrative |
| Teaching demo | [examples/demo-app/docs/cortexloop/report.html](../examples/demo-app/docs/cortexloop/report.html) | First try |
| Demo GIF (optional) | `docs/assets/cortexloop-demo.gif` | Animated fallback only |

Regenerate showcase: see [examples/README.md](../examples/README.md).

---

## r/cursor

**Title:** CodeCortexLoop — `/cortexloop` runs 7 expert passes with health scores + self-improving playbook

**Body:**

I built a post-coding harness for Cursor (also Claude Code / OpenCode; other tools need extra setup):

- One slash command launches 7 sequential review passes (correctness → security → tests → …)
- Outputs an HTML dashboard with health score 0–100
- Direct mode fixes + re-verifies, then records patterns to a Playbook (with anti-hallucination trust tiers)
- CI/install: zero extra npm deps — gate, badge, PR comment scripts need Node only

**Not for everyone** — best if you already live in Cursor Agent mode. For small diffs try `/cortexloop-lite`.

Real run on **LianYu-PC** (Vue 3 + Spring Boot full stack, `/cortexloop-deep` Report): health score **28**, 81 findings.

Repo: https://github.com/whitequeen306/code-cortex-loop

Install: `curl -fsSL …/install-remote.sh | bash -s cursor`

Pre-generated report: `examples/lianyu-pc/docs/cortexloop/report.html`

Happy to answer questions — aiming for 24h response on first issues.

---

## Hacker News (Show HN)

**Title:** Show HN: CodeCortexLoop – seven-expert post-coding pipeline for Cursor/Claude Code

**Body:**

Show HN: harness that runs 7 sequential domain-expert review passes inside Cursor/Claude Code (Task subagents), outputs a health-score HTML dashboard, optional Direct fix+re-verify, and a project-local Playbook with verified/candidate tiers.

Not SaaS — rules + zero-extra-dep Node scripts for CI gate.

Case study (real repo scan, no source bundled): https://github.com/whitequeen306/code-cortex-loop/tree/main/examples/lianyu-pc

Try `/cortexloop-lite` for a minimal 3-pass path.

---

## Twitter / X

**Post 1:** GIF or LianYu showcase + one-liner + github link

**Post 2:** LianYu-PC case — score 28, 81 findings, link to `examples/lianyu-pc/docs/cortexloop/report.html`

---

## Pre-launch checklist

- [ ] Open `examples/lianyu-pc/docs/cortexloop/report.html` in browser
- [ ] README install one-liner works
- [ ] Release notes include screenshot
- [ ] Plan 24h issue response for first week
