# CodeCortexLoop

![CodeCortexLoop on chokidar — real report: health score + findings](docs/assets/chokidar-launch-preview.png)

<details>
<summary>Animated demo (optional)</summary>

![Demo: health score 58 → 82 after Direct mode](docs/assets/cortexloop-demo.gif)

</details>

**One command. Seven domain experts. Self-improving playbook.**

Post-coding pipeline for AI coding tools: **correctness → security → tests → error handling → performance → simplicity → cleanup** — with health scores, HTML dashboard, CI gate, and bilingual Playbook.

[![Health badge](examples/demo-app/.cortexloop/health-badge.svg)](examples/demo-app/docs/cortexloop/report.html)

## Install (one line)

```bash
curl -fsSL https://raw.githubusercontent.com/whitequeen306/code-cortex-loop/main/scripts/install-remote.sh | bash -s cursor
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/whitequeen306/code-cortex-loop/main/scripts/install-remote.ps1 | iex; Install-CodeCortexLoop -Tool cursor
```

Replace `cursor` with `claude` | `qoder` | `trae` | `opencode` | `codex` | `all`. Restart your tool, then type `/cortexloop`.

Or clone and install locally — see [docs/GUIDE.md](docs/GUIDE.md).

---

## Should you use this? (3 questions)

Answer **No** to any → probably skip us (and that's OK):

| Question | Why it matters |
|----------|----------------|
| Do you use **Cursor** or **Claude Code** regularly? | Only these tools get **real** Task subagent isolation. Others fall back to single-session mode. |
| Is your change set **≥ a few hundred lines** or a meaningful feature? | Overkill for typos — use your linter instead. |
| Can you spend **~3–10 minutes** per full run? | See [performance budget](docs/PERFORMANCE.md). Use `/cortexloop-quick` for small PRs. |

---

## vs alternatives

| | CodeCortexLoop | CodeRabbit / Copilot Review | SonarQube / Snyk | DIY Cursor rules |
|--|----------------|----------------------------|------------------|------------------|
| **Runs where** | Inside your AI IDE session | Hosted PR bot | CI / server | Your chat |
| **Multi-domain pass** | 7 sequential experts | Single review | Rule scanners | Whatever you prompt |
| **Learns per repo** | Playbook (verified/candidate tiers) | Product memory | Issue baselines | Manual |
| **Cost model** | Your model tokens | Subscription | License / cloud | Your time writing rules |
| **Best for** | AI-native devs who already live in Cursor/Claude | Teams wanting zero-setup PR review | Compliance / static analysis | Tinkerers |

We are **not** a hosted SaaS. We are a **harness + scripts** that makes your existing AI tool behave like a structured review team.

---

## Real results (case studies)

| Repo | Score | Top issue | Report |
|------|-------|-----------|--------|
| [chokidar](examples/case-studies/chokidar/) | 71 → 79 | Watcher error events swallowed | [dashboard](examples/case-studies/chokidar/docs/cortexloop/report.html) |
| [fastify-hello](examples/case-studies/fastify-hello/) | 64 | Unauthenticated admin DELETE | [dashboard](examples/case-studies/fastify-hello/docs/cortexloop/report.html) |
| [flask-todo](examples/case-studies/flask-todo/) | 68 | SQL injection in search | [dashboard](examples/case-studies/flask-todo/docs/cortexloop/report.html) |

Plus a [deliberately buggy demo app](examples/demo-app/) for learning the tool.

---

## Tool support

| Tool | Task subagents | Notes |
|------|----------------|-------|
| **Cursor** | Full | Recommended |
| **Claude Code** | Full | Recommended |
| Qoder, Trae, OpenCode, Codex | **Fallback** | Single session plays all 7 passes — no agent isolation |

---

## Quick start

```text
/cortexloop          # full pipeline — pick Report or Direct
/cortexloop-quick    # 3 passes — good for small PRs
/cortexloop-pre-pr   # pre-merge gate
```

After a run:

```bash
node scripts/run-summary.mjs      # passes, duration, est. tokens
node scripts/validate-handoffs.mjs # fail-fast if pipeline incomplete
```

Open `docs/cortexloop/report.html` in your browser.

---

## Performance budget

| Mode | Passes | Est. time* | Est. tokens* |
|------|--------|------------|--------------|
| `/cortexloop-quick` | 3 | ~2–4 min | ~80k–150k |
| `/cortexloop` | 7 | ~5–12 min | ~200k–450k |

\* Estimates for ~500 LOC scope on Cursor/Claude. [Full methodology →](docs/PERFORMANCE.md)

Post-processing scripts: **~416ms** median (measured, zero LLM).

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/GUIDE.md](docs/GUIDE.md) | Full feature guide, CI, config, Playbook |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Performance budget methodology |
| [docs/LAUNCH.md](docs/LAUNCH.md) | Community announcement drafts |
| [docs/LAUNCH-zh.md](docs/LAUNCH-zh.md) | 推广文案（中文） |
| [examples/case-studies/](examples/case-studies/) | Real repo analysis outputs |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## License

MIT — see [LICENSE](LICENSE)
