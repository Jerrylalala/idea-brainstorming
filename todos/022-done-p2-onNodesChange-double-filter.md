---
name: onNodesChange 每帧执行两次 filter，热路径分配浪费
description: ReactFlow 每次 pointer move 都调用 onNodesChange，当前代码无论是否有 remove 变更都执行两次 Array.filter
type: performance
status: pending
priority: p2
issue_id: "022"
tags: [code-review, performance, reactflow, canvas]
---

## Problem Statement

`canvas-store.ts` 的 `onNodesChange` 在拖拽时被高频调用（每次 pointer move 一次）。当前实现无条件执行两次 `filter()` 遍历：

```typescript
onNodesChange: (changes) => {
  const removeChanges = changes.filter(c => c.type === 'remove')
  const otherChanges = changes.filter(c => c.type !== 'remove')
  // 常见场景：changes 全是 position 变更，两次 filter 都遍历整个数组但 removeChanges 为空
  if (otherChanges.length > 0) {
    set({ nodes: applyNodeChanges(otherChanges, get().nodes) as CanvasNode[] })
  }
  removeChanges.forEach(c => get().deleteNode((c as { id: string }).id))
}
```

**Why:** 50+ 节点的画布，拖拽时每帧 O(n) × 2 次分配，会造成可见的 GC 压力，影响拖拽流畅度。

## Proposed Solutions

### 方案 A（推荐）：单次遍历分区

```typescript
onNodesChange: (changes) => {
  const removes: NodeChange<CanvasNode>[] = []
  const others: NodeChange<CanvasNode>[] = []
  for (const c of changes) {
    if (c.type === 'remove') removes.push(c)
    else others.push(c)
  }
  if (others.length > 0) {
    set({ nodes: applyNodeChanges(others, get().nodes) as CanvasNode[] })
  }
  removes.forEach(c => get().deleteNode((c as { id: string }).id))
}
```

一次遍历完成分区，消除第二次 filter 调用。

### 方案 B（极简）：检查是否有 remove 再处理

```typescript
onNodesChange: (changes) => {
  const hasRemove = changes.some(c => c.type === 'remove')
  const otherChanges = hasRemove ? changes.filter(c => c.type !== 'remove') : changes
  if (otherChanges.length > 0) {
    set({ nodes: applyNodeChanges(otherChanges as NodeChange<CanvasNode>[], get().nodes) as CanvasNode[] })
  }
  if (hasRemove) {
    changes.filter(c => c.type === 'remove').forEach(c => get().deleteNode((c as { id: string }).id))
  }
}
```

快路径（无 remove）：只有一次 `some()` 遍历，无分配。

## Acceptance Criteria

- [ ] 拖拽节点时不触发第二次 filter 遍历（可用 Chrome DevTools Performance 面板验证）
- [ ] 删除节点功能仍然正常

## Work Log

- 2026-03-18: 代码审查发现，由 performance-oracle agent 标记为 P2 Finding 6
