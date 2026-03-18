---
name: O(n²) 边过滤性能问题
description: use-auto-layout.ts 中边过滤使用嵌套 find，复杂度 O(n²)
type: performance
status: pending
priority: p2
issue_id: "009"
tags: [code-review, performance, algorithm]
---

## Problem Statement

`use-auto-layout.ts` 中过滤布局相关边时，对每条边都调用 `storeNodes.find()`，形成 O(n²) 复杂度：

```typescript
const layoutableEdges = storeEdges.filter(e => {
  const sourceNode = storeNodes.find(n => n.id === e.source)  // O(n)
  const targetNode = storeNodes.find(n => n.id === e.target)  // O(n)
  return (sourceNode?.type === 'direction' || sourceNode?.type === 'idea') &&
         (targetNode?.type === 'direction' || targetNode?.type === 'idea')
})
```

当节点数量增长时（深层树展开），每次布局触发都需要 O(edges × nodes) 的计算。

**Why:** 随着树深度增加，性能会显著下降，影响布局响应速度。

**How to apply:** 需要频繁查找的集合应先建立 Map 索引。

## Findings

**位置：** `src/canvas/hooks/use-auto-layout.ts` - `runLayout` 函数内

```typescript
// 同样的问题也出现在 canvas-store.ts 的 searchIdea 中：
set((s) => ({
  edges: s.edges.filter(e => {
    const sourceNode = s.nodes.find(n => n.id === e.source)  // O(n)
    const targetNode = s.nodes.find(n => n.id === e.target)  // O(n)
    return sourceNode?.type !== 'direction' && sourceNode?.type !== 'idea' &&
           targetNode?.type !== 'direction' && targetNode?.type !== 'idea'
  }),
}))
```

**影响范围：** 每次布局触发（可能每帧）都执行此计算。

## Proposed Solutions

### 方案 A：预建 nodeId → type Map（推荐）

```typescript
// 在 runLayout 开始时建立索引，O(n) 一次
const nodeTypeMap = new Map(storeNodes.map(n => [n.id, n.type]))

const layoutableEdges = storeEdges.filter(e => {
  const sourceType = nodeTypeMap.get(e.source)  // O(1)
  const targetType = nodeTypeMap.get(e.target)  // O(1)
  return (sourceType === 'direction' || sourceType === 'idea') &&
         (targetType === 'direction' || targetType === 'idea')
})
// 总复杂度：O(n + e)，而非 O(n × e)
```

**优点：** 复杂度从 O(n²) 降至 O(n+e)，实现简单
**风险：** 极低

### 方案 B：在 Store 中维护 direction/idea 节点的独立集合

在 Store 中单独维护 `directionNodes` 和 `ideaNodes` 数组，避免每次过滤。

**优点：** 根本解决，O(1) 访问
**缺点：** 需要修改 Store 结构，改动较大

## Recommended Action

方案 A，最小改动，立即可用。

## Technical Details

- **受影响文件：** `src/canvas/hooks/use-auto-layout.ts`, `src/canvas/store/canvas-store.ts`
- **受影响函数：** `runLayout`, `searchIdea`

## Acceptance Criteria

- [ ] 边过滤不再使用嵌套 `find`
- [ ] 使用 Map 索引实现 O(1) 节点类型查找
- [ ] 性能在 100+ 节点时无明显下降

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
