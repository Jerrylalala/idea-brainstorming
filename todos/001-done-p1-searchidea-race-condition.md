---
name: searchIdea 竞态条件
description: 快速连续搜索时，旧请求结果污染新搜索的画布，产生孤立方向节点
type: bug
status: pending
priority: p1
issue_id: "001"
tags: [code-review, state-management, async, race-condition]
---

## Problem Statement

`searchIdea` 是一个 async 函数，但没有取消机制。用户快速连续提交两次搜索时，第一次的 AI 请求仍在进行中，第二次搜索会清除画布并创建新的 ideaNode。当第一次请求返回时，它会把旧的 directionNodes 追加到当前画布，产生没有父节点和边的孤立方向节点。

**Why:** 直接影响核心用户流程的正确性，用户快速搜索时必现。

**How to apply:** 任何 async store action 都需要考虑竞态取消。

## Findings

**位置：** `src/canvas/store/canvas-store.ts` - `searchIdea` 方法

**竞态时序：**
```
T=0ms   用户提交搜索 "A" → 清除画布 → 创建 ideaNodeA → 发起 AI 请求 A
T=500ms 用户提交搜索 "B" → 清除画布（包括 ideaNodeA）→ 创建 ideaNodeB → 发起 AI 请求 B
T=3000ms AI 请求 A 返回 → 把 directionNodesA 追加到画布（此时 ideaNodeA 已不存在）
结果：画布上出现属于搜索 A 的孤立方向节点，没有父节点和边
```

**根本原因：** 没有版本号或 AbortController 机制来取消过期请求。

## Proposed Solutions

### 方案 A：版本号取消（推荐）

```typescript
// store 闭包内
let currentSearchVersion = 0

searchIdea: async (idea) => {
  const myVersion = ++currentSearchVersion

  set((s) => ({ nodes: s.nodes.filter(...) }))
  const ideaNode = createIdeaNode(...)
  set((s) => ({ nodes: [...s.nodes, ideaNode] }))

  try {
    const directions = await aiClient.generateDirections({ idea })
    if (myVersion !== currentSearchVersion) return  // 已被新搜索取代

    // 正常更新...
  } catch (err) {
    if (myVersion !== currentSearchVersion) return
    // 错误处理...
    throw err
  }
}
```

**优点：** 实现简单，零依赖，完全解决竞态
**缺点：** 旧请求仍在网络层执行（浪费带宽），但结果被丢弃
**风险：** 低

### 方案 B：AbortController

```typescript
let currentAbortController: AbortController | null = null

searchIdea: async (idea) => {
  if (currentAbortController) currentAbortController.abort()
  currentAbortController = new AbortController()
  const signal = currentAbortController.signal

  // 传递 signal 给 aiClient
  const directions = await aiClient.generateDirections({ idea, signal })
  // ...
}
```

**优点：** 真正取消网络请求，节省带宽
**缺点：** 需要 aiClient 支持 AbortSignal，改动范围更大
**风险：** 中

## Recommended Action

方案 A，改动最小，立即可用。

## Technical Details

- **受影响文件：** `src/canvas/store/canvas-store.ts`
- **受影响方法：** `searchIdea`
- **同样需要修复：** `searchIdea` 的 catch 块需要 `throw err`，让 SearchBar 能感知错误（见 issue 002）

## Acceptance Criteria

- [ ] 快速连续提交两次搜索，画布只显示最新搜索的结果
- [ ] 旧搜索的方向节点不会出现在新搜索的画布上
- [ ] 搜索失败时错误能被 SearchBar 感知

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
