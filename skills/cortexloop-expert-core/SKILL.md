---
name: cortexloop-expert-core
description: Shared CodeCortexLoop expert protocol — one pass, one category, handoff JSON, defer boundaries. Load this on every pipeline expert before domain skills.
---

# CodeCortexLoop Expert Core

Ultra-thin shared contract for all 7 pipeline experts. **Load this first**, then your pass contract (`passes/XX-*.md`) and domain depth skill(s) only.

## Your role

- You are **one expert in a fixed 7-pass pipeline** — not the orchestrator, not a general reviewer.
- Analyze **only your pass category**. Other categories belong to later experts.
- Write **category markdown + handoff JSON on disk** before returning.
- **Never invoke other agents** — the orchestrator runs the pipeline.

## Domain boundary

1. Read your pass contract for in-scope / out-of-scope lists.
2. If you notice a concern outside your category: **do not score it** — add `deferToLaterPasses` with target pass key + one-line note.
3. Do not "quickly check" security while doing correctness, tests while doing security, etc. Mentioning other domains in findings causes cross-pass noise.

## Inputs

- Scope file list from the spawn/delegation prompt
- **Prior handoff JSON paths** (if any) — read summaries and defer notes; do not re-run upstream analysis
- Playbook query output (if orchestrator enabled learning) — **recall only**, re-verify every claim

**Diff wins** over prior report claims when they disagree.

## Evidence gate (all experts)

A scored finding requires:

- Concrete trigger path, static proof, or reproducible gap
- Reachability under project invariants (no invented impossible states)
- Specific recommendation a human or Direct mode can act on

Low-confidence ideas → `openQuestions` only, not `findings`.

## Finding shape

```markdown
### [SEVERITY] [Title]
- **Location:** path:line
- **Category:** <your pass category only>
- **Problem:** ...
- **Evidence:** ...
- **Confidence:** high | medium
- **Recommendation:** ...
- **Auto-fixable:** yes | no | needs-confirmation
```

Map severity to: Critical / High / Medium / Low / Info.

## Handoff JSON

Write to the path in your pass contract. Required fields:

- `pass`, `category`, `expert`, `summary` (1–3 sentences for downstream experts)
- `findings` — scored items only
- `deferToLaterPasses` — `[{ "pass": "<passKey>", "note": "..." }]`
- `openQuestions` — unresolved, not scored

Schema: `schemas/pass-handoff.schema.json`

Also write the category markdown report path from your pass contract.

## Rules

1. One category per finding — never mix domains in a single scored item
2. Never inflate severity to create work
3. Never skip handoff files — orchestrator runs `validate-handoffs.mjs` before scoring
4. Depth skills tell you **how to go deep inside your domain** — they must not expand which category you score (defer other domains instead)

## Cross-validation (Step 3.5)

If a **later** pass deferred an issue to **your** pass (you already ran in Step 3), orchestrator may re-delegate a **targeted** catch-up. Then:

- Verify only the listed orphan items — do not full-rescan scope
- Append `crossValidation[]` on your handoff with `orphanId` + `verified` or `rejected`
- If `verified`, append a scored finding in **your category** and update category markdown
