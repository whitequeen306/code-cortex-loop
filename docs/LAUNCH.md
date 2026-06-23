# Launch materials — CodeCortexLoop v2.2.0

Use these drafts when posting to communities. **Lead with the GIF and one case study**, not a feature list. 中文版：[LAUNCH-zh.md](LAUNCH-zh.md)

Assets (prefer **real case study screenshots** over the demo GIF):

| Asset | Path | Use for |
|-------|------|---------|
| **Launch composite (recommended)** | `docs/assets/chokidar-launch-preview.png` | Reddit, Release, README |
| Hero (score + categories) | `docs/assets/chokidar-report-hero.png` | Twitter, thumbnails |
| Findings table | `docs/assets/chokidar-report-findings.png` | Second image in thread |
| Full page | `docs/assets/chokidar-report-full.png` | GitHub Release |
| Per-case full PNG | `examples/case-studies/<repo>/docs/cortexloop/report-dashboard.png` | Case study README |
| Demo GIF (optional) | `docs/assets/cortexloop-demo.gif` | Animated fallback only |

Regenerate: `python scripts/capture-dashboard-screenshot.py --case all --launch-assets`

---

## r/cursor

**Title:** CodeCortexLoop — `/cortexloop` runs 7 expert passes with health scores + self-improving playbook

**Body:**

I built a post-coding harness for Cursor (also Claude Code, with fallback on other tools):

- One slash command launches 7 sequential review passes (correctness → security → tests → …)
- Outputs an HTML dashboard with health score 0–100
- Direct mode fixes + re-verifies, then records patterns to a Playbook (with anti-hallucination trust tiers)
- Zero-dep Node scripts for CI gate, badge, PR comments

**Not for everyone** — best if you already live in Cursor Agent mode and want structure instead of ad-hoc "review my code".

Real run on chokidar (file watcher): found swallowed watcher errors, score 71→79 after Direct.

GIF: (attach `cortexloop-demo.gif`)
Repo: https://github.com/whitequeen306/code-cortex-loop

Install: `curl -fsSL …/install-remote.sh | bash -s cursor`

Happy to answer questions — aiming for 24h response on first issues.

---

## Hacker News (Show HN)

**Title:** Show HN: CodeCortexLoop – seven-expert post-coding pipeline for Cursor/Claude Code

**Body:**

CodeCortexLoop is a harness (commands + agents + zero-dep scripts) that turns "review my code" into a structured 7-pass pipeline with health scores, HTML dashboard, CI gate, and a Playbook that learns fix patterns with a trust model (candidate/verified tiers, negative signals).

Works best on Cursor and Claude Code where Task subagents give real domain isolation. Other tools degrade to single-session mode — documented honestly.

Case study on chokidar: https://github.com/whitequeen306/code-cortex-loop/tree/main/examples/case-studies/chokidar

Not a hosted service — competes more with "write your own Cursor rules" than CodeRabbit.

https://github.com/whitequeen306/code-cortex-loop

---

## Twitter / X

Post 1 (GIF thread):

> Built CodeCortexLoop — `/cortexloop` in Cursor runs 7 expert passes and outputs a health-score dashboard 🧵
>
> [attach GIF]
>
> Not SaaS. A harness + scripts. Best on Cursor/Claude Code.
>
> github.com/whitequeen306/code-cortex-loop

Post 2 (case study):

> Ran it on chokidar (npm file watcher):
> • Found swallowed watcher errors (High)
> • Score 71 → 79 after Direct mode
>
> Pre-generated report in repo — no install needed to preview:
> examples/case-studies/chokidar/docs/cortexloop/report.html

---

## Issue response SLA (first 2 weeks)

| Priority | Target response |
|----------|-----------------|
| Install / broken on Cursor or Claude | < 24h |
| Bug in scripts (ci-gate, playbook, etc.) | < 48h |
| Feature requests | Acknowledge + label; no commitment |
| "Why not just use X?" | Point to README comparison table |

Label first issues: `good first issue` for docs typos, missing case study metadata, install script edge cases.
