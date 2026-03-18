---
name: searchIdea 三次连续 set() 调用可合并
description: searchIdea 中三个独立的 set() 调用可以合并为一次，减少不必要的渲染
type: performance
status: pending
priority: p3
issue_id: "013"
tags: [code-review, performance, state-management]
---

## Problem Statement

`searchIdea` 方法在初始化阶段连续调用了三次 `set()`：

```typescript
// set 1: 清除旧节点
set((s) => ({ nodes: s.nodes.filter(...), edges: s.edges.filter(...) }))

// set 2: 添加 ideaNode
set((s) => ({ nodes: [...s.nodes, ideaNode] }))

// set 3: 设置 generating 状态
set((s) => ({ nodes: s.nodes.map(n => n.id === ideaNode.id ? {...} : n) }))
```

每次 `set()` 都会触发 Zustand 订阅者重渲染。虽然 React 18 的自动批处理（auto-batching）会合并同步调用，但这三次 `set()` 在语义上是一个原子操作，应该合并。

**Why:** 代码意图不清晰，且在某些边缘情况（如 `set()` 在 Promise 回调中）可能绕过批处理。

**How to apply:** 语义上的原子操作应该用单次 `set()` 完成。

## Findings

**位置：** `src/canvas/store/canvas-store.ts` - `searchIdea` 方法（第 316-337 行）

```typescript
searchIdea: async (idea) => {
  // set 1
  set((s) => ({
    nodes: s.nodes.filter(n => n.type !== 'direction' && n.type !== 'idea'),
    edges: s.edges.filter(e => { ... }),
  }))

  // set 2（依赖 set 1 的结果）
  const ideaNode = createIdeaNode({ x: 100, y: 300 }, idea)
  set((s) => ({ nodes: [...s.nodes, ideaNode] }))

  // set 3（依赖 set 2 的结果）
  set((s) => ({
    nodes: s.nodes.map(n =>
      n.id === ideaNode.id ? { ...n, data: { ...n.data, status: 'generating' } } : n
    ),
  }))
  // ...
}
```

## Proposed Solutions

### 方案 A：合并为单次 set()（推荐）

```typescript
searchIdea: async (idea) => {
  const ideaNode = createIdeaNode({ x: 100, y: 300 }, idea)
  const ideaNodeGenerating = { ...ideaNode, data: { ...ideaNode.data, status: 'generating' as const } }

  // 单次原子更新
  set((s) => ({
    nodes: [
      ...s.nodes.filter(n => n.type !== 'direction' && n.type !== 'idea'),
      ideaNodeGenerating,
    ],
    edges: s.edges.filter(e => {
      const sourceNode = s.nodes.find(n => n.id === e.source)
      const targetNode = s.nodes.find(n => n.id === e.target)
      return sourceNode?.type !== 'direction' && sourceNode?.type !== 'idea' &&
             targetNode?.type !== 'direction' && targetNode?.type !== 'idea'
    }),
  }))

  // 4. 调用 AI...
}
```

**优点：** 语义清晰，减少渲染次数，代码更简洁
**风险：** 极低

## Recommended Action

方案 A。

## Technical Details

- **受影响文件：** `src/canvas/store/canvas-store.ts`
- **受影响方法：** `searchIdea`

## Acceptance Criteria

- [ ] 初始化阶段只调用一次 `set()`
- [ ] 功能行为不变

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
