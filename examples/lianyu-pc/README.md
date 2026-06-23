# LianYu-PC — CodeCortexLoop 真实项目报告

**来源：** [LianYu-PC](https://github.com/whitequeen306/LianYuPC)（Vue 3 + Spring Boot 全栈）  
**运行方式：** `/cortexloop-deep` · **Report 模式** · 整库扫描  
**生成时间：** 2026-06-22  

> 本目录为 **Report 模式产物拷贝**，不含 LianYu-PC 源码。原项目未被修改。  
> **想查看此项目：** [https://github.com/whitequeen306/LianYuPC](https://github.com/whitequeen306/LianYuPC)

## 结果概览

| 指标 | 数值 |
|------|------|
| **健康分** | **32 / 100** |
| Critical | 9 |
| High | 32 |
| Medium | 31 |
| Low | 9 |
| **合计** | **81** 条 finding |

| 类别 | 分数 |
|------|------|
| Correctness | 0 |
| Security | 55 |
| Error handling | 0 |
| Performance | 22 |
| Tests | 0 |
| Simplicity | 39 |
| Cleanup | 81 |

## 文件说明

| 文件 | 用途 |
|------|------|
| [showcase.html](docs/cortexloop/showcase.html) | **优化可视化看板**（README 用） |
| [report.html](docs/cortexloop/report.html) | 标准完整看板（含全部 finding 表） |
| [report.json](docs/cortexloop/report.json) | 机器可读，CI 门禁输入 |
| [00-summary.md](docs/cortexloop/00-summary.md) … `07-cleanup.md` | 分类 Markdown 报告 |

## Top 5 优先级（摘自 Report）

1. **CL-010** — SSE 流错误时仍部分持久化（Critical · correctness）
2. **CL-001** — 验证码 API 泄露明文表达式（High · security）
3. **CL-023/024** — 聊天轮询与通知静默失败（Critical · error-handling）
4. **CL-050–055** — 认证/SSE/群组/记忆等核心路径零测试（Critical · tests）
5. **CL-038/042** — Memory 列表 N+1、Moments 评论轮询风暴（High · performance）

## 重新生成 showcase 图

```bash
node scripts/make-showcase-dashboard.mjs examples/lianyu-pc/docs/cortexloop/report.json \
  --out=examples/lianyu-pc/docs/cortexloop/showcase.html \
  --title="LianYu-PC" --subtitle="Vue 3 + Spring Boot · 全栈"
python scripts/capture-showcase-screenshot.py
```
