---
name: cortexloop-architecture
description: Architectural coupling analysis and interactive refactoring guide — detects circular dependencies, God Objects, and tight coupling.
disable-model-invocation: true
---

# CodeCortexLoop Architecture

Analyze architectural coupling, detect refactoring opportunities, and optionally execute guided refactoring.

**This is NOT part of the standard 7-pass pipeline.** It runs independently for monthly/quarterly architecture reviews.

## When to Use

- Monthly/quarterly architecture health checks
- Before refactoring sprints
- When modules become hard to test
- Before major releases
- When team discusses "this code is tangled"

## What It Does

1. **Analysis Phase** (automatic)
   - Build dependency graph
   - Detect circular dependencies
   - Detect God Objects (modules with too many responsibilities)
   - Detect Feature Envy (modules over-dependent on others)
   - Calculate coupling metrics (fan-in, fan-out, CBO)

2. **Report Phase** (automatic)
   - Generate `docs/cortexloop/architecture-analysis.md` (human-readable)
   - Generate `.cortexloop/architecture-cache.json` (machine-readable)
   - Show summary in chat with priority-ranked coupling points

3. **Decision Phase** (interactive)
   - Ask: "要对这些耦合点执行重构吗？"
   - Options: Yes (proceed to Phase 4) / No (stop, report saved)

4. **Refactoring Phase** (optional, interactive)
   - Present 2-3 refactoring solutions per coupling
   - User selects which coupling to fix
   - Show detailed plan (steps, impact, cost, risk)
   - Execute refactoring with user confirmation
   - Run tests after each module refactoring
   - Roll back on test failure

## Command Variants

```text
/cortexloop-architecture              Default: analyze + ask refactor
/cortexloop-architecture --report-only   Force report-only, skip refactor prompt
/cortexloop-architecture --auto-refactor High risk: skip confirmation (not recommended)
```

Default behavior (no flags) is recommended: analyze → report → ask user.

## Workflow

Follow all steps in `agents/architecture-analyst.md`.

**Agent:** `architecture-analyst`  
**Skill:** `architecture-analysis`

Load skill first, then follow agent workflow.

## Output Artifacts

| File | Purpose |
|------|---------|
| `docs/cortexloop/architecture-analysis.md` | Human-readable report with coupling details and refactoring solutions |
| `.cortexloop/architecture-cache.json` | Machine-readable cache for session recovery |
| `.cortexloop/refactoring-playbook.json` | Refactoring patterns that worked (optional, after successful refactoring) |

## Comparison with Standard 7-Pass Pipeline

| Dimension | Standard `/cortexloop` | `/cortexloop-architecture` |
|-----------|------------------------|----------------------------|
| **Frequency** | Every PR | Monthly/quarterly |
| **Pipeline** | 7-pass sequential | Independent command |
| **Scope** | Audit + find issues | Refactor architecture |
| **Auto-fix** | Direct mode auto-fixes bugs | Must confirm each refactoring |
| **Output** | Findings + health score | Refactoring report + optional execution |
| **Handoff** | Writes `.cortexloop/handoff/*.json` | No handoff |

## Detected Coupling Types

1. **Circular Dependency**  
   Module A → Module B → Module A (or A → B → C → A)

2. **God Object**  
   Module with > 10 imports, > 500 lines, or > 20 exports

3. **Feature Envy**  
   Module calls another module more than its own methods

4. **Inappropriate Intimacy**  
   Two modules access each other's internals excessively

5. **Shotgun Surgery**  
   Single change requires modifying many files

## Refactoring Patterns Library

For each coupling type, the skill provides 2-3 refactoring solutions:

- **Extract Interface** — Break circular deps
- **Dependency Inversion** — Depend on abstractions
- **Facade** — Hide God Object complexity
- **Split by Responsibility** — Decompose God Object
- **Move Method** — Fix Feature Envy

## Priority Scoring

Each coupling gets a priority score:

- **High** (score >= 5): Core modules, high impact, CBO > 15
- **Medium** (score 3-4): Utility modules, moderate impact
- **Low** (score <= 2): Test-only, isolated modules

Priority factors:
- Coupling type weight (circular dep = +3, God Object = +2)
- Impact weight (files affected)
- CBO weight (coupling between objects)

## Interactive Refactoring Flow

If user chooses to refactor:

```text
1. Select coupling to fix:
   A. Circular dep: users.ts ↔ auth.ts
   B. God Object: Dashboard.tsx
   C. Execute all
   D. Stop

2. User selects A

3. Show detailed plan:
   推荐方案：提取 UserAuthContext 到独立模块
   步骤：
   - 创建 src/auth/UserAuthContext.ts
   - 迁移逻辑
   - 更新引用
   
   影响：7 个文件
   成本：Medium
   风险：Low
   
   确认执行？ A. 是  B. 否  C. 看 diff

4. User confirms

5. Execute refactoring step by step

6. Run tests

7. If tests pass: ✓ 解耦成功
   If tests fail: offer rollback or fix

8. Continue with next coupling or stop
```

## Cost Estimation

| Project size | Analysis time | Estimated tokens |
|--------------|---------------|------------------|
| Small (<50 files) | ~1-2 min | ~50k-100k |
| Medium (50-200 files) | ~3-5 min | ~150k-300k |
| Large (200+ files) | ~8-15 min | ~400k-800k |

Interactive refactoring:
- Per coupling point: ~2-5 min
- Per coupling point tokens: ~50k-150k

**Recommendation:** Analyze first, refactor 1-2 high-priority couplings only.

## Red Flags

**Do NOT refactor when:**
- Tests are already failing
- Production incident is ongoing
- Code freeze is active
- Module will be removed soon
- Coupling is intentional (e.g., DTO shared between API and DB)

**Do NOT auto-refactor when:**
- Impact > 10 files
- Tests are missing
- Risk level is High

## Session Recovery

If user runs analysis in one session, then later says:

```text
我看了 architecture-analysis.md，现在想执行第 2 个解耦
```

The agent will:
1. Read report from disk
2. Find coupling #2
3. Quick diff check (has code changed?)
4. If unchanged, proceed to refactoring
5. If changed, suggest re-running analysis

## Example Output

### Chat Summary

```text
✓ 分析完成

报告已写入：docs/cortexloop/architecture-analysis.md

发现 3 处高耦合：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. src/api/users.ts ↔ src/services/auth.ts
   问题：循环依赖
   优先级：High
   推荐方案：提取 UserAuthContext 到独立模块
   影响文件：2 个核心文件 + 5 个引用

2. src/ui/Dashboard.tsx
   问题：直接依赖 5 个 service
   优先级：Medium
   推荐方案：引入 Facade 或拆分组件
   影响文件：1 个主文件 + 12 个测试

3. src/lib/utils.ts
   问题：被 20+ 模块依赖
   优先级：Low
   推荐方案：按功能拆分
   影响文件：1 个工具文件 + 20+ 引用
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

要对这些耦合点执行重构吗？

A. 是，开始交互式重构
B. 否，只保留报告
```

### Report File

See `docs/cortexloop/architecture-analysis.md` for human-readable markdown report with:
- Coupling details
- Metrics (CBO, fan-in, fan-out)
- 2-3 refactoring solutions per coupling
- Pros/cons for each solution
- Cost and risk estimates

## Post-Processing Scripts

No post-processing scripts for architecture analysis (it's independent from the 7-pass pipeline).

Optional:
- Record successful refactoring patterns to `.cortexloop/refactoring-playbook.json`

## Configuration

Optional config in `cortexloop.config.json`:

```json
{
  "architecture": {
    "scope": "whole-project",
    "excludePatterns": ["**/test/**", "**/dist/**"],
    "minCBO": 10,
    "minGodObjectLines": 500,
    "autoRefactor": false
  }
}
```

Default: analyze whole project, exclude test/dist, CBO threshold 10, God Object threshold 500 lines.

## Next Steps

After running `/cortexloop-architecture`:

1. **Review report** — Understand coupling points
2. **Prioritize** — Pick 1-2 high-priority couplings
3. **Refactor** — Use interactive mode or refactor manually
4. **Re-run** — After refactoring, re-run to verify improvement
5. **Document** — Share report with team for architecture discussions

## Related Commands

| Command | Purpose |
|---------|---------|
| `/cortexloop` | Standard 7-pass review |
| `/cortexloop-lite` | Lightweight review (3 passes) |
| `/cortexloop-full` | Full 7-pass deep review |
| `/cortexloop-architecture` | This command — architecture analysis |

Architecture analysis complements standard reviews but runs independently.
