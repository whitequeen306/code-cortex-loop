# Skill: architecture-analysis

## Overview

Detect architectural coupling, identify refactoring opportunities, and guide interactive refactoring decisions.

**Use this skill when:**
- Running `/cortexloop-architecture`
- Analyzing dependency graphs
- Detecting God Objects, circular dependencies, or tight coupling
- Guiding architectural refactoring

**Do NOT use this skill when:**
- Running standard 7-pass review (use domain-specific skills instead)
- Fixing bugs (use `correctness-review`)
- Hardening security (use `security-and-hardening`)
- Simplifying code without changing architecture (use `code-simplification`)

## Relationship with Pass 6 (Simplicity)

**Architecture Analysis (this skill)** and **Pass 6 Simplicity** have overlapping goals but different scopes:

| Dimension | Architecture Analysis | Pass 6 Simplicity |
|-----------|----------------------|-------------------|
| **Scope** | Module/package level | Function/class level |
| **Focus** | Dependency structure | Code clarity |
| **Changes** | Refactor architecture | Simplify implementation |
| **Frequency** | Monthly/quarterly | Every PR |
| **Examples** | Break circular deps, split God Objects | Remove unnecessary abstraction, inline small functions |

**When to use Architecture Analysis:**
- Circular dependencies between modules
- God modules (> 500 lines, fan-out > 10)
- Need to restructure module boundaries

**When to use Simplicity (pass 6):**
- Over-engineered functions
- Unnecessary abstraction layers within a module
- Complex nested logic that can be flattened

**They complement each other:**
- Architecture Analysis fixes structural coupling
- Simplicity fixes implementation complexity
- Both improve maintainability

**Example:**

```text
Problem: Dashboard.tsx (800 lines) directly imports 8 services

Architecture Analysis says:
→ Introduce DashboardFacade to hide service complexity (module-level refactor)

After that, Simplicity (pass 6) says:
→ DashboardFacade.getUserData() has nested callbacks, flatten with async/await (code-level simplification)
```

## Core Concepts

### 1. Coupling Types

#### Circular Dependency

**Definition:** Module A depends on Module B, and Module B depends on Module A (directly or transitively).

**Detection method:**
1. Build dependency graph
2. Run cycle detection algorithm (DFS with recursion stack)
3. Report all cycles with participant modules

**Types:**

1. **Direct cycle** (2 modules):
   ```
   A → B → A
   ```
   Example: `users.ts` imports `auth.ts`, `auth.ts` imports `users.ts`

2. **Transitive cycle** (3+ modules):
   ```
   A → B → C → A
   ```
   Example: `api.ts` → `service.ts` → `repository.ts` → `api.ts`

**Symptoms:**
- Cannot import modules in certain orders
- Build fails with "circular import" errors
- Difficult to test modules in isolation
- Changes cascade across multiple files

**Refactoring patterns:**
- Extract shared interface to new module
- Dependency inversion (depend on abstractions)
- Move shared logic to third module
- Break cycle at weakest dependency point

#### God Object / God Module

**Definition:** A module that knows too much or does too much.

**Detection method:**
1. Count responsibilities (lines of code, methods, imported dependencies)
2. Check if module imports > 10 other modules
3. Check if module exports > 20 functions/classes

**Symptoms:**
- File > 500 lines
- Module imports from many unrelated domains
- Changes to module require touching many tests

**Refactoring patterns:**
- Extract responsibilities by domain
- Split by layer (data / business logic / presentation)
- Apply Single Responsibility Principle

#### Feature Envy

**Definition:** A module that uses methods/data from another module more than its own.

**Detection method:**
1. Count cross-module calls vs internal calls
2. If cross-module calls > 50% of total, flag as Feature Envy

**Symptoms:**
- Module A has many method calls to Module B
- Module A mostly operates on Module B's data

**Refactoring patterns:**
- Move method to the envied module
- Extract shared behavior to new module

#### Inappropriate Intimacy

**Definition:** Two modules are too tightly coupled, accessing each other's internals.

**Detection method:**
1. Check if modules import each other's private/internal symbols
2. Count bidirectional dependencies
3. Check if changes to one module often require changes to the other

**Symptoms:**
- Modules expose internal structure for each other
- Tests for one module require mocking the other extensively

**Refactoring patterns:**
- Use Facade to hide internals
- Introduce message passing / events
- Merge modules if they truly belong together

#### Shotgun Surgery

**Definition:** A single change requires modifications across many modules.

**Detection method:**
1. Analyze git history: find commits that touch > 5 files
2. Identify common change patterns

**Symptoms:**
- Adding a feature requires editing 10+ files
- Bug fixes cascade across modules

**Refactoring patterns:**
- Move related code together
- Introduce abstraction layer
- Use polymorphism to reduce branching

### 2. Coupling Metrics

#### Fan-In

Number of modules that depend on this module.

**Interpretation:**
- High fan-in (> 20): Module is a hub, changes have wide impact
- Low fan-in (< 3): Module is isolated, safe to refactor

#### Fan-Out

Number of modules this module depends on.

**Interpretation:**
- High fan-out (> 10): Module is too dependent, hard to test
- Low fan-out (< 5): Module is cohesive

#### Coupling Between Objects (CBO)

Total number of other classes/modules this class/module is coupled to.

**Formula:** `CBO = fan-in + fan-out`

**Interpretation:**
- CBO > 15: High coupling, consider refactoring
- CBO < 8: Good coupling level

### 3. Dependency Graph Construction

**Steps:**

1. **Parse imports/requires** (language-specific)

   **JavaScript/TypeScript:**
   ```javascript
   // Match patterns:
   import { X } from './module'       // ES6 import
   import X from './module'
   const X = require('./module')      // CommonJS
   import('./module')                 // dynamic import
   
   // Extract: './module' → resolve to absolute path
   ```

   **Python:**
   ```python
   # Match patterns:
   import module                     # absolute import
   from module import X              # from import
   from . import module              # relative import
   from .. import module             # parent relative
   
   # Extract: 'module' → resolve to file path
   ```

   **Java:**
   ```java
   // Match patterns:
   import com.example.Module;        // class import
   import com.example.*;             // wildcard import
   
   // Extract: package path → resolve to file
   ```

   **Go:**
   ```go
   // Match patterns:
   import "github.com/user/module"   // external package
   import "./module"                 // relative import
   
   // Extract: import path → resolve to directory
   ```

   **General approach:**
   - Use AST parsing when available (e.g., `@babel/parser` for JS, `ast` for Python)
   - Fall back to regex for simple cases
   - Normalize relative paths to absolute paths
   - Filter out external dependencies (focus on project-internal modules)

2. **Build adjacency list**
   ```javascript
   {
     "src/api/users.ts": ["src/services/auth.ts", "src/db/user-repo.ts"],
     "src/services/auth.ts": ["src/api/users.ts", "src/db/user-repo.ts"],
     ...
   }
   ```

   **Important:** Use absolute paths or project-relative paths to avoid ambiguity.

3. **Detect cycles**
   - Use DFS with visited/recursion stack
   - Record all back edges as cycles

4. **Calculate metrics**
   - fan-in: count incoming edges
   - fan-out: count outgoing edges
   - CBO: sum of both

## Detection Workflow

### Step 1: Build Dependency Graph

Ask for project structure or use file system scan.

**If project is small (<50 files):**
- Scan all files
- Parse all imports

**If project is medium/large (>50 files):**
- Focus on changed files (from scope)
- Expand to direct dependencies
- Sample indirect dependencies

### Step 2: Detect Circular Dependencies

Run cycle detection:

```python
def detect_cycles(graph):
    visited = set()
    rec_stack = set()
    cycles = []
    
    def dfs(node, path):
        visited.add(node)
        rec_stack.add(node)
        
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                dfs(neighbor, path + [node])
            elif neighbor in rec_stack:
                # Found cycle: reconstruct from path
                cycle_start = path.index(neighbor) if neighbor in path else 0
                cycle = path[cycle_start:] + [node, neighbor]
                cycles.append(cycle)
        
        rec_stack.remove(node)
    
    for node in graph:
        if node not in visited:
            dfs(node, [])
    
    return cycles
```

### Step 3: Calculate Coupling Metrics

For each module:

```python
def calculate_metrics(graph, module):
    fan_out = len(graph.get(module, []))
    fan_in = sum(1 for m in graph if module in graph.get(m, []))
    cbo = fan_in + fan_out
    return {"fan_in": fan_in, "fan_out": fan_out, "cbo": cbo}
```

### Step 4: Detect God Objects

```python
def detect_god_objects(modules):
    god_objects = []
    for module in modules:
        metrics = calculate_metrics(graph, module)
        lines = count_lines(module)
        
        if metrics["fan_out"] > 10 and lines > 500:
            god_objects.append({
                "module": module,
                "fan_out": metrics["fan_out"],
                "lines": lines,
                "severity": "high" if lines > 1000 else "medium"
            })
    return god_objects
```

### Step 5: Prioritize Coupling Points

**Priority scoring:**

```python
def priority_score(coupling):
    score = 0
    
    # Type weight
    if coupling["type"] == "circular-dependency":
        score += 3
    elif coupling["type"] == "god-object":
        score += 2
    elif coupling["type"] == "feature-envy":
        score += 2
    elif coupling["type"] == "inappropriate-intimacy":
        score += 2
    elif coupling["type"] == "shotgun-surgery":
        score += 1
    
    # Impact weight
    if coupling["impact"]["files"] > 10:
        score += 2
    elif coupling["impact"]["files"] > 5:
        score += 1
    
    # CBO weight
    if coupling["cbo"] > 15:
        score += 2
    elif coupling["cbo"] > 10:
        score += 1
    
    return score
```

**Priority levels:**
- Score >= 5: **High**
- Score 3-4: **Medium**
- Score <= 2: **Low**

**Examples:**

1. **Circular dependency between 2 core modules, CBO=15, impacts 8 files:**
   - Type: +3 (circular-dependency)
   - Impact: +1 (8 files > 5)
   - CBO: +2 (15 > 15)
   - **Total: 6 → High**

2. **Circular dependency between 2 utility modules, CBO=4, impacts 2 files:**
   - Type: +3 (circular-dependency)
   - Impact: 0 (2 files <= 5)
   - CBO: 0 (4 <= 10)
   - **Total: 3 → Medium**

3. **God Object with 20 imports, impacts 15 files:**
   - Type: +2 (god-object)
   - Impact: +2 (15 files > 10)
   - CBO: +2 (assuming CBO > 15)
   - **Total: 6 → High**

**Rule of thumb for circular dependencies:**
- **High** when: Core modules (API/service layer) OR impacts > 5 files OR CBO > 15
- **Medium** when: Utility modules OR impacts <= 5 files OR CBO <= 10
- **Low** when: Test-only modules OR single-file cycles (rare)

### Confidence Levels

Each coupling detection should include a confidence level:

- **High confidence:** Detected via static analysis (AST parsing, import statements)
- **Medium confidence:** Detected via heuristics (file naming, directory structure)
- **Low confidence:** Detected via pattern matching (regex on code content)

**Examples:**

- Circular dependency detected via import parsing → **High confidence**
- God Object detected via fan-out count → **High confidence**
- Feature Envy detected via cross-module call count → **Medium confidence** (requires runtime analysis or deep AST walk)
- Shotgun Surgery detected via git history → **Medium confidence** (historical, not current state)

**Report only High/Medium confidence findings.** Discard Low confidence findings to reduce false positives.

## Refactoring Solution Generation

For each coupling point, generate 2-3 refactoring solutions.

### Solution Template

```json
{
  "id": "solution-1a",
  "label": "Extract UserAuthContext to independent module",
  "recommended": true,
  "confidence": "high",
  "pattern": "extract-interface",
  "steps": [
    "Create src/auth/UserAuthContext.ts",
    "Move auth-related logic from users.ts",
    "Update auth.ts references",
    "Update all callers"
  ],
  "pros": [
    "Breaks circular dependency",
    "Clearer responsibility"
  ],
  "cons": [
    "Requires new module",
    "Need to update 7 files"
  ],
  "impact": {
    "newFiles": 1,
    "modifiedFiles": 7,
    "testsRequired": true
  },
  "cost": "medium",
  "risk": "low"
}
```

### Refactoring Patterns Library

#### Pattern: Extract Interface

**When to use:** Circular dependency, tight coupling

**Steps:**
1. Identify shared concepts
2. Create new interface/module
3. Move shared logic to new module
4. Update both modules to depend on new module

**Example:**
```text
Before:
  users.ts → auth.ts
  auth.ts → users.ts

After:
  users.ts → UserAuthContext.ts
  auth.ts → UserAuthContext.ts
```

#### Pattern: Dependency Inversion

**When to use:** Circular dependency, high coupling

**Steps:**
1. Define abstract interface
2. Make concrete implementations depend on abstraction
3. Inject dependencies at runtime

**Example:**
```typescript
// Before
class UserService {
  constructor() {
    this.auth = new AuthService(); // tight coupling
  }
}

// After
interface IAuthService { ... }

class UserService {
  constructor(private auth: IAuthService) {} // depend on abstraction
}
```

#### Pattern: Facade

**When to use:** God Object, Feature Envy

**Steps:**
1. Create facade module
2. Expose simplified interface
3. Hide internal complexity

**Example:**
```typescript
// Before: Dashboard directly calls 5 services
import { UserService } from './user-service';
import { OrderService } from './order-service';
import { PaymentService } from './payment-service';
...

// After: Dashboard calls Facade
import { DashboardFacade } from './dashboard-facade';
```

#### Pattern: Split by Responsibility

**When to use:** God Object

**Steps:**
1. Identify distinct responsibilities
2. Create separate modules per responsibility
3. Move code accordingly
4. Update callers

**Example:**
```text
Before:
  utils.ts (1000 lines)
    - string utilities
    - date utilities
    - validation utilities
    - http utilities

After:
  string-utils.ts
  date-utils.ts
  validation-utils.ts
  http-utils.ts
```

#### Pattern: Move Method

**When to use:** Feature Envy

**Steps:**
1. Identify method that uses another module heavily
2. Move method to that module
3. Update original module to call the moved method

## Interactive Refactoring Workflow

### Phase 1: Confirm Execution

Present coupling point and ask:

```text
要执行哪个解耦？

A. 执行第 1 个（users + auth 循环依赖）
B. 执行第 2 个（Dashboard 耦合）
C. 执行第 3 个（utils 拆分）
D. 依次执行全部
E. 停止
```

### Phase 2: Show Detailed Plan

```text
执行解耦：src/api/users.ts ↔ src/services/auth.ts

推荐方案：提取 UserAuthContext 到独立模块

详细步骤：
1. 创建 src/auth/UserAuthContext.ts
2. 将 users.ts 中的 auth 相关逻辑迁移
3. 更新 auth.ts 引用
4. 更新所有调用方

预计影响：
- 新增文件：1
- 修改文件：7
- 需要更新测试：是

优点：
- 解除循环依赖
- 职责更清晰

缺点：
- 需要新增一个模块
- 需要更新 7 个文件

成本估算：Medium
风险等级：Low

确认执行？
A. 是
B. 否，跳过这个
C. 看详细 diff 再决定
```

### Phase 3: Execute Refactoring

If user chooses A:

1. **Create new files** (if needed)
2. **Move code** step by step
3. **Update references** in all callers
4. **Show diff** after each major step

### Phase 4: Run Tests

After refactoring:

```bash
# Run relevant tests
npm test -- users auth

# If tests pass
✓ tests/api/users.test.ts 通过
✓ tests/services/auth.test.ts 通过

# Run full suite
npm test

# If full suite passes
✓ 全量测试通过
```

### Phase 5: Handle Failures

If tests fail:

```text
✗ tests/api/users.test.ts 失败
  - UserController.login 返回 undefined

检测到测试失败。

选项：
A. 回滚这次重构，保留报告
B. 尝试修复测试（可能需要你手动介入）
C. 忽略失败，继续下一个解耦（不推荐）
```

**If user chooses A (rollback):**

```bash
git checkout -- src/api/users.ts src/services/auth.ts src/auth/
```

**If user chooses B (fix):**

1. Analyze test failure
2. Identify root cause
3. Propose fix
4. Apply fix
5. Re-run tests

## Report Generation

### Human-Readable Report

`docs/cortexloop/architecture-analysis.md`

```markdown
# 架构解耦分析

**分析时间：** 2026-07-08 10:30:00
**分析范围：** 整个项目
**发现耦合点：** 3 处

## 1. 循环依赖：src/api/users.ts ↔ src/services/auth.ts

**优先级：** High  
**CBO：** 15  
**问题描述：** users.ts 调用 auth.ts 的 validateToken，auth.ts 调用 users.ts 的 getUserById，形成循环依赖。

**影响：**
- 核心文件：2
- 间接引用：5
- 测试文件：4

### 推荐方案 A（推荐）

提取 UserAuthContext 到独立模块 `src/auth/UserAuthContext.ts`

**模式：** Extract Interface

**步骤：**
1. 创建 src/auth/UserAuthContext.ts
2. 迁移 users.ts 逻辑
3. 更新 auth.ts 引用
4. 更新调用方

**优点：**
- 解除循环依赖
- 职责更清晰

**缺点：**
- 需要新增一个模块
- 需要更新 7 个文件

**成本估算：** Medium  
**风险等级：** Low

### 推荐方案 B

将 auth 逻辑下沉到 users 内部

**模式：** Merge Modules

（类似格式...）

---

## 2. God Object：src/lib/utils.ts

（类似格式...）

---

## 3. Feature Envy：src/ui/Dashboard.tsx

（类似格式...）
```

### Machine-Readable Cache

`.cortexloop/architecture-cache.json`

```json
{
  "analyzedAt": "2026-07-08T10:30:00Z",
  "scope": "whole-project",
  "couplingPoints": [
    {
      "id": "coupling-1",
      "type": "circular-dependency",
      "priority": "high",
      "priorityScore": 6,
      "confidence": "high",
      "files": ["src/api/users.ts", "src/services/auth.ts"],
      "cyclePath": ["src/api/users.ts", "src/services/auth.ts", "src/api/users.ts"],
      "metrics": {
        "cbo": 15,
        "fanIn": 7,
        "fanOut": 8
      },
      "description": "users.ts 调用 auth.ts 的 validateToken，auth.ts 调用 users.ts 的 getUserById",
      "impact": {
        "coreFiles": 2,
        "indirectReferences": 5,
        "testFiles": 4
      },
      "solutions": [
        {
          "id": "solution-1a",
          "label": "提取 UserAuthContext 到独立模块",
          "pattern": "extract-interface",
          "recommended": true,
          "confidence": "high",
          "steps": [
            "Create src/auth/UserAuthContext.ts",
            "Move auth-related logic from users.ts",
            "Update auth.ts references",
            "Update all callers"
          ],
          "pros": [
            "Breaks circular dependency",
            "Clearer responsibility"
          ],
          "cons": [
            "Requires new module",
            "Need to update 7 files"
          ],
          "impact": {
            "newFiles": 1,
            "modifiedFiles": 7,
            "testsRequired": true
          },
          "cost": "medium",
          "risk": "low"
        },
        {
          "id": "solution-1b",
          "label": "Merge auth logic into users module",
          "pattern": "merge-modules",
          "recommended": false,
          "confidence": "medium",
          "steps": [
            "Move auth.ts logic into users.ts",
            "Update all auth.ts imports to users.ts"
          ],
          "pros": [
            "No new module needed",
            "Simpler structure"
          ],
          "cons": [
            "users module becomes larger",
            "Mixing concerns"
          ],
          "impact": {
            "newFiles": 0,
            "modifiedFiles": 6,
            "testsRequired": true
          },
          "cost": "low",
          "risk": "medium"
        }
      ]
    }
  ]
}
```

## Red Flags

### Do NOT proceed with refactoring when:

- **Tests are failing** — Fix existing issues first
- **Production incident** — Architecture refactoring can wait
- **Code freeze active** — Wait until freeze lifts
- **Module is deprecated** — Will be removed soon anyway
- **Coupling is intentional** — Some coupling is by design (e.g., DTO shared between API and DB)

### Do NOT recommend refactoring when:

- **Impact > 20 files** — Too risky, break into smaller refactorings
- **No tests exist** — Write tests first
- **Module is external dependency** — Cannot refactor third-party code

### Do NOT auto-refactor when:

- **User is unsure** — Always get explicit confirmation
- **Risk level is High** — Show plan and get approval
- **Tests are flaky** — Fix test stability first

## Cost Estimation

| Coupling Type | Typical files affected | Typical cost | Typical risk |
|---------------|------------------------|--------------|--------------|
| Circular dependency | 2-10 | Medium | Low-Medium |
| God Object | 1 core + 10-30 callers | High | Medium |
| Feature Envy | 2-5 | Low | Low |
| Inappropriate Intimacy | 2-8 | Medium | Low-Medium |
| Shotgun Surgery | 10-20 | High | High |

## Examples

### Example 1: Circular Dependency

**Before:**

```typescript
// src/api/users.ts
import { validateToken } from './auth';
export function getUser(id) {
  if (!validateToken()) throw new Error('Unauthorized');
  return db.users.get(id);
}

// src/services/auth.ts
import { getUser } from './api/users';
export function validateToken() {
  const user = getUser(currentUserId);
  return user && user.isActive;
}
```

**After (Extract Interface):**

```typescript
// src/auth/UserAuthContext.ts
export interface UserAuthContext {
  userId: string;
  isActive: boolean;
}

export function validateToken(context: UserAuthContext) {
  return context && context.isActive;
}

// src/api/users.ts
import { validateToken, UserAuthContext } from './auth/UserAuthContext';
export function getUser(id, context: UserAuthContext) {
  if (!validateToken(context)) throw new Error('Unauthorized');
  return db.users.get(id);
}

// src/services/auth.ts
import { UserAuthContext } from './auth/UserAuthContext';
// No longer imports from users.ts
```

### Example 2: God Object

**Before:**

```typescript
// src/lib/utils.ts (1000 lines)
export function formatDate(date) { ... }
export function parseDate(str) { ... }
export function isValidEmail(email) { ... }
export function isValidPhone(phone) { ... }
export function fetchData(url) { ... }
export function postData(url, data) { ... }
// ... 50 more unrelated functions
```

**After (Split by Responsibility):**

```typescript
// src/lib/date-utils.ts
export function formatDate(date) { ... }
export function parseDate(str) { ... }

// src/lib/validation-utils.ts
export function isValidEmail(email) { ... }
export function isValidPhone(phone) { ... }

// src/lib/http-utils.ts
export function fetchData(url) { ... }
export function postData(url, data) { ... }
```

### Example 3: Transitive Circular Dependency

**Before:**

```typescript
// src/api/orders.ts
import { calculatePrice } from '../services/pricing';
export function createOrder(data) {
  const price = calculatePrice(data.items);
  return db.orders.create({ ...data, price });
}

// src/services/pricing.ts
import { getInventory } from '../repositories/inventory';
export function calculatePrice(items) {
  const inventory = getInventory(items);
  return items.reduce((sum, item) => sum + inventory[item.id].price, 0);
}

// src/repositories/inventory.ts
import { getOrders } from '../api/orders';
export function getInventory(items) {
  // Uses order history to adjust inventory
  const orders = getOrders();  // Circular dependency!
  // ...
}
```

**Cycle path:** `api/orders.ts → services/pricing.ts → repositories/inventory.ts → api/orders.ts`

**After (Extract Interface):**

```typescript
// src/models/OrderData.ts (new shared module)
export interface OrderData {
  id: string;
  items: Item[];
  price: number;
}

// src/api/orders.ts
import { calculatePrice } from '../services/pricing';
import { OrderData } from '../models/OrderData';
export function createOrder(data): OrderData {
  const price = calculatePrice(data.items);
  return db.orders.create({ ...data, price });
}

// src/services/pricing.ts
import { getInventory } from '../repositories/inventory';
export function calculatePrice(items) {
  const inventory = getInventory(items);
  return items.reduce((sum, item) => sum + inventory[item.id].price, 0);
}

// src/repositories/inventory.ts
import { OrderData } from '../models/OrderData';
// No longer imports from api/orders
export function getInventory(items) {
  // Uses OrderData interface instead of calling API
  const orders: OrderData[] = db.orders.getAll();
  // ...
}
```

**Key change:** Break the cycle by extracting the shared data structure (`OrderData`) into a separate module that all three layers can depend on, without creating a cycle.

## Final Checklist

Before finishing refactoring:

- [ ] All affected files have been updated
- [ ] All imports have been corrected
- [ ] All tests pass
- [ ] No new circular dependencies introduced
- [ ] Coupling metrics improved (CBO decreased)
- [ ] User confirmed refactoring completion
- [ ] Report written to `docs/cortexloop/architecture-analysis.md`
- [ ] Cache written to `.cortexloop/architecture-cache.json`
