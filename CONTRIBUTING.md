# Contributing to CodeCortexLoop

Thanks for helping make this harness useful to strangers, not just its author.

## Dev setup

```bash
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd code-cortex-loop
npm test
```

Requirements: **Node.js 18+** only. No npm dependencies.

## Install locally into your tool

```bash
./scripts/install.sh cursor   # or install.ps1 -Tool cursor on Windows
```

Restart Cursor/Claude Code and run `/cortexloop` in a test project.

## What to contribute

| Area | Examples |
|------|----------|
| **Case studies** | New `examples/case-studies/<repo>/` with real report.json + handoffs |
| **Scripts** | Tests required in `tests/*.test.mjs` |
| **Pass contracts** | Changes affect all 7 agents — discuss in issue first |
| **Docs** | README stays short; long content → `docs/GUIDE.md` |

## What NOT to contribute (for now)

- New pass types / agents / skills without an issue discussing scope
- README bloat — link to `docs/` instead
- Breaking changes to handoff schema without migration note

## Pull request checklist

- [ ] `npm test` passes
- [ ] If adding/changing scripts: test file added or updated
- [ ] If changing orchestrator behavior: `commands/cortexloop.md` + `AGENTS.md` updated
- [ ] No secrets or API keys in examples

## Issue templates

Use GitHub issue templates for bugs and feature requests. Include:

- Tool (Cursor / Claude / …)
- Command used (`/cortexloop`, `/cortexloop-quick`, …)
- Whether handoff JSON was produced

## Code style

- ESM (`.mjs`) for scripts
- Zero npm runtime dependencies
- Fail-fast with clear exit codes (see `ci-gate.mjs`, `validate-handoffs.mjs`)

## License

By contributing, you agree your contributions are licensed under the project's MIT license.
