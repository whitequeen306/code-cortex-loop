# 代码解耦专家设计规格

## 目标

新增独立的"代码解耦专家"，检测架构耦合问题并提供交互式重构能力。

**核心定位：** 不进现有 7 专家流水线，作为独立的架构健康检查和重构向导。

## 为什么不进 7 专家流水线

现有 7 个专家的共性：

- 审查 + 诊断角色
- 不改架构，保持行为不变
- 适合每次 PR 运行
- 产出是 finding list

代码解耦专家的特性：

- 架构重构决策
- 需要改架构和模块边界
- 适合季度/月度运行
- 产出是重构方案 + 可选执行

**结论：** 它们不在同一个层次，应该分离。

## 命令设计

### 主命令

```text
/cortexloop-architecture
```

单一入口，默认流程：

1. 分析依赖图和耦合点
2. 生成报告并写入磁盘
3. 在聊天里展示摘要
4. 问用户是否执行重构
   - 选 A：进入交互式重构
   - 选 B：只保留报告

### 可选参数

```text
/cortexloop-architecture --report-only    强制只生成报告
/cortexloop-architecture --auto-refactor  跳过确认直接重构（高风险）
```

默认行为不需要参数。

## 工作流程

### 阶段 1：分析（自动）

输入：

- 项目代码
- 可选 scope（默认整个项目）

执行：

1. 扫描依赖图
2. 检测循环依赖
3. 检测过度耦合的模块
4. 检测职责不清晰的类/函数
5. 计算每个耦合点的优先级

输出：

- `docs/cortexloop/architecture-analysis.md`（人类可读）
- `.cortexloop/architecture-cache.json`（机器可读，供后续恢复）

### 阶段 2：展示（自动）

在聊天里展示：

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
```

### 阶段 3：决策（交互）

问用户：

```text
要对这些耦合点执行重构吗？

A. 是，开始交互式重构
B. 否，只保留报告（稍后可以手动重构）
```

**用户选 A：** 进入阶段 4。

**用户选 B：** 结束，报告已保存。

### 阶段 4：交互式重构（如果选 A）

逐个处理每个耦合点：

```text
要执行哪个解耦？

A. 执行第 1 个（users + auth 循环依赖）
B. 执行第 2 个（Dashboard 耦合）
C. 执行第 3 个（utils 拆分）
D. 依次执行全部
E. 停止

用户选 A

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

确认执行？
A. 是
B. 否，跳过这个
C. 看详细 diff 再决定
```

**用户选 A：**

```text
[开始重构...]

步骤 1/4: 创建 src/auth/UserAuthContext.ts
步骤 2/4: 迁移 users.ts 逻辑
步骤 3/4: 更新 auth.ts 引用
步骤 4/4: 更新调用方

[运行测试...]
✓ tests/api/users.test.ts 通过
✓ tests/services/auth.test.ts 通过
✓ 全量测试通过

✓ 解耦成功

继续执行其他解耦吗？
A. 执行第 2 个
B. 执行第 3 个
C. 停止，提交当前改动
```

**如果测试失败：**

```text
[运行测试...]
✗ tests/api/users.test.ts 失败
  - UserController.login 返回 undefined

检测到测试失败。

选项：
A. 回滚这次重构，保留报告
B. 尝试修复测试（可能需要你手动介入）
C. 忽略失败，继续下一个解耦（不推荐）
```

### 阶段 5：后续恢复（如果用户稍后想改）

用户在另一个会话说：

```text
我看了 architecture-analysis.md，现在想执行第 2 个解耦
```

AI 逻辑：

1. 读取 `docs/cortexloop/architecture-analysis.md` 或 `.cortexloop/architecture-cache.json`
2. 找到第 2 个建议
3. 快速 diff 检查代码是否大改
4. 如果代码基本一致，直接进入重构流程
5. 如果代码已经大改，提示用户重新分析

## 报告格式

### 人类可读版本

`docs/cortexloop/architecture-analysis.md`

```markdown
# 架构解耦分析

**分析时间：** 2026-07-08 10:30:00
**分析范围：** 整个项目
**发现耦合点：** 3 处

## 1. 循环依赖：src/api/users.ts ↔ src/services/auth.ts

**优先级：** High
**问题描述：** users.ts 调用 auth.ts 的 validateToken，auth.ts 调用 users.ts 的 getUserById，形成循环依赖。
**影响：** 2 个核心文件 + 5 个间接引用

### 推荐方案 A（推荐）

提取 UserAuthContext 到独立模块 `src/auth/UserAuthContext.ts`

**优点：**
- 解除循环依赖
- 职责更清晰

**缺点：**
- 需要新增一个模块
- 需要更新 7 个文件

**成本估算：** Medium

### 推荐方案 B

将 auth 逻辑下沉到 users 内部

**优点：**
- 不需要新增模块

**缺点：**
- users 模块职责变重
- 不利于后续扩展

**成本估算：** Low

## 2. 过度耦合：src/ui/Dashboard.tsx

（类似格式）

## 3. 被过度依赖：src/lib/utils.ts

（类似格式）
```

### 机器可读版本

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
      "files": ["src/api/users.ts", "src/services/auth.ts"],
      "description": "users.ts 调用 auth.ts 的 validateToken，auth.ts 调用 users.ts 的 getUserById",
      "impact": {
        "coreFiles": 2,
        "indirectReferences": 5
      },
      "solutions": [
        {
          "id": "solution-1a",
          "label": "提取 UserAuthContext 到独立模块",
          "recommended": true,
          "steps": [
            "创建 src/auth/UserAuthContext.ts",
            "迁移 users.ts 逻辑",
            "更新 auth.ts 引用",
            "更新调用方"
          ],
          "impact": {
            "newFiles": 1,
            "modifiedFiles": 7,
            "testsRequired": true
          },
          "cost": "medium"
        },
        {
          "id": "solution-1b",
          "label": "将 auth 逻辑下沉到 users",
          "recommended": false,
          "steps": ["..."],
          "impact": {"..."},
          "cost": "low"
        }
      ]
    }
  ]
}
```

## 与现有流水线的区别

| 维度 | 现有 7 专家 | 代码解耦专家 |
|------|------------|------------|
| 命令 | `/cortexloop` | `/cortexloop-architecture` |
| 进流水线 | 是 | 否 |
| 频率 | 每次 PR | 月度/季度 |
| 改架构 | 否 | 是 |
| 自动修 | Direct 可自动修 bug | 必须逐个确认重构 |
| 产物 | `report.json` + finding list | `architecture-analysis.md` + 重构方案 |
| 健康分 | 打 0-100 分 | 不打分 |
| handoff | 写 handoff JSON | 不写 handoff |
| Playbook | 记录修复经验 | 记录重构经验（可选） |

## 实现清单

### 命令文件

- `commands/cortexloop-architecture.md`

### Agent 文件

- `agents/architecture-analyst.md`

### Skill 文件

- `skills/architecture-analysis/SKILL.md`

### 脚本

- `scripts/analyze-architecture.mjs`（可选，如果需要独立脚本支持）

### 产物路径

- `docs/cortexloop/architecture-analysis.md`
- `.cortexloop/architecture-cache.json`

### 测试

- `tests/architecture-analysis.test.mjs`

## 触发场景

推荐用户在这些情况下运行 `/cortexloop-architecture`：

- 季度架构复盘
- 新人 onboard 前（理解当前架构状态）
- 重构冲刺启动前
- 模块变得难以测试时
- 团队讨论"这块代码乱了"时
- Release 前的架构健康检查

## 成本预算

预估成本（取决于项目大小）：

| 项目规模 | 分析时间 | 预估 token |
|---------|---------|-----------|
| 小（<50 文件） | ~1-2 分钟 | ~5万-10万 |
| 中（50-200 文件） | ~3-5 分钟 | ~15万-30万 |
| 大（200+ 文件） | ~8-15 分钟 | ~40万-80万 |

交互式重构成本：

- 每个解耦点：~2-5 分钟
- 每个解耦点 token：~5万-15万

建议：

- 第一次跑只生成报告，不立刻重构
- 看完报告后选择优先级最高的 1-2 个解耦点执行
- 不要一次重构所有耦合点

## 与其他架构工具的区别

| 工具 | 作用 | CodeCortexLoop 架构专家 |
|------|------|----------------------|
| Madge | 生成依赖图 | 生成依赖图 + 解耦建议 + 交互式重构 |
| dependency-cruiser | 检测规则违反 | 检测耦合 + 给出方案 + 执行重构 |
| nx affected | 分析影响范围 | 分析影响 + 建议如何解耦 |
| 人工 review | 讨论架构 | AI 建议方案 + 自动执行 |

**核心优势：** 不只是分析，而是 AI 给出可执行的解耦方案，并且可以帮你执行。

## 未来扩展

可以在后续版本加入：

- **依赖图可视化**：生成 `.svg` 或 `.html` 交互图
- **耦合趋势**：记录历次分析，展示耦合是变好还是变差
- **自定义规则**：用户定义"哪些模块不应该互相依赖"
- **成本收益分析**：告诉用户"解耦这个模块能减少多少维护成本"
- **重构模式库**：记录成功的解耦经验，下次类似耦合自动推荐

## 示例对话

完整的用户对话示例见附录（可后续补充）。

## 风险和限制

1. **分析准确度依赖 AI**  
   AI 可能误判某些合理的依赖为"耦合"。

2. **重构风险**  
   架构重构比修 bug 风险更高，即使有测试也可能引入问题。

3. **成本较高**  
   完整项目分析可能消耗大量 token，不适合频繁运行。

4. **不适合所有项目**  
   小项目（<20 文件）可能不需要解耦专家。

## 决策

**批准这个设计后，下一步是：**

1. 创建 `commands/cortexloop-architecture.md` 命令文档
2. 创建 `agents/architecture-analyst.md` agent 定义
3. 创建 `skills/architecture-analysis` skill
4. 编写示例对话和测试用例
5. 实现第一版（只分析 + 报告，不做重构）
6. 后续加入交互式重构能力

**本设计文档版本：** v1.0  
**创建时间：** 2026-07-08  
**状态：** 待批准
