---
status: pending
priority: p2
issue_id: "030"
tags: [code-review, architecture, boundary]
dependencies: []
---

# server/app.ts 直接导入 src/canvas/lib/ 客户端代码，违反服务端/客户端边界

## Problem Statement

`server/app.ts` 直接导入 `src/canvas/lib/prompt-builder` 和 `src/canvas/types`，这两个文件属于前端画布模块。服务端代码不应依赖客户端代码，否则：1）打包时可能引入浏览器专用 API（如 `window`、`localStorage`）；2）模块边界模糊，未来难以将 server 独立部署；3）类型变更会同时影响前后端。

## Findings

- `server/app.ts:5-6`：
  ```typescript
  import { buildDirectionPrompt, parseDirectionsJSON } from '../src/canvas/lib/prompt-builder'
  import type { ChatChunk, DirectionRequest } from '../src/canvas/types'
  ```
- `src/canvas/lib/prompt-builder` 是前端画布逻辑，不应被服务端直接引用
- `src/canvas/types` 包含 ReactFlow 相关类型，服务端只需要 `ChatChunk`/`DirectionRequest` 的子集
- Architecture Strategist 发现此问题

## Proposed Solutions

### Option 1: 将共享类型提取到 shared/ 目录（推荐）

**Approach:**

```
src/
  shared/
    types.ts        # ChatChunk, DirectionRequest 等共享类型
    prompt-builder.ts  # 纯函数，无浏览器依赖
server/
  app.ts            # 只从 ../src/shared/ 导入
```

**Pros:** 明确边界，共享代码显式标注
**Cons:** 需要移动文件，更新导入路径
**Effort:** 30 分钟
**Risk:** Low

---

### Option 2: 在 server/ 内复制所需类型

**Approach:** 在 `server/types.ts` 中重新定义 `ChatChunk` 和 `DirectionRequest`，不跨边界导入。

**Pros:** 完全解耦
**Cons:** 类型重复，可能分叉
**Effort:** 15 分钟
**Risk:** Low

---

### Option 3: 保持现状，添加注释说明依赖关系

**Approach:** 在 `server/app.ts` 顶部添加注释，说明这些导入是纯类型/纯函数，无浏览器依赖。

**Pros:** 零改动
**Cons:** 未解决根本问题，未来可能引入真正有问题的依赖
**Effort:** 5 分钟
**Risk:** Low（短期）

## Recommended Action

Option 1，创建 `src/shared/` 目录存放跨边界共享的纯类型和纯函数。

## Technical Details

**Affected files:**
- `server/app.ts:5-6` — 修改导入路径
- `src/canvas/lib/prompt-builder.ts` → `src/shared/prompt-builder.ts`（移动）
- `src/canvas/types.ts` — 提取 `ChatChunk`、`DirectionRequest` 到 `src/shared/types.ts`

## Acceptance Criteria

- [ ] `server/` 目录不直接导入 `src/canvas/` 下的文件
- [ ] 共享类型/函数位于 `src/shared/` 或等效位置
- [ ] TypeScript 编译通过

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Architecture Strategist)
