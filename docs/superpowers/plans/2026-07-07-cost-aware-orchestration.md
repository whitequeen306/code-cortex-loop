# Cost-Aware Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cost-aware presets and risk-based recommendation primitives so `/cortexloop` can become a smart router without defaulting every run to Full.

**Architecture:** Keep the first implementation centered on pure functions in `scripts/lib/shared.mjs`, because existing tests already treat this file as the shared orchestration contract. Command markdown and config examples consume those primitives conceptually; later orchestration work can call the same functions to build a normalized run plan.

**Tech Stack:** Node.js ESM, `node:test`, existing zero-dependency scripts.

---

## File Structure

- Modify `scripts/lib/shared.mjs`: add preset constants, budget config defaults, risk scoring, preset selection, enabled-pass mapping, and run-plan builder.
- Modify `tests/shared.test.mjs`: add TDD coverage for presets, scoring, config caps, and run-plan output.
- Modify `cortexloop.config.example.json`: document `budget` and `ci.preset` settings.
- Modify `cortexloop.config.minimal.json`: add minimal default budget settings.
- Modify `commands/cortexloop.md`: change the main command flow from direct Full pipeline to Mode -> Scope -> Preflight -> Preset confirmation -> optional Direct fix floor.
- Modify `README.md` and `docs/GUIDE.md`: update common commands and explain Lite / Standard / Full.
- Add or modify command aliases only after the shared plan tests pass.

### Task 1: Preset Constants and Enabled Passes

**Files:**
- Modify: `tests/shared.test.mjs`
- Modify: `scripts/lib/shared.mjs`

- [ ] **Step 1: Write failing tests for preset pass mapping**

Add these imports to `tests/shared.test.mjs`:

```js
  REVIEW_PRESETS,
  getPresetPasses,
  normalizeReviewPreset,
```

Add tests:

```js
test('review presets map to expected pass keys', () => {
  assert.deepEqual(REVIEW_PRESETS.lite.passes, ['review', 'security', 'errorHandling']);
  assert.deepEqual(REVIEW_PRESETS.standard.passes, ['review', 'security', 'tests', 'errorHandling']);
  assert.deepEqual(REVIEW_PRESETS.full.passes, ['review', 'security', 'tests', 'errorHandling', 'performance', 'simplicity', 'cleanup']);
});

test('getPresetPasses returns a copy so callers cannot mutate preset definitions', () => {
  const passes = getPresetPasses('lite');
  passes.push('cleanup');
  assert.deepEqual(getPresetPasses('lite'), ['review', 'security', 'errorHandling']);
});

test('normalizeReviewPreset accepts aliases and rejects invalid presets', () => {
  assert.equal(normalizeReviewPreset('quick'), 'lite');
  assert.equal(normalizeReviewPreset('deep'), 'full');
  assert.equal(normalizeReviewPreset('STANDARD'), 'standard');
  assert.throws(() => normalizeReviewPreset('maximum'), /preset/i);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --test tests/shared.test.mjs`

Expected: fail with missing exports from `scripts/lib/shared.mjs`.

- [ ] **Step 3: Add minimal preset implementation**

In `scripts/lib/shared.mjs`, after `PASS_KEYS`, add:

```js
export const REVIEW_PRESETS = {
  lite: {
    label: 'Lite',
    cost: 'low',
    passes: ['review', 'security', 'errorHandling'],
  },
  standard: {
    label: 'Standard',
    cost: 'medium',
    passes: ['review', 'security', 'tests', 'errorHandling'],
  },
  full: {
    label: 'Full',
    cost: 'high',
    passes: [...PASS_KEYS],
  },
};

export const REVIEW_PRESET_ORDER = ['lite', 'standard', 'full'];

export function normalizeReviewPreset(rawPreset = 'standard') {
  const value = String(rawPreset ?? 'standard').trim().toLowerCase();
  const aliases = {
    default: 'standard',
    quick: 'lite',
    deep: 'full',
  };
  const preset = aliases[value] ?? value;
  if (!Object.hasOwn(REVIEW_PRESETS, preset)) {
    throw new Error(`Invalid review preset: ${rawPreset}`);
  }
  return preset;
}

export function getPresetPasses(rawPreset = 'standard') {
  return [...REVIEW_PRESETS[normalizeReviewPreset(rawPreset)].passes];
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `node --test tests/shared.test.mjs`

Expected: pass.

### Task 2: Risk Scoring and Preset Recommendation

**Files:**
- Modify: `tests/shared.test.mjs`
- Modify: `scripts/lib/shared.mjs`

- [ ] **Step 1: Write failing tests for risk scoring**

Add these imports to `tests/shared.test.mjs`:

```js
  assessReviewRisk,
  recommendPresetForRisk,
```

Add tests:

```js
test('assessReviewRisk recommends lite for tiny documentation changes', () => {
  const risk = assessReviewRisk({
    changedFiles: ['README.md'],
    changedLines: 12,
    hasImplementationChanges: false,
    hasTestChanges: false,
  });
  assert.equal(risk.score, 0);
  assert.equal(risk.level, 'low');
  assert.equal(risk.recommendedPreset, 'lite');
  assert.deepEqual(risk.reasons, []);
});

test('assessReviewRisk recommends standard for medium implementation changes without tests', () => {
  const risk = assessReviewRisk({
    changedFiles: ['src/api/users.ts', 'src/ui/users.tsx'],
    changedLines: 340,
    hasImplementationChanges: true,
    hasTestChanges: false,
  });
  assert.equal(risk.level, 'medium');
  assert.equal(risk.recommendedPreset, 'standard');
  assert.ok(risk.reasons.includes('changed lines > 300'));
  assert.ok(risk.reasons.includes('api/controller/route path touched'));
  assert.ok(risk.reasons.includes('implementation changed but no tests changed'));
});

test('assessReviewRisk recommends full for high-risk auth and migration changes', () => {
  const risk = assessReviewRisk({
    changedFiles: ['src/auth/session.ts', 'db/migrations/20260707_users.sql'],
    changedLines: 920,
    hasImplementationChanges: true,
    hasTestChanges: false,
    crossModuleChange: true,
  });
  assert.equal(risk.level, 'high');
  assert.equal(risk.recommendedPreset, 'full');
  assert.ok(risk.score >= 7);
  assert.ok(risk.reasons.includes('auth/permission/session/token path touched'));
  assert.ok(risk.reasons.includes('database/migration/schema path touched'));
});

test('recommendPresetForRisk maps score thresholds', () => {
  assert.equal(recommendPresetForRisk(2).preset, 'lite');
  assert.equal(recommendPresetForRisk(3).preset, 'standard');
  assert.equal(recommendPresetForRisk(6).preset, 'standard');
  assert.equal(recommendPresetForRisk(7).preset, 'full');
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --test tests/shared.test.mjs`

Expected: fail with missing exports.

- [ ] **Step 3: Add minimal risk scoring implementation**

In `scripts/lib/shared.mjs`, after preset helpers, add:

```js
const RISK_PATH_PATTERNS = [
  { label: 'auth/permission/session/token path touched', points: 3, pattern: /(^|[/\\])(auth|permission|permissions|session|sessions|token|tokens)([/\\]|\.|$)/i },
  { label: 'payment/billing path touched', points: 3, pattern: /(^|[/\\])(payment|payments|billing|invoice|invoices)([/\\]|\.|$)/i },
  { label: 'database/migration/schema path touched', points: 2, pattern: /(^|[/\\])(db|database|databases|migration|migrations|schema|schemas)([/\\]|\.|$)/i },
  { label: 'api/controller/route path touched', points: 2, pattern: /(^|[/\\])(api|apis|controller|controllers|route|routes)([/\\]|\.|$)/i },
  { label: 'file upload/filesystem path touched', points: 2, pattern: /(^|[/\\])(upload|uploads|filesystem|fs|files)([/\\]|\.|$)/i },
  { label: 'external URL/webhook/http client path touched', points: 2, pattern: /(^|[/\\])(webhook|webhooks|http|client|clients|url|urls)([/\\]|\.|$)/i },
  { label: 'config/ci/build path touched', points: 1, pattern: /(^|[/\\])(config|configs|ci|build|workflow|workflows)([/\\]|\.|$)|(^|[/\\])\.github([/\\]|$)/i },
];

function addRisk(reasons, reasonSet, reason, points) {
  if (!reasonSet.has(reason)) {
    reasonSet.add(reason);
    reasons.push(reason);
    return points;
  }
  return 0;
}

export function recommendPresetForRisk(score) {
  if (score >= 7) return { level: 'high', preset: 'full' };
  if (score >= 3) return { level: 'medium', preset: 'standard' };
  return { level: 'low', preset: 'lite' };
}

export function assessReviewRisk({
  changedFiles = [],
  changedLines = 0,
  hasImplementationChanges = true,
  hasTestChanges = false,
  testsDeletedOrWeakened = false,
  crossModuleChange = false,
  largeDeletion = false,
  dependencyChanged = false,
} = {}) {
  const reasons = [];
  const reasonSet = new Set();
  let score = 0;

  if (changedLines > 800) score += addRisk(reasons, reasonSet, 'changed lines > 800', 3);
  else if (changedLines > 300) score += addRisk(reasons, reasonSet, 'changed lines > 300', 2);
  else if (changedLines > 100) score += addRisk(reasons, reasonSet, 'changed lines > 100', 1);

  if (changedFiles.length > 30) score += addRisk(reasons, reasonSet, 'changed files > 30', 3);
  else if (changedFiles.length > 15) score += addRisk(reasons, reasonSet, 'changed files > 15', 2);
  else if (changedFiles.length > 5) score += addRisk(reasons, reasonSet, 'changed files > 5', 1);

  for (const file of changedFiles) {
    for (const signal of RISK_PATH_PATTERNS) {
      if (signal.pattern.test(file)) {
        score += addRisk(reasons, reasonSet, signal.label, signal.points);
      }
    }
  }

  if (hasImplementationChanges && !hasTestChanges) {
    score += addRisk(reasons, reasonSet, 'implementation changed but no tests changed', 1);
  }
  if (testsDeletedOrWeakened) score += addRisk(reasons, reasonSet, 'tests deleted or weakened', 2);
  if (crossModuleChange) score += addRisk(reasons, reasonSet, 'cross-module change', 2);
  if (largeDeletion) score += addRisk(reasons, reasonSet, 'large deletion', 2);
  if (dependencyChanged) score += addRisk(reasons, reasonSet, 'dependency file changed', 1);

  const recommendation = recommendPresetForRisk(score);
  return {
    score,
    level: recommendation.level,
    recommendedPreset: recommendation.preset,
    reasons,
  };
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `node --test tests/shared.test.mjs`

Expected: pass.

### Task 3: Run Plan Builder and Budget Caps

**Files:**
- Modify: `tests/shared.test.mjs`
- Modify: `scripts/lib/shared.mjs`

- [ ] **Step 1: Write failing tests for run plan selection**

Add these imports to `tests/shared.test.mjs`:

```js
  buildReviewRunPlan,
  resolveReviewPreset,
```

Add tests:

```js
test('resolveReviewPreset uses auto recommendation when uncapped', () => {
  const result = resolveReviewPreset({
    requestedPreset: 'auto',
    recommendedPreset: 'full',
    maxPreset: 'full',
  });
  assert.equal(result.preset, 'full');
  assert.equal(result.reason, 'recommended');
});

test('resolveReviewPreset respects maxPreset budget cap', () => {
  const result = resolveReviewPreset({
    requestedPreset: 'auto',
    recommendedPreset: 'full',
    maxPreset: 'standard',
  });
  assert.equal(result.preset, 'standard');
  assert.equal(result.reason, 'budget.maxPreset=standard');
});

test('buildReviewRunPlan normalizes decisions into enabled passes and cost', () => {
  const plan = buildReviewRunPlan({
    mode: 'direct',
    scope: 'recent',
    requestedPreset: 'auto',
    maxPreset: 'standard',
    directFixFloor: 'Medium',
    risk: {
      score: 8,
      level: 'high',
      recommendedPreset: 'full',
      reasons: ['auth/permission/session/token path touched'],
    },
  });
  assert.equal(plan.mode, 'direct');
  assert.equal(plan.scope, 'recent');
  assert.equal(plan.preset, 'standard');
  assert.equal(plan.recommendedPreset, 'full');
  assert.equal(plan.selectionReason, 'budget.maxPreset=standard');
  assert.deepEqual(plan.enabledPasses, ['review', 'security', 'tests', 'errorHandling']);
  assert.deepEqual(plan.skippedPasses, ['performance', 'simplicity', 'cleanup']);
  assert.equal(plan.cost.level, 'medium');
  assert.equal(plan.cost.estimatedPasses, 4);
  assert.equal(plan.directFixFloor, 'Medium');
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --test tests/shared.test.mjs`

Expected: fail with missing exports.

- [ ] **Step 3: Add run-plan implementation**

In `scripts/lib/shared.mjs`, after risk helpers, add:

```js
function presetRank(preset) {
  return REVIEW_PRESET_ORDER.indexOf(normalizeReviewPreset(preset));
}

export function resolveReviewPreset({
  requestedPreset = 'auto',
  recommendedPreset = 'standard',
  maxPreset = 'full',
} = {}) {
  const max = normalizeReviewPreset(maxPreset);
  const requested = String(requestedPreset ?? 'auto').trim().toLowerCase();
  const target = requested === 'auto' ? normalizeReviewPreset(recommendedPreset) : normalizeReviewPreset(requested);
  if (presetRank(target) > presetRank(max)) {
    return { preset: max, reason: `budget.maxPreset=${max}` };
  }
  return { preset: target, reason: requested === 'auto' ? 'recommended' : 'user-selected' };
}

export function buildReviewRunPlan({
  mode = 'report',
  scope = 'recent',
  requestedPreset = 'auto',
  maxPreset = 'full',
  directFixFloor = null,
  risk = assessReviewRisk(),
} = {}) {
  const selection = resolveReviewPreset({
    requestedPreset,
    recommendedPreset: risk.recommendedPreset,
    maxPreset,
  });
  const enabledPasses = getPresetPasses(selection.preset);
  const enabledSet = new Set(enabledPasses);
  const skippedPasses = PASS_KEYS.filter((passKey) => !enabledSet.has(passKey));
  const preset = REVIEW_PRESETS[selection.preset];
  return {
    mode,
    scope,
    preset: selection.preset,
    requestedPreset,
    recommendedPreset: risk.recommendedPreset,
    selectionReason: selection.reason,
    directFixFloor,
    risk,
    enabledPasses,
    skippedPasses,
    cost: {
      level: preset.cost,
      estimatedPasses: enabledPasses.length,
    },
  };
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `node --test tests/shared.test.mjs`

Expected: pass.

### Task 4: Config Defaults and Schema Surface

**Files:**
- Modify: `cortexloop.config.example.json`
- Modify: `cortexloop.config.minimal.json`
- Modify: `schemas/cortexloop-config.schema.json`
- Test: `npm test`

- [ ] **Step 1: Inspect existing schema structure**

Read `schemas/cortexloop-config.schema.json` and identify where top-level optional objects are defined.

- [ ] **Step 2: Add budget config to examples**

Add this top-level block to `cortexloop.config.example.json` after `preset`:

```json
  "budget": {
    "defaultPreset": "auto",
    "askBeforeRun": true,
    "askBeforeFull": true,
    "maxPreset": "full"
  },
```

Add this field inside the existing `ci` object:

```json
    "preset": "standard",
    "upgradeToFullOnHighRisk": true,
```

Add this top-level block to `cortexloop.config.minimal.json`:

```json
  "budget": {
    "defaultPreset": "auto",
    "maxPreset": "full"
  },
```

- [ ] **Step 3: Update schema**

Add a top-level `budget` object with enum values `auto`, `lite`, `standard`, `full` for `defaultPreset` and `lite`, `standard`, `full` for `maxPreset`.

Add `ci.preset` with enum `auto`, `lite`, `standard`, `full` and `ci.upgradeToFullOnHighRisk` as boolean.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all tests pass.

### Task 5: Command Documentation Flow

**Files:**
- Modify: `commands/cortexloop.md`
- Modify: `commands/cortexloop-lite.md`
- Add: `commands/cortexloop-standard.md`
- Add: `commands/cortexloop-full.md`
- Modify: `commands/cortexloop-quick.md`
- Modify: `commands/cortexloop-deep.md`

- [ ] **Step 1: Update `/cortexloop` Step 1 flow**

Replace the current mode/scope/preset section with the sequence:

```markdown
## Step 1 — Mode, Scope, and Budget Preflight

1. Ask Mode unless CI or flags already determine it:
   - Report
   - Direct
2. Ask Scope unless CI/config already determine it:
   - Recent changes
   - Whole project
3. Run Budget Preflight for the selected scope:
   - Count changed files and changed lines
   - Detect sensitive path and structural risk signals
   - Compute risk score and recommended preset
   - Build a normalized run plan
4. Ask Preset confirmation unless a preset command or CI/config already selected it:
   - Lite
   - Standard
   - Full
5. Ask Direct fix floor only when mode is Direct.
```

Ensure the command states that `/cortexloop` should not launch Full without explicit user confirmation or non-interactive config.

- [ ] **Step 2: Add explicit standard and full command files**

Create `commands/cortexloop-standard.md` with frontmatter and instructions to run `/cortexloop` with `requestedPreset=standard` and no preset prompt.

Create `commands/cortexloop-full.md` with frontmatter and instructions to run `/cortexloop` with `requestedPreset=full` and no preset prompt.

- [ ] **Step 3: Deprecate quick and deep**

Change `commands/cortexloop-quick.md` to state it is a deprecated alias for `/cortexloop-lite`.

Change `commands/cortexloop-deep.md` to state it is a deprecated alias for `/cortexloop-full`.

- [ ] **Step 4: Run markdown consistency checks through tests**

Run: `npm test`

Expected: all tests pass.

### Task 6: README and Guide Updates

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/cost-aware-orchestration-design.md` only if implementation deviates from the accepted design.

- [ ] **Step 1: Update README common commands**

Replace command descriptions so they say:

```markdown
| `/cortexloop` | Smart router: asks mode/scope, runs preflight, recommends Lite / Standard / Full |
| `/cortexloop-lite` | Low-cost review for small changes |
| `/cortexloop-standard` | Standard PR review: correctness, security, tests, error handling |
| `/cortexloop-full` | Full 7-pass review |
| `/cortexloop-security` | Security-focused workflow |
| `/cortexloop-pre-pr` | PR gate workflow |
```

- [ ] **Step 2: Move baseline and reflect to advanced command wording**

Keep `/cortexloop-baseline` and `/cortexloop-reflect`, but list them as advanced commands instead of primary commands.

- [ ] **Step 3: Update GUIDE with the same command model**

Mirror the README command model in `docs/GUIDE.md`.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all tests pass.

### Task 7: Final Verification and Review

**Files:**
- All modified files.

- [ ] **Step 1: Run targeted tests**

Run: `node --test tests/shared.test.mjs`

Expected: pass.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: pass.

- [ ] **Step 3: Inspect diff**

Run: `git diff --stat`

Expected: changed files match this plan.

- [ ] **Step 4: Request code review**

Use `requesting-code-review` before marking complete. The review should focus on preset semantics, risk scoring false positives, config/schema consistency, and command user flow.

## Self-Review

- Spec coverage: The plan covers command model, presets, scoring, CI caps, run plan, observability fields, and docs updates from `docs/cost-aware-orchestration-design.md`.
- Placeholder scan: No TBD/TODO placeholders remain in the plan. The only deferred behavior is explicitly listed as non-goal in the design.
- Type consistency: Preset names are consistently `lite`, `standard`, `full`; CI/config uses `auto` only as a requested preset, never as an executable preset.
